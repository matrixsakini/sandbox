# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

Word Nook is a standalone language-learning POC: a cute top-down living room you explore. You move a little avatar around, walk up to (or tap) objects — sofa, coffee table, coffee machine, cup, sleeping cat, plant, lamp, the other person… — and **hear each object's name spoken in the language you're learning**. Every word you hear is collected into a list you can review and replay later. HTML5 canvas + vanilla JS, no build step, no dependencies, no backend. It is independent of the Java trivia service at the repo root and a sibling of `moon-merge/` / `moon-slash/` (same house style).

This is **phase 1: explore**. A mystery-solving mode is a planned later phase (a hook comment marks where it would branch in `game.js`).

## Running

Open `index.html` directly, or `python3 -m http.server 8000` from this folder. There are no tests or linters — verify changes by playing in a browser. Pronunciation needs a real browser with the relevant voice installed (see below).

## Structure

- **`vocab.js`** — `window.Vocab`: the learnable languages (`LANGS`: English / Türkçe / Nederlands / 日本語, each with a BCP-47 tag) and the room's `OBJECTS` (position, `kind` for drawing, the word in all four languages, `romaji` for Japanese, and an English `gloss`). Pure data + tiny lookups. **Adding a word or a new room object is a one-entry change here.**
- **`speech.js`** — `window.Speech`: thin wrapper over the browser **Web Speech API** (`speechSynthesis`). No audio files. Handles async voice loading, best-matches a voice by language tag, and is fully guarded so the game still runs where speech is unavailable. `speak()` returns whether a real voice was used so the game can show a fallback note.
- **`wordlist.js`** — `window.WordList`: the collected-words store in `localStorage`, kept **per target language** (like the moon games' per-mode boards). Defensive load/save; malformed data is coerced or dropped. Tracks a per-word heard count.
- **`game.js`** — the entire game in one IIFE: the top-down room (procedural canvas drawing per object `kind`), the avatar, movement (WASD/arrows **and** tap-to-walk with axis-separated collision), edge-triggered proximity + tap interaction, the floating word label, the Words review overlay, and a WebAudio chime. Constants live at the top; a `ui` object caches all DOM handles.

## Conventions

- **UI is English-only** for this POC; only the `Vocab` `words` are localized (spoken/collected). Adding UI localization would follow the moon games' `i18n.js` pattern, but we deliberately keep it out of scope here.
- **Pronunciation is best-effort.** Turkish/Japanese/Dutch voices are not installed on every device; when a voice is missing the word is still shown (written + romaji) and a one-time note appears. Never ship audio files — keep speech via `Speech`.
- The **chime** (WebAudio) is what `#mute-btn` silences; spoken words are the point of the game and are never muted.
- All persistence is `localStorage` under `wordnook-*` keys (`wordnook-lang`, `wordnook-muted`, `wordnook-words`).
- The sibling `moon-merge/` / `moon-slash/` games share the same no-build, single-IIFE, canvas + `localStorage` patterns; keep the family consistent.
