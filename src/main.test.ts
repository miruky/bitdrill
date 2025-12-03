// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { categories } from './lib/questions';

// main.ts はimport時に画面を組み立てるので、先に#appを用意してから読み込む
beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import('./main');
});

function answerCurrent(input: string): void {
  const field = document.getElementById('answer-input') as HTMLInputElement;
  field.value = input;
  (document.getElementById('answer-form') as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

describe('main', () => {
  it('設定画面に分野チップと成績表が並ぶ', () => {
    expect(document.querySelector('h1')?.textContent).toBe('bitdrill');
    expect(document.querySelectorAll('[data-category]').length).toBe(categories.length);
    expect(document.querySelectorAll('.stats-table tbody tr').length).toBe(categories.length);
  });

  it('分野チップは切り替えられ、最後の1つは外せない', () => {
    const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-category]')];
    for (const chip of chips) {
      if (chip.getAttribute('aria-pressed') === 'true') chip.click();
    }
    const pressed = chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true');
    expect(pressed.length).toBe(1);
    for (const chip of chips) {
      if (chip.getAttribute('aria-pressed') === 'false') chip.click();
    }
  });

  it('開始すると1問目が表示される', () => {
    (document.getElementById('start-button') as HTMLButtonElement).click();
    expect(document.querySelector('.drill-progress')?.textContent).toBe('1 / 10');
    expect(document.querySelector('.drill-prompt')?.textContent).not.toBe('');
  });

  it('答えるとフィードバックと解説が出る', () => {
    answerCurrent('999999');
    const feedback = document.getElementById('feedback') as HTMLElement;
    expect(feedback.hidden).toBe(false);
    expect(document.getElementById('feedback-result')?.textContent).toBe('不正解');
    expect(document.getElementById('feedback-explain')?.textContent).not.toBe('');
  });

  it('10問終えると結果画面になり、成績が保存される', () => {
    (document.getElementById('next-button') as HTMLButtonElement).click();
    for (let i = 2; i <= 10; i += 1) {
      answerCurrent('999999');
      (document.getElementById('next-button') as HTMLButtonElement).click();
    }
    expect(document.querySelector('h2')?.textContent).toContain('結果 0 / 10');
    expect(document.querySelectorAll('.review li').length).toBe(10);

    (document.getElementById('setup-button') as HTMLButtonElement).click();
    const attempts = [...document.querySelectorAll('.stats-table td:nth-child(2)')]
      .map((cell) => Number.parseInt(cell.textContent ?? '0', 10))
      .reduce((sum, count) => sum + count, 0);
    expect(attempts).toBe(10);
  });

  it('成績を消すと表が空に戻る', () => {
    (document.getElementById('clear-stats') as HTMLButtonElement).click();
    const rates = [...document.querySelectorAll('.stats-table td:nth-child(3)')].map(
      (cell) => cell.textContent,
    );
    expect(rates.every((rate) => rate === '-')).toBe(true);
  });
});
