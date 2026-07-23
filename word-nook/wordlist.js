/*
 * Word Nook collected-words store — the vocabulary you've heard, kept per
 * target language in localStorage. No backend: each browser keeps its own list.
 * Mirrors the moon games' leaderboard.js: defensive load/save, malformed data
 * coerced or dropped, one keyed bucket per language (like their per-mode boards).
 */
window.WordList = (() => {
  'use strict';

  const STORAGE_KEY = 'wordnook-words';
  const LANGS = ['en', 'tr', 'nl', 'ja'];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const out = {};
      for (const code of LANGS) {
        out[code] = Array.isArray(data[code])
          ? data[code]
              .filter((e) => e && typeof e.id === 'string' && typeof e.word === 'string')
              .map((e) => ({
                id: e.id,
                word: e.word,
                gloss: typeof e.gloss === 'string' ? e.gloss : '',
                romaji: typeof e.romaji === 'string' ? e.romaji : '',
                count: typeof e.count === 'number' && e.count > 0 ? e.count : 1,
                firstSeen: e.firstSeen || null,
              }))
          : [];
      }
      return out;
    } catch (e) {
      return { en: [], tr: [], nl: [], ja: [] };
    }
  }

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  function bucket(code) {
    return LANGS.includes(code) ? code : 'en';
  }

  // Record that a word was heard. Increments the count if already collected,
  // otherwise appends in collection order. Returns { entry, isNew }.
  function add(lang, obj) {
    if (!obj || !obj.id) return { entry: null, isNew: false };
    const key = bucket(lang);
    const data = load();
    const list = data[key];
    const existing = list.find((e) => e.id === obj.id);
    if (existing) {
      existing.count += 1;
      save(data);
      return { entry: existing, isNew: false };
    }
    const entry = {
      id: obj.id,
      word: obj.word,
      gloss: obj.gloss || '',
      romaji: obj.romaji || '',
      count: 1,
      firstSeen: new Date().toISOString(),
    };
    list.push(entry);
    save(data);
    return { entry, isNew: true };
  }

  // Collected words for a language, in the order they were first heard.
  function all(lang) {
    return load()[bucket(lang)];
  }

  function count(lang) {
    return all(lang).length;
  }

  function clear(lang) {
    const data = load();
    data[bucket(lang)] = [];
    save(data);
  }

  return { add, all, count, clear };
})();
