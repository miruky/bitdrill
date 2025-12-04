// セット成績の履歴と最高連続正解。分野別集計(stats)とは別に、
// 1セットごとの結果を時系列で残し、推移の描画と自己ベストの表示に使う。

export interface SessionResult {
  correct: number;
  total: number;
  at: number; // 終了時刻(epoch ミリ秒)
}

export interface Profile {
  bestStreak: number;
  sessions: SessionResult[]; // 古い順。直近のぶんだけ保持する
}

const MAX_SESSIONS = 60;

export function emptyProfile(): Profile {
  return { bestStreak: 0, sessions: [] };
}

export function recordSession(profile: Profile, result: SessionResult): Profile {
  const sessions = [...profile.sessions, result].slice(-MAX_SESSIONS);
  return { ...profile, sessions };
}

export function withStreak(profile: Profile, streak: number): Profile {
  return streak > profile.bestStreak ? { ...profile, bestStreak: streak } : profile;
}

function isSession(value: unknown): value is SessionResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SessionResult).correct === 'number' &&
    typeof (value as SessionResult).total === 'number' &&
    typeof (value as SessionResult).at === 'number' &&
    (value as SessionResult).total > 0
  );
}

export function serialize(profile: Profile): string {
  return JSON.stringify(profile);
}

export function deserialize(text: string | null): Profile {
  if (!text) return emptyProfile();
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return emptyProfile();
    const best = (parsed as Profile).bestStreak;
    const rawSessions = (parsed as Profile).sessions;
    return {
      bestStreak: typeof best === 'number' && best >= 0 ? Math.floor(best) : 0,
      sessions: Array.isArray(rawSessions) ? rawSessions.filter(isSession).slice(-MAX_SESSIONS) : [],
    };
  } catch {
    return emptyProfile();
  }
}
