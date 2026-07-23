/*
 * Word Nook — phase 1: explore.
 *
 * A cute top-down living room. You move a little avatar around, walk up to (or
 * tap) objects, and hear each one's name in the language you're learning. Every
 * word is collected via WordList for later review. One IIFE, no dependencies:
 * canvas + requestAnimationFrame for the room, Web Speech (via Speech) for the
 * pronunciation, WebAudio for the soft chime.
 */
(() => {
  'use strict';

  // ---- Constants ----------------------------------------------------------
  const ROOM_W = 800;   // room is a fixed logical size; the view scales to fit
  const ROOM_H = 560;
  const WALL = 26;      // wall thickness inside the room bounds
  const AV_R = 16;      // avatar radius
  const SPEED = 3.0;    // room units per frame
  const INTERACT_R = 46; // how close counts as "at" an object

  const LANG_KEY = 'wordnook-lang';
  const MUTE_KEY = 'wordnook-muted';

  // Objects the avatar can't walk through. Wall-mounted / flat items are not
  // solid so you can always reach them.
  const SOLID = new Set(['sofa', 'table', 'machine', 'cat', 'plant', 'lamp', 'person']);

  // ---- DOM handles (cached once, moon-games style) ------------------------
  const ui = {
    canvas: document.getElementById('game'),
    hud: document.getElementById('hud'),
    langFlag: document.getElementById('lang-flag'),
    langName: document.getElementById('lang-name'),
    countNum: document.getElementById('count-num'),
    wordsBtn: document.getElementById('words-btn'),
    muteBtn: document.getElementById('mute-btn'),
    label: document.getElementById('label'),
    labelPlay: document.getElementById('label-play'),
    labelWord: document.getElementById('label-word'),
    labelRomaji: document.getElementById('label-romaji'),
    labelGloss: document.getElementById('label-gloss'),
    voiceNote: document.getElementById('voice-note'),
    menu: document.getElementById('menu'),
    startBtn: document.getElementById('start-btn'),
    words: document.getElementById('words'),
    wordsList: document.getElementById('words-list'),
    wordsEmpty: document.getElementById('words-empty'),
    wordsBack: document.getElementById('words-back'),
    wordsClear: document.getElementById('words-clear'),
  };
  const ctx = ui.canvas.getContext('2d');

  // ---- State --------------------------------------------------------------
  const S = {
    lang: 'nl',
    running: false,
    dpr: 1,
    scale: 1, offX: 0, offY: 0, // room -> screen layout
    av: { x: 400, y: 430, faceX: 0, faceY: 1 },
    target: null,           // tap-to-walk destination in room units
    keys: new Set(),
    enteredId: null,        // object whose zone we're currently inside (edge trigger)
    lastReplay: null,       // { word, bcp47 } for the label replay button
    labelTimer: 0,
    muted: false,
    voiceNoted: new Set(),  // languages we've already warned about
    t: 0,                   // frame counter for idle animation
  };

  // ---- Persistence --------------------------------------------------------
  function loadPrefs() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && Vocab.LANGS.some((l) => l.code === saved)) S.lang = saved;
      else {
        const nav = (navigator.language || '').toLowerCase().slice(0, 2);
        S.lang = Vocab.LANGS.some((l) => l.code === nav) ? nav : 'nl';
      }
    } catch (e) { S.lang = 'nl'; }
    try { S.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }
  }
  function saveLang() { try { localStorage.setItem(LANG_KEY, S.lang); } catch (e) { /* ignore */ } }
  function saveMuted() { try { localStorage.setItem(MUTE_KEY, S.muted ? '1' : '0'); } catch (e) { /* ignore */ } }

  // ---- Audio (soft chime; speech is separate and never muted) -------------
  let audio = null;
  function ensureAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function chime() {
    if (S.muted || !audio) return;
    const now = audio.currentTime;
    [660, 990].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      o.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  }

  // ---- Layout / resize ----------------------------------------------------
  function resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    ui.canvas.width = Math.floor(cssW * S.dpr);
    ui.canvas.height = Math.floor(cssH * S.dpr);
    S.scale = Math.min(cssW / ROOM_W, cssH / ROOM_H) * 0.94;
    S.offX = (cssW - ROOM_W * S.scale) / 2;
    S.offY = (cssH - ROOM_H * S.scale) / 2;
  }

  function screenToRoom(clientX, clientY) {
    const r = ui.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - S.offX) / S.scale,
      y: (clientY - r.top - S.offY) / S.scale,
    };
  }

  // ---- Geometry helpers ---------------------------------------------------
  function rectDist(px, py, o) {
    const dx = Math.max(o.x - px, 0, px - (o.x + o.w));
    const dy = Math.max(o.y - py, 0, py - (o.y + o.h));
    return Math.hypot(dx, dy);
  }
  function objectAt(p) {
    // topmost object whose (slightly padded) rect contains the point
    for (let i = Vocab.OBJECTS.length - 1; i >= 0; i--) {
      const o = Vocab.OBJECTS[i];
      const pad = 8;
      if (p.x >= o.x - pad && p.x <= o.x + o.w + pad && p.y >= o.y - pad && p.y <= o.y + o.h + pad) return o;
    }
    return null;
  }
  function collides(px, py) {
    for (const o of Vocab.OBJECTS) {
      if (!SOLID.has(o.id)) continue;
      if (rectDist(px, py, o) < AV_R - 2) return true;
    }
    return false;
  }
  function nearest() {
    let best = null, bestD = Infinity;
    for (const o of Vocab.OBJECTS) {
      const d = rectDist(S.av.x, S.av.y, o);
      if (d < bestD) { bestD = d; best = o; }
    }
    return bestD <= INTERACT_R ? best : null;
  }

  // ---- Interaction --------------------------------------------------------
  function interact(o) {
    if (!o) return;
    ensureAudio();
    const info = Vocab.lang(S.lang);
    const word = Vocab.word(o.id, S.lang);
    const usedVoice = Speech.speak(word, info.bcp47);
    WordList.add(S.lang, { id: o.id, word, gloss: Vocab.gloss(o.id), romaji: Vocab.romaji(o.id) });
    S.lastReplay = { word, bcp47: info.bcp47 };
    updateCount();
    showLabel(word, o.id);
    chime();
    if (!usedVoice) noteMissingVoice();
  }

  function showLabel(word, id) {
    ui.labelWord.textContent = word;
    ui.labelGloss.textContent = Vocab.gloss(id);
    const rom = Vocab.romaji(id);
    if (S.lang === 'ja' && rom) {
      ui.labelRomaji.textContent = rom;
      ui.labelRomaji.classList.remove('hidden');
    } else {
      ui.labelRomaji.classList.add('hidden');
    }
    ui.label.classList.remove('hidden');
    // restart the pop animation
    ui.label.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    ui.label.offsetHeight;
    ui.label.style.animation = '';
    S.labelTimer = 210; // ~3.5s at 60fps
  }

  function noteMissingVoice() {
    if (S.voiceNoted.has(S.lang)) return;
    S.voiceNoted.add(S.lang);
    const info = Vocab.lang(S.lang);
    ui.voiceNote.textContent = `No ${info.label} voice is installed on this device — you'll still see each word written out.`;
    ui.voiceNote.classList.remove('hidden');
    setTimeout(() => ui.voiceNote.classList.add('hidden'), 5000);
  }

  function updateCount() { ui.countNum.textContent = String(WordList.count(S.lang)); }

  function setLang(code) {
    if (!Vocab.LANGS.some((l) => l.code === code)) return;
    S.lang = code;
    saveLang();
    const info = Vocab.lang(code);
    ui.langFlag.textContent = info.flag;
    ui.langName.textContent = info.label;
    updateCount();
    document.querySelectorAll('[data-learn]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-learn') === code);
    });
  }

  // ---- Update loop --------------------------------------------------------
  function step() {
    S.t++;
    const av = S.av;

    // Movement: keyboard overrides tap-to-walk.
    let vx = 0, vy = 0;
    const k = S.keys;
    if (k.has('ArrowLeft') || k.has('a')) vx -= 1;
    if (k.has('ArrowRight') || k.has('d')) vx += 1;
    if (k.has('ArrowUp') || k.has('w')) vy -= 1;
    if (k.has('ArrowDown') || k.has('s')) vy += 1;

    if (vx || vy) {
      S.target = null;
      const m = Math.hypot(vx, vy) || 1;
      vx = (vx / m) * SPEED; vy = (vy / m) * SPEED;
    } else if (S.target) {
      const dx = S.target.x - av.x, dy = S.target.y - av.y;
      const d = Math.hypot(dx, dy);
      if (d < SPEED) { S.target = null; }
      else { vx = (dx / d) * SPEED; vy = (dy / d) * SPEED; }
    }

    if (vx || vy) {
      av.faceX = Math.sign(vx) || av.faceX;
      av.faceY = Math.sign(vy) || 0;
      // Axis-separated movement so we slide along furniture instead of sticking.
      const minX = WALL + AV_R, maxX = ROOM_W - WALL - AV_R;
      const minY = WALL + AV_R, maxY = ROOM_H - WALL - AV_R;
      let nx = Math.max(minX, Math.min(maxX, av.x + vx));
      if (!collides(nx, av.y)) av.x = nx;
      let ny = Math.max(minY, Math.min(maxY, av.y + vy));
      if (!collides(av.x, ny)) av.y = ny;
    }

    // Edge-triggered proximity: entering a new object's zone speaks it once.
    const near = nearest();
    const nearId = near ? near.id : null;
    if (nearId !== S.enteredId) {
      S.enteredId = nearId;
      if (near) interact(near);
    }

    if (S.labelTimer > 0 && --S.labelTimer === 0) ui.label.classList.add('hidden');
  }

  // ---- Rendering ----------------------------------------------------------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }
  function emoji(ch, cx, cy, size) {
    ctx.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
  }

  function drawRoom() {
    // Floor
    ctx.fillStyle = '#efd9b8';
    rr(0, 0, ROOM_W, ROOM_H, 22); ctx.fill();
    // Floorboards
    ctx.strokeStyle = 'rgba(180,140,100,0.35)';
    ctx.lineWidth = 2;
    for (let x = 60; x < ROOM_W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, WALL); ctx.lineTo(x, ROOM_H - WALL); ctx.stroke();
    }
    // Walls
    ctx.fillStyle = '#c8a882';
    ctx.fillRect(0, 0, ROOM_W, WALL);
    ctx.fillRect(0, 0, WALL, ROOM_H);
    ctx.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);
    ctx.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
  }

  function drawObject(o, highlighted) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    ctx.save();

    if (highlighted) {
      const glow = 0.5 + 0.5 * Math.sin(S.t * 0.12);
      ctx.shadowColor = `rgba(224,138,106,${0.5 + 0.4 * glow})`;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#e08a6a';
      ctx.lineWidth = 3;
      rr(o.x - 5, o.y - 5, o.w + 10, o.h + 10, 12); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    switch (o.kind) {
      case 'rug': {
        ctx.fillStyle = '#d98c74';
        rr(o.x, o.y, o.w, o.h, 20); ctx.fill();
        ctx.fillStyle = '#c6765d';
        rr(o.x + 12, o.y + 12, o.w - 24, o.h - 24, 14); ctx.fill();
        ctx.fillStyle = '#e9b7a3';
        rr(o.x + 26, o.y + 26, o.w - 52, o.h - 52, 10); ctx.fill();
        break;
      }
      case 'window': {
        ctx.fillStyle = '#7fb7d8';
        rr(o.x, o.y, o.w, o.h, 4); ctx.fill();
        ctx.fillStyle = '#a9d3ea';
        rr(o.x + 3, o.y + 3, o.w / 2 - 4, o.h - 6, 3); ctx.fill();
        ctx.strokeStyle = '#8a6a55'; ctx.lineWidth = 3;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        break;
      }
      case 'door': {
        ctx.fillStyle = '#9c6b4a';
        rr(o.x, o.y, o.w, o.h, 4); ctx.fill();
        ctx.fillStyle = '#f0d060';
        ctx.beginPath(); ctx.arc(o.x + o.w - 7, cy, 3.5, 0, 7); ctx.fill();
        break;
      }
      case 'sofa': {
        ctx.fillStyle = '#b06a86';
        rr(o.x, o.y + 14, o.w, o.h - 14, 16); ctx.fill();       // seat
        rr(o.x, o.y, o.w, 30, 14); ctx.fill();                   // back
        ctx.fillStyle = '#c98aa4';
        for (let i = 0; i < 2; i++) rr(o.x + 16 + i * (o.w / 2 - 4), o.y + 20, o.w / 2 - 28, o.h - 34, 12), ctx.fill();
        break;
      }
      case 'table': {
        ctx.fillStyle = '#b07d4e';
        rr(o.x, o.y, o.w, o.h, 12); ctx.fill();
        ctx.fillStyle = '#c9975f';
        rr(o.x + 8, o.y + 8, o.w - 16, o.h - 16, 8); ctx.fill();
        break;
      }
      case 'machine': {
        ctx.fillStyle = '#5b5b66';
        rr(o.x, o.y, o.w, o.h, 8); ctx.fill();
        ctx.fillStyle = '#3c3c44';
        rr(o.x + 12, o.y + o.h - 24, o.w - 24, 16, 5); ctx.fill();
        emoji('☕', cx, o.y + 22, 26);
        break;
      }
      case 'cup': emoji('🍵', cx, cy, Math.min(o.w, o.h)); break;
      case 'coffee': emoji('☕', cx, cy, Math.min(o.w, o.h)); break;
      case 'plant': {
        ctx.fillStyle = '#b5754a';
        rr(o.x + o.w * 0.2, o.y + o.h * 0.55, o.w * 0.6, o.h * 0.45, 6); ctx.fill();
        emoji('🌿', cx, o.y + o.h * 0.32, o.w); break;
      }
      case 'lamp': {
        ctx.strokeStyle = '#8a6a55'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, o.y + 26); ctx.lineTo(cx, o.y + o.h); ctx.stroke();
        ctx.fillStyle = 'rgba(255,224,140,0.55)';
        ctx.beginPath(); ctx.arc(cx, o.y + 20, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2d98a';
        ctx.beginPath();
        ctx.moveTo(cx - 18, o.y + 26); ctx.lineTo(cx + 18, o.y + 26);
        ctx.lineTo(cx + 12, o.y + 4); ctx.lineTo(cx - 12, o.y + 4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'cat': drawCat(o, cx, cy); break;
      case 'person': drawPerson(o, cx, cy); break;
      default: emoji(o.emoji || '❓', cx, cy, Math.min(o.w, o.h));
    }
    ctx.restore();
  }

  function drawCat(o, cx, cy) {
    // Curled sleeping cat.
    ctx.fillStyle = '#e0a15a';
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, o.w / 2, o.h / 2.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9863f';
    ctx.beginPath(); ctx.ellipse(cx - o.w * 0.28, cy, 16, 14, 0, 0, 7); ctx.fill(); // head
    // ears
    ctx.beginPath();
    ctx.moveTo(cx - o.w * 0.4, cy - 10); ctx.lineTo(cx - o.w * 0.34, cy - 20); ctx.lineTo(cx - o.w * 0.26, cy - 12); ctx.fill();
    // sleepy eye
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - o.w * 0.3, cy - 1, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // tail curling with the breathing bob
    const wag = Math.sin(S.t * 0.05) * 4;
    ctx.strokeStyle = '#e0a15a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + o.w * 0.35, cy + 8);
    ctx.quadraticCurveTo(cx + o.w * 0.55, cy - 6 + wag, cx + o.w * 0.35, cy - 16 + wag);
    ctx.stroke();
    // zzz
    ctx.fillStyle = 'rgba(90,60,40,0.7)';
    const zb = (Math.sin(S.t * 0.06) + 1) * 3;
    ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('z', cx + o.w * 0.1, o.y - 4 - zb);
    ctx.font = '18px sans-serif';
    ctx.fillText('z', cx + o.w * 0.22, o.y - 14 - zb);
  }

  function drawPerson(o, cx, cy) {
    // A friendly standing character.
    ctx.fillStyle = '#7fae83';
    rr(o.x + o.w * 0.15, o.y + o.h * 0.4, o.w * 0.7, o.h * 0.6, 12); ctx.fill(); // body
    ctx.fillStyle = '#f0c9a0';
    ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.28, o.w * 0.32, 0, 7); ctx.fill(); // head
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.16, o.w * 0.34, Math.PI, 2 * Math.PI); ctx.fill(); // hair
    ctx.fillStyle = '#3d2b22';
    ctx.beginPath(); ctx.arc(cx - 6, o.y + o.h * 0.28, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, o.y + o.h * 0.28, 2.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c06b4d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.32, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  function drawAvatar() {
    const av = S.av;
    // shadow
    ctx.fillStyle = 'rgba(90,60,40,0.18)';
    ctx.beginPath(); ctx.ellipse(av.x, av.y + AV_R - 2, AV_R, AV_R * 0.4, 0, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = '#e08a6a';
    ctx.beginPath(); ctx.arc(av.x, av.y, AV_R, 0, 7); ctx.fill();
    // cheeks
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(av.x - 6, av.y + 4, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(av.x + 6, av.y + 4, 3, 0, 7); ctx.fill();
    // eyes look toward facing direction
    const ex = (av.faceX || 0) * 3, ey = (av.faceY || 0) * 2;
    ctx.fillStyle = '#3d2b22';
    ctx.beginPath(); ctx.arc(av.x - 5 + ex, av.y - 2 + ey, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(av.x + 5 + ex, av.y - 2 + ey, 2.6, 0, 7); ctx.fill();
    // little tuft
    ctx.strokeStyle = '#c06b4d'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(av.x, av.y - AV_R); ctx.lineTo(av.x, av.y - AV_R - 5); ctx.stroke();
  }

  function frame() {
    if (S.running) step();
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    ctx.save();
    ctx.translate(S.offX, S.offY);
    ctx.scale(S.scale, S.scale);

    drawRoom();
    const near = S.running ? nearest() : null;
    // draw in array order; rug first-ish is fine since it's placed early
    for (const o of Vocab.OBJECTS) drawObject(o, near && near.id === o.id);
    if (S.running) drawAvatar();

    ctx.restore();
    requestAnimationFrame(frame);
  }

  // ---- Input --------------------------------------------------------------
  function onPointerDown(e) {
    if (!S.running) return;
    ensureAudio();
    const p = screenToRoom(e.clientX, e.clientY);
    const hit = objectAt(p);
    if (hit) {
      S.target = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
      if (rectDist(S.av.x, S.av.y, hit) <= INTERACT_R) {
        S.enteredId = hit.id; // prevent the frame's edge-trigger from doubling
        interact(hit);
      }
    } else {
      S.target = { x: p.x, y: p.y };
    }
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', onPointerDown);
    // Guard the browser's edge swipe-back gesture (moon-games hygiene).
    ui.canvas.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key)) {
        S.keys.add(key); e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      S.keys.delete(key);
    });
    window.addEventListener('resize', resize);

    ui.labelPlay.addEventListener('click', () => {
      if (S.lastReplay) Speech.speak(S.lastReplay.word, S.lastReplay.bcp47);
    });

    ui.muteBtn.addEventListener('click', () => {
      S.muted = !S.muted;
      ui.muteBtn.classList.toggle('muted', S.muted);
      ui.muteBtn.textContent = S.muted ? '♪̶' : '♪';
      saveMuted();
    });

    ui.wordsBtn.addEventListener('click', openWords);
    ui.wordsBack.addEventListener('click', () => ui.words.classList.add('hidden'));
    ui.wordsClear.addEventListener('click', () => {
      WordList.clear(S.lang);
      updateCount();
      openWords();
    });

    document.querySelectorAll('[data-learn]').forEach((b) => {
      b.addEventListener('click', () => setLang(b.getAttribute('data-learn')));
    });

    ui.startBtn.addEventListener('click', start);
  }

  // ---- Words review overlay ----------------------------------------------
  function openWords() {
    const list = WordList.all(S.lang);
    ui.wordsList.innerHTML = '';
    ui.wordsEmpty.classList.toggle('hidden', list.length > 0);
    const info = Vocab.lang(S.lang);
    for (const e of list) {
      const row = document.createElement('div');
      row.className = 'word-row';

      const play = document.createElement('button');
      play.className = 'wr-play';
      play.textContent = '▶';
      play.title = 'hear it again';
      play.addEventListener('click', () => Speech.speak(e.word, info.bcp47));

      const main = document.createElement('div');
      main.className = 'wr-main';
      const rom = (S.lang === 'ja' && e.romaji) ? `<span class="wr-romaji">${e.romaji}</span>` : '';
      main.innerHTML = `<span class="wr-word">${escapeHtml(e.word)}</span>${rom}<span class="wr-gloss">${escapeHtml(e.gloss)}</span>`;

      const count = document.createElement('span');
      count.className = 'wr-count';
      count.textContent = `×${e.count}`;

      row.append(play, main, count);
      ui.wordsList.appendChild(row);
    }
    ui.words.classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Boot ---------------------------------------------------------------
  function start() {
    ensureAudio();
    ui.menu.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    S.running = true;
    S.enteredId = null;
  }

  function init() {
    loadPrefs();
    resize();
    setLang(S.lang);
    ui.muteBtn.classList.toggle('muted', S.muted);
    ui.muteBtn.textContent = S.muted ? '♪̶' : '♪';
    bindInput();
    requestAnimationFrame(frame);

    // Phase 2 hook: a "mystery" mode would branch from here — e.g. hide a clue
    // object, gate progress on collecting the right words, and let the NPC give
    // hints. Left unimplemented for the explore POC.
  }

  init();
})();
