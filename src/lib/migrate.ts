import { readStructuredFile, isRecord } from "./io.js";

export interface MigrationResult {
  sourcePath: string;
  catalog: Record<string, unknown[]>;
  warnings: string[];
}

interface MappingRule {
  source: string;
  target: {
    type: string;
    key: string;
    valueType?: string;
  };
}

export async function migrateLaunchDarklySource(sourcePath: string): Promise<MigrationResult> {
  const parsed = await readStructuredFile(sourcePath);
  const warnings: string[] = [];
  const features: Record<string, unknown>[] = [];

  if (!isRecord(parsed) || !Array.isArray(parsed.flags)) {
    warnings.push("Expected LaunchDarkly export with a top-level `flags` array.");
    return {
      sourcePath,
      catalog: { features },
      warnings,
    };
  }

  for (const [index, flag] of parsed.flags.entries()) {
    if (!isRecord(flag)) {
      warnings.push(`flags[${index}] is not an object and was skipped.`);
      continue;
    }

    const key = typeof flag.key === "string" ? flag.key : typeof flag.name === "string" ? flag.name : null;
    if (!key) {
      warnings.push(`flags[${index}] has no key/name and was skipped.`);
      continue;
    }

    const variations = Array.isArray(flag.variations) ? flag.variations : [];
    if (variations.length > 2) {
      warnings.push(`Flag "${key}" has ${variations.length} variations; mapped as boolean approximation.`);
    }

    features.push({
      id: key,
      key,
      name: typeof flag.name === "string" ? flag.name : key,
      description:
        typeof flag.description === "string"
          ? flag.description
          : "Imported from LaunchDarkly via monetizekit migrate launchdarkly.",
      type: "boolean",
      defaultValue: Boolean(flag.on),
    });
  }

  return {
    sourcePath,
    catalog: { features },
    warnings,
  };
}

export async function migrateCustomSource(
  sourcePath: string,
  mappingPath: string,
): Promise<MigrationResult> {
  const source = await readStructuredFile(sourcePath);
  const mappingDoc = await readStructuredFile(mappingPath);
  const warnings: string[] = [];
  const catalog: Record<string, unknown[]> = {};

  if (!isRecord(mappingDoc) || !Array.isArray(mappingDoc.mappings)) {
    warnings.push("Mapping file must contain a `mappings` array.");
    return { sourcePath, catalog, warnings };
  }

  for (const [index, ruleCandidate] of mappingDoc.mappings.entries()) {
    if (!isMappingRule(ruleCandidate)) {
      warnings.push(`mapping[${index}] is invalid and was skipped.`);
      continue;
    }

    const value = getByPath(source, ruleCandidate.source);
    if (value === undefined) {
      warnings.push(`Source path "${ruleCandidate.source}" not found.`);
      continue;
    }

    const collectionName = normalizeTargetType(ruleCandidate.target.type);
    const record = {
      id: ruleCandidate.target.key,
      key: ruleCandidate.target.key,
      source: ruleCandidate.source,
      valueType: ruleCandidate.target.valueType ?? inferValueType(value),
      value,
    };

    if (!catalog[collectionName]) {
      catalog[collectionName] = [];
    }
    catalog[collectionName].push(record);
  }

  return {
    sourcePath,
    catalog,
    warnings,
  };
}

export async function migrateDryRunSource(sourcePath: string): Promise<MigrationResult & { dryRun: true }> {
  const parsed = await readStructuredFile(sourcePath);
  const warnings: string[] = [];
  const catalog: Record<string, unknown[]> = {};

  if (isRecord(parsed) && Array.isArray(parsed.flags)) {
    const ld = await migrateLaunchDarklySource(sourcePath);
    return {
      ...ld,
      dryRun: true,
    };
  }

  if (isRecord(parsed)) {
    catalog.preview = Object.keys(parsed).map((key) => ({ key, kind: typeof parsed[key] }));
  } else if (Array.isArray(parsed)) {
    catalog.preview = parsed.map((entry, index) => ({ index, kind: typeof entry }));
  } else {
    warnings.push("Unsupported source format for dry-run preview.");
    catalog.preview = [];
  }

  return {
    sourcePath,
    catalog,
    warnings,
    dryRun: true,
  };
}

function normalizeTargetType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized.endsWith("s")) {
    return normalized;
  }
  return `${normalized}s`;
}

function inferValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function getByPath(value: unknown, path: string): unknown {
  const segments = path.split(".").filter((segment) => segment.length > 0);
  let current: unknown = value;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isMappingRule(value: unknown): value is MappingRule {
  if (!isRecord(value) || !isRecord(value.target)) {
    return false;
  }

  return (
    typeof value.source === "string" &&
    typeof value.target.type === "string" &&
    typeof value.target.key === "string"
  );
}
