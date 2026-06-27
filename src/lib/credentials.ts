import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { getDefaultConfigPath } from "./config.js";

const require = createRequire(import.meta.url);
const SERVICE_NAME = "monetizekit-cli";

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

export interface CredentialStore {
  get(account: string): Promise<string | null>;
  set(account: string, token: string): Promise<void>;
  delete(account: string): Promise<void>;
}

function resolveFallbackCredentialsPath(): string {
  const configPath = getDefaultConfigPath();
  return join(dirname(configPath), "credentials.json");
}

function loadKeytar(): KeytarModule | null {
  try {
    return require("keytar") as KeytarModule;
  } catch {
    return null;
  }
}

export class KeytarCredentialStore implements CredentialStore {
  constructor(private readonly keytar: KeytarModule) {}

  async get(account: string): Promise<string | null> {
    return this.keytar.getPassword(SERVICE_NAME, account);
  }

  async set(account: string, token: string): Promise<void> {
    await this.keytar.setPassword(SERVICE_NAME, account, token);
  }

  async delete(account: string): Promise<void> {
    await this.keytar.deletePassword(SERVICE_NAME, account);
  }
}

export class FileCredentialStore implements CredentialStore {
  private warningShown = false;

  constructor(private readonly filePath = resolveFallbackCredentialsPath()) {}

  async get(account: string): Promise<string | null> {
    const credentials = this.readCredentials();
    return credentials[account] ?? null;
  }

  async set(account: string, token: string): Promise<void> {
    this.warnOnce();
    const credentials = this.readCredentials();
    credentials[account] = token;
    this.writeCredentials(credentials);
  }

  async delete(account: string): Promise<void> {
    this.warnOnce();
    const credentials = this.readCredentials();
    delete credentials[account];

    if (Object.keys(credentials).length === 0) {
      rmSync(this.filePath, { force: true });
      return;
    }

    this.writeCredentials(credentials);
  }

  private warnOnce(): void {
    if (this.warningShown) {
      return;
    }

    this.warningShown = true;
    console.warn(
      "[monetizekit-cli] OS credential store unavailable. Falling back to file credential storage with mode 0600.",
    );
  }

  private ensureParentDir(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  private readCredentials(): Record<string, string> {
    if (!existsSync(this.filePath)) {
      return {};
    }

    const content = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(content) as Record<string, string>;
    return parsed;
  }

  private writeCredentials(credentials: Record<string, string>): void {
    this.ensureParentDir();
    writeFileSync(this.filePath, JSON.stringify(credentials, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });

    const currentMode = statSync(this.filePath).mode & 0o777;
    if (currentMode !== 0o600) {
      writeFileSync(this.filePath, JSON.stringify(credentials, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
    }
  }
}

export function createCredentialStore(): CredentialStore {
  const keytar = loadKeytar();
  if (keytar) {
    return new KeytarCredentialStore(keytar);
  }

  return new FileCredentialStore();
}
