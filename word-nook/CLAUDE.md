# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

Word Nook is a standalone language-learning POC: a cozy **isometric living room** (a procedurally-drawn "cute 3D" diorama — Animal Crossing / Monument Valley vibes) that you explore. You move a little avatar around, walk up to (or tap) objects — sofa, coffee table, espresso machine, mug, sugar jar, milk carton, bookshelf, sleeping cat, plants, lamp, the friendly NPC reading on the sofa… — and **hear each object's name spoken in the language you're learning**. The word pops up as an in-world speech bubble and is collected into a list you can review and replay later. HTML5 canvas + vanilla JS, no build step, no dependencies, no backend, no image assets (all geometry is drawn on the canvas). It is independent of the Java trivia service at the repo root and a sibling of `moon-merge/` / `moon-slash/` (same house style).

This is **phase 1: explore**. A mystery-solving mode is a planned later phase (a hook comment marks where it would branch in `game.js`).

## Running

Open `index.html` directly, or `python3 -m http.server 8000` from this folder. There are no tests or linters — verify changes by playing in a browser. Pronunciation needs a real browser with the relevant voice installed (see below).

## Structure

- **`vocab.js`** — `window.Vocab`: the learnable languages (`LANGS`: English / Türkçe / Nederlands / 日本語, each with a BCP-47 tag) and the room's `OBJECTS`. Each object gives its footprint on the floor plane (`x, y, w, h`), extruded height `z` (and optional `base` to sit on a surface, `solid` for collision, `depthBias` for draw order, `decor` for non-interactive scenery), a `kind` for drawing, the word in all four languages, `romaji` for Japanese, and an English `gloss`. `INTERACTIVE`/`total` expose the countable set. Pure data + tiny lookups. **Adding a word or a new room object is a one-entry change here.**
- **`speech.js`** — `window.Speech`: thin wrapper over the browser **Web Speech API** (`speechSynthesis`). No audio files. Handles async voice loading, best-matches a voice by language tag, and is fully guarded so the game still runs where speech is unavailable. `speak()` returns whether a real voice was used so the game can show a fallback note.
- **`wordlist.js`** — `window.WordList`: the collected-words store in `localStorage`, kept **per target language** (like the moon games' per-mode boards). Defensive load/save; malformed data is coerced or dropped. Tracks a per-word heard count.
- **`game.js`** — the entire game in one IIFE: the **isometric renderer** (`toScreen()` projects floor units to 2:1 iso screen space; `box()` extrudes shaded cuboids; walls, warm afternoon sun-pool, per-`kind` furniture, characters, twinkling sparkles on interactables, and a warm vignette), painter's-algorithm depth sorting, the avatar, movement (WASD/arrows **and** tap-to-walk with collision; `screenToFloor()` / `objectAtScreen()` for picking), edge-triggered proximity + tap interaction, the in-world speech bubble, the Words review overlay, and a WebAudio chime. Constants live at the top; a `ui` object caches all DOM handles.

## Conventions

- **UI is English-only** for this POC; only the `Vocab` `words` are localized (spoken/collected). Adding UI localization would follow the moon games' `i18n.js` pattern, but we deliberately keep it out of scope here.
- **Pronunciation is best-effort.** Turkish/Japanese/Dutch voices are not installed on every device; when a voice is missing the word is still shown (written + romaji) and a one-time note appears. Never ship audio files — keep speech via `Speech`.
- The **chime** (WebAudio) is what `#mute-btn` silences; spoken words are the point of the game and are never muted.
- All persistence is `localStorage` under `wordnook-*` keys (`wordnook-lang`, `wordnook-muted`, `wordnook-words`).
- The sibling `moon-merge/` / `moon-slash/` games share the same no-build, single-IIFE, canvas + `localStorage` patterns; keep the family consistent.
