# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

Moon Merge is a standalone Sailor Moon-themed merge puzzle (Triple Town-style): HTML5 canvas + vanilla JS, no build step, no dependencies, no backend. It is independent of the Java trivia service at the repo root.

## Running

Open `index.html` directly, or `python3 -m http.server 8000` from this folder. There are no tests or linters — verify changes by playing in a browser.

## Structure

- **`game.js`** — the entire game in one IIFE: 6×6 board state, the 9-tier merge chain (`TIERS`), youma movement/trapping, the shuffled-bag piece dealer, the subspace pocket, canvas rendering, and input. Game constants (scores, `MAX_ACTIVE_YOUMA`, milestone tiers) are at the top.
- **`i18n.js`** — `window.I18N` with per-language dictionaries (EN/TR). All user-visible strings go through it; `game.js`/`index.html` reference keys, never literals. Adding a language = one dictionary entry here + one button in `index.html`. Language choice persists in `localStorage`.
- **`leaderboard.js`** — `window.Leaderboard`, a top-10 localStorage high-score table (best score per name, case-insensitive). Shaped per-mode (currently only `classic`) so future modes are cheap. Mirrors moon-slash's implementation.

## Conventions

- Transformation phrases ("Moon Crystal Power, Make Up!", …) and "Neo Queen Serenity" are **deliberately untranslated** in every language — do not localize them.
- The sibling `moon-slash/` game shares the same i18n and leaderboard patterns; keep the two consistent when changing either pattern.
- All persistence is `localStorage` under `moonmerge-*` keys.
