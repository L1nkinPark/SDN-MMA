import type { PlaceChangeRequest } from '../api/types';

const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  address: 'Địa chỉ',
  description: 'Mô tả',
  coordinates: 'Vị trí',
};

/** One readable line per requested change. Coordinates are stored as [longitude, latitude]. */
export function describeChanges(changes: PlaceChangeRequest['changes'] | undefined): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (key === 'imagesToAdd' && Array.isArray(value)) lines.push(`Thêm ${value.length} ảnh`);
    else if (key === 'coordinates' && Array.isArray(value)) lines.push(`Vị trí (vĩ độ, kinh độ): ${value[1]}, ${value[0]}`);
    else if (FIELD_LABELS[key]) lines.push(`${FIELD_LABELS[key]}: ${String(value)}`);
  }
  return lines;
}
