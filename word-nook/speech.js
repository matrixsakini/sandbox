/*
 * Word Nook speech — pronounce a word in the target language.
 *
 * Uses the browser's built-in Web Speech API (window.speechSynthesis): no audio
 * files, no dependencies. Voice availability varies by OS/browser (a Japanese or
 * Turkish voice may simply not be installed), so every call is guarded and
 * hasVoice() lets the game show a one-time fallback note while still displaying
 * the written word.
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

  return { supported, speak, hasVoice, voiceFor };
})();
