# Word Nook 🛋️☕🐱

A cozy little language-learning POC. You wander into a warm **isometric** living
room ("cute 3D" diorama — Animal Crossing × Monument Valley vibes) with a little
avatar, walk up to things — the sofa, the coffee corner, the bookshelf, the
sleeping cat, the friend reading on the sofa — and **hear what each one is called
in the language you're learning**. The word pops up in a little speech bubble and
is saved to a list you can review and replay any time. It's all drawn
procedurally on a canvas — no images, no dependencies, no build step.

This is **phase 1: explore**. A mystery-solving mode is planned for later.

## Learnable languages

Pick one on the start screen — it's the language you'll *hear* and collect:

- 🇬🇧 English
- 🇹🇷 Türkçe
- 🇳🇱 Nederlands
- 🇯🇵 日本語 (the word list also shows romaji)

The UI itself stays in English; the collected list shows the target word next to
its English meaning.

### Adding a word (or a whole new room)

Everything speakable lives in `vocab.js` as data. Add one entry to `OBJECTS`:

```js
{
  id: 'clock', kind: 'box', x: 500, y: 60, w: 40, h: 40, z: 40, solid: true,
  color: '#8a6a55', gloss: 'clock',
  words: { en: 'clock', tr: 'saat', nl: 'klok', ja: '時計' }, romaji: 'tokei',
}
```

`x, y, w, h` are the object's footprint on the floor plane and `z` is its height;
give it a `kind` that `drawObject()` in `game.js` knows how to draw (or the
`box` fallback extrudes a simple shaded cuboid in `color`). That's it — no build
step.

## How it plays

- **Move** with the arrow keys / WASD, or **tap** where you want to walk.
- Walk up to an object (or tap it) → you **hear its name**, a speech bubble shows
  the word + meaning (+ romaji for Japanese), and it's added to your list.
- Interactive things twinkle with tiny sparkles; the counter (e.g. **8/15**) lets
  you see when you've found everything in the room.
- The **📖 Words** button opens your collected words; each has a ▶ to hear it
  again.
- **♪** mutes the little chime (spoken words always play).
- Your language choice and word list are saved in your browser (`localStorage`).

## Pronunciation

Words are spoken with the browser's built-in **Web Speech API** — no audio files,
no dependencies. Voice availability depends on your device/OS: if, say, a
Japanese or Turkish voice isn't installed, the word is still shown written out
(with romaji) and a one-time note lets you know. Desktop Chrome and Safari have
the widest voice coverage.

## Run locally

```bash
cd word-nook
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## Deploy to Render

Part of the repo-root `render.yaml` Blueprint (New → Blueprint), or add a Static
Site manually with an empty build command and publish directory `word-nook`.
