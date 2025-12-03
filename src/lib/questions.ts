// 出題の生成と採点。答えの形式(基数)ごとに受理する書き方を決めておき、
// 前置の0や0x・大文字小文字の揺れで不正解にしない。

import { intIn, type Rng } from './rng';

export type CategoryId =
  | 'bin2dec'
  | 'dec2bin'
  | 'hex2dec'
  | 'dec2hex'
  | 'binhex'
  | 'bitop'
  | 'shift';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
}

export const categories: Category[] = [
  { id: 'bin2dec', name: '2進から10進', description: '2進数を読んで10進数で答える' },
  { id: 'dec2bin', name: '10進から2進', description: '10進数を2進数に直す' },
  { id: 'hex2dec', name: '16進から10進', description: '16進数を読んで10進数で答える' },
  { id: 'dec2hex', name: '10進から16進', description: '10進数を16進数に直す' },
  { id: 'binhex', name: '2進と16進の相互', description: '4ビット区切りの対応を体に入れる' },
  { id: 'bitop', name: 'AND・OR・XOR', description: 'ビットごとの論理演算' },
  { id: 'shift', name: 'シフト', description: '左右シフトと2の累乗の関係' },
];

export type AnswerBase = 'dec' | 'bin' | 'hex';

export interface Question {
  category: CategoryId;
  prompt: string;
  answer: number;
  base: AnswerBase;
  explanation: string;
}

export function toBin(value: number, bits: number): string {
  return value.toString(2).padStart(bits, '0');
}

export function toHex(value: number, bits: number): string {
  return value
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), '0');
}

// 4ビットごとに区切って読みやすくする(理解の補助にもなる)
export function groupBin(bin: string): string {
  const padded = bin.padStart(Math.ceil(bin.length / 4) * 4, '0');
  return padded.replace(/(.{4})(?=.)/g, '$1 ');
}

export function parseAnswer(input: string, base: AnswerBase): number | null {
  const text = input.trim().toLowerCase().replace(/[\s_]/g, '');
  if (text === '') return null;
  if (base === 'dec') {
    return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null;
  }
  if (base === 'bin') {
    const body = text.replace(/^0b/, '');
    return /^[01]+$/.test(body) ? Number.parseInt(body, 2) : null;
  }
  const body = text.replace(/^0x/, '');
  return /^[0-9a-f]+$/.test(body) ? Number.parseInt(body, 16) : null;
}

export function isCorrect(input: string, question: Question): boolean {
  const parsed = parseAnswer(input, question.base);
  return parsed !== null && parsed === question.answer;
}

const OPS = [
  { symbol: 'AND', apply: (a: number, b: number) => a & b },
  { symbol: 'OR', apply: (a: number, b: number) => a | b },
  { symbol: 'XOR', apply: (a: number, b: number) => a ^ b },
] as const;

export function generate(category: CategoryId, bits: 4 | 8, rng: Rng): Question {
  const max = (1 << bits) - 1;
  switch (category) {
    case 'bin2dec': {
      const value = intIn(rng, 1, max);
      return {
        category,
        prompt: `${groupBin(toBin(value, bits))} を10進数で`,
        answer: value,
        base: 'dec',
        explanation: `各桁の重み(${bits === 4 ? '8,4,2,1' : '128,64,...,1'})のうち、1が立つ桁を足すと ${value}。`,
      };
    }
    case 'dec2bin': {
      const value = intIn(rng, 1, max);
      return {
        category,
        prompt: `${value} を2進数で(${bits}ビット)`,
        answer: value,
        base: 'bin',
        explanation: `${value} = ${groupBin(toBin(value, bits))}。2で割った余りを下の桁から並べる。`,
      };
    }
    case 'hex2dec': {
      const value = intIn(rng, 1, max);
      return {
        category,
        prompt: `0x${toHex(value, bits)} を10進数で`,
        answer: value,
        base: 'dec',
        explanation: `16進の各桁は16の累乗の重みを持つ。0x${toHex(value, bits)} = ${value}。`,
      };
    }
    case 'dec2hex': {
      const value = intIn(rng, 1, max);
      return {
        category,
        prompt: `${value} を16進数で`,
        answer: value,
        base: 'hex',
        explanation: `${value} = 0x${toHex(value, bits)}。16で割った商と余りで上下の桁が決まる。`,
      };
    }
    case 'binhex': {
      const value = intIn(rng, 1, max);
      if (rng() < 0.5) {
        return {
          category,
          prompt: `${groupBin(toBin(value, bits))} を16進数で`,
          answer: value,
          base: 'hex',
          explanation: `4ビットずつ区切るとそのまま16進1桁に対応する。答えは 0x${toHex(value, bits)}。`,
        };
      }
      return {
        category,
        prompt: `0x${toHex(value, bits)} を2進数で(${bits}ビット)`,
        answer: value,
        base: 'bin',
        explanation: `16進1桁が2進4ビット。0x${toHex(value, bits)} = ${groupBin(toBin(value, bits))}。`,
      };
    }
    case 'bitop': {
      const a = intIn(rng, 0, max);
      const b = intIn(rng, 0, max);
      const op = OPS[intIn(rng, 0, OPS.length - 1)] as (typeof OPS)[number];
      const result = op.apply(a, b) & max;
      return {
        category,
        prompt: `${groupBin(toBin(a, bits))} ${op.symbol} ${groupBin(toBin(b, bits))} を2進数で`,
        answer: result,
        base: 'bin',
        explanation: `桁ごとに${op.symbol}を取る。結果は ${groupBin(toBin(result, bits))}(10進で${result})。`,
      };
    }
    case 'shift': {
      const left = rng() < 0.5;
      const amount = intIn(rng, 1, 3);
      // 左はあふれない範囲、右は結果が0にならない範囲から選ぶ
      const value = left ? intIn(rng, 1, Math.max(1, max >> amount)) : intIn(rng, 1 << amount, max);
      const result = left ? (value << amount) & max : value >> amount;
      const symbol = left ? '<<' : '>>';
      return {
        category,
        prompt: `${groupBin(toBin(value, bits))} ${symbol} ${amount} を2進数で`,
        answer: result,
        base: 'bin',
        explanation: left
          ? `左シフトは2の${amount}乗倍。${value} × ${1 << amount} = ${result}(${groupBin(toBin(result, bits))})。`
          : `右シフトは2の${amount}乗での切り捨て除算。${value} ÷ ${1 << amount} = ${result}(${groupBin(toBin(result, bits))})。`,
      };
    }
  }
}

export function buildSet(selected: CategoryId[], bits: 4 | 8, count: number, rng: Rng): Question[] {
  const pool = selected.length > 0 ? selected : categories.map((category) => category.id);
  const questions: Question[] = [];
  for (let i = 0; i < count; i += 1) {
    const category = pool[intIn(rng, 0, pool.length - 1)] as CategoryId;
    questions.push(generate(category, bits, rng));
  }
  return questions;
}
