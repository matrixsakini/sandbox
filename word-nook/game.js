/*
 * Word Nook — phase 1: explore.
 *
 * A cozy isometric living room ("cute 3D" diorama, drawn procedurally on a 2D
 * canvas — no assets, no dependencies). You move a little avatar around, walk up
 * to (or tap) objects, and hear each one's name in the language you're learning;
 * the word pops up as an in-world speech bubble and is collected via WordList.
 *
 * Objects live on a logical floor plane (x -> screen-right, y -> screen-left);
 * everything is projected to isometric screen space by toScreen(). Movement and
 * collision stay in floor coordinates. One IIFE: canvas + requestAnimationFrame
 * for the room, Web Speech (via Speech) for pronunciation, WebAudio for a chime.
 */
(() => {
  'use strict';

  // ---- World / projection -------------------------------------------------
  const FLOOR_W = 560;   // floor extent along x (screen-right depth axis)
  const FLOOR_H = 520;   // floor extent along y (screen-left depth axis)
  const WALL_H = 165;    // back-wall height
  const KX = 1.0, KY = 0.5, KZ = 0.92; // isometric factors (2:1)

  // Static world-screen bounds (used to fit the diorama into the viewport).
  const WMINX = -FLOOR_H * KX, WMAXX = FLOOR_W * KX;
  const WMINY = -WALL_H * KZ,  WMAXY = (FLOOR_W + FLOOR_H) * KY;
  const WORLD_W = WMAXX - WMINX, WORLD_H = WMAXY - WMINY;

  const AV_R = 14;
  const SPEED = 3.2;
  const INTERACT_R = 50;

  const LANG_KEY = 'wordnook-lang';
  const MUTE_KEY = 'wordnook-muted';

  const WALL_ITEMS = new Set(['window', 'door', 'counter']); // drawn with the scenery

  // ---- DOM handles --------------------------------------------------------
  const ui = {
    canvas: document.getElementById('game'),
    hud: document.getElementById('hud'),
    langFlag: document.getElementById('lang-flag'),
    langName: document.getElementById('lang-name'),
    countNum: document.getElementById('count-num'),
    wordsBtn: document.getElementById('words-btn'),
    muteBtn: document.getElementById('mute-btn'),
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
    dpr: 1, scale: 1, offX: 0, offY: 0,
    av: { x: 350, y: 450, faceX: -1, faceY: 0, bob: 0 },
    target: null,
    keys: new Set(),
    enteredId: null,
    lastReplay: null,
    bubble: null,   // { id, word, gloss, romaji, timer }
    muted: false,
    voiceNoted: new Set(),
    t: 0,
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

  // ---- Audio (chime only; speech is never muted) --------------------------
  let audio = null;
  function ensureAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function chime() {
    if (S.muted || !audio) return;
    const now = audio.currentTime;
    [660, 990].forEach((f, i) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      o.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  }

  // ---- Projection & layout ------------------------------------------------
  function resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    ui.canvas.width = Math.floor(cssW * S.dpr);
    ui.canvas.height = Math.floor(cssH * S.dpr);
    S.scale = Math.min(cssW / WORLD_W, cssH / WORLD_H) * 0.92;
    S.offX = (cssW - WORLD_W * S.scale) / 2;
    S.offY = (cssH - WORLD_H * S.scale) / 2 + 6;
  }

  function toScreen(x, y, z) {
    const wx = (x - y) * KX;
    const wy = (x + y) * KY - (z || 0) * KZ;
    return { x: S.offX + (wx - WMINX) * S.scale, y: S.offY + (wy - WMINY) * S.scale };
  }
  function screenToFloor(clientX, clientY) {
    const r = ui.canvas.getBoundingClientRect();
    const wx = (clientX - r.left - S.offX) / S.scale + WMINX;
    const wy = (clientY - r.top - S.offY) / S.scale + WMINY;
    const a = wx / KX, b = wy / KY; // a = x-y, b = x+y (z = 0)
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  // ---- Color helpers ------------------------------------------------------
  function parseHex(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, f) {
    const [r, g, b] = parseHex(hex);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }

  // ---- Primitive drawing --------------------------------------------------
  function quad(a, b, c, d, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.7, 1.1 * S.scale); ctx.stroke(); }
  }

  // An extruded floor-aligned box from z=z0 to z=z1 over footprint (x,y,w,h).
  function box(x, y, w, h, z0, z1, color, opt) {
    opt = opt || {};
    const A = [x, y], B = [x + w, y], C = [x + w, y + h], D = [x, y + h];
    const t = (p, z) => toScreen(p[0], p[1], z);
    const stroke = opt.stroke === false ? null : shade(color, 0.5);
    // right face (x = x+w), left/front face (y = y+h), then top
    quad(t(B, z1), t(C, z1), t(C, z0), t(B, z0), shade(color, 0.64), stroke);
    quad(t(D, z1), t(C, z1), t(C, z0), t(D, z0), shade(color, 0.82), stroke);
    quad(t(A, z1), t(B, z1), t(C, z1), t(D, z1), opt.top || color, stroke);
  }

  // A rectangle lying on a vertical plane, for wall art / book spines / windows.
  // axis 'x' -> plane at constant x (left wall); 'y' -> constant y (right wall).
  function planeRect(axis, cst, a0, a1, z0, z1, fill, stroke) {
    const pt = axis === 'x'
      ? (a, z) => toScreen(cst, a, z)
      : (a, z) => toScreen(a, cst, z);
    quad(pt(a0, z1), pt(a1, z1), pt(a1, z0), pt(a0, z0), fill, stroke);
  }

  // ---- Geometry / interaction helpers ------------------------------------
  function rectDist(px, py, o) {
    const dx = Math.max(o.x - px, 0, px - (o.x + o.w));
    const dy = Math.max(o.y - py, 0, py - (o.y + o.h));
    return Math.hypot(dx, dy);
  }
  function collides(px, py) {
    for (const o of Vocab.OBJECTS) {
      if (!o.solid) continue;
      if (rectDist(px, py, o) < AV_R - 1) return true;
    }
    return false;
  }
  function nearest() {
    let best = null, bestD = Infinity;
    for (const o of Vocab.INTERACTIVE) {
      const d = rectDist(S.av.x, S.av.y, o);
      if (d < bestD) { bestD = d; best = o; }
    }
    return bestD <= INTERACT_R ? best : null;
  }
  // Screen-space bounds of an object's extruded box (for tap picking).
  function screenBounds(o) {
    const z0 = o.base || 0, z1 = z0 + (o.z || 20);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cx of [o.x, o.x + o.w]) for (const cy of [o.y, o.y + o.h]) for (const cz of [z0, z1]) {
      const p = toScreen(cx, cy, cz);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  }
  function objectAtScreen(clientX, clientY) {
    const r = ui.canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    // front-most first (higher depth = drawn later = on top)
    const list = Vocab.INTERACTIVE.slice().sort((a, b) => depth(b) - depth(a));
    for (const o of list) {
      const b = screenBounds(o);
      if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) return o;
    }
    return null;
  }
  function depth(o) { return (o.x + o.w / 2) + (o.y + o.h / 2) + (o.depthBias || 0); }

  // ---- Interaction --------------------------------------------------------
  function interact(o) {
    if (!o) return;
    ensureAudio();
    const info = Vocab.lang(S.lang);
    const word = Vocab.word(o.id, S.lang);
    const usedVoice = Speech.speak(word, info.bcp47);
    WordList.add(S.lang, { id: o.id, word, gloss: Vocab.gloss(o.id), romaji: Vocab.romaji(o.id) });
    S.lastReplay = { word, bcp47: info.bcp47 };
    S.bubble = {
      id: o.id, word,
      gloss: Vocab.gloss(o.id),
      romaji: (S.lang === 'ja') ? Vocab.romaji(o.id) : '',
      timer: 230,
    };
    updateCount();
    chime();
    if (!usedVoice) noteMissingVoice();
  }

  function noteMissingVoice() {
    if (S.voiceNoted.has(S.lang)) return;
    S.voiceNoted.add(S.lang);
    const info = Vocab.lang(S.lang);
    ui.voiceNote.textContent = `No ${info.label} voice is installed on this device — you'll still see each word written out.`;
    ui.voiceNote.classList.remove('hidden');
    setTimeout(() => ui.voiceNote.classList.add('hidden'), 5000);
  }

  function updateCount() { ui.countNum.textContent = `${WordList.count(S.lang)}/${Vocab.total}`; }

  function setLang(code) {
    if (!Vocab.LANGS.some((l) => l.code === code)) return;
    S.lang = code; saveLang();
    const info = Vocab.lang(code);
    ui.langFlag.textContent = info.flag;
    ui.langName.textContent = info.label;
    updateCount();
    document.querySelectorAll('[data-learn]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-learn') === code);
    });
  }

  // ---- Update -------------------------------------------------------------
  function step() {
    S.t++;
    const av = S.av;
    let vx = 0, vy = 0;
    const k = S.keys;
    // Screen-intuitive controls: on the iso floor, +x is down-right, +y is
    // down-left, so map arrows to a blend that feels like screen directions.
    if (k.has('ArrowUp') || k.has('w')) { vx -= 1; vy -= 1; }
    if (k.has('ArrowDown') || k.has('s')) { vx += 1; vy += 1; }
    if (k.has('ArrowLeft') || k.has('a')) { vx -= 1; vy += 1; }
    if (k.has('ArrowRight') || k.has('d')) { vx += 1; vy += 1 - 2; } // +x, -y

    if (vx || vy) {
      S.target = null;
      const m = Math.hypot(vx, vy) || 1;
      vx = (vx / m) * SPEED; vy = (vy / m) * SPEED;
    } else if (S.target) {
      const dx = S.target.x - av.x, dy = S.target.y - av.y, d = Math.hypot(dx, dy);
      if (d < SPEED) S.target = null;
      else { vx = (dx / d) * SPEED; vy = (dy / d) * SPEED; }
    }

    if (vx || vy) {
      // face left/right on screen: screenX ∝ (x - y)
      av.faceX = Math.sign((vx - vy)) || av.faceX;
      const minX = 16, maxX = FLOOR_W - 8, minY = 16, maxY = FLOOR_H - 8;
      const nx = Math.max(minX, Math.min(maxX, av.x + vx));
      if (!collides(nx, av.y)) av.x = nx;
      const ny = Math.max(minY, Math.min(maxY, av.y + vy));
      if (!collides(av.x, ny)) av.y = ny;
      av.bob += 0.3;
    } else {
      av.bob += 0.06;
    }

    const near = nearest();
    const nearId = near ? near.id : null;
    if (nearId !== S.enteredId) {
      S.enteredId = nearId;
      if (near) interact(near);
    }

    if (S.bubble && --S.bubble.timer <= 0) S.bubble = null;
  }

  // ---- Scene rendering ----------------------------------------------------
  function drawBackground(cssW, cssH) {
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, '#f7e2c4');
    g.addColorStop(0.55, '#f0d3ad');
    g.addColorStop(1, '#e6c199');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawFloor() {
    const p0 = toScreen(0, 0, 0), p1 = toScreen(FLOOR_W, 0, 0);
    const p2 = toScreen(FLOOR_W, FLOOR_H, 0), p3 = toScreen(0, FLOOR_H, 0);
    quad(p0, p1, p2, p3, '#d8b285');
    // planks
    ctx.strokeStyle = 'rgba(150,110,70,0.28)'; ctx.lineWidth = Math.max(0.6, S.scale);
    for (let x = 40; x < FLOOR_W; x += 46) {
      const a = toScreen(x, 0, 0), b = toScreen(x, FLOOR_H, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  function drawSunPool() {
    // Warm afternoon light pooling in the corner where the cat sleeps.
    const c = toScreen(150, 360, 0);
    const rx = 200 * S.scale, ry = 108 * S.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rx);
    g.addColorStop(0, 'rgba(255,224,150,0.42)');
    g.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
    ctx.restore();
  }

  function drawWalls() {
    // Left wall (plane x = 0), faces toward screen-right.
    quad(toScreen(0, 0, WALL_H), toScreen(0, FLOOR_H, WALL_H), toScreen(0, FLOOR_H, 0), toScreen(0, 0, 0),
      '#efe0c6', 'rgba(150,120,90,0.25)');
    // Right wall (plane y = 0), lighter (catches the afternoon light).
    quad(toScreen(0, 0, WALL_H), toScreen(FLOOR_W, 0, WALL_H), toScreen(FLOOR_W, 0, 0), toScreen(0, 0, 0),
      '#f6ead4', 'rgba(150,120,90,0.25)');
    // Baseboards
    planeRect('x', 0, 0, FLOOR_H, 0, 12, shade('#efe0c6', 0.82));
    planeRect('y', 0, 0, FLOOR_W, 0, 12, shade('#f6ead4', 0.82));
  }

  function drawObject(o, highlighted) {
    switch (o.kind) {
      case 'rug': return drawRug(o);
      case 'window': return drawWindow(o);
      case 'door': return drawDoor(o);
      case 'counter': return drawCounter(o);
      case 'machine': return drawMachine(o);
      case 'mug': return drawMug(o, o.color);
      case 'coffee': return drawMug(o, '#f3efe6', true);
      case 'sugar': return drawSugar(o);
      case 'milk': return drawMilk(o);
      case 'sofa': return drawSofa(o);
      case 'table': return drawTable(o);
      case 'bookshelf': return drawBookshelf(o);
      case 'lamp': return drawLamp(o);
      case 'plant': return drawPlant(o);
      case 'cat': return drawCat(o);
      case 'person': return drawPerson(o);
      default: box(o.x, o.y, o.w, o.h, 0, o.z || 20, o.color || '#bbb');
    }
  }

  function contactShadow(cx, cy, rx) {
    const c = toScreen(cx, cy, 0);
    ctx.save();
    ctx.fillStyle = 'rgba(80,55,35,0.20)';
    ctx.translate(c.x, c.y); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, rx * S.scale, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawRug(o) {
    const t = (x, y) => toScreen(x, y, 0.4);
    quad(t(o.x, o.y), t(o.x + o.w, o.y), t(o.x + o.w, o.y + o.h), t(o.x, o.y + o.h), o.color);
    const inset = 22;
    quad(t(o.x + inset, o.y + inset), t(o.x + o.w - inset, o.y + inset),
      t(o.x + o.w - inset, o.y + o.h - inset), t(o.x + inset, o.y + o.h - inset),
      shade(o.color, 1.18), 'rgba(255,255,255,0.25)');
    const in2 = 44;
    quad(t(o.x + in2, o.y + in2), t(o.x + o.w - in2, o.y + in2),
      t(o.x + o.w - in2, o.y + o.h - in2), t(o.x + in2, o.y + o.h - in2), shade(o.color, 0.86));
  }

  function drawWindow(o) {
    const y0 = o.y, y1 = o.y + o.h, z0 = 44, z1 = 138;
    planeRect('x', 2, y0 - 8, y1 + 8, z0 - 10, z1 + 10, '#c9a06a'); // frame
    // sky with a warm afternoon glow
    const sky = ctx.createLinearGradient(0, toScreen(0, y0, z1).y, 0, toScreen(0, y0, z0).y);
    sky.addColorStop(0, '#ffe0a8'); sky.addColorStop(1, '#f7b76e');
    planeRect('x', 3, y0, y1, z0, z1, sky);
    planeRect('x', 3, y0, y1, z0, z1, null, 'rgba(120,90,60,0.5)');
    const ym = (y0 + y1) / 2, zm = (z0 + z1) / 2;
    planeRect('x', 4, ym - 2, ym + 2, z0, z1, '#c9a06a'); // mullions
    planeRect('x', 4, y0, y1, zm - 2, zm + 2, '#c9a06a');
  }

  function drawDoor(o) {
    const x0 = o.x, x1 = o.x + o.w, z1 = 140;
    planeRect('y', 2, x0 - 6, x1 + 6, 0, z1 + 8, '#8a5f3d');           // frame
    planeRect('y', 3, x0, x1, 0, z1, o.color);                         // slab
    planeRect('y', 4, x0 + 8, (x0 + x1) / 2 - 4, 18, z1 - 18, shade(o.color, 0.88));
    planeRect('y', 4, (x0 + x1) / 2 + 4, x1 - 8, 18, z1 - 18, shade(o.color, 0.88));
    planeRect('y', 5, x1 - 16, x1 - 10, 66, 74, '#f0d264');           // knob
  }

  function drawCounter(o) {
    box(o.x, o.y, o.w, o.h, 0, o.z, o.color, { top: shade(o.color, 1.14) });
    // cabinet seams on the front face
    ctx.strokeStyle = shade(o.color, 0.5); ctx.lineWidth = Math.max(0.6, S.scale);
    for (let x = o.x + 65; x < o.x + o.w; x += 65) {
      const a = toScreen(x, o.y + o.h, 0), b = toScreen(x, o.y + o.h, o.z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  function drawMachine(o) {
    const b = o.base || 0;
    box(o.x, o.y, o.w, o.h, b, b + o.z, o.color, { top: shade(o.color, 1.12) });
    box(o.x + 10, o.y + 8, o.w - 20, o.h - 16, b + o.z, b + o.z + 26, shade(o.color, 1.08));
    planeRect('y', o.y + o.h, o.x + 12, o.x + o.w - 12, b + 12, b + o.z - 8, '#2f3136'); // dark front
    planeRect('y', o.y + o.h, o.x + o.w / 2 - 8, o.x + o.w / 2 + 8, b + 6, b + 12, '#c98a4a'); // spout drip
  }

  function drawMug(o, color, coffee) {
    const b = o.base || 0;
    box(o.x, o.y, o.w, o.h, b, b + o.z, color, { top: coffee ? '#6b4a2f' : shade(color, 1.1) });
    // handle
    const h = toScreen(o.x + o.w, o.y + o.h / 2, b + o.z * 0.6);
    ctx.strokeStyle = shade(color, 0.7); ctx.lineWidth = Math.max(1.4, 3 * S.scale);
    ctx.beginPath(); ctx.arc(h.x, h.y, 6 * S.scale, -1.2, 1.2); ctx.stroke();
  }

  function drawSugar(o) {
    const b = o.base || 0;
    box(o.x, o.y, o.w, o.h, b, b + o.z, o.color, { top: shade(o.color, 1.1) });
    box(o.x + 5, o.y + 5, o.w - 10, o.h - 10, b + o.z, b + o.z + 8, '#d9c3a0'); // lid
  }

  function drawMilk(o) {
    const b = o.base || 0;
    box(o.x, o.y, o.w, o.h, b, b + o.z, o.color, { top: shade(o.color, 0.95) });
    // peaked carton top
    const apex = toScreen(o.x + o.w / 2, o.y + o.h / 2, b + o.z + 16);
    const fl = toScreen(o.x, o.y + o.h, b + o.z), fr = toScreen(o.x + o.w, o.y + o.h, b + o.z);
    const bl = toScreen(o.x, o.y, b + o.z), br = toScreen(o.x + o.w, o.y, b + o.z);
    quad(fl, fr, apex, apex, shade(o.color, 0.85), 'rgba(120,120,120,0.4)');
    quad(fr, br, apex, apex, shade(o.color, 0.7), 'rgba(120,120,120,0.4)');
    quad(bl, br, apex, apex, shade(o.color, 0.92), 'rgba(120,120,120,0.4)');
    planeRect('y', o.y + o.h, o.x + 6, o.x + o.w - 6, b + 8, b + o.z - 6, '#8fb9e0'); // blue label
  }

  function drawSofa(o) {
    const c = o.color;
    box(o.x, o.y, o.w, 20, 0, o.z, shade(c, 0.94));                 // backrest
    box(o.x, o.y + 20, o.w, o.h - 20, 0, 40, c, { top: shade(c, 1.06) }); // seat base
    box(o.x, o.y + 20, 18, o.h - 20, 0, 54, shade(c, 1.08));        // left arm
    box(o.x + o.w - 18, o.y + 20, 18, o.h - 20, 0, 54, shade(c, 1.08)); // right arm
    // cushion seams on the seat top
    const t = (x, y) => toScreen(x, y, 40);
    ctx.strokeStyle = shade(c, 0.7); ctx.lineWidth = Math.max(0.7, S.scale);
    const mx = o.x + o.w / 2;
    ctx.beginPath();
    let a = t(mx, o.y + 22), bb = t(mx, o.y + o.h);
    ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
  }

  function drawTable(o) {
    box(o.x + 8, o.y + 8, o.w - 16, o.h - 16, 0, o.z - 6, shade(o.color, 0.8)); // base
    box(o.x, o.y, o.w, o.h, o.z - 8, o.z, o.color, { top: shade(o.color, 1.12) }); // top slab
  }

  function drawBookshelf(o) {
    box(o.x, o.y, o.w, o.h, 0, o.z, o.color, { top: shade(o.color, 1.08) });
    const cols = ['#c65b4e', '#5f9a7a', '#d9a24b', '#5d7fb0', '#b07bb0', '#d97b57'];
    const shelves = 4, front = o.y + o.h;
    for (let s = 0; s < shelves; s++) {
      const z0 = 12 + s * (o.z - 18) / shelves, z1 = z0 + (o.z - 18) / shelves - 6;
      planeRect('y', front, o.x + 4, o.x + o.w - 4, z0 - 4, z0 - 2, shade(o.color, 0.6)); // shelf line
      let bx = o.x + 6;
      let ci = s;
      while (bx < o.x + o.w - 8) {
        const bw = 6 + (ci * 7) % 6;
        planeRect('y', front, bx, bx + bw, z0, z1 - ((ci * 3) % 5), cols[ci % cols.length], 'rgba(60,40,30,0.35)');
        bx += bw + 2; ci++;
      }
    }
  }

  function drawLamp(o) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    contactShadow(cx, cy, 14);
    const base = toScreen(cx, cy, 0), top = toScreen(cx, cy, o.z);
    ctx.strokeStyle = '#7a5a44'; ctx.lineWidth = Math.max(1.5, 3.5 * S.scale);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    // glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, 40 * S.scale);
    g.addColorStop(0, 'rgba(255,220,140,0.55)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(top.x, top.y, 40 * S.scale, 0, 7); ctx.fill();
    ctx.restore();
    // shade (trapezoid)
    const s = S.scale;
    ctx.fillStyle = '#f0d488';
    ctx.beginPath();
    ctx.moveTo(top.x - 20 * s, top.y + 4 * s); ctx.lineTo(top.x + 20 * s, top.y + 4 * s);
    ctx.lineTo(top.x + 13 * s, top.y - 20 * s); ctx.lineTo(top.x - 13 * s, top.y - 20 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade('#f0d488', 0.7); ctx.stroke();
  }

  function drawPlant(o) {
    const potTop = Math.min(46, o.z * 0.4);
    box(o.x, o.y, o.w, o.h, 0, potTop, '#c07a4e', { top: '#a3623b' }); // pot
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const base = toScreen(cx, cy, potTop);
    const s = S.scale, leaf = o.color;
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + S.t * 0.004;
      const lx = base.x + Math.cos(ang) * 16 * s;
      const ly = base.y - (o.z - potTop) * 0.5 * s + Math.sin(ang) * 10 * s;
      ctx.fillStyle = shade(leaf, 0.8 + (i % 3) * 0.14);
      ctx.beginPath(); ctx.ellipse(lx, ly, 8 * s, 15 * s, ang, 0, 7); ctx.fill();
    }
    ctx.fillStyle = leaf;
    ctx.beginPath(); ctx.arc(base.x, base.y - (o.z - potTop) * 0.5 * s, 15 * s, 0, 7); ctx.fill();
  }

  function drawCat(o) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    contactShadow(cx, cy, 30);
    const b = toScreen(cx, cy, 0), s = S.scale, c = o.color;
    const breath = Math.sin(S.t * 0.05) * 1.4 * s;
    // curled body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 8 * s + breath, 34 * s, 20 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shade(c, 1.12);
    ctx.beginPath(); ctx.ellipse(b.x + 4 * s, b.y - 12 * s + breath, 24 * s, 12 * s, 0, 0, 7); ctx.fill();
    // tail
    ctx.strokeStyle = c; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - 26 * s, b.y - 6 * s);
    ctx.quadraticCurveTo(b.x - 44 * s, b.y - 20 * s, b.x - 26 * s, b.y - 26 * s); ctx.stroke();
    // head
    const hx = b.x + 24 * s, hy = b.y - 14 * s + breath;
    ctx.fillStyle = shade(c, 1.05);
    ctx.beginPath(); ctx.arc(hx, hy, 13 * s, 0, 7); ctx.fill();
    ctx.fillStyle = c; // ears
    ctx.beginPath(); ctx.moveTo(hx - 10 * s, hy - 8 * s); ctx.lineTo(hx - 4 * s, hy - 18 * s); ctx.lineTo(hx + 1 * s, hy - 8 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 3 * s, hy - 9 * s); ctx.lineTo(hx + 9 * s, hy - 18 * s); ctx.lineTo(hx + 12 * s, hy - 7 * s); ctx.fill();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.6 * s; // sleepy eye
    ctx.beginPath(); ctx.arc(hx + 2 * s, hy, 3.4 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // zzz
    ctx.fillStyle = 'rgba(90,60,40,0.7)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const zb = (Math.sin(S.t * 0.06) + 1) * 3 * s;
    ctx.font = `${12 * s}px sans-serif`; ctx.fillText('z', hx + 12 * s, hy - 18 * s - zb);
    ctx.font = `${16 * s}px sans-serif`; ctx.fillText('z', hx + 20 * s, hy - 28 * s - zb);
  }

  function drawPerson(o) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, z = o.base || 30;
    const foot = toScreen(cx, cy, z), s = S.scale, c = o.color;
    // body
    ctx.fillStyle = c;
    roundRectPath(foot.x - 13 * s, foot.y - 34 * s, 26 * s, 34 * s, 9 * s); ctx.fill();
    // head (tilted down, reading)
    const hx = foot.x + 3 * s, hy = foot.y - 40 * s;
    ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(hx, hy, 11 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 11.5 * s, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#3d2b22';
    ctx.beginPath(); ctx.arc(hx - 3 * s, hy + 3 * s, 1.6 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4 * s, hy + 3 * s, 1.6 * s, 0, 7); ctx.fill();
    // book
    ctx.fillStyle = '#c65b4e';
    roundRectPath(foot.x - 16 * s, foot.y - 20 * s, 26 * s, 16 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(foot.x - 3 * s, foot.y - 19 * s, 2 * s, 14 * s);
  }

  function drawAvatar() {
    const av = S.av, foot = toScreen(av.x, av.y, 0), s = S.scale;
    contactShadow(av.x, av.y, 15);
    const hop = Math.abs(Math.sin(av.bob)) * 3 * s;
    const bx = foot.x, by = foot.y - hop;
    // body
    ctx.fillStyle = '#e0a15a';
    roundRectPath(bx - 12 * s, by - 30 * s, 24 * s, 30 * s, 10 * s); ctx.fill();
    // head
    const hx = bx, hy = by - 38 * s;
    ctx.fillStyle = '#f4d1a8'; ctx.beginPath(); ctx.arc(hx, hy, 12 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b4a3a'; ctx.beginPath(); ctx.arc(hx, hy - 3 * s, 12.5 * s, Math.PI, 2 * Math.PI); ctx.fill();
    // eyes look toward facing
    const ex = (av.faceX || 1) * 3 * s;
    ctx.fillStyle = '#3d2b22';
    ctx.beginPath(); ctx.arc(hx - 4 * s + ex, hy + 2 * s, 2.4 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4 * s + ex, hy + 2 * s, 2.4 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(224,120,90,0.4)';
    ctx.beginPath(); ctx.arc(hx - 6 * s, hy + 6 * s, 2.6 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 6 * s, hy + 6 * s, 2.6 * s, 0, 7); ctx.fill();
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawSparkles(o, strong) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const zTop = Math.max((o.base || 0) + (o.z || 0), 10);
    const c = toScreen(cx, cy, zTop);
    const s = S.scale, n = strong ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const ph = S.t * 0.05 + i * 2.1;
      const a = (Math.sin(ph) * 0.5 + 0.5) * (strong ? 0.9 : 0.32);
      const r = (strong ? 5 : 3.4) * s * (0.7 + 0.3 * Math.sin(ph * 1.3));
      const ox = Math.cos(i * 2.4 + S.t * 0.02) * (strong ? 20 : 15) * s;
      const oy = -8 * s - (i % 2) * 12 * s + Math.sin(ph) * 3 * s;
      sparkle(c.x + ox, c.y + oy, r, `rgba(255,240,190,${a})`);
    }
  }
  function sparkle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + Math.PI / 4) * r * 0.34, y + Math.sin(a + Math.PI / 4) * r * 0.34);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawBubble() {
    const b = S.bubble; if (!b) return;
    const o = Vocab.byId(b.id); if (!o) return;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const zTop = (o.base || 0) + (o.z || 20);
    const anchor = toScreen(cx, cy, zTop);
    const s = S.scale;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wordF = Math.max(15, 26 * s), subF = Math.max(10, 13 * s);
    ctx.font = `700 ${wordF}px "Quicksand","Segoe UI",sans-serif`;
    const wWord = ctx.measureText(b.word).width;
    ctx.font = `${subF}px "Quicksand","Segoe UI",sans-serif`;
    const sub = b.gloss + (b.romaji ? `  ·  ${b.romaji}` : '');
    const wSub = ctx.measureText(sub).width;
    const bw = Math.max(wWord, wSub) + 34 * s;
    const bh = 30 * s + wordF + subF;
    const bx = anchor.x - bw / 2;
    const by = anchor.y - 22 * s - bh;

    ctx.save();
    ctx.shadowColor = 'rgba(90,60,40,0.28)'; ctx.shadowBlur = 12 * s; ctx.shadowOffsetY = 4 * s;
    ctx.fillStyle = '#fffaf1';
    roundRectPath(bx, by, bw, bh, 14 * s); ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(anchor.x - 9 * s, by + bh - 1);
    ctx.lineTo(anchor.x, by + bh + 13 * s);
    ctx.lineTo(anchor.x + 9 * s, by + bh - 1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#e08a6a'; ctx.lineWidth = Math.max(1.4, 2.4 * s);
    roundRectPath(bx, by, bw, bh, 14 * s); ctx.stroke();

    ctx.fillStyle = '#6b4b3a';
    ctx.font = `700 ${wordF}px "Quicksand","Segoe UI",sans-serif`;
    ctx.fillText(b.word, anchor.x, by + 14 * s + wordF / 2);
    ctx.fillStyle = '#8a6a55';
    ctx.font = `${subF}px "Quicksand","Segoe UI",sans-serif`;
    ctx.fillText(sub, anchor.x, by + 18 * s + wordF + subF / 2);
  }

  function drawVignette(cssW, cssH) {
    const g = ctx.createRadialGradient(cssW * 0.5, cssH * 0.42, cssH * 0.2, cssW * 0.5, cssH * 0.55, cssH * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(70,40,20,0.26)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
  }

  function frame() {
    if (S.running) step();
    const cssW = window.innerWidth, cssH = window.innerHeight;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    drawBackground(cssW, cssH);
    drawFloor();
    drawSunPool();
    drawWalls();
    // Wall-mounted scenery, back to front.
    drawObject(Vocab.byId('window'));
    drawObject(Vocab.byId('door'));
    drawObject(Vocab.byId('counter'));

    const near = S.running ? nearest() : null;

    // Depth-sorted entities (furniture + characters + avatar).
    const ents = Vocab.OBJECTS.filter((o) => !WALL_ITEMS.has(o.id)).map((o) => ({ o, d: depth(o) }));
    if (S.running) ents.push({ avatar: true, d: S.av.x + S.av.y });
    ents.sort((a, b) => a.d - b.d);
    for (const e of ents) {
      if (e.avatar) drawAvatar();
      else drawObject(e.o, near && near.id === e.o.id);
    }

    // Subtle sparkles on interactables (stronger on the highlighted one).
    if (S.running) for (const o of Vocab.INTERACTIVE) drawSparkles(o, near && near.id === o.id);

    if (S.running) drawBubble();
    drawVignette(cssW, cssH);

    requestAnimationFrame(frame);
  }

  // ---- Input --------------------------------------------------------------
  function onPointerDown(e) {
    if (!S.running) return;
    ensureAudio();
    const hit = objectAtScreen(e.clientX, e.clientY);
    if (hit) {
      S.target = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
      if (rectDist(S.av.x, S.av.y, hit) <= INTERACT_R) {
        S.enteredId = hit.id;
        interact(hit);
      }
    } else {
      const p = screenToFloor(e.clientX, e.clientY);
      S.target = { x: Math.max(16, Math.min(FLOOR_W - 8, p.x)), y: Math.max(16, Math.min(FLOOR_H - 8, p.y)) };
    }
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', onPointerDown);
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

    ui.muteBtn.addEventListener('click', () => {
      S.muted = !S.muted;
      ui.muteBtn.classList.toggle('muted', S.muted);
      ui.muteBtn.textContent = S.muted ? '♪̶' : '♪';
      saveMuted();
    });

    ui.wordsBtn.addEventListener('click', openWords);
    ui.wordsBack.addEventListener('click', () => ui.words.classList.add('hidden'));
    ui.wordsClear.addEventListener('click', () => { WordList.clear(S.lang); updateCount(); openWords(); });

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
      play.className = 'wr-play'; play.textContent = '▶'; play.title = 'hear it again';
      play.addEventListener('click', () => Speech.speak(e.word, info.bcp47));
      const main = document.createElement('div');
      main.className = 'wr-main';
      const rom = (S.lang === 'ja' && e.romaji) ? `<span class="wr-romaji">${e.romaji}</span>` : '';
      main.innerHTML = `<span class="wr-word">${escapeHtml(e.word)}</span>${rom}<span class="wr-gloss">${escapeHtml(e.gloss)}</span>`;
      const count = document.createElement('span');
      count.className = 'wr-count'; count.textContent = `×${e.count}`;
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
    S.running = true; S.enteredId = null;
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
