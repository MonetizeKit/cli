import type { CliConfig } from "./config.js";

export interface TelemetrySampleEvent {
  event: "command_run";
  command: string;
  durationMs: number;
  exitCode: number;
  cliVersion: string;
  platform: string;
  timestamp: string;
}

export function isTelemetryEnabled(config: CliConfig): boolean {
  return Boolean(config.telemetry?.enabled);
}

export function setTelemetryEnabled(config: CliConfig, enabled: boolean): CliConfig {
  return {
    ...config,
    telemetry: {
      enabled,
    },
  };
}

export function buildTelemetrySample(): TelemetrySampleEvent {
  return {
    event: "command_run",
    command: "customers list",
    durationMs: 182,
    exitCode: 0,
    cliVersion: "0.1.0",
    platform: process.platform,
    timestamp: new Date().toISOString(),
  };
}
