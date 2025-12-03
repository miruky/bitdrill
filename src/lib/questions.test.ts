import { describe, expect, it } from 'vitest';
import {
  buildSet,
  categories,
  generate,
  groupBin,
  isCorrect,
  parseAnswer,
  toBin,
  toHex,
  type CategoryId,
} from './questions';
import { mulberry32 } from './rng';

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('表記の補助', () => {
  it('toBinとtoHexは桁を埋める', () => {
    expect(toBin(5, 8)).toBe('00000101');
    expect(toHex(10, 8)).toBe('0A');
    expect(toHex(255, 8)).toBe('FF');
    expect(toHex(5, 4)).toBe('5');
  });

  it('groupBinは4桁ごとに区切る', () => {
    expect(groupBin('00101101')).toBe('0010 1101');
    expect(groupBin('1101')).toBe('1101');
  });
});

describe('parseAnswer', () => {
  it('10進は数字だけを受け付ける', () => {
    expect(parseAnswer('42', 'dec')).toBe(42);
    expect(parseAnswer(' 42 ', 'dec')).toBe(42);
    expect(parseAnswer('4 2', 'dec')).toBe(42);
    expect(parseAnswer('0x2a', 'dec')).toBeNull();
    expect(parseAnswer('abc', 'dec')).toBeNull();
  });

  it('2進は0bや前置0や空白の揺れを許す', () => {
    expect(parseAnswer('1010', 'bin')).toBe(10);
    expect(parseAnswer('0b1010', 'bin')).toBe(10);
    expect(parseAnswer('00001010', 'bin')).toBe(10);
    expect(parseAnswer('0010 1101', 'bin')).toBe(45);
    expect(parseAnswer('102', 'bin')).toBeNull();
  });

  it('16進は0xと大文字小文字の揺れを許す', () => {
    expect(parseAnswer('2A', 'hex')).toBe(42);
    expect(parseAnswer('0x2a', 'hex')).toBe(42);
    expect(parseAnswer('002a', 'hex')).toBe(42);
    expect(parseAnswer('xyz', 'hex')).toBeNull();
  });

  it('空文字はnull', () => {
    expect(parseAnswer('  ', 'dec')).toBeNull();
  });
});

describe('generate', () => {
  it('同じシードなら同じ問題になる', () => {
    const a = generate('bitop', 8, mulberry32(7));
    const b = generate('bitop', 8, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('変換系の問題文は答えと整合する', () => {
    for (const seed of SEEDS) {
      for (const bits of [4, 8] as const) {
        const b2d = generate('bin2dec', bits, mulberry32(seed));
        const binText = (/^([01 ]+) を/.exec(b2d.prompt)?.[1] ?? '').replace(/ /g, '');
        expect(Number.parseInt(binText, 2)).toBe(b2d.answer);

        const h2d = generate('hex2dec', bits, mulberry32(seed));
        const hexText = /^0x([0-9A-F]+) を/.exec(h2d.prompt)?.[1] ?? '';
        expect(Number.parseInt(hexText, 16)).toBe(h2d.answer);

        const d2b = generate('dec2bin', bits, mulberry32(seed));
        const decText = /^(\d+) を2進数/.exec(d2b.prompt)?.[1] ?? '';
        expect(Number.parseInt(decText, 10)).toBe(d2b.answer);
      }
    }
  });

  it('ビット演算の答えは問題文から計算した値と一致する', () => {
    for (const seed of SEEDS) {
      const question = generate('bitop', 8, mulberry32(seed));
      const match = /^([01 ]+) (AND|OR|XOR) ([01 ]+) を/.exec(question.prompt);
      expect(match).not.toBeNull();
      const a = Number.parseInt((match?.[1] ?? '').replace(/ /g, ''), 2);
      const b = Number.parseInt((match?.[3] ?? '').replace(/ /g, ''), 2);
      const expected = match?.[2] === 'AND' ? a & b : match?.[2] === 'OR' ? a | b : a ^ b;
      expect(question.answer).toBe(expected);
    }
  });

  it('シフトの答えは範囲内で、問題文と整合する', () => {
    for (const seed of SEEDS) {
      for (const bits of [4, 8] as const) {
        const max = (1 << bits) - 1;
        const question = generate('shift', bits, mulberry32(seed));
        const match = /^([01 ]+) (<<|>>) (\d) を/.exec(question.prompt);
        expect(match).not.toBeNull();
        const value = Number.parseInt((match?.[1] ?? '').replace(/ /g, ''), 2);
        const amount = Number.parseInt(match?.[3] ?? '0', 10);
        const expected = match?.[2] === '<<' ? (value << amount) & max : value >> amount;
        expect(question.answer).toBe(expected);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThanOrEqual(max);
        if (match?.[2] === '<<') {
          expect(value << amount).toBeLessThanOrEqual(max);
        } else {
          expect(question.answer).toBeGreaterThan(0);
        }
      }
    }
  });

  it('全分野で答えがビット幅の範囲に収まる', () => {
    for (const category of categories) {
      for (const seed of SEEDS.slice(0, 30)) {
        const question = generate(category.id, 4, mulberry32(seed));
        expect(question.answer, `${category.id} seed=${seed}`).toBeGreaterThanOrEqual(0);
        expect(question.answer, `${category.id} seed=${seed}`).toBeLessThanOrEqual(15);
        expect(question.explanation).not.toBe('');
      }
    }
  });
});

describe('isCorrect', () => {
  it('表記揺れがあっても正しい値なら正解', () => {
    const question = generate('dec2bin', 8, mulberry32(3));
    expect(isCorrect(`0b${toBin(question.answer, 8)}`, question)).toBe(true);
    expect(isCorrect(toBin(question.answer, 8).replace(/^0+/, '') || '0', question)).toBe(true);
    expect(isCorrect('2', question)).toBe(question.answer === 2);
  });
});

describe('buildSet', () => {
  it('指定した数だけ、選んだ分野から出題される', () => {
    const selected: CategoryId[] = ['bin2dec', 'shift'];
    const set = buildSet(selected, 8, 10, mulberry32(1));
    expect(set.length).toBe(10);
    expect(set.every((question) => selected.includes(question.category))).toBe(true);
  });

  it('分野が空なら全分野から出題する', () => {
    const set = buildSet([], 8, 30, mulberry32(2));
    expect(set.length).toBe(30);
  });
});
