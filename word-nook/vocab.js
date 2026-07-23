/*
 * Word Nook vocabulary — the learnable languages and the room's objects.
 *
 * This is pure data plus tiny lookup helpers. Everything the player can hear or
 * collect lives here, so adding a word (or, later, a whole new room) is a
 * one-entry change. UI chrome stays in English; only these `words` are spoken
 * and collected in the target language.
 */
window.Vocab = (() => {
  'use strict';

  // Order matters — this drives the language switch on the menu.
  const LANGS = [
    { code: 'en', label: 'English',  flag: '🇬🇧', bcp47: 'en-US' },
    { code: 'tr', label: 'Türkçe',   flag: '🇹🇷', bcp47: 'tr-TR' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱', bcp47: 'nl-NL' },
    { code: 'ja', label: '日本語',    flag: '🇯🇵', bcp47: 'ja-JP' },
  ];

  const LANG_BY_CODE = Object.fromEntries(LANGS.map((l) => [l.code, l]));

  // The living-room scene. Coordinates are in room units (see game.js ROOM_W /
  // ROOM_H); the room is drawn top-down. `kind` selects a procedural drawing.
  // `romaji` is the reading shown for Japanese; `gloss` is the English meaning
  // shown alongside the target word in the collected list.
  const OBJECTS = [
    {
      id: 'sofa', kind: 'sofa', x: 150, y: 140, w: 240, h: 90,
      emoji: '🛋️', gloss: 'sofa',
      words: { en: 'sofa', tr: 'kanepe', nl: 'bank', ja: 'ソファ' }, romaji: 'sofa',
    },
    {
      id: 'table', kind: 'table', x: 200, y: 270, w: 150, h: 80,
      emoji: '🪵', gloss: 'coffee table',
      words: { en: 'coffee table', tr: 'sehpa', nl: 'salontafel', ja: 'ローテーブル' }, romaji: 'rōtēburu',
    },
    {
      id: 'machine', kind: 'machine', x: 620, y: 120, w: 70, h: 80,
      emoji: '☕', gloss: 'coffee machine',
      words: { en: 'coffee machine', tr: 'kahve makinesi', nl: 'koffiezetapparaat', ja: 'コーヒーメーカー' }, romaji: 'kōhī mēkā',
    },
    {
      id: 'cup', kind: 'cup', x: 720, y: 150, w: 42, h: 42,
      emoji: '🍵', gloss: 'cup',
      words: { en: 'cup', tr: 'fincan', nl: 'kopje', ja: 'カップ' }, romaji: 'kappu',
    },
    {
      id: 'coffee', kind: 'coffee', x: 630, y: 210, w: 44, h: 44,
      emoji: '☕', gloss: 'coffee',
      words: { en: 'coffee', tr: 'kahve', nl: 'koffie', ja: 'コーヒー' }, romaji: 'kōhī',
    },
    {
      id: 'cat', kind: 'cat', x: 640, y: 470, w: 90, h: 70,
      emoji: '🐱', gloss: 'cat (sleeping)',
      words: { en: 'cat', tr: 'kedi', nl: 'kat', ja: '猫' }, romaji: 'neko',
    },
    {
      id: 'plant', kind: 'plant', x: 90, y: 470, w: 60, h: 80,
      emoji: '🪴', gloss: 'plant',
      words: { en: 'plant', tr: 'bitki', nl: 'plant', ja: '植物' }, romaji: 'shokubutsu',
    },
    {
      id: 'lamp', kind: 'lamp', x: 430, y: 130, w: 46, h: 90,
      emoji: '💡', gloss: 'lamp',
      words: { en: 'lamp', tr: 'lamba', nl: 'lamp', ja: 'ランプ' }, romaji: 'ranpu',
    },
    {
      id: 'window', kind: 'window', x: 250, y: 40, w: 180, h: 26,
      emoji: '🪟', gloss: 'window',
      words: { en: 'window', tr: 'pencere', nl: 'raam', ja: '窓' }, romaji: 'mado',
    },
    {
      id: 'rug', kind: 'rug', x: 210, y: 360, w: 260, h: 150,
      emoji: '🟫', gloss: 'rug',
      words: { en: 'rug', tr: 'halı', nl: 'tapijt', ja: 'じゅうたん' }, romaji: 'jūtan',
    },
    {
      id: 'door', kind: 'door', x: 40, y: 250, w: 26, h: 100,
      emoji: '🚪', gloss: 'door',
      words: { en: 'door', tr: 'kapı', nl: 'deur', ja: 'ドア' }, romaji: 'doa',
    },
    // The other person in the room. Interacting greets you rather than naming an
    // object, so the "word" is a greeting.
    {
      id: 'person', kind: 'person', x: 560, y: 300, w: 60, h: 90,
      emoji: '🧑', gloss: 'hello (greeting)',
      words: { en: 'hello', tr: 'merhaba', nl: 'hallo', ja: 'こんにちは' }, romaji: 'konnichiwa',
    },
  ];

  const BY_ID = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));

  function lang(code) {
    return LANG_BY_CODE[code] || LANG_BY_CODE.en;
  }

  // The spoken/written word for an object in the given language code.
  function word(id, code) {
    const o = BY_ID[id];
    if (!o) return '';
    return o.words[code] || o.words.en || '';
  }

  function romaji(id) {
    const o = BY_ID[id];
    return (o && o.romaji) || '';
  }

  function gloss(id) {
    const o = BY_ID[id];
    return (o && o.gloss) || '';
  }

  return { LANGS, OBJECTS, lang, word, romaji, gloss, byId: (id) => BY_ID[id] };
})();
