import { describe, expect, it } from 'vitest';
import { bitCells, bitGridSvg, popcount, weightStripSvg } from './bits';

describe('bitCells', () => {
  it('最上位ビットを先頭に、桁の重みとビットを並べる', () => {
    const cells = bitCells(0b1011_0100, 8);
    expect(cells).toHaveLength(8);
    expect(cells[0]).toEqual({ index: 0, bit: 1, weight: 128 });
    expect(cells[1]).toEqual({ index: 1, bit: 0, weight: 64 });
    expect(cells[7]).toEqual({ index: 7, bit: 0, weight: 1 });
    expect(cells.map((c) => c.bit).join('')).toBe('10110100');
  });

  it('4ビット幅でも重みが揃う', () => {
    const cells = bitCells(0b1010, 4);
    expect(cells.map((c) => c.weight)).toEqual([8, 4, 2, 1]);
    expect(cells.map((c) => c.bit)).toEqual([1, 0, 1, 0]);
  });
});

describe('popcount', () => {
  it('立っているビットの数を数える', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0b1011_0100)).toBe(4);
    expect(popcount(255)).toBe(8);
    expect(popcount(0x80000000)).toBe(1);
  });
});

describe('bitGridSvg', () => {
  it('立ったビットと寝たビットを状態クラスで描き分ける', () => {
    const svg = bitGridSvg(0b1010, 4);
    expect(svg).toContain('viewBox="0 0');
    expect(svg).toContain('role="img"');
    expect((svg.match(/is-on/g) ?? []).length).toBe(2);
    expect((svg.match(/is-off/g) ?? []).length).toBe(2);
    expect(svg).toContain('aria-label="10 の4ビット表現"');
  });

  it('hexLabelsで4ビットごとの16進数を添える', () => {
    const svg = bitGridSvg(0xb4, 8, { hexLabels: true });
    expect(svg).toContain('bit-hex');
    expect(svg).toContain('>B</text>');
    expect(svg).toContain('>4</text>');
  });

  it('aria-labelの危険な文字をエスケープする', () => {
    const svg = bitGridSvg(1, 4, { ariaLabel: '<x>"&' });
    expect(svg).toContain('aria-label="&lt;x&gt;&quot;&amp;"');
    expect(svg).not.toContain('aria-label="<x>');
  });
});

describe('weightStripSvg', () => {
  it('ビットを塗らず重みだけを並べる(答えを見せない)', () => {
    const svg = weightStripSvg(8);
    expect(svg).toContain('is-ref');
    expect(svg).not.toContain('is-on');
    expect(svg).toContain('>128</text>');
    expect(svg).toContain('>1</text>');
  });
});
