/**
 * Resolves the model for an LLM call: the named env var when set, otherwise
 * the caller's default. Read at call time (not import time) so dotenv-loaded
 * and per-deployment values are picked up. Use this for every LLM call site —
 * pair each with a `DEFAULT_..._MODEL` constant and a documented env var.
 */
export function resolveModel(envVar: string, fallback: string): string {
  return process.env[envVar]?.trim() || fallback;
}
