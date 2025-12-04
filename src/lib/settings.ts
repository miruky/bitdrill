// 出題の設定(分野の選択とビット幅)をlocalStorageに残す。
// 読み込み時は保存値を検証し、未知の分野や壊れた値は既定へ寄せる。
// 妥当性検査を分野一覧に対して行うため、検証関数は呼び出し側からidの集合を受け取る。

import { type CategoryId } from './questions';

export interface Settings {
  categories: CategoryId[];
  bits: 4 | 8;
}

export function defaultSettings(all: CategoryId[]): Settings {
  return { categories: [...all], bits: 8 };
}

export function serialize(settings: Settings): string {
  return JSON.stringify(settings);
}

/**
 * 保存文字列から設定を復元する。
 * 既知でない分野は捨て、ひとつも残らなければ全分野に戻す。bitsは4か8のみ許す。
 * JSONが壊れていたり形が崩れていれば既定設定を返す。
 */
export function deserialize(raw: string | null, all: CategoryId[]): Settings {
  const fallback = defaultSettings(all);
  if (raw === null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;
  const obj = parsed as Record<string, unknown>;
  const allowed = new Set<string>(all);
  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((c): c is CategoryId => typeof c === 'string' && allowed.has(c))
    : [];
  return {
    categories: categories.length > 0 ? categories : [...all],
    bits: obj.bits === 4 ? 4 : 8,
  };
}
