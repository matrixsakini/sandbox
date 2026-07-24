/*
 * Word Nook speech — pronounce a word in the target language.
 *
 * Primary path: pre-recorded clips in `audio/{lang}/{id}.mp3` (generated offline
 * by tools/generate_audio.py). These are correct and identical on every device —
 * no OS voice needed, no network at play time. `pronounce(id, code, ...)` plays
 * the clip listed in `audio/manifest.json`.
 *
 * Fallback path: the browser's built-in Web Speech API (window.speechSynthesis),
 * used only for words without a clip. Voice availability varies by OS/browser (a
 * Turkish voice may simply not be installed), so it stays fully guarded: when no
 * matching voice exists we don't speak (avoids the default voice reading the word
 * in the wrong language) and the game shows a one-time note with the word written.
 */
window.Speech = (() => {
  'use strict';

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';

  let voices = [];
  const cache = new Map(); // bcp47 -> chosen SpeechSynthesisVoice | null

  function refresh() {
    if (!supported) return;
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch (e) {
      voices = [];
    }
    cache.clear();
  }

  if (supported) {
    refresh();
    // Voices often load asynchronously; re-read when the browser signals ready.
    try {
      window.speechSynthesis.addEventListener('voiceschanged', refresh);
    } catch (e) { /* older browsers expose onvoiceschanged only */
      window.speechSynthesis.onvoiceschanged = refresh;
    }
  }

  // Best-match voice for a BCP-47 tag: exact match first, then language prefix.
  function voiceFor(bcp47) {
    if (!supported) return null;
    if (cache.has(bcp47)) return cache.get(bcp47);
    if (!voices.length) refresh();

    const tag = (bcp47 || '').toLowerCase();
    const prefix = tag.split('-')[0];
    let match = voices.find((v) => (v.lang || '').toLowerCase() === tag);
    if (!match) match = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix));
    const chosen = match || null;
    cache.set(bcp47, chosen);
    return chosen;
  }

  function hasVoice(bcp47) {
    return !!voiceFor(bcp47);
  }

  // Speak `text` in `bcp47`. Returns true if a matching voice was used, false if
  // we fell back (no voice / unsupported) so the caller can surface a note.
  function speak(text, bcp47) {
    if (!supported || !text) return false;
    const voice = voiceFor(bcp47);
    // If the platform enumerates voices but none match the target language,
    // don't speak: the engine would fall back to the default (wrong-language)
    // voice — e.g. a US voice reading Turkish with English phonetics. Staying
    // silent and letting the game show the written word + note is honest.
    // When the voice list is empty we can't tell what's available, so we still
    // try (some mobile engines synthesize from `lang` without listing voices).
    if (!voice && voices.length) return false;
    try {
      window.speechSynthesis.cancel(); // avoid overlap when tapping rapidly
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp47 || 'en-US';
      if (voice) u.voice = voice;
      u.rate = 0.9;  // gentle, learner-friendly pace
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      return false;
    }
    return !!voice;
  }

  // ---- Pre-recorded clips (primary path) ---------------------------------
  const CLIP_BASE = 'audio';
  let manifest = null;             // { code: Set(ids) }, null until loaded
  const clipCache = new Map();     // url -> HTMLAudioElement
  let playing = null;              // currently-playing clip, to stop overlap

  (function loadManifest() {
    if (typeof fetch !== 'function') { manifest = {}; return; }
    fetch(`${CLIP_BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        manifest = {};
        if (j) for (const code of Object.keys(j)) manifest[code] = new Set(j[code]);
      })
      .catch(() => { manifest = {}; });
  })();

  function hasClip(id, code) {
    // Before the manifest loads we optimistically assume the clip exists (the
    // game only asks for interactive words, which are all recorded).
    if (manifest === null) return true;
    return !!(manifest[code] && manifest[code].has(id));
  }

  // Play the clip for `id`/`code`. `onFail` runs if the audio can't load/play,
  // so the caller can fall back to Web Speech. Returns true if playback started.
  function playClip(id, code, onFail) {
    if (typeof Audio !== 'function') return false;
    const url = `${CLIP_BASE}/${code}/${id}.mp3`;
    let a = clipCache.get(url);
    if (!a) {
      a = new Audio(url);
      a.preload = 'auto';
      clipCache.set(url, a);
    }
    try {
      if (playing && playing !== a) { playing.pause(); playing.currentTime = 0; }
      a.onerror = () => { clipCache.delete(url); if (onFail) onFail(); };
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { if (onFail) onFail(); });
      playing = a;
      return true;
    } catch (e) {
      if (onFail) onFail();
      return false;
    }
  }

  // Pronounce object `id` in language `code`. Prefers the bundled clip (uniform,
  // device-independent); falls back to Web Speech (`text`/`bcp47`) when there's
  // no clip. Returns true if we produced (or expect to produce) audio, false if
  // nothing was available so the caller can surface the written-word note.
  function pronounce(id, code, text, bcp47) {
    if (hasClip(id, code) && playClip(id, code, () => speak(text, bcp47))) return true;
    return speak(text, bcp47);
  }

  return { supported, speak, hasVoice, voiceFor, pronounce, hasClip };
})();
