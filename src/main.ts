// 画面の組み立てと進行。設定 → 1セットのドリル → 結果の3状態を行き来し、
// 分野別の成績と最高連続正解をlocalStorageに積み上げる。
// 値そのものをマス目(bit-grid)で見せ、桁の重みを目で確かめながら反復する。

import './style.css';
import { buildSet, categories, isCorrect, type CategoryId, type Question } from './lib/questions';
import { mulberry32 } from './lib/rng';
import {
  accuracy,
  deserialize as readStats,
  record,
  serialize as writeStats,
  type Stats,
} from './lib/stats';
import { store } from './lib/storage';
import {
  deserialize as readSettings,
  serialize as writeSettings,
  type Settings,
} from './lib/settings';
import { bitGridSvg, weightStripSvg } from './lib/bits';
import {
  deserialize as readProfile,
  emptyProfile,
  recordSession,
  serialize as writeProfile,
  withStreak,
  type Profile,
} from './lib/profile';

const STATS_KEY = 'bitdrill:stats';
const PROFILE_KEY = 'bitdrill:profile';
const SETTINGS_KEY = 'bitdrill:settings';
const SET_SIZE = 10;
const HERO_VALUE = 0xb4; // 1011 0100 = 180、16進では B4

const BASE_NAME: Record<'dec' | 'bin' | 'hex', string> = {
  dec: '10進数',
  bin: '2進数',
  hex: '16進数',
};

const BRAND_MARK = `
  <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect class="mark-on" x="6" y="6" width="22" height="22" rx="6" />
    <rect class="mark-off" x="36" y="6" width="22" height="22" rx="6" />
    <rect class="mark-off" x="6" y="36" width="22" height="22" rx="6" />
    <rect class="mark-on" x="36" y="36" width="22" height="22" rx="6" />
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
          <p class="tagline">2進・16進・ビット演算を、手が覚えるまで</p>
        </div>
      </div>
    </header>
    <main class="stage" id="stage"></main>
    <footer class="app-footer">
      <p>
        成績はこの端末のlocalStorageにだけ残ります。
        <a class="link" href="https://github.com/miruky/bitdrill">ソースコード</a>
      </p>
    </footer>
  </div>`;

const stage = document.getElementById('stage') as HTMLElement;

const allCategoryIds: CategoryId[] = categories.map((category) => category.id);

let stats: Stats = readStats(store.getItem(STATS_KEY));
let profile: Profile = readProfile(store.getItem(PROFILE_KEY));
const settings: Settings = readSettings(store.getItem(SETTINGS_KEY), allCategoryIds);
let selected: CategoryId[] = settings.categories;
let bits: 4 | 8 = settings.bits;
let questions: Question[] = [];
let index = 0;
let answers: { input: string; correct: boolean }[] = [];
let streak = 0;

function saveStats(): void {
  store.setItem(STATS_KEY, writeStats(stats));
}

function saveProfile(): void {
  store.setItem(PROFILE_KEY, writeProfile(profile));
}

