/*
 * Moon Merge — a celestial merge puzzle.
 * Place relics on the board; three alike merge into the next of Usagi's
 * treasures, from stardust all the way to the Silver Crystal. Youma wander
 * the board each turn — corner them and they seal into dark crystal.
 */
(() => {
  'use strict';

  const COLS = 6, ROWS = 6;

  // Usagi's treasures, from stardust to the Silver Crystal.
  const TIERS = [
    { key: 'tierStardust',      base: 5 },
    { key: 'tierCrescentMoon',  base: 15 },
    { key: 'tierFullMoon',      base: 40 },
    { key: 'tierBrooch',        base: 100 },
    { key: 'tierCrystalStar',   base: 250 },
    { key: 'tierCosmicHeart',   base: 600 },
    { key: 'tierCrisisMoon',    base: 1500 },
    { key: 'tierEternal',       base: 4000 },
    { key: 'tierSilverCrystal', base: 10000 },
  ];
  const MAX_TIER = TIERS.length;
  const SERENITY_BONUS = 50000;
  const TRAP_BONUS = 300;
  const CRYSTAL_BONUS = 150;
  const MAX_ACTIVE_YOUMA = 3;

  // Transformation phrases stay untranslated in every language; the subtitle
  // (the relic's name) is localized. Keyed by the tier reached.
  const MILESTONES = {
    5: 'Moon Crystal Power, Make Up!',
    7: 'Moon Crisis, Make Up!',
    9: 'Moon Eternal, Make Up!',
  };

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: document.getElementById('hud'),
    score: document.getElementById('score'),
    chain: document.getElementById('chain'),
    lightFill: document.getElementById('light-fill'),
    banner: document.getElementById('banner'),
    bannerText: document.getElementById('banner-text'),
    bannerSub: document.getElementById('banner-sub'),
    menu: document.getElementById('menu'),
    end: document.getElementById('end'),
    rankTitle: document.getElementById('rank-title'),
    rankFlavor: document.getElementById('rank-flavor'),
    statScore: document.getElementById('stat-score'),
    statTier: document.getElementById('stat-tier'),
    statChain: document.getElementById('stat-chain'),
    statYouma: document.getElementById('stat-youma'),
    startBtn: document.getElementById('start-btn'),
    retryBtn: document.getElementById('retry-btn'),
    muteBtn: document.getElementById('mute-btn'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    hsEntry: document.getElementById('hs-entry'),
    hsName: document.getElementById('hs-name'),
    hsSave: document.getElementById('hs-save'),
  };

  // ---------- Canvas / sizing ----------
  let W = 0, H = 0, DPR = 1;
  let stars = [];
  let spires = [];
  let cell = 0, bx = 0, by = 0, boardW = 0, boardH = 0;
  let tray = null;

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
    layout();
  }

  function layout() {
    cell = Math.floor(Math.min((W * 0.94) / COLS, (H * 0.58) / ROWS));
    boardW = cell * COLS;
    boardH = cell * ROWS;
    bx = Math.round((W - boardW) / 2);
    by = Math.round(Math.max(64, H * 0.105));
    const ty = by + boardH + cell * 0.82;
    tray = {
      cur:    { x: bx + cell * 0.80, y: ty, r: cell * 0.44 },
      next:   [
        { x: bx + cell * 2.02, y: ty, r: cell * 0.30 },
        { x: bx + cell * 2.88, y: ty, r: cell * 0.24 },
      ],
      pocket: { x: bx + boardW - cell * 0.80, y: ty, r: cell * 0.44 },
    };
  }

  function buildStars() {
    stars = [];
    const n = Math.round((W * H) / 9000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.85,
        r: 0.6 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2,
        sp: 0.8 + Math.random() * 2.2,
      });
    }
  }

  function buildSkyline() {
    // Crystal Tokyo: a central palace flanked by symmetric crystal spires.
    spires = [
      { x: 0.500, w: 0.060, h: 0.30 },
      { x: 0.452, w: 0.034, h: 0.22 },
      { x: 0.548, w: 0.034, h: 0.24 },
      { x: 0.405, w: 0.026, h: 0.16 },
      { x: 0.595, w: 0.026, h: 0.17 },
      { x: 0.350, w: 0.030, h: 0.12 },
      { x: 0.650, w: 0.030, h: 0.13 },
    ];
    let x = 0.02;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 0.99) {
      if (x < 0.30 || x > 0.70) {
        spires.push({ x, w: 0.012 + rnd() * 0.02, h: 0.04 + rnd() * 0.08 });
      }
      x += 0.035 + rnd() * 0.05;
    }
  }

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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

  function sfxPlace(tier) {
    tone(300 + tier * 45, 0.14, 'sine', 0.10);
    tone(600 + tier * 45, 0.09, 'triangle', 0.04, 0.02);
  }

  function sfxMerge(chain, tier) {
    // A chime that climbs with tier and cascade depth — merging upward sounds brighter.
    const base = 440 * Math.pow(2, Math.min(tier * 2 + chain * 2, 26) / 24);
    tone(base, 0.24, 'sine', 0.15);
    tone(base * 1.5, 0.2, 'sine', 0.09, 0.04);
    tone(base * 2.0, 0.16, 'triangle', 0.05, 0.07);
  }

  function sfxYouma() {
    tone(110, 0.3, 'triangle', 0.12);
    tone(82, 0.35, 'sine', 0.10, 0.06);
  }

  function sfxTrap() {
    tone(160, 0.28, 'triangle', 0.18);
    tone(523, 0.22, 'sine', 0.12, 0.12);
    tone(784, 0.18, 'sine', 0.07, 0.2);
  }

  function sfxShatter() {
    [880, 660, 440, 330].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, i * 0.04));
  }

  function sfxPocket() {
    tone(392, 0.1, 'sine', 0.08);
    tone(494, 0.08, 'sine', 0.05, 0.04);
  }

  function sfxDenied() {
    tone(140, 0.12, 'square', 0.04);
  }

  function sfxMilestone() {
    [0, 4, 7, 12].forEach((semi, i) => {
      tone(659 * Math.pow(2, semi / 12), 0.3, 'sine', 0.12, i * 0.07);
    });
  }

  function sfxGameOver() {
    tone(130, 0.5, 'triangle', 0.2);
    tone(98, 0.7, 'sine', 0.18, 0.15);
    tone(65, 1.1, 'sine', 0.2, 0.35);
  }

  ui.muteBtn.addEventListener('click', () => {
    muted = !muted;
    ui.muteBtn.classList.toggle('muted', muted);
    ui.muteBtn.textContent = muted ? '♪̸' : '♪';
    if (!muted) ensureAudio();
  });

  // ---------- Game state ----------
  const S = {
    mode: 'menu',        // menu | playing | end
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    current: null,       // piece waiting to be placed
    queue: [],           // the next two upcoming pieces (always visible)
    pocket: null,        // subspace pocket contents
    swapLocked: false,   // one pocket swap per placement
    score: 0,
    chain: 0,            // cascade depth of the turn in progress
    bestChain: 0,
    highestTier: 1,
    youmaSealed: 0,
    light: 0,            // progress toward the Silver Crystal, 0..1
    shownLight: 0,       // eased value used for rendering
    timers: [],          // pending turn steps; input is blocked while any exist
    parts: [],
    frags: [],
    texts: [],
    milestonesShown: {},
  };

  // Piece: { type: 'item'|'youma'|'crystal', tier, phase, fx, merge }
  function makePiece(type, tier) {
    return { type, tier: tier || 0, phase: rand(0, Math.PI * 2), fx: null, merge: null };
  }

  function popFx(p) { p.fx = { kind: 'pop', t: 0, dur: 0.16 }; }
  function slideFx(p, fr, fc) { p.fx = { kind: 'slide', t: 0, dur: 0.16, fr, fc }; }

  function after(delay, fn) { S.timers.push({ t: delay, fn }); }
  const busy = () => S.timers.length > 0;

  // ---------- Board helpers ----------
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const inBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function hasEmpty() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!S.board[r][c]) return true;
    }
    return false;
  }

  function cellCenter(r, c) {
    return [bx + (c + 0.5) * cell, by + (r + 0.5) * cell];
  }

  // Connected group of same type + tier, orthogonal adjacency.
  function floodGroup(r0, c0) {
    const start = S.board[r0][c0];
    if (!start) return [];
    const seen = new Set([r0 * COLS + c0]);
    const group = [[r0, c0]];
    const stack = [[r0, c0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        const id = nr * COLS + nc;
        if (!inBoard(nr, nc) || seen.has(id)) continue;
        const p = S.board[nr][nc];
        if (p && p.type === start.type && p.tier === start.tier) {
          seen.add(id);
          group.push([nr, nc]);
          stack.push([nr, nc]);
        }
      }
    }
    return group;
  }

  function countActiveYouma() {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = S.board[r][c];
      if (p && p.type === 'youma') n++;
    }
    return n;
  }

  // ---------- The bag (skill-friendly RNG) ----------
  // A shuffled 20-draw bag bounds streaks: the distribution is learnable and
  // youma pressure is capped. Youma draws are also spaced apart, and convert
  // to stardust while too many youma already roam the board.
  const BAG_CONTENTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 'y', 'y'];
  let bag = [];

  function refillBag(minYoumaIndex) {
    const min = minYoumaIndex || 2;
    for (let attempt = 0; attempt < 60; attempt++) {
      const b = BAG_CONTENTS.slice();
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
      }
      const ys = [];
      b.forEach((v, i) => { if (v === 'y') ys.push(i); });
      if (ys[0] >= min && ys[1] - ys[0] > 3) { bag = b; return; }
    }
    bag = BAG_CONTENTS.slice(); // unreachable in practice; ordered fallback
  }

  function bagDraw() {
    if (!bag.length) refillBag();
    let d = bag.shift();
    if (d === 'y' && countActiveYouma() >= MAX_ACTIVE_YOUMA) d = 1;
    return d === 'y' ? makePiece('youma') : makePiece('item', d);
  }

  // ---------- Banner ----------
  function showBanner(text, sub) {
    ui.bannerText.textContent = text;
    ui.bannerSub.textContent = sub || '';
    ui.banner.classList.remove('hidden', 'show');
    void ui.banner.offsetWidth; // restart the CSS animation
    ui.banner.classList.add('show');
  }

  // ---------- Turn flow ----------
  function tryPlace(r, c) {
    if (S.board[r][c]) return;
    const piece = S.current;
    S.current = null;
    S.swapLocked = false;
    S.chain = 0;
    S.board[r][c] = piece;
    popFx(piece);
    if (piece.type === 'item') {
      S.score += TIERS[piece.tier - 1].base;
      sfxPlace(piece.tier);
      after(0.15, () => resolveMerges(r, c));
    } else {
      sfxYouma();
      after(0.22, youmaPhase);
    }
  }

  function resolveMerges(r, c) {
    const p = S.board[r][c];
    if (p && p.type === 'item') {
      const group = floodGroup(r, c);
      if (group.length >= 3) {
        S.chain++;
        S.bestChain = Math.max(S.bestChain, S.chain);
        for (const [gr, gc] of group) {
          if (gr !== r || gc !== c) S.board[gr][gc].merge = { t: 0, dur: 0.2, tr: r, tc: c };
        }
        sfxMerge(S.chain, p.tier);
        after(0.2, () => completeMerge(r, c, group, p.tier));
        return;
      }
    }
    youmaPhase();
  }

  function completeMerge(r, c, group, tier) {
    for (const [gr, gc] of group) S.board[gr][gc] = null;
    const [px, py] = cellCenter(r, c);

    if (tier >= MAX_TIER) {
      // Three Silver Crystals become the queen herself — the cells are freed.
      const pts = SERENITY_BONUS * S.chain;
      S.score += pts;
      addText(px, py, '+' + pts, '#fff3fb', 24);
      for (const [gr, gc] of group) {
        const [gx, gy] = cellCenter(gr, gc);
        burstSparkles(gx, gy, 26);
      }
      showBanner('NEO QUEEN SERENITY', I18N.t('queenSub'));
      sfxMilestone();
      after(0.5, youmaPhase);
      return;
    }

    const nt = tier + 1;
    const np = makePiece('item', nt);
    popFx(np);
    S.board[r][c] = np;
    const pts = TIERS[nt - 1].base * S.chain;
    S.score += pts;
    addText(px, py - cell * 0.34, '+' + pts, '#fff3fb', 18);
    if (S.chain > 1) {
      addText(px, py + cell * 0.3, I18N.t('chainSub').replace('{n}', S.chain), '#ffd98a', 13);
    }
    burstSparkles(px, py, 12 + nt * 2);
    S.parts.push({ type: 'ring', x: px, y: py, r: cell * 0.3, vr: 300, life: 0.35, t: 0 });

    if (nt > S.highestTier) {
      S.highestTier = nt;
      S.light = (nt - 1) / (MAX_TIER - 1);
      const m = MILESTONES[nt];
      if (m && !S.milestonesShown[nt]) {
        S.milestonesShown[nt] = true;
        showBanner(m, I18N.t(TIERS[nt - 1].key));
        sfxMilestone();
      }
    }

    after(0.16, () => resolveMerges(r, c));
  }

  function youmaPhase() {
    const youmas = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = S.board[r][c];
      if (p && p.type === 'youma') youmas.push([r, c]);
    }
    let crystallized = false;
    for (const [r, c] of youmas) {
      const p = S.board[r][c];
      const opts = [];
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (inBoard(nr, nc) && !S.board[nr][nc]) opts.push([nr, nc]);
      }
      if (opts.length) {
        const [nr, nc] = opts[Math.floor(Math.random() * opts.length)];
        S.board[nr][nc] = p;
        S.board[r][c] = null;
        slideFx(p, r, c);
      } else {
        // Nowhere to run: the youma seals itself into dark crystal.
        const cp = makePiece('crystal');
        popFx(cp);
        S.board[r][c] = cp;
        S.score += TRAP_BONUS;
        S.youmaSealed++;
        const [x, y] = cellCenter(r, c);
        addText(x, y - cell * 0.42, I18N.t('youmaSealed'), '#c9a0ff', 14);
        burstSparkles(x, y, 10);
        sfxTrap();
        crystallized = true;
      }
    }
    after(crystallized ? 0.28 : (youmas.length ? 0.18 : 0), clearCrystals);
  }

  function clearCrystals() {
    const seen = new Set();
    let cleared = 0;
    let at = null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = S.board[r][c];
      if (!p || p.type !== 'crystal' || seen.has(r * COLS + c)) continue;
      const group = floodGroup(r, c);
      for (const [gr, gc] of group) seen.add(gr * COLS + gc);
      if (group.length < 3) continue;
      for (const [gr, gc] of group) {
        const [gx, gy] = cellCenter(gr, gc);
        shatterCrystal(gx, gy);
        S.board[gr][gc] = null;
      }
      cleared += group.length;
      at = cellCenter(group[0][0], group[0][1]);
    }
    if (cleared) {
      const pts = CRYSTAL_BONUS * cleared;
      S.score += pts;
      addText(at[0], at[1], I18N.t('crystalPurged').replace('{n}', pts), '#c9a0ff', 16);
      sfxShatter();
      after(0.22, endTurn);
    } else {
      endTurn();
    }
  }

  function endTurn() {
    S.current = S.queue.shift();
    S.queue.push(bagDraw());
    if (!hasEmpty()) {
      after(0.7, finishGame);
      return;
    }
    // No pending timers left → input reopens naturally.
  }

  // ---------- Subspace pocket ----------
  function pocketTap() {
    if (!S.pocket) {
      // Stashing is not a turn: a new piece is drawn but youma do not move.
      S.pocket = S.current;
      S.current = S.queue.shift();
      S.queue.push(bagDraw());
      sfxPocket();
    } else if (!S.swapLocked) {
      const tmp = S.current;
      S.current = S.pocket;
      S.pocket = tmp;
      S.swapLocked = true; // one swap per placement — no dithering
      sfxPocket();
    } else {
      sfxDenied();
    }
  }

  // ---------- Game flow ----------
  function seedBoard() {
    // A few starter relics so the opening has texture — never a ready merge.
    for (let attempt = 0; attempt < 40; attempt++) {
      S.board = emptyBoard();
      const seeds = [1, 1, 1, 1, 2, 2];
      for (const t of seeds) {
        let r, c;
        do {
          r = Math.floor(Math.random() * ROWS);
          c = Math.floor(Math.random() * COLS);
        } while (S.board[r][c]);
        S.board[r][c] = makePiece('item', t);
      }
      let ok = true;
      for (let r = 0; r < ROWS && ok; r++) for (let c = 0; c < COLS && ok; c++) {
        if (S.board[r][c] && floodGroup(r, c).length >= 3) ok = false;
      }
      if (ok) return;
    }
  }

  function startGame() {
    Object.assign(S, {
      mode: 'playing',
      current: null,
      queue: [],
      pocket: null,
      swapLocked: false,
      score: 0,
      chain: 0,
      bestChain: 0,
      highestTier: 1,
      youmaSealed: 0,
      light: 0,
      shownLight: 0,
      timers: [],
      parts: [], frags: [], texts: [],
      milestonesShown: {},
    });
    seedBoard();
    refillBag(6); // no youma in the opening hand
    S.current = bagDraw();
    S.queue = [bagDraw(), bagDraw()];
    ui.menu.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ensureAudio();
  }

  function rankFor(tier) {
    const t = I18N.t;
    if (tier >= 9) return [t('rankQueenTitle'), t('rankQueenFlavor')];
    if (tier >= 8) return [t('rankPrincessTitle'), t('rankPrincessFlavor')];
    if (tier >= 6) return [t('rankSuperTitle'), t('rankSuperFlavor')];
    if (tier >= 4) return [t('rankGuardianTitle'), t('rankGuardianFlavor')];
    return [t('rankSleepTitle'), t('rankSleepFlavor')];
  }

  function finishGame() {
    S.mode = 'end';
    ui.hud.classList.add('hidden');
    ui.banner.classList.add('hidden');
    const [title, flavor] = rankFor(S.highestTier);
    ui.rankTitle.textContent = title;
    ui.rankFlavor.textContent = flavor;
    ui.statScore.textContent = S.score;
    ui.statTier.textContent = I18N.t(TIERS[S.highestTier - 1].key);
    ui.statChain.textContent = S.bestChain;
    ui.statYouma.textContent = S.youmaSealed;
    setupLeaderboard();
    ui.end.classList.remove('hidden');
    sfxGameOver();
  }

  // ---------- Leaderboard (stored locally) ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function renderLeaderboard(highlightName) {
    if (!window.Leaderboard || !ui.leaderboardBody) return;
    const rows = Leaderboard.top('classic');
    ui.leaderboardBody.innerHTML = '';
    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'board-empty';
      td.textContent = I18N.t('emptyBoard');
      tr.appendChild(td);
      ui.leaderboardBody.appendChild(tr);
      return;
    }
    const hl = highlightName ? highlightName.toLowerCase() : null;
    rows.forEach((entry, i) => {
      const tr = document.createElement('tr');
      if (hl && entry.name.toLowerCase() === hl) tr.classList.add('you');
      tr.innerHTML =
        `<td>${i + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.score}</td>`;
      ui.leaderboardBody.appendChild(tr);
    });
  }

  function setupLeaderboard() {
    if (!window.Leaderboard) return;
    if (ui.hsEntry) ui.hsEntry.classList.add('hidden');
    if (ui.hsEntry && Leaderboard.qualifies('classic', S.score)) {
      ui.hsName.value = Leaderboard.lastName();
      ui.hsEntry.classList.remove('hidden');
    }
    renderLeaderboard(null);
  }

  function saveHighScore() {
    if (!window.Leaderboard || !ui.hsEntry || ui.hsEntry.classList.contains('hidden')) return;
    const raw = ui.hsName.value;
    // Match leaderboard.js's cleanName so we can highlight the saved row.
    const savedName = raw.trim().slice(0, 24) || I18N.t('anonName');
    Leaderboard.submit('classic', raw, S.score);
    ui.hsEntry.classList.add('hidden');
    renderLeaderboard(savedName);
  }

  ui.startBtn.addEventListener('click', startGame);
  ui.retryBtn.addEventListener('click', startGame);
  if (ui.hsSave) ui.hsSave.addEventListener('click', saveHighScore);
  if (ui.hsName) {
    ui.hsName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveHighScore(); }
    });
  }

  // ---------- Particles / fragments / texts ----------
  const SPARKLE_COLORS = ['#fff3fb', '#ffb3e0', '#ffd98a', '#c9a0ff', '#a8e6ff'];

  function burstSparkles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 380);
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

  function shatterCrystal(x, y) {
    const size = cell * 0.36;
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(100, 300);
      const poly = [];
      const pn = 3 + Math.floor(Math.random() * 2);
      for (let j = 0; j < pn; j++) {
        const pa = (j / pn) * Math.PI * 2 + rand(-0.4, 0.4);
        const pr = size * rand(0.25, 0.55);
        poly.push([Math.cos(pa) * pr, Math.sin(pa) * pr]);
      }
      S.frags.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
        poly, life: rand(0.5, 0.8), t: 0,
      });
    }
    burstSparkles(x, y, 8);
  }

  function addText(x, y, str, color, size) {
    S.texts.push({ x, y, str, color, size, life: 0.95, t: 0 });
  }

  // ---------- Input ----------
  let hover = null; // {r,c} under the pointer, for the ghost preview

  function hitCell(x, y) {
    const c = Math.floor((x - bx) / cell);
    const r = Math.floor((y - by) / cell);
    return inBoard(r, c) ? { r, c } : null;
  }

  function hitPocket(x, y) {
    return tray && Math.hypot(x - tray.pocket.x, y - tray.pocket.y) <= tray.pocket.r * 1.25;
  }

  canvas.addEventListener('pointerdown', (e) => {
    ensureAudio();
    if (S.mode !== 'playing' || busy() || !S.current) return;
    const x = e.clientX, y = e.clientY;
    if (hitPocket(x, y)) { pocketTap(); return; }
    const hit = hitCell(x, y);
    if (hit && !S.board[hit.r][hit.c]) tryPlace(hit.r, hit.c);
  });

  canvas.addEventListener('pointermove', (e) => {
    hover = hitCell(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });

  // Block Chrome/Safari edge swipe-back on touch (iOS).
  // touch-action:none does not cover the edge nav gesture; the touch event
  // itself must be cancelled with a non-passive listener.
  const EDGE = 32; // px from either side where iOS starts a nav swipe
  canvas.addEventListener('touchstart', (e) => {
    const x = e.touches[0].clientX;
    if (x <= EDGE || x >= window.innerWidth - EDGE) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // ---------- Update ----------
  function update(dt) {
    // Pending turn steps.
    if (S.timers.length) {
      const due = [];
      for (const tm of S.timers) tm.t -= dt;
      S.timers = S.timers.filter(tm => tm.t > 0 || (due.push(tm), false));
      for (const tm of due) tm.fn();
    }

    S.shownLight = lerp(S.shownLight, S.light, Math.min(1, dt * 3));

    // Piece animation clocks.
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = S.board[r][c];
      if (!p) continue;
      if (p.fx) {
        p.fx.t += dt;
        if (p.fx.t >= p.fx.dur) p.fx = null;
      }
      if (p.merge) p.merge.t += dt;
    }

    const g = H * 1.05;
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
      t.y -= 50 * dt;
    }

    // Ambient rising sparkles as the Silver Crystal draws near.
    if (S.mode === 'playing' && S.shownLight > 0.45 && Math.random() < dt * (S.shownLight * 7)) {
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
      top: mix('#070312', '#4a3f80', L),
      mid: mix('#150a2e', '#8a5aa8', L),
      bot: mix('#241040', '#c98ab0', L),
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
      ctx.globalAlpha = (0.25 + 0.6 * tw) * lerp(1, 0.75, L);
      ctx.fillStyle = L > 0.5 ? '#fff8e6' : '#e8e4ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * (0.8 + 0.4 * tw), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon: waxes toward full as the relics ascend.
    const mx = W * 0.86, my = H * 0.075, mr = Math.min(W, H) * 0.045;
    ctx.save();
    ctx.shadowColor = '#fff6d8';
    ctx.shadowBlur = 14 + 40 * L;
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

    // Crystal Tokyo skyline, low on the horizon behind the tray.
    const tipC = mix('#191030', '#cfd9f4', L);
    const baseC = mix('#0a0518', '#8aa8cc', L);
    ctx.save();
    ctx.globalAlpha = 0.9;
    if (L > 0.25) {
      ctx.shadowColor = '#bfe9ff';
      ctx.shadowBlur = 26 * L;
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
    }
    ctx.restore();

    if (S.mode !== 'menu') {
      renderBoard(nowMs);
      renderTray(nowMs);
    }

    // Shattered crystal fragments
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

    // Vignette, lifting as the light grows.
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(4,1,12,${0.5 * (1 - L)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function renderBoard(nowMs) {
    // Backdrop
    const pad = cell * 0.14;
    ctx.save();
    ctx.fillStyle = 'rgba(14, 6, 32, 0.62)';
    ctx.strokeStyle = 'rgba(183, 107, 255, 0.22)';
    ctx.lineWidth = 1.5;
    roundRect(bx - pad, by - pad, boardW + pad * 2, boardH + pad * 2, cell * 0.22);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Cells
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = bx + c * cell, y = by + r * cell;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.028 + ((r + c) % 2) * 0.02})`;
      roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.14);
      ctx.fill();
    }

    // Hover highlight + ghost preview of the current piece.
    const canAct = S.mode === 'playing' && !busy() && S.current;
    if (canAct && hover && !S.board[hover.r][hover.c]) {
      const x = bx + hover.c * cell, y = by + hover.r * cell;
      ctx.fillStyle = 'rgba(255, 154, 213, 0.12)';
      ctx.strokeStyle = 'rgba(255, 154, 213, 0.55)';
      ctx.lineWidth = 1.5;
      roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.14);
      ctx.fill();
      ctx.stroke();
      const [gx, gy] = cellCenter(hover.r, hover.c);
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawPieceAt(S.current, gx, gy, cell * 0.36, nowMs);
      ctx.restore();
    }

    // Pieces. Merging pieces are drawn last so they glide over their neighbors.
    const merging = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = S.board[r][c];
      if (!p) continue;
      if (p.merge) { merging.push([p, r, c]); continue; }
      let [x, y] = cellCenter(r, c);
      let scale = 1;
      if (p.fx) {
        const k = easeOut(clamp(p.fx.t / p.fx.dur, 0, 1));
        if (p.fx.kind === 'pop') scale = lerp(1.35, 1, k);
        else if (p.fx.kind === 'slide') {
          const [fx0, fy0] = cellCenter(p.fx.fr, p.fx.fc);
          x = lerp(fx0, x, k);
          y = lerp(fy0, y, k);
        }
      }
      y += Math.sin(nowMs / 1000 * 2 + p.phase) * cell * 0.02;
      drawPieceAt(p, x, y, cell * 0.36 * scale, nowMs);
    }
    for (const [p, r, c] of merging) {
      const k = easeOut(clamp(p.merge.t / p.merge.dur, 0, 1));
      const [x0, y0] = cellCenter(r, c);
      const [x1, y1] = cellCenter(p.merge.tr, p.merge.tc);
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.5;
      drawPieceAt(p, lerp(x0, x1, k), lerp(y0, y1, k), cell * 0.36 * lerp(1, 0.45, k), nowMs);
      ctx.restore();
    }
  }

  function renderTray(nowMs) {
    const label = (txt, x, y) => {
      ctx.fillStyle = 'rgba(253, 243, 255, 0.55)';
      ctx.font = `${Math.max(9, cell * 0.14)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(txt.toUpperCase(), x, y);
    };

    const slot = (s, dashed, dim) => {
      ctx.save();
      ctx.globalAlpha = dim ? 0.5 : 1;
      ctx.fillStyle = 'rgba(20, 8, 40, 0.6)';
      ctx.strokeStyle = 'rgba(183, 107, 255, 0.4)';
      ctx.lineWidth = 1.5;
      if (dashed) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Current piece
    slot(tray.cur, false, false);
    label(I18N.t('nextLabel'), tray.cur.x, tray.cur.y - tray.cur.r - cell * 0.14);
    if (S.current) {
      drawPieceAt(S.current, tray.cur.x, tray.cur.y, tray.cur.r * 0.72, nowMs);
      const name = S.current.type === 'youma' ? I18N.t('youmaName') : I18N.t(TIERS[S.current.tier - 1].key);
      ctx.fillStyle = S.current.type === 'youma' ? 'rgba(255, 120, 170, 0.9)' : 'rgba(253, 243, 255, 0.85)';
      ctx.font = `italic ${Math.max(10, cell * 0.17)}px Georgia, serif`;
      ctx.textAlign = 'left';
      ctx.fillText(name, bx + cell * 0.1, tray.cur.y + tray.cur.r + cell * 0.4);
    }

    // Upcoming queue
    S.queue.forEach((p, i) => {
      const s = tray.next[i];
      if (!s || !p) return;
      slot(s, false, true);
      ctx.save();
      ctx.globalAlpha = 0.8 - i * 0.25;
      drawPieceAt(p, s.x, s.y, s.r * 0.7, nowMs);
      ctx.restore();
    });

    // Subspace pocket
    slot(tray.pocket, !S.pocket, S.swapLocked && S.pocket);
    label(I18N.t('pocketLabel'), tray.pocket.x, tray.pocket.y - tray.pocket.r - cell * 0.14);
    if (S.pocket) {
      ctx.save();
      ctx.globalAlpha = S.swapLocked ? 0.55 : 1;
      drawPieceAt(S.pocket, tray.pocket.x, tray.pocket.y, tray.pocket.r * 0.68, nowMs);
      ctx.restore();
    }
  }

  // ---------- Piece art (all procedural, no assets) ----------
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

  function star5Path(r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.44;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + (rot || 0);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function crescentPath(r) {
    // Opens to the right: outer arc down the left side, inner curve back up.
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true);
    ctx.quadraticCurveTo(-r * 0.15, 0, 0, -r);
    ctx.closePath();
  }

  function heartPath(s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.2, s * 0.1, -s * 0.7, -s * 0.9, 0, -s * 0.25);
    ctx.bezierCurveTo(s * 0.7, -s * 0.9, s * 1.2, s * 0.1, 0, s * 0.9);
    ctx.closePath();
  }

  function wing(x, y, dir, s) {
    // Three loose feathers fanning outward.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(255, 251, 240, 0.92)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(s * (0.4 + i * 0.3), -s * 0.05 + i * s * 0.16, s * (0.5 - i * 0.1), s * (0.2 - i * 0.03), -0.5 + i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPieceAt(p, x, y, r, nowMs) {
    ctx.save();
    ctx.translate(x, y);
    const t = nowMs / 1000;
    if (p.type === 'youma') drawYouma(r, t + p.phase);
    else if (p.type === 'crystal') drawDarkCrystal(r, t + p.phase);
    else drawTier(p.tier, r, t + p.phase);
    ctx.restore();
  }

  function drawTier(tier, r, t) {
    ctx.save();
    ctx.shadowColor = tier >= 8 ? '#fff6d8' : '#ff9ad5';
    ctx.shadowBlur = 6 + tier * 2;

    // Tiers 1-3 are a waxing moon — star, crescent, full — so the next
    // form is always guessable at a glance.
    if (tier === 1) {
      // Stardust: a single small golden star, the smallest spark of light.
      ctx.fillStyle = '#ffd98a';
      drawStar(0, 0, r * 0.62, t * 0.4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3fb';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 2) {
      // Crescent Moon: the star has grown into a sliver of moon.
      const g = ctx.createLinearGradient(-r, -r, 0, r);
      g.addColorStop(0, '#fffbe8');
      g.addColorStop(1, '#ffd98a');
      ctx.fillStyle = g;
      ctx.save();
      ctx.rotate(-0.35);
      crescentPath(r * 0.9);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(168, 230, 255, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();
      ctx.restore();
    } else if (tier === 3) {
      // Full Moon: the crescent has waxed full — a glowing cratered disc.
      ctx.shadowColor = '#fff6d8';
      ctx.shadowBlur = 14;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fffdf2');
      g.addColorStop(1, '#e8d8a8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200, 175, 120, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, r * 0.15, r * 0.2, r * 0.14, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -r * 0.28, r * 0.13, r * 0.09, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.05, -r * 0.05, r * 0.09, r * 0.07, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 4) {
      // Transformation Brooch: pink disc, gold rim, crescent, four guardian gems.
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffc2e5');
      g.addColorStop(1, '#e0559a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe9b0';
      ctx.save();
      ctx.rotate(-0.3);
      crescentPath(r * 0.4);
      ctx.fill();
      ctx.restore();
      const gems = ['#7bb8ff', '#ff8a8a', '#9dedb0', '#ffca7a'];
      gems.forEach((col, i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (tier === 5) {
      // Crystal Star: gold locket with a white star and pink heart-gem.
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffe9b0');
      g.addColorStop(1, '#d9a13f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 251, 240, 0.95)';
      star5Path(r * 0.62, 0);
      ctx.fill();
      ctx.fillStyle = '#ff7cc0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 6) {
      // Cosmic Heart Compact: crowned red-pink heart.
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#ff8fb8');
      g.addColorStop(1, '#e0356e');
      ctx.fillStyle = g;
      heartPath(r * 0.75);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = r * 0.08;
      heartPath(r * 0.75);
      ctx.stroke();
      ctx.fillStyle = '#ffd98a';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.3 - r * 0.12, -r * 0.62);
        ctx.lineTo(i * r * 0.3, -r * (i === 0 ? 1.0 : 0.88));
        ctx.lineTo(i * r * 0.3 + r * 0.12, -r * 0.62);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tier === 7) {
      // Crisis Moon Compact: pale winged heart with a golden crescent.
      wing(-r * 0.55, -r * 0.05, -1, r * 0.55);
      wing(r * 0.55, -r * 0.05, 1, r * 0.55);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#ffd7ea');
      g.addColorStop(1, '#ff8fbf');
      ctx.fillStyle = g;
      heartPath(r * 0.68);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = r * 0.07;
      heartPath(r * 0.68);
      ctx.stroke();
      ctx.fillStyle = '#ffd98a';
      ctx.save();
      ctx.rotate(-0.3);
      crescentPath(r * 0.3);
      ctx.fill();
      ctx.restore();
    } else if (tier === 8) {
      // Eternal Moon Article: winged rod crowned by a small heart.
      ctx.shadowColor = '#fff6d8';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffd98a';
      roundRect(-r * 0.09, -r * 0.15, r * 0.18, r * 1.0, r * 0.09);
      ctx.fill();
      wing(-r * 0.42, -r * 0.42, -1, r * 0.5);
      wing(r * 0.42, -r * 0.42, 1, r * 0.5);
      const g = ctx.createLinearGradient(0, -r, 0, 0);
      g.addColorStop(0, '#ffb3d4');
      g.addColorStop(1, '#ff5f9e');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(0, -r * 0.5);
      heartPath(r * 0.36);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3fb';
      drawStar(0, -r * 0.55, r * 0.14, t);
    } else {
      // Silver Crystal: a faceted, softly pulsing gem of pure light.
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18 + 6 * Math.sin(t * 2);
      const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#e8e4ff');
      g.addColorStop(1, '#b9b0e8');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = r * (i % 2 === 0 ? 0.95 : 0.78);
        const px = Math.cos(a) * rr * 0.85, py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = r * (i % 2 === 0 ? 0.95 : 0.78);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * rr * 0.85, Math.sin(a) * rr);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      drawStar(-r * 0.3, -r * 0.3, r * 0.22 * (1 + 0.25 * Math.sin(t * 3)), t);
    }
    ctx.restore();
  }

  function drawYouma(r, t) {
    // A wobbling blob of nightmare with hungry eyes.
    ctx.save();
    ctx.shadowColor = '#5b2a86';
    ctx.shadowBlur = 14;
    const wob = t * 5;
    ctx.fillStyle = '#160a2c';
    ctx.beginPath();
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const rr = r * (1 + 0.12 * Math.sin(a * 3 + wob));
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 60, 190, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 60, 120, 0.6)';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.25, -r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDarkCrystal(r, t) {
    // A sealed youma: an inert shard, pulsing faintly.
    ctx.save();
    ctx.shadowColor = '#5b2a86';
    ctx.shadowBlur = 10 + 4 * Math.sin(t * 2);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#2c1250');
    g.addColorStop(1, '#0a0418');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 0.68, 0);
    ctx.lineTo(0, r * 1.05);
    ctx.lineTo(-r * 0.68, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 90, 230, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(220, 180, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(0, r * 1.05);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- HUD ----------
  function renderHud() {
    if (S.mode !== 'playing') return;
    ui.score.textContent = S.score;
    ui.chain.textContent = S.bestChain > 0 ? '×' + S.bestChain : '—';
    ui.chain.classList.toggle('hot', S.bestChain >= 3);
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

  // Debug/test hook — lets automated tests and the console set up scenarios.
  window.__mm = {
    S,
    busy,
    place: tryPlace,
    pocketTap,
    startGame,
    setCell(r, c, spec) {
      S.board[r][c] = spec == null ? null
        : spec === 'y' ? makePiece('youma')
        : spec === 'c' ? makePiece('crystal')
        : makePiece('item', spec);
    },
    setCurrent(spec) {
      S.current = spec === 'y' ? makePiece('youma') : makePiece('item', spec);
    },
  };
})();
