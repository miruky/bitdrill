// 成績の保存先。localStorageが使えない環境では、セッション内だけ
// 生きるメモリ実装に切り替える。

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
}

function detect(): KeyValueStore {
  try {
    const candidate = window.localStorage;
    const probe = '__bitdrill-probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    if (typeof candidate.clear !== 'function') return memoryStore();
    return candidate;
  } catch {
    return memoryStore();
  }
}

export const store: KeyValueStore = detect();
