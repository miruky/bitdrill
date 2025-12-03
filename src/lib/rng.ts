// 乱数。テストで出題を再現できるよう、シード指定のmulberry32を使う。

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [min, max] の整数
export function intIn(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
