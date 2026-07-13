/*
 * Moon Merge leaderboards — high-score table in localStorage.
 * No backend: each browser keeps its own board. Mirrors moon-slash's (and the
 * trivia service's) semantics — best score per player, sorted descending,
 * capped at the top N. Kept per-mode in shape so future modes are cheap.
 */
window.Leaderboard = (() => {
  'use strict';

  const STORAGE_KEY = 'moonmerge-leaderboard';
  const NAME_KEY = 'moonmerge-lastname';
  const LIMIT = 10;
  const MAX_NAME = 24;
  const MODES = ['classic'];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      // Coerce into the expected shape, dropping anything malformed.
      const out = {};
      for (const mode of MODES) {
        out[mode] = Array.isArray(data[mode])
          ? data[mode]
              .filter(e => e && typeof e.name === 'string' && typeof e.score === 'number')
              .map(e => ({ name: e.name, score: e.score, date: e.date || null }))
          : [];
      }
      return out;
    } catch (e) {
      return { classic: [] };
    }
  }

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  function sortTrim(entries) {
    return entries
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMIT);
  }

  function boardFor(mode) {
    return MODES.includes(mode) ? mode : 'classic';
  }

  function cleanName(name) {
    const trimmed = (name || '').trim().slice(0, MAX_NAME);
    if (trimmed) return trimmed;
    return (window.I18N && I18N.t('anonName')) || 'Nameless Guardian';
  }

  // Top entries for a mode, already sorted descending and capped.
  function top(mode, limit = LIMIT) {
    return sortTrim(load()[boardFor(mode)]).slice(0, limit);
  }

  // Would this score earn a spot on the board? (Ties don't bump an equal score.)
  function qualifies(mode, score) {
    if (!(score > 0)) return false;
    const board = top(mode);
    if (board.length < LIMIT) return true;
    return score > board[board.length - 1].score;
  }

  // Record a score, keeping only each player's best (case-insensitive name).
  // Returns the saved entry's 1-based rank, or -1 if it didn't make the board.
  function submit(mode, name, score) {
    if (!(score > 0)) return -1;
    const key = boardFor(mode);
    const data = load();
    const clean = cleanName(name);
    const date = new Date().toISOString();

    const entries = data[key];
    const existing = entries.find(e => e.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (score <= existing.score) {
        rememberName(clean);
        const ranked = sortTrim(entries);
        return rankOf(ranked, existing);
      }
      existing.score = score;
      existing.name = clean;
      existing.date = date;
    } else {
      entries.push({ name: clean, score, date });
    }

    const ranked = sortTrim(entries);
    data[key] = ranked;
    save(data);
    rememberName(clean);

    const saved = ranked.find(e => e.name.toLowerCase() === clean.toLowerCase());
    return saved ? rankOf(ranked, saved) : -1;
  }

  function rankOf(ranked, entry) {
    const i = ranked.indexOf(entry);
    return i === -1 ? -1 : i + 1;
  }

  function rememberName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* storage unavailable */ }
  }

  function lastName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }

  return { top, qualifies, submit, lastName };
})();
