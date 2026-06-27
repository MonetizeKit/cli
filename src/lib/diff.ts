import {
  CATALOG_RESOURCE_TYPES,
  resolveCatalogObjectId,
  type CatalogObject,
  type CatalogResourceType,
  type CatalogSnapshot,
} from "./catalog.js";
import { sortCatalogSnapshot } from "./catalog-files.js";

export interface CatalogDiff {
  creates: CatalogChange[];
  updates: CatalogChange[];
  deletes: CatalogChange[];
  unchanged: number;
}

export interface CatalogChange {
  type: "plan" | "feature" | "addon" | "product" | "meter";
  id: string;
  name: string;
  diff?: string;
  before?: CatalogObject;
  after?: CatalogObject;
}

export function computeCatalogDiff(local: CatalogSnapshot, remote: CatalogSnapshot): CatalogDiff {
  const normalizedLocal = sortCatalogSnapshot(local);
  const normalizedRemote = sortCatalogSnapshot(remote);

  const result: CatalogDiff = {
    creates: [],
    updates: [],
    deletes: [],
    unchanged: 0,
  };

  for (const type of CATALOG_RESOURCE_TYPES) {
    const singularType = toSingularType(type);
    const localById = indexById(normalizedLocal[type]);
    const remoteById = indexById(normalizedRemote[type]);

    for (const [id, localObject] of localById.entries()) {
      const remoteObject = remoteById.get(id);
      if (!remoteObject) {
        result.creates.push({
          type: singularType,
          id,
          name: resolveDisplayName(localObject, id),
          after: localObject,
        });
        continue;
      }

      if (deepStableStringify(localObject) === deepStableStringify(remoteObject)) {
        result.unchanged += 1;
        continue;
      }

      result.updates.push({
        type: singularType,
        id,
        name: resolveDisplayName(localObject, id),
        before: remoteObject,
        after: localObject,
        diff: renderObjectDiff(remoteObject, localObject),
      });
    }

    for (const [id, remoteObject] of remoteById.entries()) {
      if (!localById.has(id)) {
        result.deletes.push({
          type: singularType,
          id,
          name: resolveDisplayName(remoteObject, id),
          before: remoteObject,
        });
      }
    }
  }

  return result;
}

function toSingularType(type: CatalogResourceType): CatalogChange["type"] {
  switch (type) {
    case "plans":
      return "plan";
    case "features":
      return "feature";
    case "addons":
      return "addon";
    case "products":
      return "product";
    case "meters":
      return "meter";
  }
}

function resolveDisplayName(object: CatalogObject, fallback: string): string {
  if (typeof object.name === "string" && object.name.trim().length > 0) {
    return object.name;
  }

  return fallback;
}

function indexById(objects: CatalogObject[]): Map<string, CatalogObject> {
  const result = new Map<string, CatalogObject>();
  for (const object of objects) {
    const id = resolveCatalogObjectId(object);
    if (!id) {
      continue;
    }

    result.set(id, object);
  }

  return result;
}

function renderObjectDiff(before: CatalogObject, after: CatalogObject): string {
  const beforeLines = JSON.stringify(before, null, 2).split("\n");
  const afterLines = JSON.stringify(after, null, 2).split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = ["--- remote", "+++ local"];

  for (let index = 0; index < max; index += 1) {
    const left = beforeLines[index];
    const right = afterLines[index];

    if (left === right) {
      if (left !== undefined) {
        lines.push(` ${left}`);
      }
      continue;
    }

    if (left !== undefined) {
      lines.push(`-${left}`);
    }

    if (right !== undefined) {
      lines.push(`+${right}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function deepStableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}
