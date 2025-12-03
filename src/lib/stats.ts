// 分野別成績の集計。保存形式の検証もここに置き、壊れたデータは捨てる。

import type { CategoryId } from './questions';

export interface CategoryStats {
  attempts: number;
  correct: number;
}

export type Stats = Partial<Record<CategoryId, CategoryStats>>;

export function record(stats: Stats, category: CategoryId, correct: boolean): Stats {
  const current = stats[category] ?? { attempts: 0, correct: 0 };
  return {
    ...stats,
    [category]: {
      attempts: current.attempts + 1,
      correct: current.correct + (correct ? 1 : 0),
    },
  };
}

// 正答率(挑戦がなければnull)
export function accuracy(stats: Stats, category: CategoryId): number | null {
  const entry = stats[category];
  if (!entry || entry.attempts === 0) return null;
  return entry.correct / entry.attempts;
}

export function serialize(stats: Stats): string {
  return JSON.stringify(stats);
}

export function deserialize(text: string | null): Stats {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: Stats = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as CategoryStats).attempts === 'number' &&
        typeof (value as CategoryStats).correct === 'number'
      ) {
        result[key as CategoryId] = {
          attempts: (value as CategoryStats).attempts,
          correct: (value as CategoryStats).correct,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}
