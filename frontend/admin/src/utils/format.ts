function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** ISO date -> "12/10/2026 14:05" in local time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

/** null means unverified, not "none". */
export function amenityText(value: boolean | null | undefined): string {
  if (value === true) return 'Có';
  if (value === false) return 'Không';
  return 'Chưa rõ';
}

export function priceText(value: number | null | undefined): string {
  return typeof value === 'number' ? `${formatThousands(value)} đ` : 'Chưa rõ';
}
