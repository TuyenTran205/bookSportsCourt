import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";

const requests = new AsyncLocalStorage<{ userId?: string; version?: number }>();
/** Request-only state; never reuse claims between requests or put them in JSON profiles. */
export function sessionScope(
  _req: IncomingMessage,
  _res: ServerResponse,
  next: () => void,
) {
  requests.run({}, next);
}
export function bindSession(userId: string, version: number) {
  const scope = requests.getStore();
  if (scope) {
    scope.userId = userId;
    scope.version = version;
  }
}
export function expectedSessionVersion(userId: string) {
  const scope = requests.getStore();
  return scope?.userId === userId ? scope.version : undefined;
}
export function withSession<T>(
  userId: string,
  version: number,
  work: () => T,
): T {
  return requests.run({ userId, version }, work);
}
const listeners = new Set<(userId: string) => void>();
export function onSessionInvalidated(listener: (userId: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Call only after commit. DB checks remain authoritative across processes. */
export function invalidateLocalSockets(userId: string) {
  for (const listener of listeners) {
    try {
      listener(userId);
    } catch {
      /* Never undo a committed mutation. */
    }
  }
}
