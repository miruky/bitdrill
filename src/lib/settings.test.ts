import { describe, expect, it } from 'vitest';
import { defaultSettings, deserialize, serialize, type Settings } from './settings';
import { categories } from './questions';

const ALL = categories.map((category) => category.id);
const FIRST = ALL[0]!;

describe('settings', () => {
  it('既定は全分野・8ビット', () => {
    expect(defaultSettings(ALL)).toEqual({ categories: ALL, bits: 8 });
  });

  it('保存と復元が往復する', () => {
    const settings: Settings = { categories: [FIRST], bits: 4 };
    expect(deserialize(serialize(settings), ALL)).toEqual(settings);
  });

  it('未知の分野は捨てる', () => {
    const raw = JSON.stringify({ categories: ['bogus', FIRST], bits: 8 });
    expect(deserialize(raw, ALL).categories).toEqual([FIRST]);
  });

  it('分野が空になれば全分野へ戻す', () => {
    const raw = JSON.stringify({ categories: ['bogus'], bits: 8 });
    expect(deserialize(raw, ALL).categories).toEqual(ALL);
  });

  it('不正なbitsは8へ寄せる', () => {
    expect(deserialize(JSON.stringify({ categories: ALL, bits: 99 }), ALL).bits).toBe(8);
    expect(deserialize(JSON.stringify({ categories: ALL, bits: 4 }), ALL).bits).toBe(4);
  });

  it('壊れた値・未保存は既定設定を返す', () => {
    expect(deserialize('{', ALL)).toEqual(defaultSettings(ALL));
    expect(deserialize('[]', ALL)).toEqual(defaultSettings(ALL));
    expect(deserialize(null, ALL)).toEqual(defaultSettings(ALL));
  });
});
