export interface UsageReplayEvent {
  customerId: string;
  meterId: string;
  value: number;
  timestamp?: string;
  idempotencyKey?: string;
}

export interface UsageReplayFailure {
  line: number;
  event: UsageReplayEvent;
  error: string;
}

export interface UsageReplayResult {
  successCount: number;
  failureCount: number;
  failures: UsageReplayFailure[];
}

export async function replayUsageEvents(
  events: UsageReplayEvent[],
  submit: (event: UsageReplayEvent) => Promise<void>,
): Promise<UsageReplayResult> {
  let successCount = 0;
  const failures: UsageReplayFailure[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    try {
      await submit(event);
      successCount += 1;
    } catch (error) {
      failures.push({
        line: index + 1,
        event,
        error: error instanceof Error ? error.message : "Unknown replay error",
      });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}