function saveSettings(): void {
  store.setItem(SETTINGS_KEY, writeSettings({ categories: selected, bits }));
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prefersReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function countUp(el: HTMLElement, to: number): void {
  el.textContent = String(to);
  if (to <= 0 || prefersReduced() || typeof requestAnimationFrame !== 'function') return;
  const duration = 540;
  const start = Date.now();
  const step = (): void => {
    const t = Math.min(1, (Date.now() - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = String(Math.round(eased * to));
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = String(to);
  };
  requestAnimationFrame(step);
}

function renderSetup(): void {
  const totalSessions = profile.sessions.length;
  stage.innerHTML = `
    <section class="setup">
      <div class="hero">
        <p class="kicker">二進法・十六進法のドリル</p>
        <h2 class="hero-title">ビットの読み書きを、<span>手が覚えるまで反復する</span></h2>
        <p class="hero-lead">
          2進数と16進数の変換、AND・OR・XOR、シフト演算を10問1セットで出題します。
          答え合わせのたびに桁の重みを図で確かめられるので、頭の中の変換が速くなります。
        </p>
        <figure class="hero-figure">
          ${bitGridSvg(HERO_VALUE, 8, {
            hexLabels: true,
            ariaLabel: '例: 10進180は2進1011 0100、16進ではB4',
          })}
          <figcaption>10進 <b>180</b> ・ 2進 <b>1011&nbsp;0100</b> ・ 16進 <b>B4</b></figcaption>
        </figure>
      </div>

      <div class="panel">
        <h3 class="panel-title"><span class="panel-index">01</span>出題範囲</h3>
        <div class="chips" id="category-chips">
          ${categories
            .map(
              (category) =>
                `<button type="button" class="chip" data-category="${category.id}"
                  aria-pressed="${selected.includes(category.id)}"
                  title="${esc(category.description)}">${esc(category.name)}</button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title"><span class="panel-index">02</span>ビット幅</h3>
        <div class="chips" id="bits-chips">
          <button type="button" class="chip" data-bits="4" aria-pressed="${bits === 4}">4ビット<small>0〜15</small></button>
          <button type="button" class="chip" data-bits="8" aria-pressed="${bits === 8}">8ビット<small>0〜255</small></button>
        </div>
      </div>

      <div class="start-row">
        <button type="button" class="button button-primary button-start" id="start-button">
          ${SET_SIZE}問はじめる
        </button>
        <p class="start-note">
          最高連続正解 <strong>${profile.bestStreak}</strong>
          <span class="dot" aria-hidden="true"></span>
          ${totalSessions === 0 ? 'まだ記録なし' : `これまで <strong>${totalSessions}</strong> セット`}
        </p>
      </div>

      <div class="panel">
        <h3 class="panel-title"><span class="panel-index">03</span>分野別の成績</h3>
        <table class="stats-table">
          <thead><tr><th>分野</th><th>挑戦</th><th>正答率</th></tr></thead>
          <tbody>
            ${categories
              .map((category) => {
                const entry = stats[category.id];
                const rate = accuracy(stats, category.id);
                const pct = rate === null ? null : Math.round(rate * 100);
                return `<tr>
                  <td>${esc(category.name)}</td>
                  <td class="num">${entry?.attempts ?? 0}</td>
                  <td class="num">
                    ${
                      pct === null
                        ? '<span class="rate-empty">-</span>'
                        : `<span class="rate"><span class="rate-bar" style="--rate:${pct}%"></span><span class="rate-pct">${pct}%</span></span>`
                    }
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <button type="button" class="button-link" id="clear-stats">成績を消す</button>
      </div>
    </section>`;

  for (const chip of stage.querySelectorAll<HTMLButtonElement>('[data-category]')) {
    chip.addEventListener('click', () => {
      const id = chip.dataset.category as CategoryId;
      selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      if (selected.length === 0) selected = [id];
      chip.setAttribute('aria-pressed', String(selected.includes(id)));
      saveSettings();
    });
  }
  for (const chip of stage.querySelectorAll<HTMLButtonElement>('[data-bits]')) {
    chip.addEventListener('click', () => {
      bits = chip.dataset.bits === '4' ? 4 : 8;
      for (const other of stage.querySelectorAll<HTMLButtonElement>('[data-bits]')) {
        other.setAttribute('aria-pressed', String(other === chip));
      }
      saveSettings();
    });
  }
  stage.querySelector('#start-button')?.addEventListener('click', startSet);
  stage.querySelector('#clear-stats')?.addEventListener('click', () => {
    stats = {};
    profile = emptyProfile();
    saveStats();
    saveProfile();
    renderSetup();
  });
}

function startSet(): void {
  questions = buildSet(selected, bits, SET_SIZE, mulberry32(Date.now() >>> 0));
  index = 0;
  answers = [];
  streak = 0;
  renderQuestion();
}

function renderQuestion(): void {
  const question = questions[index] as Question;
  const baseName = BASE_NAME[question.base];
  stage.innerHTML = `
    <section class="drill" aria-label="出題">
      <div class="drill-top">
        <p class="drill-progress">${index + 1} / ${questions.length}</p>
        <p class="drill-streak" data-active="${streak > 0}">連続 <strong>${streak}</strong></p>
      </div>
      <p class="drill-prompt" id="prompt">${esc(question.prompt)}</p>
      <form id="answer-form" class="drill-form">
        <input
          id="answer-input"
          class="drill-input"
          type="text"
          inputmode="${question.base === 'dec' ? 'numeric' : 'text'}"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="答え(${baseName})"
          placeholder="${baseName}で入力"
        />
        <button type="submit" class="button button-primary">答える</button>
      </form>
      <div class="hint">
        <button type="button" class="button-link" id="hint-toggle" aria-expanded="false" aria-controls="hint-body">
          桁の重みを見る
        </button>
        <div class="hint-body" id="hint-body" hidden>
          <p class="hint-note">各マスの下が桁の重み。立っている桁の重みを足すと10進数になります。</p>
          ${weightStripSvg(bits)}
        </div>
      </div>
      <div class="feedback" id="feedback" hidden>
        <p class="feedback-result" id="feedback-result"></p>
        <p class="feedback-answer" id="feedback-answer" hidden></p>
        <div class="feedback-figure" id="feedback-figure"></div>
        <p class="feedback-explain" id="feedback-explain"></p>
        <button type="button" class="button button-primary" id="next-button">次へ</button>
      </div>
    </section>`;

  const input = stage.querySelector('#answer-input') as HTMLInputElement;
  const form = stage.querySelector('#answer-form') as HTMLFormElement;
  const feedback = stage.querySelector('#feedback') as HTMLElement;
  const hintToggle = stage.querySelector('#hint-toggle') as HTMLButtonElement;
  const hintBody = stage.querySelector('#hint-body') as HTMLElement;

  hintToggle.addEventListener('click', () => {
    const opening = hintBody.hasAttribute('hidden');
    if (opening) hintBody.removeAttribute('hidden');
    else hintBody.setAttribute('hidden', '');
    hintToggle.setAttribute('aria-expanded', String(opening));
    hintToggle.textContent = opening ? '桁の重みを隠す' : '桁の重みを見る';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim() === '') {
      input.focus();
      return;
    }
    const correct = isCorrect(input.value, question);
    answers.push({ input: input.value.trim(), correct });
    stats = record(stats, question.category, correct);
    streak = correct ? streak + 1 : 0;
    profile = withStreak(profile, streak);
    saveStats();
    saveProfile();

    input.disabled = true;
    (form.querySelector('button') as HTMLButtonElement).disabled = true;
    hintToggle.disabled = true;
    feedback.hidden = false;
    feedback.classList.toggle('is-correct', correct);
    feedback.classList.toggle('is-wrong', !correct);
    (stage.querySelector('#feedback-result') as HTMLElement).textContent = correct
      ? '正解'
      : '不正解';
    const answerLine = stage.querySelector('#feedback-answer') as HTMLElement;
    answerLine.hidden = correct;
    answerLine.textContent = correct ? '' : `答えは ${formatAnswer(question)}`;
    (stage.querySelector('#feedback-figure') as HTMLElement).innerHTML = bitGridSvg(
      question.answer,
      bits,
      { hexLabels: true, ariaLabel: `答え ${question.answer} の${bits}ビット表現` },
    );
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

// 解説の冒頭に出す、その問題の答えの自然な表記
function formatAnswer(question: Question): string {
  if (question.base === 'bin') return question.answer.toString(2);
  if (question.base === 'hex') return `0x${question.answer.toString(16).toUpperCase()}`;
  return String(question.answer);
}

function renderResult(): void {
  const correctCount = answers.filter((answer) => answer.correct).length;
  profile = recordSession(profile, {
    correct: correctCount,
    total: questions.length,
    at: Date.now(),
  });
  saveProfile();

  const verdict =
    correctCount === questions.length
      ? '全問正解'
      : correctCount >= questions.length * 0.7
        ? 'いい調子'
        : '反復あるのみ';

  stage.innerHTML = `
    <section class="result" aria-label="結果">
      <p class="kicker">セット完了</p>
      <h2 class="result-score">結果 <span class="count" id="score-count">0</span> / ${questions.length}</h2>
      <p class="result-verdict">${verdict}<span class="dot" aria-hidden="true"></span>このセットの最高連続正解 <strong>${maxRunInSet()}</strong></p>
      <ol class="review">
        ${questions
          .map((question, i) => {
            const answer = answers[i];
            const ok = answer?.correct;
            return `<li class="review-item ${ok ? 'is-correct' : 'is-wrong'}">
              <div class="review-head">
                <span class="review-mark">${ok ? '正' : '誤'}</span>
                <span class="review-prompt">${esc(question.prompt)}</span>
              </div>
              <div class="review-grid">${bitGridSvg(question.answer, bits, {
                hexLabels: true,
                ariaLabel: `${question.answer} の${bits}ビット表現`,
              })}</div>
              <p class="review-explain">${esc(question.explanation)}</p>
            </li>`;
          })
          .join('')}
      </ol>
      <div class="result-actions">
        <button type="button" class="button button-primary" id="again-button">もう一度</button>
        <button type="button" class="button" id="setup-button">設定に戻る</button>
      </div>
    </section>`;

  countUp(stage.querySelector('#score-count') as HTMLElement, correctCount);
  stage.querySelector('#again-button')?.addEventListener('click', startSet);
  stage.querySelector('#setup-button')?.addEventListener('click', renderSetup);
}

// このセット内で連続正解した最長の長さ
function maxRunInSet(): number {
  let best = 0;
  let run = 0;
  for (const answer of answers) {
    run = answer.correct ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

renderSetup();
