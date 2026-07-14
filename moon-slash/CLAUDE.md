# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

Moon Slash is a standalone Sailor Moon-themed slashing game (Fruit Ninja-style, 30-second runs): HTML5 canvas + vanilla JS, no build step, no dependencies, no backend. It is independent of the Java trivia service at the repo root.

## Running

Open `index.html` directly, or `python3 -m http.server 8000` from this folder. There are no tests or linters — verify changes by playing in a browser.

## Structure

- **`game.js`** — the entire game in one IIFE: spawning/physics of dark orbs, swipe detection (mouse + touch, including the guard against browser swipe-back navigation), combo/light-bar logic, milestone attacks, the two modes (**Prism**: misses break combo; **Eternal**: one miss ends the run), and canvas rendering. Constants live at the top.
- **`i18n.js`** — `window.I18N` with per-language dictionaries (EN/TR). All user-visible strings go through it; `game.js`/`index.html` reference keys, never literals. Adding a language = one dictionary entry here + one button in `index.html`. Language and mode choices persist in `localStorage`.
- **`leaderboard.js`** — `window.Leaderboard`, a top-10 localStorage high-score table (best score per name, case-insensitive) kept **per mode** (`prism`/`eternal` have separate boards). Mirrors moon-merge's implementation.

## Conventions

- Attack names ("Moon Tiara Action!", …), mode names, and "Neo Queen Serenity" are **deliberately untranslated** in every language — do not localize them.
- The sibling `moon-merge/` game shares the same i18n and leaderboard patterns; keep the two consistent when changing either pattern.
- All persistence is `localStorage` under `moonslash-*` keys.
