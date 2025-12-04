import { describe, expect, it } from 'vitest';
import { deserialize, emptyProfile, recordSession, serialize, withStreak } from './profile';

describe('profile', () => {
  it('セット結果を時系列で積む', () => {
    let profile = emptyProfile();
    profile = recordSession(profile, { correct: 7, total: 10, at: 1 });
    profile = recordSession(profile, { correct: 9, total: 10, at: 2 });
    expect(profile.sessions).toHaveLength(2);
    expect(profile.sessions[1]?.correct).toBe(9);
  });

  it('最高連続正解は更新時だけ伸びる', () => {
    let profile = emptyProfile();
    profile = withStreak(profile, 5);
    expect(profile.bestStreak).toBe(5);
    profile = withStreak(profile, 3);
    expect(profile.bestStreak).toBe(5);
    profile = withStreak(profile, 8);
    expect(profile.bestStreak).toBe(8);
  });

  it('保存と復元で内容が一致する', () => {
    const profile = recordSession(withStreak(emptyProfile(), 4), { correct: 6, total: 10, at: 99 });
    expect(deserialize(serialize(profile))).toEqual(profile);
  });

  it('壊れたデータは空のプロフィールに落とす', () => {
    expect(deserialize(null)).toEqual(emptyProfile());
    expect(deserialize('{')).toEqual(emptyProfile());
    expect(deserialize('"x"')).toEqual(emptyProfile());
  });

  it('不正なセッションだけを捨て、健全なものは残す', () => {
    const text = JSON.stringify({
      bestStreak: -3,
      sessions: [
        { correct: 5, total: 10, at: 1 },
        { correct: 5, total: 0, at: 2 },
        { nope: true },
        42,
      ],
    });
    const profile = deserialize(text);
    expect(profile.bestStreak).toBe(0);
    expect(profile.sessions).toEqual([{ correct: 5, total: 10, at: 1 }]);
  });
});
