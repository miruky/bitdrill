import { describe, expect, it } from 'vitest';
import { accuracy, deserialize, record, serialize, type Stats } from './stats';

describe('record', () => {
  it('挑戦数と正解数を積み上げ、元のオブジェクトを変えない', () => {
    const empty: Stats = {};
    const once = record(empty, 'bin2dec', true);
    const twice = record(once, 'bin2dec', false);
    expect(empty).toEqual({});
    expect(once['bin2dec']).toEqual({ attempts: 1, correct: 1 });
    expect(twice['bin2dec']).toEqual({ attempts: 2, correct: 1 });
  });
});

describe('accuracy', () => {
  it('挑戦がなければnull、あれば割合を返す', () => {
    expect(accuracy({}, 'shift')).toBeNull();
    let stats: Stats = {};
    stats = record(stats, 'shift', true);
    stats = record(stats, 'shift', true);
    stats = record(stats, 'shift', false);
    expect(accuracy(stats, 'shift')).toBeCloseTo(2 / 3);
  });
});

describe('serialize / deserialize', () => {
  it('往復で同じ内容に戻る', () => {
    let stats: Stats = {};
    stats = record(stats, 'bitop', true);
    stats = record(stats, 'dec2hex', false);
    expect(deserialize(serialize(stats))).toEqual(stats);
  });

  it('壊れたデータや異物は空として扱う', () => {
    expect(deserialize(null)).toEqual({});
    expect(deserialize('not json')).toEqual({});
    expect(deserialize('[1,2]')).toEqual({});
    expect(deserialize('{"bitop":{"attempts":"x","correct":1}}')).toEqual({});
    expect(deserialize('{"bitop":{"attempts":3,"correct":1},"junk":5}')).toEqual({
      bitop: { attempts: 3, correct: 1 },
    });
  });
});
