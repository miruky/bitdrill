// ビット列を「桁の重みが並ぶマス目」として見せるための、データと描画。
// 値そのものを図にすることがこのツールの主要な視覚要素になる。
// 立っているビットを強調し、4ビット区切り(=16進1桁)を空間で示す。

export interface BitCell {
  index: number; // 0 = 最上位ビット(左端)
  bit: 0 | 1;
  weight: number; // その桁の重み(128, 64, ... 1)
}

export function bitCells(value: number, bits: number): BitCell[] {
  const cells: BitCell[] = [];
  for (let i = 0; i < bits; i += 1) {
    const shift = bits - 1 - i;
    cells.push({
      index: i,
      bit: ((value >>> shift) & 1) as 0 | 1,
      weight: 2 ** shift,
    });
  }
  return cells;
}

// 立っているビットの数(母集団カウント)。出題とラベルの両方で使う。
export function popcount(value: number): number {
  let v = value >>> 0;
  let count = 0;
  while (v !== 0) {
    v &= v - 1;
    count += 1;
  }
  return count;
}

const CELL = 46;
const INNER_GAP = 5; // ニブル内の隙間
const GROUP_GAP = 16; // ニブル(4ビット)境界の隙間
const PAD = 5;
const TOP = 6;

interface Placed {
  cell: BitCell;
  x: number;
}

function layout(cells: BitCell[]): { placed: Placed[]; width: number } {
  let x = PAD;
  const placed = cells.map((cell, i) => {
    if (i > 0) x += i % 4 === 0 ? GROUP_GAP : INNER_GAP;
    const at = { cell, x };
    x += CELL;
    return at;
  });
  return { placed, width: x + PAD };
}

const HEX = '0123456789ABCDEF';

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface BitGridOptions {
  weights?: boolean; // 桁の重みラベルを下に出す
  hexLabels?: boolean; // 4ビットごとに対応する16進1桁を出す
  ariaLabel?: string;
}

// 値の2進表現を、立ったビットを塗ったマス目として描く。
export function bitGridSvg(value: number, bits: number, options: BitGridOptions = {}): string {
  const { weights = true, hexLabels = false, ariaLabel } = options;
  const cells = bitCells(value, bits);
  const { placed, width } = layout(cells);

  const weightRowY = TOP + CELL + 15;
  const hexRowY = weightRowY + (weights ? 19 : 4);
  const height = (hexLabels ? hexRowY : weights ? weightRowY : TOP + CELL) + 6;

  const cellMarkup = placed
    .map(({ cell, x }) => {
      const cx = x + CELL / 2;
      const state = cell.bit ? 'is-on' : 'is-off';
      const weight = weights
        ? `<text class="bit-weight" x="${cx}" y="${weightRowY}" text-anchor="middle">${cell.weight}</text>`
        : '';
      return `<g class="bit-cell ${state}">
        <rect x="${x}" y="${TOP}" width="${CELL}" height="${CELL}" rx="11" />
        <text class="bit-digit" x="${cx}" y="${TOP + CELL / 2 + 1}" text-anchor="middle" dominant-baseline="central">${cell.bit}</text>
      </g>${weight}`;
    })
    .join('');

  let hexMarkup = '';
  if (hexLabels) {
    const groups = Math.ceil(bits / 4);
    const parts: string[] = [];
    for (let g = 0; g < groups; g += 1) {
      const slice = placed.slice(g * 4, g * 4 + 4);
      if (slice.length === 0) continue;
      const first = slice[0] as Placed;
      const last = slice[slice.length - 1] as Placed;
      const center = (first.x + last.x + CELL) / 2;
      const nibble = slice.reduce((acc, p) => (acc << 1) | p.cell.bit, 0);
      parts.push(
        `<text class="bit-hex" x="${center}" y="${hexRowY}" text-anchor="middle">${HEX[nibble]}</text>`,
      );
    }
    hexMarkup = parts.join('');
  }

  const aria = escapeAttr(ariaLabel ?? `${value} の${bits}ビット表現`);
  return `<svg class="bit-grid" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}" preserveAspectRatio="xMidYMid meet">${cellMarkup}${hexMarkup}</svg>`;
}

// 桁の重みだけを示す参照ストリップ。具体的な答えを見せずに計算を助ける。
export function weightStripSvg(bits: number): string {
  const cells = bitCells(0, bits);
  const { placed, width } = layout(cells);
  const weightRowY = TOP + CELL + 15;
  const height = weightRowY + 6;

  const markup = placed
    .map(({ cell, x }) => {
      const cx = x + CELL / 2;
      return `<g class="bit-cell is-ref">
        <rect x="${x}" y="${TOP}" width="${CELL}" height="${CELL}" rx="11" />
        <text class="bit-weight" x="${cx}" y="${weightRowY}" text-anchor="middle">${cell.weight}</text>
      </g>`;
    })
    .join('');

  return `<svg class="bit-grid" viewBox="0 0 ${width} ${height}" role="img" aria-label="${bits}ビットの桁の重み(左から ${2 ** (bits - 1)} から 1)" preserveAspectRatio="xMidYMid meet">${markup}</svg>`;
}
