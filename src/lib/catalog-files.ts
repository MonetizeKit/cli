import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import YAML from "yaml";

import {
  CATALOG_RESOURCE_TYPES,
  loadCatalogObjectFromFile,
  resolveCatalogObjectId,
  type CatalogObject,
  type CatalogResourceType,
  type CatalogSnapshot,
} from "./catalog.js";

export interface CatalogFileEntry {
  relativePath: string;
  content: string;
}

export async function loadCatalogSnapshotFromDir(dir: string): Promise<CatalogSnapshot> {
  const snapshot: CatalogSnapshot = {
    plans: [],
    features: [],
    addons: [],
    products: [],
    meters: [],
  };

  for (const type of CATALOG_RESOURCE_TYPES) {
    const typeDir = join(dir, type);
    if (!(await pathExists(typeDir))) {
      continue;
    }

    const entries = await readdir(typeDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && isCatalogFile(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const object = await loadCatalogObjectFromFile(join(typeDir, file));
      snapshot[type].push(sortObjectDeep(object));
    }
  }

  return sortCatalogSnapshot(snapshot);
}

export async function writeCatalogSnapshotToDir(
  dir: string,
  snapshot: CatalogSnapshot,
): Promise<CatalogFileEntry[]> {
  const entries = serializeCatalogSnapshot(snapshot);
  for (const entry of entries) {
    const path = join(dir, entry.relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, entry.content, "utf8");
  }

  return entries;
}

export function serializeCatalogSnapshot(snapshot: CatalogSnapshot): CatalogFileEntry[] {
  const entries: CatalogFileEntry[] = [];
  for (const type of CATALOG_RESOURCE_TYPES) {
    const sortedObjects = [...snapshot[type]].sort((left, right) =>
      resolveCatalogObjectId(left, "").localeCompare(resolveCatalogObjectId(right, "")),
    );

    for (const object of sortedObjects) {
      const id = resolveCatalogObjectId(object, "unknown");
      entries.push({
        relativePath: `${type}/${toSafeFileName(id)}.yaml`,
        content: serializeCatalogObject(object),
      });
    }
  }

  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function serializeCatalogObject(object: CatalogObject): string {
  return `${YAML.stringify(sortObjectDeep(object))}`.replace(/\n?$/, "\n");
}

export function deserializeCatalogObject(serialized: string): CatalogObject {
  const parsed = YAML.parse(serialized) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Catalog document must deserialize to an object.");
  }

  return sortObjectDeep(parsed);
}

export function sortCatalogSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  const sorted: CatalogSnapshot = {
    plans: [],
    features: [],
    addons: [],
    products: [],
    meters: [],
  };

  for (const type of CATALOG_RESOURCE_TYPES) {
    sorted[type] = [...snapshot[type]]
      .map((object) => sortObjectDeep(object))
      .sort((left, right) =>
        resolveCatalogObjectId(left, "").localeCompare(resolveCatalogObjectId(right, "")),
      );
  }

  return sorted;
}

export function validateCatalogSnapshot(snapshot: CatalogSnapshot): string[] {
  const errors: string[] = [];

  for (const type of CATALOG_RESOURCE_TYPES) {
    for (const object of snapshot[type]) {
      if (!resolveCatalogObjectId(object)) {
        errors.push(`${type}: object is missing id/key/slug.`);
      }
    }
  }

  const featureIds = new Set(snapshot.features.map((object) => resolveCatalogObjectId(object, "")));
  const meterIds = new Set(snapshot.meters.map((object) => resolveCatalogObjectId(object, "")));
  const addonIds = new Set(snapshot.addons.map((object) => resolveCatalogObjectId(object, "")));
  const productIds = new Set(snapshot.products.map((object) => resolveCatalogObjectId(object, "")));

  for (const plan of snapshot.plans) {
    const planId = resolveCatalogObjectId(plan, "<unknown-plan>");
    const refs = collectPlanReferences(plan);

    if (refs.product && !productIds.has(refs.product)) {
      errors.push(`plans/${planId}: missing product reference "${refs.product}".`);
    }

    for (const featureId of refs.features) {
      if (!featureIds.has(featureId)) {
        errors.push(`plans/${planId}: missing feature reference "${featureId}".`);
      }
    }

    for (const meterId of refs.meters) {
      if (!meterIds.has(meterId)) {
        errors.push(`plans/${planId}: missing meter reference "${meterId}".`);
      }
    }

    for (const addonId of refs.addons) {
      if (!addonIds.has(addonId)) {
        errors.push(`plans/${planId}: missing add-on reference "${addonId}".`);
      }
    }
  }

  return errors;
}

function collectPlanReferences(plan: CatalogObject): {
  product?: string;
  features: string[];
  meters: string[];
  addons: string[];
} {
  const result = {
    product: undefined as string | undefined,
    features: new Set<string>(),
    meters: new Set<string>(),
    addons: new Set<string>(),
  };

  if (typeof plan.product === "string" && plan.product.length > 0) {
    result.product = plan.product;
  }

  collectStringRefs(plan.features, result.features);
  collectStringRefs(plan.meters, result.meters);
  collectStringRefs(plan.addons, result.addons);

  if (Array.isArray(plan.entitlements)) {
    for (const entitlement of plan.entitlements) {
      if (!isRecord(entitlement)) {
        continue;
      }

      if (typeof entitlement.feature === "string" && entitlement.feature.length > 0) {
        result.features.add(entitlement.feature);
      }

      if (typeof entitlement.meter === "string" && entitlement.meter.length > 0) {
        result.meters.add(entitlement.meter);
      }

      if (typeof entitlement.addon === "string" && entitlement.addon.length > 0) {
        result.addons.add(entitlement.addon);
      }
    }
  }

  return {
    product: result.product,
    features: [...result.features].sort(),
    meters: [...result.meters].sort(),
    addons: [...result.addons].sort(),
  };
}

function collectStringRefs(value: unknown, target: Set<string>): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      target.add(item);
      continue;
    }

    if (!isRecord(item)) {
      continue;
    }

    const id = resolveCatalogObjectId(item);
    if (id) {
      target.add(id);
    }
  }
}

function sortObjectDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectDeep(item)) as T;
  }

  if (!isRecord(value)) {
    return value;
  }

  const sortedEntries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => [key, sortObjectDeep(entryValue)] as const);

  return Object.fromEntries(sortedEntries) as T;
}

function isCatalogFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".json");
}

function toSafeFileName(id: string): string {
  return id.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
