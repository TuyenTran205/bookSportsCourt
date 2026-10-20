/** Exact HTTP(S) origins only; no wildcard, credentials, path, query or fragment. */
export function parseAllowedOrigins(
  value: string,
  environment: string,
): string[] {
  const origins = value.split(",").map((origin) => origin.trim());
  if (
    origins.length === 0 ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !["http:", "https:"].includes(url.protocol) ||
          url.origin !== origin ||
          Boolean(url.username || url.password) ||
          url.hostname.includes("*") ||
          (["production", "staging"].includes(environment) &&
            url.protocol !== "https:")
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      "ALLOWED_ORIGINS must contain exact HTTP(S) origins; HTTPS is required in production/staging",
    );
  }
  return [...new Set(origins)];
}
