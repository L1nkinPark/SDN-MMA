import type { LiveStatus } from '@/api/types';

export type MeterKind = 'crowd' | 'noise';
/** 0 means unknown; 1 to 3 are the three levels. */
export type MeterLevel = 0 | 1 | 2 | 3;

const crowdLevels: Record<string, MeterLevel> = { low: 1, medium: 2, high: 3 };
const noiseLevels: Record<string, MeterLevel> = { quiet: 1, moderate: 2, loud: 3 };

export const crowdLabels = ['', 'Vắng', 'Vừa', 'Đông'] as const;
export const noiseLabels = ['', 'Yên tĩnh', 'Vừa', 'Ồn'] as const;

export function crowdLevel(value: LiveStatus['crowd']): MeterLevel {
  return (value && crowdLevels[value]) || 0;
}

export function noiseLevel(value: LiveStatus['noise']): MeterLevel {
  return (value && noiseLevels[value]) || 0;
}

export function levelLabel(kind: MeterKind, level: MeterLevel): string {
  return (kind === 'crowd' ? crowdLabels : noiseLabels)[level];
}

/** True when both values are known. The backend sets both to unknown together below the sample minimum. */
export function isStatusKnown(status: LiveStatus | undefined): boolean {
  return crowdLevel(status?.crowd) > 0 && noiseLevel(status?.noise) > 0;
}

/** Backend default STATUS_MIN_SAMPLES. */
export const MIN_SAMPLES = 2;
