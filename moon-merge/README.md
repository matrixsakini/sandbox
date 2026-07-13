# Moon Merge — Forge the Silver Crystal ✨

A celestial merge puzzle inspired by Triple Town and Sailor Moon. Place relics
on a 6×6 board — three matching relics side by side merge into the next of
Usagi's treasures, from humble stardust through every transformation brooch,
all the way to the **Silver Crystal**. Merge three Silver Crystals and
**Neo Queen Serenity** herself answers.

Youma wander the board, one step per turn. They can't be merged away — but
corner one so it has nowhere left to move and it seals itself into a
**Dark Crystal**. Three adjacent Dark Crystals shatter and vanish. Every youma
is telegraphed in the upcoming-piece queue, so a planned board survives them;
a careless one drowns in darkness.

Pure HTML5 canvas + vanilla JS. No build step, no dependencies, no backend.

## Languages

English and Turkish (Türkçe). Toggle with the **EN | TR** buttons on the
title screen; the choice is remembered in `localStorage`, and first-time
visitors with a Turkish browser start in Turkish automatically. Transformation
phrases ("Moon Crystal Power, Make Up!", …) and "Neo Queen Serenity" are
intentionally untranslated. To add a language, add one dictionary entry in
`i18n.js` and a matching button in `index.html`.

## The merge chain

Stardust → Moon Stone → Crescent Crystal → Transformation Brooch →
Crystal Star → Cosmic Heart Compact → Crisis Moon Compact →
Eternal Moon Article → Silver Crystal.

Reaching a new brooch for the first time triggers its transformation phrase.
Higher tiers are worth more, and cascading chain merges multiply the points.

## Planning tools

- **Upcoming queue** — the current relic plus the next two are always visible,
  so every youma is announced two turns in advance.
- **Subspace pocket** — stash the current piece (even a youma) and swap it
  back later. Stashing doesn't count as a turn — youma stand still — but only
  one swap is allowed per placement.
- **Fair randomness** — pieces are dealt from a shuffled 20-piece bag
  (mostly stardust, a couple of youma, never bunched together), and youma
  stop spawning while three already roam the board.

## Leaderboards

The game keeps a **Hall of Crystals** — a top-10 high-score table shown on the
results screen. When a run earns a place, an arcade-style name entry appears;
your name and score are saved and your row is highlighted. Only your **best**
score per name is kept (case-insensitive), sorted highest first.

Boards are stored **locally** in `localStorage` (no backend, no accounts), so
they're per-browser, and your last name is remembered to pre-fill the next
entry.

## How to play

- **Tap** (or click) an empty cell to place the current relic.
- Three or more matching relics connected orthogonally merge into one relic of
  the next tier, at the cell you just played. Chains cascade — and multiply.
- **Youma** move one random step after each placement. Wall one in to seal it
  (+300); clear three adjacent Dark Crystals to purge them (+150 each).
- The run ends when the board is full. You're ranked by the highest relic
  you forged.

## Run locally

It's a static page — open `index.html` directly, or serve the folder:

```bash
cd moon-merge
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy to Render

The repo root contains a `render.yaml` Blueprint that publishes this folder
as a free Render **Static Site**:

1. Push this repo to GitHub.
2. In Render: **New → Blueprint** → select this repo.
3. Deploy — no environment variables or build step required.

(Alternatively: **New → Static Site**, pick this repo, leave the build command
empty, and set the publish directory to `moon-merge`.)
