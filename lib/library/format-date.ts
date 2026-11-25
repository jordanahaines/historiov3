const pad = (n: number) => String(n).padStart(2, "0");

/** "11/09/2026" (mm/dd/yyyy), the one date format the UI uses. UTC, so server and browser render the same text. */
export function formatDate(iso: string | null): string {
  if (!iso) return "–";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
}
