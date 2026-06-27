import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";

import YAML from "yaml";

import type { ApiClient } from "./api-client.js";

export const CATALOG_RESOURCE_TYPES = [
  "plans",
  "features",
  "addons",
  "products",
  "meters",
] as const;

export type CatalogResourceType = (typeof CATALOG_RESOURCE_TYPES)[number];

export interface CatalogSnapshot {
  plans: CatalogObject[];
  features: CatalogObject[];
  addons: CatalogObject[];
  products: CatalogObject[];
  meters: CatalogObject[];
}

export type CatalogObject = Record<string, unknown>;

export function isCatalogResourceType(value: string): value is CatalogResourceType {
  return CATALOG_RESOURCE_TYPES.includes(value as CatalogResourceType);
}

export function resolveCatalogCollectionPath(type: CatalogResourceType): string {
  if (type === "plans" || type === "features") {
    return `/api/v1/${type}`;
  }

  return `/api/v1/catalog/${type}`;
}

export function resolveCatalogItemPath(type: CatalogResourceType, id: string): string {
  return `${resolveCatalogCollectionPath(type)}/${encodeURIComponent(id)}`;
}

export function resolveCatalogObjectId(
  object: Record<string, unknown>,
  fallback: string,
): string;
export function resolveCatalogObjectId(
  object: Record<string, unknown>,
): string | undefined;
export function resolveCatalogObjectId(
  object: Record<string, unknown>,
  fallback?: string,
): string | undefined {
  const id = object.id;
  if (typeof id === "string" && id.trim().length > 0) {
    return id;
  }

  const key = object.key;
  if (typeof key === "string" && key.trim().length > 0) {
    return key;
  }

  const slug = object.slug;
  if (typeof slug === "string" && slug.trim().length > 0) {
    return slug;
  }

  return fallback;
}

export async function loadCatalogObjectFromFile(path: string): Promise<CatalogObject> {
  const source = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();

  if (extension === ".yaml" || extension === ".yml") {
    const parsed = YAML.parse(source);
    if (!isRecord(parsed)) {
      throw new Error(`Catalog file must contain an object: ${path}`);
    }

    return parsed;
  }

  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Catalog file must contain an object: ${path}`);
  }

  return parsed;
}

export async function writeCatalogOutputFile(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const extension = extname(path).toLowerCase();

  if (extension === ".yaml" || extension === ".yml") {
    await writeFile(path, YAML.stringify(data), "utf8");
    return;
  }

  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function normalizeListPayload(payload: unknown): CatalogObject[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [payload.data, payload.items, payload.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [];
}

export function normalizeObjectPayload(payload: unknown): CatalogObject {
  if (isRecord(payload)) {
    return payload;
  }

  throw new Error("Server response was not an object.");
}

export function extractEtag(headers: Record<string, string>): string | undefined {
  return headers.etag ?? headers.ETag ?? headers["if-match"];
}

export function createDryRunPreview(input: {
  action: "create" | "update" | "delete" | "import";
  type: CatalogResourceType;
  id?: string;
  before?: unknown;
  after?: unknown;
}): Record<string, unknown> {
  return {
    dryRun: true,
    action: input.action,
    type: input.type,
    id: input.id,
    before: input.before ?? null,
    after: input.after ?? null,
  };
}

export async function listAllCatalog(api: ApiClient): Promise<CatalogSnapshot> {
  const snapshot: CatalogSnapshot = {
    plans: [],
    features: [],
    addons: [],
    products: [],
    meters: [],
  };

  for (const type of CATALOG_RESOURCE_TYPES) {
    const response = await api.get<unknown>(resolveCatalogCollectionPath(type));
    snapshot[type] = normalizeListPayload(response.data);
  }

  return snapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
