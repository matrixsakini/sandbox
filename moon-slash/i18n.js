/*
 * Moon Slash i18n — string tables and language switching.
 * Note: attack names ("Moon Tiara Action!", …) and "Neo Queen Serenity"
 * are deliberately untranslated in every language.
 */
window.I18N = (() => {
  'use strict';

  const STORAGE_KEY = 'moonslash-lang';

  const dicts = {
    en: {
      tagline: 'Crystal Tokyo has fallen into shadow.',
      instructions: 'Swipe to cut through the darkness before it falls.<br>Chain slices without a miss — every unbroken combo<br>restores light to the kingdom.',
      startBtn: 'Begin ✦ 30 seconds',
      hint: 'mouse or touch · slice fast, miss nothing',
      scoreLabel: 'score',
      comboLabel: 'combo',
      tripleSlice: '✦ triple slice +50',
      darknessSpreads: 'the darkness spreads…',
      comboLost: 'combo lost',
      comboSub: 'combo ×{n}',
      queenSub: 'crystal tokyo shines eternal',
      rankQueenTitle: 'Neo Queen Serenity',
      rankQueenFlavor: 'Crystal Tokyo shines eternal. The darkness is no more.',
      rankPrincessTitle: 'Princess Serenity',
      rankPrincessFlavor: 'Dawn breaks over the crystal spires. So close to salvation.',
      rankSuperTitle: 'Super Sailor Moon',
      rankSuperFlavor: 'The shadows retreat — the palace glimmers with hope.',
      rankGuardianTitle: 'Sailor Guardian',
      rankGuardianFlavor: 'A few candles against the night. Keep fighting.',
      rankSleepTitle: 'Moonlight Sleeps…',
      rankSleepFlavor: 'The darkness held this time. Crystal Tokyo awaits its queen.',
      statScore: 'score',
      statCombo: 'best combo',
      statLight: 'radiance',
      statSliced: 'shadows slain',
      retryBtn: 'Slice again ☾',
      modePrismDesc: 'play the full 30 seconds',
      modeEternalDesc: 'one miss and the light is lost',
      eternalDefeatTitle: 'The Light Falters…',
      eternalDefeatFlavor: 'A single shadow slipped through. Eternal demands perfection.',
    },
    tr: {
      tagline: 'Kristal Tokyo karanlığa gömüldü.',
      instructions: 'Karanlık yere düşmeden önce kaydırarak kes.<br>Hiç kaçırmadan kesmeye devam et — kesintisiz her kombo<br>krallığa ışığı geri getirir.',
      startBtn: 'Başla ✦ 30 saniye',
      hint: 'fare veya dokunmatik · hızlı kes, hiçbirini kaçırma',
      scoreLabel: 'skor',
      comboLabel: 'kombo',
      tripleSlice: '✦ üçlü kesiş +50',
      darknessSpreads: 'karanlık yayılıyor…',
      comboLost: 'kombo bozuldu',
      comboSub: 'kombo ×{n}',
      queenSub: 'kristal tokyo sonsuza dek parlıyor',
      rankQueenTitle: 'Neo Queen Serenity',
      rankQueenFlavor: 'Kristal Tokyo sonsuza dek parlıyor. Karanlık artık yok.',
      rankPrincessTitle: 'Prenses Serenity',
      rankPrincessFlavor: 'Kristal kulelerin üzerinde şafak söküyor. Kurtuluşa çok az kaldı.',
      rankSuperTitle: 'Süper Ay Savaşçısı',
      rankSuperFlavor: 'Gölgeler geri çekiliyor — saray umutla parıldıyor.',
      rankGuardianTitle: 'Ay Muhafızı',
      rankGuardianFlavor: 'Geceye karşı birkaç mum. Savaşmaya devam et.',
      rankSleepTitle: 'Ay Işığı Uyuyor…',
      rankSleepFlavor: 'Bu sefer karanlık kazandı. Kristal Tokyo kraliçesini bekliyor.',
      statScore: 'skor',
      statCombo: 'en iyi kombo',
      statLight: 'parlaklık',
      statSliced: 'yok edilen gölgeler',
      retryBtn: 'Yeniden kes ☾',
      modePrismDesc: '30 saniyenin tamamını oyna',
      modeEternalDesc: 'tek kaçırma ve ışık kaybolur',
      eternalDefeatTitle: 'Işık Sönüyor…',
      eternalDefeatFlavor: 'Tek bir gölge kaçtı. Eternal kusursuzluk ister.',
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
