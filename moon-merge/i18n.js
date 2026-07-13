/*
 * Moon Merge i18n — string tables and language switching.
 * Note: transformation phrases ("Moon Crystal Power, Make Up!", …) and
 * "Neo Queen Serenity" are deliberately untranslated in every language.
 */
window.I18N = (() => {
  'use strict';

  const STORAGE_KEY = 'moonmerge-lang';

  const dicts = {
    en: {
      tagline: 'Forge the Silver Crystal from stardust.',
      instructions: 'Tap an empty cell to place your relic.<br>Three matching relics side by side merge into something greater.<br>Corner the wandering youma to seal them in dark crystal.',
      startBtn: 'Begin ✦',
      hint: 'tap to place · every move matters',
      scoreLabel: 'score',
      chainLabel: 'chain',
      nextLabel: 'next',
      pocketLabel: 'pocket',
      tierStardust: 'Stardust',
      tierMoonStone: 'Moon Stone',
      tierCrescent: 'Crescent Crystal',
      tierBrooch: 'Transformation Brooch',
      tierCrystalStar: 'Crystal Star',
      tierCosmicHeart: 'Cosmic Heart Compact',
      tierCrisisMoon: 'Crisis Moon Compact',
      tierEternal: 'Eternal Moon Article',
      tierSilverCrystal: 'Silver Crystal',
      youmaName: 'Youma',
      crystalName: 'Dark Crystal',
      chainSub: 'chain ×{n}',
      youmaSealed: '✦ youma sealed +300',
      crystalPurged: 'darkness purged +{n}',
      queenSub: 'the silver crystal shines eternal',
      rankQueenTitle: 'Neo Queen Serenity',
      rankQueenFlavor: 'The Silver Crystal is whole. Crystal Tokyo is reborn in light.',
      rankPrincessTitle: 'Princess Serenity',
      rankPrincessFlavor: 'The eternal light gathers — the crystal is within reach.',
      rankSuperTitle: 'Super Sailor Moon',
      rankSuperFlavor: 'Compacts gleam with cosmic power. Keep merging toward the light.',
      rankGuardianTitle: 'Sailor Guardian',
      rankGuardianFlavor: 'The first brooch answers your call. Your training has begun.',
      rankSleepTitle: 'Moonlight Sleeps…',
      rankSleepFlavor: 'Stardust slipped through your fingers. The moon awaits your return.',
      statScore: 'score',
      statTier: 'highest relic',
      statChain: 'best chain',
      statYouma: 'youma sealed',
      retryBtn: 'Merge again ☾',
      leaderboardTitle: 'Hall of Crystals',
      hsPrompt: 'Your relics earned a place in memory — enter your name.',
      hsPlaceholder: 'your name',
      hsSave: 'Enshrine ✦',
      colRank: '#',
      colPlayer: 'Guardian',
      colScore: 'Score',
      emptyBoard: 'No crystals recorded yet — be the first.',
      anonName: 'Nameless Guardian',
    },
    tr: {
      tagline: 'Yıldız tozundan Gümüş Kristal\'i yarat.',
      instructions: 'Boş bir kareye dokunarak emanetini yerleştir.<br>Yan yana üç eş emanet birleşip daha büyüğüne dönüşür.<br>Başıboş youmaları köşeye sıkıştırıp kara kristale hapset.',
      startBtn: 'Başla ✦',
      hint: 'dokunarak yerleştir · her hamle önemli',
      scoreLabel: 'skor',
      chainLabel: 'zincir',
      nextLabel: 'sıradaki',
      pocketLabel: 'cep',
      tierStardust: 'Yıldız Tozu',
      tierMoonStone: 'Ay Taşı',
      tierCrescent: 'Hilal Kristali',
      tierBrooch: 'Dönüşüm Broşu',
      tierCrystalStar: 'Kristal Yıldız',
      tierCosmicHeart: 'Kozmik Kalp Broşu',
      tierCrisisMoon: 'Kriz Ay Broşu',
      tierEternal: 'Ebedi Ay Asası',
      tierSilverCrystal: 'Gümüş Kristal',
      youmaName: 'Youma',
      crystalName: 'Kara Kristal',
      chainSub: 'zincir ×{n}',
      youmaSealed: '✦ youma mühürlendi +300',
      crystalPurged: 'karanlık arındı +{n}',
      queenSub: 'gümüş kristal sonsuza dek parlıyor',
      rankQueenTitle: 'Neo Queen Serenity',
      rankQueenFlavor: 'Gümüş Kristal tamamlandı. Kristal Tokyo ışıkla yeniden doğdu.',
      rankPrincessTitle: 'Prenses Serenity',
      rankPrincessFlavor: 'Ebedi ışık toplanıyor — kristale çok az kaldı.',
      rankSuperTitle: 'Süper Ay Savaşçısı',
      rankSuperFlavor: 'Broşlar kozmik güçle parlıyor. Işığa doğru birleştirmeye devam et.',
      rankGuardianTitle: 'Ay Muhafızı',
      rankGuardianFlavor: 'İlk broş çağrına yanıt verdi. Eğitimin başladı.',
      rankSleepTitle: 'Ay Işığı Uyuyor…',
      rankSleepFlavor: 'Yıldız tozu parmaklarının arasından kaydı. Ay dönüşünü bekliyor.',
      statScore: 'skor',
      statTier: 'en yüksek emanet',
      statChain: 'en iyi zincir',
      statYouma: 'mühürlenen youma',
      retryBtn: 'Yeniden birleştir ☾',
      leaderboardTitle: 'Kristal Salonu',
      hsPrompt: 'Emanetlerin hatırlanmayı hak etti — adını gir.',
      hsPlaceholder: 'adın',
      hsSave: 'Ölümsüzleştir ✦',
      colRank: '#',
      colPlayer: 'Muhafız',
      colScore: 'Skor',
      emptyBoard: 'Henüz kristal kaydı yok — ilk sen ol.',
      anonName: 'İsimsiz Muhafız',
    },
  };

  // Keys whose values contain markup and are applied via innerHTML.
  const HTML_KEYS = new Set(['instructions']);

  let lang = null;
  try { lang = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
  if (!dicts[lang]) {
    lang = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  }

  function t(key) {
    return dicts[lang][key] || dicts.en[key] || key;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (HTML_KEYS.has(key)) el.innerHTML = t(key);
      else el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function set(next) {
    if (!dicts[next]) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage unavailable */ }
    apply();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => set(btn.getAttribute('data-lang')));
    });
    apply();
  });

  return { t, set, get lang() { return lang; } };
})();
