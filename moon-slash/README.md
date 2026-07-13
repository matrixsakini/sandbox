# Moon Slash — Save Crystal Tokyo 🌙

A 30-second celestial slashing game inspired by Fruit Ninja and Sailor Moon.
Crystal Tokyo starts drowned in darkness — swipe to slice the shadows before
they fall. Every unbroken combo restores light to the kingdom; every shadow
that slips past dims it again. Fill the light bar and finish the run as
**Neo Queen Serenity**.

Pure HTML5 canvas + vanilla JS. No build step, no dependencies, no backend.

## How to play

- **Swipe** (mouse drag or touch) to slice dark orbs, shards, and wisps.
- Letting darkness **fall off-screen unsliced** breaks your combo and dims the light.
- Combos raise your score multiplier, the light gain per slice, and trigger
  milestone attacks (Moon Tiara Action at ×5, Moon Crystal Power at ×15, …).
- Slice 3+ shadows in one swipe for a **triple slice** bonus.
- After 30 seconds you're ranked by how much radiance you restored.

## Run locally

It's a static page — open `index.html` directly, or serve the folder:

```bash
cd moon-slash
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
empty, and set the publish directory to `moon-slash`.)
