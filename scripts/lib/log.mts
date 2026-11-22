/** Timestamped CLI logging: every line is prefixed with seconds since start. */
const startedAt = Date.now();

export function elapsed(): string {
  return `+${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

export function log(message: string): void {
  console.log(`[${elapsed()}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  console.error(`[${elapsed()}] ${message}`, error ?? "");
}
