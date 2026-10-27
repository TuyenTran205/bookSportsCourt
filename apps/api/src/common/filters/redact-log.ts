/** Keep stack frames while removing JWTs and cookie credentials from diagnostics. */
export function redactLog(value: string): string {
  return value
    .replace(
      /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/gu,
      "[REDACTED_JWT]",
    )
    .replace(
      /((?:access_token|refresh_token)\s*=\s*)[^;\s]+/giu,
      "$1[REDACTED]",
    )
    .replace(
      /("(?:accessToken|refreshToken|access_token|refresh_token|password|passwordHash|token)"\s*:\s*")[^"\r\n]*(")/giu,
      "$1[REDACTED]$2",
    );
}
