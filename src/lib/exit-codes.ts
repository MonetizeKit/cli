export enum ExitCode {
  Success = 0,
  UnknownError = 1,
  InvalidArguments = 2,
  AuthFailure = 3,
  PermissionDenied = 4,
  NotFound = 5,
  Conflict = 6,
  ValidationFailed = 7,
  NetworkError = 8,
  RateLimited = 9,
  PartialSuccess = 10,
}

/**
 * Map HTTP status codes to deterministic CLI exit codes.
 */
export function mapHttpStatusToExitCode(status: number): ExitCode {
  if (status >= 200 && status < 300) {
    return ExitCode.Success;
  }

  switch (status) {
    case 401:
      return ExitCode.AuthFailure;
    case 403:
      return ExitCode.PermissionDenied;
    case 404:
      return ExitCode.NotFound;
    case 409:
      return ExitCode.Conflict;
    case 422:
      return ExitCode.ValidationFailed;
    case 429:
      return ExitCode.RateLimited;
    default:
      if (status >= 500 && status < 600) {
        return ExitCode.NetworkError;
      }

      return ExitCode.UnknownError;
  }
}

/**
 * Map runtime errors to deterministic CLI exit codes.
 */
export function mapErrorToExitCode(error: Error): ExitCode {
  const message = error.message ?? "";

  if (error.name === "InvalidArgumentsError") {
    return ExitCode.InvalidArguments;
  }

  if (
    error.name === "TimeoutError" ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT")
  ) {
    return ExitCode.NetworkError;
  }

  return ExitCode.UnknownError;
}
