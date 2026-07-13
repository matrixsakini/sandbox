/*
 * Moon Slash — a celestial slashing game.
 * Slice the falling darkness; unbroken combos restore light to Crystal Tokyo.
 */
(() => {
  'use strict';

  const SESSION_SECONDS = 30;

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: document.getElementById('hud'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    timer: document.getElementById('timer'),
    lightFill: document.getElementById('light-fill'),
    banner: document.getElementById('banner'),
    bannerText: document.getElementById('banner-text'),
    bannerSub: document.getElementById('banner-sub'),
    menu: document.getElementById('menu'),
    end: document.getElementById('end'),
    rankTitle: document.getElementById('rank-title'),
    rankFlavor: document.getElementById('rank-flavor'),
    statScore: document.getElementById('stat-score'),
    statCombo: document.getElementById('stat-combo'),
    statLight: document.getElementById('stat-light'),
    statSliced: document.getElementById('stat-sliced'),
    startBtn: document.getElementById('start-btn'),
    retryBtn: document.getElementById('retry-btn'),
    muteBtn: document.getElementById('mute-btn'),
  };

  // ---------- Canvas / sizing ----------
  let W = 0, H = 0, DPR = 1;
  let stars = [];
  let spires = [];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    buildSkyline();
  }

  function buildStars() {
    stars = [];
    const n = Math.round((W * H) / 9000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.78,
        r: 0.6 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2,
        sp: 0.8 + Math.random() * 2.2,
      });
    }
  }

  function buildSkyline() {
    // Crystal Tokyo: a central palace flanked by symmetric crystal spires.
    spires = [
      { x: 0.500, w: 0.060, h: 0.44 },
      { x: 0.452, w: 0.034, h: 0.33 },
      { x: 0.548, w: 0.034, h: 0.35 },
      { x: 0.405, w: 0.026, h: 0.24 },
      { x: 0.595, w: 0.026, h: 0.26 },
      { x: 0.350, w: 0.030, h: 0.19 },
      { x: 0.650, w: 0.030, h: 0.20 },
    ];
    let x = 0.02;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 0.99) {
      if (x < 0.30 || x > 0.70) {
        spires.push({ x, w: 0.012 + rnd() * 0.02, h: 0.05 + rnd() * 0.12 });
      }
      x += 0.035 + rnd() * 0.05;
    }
  }

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }

  // Distance from point p to segment a-b.
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ---------- Audio (tiny synth, no assets) ----------
  let AC = null;
  let muted = false;

  function ensureAudio() {
    if (muted) return;
    if (!AC) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) AC = new Ctor();
    }
    if (AC && AC.state === 'suspended') AC.resume();
  }

  function tone(freq, dur, type, vol, delay = 0) {
    if (!AC || muted) return;
    const t0 = AC.currentTime + delay;
    const osc = AC.createOscillator();
    const g = AC.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(AC.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function sfxSlice(combo) {
    // A chime that climbs with the combo — slicing feels progressively brighter.
    const base = 523 * Math.pow(2, Math.min(combo, 18) / 18);
    tone(base, 0.22, 'sine', 0.16);
    tone(base * 1.5, 0.18, 'sine', 0.09, 0.03);
    tone(base * 2.0, 0.14, 'triangle', 0.05, 0.05);
  }

  function sfxMiss() {
    tone(130, 0.35, 'triangle', 0.22);
    tone(87, 0.45, 'sine', 0.18, 0.04);
  }

  function sfxMilestone() {
    [0, 4, 7, 12].forEach((semi, i) => {
      tone(659 * Math.pow(2, semi / 12), 0.3, 'sine', 0.12, i * 0.07);
    });
  }

  ui.muteBtn.addEventListener('click', () => {
    muted = !muted;
    ui.muteBtn.classList.toggle('muted', muted);
    ui.muteBtn.textContent = muted ? '♪̸' : '♪';
    if (!muted) ensureAudio();
  });

  // ---------- Game state ----------
  const S = {
    mode: 'menu',           // menu | playing | ending | end
    time: SESSION_SECONDS,
    elapsed: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    sliced: 0,
    light: 0.05,            // target light level 0..1
    shownLight: 0.05,       // eased value used for rendering
    items: [],
    frags: [],
    parts: [],
    texts: [],
    trail: [],
    spawnT: 0.6,
    missFlash: 0,
    queenShown: false,
    endT: 0,
  };

  const MILESTONES = {
    5: ['Moon Tiara Action!', 'combo ×5'],
    10: ['Moon Healing Escalation!', 'combo ×10'],
    15: ['Moon Crystal Power!', 'combo ×15'],
    20: ['Moon Gorgeous Meditation!', 'combo ×20'],
    30: ['Moonlight Legend!', 'combo ×30'],
    40: ['Starlight Honeymoon Therapy Kiss!', 'combo ×40'],
  };

  function showBanner(text, sub) {
    ui.bannerText.textContent = text;
    ui.bannerSub.textContent = sub || '';
    ui.banner.classList.remove('hidden', 'show');
    void ui.banner.offsetWidth; // restart the CSS animation
    ui.banner.classList.add('show');
  }

  // ---------- Items (the darkness) ----------
  const KINDS = ['orb', 'shard', 'wisp'];

  function spawnItem() {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const r = rand(24, 40) * Math.min(1, W / 700 + 0.55);
    const x = rand(W * 0.12, W * 0.88);
    const g = H * 1.05;
    const peak = H * rand(0.55, 0.88);
    const vy = -Math.sqrt(2 * g * peak);
    const toCenter = (W / 2 - x) / (W / 2);
    const vx = toCenter * rand(0, W * 0.12) + rand(-W * 0.05, W * 0.05);
    S.items.push({
      kind, x, y: H + r + 10, vx, vy, r,
      rot: rand(0, Math.PI * 2),
      vr: rand(-2.5, 2.5),
      phase: rand(0, Math.PI * 2),
    });
  }

  function spawnWave() {
    const t = S.elapsed / SESSION_SECONDS;
    let count = 1;
    if (t > 0.25 && Math.random() < 0.55) count++;
    if (t > 0.55 && Math.random() < 0.5) count++;
    if (t > 0.8 && Math.random() < 0.4) count++;
    for (let i = 0; i < count; i++) setTimeout(spawnItem, i * rand(60, 160));
    S.spawnT = lerp(1.15, 0.5, t) * rand(0.75, 1.2);
  }

  // ---------- Slicing ----------
  let recentSlices = []; // timestamps, for multi-slice bonus

  function sliceSegment(ax, ay, bx, by) {
    if (Math.hypot(bx - ax, by - ay) < 4) return; // resting finger doesn't slice
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      if (segDist(it.x, it.y, ax, ay, bx, by) <= it.r) {
        S.items.splice(i, 1);
        sliceItem(it, Math.atan2(by - ay, bx - ax));
      }
    }
  }

  function sliceItem(it, angle) {
    S.sliced++;
    S.combo++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    let pts = 10 + S.combo;

    // Multi-slice bonus: 3+ shadows cut within a heartbeat of each other.
    const now = performance.now();
    recentSlices = recentSlices.filter(t => now - t < 160);
    recentSlices.push(now);
    if (recentSlices.length === 3) {
      pts += 50;
      addText(it.x, it.y - it.r - 26, '✦ triple slice +50', '#ffd98a', 18);
    }

    S.score += pts;
    S.light = clamp(S.light + 0.03 + Math.min(S.combo, 25) * 0.0022, 0, 1);

    addText(it.x, it.y, '+' + pts, '#fff3fb', 20);
    burstFragments(it, angle);
    burstSparkles(it.x, it.y, 14 + Math.min(S.combo, 14));
    S.parts.push({ type: 'ring', x: it.x, y: it.y, r: it.r * 0.6, vr: 340, life: 0.35, t: 0 });
    sfxSlice(S.combo);

    const m = MILESTONES[S.combo];
    if (m) { showBanner(m[0], m[1]); sfxMilestone(); }
    if (S.light >= 0.99 && !S.queenShown) {
      S.queenShown = true;
      showBanner('NEO QUEEN SERENITY', 'crystal tokyo shines eternal');
      sfxMilestone();
    }
  }

  function missItem() {
    if (S.mode !== 'playing') return;
    if (S.combo >= 8) showBanner('the darkness spreads…', 'combo lost');
    S.combo = 0;
    S.light = clamp(S.light - 0.15, 0.02, 1);
    S.missFlash = 1;
    sfxMiss();
  }

  // ---------- Particles / fragments / texts ----------
  function burstFragments(it, angle) {
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = angle + Math.PI / 2 + (i / n - 0.5) * 2.4 + rand(-0.3, 0.3);
      const sp = rand(120, 320);
      const poly = [];
      const pn = 3 + Math.floor(Math.random() * 2);
      for (let j = 0; j < pn; j++) {
        const pa = (j / pn) * Math.PI * 2 + rand(-0.4, 0.4);
        const pr = it.r * rand(0.25, 0.55);
        poly.push([Math.cos(pa) * pr, Math.sin(pa) * pr]);
      }
      S.frags.push({
        x: it.x, y: it.y,
        vx: Math.cos(a) * sp + it.vx * 0.3,
        vy: Math.sin(a) * sp + it.vy * 0.2,
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
        poly, life: rand(0.5, 0.8), t: 0,
      });
    }
  }

  const SPARKLE_COLORS = ['#fff3fb', '#ffb3e0', '#ffd98a', '#c9a0ff', '#a8e6ff'];

  function burstSparkles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 420);
      S.parts.push({
        type: Math.random() < 0.35 ? 'star' : 'spark',
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        r: rand(1.5, 4.5),
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        rot: rand(0, Math.PI), vr: rand(-6, 6),
        life: rand(0.4, 0.9), t: 0,
      });
    }
  }

  function addText(x, y, str, color, size) {
    S.texts.push({ x, y, str, color, size, life: 0.9, t: 0 });
  }

  // ---------- Input ----------
  let ptrDown = false;
  let lastPt = null;

  function evPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  canvas.addEventListener('pointerdown', (e) => {
    ensureAudio();
    ptrDown = true;
    lastPt = evPoint(e);
    S.trail.push({ ...lastPt, t: performance.now() });
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!ptrDown) return;
    const p = evPoint(e);
    S.trail.push({ ...p, t: performance.now() });
    if (S.mode === 'playing' && lastPt) sliceSegment(lastPt.x, lastPt.y, p.x, p.y);
    lastPt = p;
  });

  const release = () => { ptrDown = false; lastPt = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------- Game flow ----------
  function startGame() {
    Object.assign(S, {
      mode: 'playing',
      time: SESSION_SECONDS,
      elapsed: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      sliced: 0,
      light: 0.05,
      shownLight: 0.05,
      items: [], frags: [], parts: [], texts: [], trail: [],
      spawnT: 0.5,
      missFlash: 0,
      queenShown: false,
      endT: 0,
    });
    recentSlices = [];
    ui.menu.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ensureAudio();
  }

  function rankFor(light) {
    if (light >= 0.95) return ['Neo Queen Serenity', 'Crystal Tokyo shines eternal. The darkness is no more.'];
    if (light >= 0.70) return ['Princess Serenity', 'Dawn breaks over the crystal spires. So close to salvation.'];
    if (light >= 0.45) return ['Super Sailor Moon', 'The shadows retreat — the palace glimmers with hope.'];
    if (light >= 0.20) return ['Sailor Guardian', 'A few candles against the night. Keep fighting.'];
    return ['Moonlight Sleeps…', 'The darkness held this time. Crystal Tokyo awaits its queen.'];
  }

  function finishGame() {
    S.mode = 'end';
    ui.hud.classList.add('hidden');
    ui.banner.classList.add('hidden');
    const [title, flavor] = rankFor(S.light);
    ui.rankTitle.textContent = title;
    ui.rankFlavor.textContent = flavor;
    ui.statScore.textContent = S.score;
    ui.statCombo.textContent = S.maxCombo;
    ui.statLight.textContent = Math.round(S.light * 100) + '%';
    ui.statSliced.textContent = S.sliced;
    ui.end.classList.remove('hidden');
  }

  ui.startBtn.addEventListener('click', startGame);
  ui.retryBtn.addEventListener('click', startGame);

  // ---------- Update ----------
  function update(dt) {
    const now = performance.now();
    S.trail = S.trail.filter(p => now - p.t < 260);
    S.missFlash = Math.max(0, S.missFlash - dt * 2.2);

    if (S.mode === 'playing') {
      S.elapsed += dt;
      S.time -= dt;
      S.light = clamp(S.light - dt * 0.006, 0, 1); // the darkness always presses back, gently

      S.spawnT -= dt;
      if (S.spawnT <= 0) spawnWave();

      if (S.time <= 0) {
        S.time = 0;
        S.mode = 'ending'; // let remaining pieces fall, then show results
        S.endT = 0.9;
      }
    } else if (S.mode === 'ending') {
      S.endT -= dt;
      if (S.endT <= 0) finishGame();
    }

    S.shownLight = lerp(S.shownLight, S.light, Math.min(1, dt * 3.5));

    const g = H * 1.05;
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      it.vy += g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
      if (it.y > H + it.r + 20 && it.vy > 0) {
        S.items.splice(i, 1);
        missItem();
      }
    }

    for (let i = S.frags.length - 1; i >= 0; i--) {
      const f = S.frags[i];
      f.t += dt;
      if (f.t >= f.life) { S.frags.splice(i, 1); continue; }
      f.vy += g * 0.7 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }

    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.t += dt;
      if (p.t >= p.life) { S.parts.splice(i, 1); continue; }
      if (p.type === 'ring') { p.r += p.vr * dt; continue; }
      p.vy += g * 0.25 * dt;
      p.vx *= 1 - dt * 1.4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }

    for (let i = S.texts.length - 1; i >= 0; i--) {
      const t = S.texts[i];
      t.t += dt;
      if (t.t >= t.life) { S.texts.splice(i, 1); continue; }
      t.y -= 55 * dt;
    }

    // Ambient rising sparkles once the light takes hold.
    if (S.shownLight > 0.45 && Math.random() < dt * (S.shownLight * 9)) {
      S.parts.push({
        type: 'spark',
        x: rand(0, W), y: H + 5,
        vx: rand(-12, 12), vy: rand(-90, -35),
        r: rand(1, 2.6),
        color: Math.random() < 0.5 ? '#ffd98a' : '#fff3fb',
        life: rand(1.6, 3), t: 0,
      });
    }
  }

  // ---------- Render ----------
  function skyColors(L) {
    return {
      top: mix('#070312', '#8fb7e8', L),
      mid: mix('#150a2e', '#e9a8d8', L),
      bot: mix('#241040', '#ffd9b8', L),
    };
  }

  function render(nowMs) {
    const L = S.shownLight;
    const sky = skyColors(L);

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(0.55, sky.mid);
    grad.addColorStop(1, sky.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(nowMs / 1000 * s.sp + s.tw);
      ctx.globalAlpha = (0.25 + 0.6 * tw) * lerp(1, 0.7, L);
      ctx.fillStyle = L > 0.5 ? '#fff8e6' : '#e8e4ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * (0.8 + 0.4 * tw), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon: crescent in darkness, waxing to a radiant full moon at full light.
    const mx = W * 0.79, my = H * 0.18, mr = Math.min(W, H) * 0.085;
    ctx.save();
    ctx.shadowColor = '#fff6d8';
    ctx.shadowBlur = 20 + 70 * L;
    ctx.fillStyle = mix('#cfc4e8', '#fffdf2', L);
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const off = mr * 0.62 * (1 - L);
    if (off > 1) {
      ctx.fillStyle = sky.top;
      ctx.beginPath();
      ctx.arc(mx + off * 0.7, my - off * 0.5, mr * 0.94, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light beams rising from the palace as the kingdom awakens.
    if (L > 0.55) {
      const bA = (L - 0.55) / 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = -2; i <= 2; i++) {
        const bx = W * 0.5 + i * W * 0.05;
        const bw = W * 0.02 * (1 - Math.abs(i) * 0.25);
        const bg = ctx.createLinearGradient(0, H * 0.56, 0, 0);
        bg.addColorStop(0, `rgba(255,240,200,${0.22 * bA})`);
        bg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(bx - bw / 2, 0, bw, H * 0.56);
      }
      ctx.restore();
    }

    // Crystal Tokyo skyline
    const tipC = mix('#191030', '#f4fbff', L);
    const baseC = mix('#0a0518', '#9fd4f0', L);
    ctx.save();
    if (L > 0.25) {
      ctx.shadowColor = '#bfe9ff';
      ctx.shadowBlur = 34 * L;
    }
    for (const sp of spires) {
      const cx = sp.x * W;
      const hw = sp.w * W * 0.5;
      const top = H - sp.h * H;
      const shoulder = top + sp.h * H * 0.16;
      const sg = ctx.createLinearGradient(0, top, 0, H);
      sg.addColorStop(0, tipC);
      sg.addColorStop(1, baseC);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + hw, shoulder);
      ctx.lineTo(cx + hw * 0.8, H);
      ctx.lineTo(cx - hw * 0.8, H);
      ctx.lineTo(cx - hw, shoulder);
      ctx.closePath();
      ctx.fill();
      if (L > 0.3) {
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * L})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx - hw * 0.25, H);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Fragments of shattered darkness
    for (const f of S.frags) {
      const a = 1 - f.t / f.life;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = '#1b0e33';
      ctx.strokeStyle = `rgba(183,107,255,${a * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      f.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // The darkness itself
    for (const it of S.items) drawItem(it, nowMs);

    // Sparkles / rings (additive — this is where the satisfaction lives)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of S.parts) {
      const a = 1 - p.t / p.life;
      if (p.type === 'ring') {
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#ffd7ef';
        ctx.lineWidth = 3 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        drawStar(p.x, p.y, p.r * 2.6, p.rot || 0);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    renderTrail(nowMs);

    // Floating score texts
    ctx.textAlign = 'center';
    for (const t of S.texts) {
      const a = 1 - t.t / t.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.font = `italic bold ${t.size}px Georgia, serif`;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillText(t.str, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Vignette: heavy while dark, lifting as light is restored + miss flash
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(4,1,12,${0.55 * (1 - L) + 0.3 * S.missFlash})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    if (S.missFlash > 0) {
      ctx.fillStyle = `rgba(80,10,60,${S.missFlash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawStar(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r : r * 0.38;
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawItem(it, nowMs) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.shadowColor = '#5b2a86';
    ctx.shadowBlur = 18;

    if (it.kind === 'orb') {
      const g = ctx.createRadialGradient(-it.r * 0.3, -it.r * 0.3, it.r * 0.1, 0, 0, it.r);
      g.addColorStop(0, '#33144f');
      g.addColorStop(1, '#08030f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, it.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,70,200,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // a cold glint
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,160,255,0.5)';
      ctx.beginPath();
      ctx.arc(-it.r * 0.35, -it.r * 0.35, it.r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === 'shard') {
      const g = ctx.createLinearGradient(0, -it.r, 0, it.r);
      g.addColorStop(0, '#2c1250');
      g.addColorStop(1, '#0a0418');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -it.r * 1.15);
      ctx.lineTo(it.r * 0.75, 0);
      ctx.lineTo(0, it.r * 1.15);
      ctx.lineTo(-it.r * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,90,230,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(220,180,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -it.r * 1.15);
      ctx.lineTo(0, it.r * 1.15);
      ctx.stroke();
    } else {
      // wisp: a wobbling blob of nightmare
      const wob = nowMs / 1000 * 5 + it.phase;
      ctx.fillStyle = '#160a2c';
      ctx.beginPath();
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const rr = it.r * (1 + 0.12 * Math.sin(a * 3 + wob));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,190,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,60,120,0.55)';
      ctx.beginPath();
      ctx.arc(-it.r * 0.25, -it.r * 0.1, it.r * 0.09, 0, Math.PI * 2);
      ctx.arc(it.r * 0.25, -it.r * 0.1, it.r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function renderTrail(nowMs) {
    if (S.trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < S.trail.length; i++) {
      const a = S.trail[i - 1], b = S.trail[i];
      const age = (nowMs - b.t) / 260;
      const alpha = clamp(1 - age, 0, 1);
      if (alpha <= 0) continue;
      // outer rose glow
      ctx.strokeStyle = `rgba(255,140,215,${alpha * 0.35})`;
      ctx.lineWidth = 16 * alpha;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // golden middle
      ctx.strokeStyle = `rgba(255,220,150,${alpha * 0.5})`;
      ctx.lineWidth = 7 * alpha;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // white-hot core
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- HUD ----------
  function renderHud() {
    if (S.mode !== 'playing' && S.mode !== 'ending') return;
    ui.score.textContent = S.score;
    ui.combo.textContent = S.combo > 0 ? '×' + S.combo : '—';
    ui.combo.classList.toggle('hot', S.combo >= 10);
    const t = Math.ceil(S.time);
    ui.timer.textContent = t;
    ui.timer.classList.toggle('urgent', t <= 5 && S.mode === 'playing');
    ui.lightFill.style.width = Math.round(S.shownLight * 100) + '%';
  }

  // ---------- Main loop ----------
  let lastTs = 0;
  function frame(ts) {
    const dt = Math.min((ts - lastTs) / 1000 || 0, 0.033);
    lastTs = ts;
    update(dt);
    render(ts);
    renderHud();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
