// 画面の組み立てと進行。設定 → 10問のドリル → 結果の3状態を行き来し、
// 分野別の成績をlocalStorageに積み上げる。

import './style.css';
import { buildSet, categories, isCorrect, type CategoryId, type Question } from './lib/questions';
import { mulberry32 } from './lib/rng';
import { accuracy, deserialize, record, serialize, type Stats } from './lib/stats';
import { store } from './lib/storage';

const STATS_KEY = 'bitdrill:stats';
const SET_SIZE = 10;

const BRAND_MARK = `
  <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="14" class="mark-bg" />
    <text x="32" y="29" text-anchor="middle" class="mark-bits">10</text>
    <text x="32" y="50" text-anchor="middle" class="mark-bits mark-bits-accent">01</text>
  </svg>`;

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つかりません');

app.innerHTML = `
  <div class="app">
    <header class="app-header">
      <div class="brand">
        ${BRAND_MARK}
        <div class="brand-text">
          <h1>bitdrill</h1>
          <p class="tagline">2進・16進・ビット演算を、手が覚えるまで反復する</p>
        </div>
      </div>
    </header>
    <main class="stage" id="stage"></main>
    <footer class="app-footer">
      <p>
        成績はこの端末のlocalStorageにだけ残ります。
        <a href="https://github.com/miruky/bitdrill">ソースコード</a>
      </p>
    </footer>
  </div>`;

const stage = document.getElementById('stage') as HTMLElement;

let stats: Stats = deserialize(store.getItem(STATS_KEY));
let selected: CategoryId[] = categories.map((category) => category.id);
let bits: 4 | 8 = 8;
let questions: Question[] = [];
let index = 0;
let answers: { input: string; correct: boolean }[] = [];

function saveStats(): void {
  store.setItem(STATS_KEY, serialize(stats));
}

function renderSetup(): void {
  stage.innerHTML = `
    <section class="card" aria-label="設定">
      <h2>出題範囲</h2>
      <div class="chips" id="category-chips">
        ${categories
          .map(
            (category) =>
              `<button type="button" class="chip" data-category="${category.id}"
                aria-pressed="${selected.includes(category.id)}"
                title="${category.description}">${category.name}</button>`,
          )
          .join('')}
      </div>
      <h2>ビット幅</h2>
      <div class="chips" id="bits-chips">
        <button type="button" class="chip" data-bits="4" aria-pressed="${bits === 4}">4ビット(0〜15)</button>
        <button type="button" class="chip" data-bits="8" aria-pressed="${bits === 8}">8ビット(0〜255)</button>
      </div>
      <button type="button" class="button button-primary button-start" id="start-button">
        ${SET_SIZE}問はじめる
      </button>
    </section>
    <section class="card" aria-label="成績">
      <h2>これまでの成績</h2>
      <table class="stats-table">
        <thead><tr><th>分野</th><th>挑戦</th><th>正答率</th></tr></thead>
        <tbody>
          ${categories
            .map((category) => {
              const entry = stats[category.id];
              const rate = accuracy(stats, category.id);
              return `<tr>
                <td>${category.name}</td>
                <td>${entry?.attempts ?? 0}</td>
                <td>${rate === null ? '-' : `${Math.round(rate * 100)}%`}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <button type="button" class="button button-small" id="clear-stats">成績を消す</button>
    </section>`;

  for (const chip of stage.querySelectorAll<HTMLButtonElement>('[data-category]')) {
    chip.addEventListener('click', () => {
      const id = chip.dataset.category as CategoryId;
      selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      if (selected.length === 0) selected = [id];
      chip.setAttribute('aria-pressed', String(selected.includes(id)));
    });
  }
  for (const chip of stage.querySelectorAll<HTMLButtonElement>('[data-bits]')) {
    chip.addEventListener('click', () => {
      bits = chip.dataset.bits === '4' ? 4 : 8;
      for (const other of stage.querySelectorAll<HTMLButtonElement>('[data-bits]')) {
        other.setAttribute('aria-pressed', String(other === chip));
      }
    });
  }
  stage.querySelector('#start-button')?.addEventListener('click', startSet);
  stage.querySelector('#clear-stats')?.addEventListener('click', () => {
    stats = {};
    saveStats();
    renderSetup();
  });
}

function startSet(): void {
  questions = buildSet(selected, bits, SET_SIZE, mulberry32(Date.now() >>> 0));
  index = 0;
  answers = [];
  renderQuestion();
}

function renderQuestion(): void {
  const question = questions[index] as Question;
  const baseName = { dec: '10進数', bin: '2進数', hex: '16進数' }[question.base];
  stage.innerHTML = `
    <section class="card drill" aria-label="出題">
      <p class="drill-progress">${index + 1} / ${questions.length}</p>
      <p class="drill-prompt" id="prompt">${question.prompt}</p>
      <form id="answer-form" class="drill-form">
        <input
          id="answer-input"
          class="drill-input"
          type="text"
          inputmode="${question.base === 'dec' ? 'numeric' : 'text'}"
          autocomplete="off"
          spellcheck="false"
          aria-label="答え(${baseName})"
          placeholder="${baseName}で入力"
        />
        <button type="submit" class="button button-primary">答える</button>
      </form>
      <div class="feedback" id="feedback" hidden>
        <p class="feedback-result" id="feedback-result"></p>
        <p class="feedback-explain" id="feedback-explain"></p>
        <button type="button" class="button button-primary" id="next-button">次へ</button>
      </div>
    </section>`;

  const input = stage.querySelector('#answer-input') as HTMLInputElement;
  const form = stage.querySelector('#answer-form') as HTMLFormElement;
  const feedback = stage.querySelector('#feedback') as HTMLElement;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim() === '') return;
    const correct = isCorrect(input.value, question);
    answers.push({ input: input.value.trim(), correct });
    stats = record(stats, question.category, correct);
    saveStats();

    input.disabled = true;
    (form.querySelector('button') as HTMLButtonElement).disabled = true;
    feedback.hidden = false;
    feedback.classList.toggle('is-correct', correct);
    feedback.classList.toggle('is-wrong', !correct);
    (stage.querySelector('#feedback-result') as HTMLElement).textContent = correct
      ? '正解'
      : '不正解';
    (stage.querySelector('#feedback-explain') as HTMLElement).textContent = question.explanation;
    (stage.querySelector('#next-button') as HTMLButtonElement).focus();
  });

  stage.querySelector('#next-button')?.addEventListener('click', () => {
    index += 1;
    if (index < questions.length) renderQuestion();
    else renderResult();
  });

  input.focus();
}

function renderResult(): void {
  const correctCount = answers.filter((answer) => answer.correct).length;
  stage.innerHTML = `
    <section class="card" aria-label="結果">
      <h2>結果 ${correctCount} / ${questions.length}</h2>
      <ol class="review">
        ${questions
          .map((question, i) => {
            const answer = answers[i];
            return `<li class="${answer?.correct ? 'review-correct' : 'review-wrong'}">
              <span class="review-mark">${answer?.correct ? '正' : '誤'}</span>
              <span class="review-body">${question.prompt}<br />
                <small>${question.explanation}</small></span>
            </li>`;
          })
          .join('')}
      </ol>
      <div class="result-actions">
        <button type="button" class="button button-primary" id="again-button">もう一度</button>
        <button type="button" class="button" id="setup-button">設定に戻る</button>
      </div>
    </section>`;
  stage.querySelector('#again-button')?.addEventListener('click', startSet);
  stage.querySelector('#setup-button')?.addEventListener('click', renderSetup);
}

renderSetup();
