/*
 * Word Nook vocabulary + scene — the learnable languages and the isometric
 * living room.
 *
 * This is pure data plus tiny lookup helpers. Objects live on a logical floor
 * plane (x runs toward screen-right, y toward screen-left); game.js projects
 * them into the isometric "diorama" view. Coordinates are floor units within
 * FLOOR_W x FLOOR_H (see game.js). `z` is the extruded height, `base` lifts an
 * item onto a surface (e.g. a mug on the counter). `solid` blocks the avatar;
 * `decor` items are pure scenery (not spoken, not counted, no sparkles).
 *
 * Adding a word (or a whole new object) is a one-entry change here.
 */
window.Vocab = (() => {
  'use strict';

  // Order matters — this drives the language switch on the menu.
  const LANGS = [
    { code: 'en', label: 'English',    flag: '🇬🇧', bcp47: 'en-US' },
    { code: 'tr', label: 'Türkçe',     flag: '🇹🇷', bcp47: 'tr-TR' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱', bcp47: 'nl-NL' },
    { code: 'ja', label: '日本語',      flag: '🇯🇵', bcp47: 'ja-JP' },
  ];

  const LANG_BY_CODE = Object.fromEntries(LANGS.map((l) => [l.code, l]));

  const OBJECTS = [
    // ---- Structure / floor ------------------------------------------------
    {
      id: 'rug', kind: 'rug', x: 110, y: 150, w: 250, h: 210, z: 0, solid: false,
      color: '#3f8f86', gloss: 'rug',
      words: { en: 'rug', tr: 'halı', nl: 'tapijt', ja: 'じゅうたん' }, romaji: 'jūtan',
    },
    {
      id: 'window', kind: 'window', wall: 'left', x: 0, y: 120, w: 8, h: 150, z: 150, solid: false,
      color: '#f6c877', gloss: 'window',
      words: { en: 'window', tr: 'pencere', nl: 'raam', ja: '窓' }, romaji: 'mado',
    },
    {
      id: 'door', kind: 'door', wall: 'right', x: 55, y: 0, w: 80, h: 8, z: 150, solid: false,
      color: '#a5764f', gloss: 'door',
      words: { en: 'door', tr: 'kapı', nl: 'deur', ja: 'ドア' }, romaji: 'doa',
    },

    // ---- Coffee corner (counter along the right wall) ---------------------
    {
      id: 'counter', kind: 'counter', x: 290, y: 6, w: 260, h: 72, z: 92, solid: true, decor: true,
      color: '#b98a5e',
    },
    {
      id: 'machine', kind: 'machine', x: 320, y: 16, w: 62, h: 50, z: 74, base: 92, solid: false,
      color: '#6d7178', gloss: 'coffee machine',
      words: { en: 'coffee machine', tr: 'kahve makinesi', nl: 'koffiezetapparaat', ja: 'コーヒーメーカー' }, romaji: 'kōhī mēkā',
    },
    {
      id: 'mug', kind: 'mug', x: 410, y: 26, w: 34, h: 34, z: 34, base: 92, solid: false,
      color: '#f3efe6', gloss: 'mug',
      words: { en: 'cup', tr: 'fincan', nl: 'kopje', ja: 'カップ' }, romaji: 'kappu',
    },
    {
      id: 'sugar', kind: 'sugar', x: 462, y: 24, w: 30, h: 34, z: 42, base: 92, solid: false,
      color: '#f7f3ea', gloss: 'sugar jar',
      words: { en: 'sugar', tr: 'şeker', nl: 'suiker', ja: '砂糖' }, romaji: 'satō',
    },
    {
      id: 'milk', kind: 'milk', x: 506, y: 20, w: 30, h: 38, z: 56, base: 92, solid: false,
      color: '#fbfaf6', gloss: 'milk carton',
      words: { en: 'milk', tr: 'süt', nl: 'melk', ja: '牛乳' }, romaji: 'gyūnyū',
    },

    // ---- Sofa area --------------------------------------------------------
    {
      id: 'bookshelf', kind: 'bookshelf', x: 8, y: 300, w: 60, h: 140, z: 175, solid: true,
      color: '#9c6b45', gloss: 'bookshelf',
      words: { en: 'bookshelf', tr: 'kitaplık', nl: 'boekenkast', ja: '本棚' }, romaji: 'hondana',
    },
    {
      id: 'sofa', kind: 'sofa', x: 150, y: 120, w: 185, h: 92, z: 78, solid: true,
      color: '#d98b5f', gloss: 'sofa',
      words: { en: 'sofa', tr: 'kanepe', nl: 'bank', ja: 'ソファ' }, romaji: 'sofa',
    },
    {
      // The friendly NPC, seated on the sofa reading. Interacting is a greeting.
      // Sits on the front of the seat; depthBias keeps it drawn over the sofa.
      id: 'person', kind: 'person', x: 210, y: 168, w: 46, h: 40, z: 0, base: 40, depthBias: 80, solid: false,
      color: '#7fae83', gloss: 'hello (greeting)',
      words: { en: 'hello', tr: 'merhaba', nl: 'hallo', ja: 'こんにちは' }, romaji: 'konnichiwa',
    },
    {
      id: 'table', kind: 'table', x: 170, y: 250, w: 120, h: 82, z: 44, solid: true,
      color: '#b07d4e', gloss: 'coffee table',
      words: { en: 'coffee table', tr: 'sehpa', nl: 'salontafel', ja: 'ローテーブル' }, romaji: 'rōtēburu',
    },
    {
      id: 'coffee', kind: 'coffee', x: 205, y: 276, w: 30, h: 30, z: 30, base: 44, solid: false,
      color: '#efe7da', gloss: 'coffee',
      words: { en: 'coffee', tr: 'kahve', nl: 'koffie', ja: 'コーヒー' }, romaji: 'kōhī',
    },
    {
      id: 'lamp', kind: 'lamp', x: 366, y: 244, w: 30, h: 30, z: 158, solid: true,
      color: '#caa15c', gloss: 'lamp',
      words: { en: 'lamp', tr: 'lamba', nl: 'lamp', ja: 'ランプ' }, romaji: 'ranpu',
    },

    // ---- Corners: cat + plants -------------------------------------------
    {
      id: 'cat', kind: 'cat', x: 100, y: 398, w: 74, h: 58, z: 0, solid: true,
      color: '#e8933f', gloss: 'cat (sleeping)',
      words: { en: 'cat', tr: 'kedi', nl: 'kat', ja: '猫' }, romaji: 'neko',
    },
    {
      id: 'plant', kind: 'plant', x: 34, y: 40, w: 54, h: 54, z: 118, solid: true,
      color: '#5f9a52', gloss: 'plant',
      words: { en: 'plant', tr: 'bitki', nl: 'plant', ja: '植物' }, romaji: 'shokubutsu',
    },
    // Decorative extra greenery — sets the scene, not a vocab word.
    {
      id: 'plant2', kind: 'plant', x: 486, y: 430, w: 48, h: 48, z: 96, solid: true, decor: true,
      color: '#6ea85d',
    },
  ];

  const BY_ID = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));

  // Objects you can actually hear/collect (everything the scene counts).
  const INTERACTIVE = OBJECTS.filter((o) => !o.decor);

  function lang(code) { return LANG_BY_CODE[code] || LANG_BY_CODE.en; }

  function word(id, code) {
    const o = BY_ID[id];
    if (!o || !o.words) return '';
    return o.words[code] || o.words.en || '';
  }
  function romaji(id) { const o = BY_ID[id]; return (o && o.romaji) || ''; }
  function gloss(id) { const o = BY_ID[id]; return (o && o.gloss) || ''; }

  return {
    LANGS, OBJECTS, INTERACTIVE,
    lang, word, romaji, gloss,
    byId: (id) => BY_ID[id],
    total: INTERACTIVE.length,
  };
})();
