/** Vietnamese number and date formatting used across screens. */

/** 4.6 -> "4,6" */
export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** 25000 -> "25.000" */
export function formatThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** ISO date -> "12/10/2026" in local time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** ISO date -> "16:40" in local time. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
