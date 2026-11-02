/* game.js — the engine: you walk into the story chapter by chapter. Movement, combat, characters,
   dialogue built from the text, interiors, dungeons, saving, HUD. */
(function () {
  const RPG = window.RPG;
  const { THEMES, ARCH, CLASSES, Art, LIB } = RPG;
  const GT = RPG.G, DT = RPG.D, SOLID_G = RPG.SOLID_G, PASS_D = RPG.PASS_D;
  const { TS, Tiles } = Art;
  const WEAPON_BONUS = [0, 4, 9, 15, 22], ARMOR_BONUS = [0, 2, 5, 9, 14];
  const WEAPON_PRICE = [0, 60, 160, 350], ARMOR_PRICE = [0, 50, 140, 300];
  const SAVE_KEY = 'taleforge_save_v2';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const plural = (n) => RPG.Story.pluralize(n);
  const listJoin = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // "repaired" -> "repair", so objectives read like instructions
  const IRREG = { built: 'build', rebuilt: 'rebuild', made: 'make', wrote: 'write', drew: 'draw', sang: 'sing', rode: 'ride', dug: 'dig', swept: 'sweep', lit: 'light', rang: 'ring', read: 'read', fed: 'feed', hid: 'hide', took: 'take', put: 'put', set: 'set', shut: 'shut', slept: 'sleep', ate: 'eat', drank: 'drink', threw: 'throw', caught: 'catch', taught: 'teach', bought: 'buy', brought: 'bring', sold: 'sell', told: 'tell', woke: 'wake', wove: 'weave', spun: 'spin', sewed: 'sew', grew: 'grow', blew: 'blow', broke: 'break', froze: 'freeze', chose: 'choose', began: 'begin', won: 'win' };
  function baseVerb(v) {
    v = String(v || 'use').toLowerCase();
    if (IRREG[v]) return IRREG[v];
    if (/ied$/.test(v)) return v.replace(/ied$/, 'y');
    if (/([bdgklmnprt])\1(ed|ing)$/.test(v)) return v.replace(/([bdgklmnprt])\1(ed|ing)$/, '$1');
    if (/ed$/.test(v)) { const st = v.slice(0, -2); return /(at|iz|c|v|u|[aeiou][sz]|[^aeiou][bcdfgkpt]l|[^aeiou][aiou][kmnp]|[^aeiou](ir|ur|or))$/.test(st) ? st + 'e' : st; }
    if (/ing$/.test(v) && v.length > 5) return v.replace(/ing$/, '');
    return v;
  }
  const REST_DECO = new Set([DT.BED, DT.HOSPITALBED, DT.CAMPFIRE]);
  const LOOK_DECO = new Set([DT.BOOKSHELF, DT.COMPUTER, DT.BLACKBOARD, DT.WELL, DT.STATUE, DT.ALTAR, DT.MACHINE, DT.GRAVE, DT.THRONE, DT.FIREPLACE, DT.BIGTREE, DT.STALL]);

  // ================= SOUND =================
  const Sound = {
    ctx: null, muted: false,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    play(n) {
      switch (n) {
        case 'swing': this.tone(380, 0.08, 'triangle', 0.05, -200); break;
        case 'shoot': this.tone(700, 0.09, 'square', 0.03, -400); break;
        case 'hit': this.tone(180, 0.08, 'square', 0.06, -90); break;
        case 'kill': this.tone(300, 0.12, 'square', 0.05, -220); this.tone(140, 0.15, 'triangle', 0.05, -60, 0.05); break;
        case 'hurt': this.tone(160, 0.22, 'sawtooth', 0.06, -100); break;
        case 'coin': this.tone(990, 0.06, 'square', 0.035); this.tone(1320, 0.08, 'square', 0.035, 0, 0.05); break;
        case 'potion': [520, 660, 880].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.05, 0, i * 0.06)); break;
        case 'chest': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.04, 0, i * 0.07)); break;
        case 'level': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.045, 0, i * 0.08)); break;
        case 'shard': [440, 554, 659, 880, 1109].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.06, 0, i * 0.09)); break;
        case 'door': this.tone(110, 0.25, 'triangle', 0.08, 60); break;
        case 'talk': this.tone(560 + Math.random() * 80, 0.03, 'square', 0.018); break;
        case 'menu': this.tone(660, 0.04, 'square', 0.03); break;
        case 'boss': [110, 104, 98, 92].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.06, 0, i * 0.22)); break;
        case 'eshoot': this.tone(300, 0.1, 'sawtooth', 0.025, 200); break;
        case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.06, 0, i * 0.13)); break;
        case 'die': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, 0, i * 0.18)); break;
        case 'error': this.tone(120, 0.12, 'square', 0.04); break;
      }
    },
  };
  // ================= INPUT =================
  const Input = {
    down: new Set(), hits: new Set(), joy: { x: 0, y: 0 },
    KEYMAP: { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'attack', KeyJ: 'attack', KeyZ: 'attack', KeyE: 'interact', Enter: 'interact', KeyK: 'interact', KeyX: 'interact', KeyH: 'potion', KeyQ: 'potion', Digit1: 'potion', KeyM: 'map', KeyL: 'log', Tab: 'log', Escape: 'menu', KeyP: 'menu' },
    init() {
      addEventListener('keydown', (e) => {
        if (!G.active) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const a = this.KEYMAP[e.code];
        if (!a) return;
        e.preventDefault();
        Sound.init();
        if (!this.down.has(a)) this.hits.add(a);
        this.down.add(a);
      });
      addEventListener('keyup', (e) => { const a = this.KEYMAP[e.code]; if (a) this.down.delete(a); });
      addEventListener('blur', () => { this.down.clear(); this.joy.x = this.joy.y = 0; });
      this.initTouch();
    },
    press(a) { Sound.init(); if (!this.down.has(a)) this.hits.add(a); this.down.add(a); },
    release(a) { this.down.delete(a); },
    hit(a) { if (this.hits.has(a)) { this.hits.delete(a); return true; } return false; },
    isDown(a) { return this.down.has(a); },
    endFrame() { this.hits.clear(); },
    axis() {
      let x = 0, y = 0;
      if (this.down.has('left')) x -= 1; if (this.down.has('right')) x += 1;
      if (this.down.has('up')) y -= 1; if (this.down.has('down')) y += 1;
      x += this.joy.x; y += this.joy.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      if (l < 0.18) { x = 0; y = 0; }
      return { x, y };
    },
    initTouch() {
      const zone = $('stick-zone'), stick = $('stick'), knob = $('knob');
      if (!zone) return;
      let id = null, ox = 0, oy = 0;
      zone.addEventListener('pointerdown', (e) => {
        id = e.pointerId; ox = e.clientX; oy = e.clientY; Sound.init();
        stick.style.left = ox - 55 + 'px'; stick.style.top = oy - 55 + 'px'; stick.classList.add('on');
        zone.setPointerCapture(id);
      });
      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        let dx = e.clientX - ox, dy = e.clientY - oy;
        const l = Math.hypot(dx, dy), m = 45;
        if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joy.x = dx / m; this.joy.y = dy / m;
      });
      const end = (e) => { if (e.pointerId !== id) return; id = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; stick.classList.remove('on'); };
      zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
      document.querySelectorAll('[data-act]').forEach((b) => {
        const a = b.dataset.act;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.press(a); b.classList.add('on'); });
        const up = () => { this.release(a); b.classList.remove('on'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      });
    },
  };
  // ================= UI (DOM overlays) =================
  const UI = {
    mode: null,
    init() {
      $('dialog').addEventListener('click', (e) => { if (e.target.closest('.choice')) return; this.advance(); });
      $('mapview').addEventListener('click', () => this.closeMap());
    },
    paginate(text, max = 230) {
      const out = [];
      const sents = String(text).match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || [String(text)];
      let cur = '';
      for (const s of sents) {
        if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ''; }
        cur += s;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    },
    say(pages, onDone) {
      const exp = [];
      for (const p of pages) {
        const parts = String(p.text).includes('\n') ? [p.text] : this.paginate(p.text);
        parts.forEach((t, i) => exp.push(Object.assign({}, p, { text: t, choices: i === parts.length - 1 ? p.choices : null })));
      }
      if (!exp.length) { onDone && onDone(); return; }
      this.pages = exp; this.pi = 0; this.onDone = onDone; this.mode = 'dialog';
      $('dialog').classList.remove('hidden');
      this.showPage();
    },
    showPage() {
      const p = this.pages[this.pi];
      $('dlg-name').textContent = p.narr ? (p.name || '📖') : p.name || '';
      $('dlg-name').classList.toggle('hidden', !p.name && !p.narr);
      $('dialog').classList.toggle('narr', !!p.narr);
      this.full = p.text; this.shown = 0; this.typing = true; this.sel = 0;
      $('dlg-text').textContent = '';
      $('dlg-choices').innerHTML = '';
      $('dlg-next').classList.add('hidden');
    },
    renderChoices() {
      const p = this.pages[this.pi];
      const box = $('dlg-choices');
      if (!p.choices || !p.choices.length) {
        const n = this.pages.length, touch = document.body.classList.contains('touch');
        $('dlg-next').textContent = n > 2 ? `${this.pi + 1}/${n} ▼${this.pi === 0 && n > 4 ? (touch ? '  (☰ skips)' : '  (Esc skips)') : ''}` : '▼';
        $('dlg-next').classList.remove('hidden'); box.innerHTML = ''; return;
      }
      box.innerHTML = p.choices.map((c, i) => `<button class="choice ${i === this.sel ? 'sel' : ''}" data-i="${i}">${esc(c.label)}</button>`).join('');
      box.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(+b.dataset.i); }));
    },
    advance() {
      if (this.mode !== 'dialog') return;
      if (this.typing) { this.shown = this.full.length; $('dlg-text').textContent = this.full; this.typing = false; this.renderChoices(); return; }
      const p = this.pages[this.pi];
      if (p.choices && p.choices.length) { this.choose(this.sel); return; }
      Sound.play('menu');
      this.pi++;
      if (this.pi >= this.pages.length) { this.closeDialog(); const cb = this.onDone; this.onDone = null; cb && cb(); }
      else this.showPage();
    },
    choose(i) {
      const p = this.pages[this.pi];
      const ch = p.choices[i];
      Sound.play('menu');
      this.closeDialog(); this.onDone = null;
      ch && ch.fn && ch.fn();
    },
    closeDialog() { $('dialog').classList.add('hidden'); if (this.mode === 'dialog') this.mode = null; },
    menu(title, items, opts = {}) {
      this.mode = 'menu'; this.items = items; this.mopts = opts;
      this.msel = opts.sel !== undefined ? clamp(opts.sel, 0, items.length - 1) : Math.max(0, items.findIndex((i) => !i.disabled));
      $('menu-title').textContent = title;
      $('menu-sub').innerHTML = opts.sub ? esc(opts.sub) : '';
      $('menu-body').innerHTML = opts.body || '';
      $('menu').classList.toggle('wide', !!opts.wide);
      this.renderMenu();
      $('menu').classList.remove('hidden');
      $('menu-body').scrollTop = 0;
    },
    renderMenu() {
      const box = $('menu-items');
      box.innerHTML = this.items.map((it, i) => `<button class="mi ${i === this.msel ? 'sel' : ''} ${it.disabled ? 'dis' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.right ? `<span class="r">${esc(it.right)}</span>` : ''}</button>`).join('');
      box.querySelectorAll('.mi').forEach((b) => b.addEventListener('click', () => { this.msel = +b.dataset.i; this.activate(); }));
    },
    activate() {
      const it = this.items[this.msel];
      if (!it) return;
      if (it.disabled) { Sound.play('error'); return; }
      Sound.play('menu');
      it.fn ? it.fn() : this.closeMenu();
    },
    closeMenu() { $('menu').classList.add('hidden'); if (this.mode === 'menu') this.mode = null; const c = this.mopts && this.mopts.onClose; this.mopts = null; c && c(); },
    openMap() { this.mode = 'map'; $('mapview').classList.remove('hidden'); drawBigMap(); },
    closeMap() { $('mapview').classList.add('hidden'); if (this.mode === 'map') this.mode = null; },
    toast(text, cls = '') {
      const box = $('toasts');
      const d = document.createElement('div');
      d.className = 'toast ' + cls; d.textContent = text;
      box.appendChild(d);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => d.classList.add('out'), 2600);
      setTimeout(() => d.remove(), 3200);
    },
    update(dt) {
      if (this.mode === 'dialog') {
        if (this.typing) {
          const before = Math.floor(this.shown);
          this.shown += dt * (this.full.length > 160 ? 90 : 60);
          if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 3 === 0) Sound.play('talk');
          if (this.shown >= this.full.length) { this.shown = this.full.length; this.typing = false; this.renderChoices(); }
          $('dlg-text').textContent = this.full.slice(0, Math.floor(this.shown));
        }
        const p = this.pages[this.pi];
        if (!this.typing && p.choices && p.choices.length) {
          if (Input.hit('up') || Input.hit('left')) { this.sel = (this.sel + p.choices.length - 1) % p.choices.length; this.renderChoices(); Sound.play('menu'); }
          if (Input.hit('down') || Input.hit('right')) { this.sel = (this.sel + 1) % p.choices.length; this.renderChoices(); Sound.play('menu'); }
        }
        if (Input.hit('interact') || Input.hit('attack')) this.advance();
        else if (Input.hit('menu') && !this.pages.some((pg) => pg.choices && pg.choices.length)) {
          this.closeDialog(); const cb = this.onDone; this.onDone = null; cb && cb();
        }
      } else if (this.mode === 'menu') {
        const n = this.items.length;
        if (Input.hit('up')) { this.msel = (this.msel + n - 1) % n; this.renderMenu(); Sound.play('menu'); }
        if (Input.hit('down')) { this.msel = (this.msel + 1) % n; this.renderMenu(); Sound.play('menu'); }
        if (Input.hit('interact') || Input.hit('attack')) this.activate();
        if ((Input.hit('menu') || Input.hit('log')) && this.mopts && this.mopts.closable !== false) { Sound.play('menu'); this.closeMenu(); }
      } else if (this.mode === 'map') {
        if (Input.hit('map') || Input.hit('menu') || Input.hit('interact') || Input.hit('attack')) this.closeMap();
      }
    },
  };
  // ================= GAME STATE =================
  const G = { active: false, time: 0, zoom: 2, dpr: 1, camX: 0, camY: 0, vw: 0, vh: 0, shake: 0, hitstop: 0, weather: [] };
  let canvas, ctx;

  function newProgress(spec) {
    const cls = CLASSES[spec.hero.cls] || CLASSES.warrior;
    return {
      v: 2, beat: 0, bs: {}, done: [], inv: {}, charLoc: {}, gone: {}, chests: {}, taken: {}, read: {}, ended: false, started: false,
      quests: (spec.sideQuests || []).map(() => ({ state: 'none', kills: 0, found: false })),
      map: 'over', pos: null, time: 0, kills: 0, deaths: 0,
      p: { level: 1, xp: 0, hp: cls.hp, maxHp: cls.hp, baseAtk: cls.atk, baseDef: cls.def, gold: 15, potions: 2, wTier: 0, aTier: 0 },
    };
  }
  const st = () => G.prog.p;
  const atkOf = () => st().baseAtk + WEAPON_BONUS[st().wTier];
  const defOf = () => st().baseDef + ARMOR_BONUS[st().aTier];
  const xpNeed = (lv) => Math.round(18 * Math.pow(lv, 1.6));
  const charById = (id) => (G.chars || []).find((c) => c.id === id) || null;
  const placeById = (id) => G.spec.places.find((p) => p.id === id) || null;
  const objById = (id) => G.spec.objects.find((o) => o.id === id) || null;
  const heroName = () => (G.spec.hero.display === 'You' ? 'friend' : G.spec.hero.name);
  const placeName = (id) => { const p = placeById(id); return p ? p.display : 'somewhere'; };

  function start(spec, progress, sourceText) {
    G.spec = spec;
    G.sourceText = sourceText || '';
    G.world = RPG.WorldGen.build(spec);
    G.theme = THEMES[spec.theme];
    G.prog = progress || newProgress(spec);
    G.prog.completing = false; G.zoneId = undefined; G.wx = undefined; G.mode = null; G.transition = null; G.bossActive = null;
    if (!G.prog.quests || G.prog.quests.length !== (spec.sideQuests || []).length) G.prog.quests = (spec.sideQuests || []).map(() => ({ state: 'none', kills: 0, found: false }));
    G.chars = spec.chars.slice();
    if (!G.chars.some((c) => c.job === 'shop')) G.chars.push({ id: 'merchant', name: '', display: 'Traveling Merchant', role: 'merchant', kind: 'person', look: { skin: '#e0b090', hair: '#5a3a1a', shirt: '#8a5a2a', pants: '#3a2a20', apron: true, hat: 'cap', hatColor: '#6a3a2a' }, voice: 'merchant', mood: 'plain', job: 'shop', quotes: [], mentions: [], home: spec.startPlace, generated: true });
    const cls = CLASSES[spec.hero.cls] || CLASSES.warrior;
    G.player = { x: 0, y: 0, hw: 8, hh: 7, dir: 'down', face: 1, aimX: 0, aimY: 1, walkT: 0, moving: false, atkT: 0, atkDur: 0.18, atkCD: 0, inv: 0, kbT: 0, kbx: 0, kby: 0, swing: 0, potionCD: 0, cls, look: heroLook(spec) };
    G.minis = {};
    G.openDoors = new Set(G.world.maps.over.portals.map((p) => p.x + ',' + p.y));
    Tiles.setTheme(spec.theme);
    if (!progress) initCharLocations();
    G.active = true;
    $('home').classList.add('hidden');
    $('game').classList.remove('hidden');
    document.body.classList.add('playing');
    resize();
    const pos = G.prog.pos;
    // stories that begin indoors ("I woke up…") start you inside
    if (!progress) { const a0 = G.world.anchors[spec.startPlace]; if (a0 && a0.map !== 'over' && G.world.maps[a0.map]) G.prog.map = a0.map; }
    loadMap(G.prog.map || 'over', pos ? pos.x : undefined, pos ? pos.y : undefined, true);
    if (!progress) {
      const S = spec;
      const who = S.chars.filter((c) => !c.generated).slice(0, 6).map((c) => esc(c.display)).join(', ');
      const where = S.places.filter((p) => !p.generated).slice(0, 6).map((p) => esc(p.display)).join(', ');
      const src = S.source === 'random' ? 'A brand-new story, invented just now.' : S.source === 'prompt' ? `Grown from your idea: “${esc(S.premise)}”.` : `Built from your ${S.stats.sentences} sentences.`;
      UI.menu(S.title, [{ label: '▶ Step into the story', fn: () => { UI.closeMenu(); G.prog.started = true; Story.activate(G.prog.beat || 0); } }], {
        closable: false, wide: true,
        body: `<p class="src">${src}</p><div class="introgrid"><div><b>You are</b> ${esc(S.hero.display === 'You' ? 'yourself' : S.hero.display)}${S.hero.roleDisplay ? ', ' + esc(S.hero.roleDisplay.toLowerCase()) : ''}</div><div><b>Chapters</b> ${S.beats.length}</div>${who ? `<div><b>People</b> ${who}</div>` : ''}${where ? `<div><b>Places</b> ${where}</div>` : ''}</div>${controlsHTML()}`,
      });
    } else {
      UI.toast('Welcome back' + (spec.hero.display !== 'You' ? ', ' + spec.hero.name : '') + '.');
      if (!G.prog.started) { G.prog.started = true; Story.activate(G.prog.beat || 0); }
      else Story.refresh();
    }
    if (!G.loopStarted) { G.loopStarted = true; G.last = performance.now(); requestAnimationFrame(loop); }
  }

  function controlsHTML() {
    if (document.body.classList.contains('touch')) return `<div class="ctrls"><span>Left thumb: move</span><span>⚔ attack</span><span>E talk / use</span><span>♥ potion</span><span>M map</span><span>☰ menu &amp; journal</span></div>`;
    return `<div class="ctrls"><span><kbd>WASD</kbd>/<kbd>Arrows</kbd> move</span><span><kbd>Space</kbd>/<kbd>J</kbd> attack</span><span><kbd>E</kbd>/<kbd>Enter</kbd> talk · open · use</span><span><kbd>H</kbd> potion</span><span><kbd>M</kbd> map</span><span><kbd>L</kbd> journal</span><span><kbd>Esc</kbd> menu / skip</span></div>`;
  }

  function heroLook(spec) {
    const L = Object.assign({}, spec.hero.look || {});
    const cls = spec.hero.cls;
    if (L.animal) return L;
    if (!L.shirt) L.shirt = THEMES[spec.theme].heroColor;
    if (cls === 'mage' && !L.staff) L.staff = '#80d0ff';
    if (!L.hat) {
      if (cls === 'warrior' && ['fantasy', 'undead', 'ice', 'fire', 'desert'].includes(spec.theme)) { L.hat = 'helmet'; L.plume = '#d03030'; }
      if (cls === 'mage') { L.hat = 'wizard'; L.robe = true; L.hatColor = Art.shade(L.shirt, -0.2); }
      if (cls === 'ranger') { L.hat = 'cap'; L.hatColor = '#3a6a3a'; L.plume = '#e04040'; }
      if (cls === 'rogue') { L.hat = 'hood'; L.hatColor = '#3a4a3a'; }
      if (['scifi', 'alien'].includes(spec.theme) && cls !== 'mage') { L.hat = 'helmet'; L.hatColor = '#d0d4d8'; L.plume = null; }
    }
    return L;
  }

  // where every character starts out
  function initCharLocations() {
    const S = G.spec, P = G.prog;
    G.chars.forEach((c) => {
      if (c.generated) { P.charLoc[c.id] = spotFor(c.id, S.startPlace, 'merchant'); return; }
      const firstTarget = S.beats.find((b) => b.obj.char === c.id && ['talk', 'receive', 'give', 'rescue'].includes(b.obj.type));
      const place = firstTarget ? firstTarget.obj.place : c.home || S.startPlace;
      P.charLoc[c.id] = spotFor(c.id, place, c.id);
    });
  }
  // a free spot near a place that nobody else is standing on
  function spotFor(cid, placeId, salt) {
    const P = G.prog;
    const cands = RPG.WorldGen.spotsFor(G.world, placeId, 16, salt);
    const others = Object.keys(P.charLoc).filter((k) => k !== cid).map((k) => P.charLoc[k]).filter((l) => l && l.map === cands[0].map);
    const map = G.world.maps[cands[0].map];
    const ok = (sp) => !others.some((l) => Math.abs(l.x - sp.x) + Math.abs(l.y - sp.y) < 2) && !(map.spawn && sp.x === map.spawn.x && sp.y === map.spawn.y);
    return cands.slice(1).find(ok) || cands.find(ok) || cands[0];
  }

  // ================= THE STORY ENGINE =================
  const Story = {
    cur() { return G.spec.beats[G.prog.beat] || null; },
    title(b) {
      const o = b.obj, S = G.spec;
      const ch = o.char && charById(o.char), it = o.item && objById(o.item);
      switch (o.type) {
        case 'find': return it ? `The ${it.display}` : placeName(b.place);
        case 'collect': return it ? plural(it.display) : placeName(b.place);
        case 'talk': return ch ? (o.taunt ? `Face to Face with ${ch.display}` : ch.display) : placeName(b.place);
        case 'receive': return ch ? `${ch.display}'s Gift` : 'A Gift';
        case 'give': return ch && it ? `The ${it.display} for ${ch.display}` : 'A Delivery';
        case 'defeat': return `Danger in ${placeName(o.place)}`;
        case 'boss': return ch ? ch.display : 'The Showdown';
        case 'rescue': return ch ? `Saving ${ch.display}` : 'The Rescue';
        case 'escape': return 'Escape!';
        case 'use': return cap(baseVerb(o.verb)) + (it ? ' the ' + it.display : '');
        default: return placeName(b.place);
      }
    },
    objectiveText(b) {
      b = b || this.cur();
      if (!b) return G.prog.ended ? 'The story is complete. Explore freely.' : '';
      const o = b.obj, bs = G.prog.bs;
      const ch = o.char && charById(o.char), it = o.item && objById(o.item);
      const pl = placeName(o.place);
      const nm = ch ? ch.display : 'them';
      switch (o.type) {
        case 'reach': return `Go to ${pl}`;
        case 'inspect': return `Look around ${pl}`;
        case 'talk': return `Talk to ${nm}${this.atPlace(o.place) ? '' : ' at ' + pl}`;
        case 'receive': return `See ${nm} at ${pl}`;
        case 'give': { if (G.prog.inv[o.item]) return `Give the ${it.display} to ${nm}`; const prev = G.spec.beats[G.prog.beat - 1]; return `Find the ${it.display} in ${placeName(prev && prev.place !== o.place ? prev.place : o.place)}`; }
        case 'find': return `Find the ${it ? it.display : 'item'}${o.parts ? ` (${o.part}/${o.parts})` : ''} in ${pl}`;
        case 'collect': return `Collect ${it ? plural(it.display) : 'items'} in ${pl} (${bs.got || 0}/${o.count})`;
        case 'defeat': return `Defeat the ${plural(o.creature || 'enemies')} at ${pl} (${bs.killed || 0}/${o.count})`;
        case 'boss': return `Defeat ${nm}${this.atPlace(o.place) ? '' : ' at ' + pl}`;
        case 'rescue': return (bs.guards || 0) > (bs.killed || 0) ? `Free ${nm}: defeat the guards at ${pl}` : `Rescue ${nm} at ${pl}`;
        case 'escape': return `Escape to ${pl}!`;
        case 'use': return `${cap(baseVerb(o.verb))}${it ? ' the ' + it.display : ''} at ${pl}`;
      }
      return '';
    },
    atPlace(pid) { const a = G.world.anchors[pid]; return a && a.map === G.map.id && Math.hypot(G.player.x / TS - a.x, G.player.y / TS - a.y) < a.r + 4; },
    activate(i) {
      const S = G.spec, P = G.prog;
      if (i >= S.beats.length) return this.finish();
      P.beat = i; P.bs = {};
      const b = S.beats[i];
      const o = b.obj;
      // the person this chapter is about walks to where it happens
      if (o.char && ['talk', 'receive', 'give', 'rescue'].includes(o.type)) {
        const loc = P.charLoc[o.char];
        const a = G.world.anchors[o.place];
        if (!loc || !a || loc.map !== a.map || Math.hypot(loc.x - a.x, loc.y - a.y) > a.r + 3) P.charLoc[o.char] = spotFor(o.char, o.place, o.char + i);
      }
      if (o.type === 'escape') P.bs.chase = true;
      for (const id of b.carry || []) if (!P.inv[id]) { P.inv[id] = 1; const it = objById(id); if (it) setTimeout(() => UI.toast(`You're carrying the ${it.display}.`, 'good'), 400); }
      const head = `Chapter ${i + 1} · ${this.title(b)}`;
      const pages = mergeNarr(storyPages(b.intro, i, head));
      banner(`Chapter ${i + 1}`, this.title(b));
      Sound.play('chest');
      this.refresh();
      const after = () => { UI.toast('▶ ' + this.objectiveText(), 'good'); if (o.type === 'reach' && this.reached(o.place)) this.complete(); if (o.type === 'escape') this.spawnChasers(); };
      if (pages.length) UI.say(pages, after); else after();
      saveGame(true);
    },
    refresh() { spawnNPCs(); this.spawnForMap(); updateWeatherMode(); },
    reached(pid) {
      const a = G.world.anchors[pid];
      if (!a) return false;
      if (a.map !== G.map.id) return false;
      if (a.map !== 'over') return true;
      return Math.hypot(G.player.x / TS - a.x, G.player.y / TS - a.y) <= a.r + 1;
    },
    // put this chapter's things into the current map
    spawnForMap() {
      const b = this.cur();
      G.objects = G.objects.filter((o) => !o.beat);
      G.enemies = G.enemies.filter((e) => !e.beat || e.dead);
      if (!b || G.prog.ended) return;
      const o = b.obj, P = G.prog, bs = P.bs, i = P.beat;
      const a = G.world.anchors[o.place];
      const here = a && a.map === G.map.id;
      const spots = (n, salt) => RPG.WorldGen.spotsFor(G.world, o.place, n, 'b' + i + (salt || ''));
      const lvl = Math.max(1, Math.round(1 + i * 0.9 + (G.spec.difficulty - 2)));
      if ((o.type === 'find' || (o.type === 'give' && !P.inv[o.item])) && !bs.taken) {
        let where = o.place;
        if (o.type === 'give') { const prev = G.spec.beats[i - 1]; where = prev && prev.place !== o.place ? prev.place : o.place; }
        const aa = G.world.anchors[where];
        if (aa && aa.map === G.map.id) { const sp = RPG.WorldGen.spotsFor(G.world, where, 4, 'item' + i)[3]; G.objects.push({ kind: 'item', beat: true, obj: o.item, x: sp.x * TS + 16, y: sp.y * TS + 16, hw: 8, hh: 8 }); }
      }
      if (!here) return;
      if (o.type === 'collect') {
        const need = (o.count || 3) - (bs.got || 0);
        spots(o.count + 2, 'c').slice(2, 2 + need).forEach((sp) => G.objects.push({ kind: 'item', beat: true, obj: o.item, x: sp.x * TS + 16, y: sp.y * TS + 16, hw: 8, hh: 8 }));
      }
      if (o.type === 'inspect' || o.type === 'use') {
        const sp = spots(4, 'm')[o.type === 'use' ? 2 : 0];
        G.objects.push({ kind: 'marker', beat: true, x: sp.x * TS + 16, y: sp.y * TS + 16, hw: 8, hh: 8, label: o.type === 'use' ? cap(baseVerb(o.verb)) : 'Look' });
      }
      if (o.type === 'defeat') {
        const left = (o.count || 3) - (bs.killed || 0);
        const type = enemyIndex(o.creature);
        spots(left + 3, 'd').slice(3).forEach((sp, k) => { const e = makeEnemy({ type, level: lvl, x: sp.x, y: sp.y }); e.beat = true; e.state = 'chase'; G.enemies.push(e); });
      }
      if (o.type === 'rescue') {
        if (bs.guards === undefined) bs.guards = 3;
        const left = bs.guards - (bs.killed || 0);
        const type = enemyIndex(o.guard);
        spots(left + 4, 'g').slice(4).forEach((sp) => { const e = makeEnemy({ type, level: lvl, x: sp.x, y: sp.y }); e.beat = true; G.enemies.push(e); });
      }
      if (o.type === 'boss' && !bs.bossDead) {
        const ch = charById(o.char);
        if (ch) {
          const sp = spots(2, 'boss')[0];
          const map = G.map;
          const bx = map.kind === 'dungeon' && map.bossRoom ? map.bossRoom.cx : sp.x, by = map.kind === 'dungeon' && map.bossRoom ? map.bossRoom.cy : sp.y;
          const e = makeBoss(ch, lvl + 1, bx, by);
          e.beat = true;
          if (bs.bossHp > 0) e.hp = Math.min(e.maxHp, bs.bossHp);
          G.enemies.push(e);
        }
      }
    },
    spawnChasers() {
      const lvl = Math.max(1, Math.round(1 + G.prog.beat * 0.8));
      const type = enemyIndex(G.spec.enemies[Math.min(1, G.spec.enemies.length - 1)].name);
      for (let k = 0; k < 3; k++) {
        const a = rand(0, Math.PI * 2);
        const x = Math.floor((G.player.x + Math.cos(a) * 140) / TS), y = Math.floor((G.player.y + Math.sin(a) * 140) / TS);
        if (G.map.solid(x, y)) continue;
        const e = makeEnemy({ type, level: lvl, x, y }); e.beat = true; e.state = 'chase'; e.minion = true; G.enemies.push(e);
      }
    },
    // hooks
    onTick() {
      const b = this.cur();
      if (!b || UI.mode || G.transition) return;
      const o = b.obj;
      if ((o.type === 'reach' || o.type === 'escape') && this.reached(o.place)) this.complete();
    },
    onKill(e) {
      const b = this.cur();
      if (!b || !e.beat) return;
      const o = b.obj, bs = G.prog.bs;
      if (o.type === 'defeat' && !e.boss) { bs.killed = (bs.killed || 0) + 1; if (bs.killed >= o.count) this.complete(); else UI.toast(this.objectiveText()); }
      if (o.type === 'rescue' && !e.boss) { bs.killed = (bs.killed || 0) + 1; if (bs.killed >= bs.guards) UI.toast(`The way is clear. Talk to ${charById(o.char).display}.`, 'good'); }
      if (o.type === 'boss' && e.boss) { bs.bossDead = true; G.prog.gone[o.char] = true; setTimeout(() => this.complete(), 900); }
    },
    onPickup(objId) {
      const b = this.cur();
      if (!b) return;
      const o = b.obj, bs = G.prog.bs;
      G.prog.inv[objId] = (G.prog.inv[objId] || 0) + 1;
      const it = objById(objId);
      if (o.type === 'find' && o.item === objId) { bs.taken = true; this.complete(); return; }
      if (o.type === 'collect' && o.item === objId) { bs.got = (bs.got || 0) + 1; if (bs.got >= o.count) this.complete(); else UI.toast(this.objectiveText()); return; }
      if (o.type === 'give' && o.item === objId) { bs.taken = true; UI.toast(`Got the ${it.display}! Bring it to ${charById(o.char).display}.`, 'good'); }
    },
    onUseMarker() { this.complete(); },
    // talking to someone who matters to this chapter
    talkHook(c) {
      const b = this.cur();
      if (!b) return false;
      const o = b.obj, P = G.prog;
      if (o.char !== c.id) return false;
      const head = `Chapter ${P.beat + 1} · ${this.title(b)}`;
      const scene = (opener) => {
        const pg = storyPages(b.outro, P.beat, head);
        if (!pg.some((x) => x.speaker === c.id)) pg.unshift({ name: c.display, text: opener || greetFor(c) });
        return mergeNarr(pg);
      };
      if (o.type === 'talk') { UI.say(scene(), () => this.complete({ shown: true })); return true; }
      if (o.type === 'receive') {
        UI.say(scene(o.item ? `Here, ${heroName()}. This is for you.` : ''), () => {
          if (o.item) { P.inv[o.item] = (P.inv[o.item] || 0) + 1; UI.toast(`Received: ${objById(o.item).display}`, 'good'); Sound.play('chest'); }
          this.complete({ shown: true });
        });
        return true;
      }
      if (o.type === 'give') {
        if (!P.inv[o.item]) { UI.say([{ name: c.display, text: `Have you found the ${objById(o.item).display} yet?` }]); return true; }
        UI.say(scene(`The ${objById(o.item).display}! Thank you, ${heroName()}.`), () => { P.inv[o.item]--; if (P.inv[o.item] <= 0) delete P.inv[o.item]; this.complete({ shown: true }); });
        return true;
      }
      if (o.type === 'rescue') {
        const bs = P.bs;
        if ((bs.guards || 0) > (bs.killed || 0)) { UI.say([{ name: c.display, text: pick(['Help! Get me out of here!', 'Watch out! They\'re still guarding me!', 'Please, deal with them first!']) }]); return true; }
        UI.say(scene(pick(['You came for me!', 'Thank you, thank you!', `I knew you'd come, ${heroName()}.`])), () => this.complete({ shown: true }));
        return true;
      }
      return false;
    },
    complete(opts = {}) {
      const S = G.spec, P = G.prog;
      const b = this.cur();
      if (!b || P.completing) return;
      P.completing = true;
      const i = P.beat;
      P.done[i] = true;
      for (const r of b.reward || []) P.inv[r] = (P.inv[r] || 0) + 1;
      const xp = 12 + i * 8, gold = 8 + i * 4;
      gainXP(xp); st().gold += gold;
      Sound.play('shard');
      burst(G.player.x, G.player.y - 10, G.theme.accent, 24);
      const head = `Chapter ${i + 1} · ${this.title(b)}`;
      const pages = opts.shown ? [] : mergeNarr(storyPages(b.outro, i, head));
      pages.push({ narr: true, name: '✦', text: `Chapter ${i + 1} complete. +${xp} XP, +${gold} ${S.currency}.` });
      G.enemies.filter((e) => e.beat && !e.boss).forEach((e) => { if (b.obj.type === 'escape') e.dead = true; });
      UI.say(pages, () => { P.completing = false; this.activate(i + 1); });
    },
    finish() {
      const S = G.spec, P = G.prog;
      P.ended = true; P.beat = S.beats.length;
      Sound.play('win');
      banner('The End', S.title);
      saveGame(true);
      setTimeout(showEnding, 600);
    },
    target() {
      const b = this.cur();
      if (!b) return null;
      const o = b.obj, P = G.prog;
      let pid = o.place;
      if (o.type === 'give' && !P.inv[o.item]) { const prev = G.spec.beats[P.beat - 1]; pid = prev && prev.place !== o.place ? prev.place : o.place; }
      let a = G.world.anchors[pid];
      if (!a) return null;
      let tx = a.x, ty = a.y;
      if (o.char && ['talk', 'receive', 'give', 'rescue'].includes(o.type) && (o.type !== 'give' || P.inv[o.item])) { const loc = P.charLoc[o.char]; if (loc) { a = { map: loc.map }; tx = loc.x; ty = loc.y; } }
      const item = G.objects.find((x) => x.beat && (x.kind === 'item' || x.kind === 'marker'));
      if (item && G.map.id === a.map) { tx = item.x / TS - 0.5; ty = item.y / TS - 0.5; }
      const boss = o.type === 'boss' && G.enemies.find((e) => e.beat && e.boss && !e.dead);
      if (boss && G.map.id === a.map) { tx = boss.x / TS - 0.5; ty = boss.y / TS - 0.5; }
      if (a.map === G.map.id) return { x: tx, y: ty, here: true };
      if (G.map.id === 'over') {
        const door = Object.values(G.world.doors).find((d) => d.to === a.map) || Object.values(G.world.caves).find((d) => d.to === a.map);
        return door ? { x: door.x, y: door.y } : null;
      }
      const ex = G.map.portals.find((p) => p.exit);
      return ex ? { x: ex.x, y: ex.y } : null;
    },
  };
  function enemyIndex(name) {
    const E = G.spec.enemies;
    let i = E.findIndex((e) => e.name.toLowerCase() === String(name || '').toLowerCase());
    if (i < 0) i = Math.min(E.length - 1, Math.floor(G.prog.beat / Math.max(1, G.spec.beats.length - 1) * (E.length - 1)));
    return Math.max(0, i);
  }

  // ================= MAP LOADING =================
  function loadMap(id, tx, ty, first) {
    const P = G.prog;
    const map = G.world.maps[id] || G.world.maps.over;
    G.map = map;
    if (map.kind !== 'over' && !map.seen && map.kind === 'dungeon') map.seen = new Uint8Array(map.w * map.h);
    const sx = tx !== undefined ? tx : map.spawn.x, sy = ty !== undefined ? ty : map.spawn.y;
    const p = G.player;
    p.x = sx * TS + 16; p.y = sy * TS + 16; p.dir = map.kind === 'over' ? 'down' : 'up'; p.kbT = 0; p.inv = 1;
    G.npcs = []; G.enemies = []; G.objects = []; G.drops = []; G.projectiles = []; G.particles = []; G.texts = []; G.bossActive = null;
    for (const d of map.entities) {
      const px = d.x * TS + 16, py = d.y * TS + 16;
      if (d.kind === 'enemy') { if (Math.abs(d.x - sx) + Math.abs(d.y - sy) < 7) continue; G.enemies.push(makeEnemy(d)); }
      else if (d.kind === 'chest') G.objects.push({ kind: 'chest', def: d, x: px, y: py, hw: 11, hh: 8, opened: !!P.chests[d.id] });
      else if (d.kind === 'sign') G.objects.push({ kind: 'sign', def: d, x: px, y: py, hw: 8, hh: 6 });
      else if (d.kind === 'questitem') { if (!P.taken[d.id]) G.objects.push({ kind: 'questitem', def: d, x: px, y: py, hw: 8, hh: 8 }); }
    }
    buildMini(map);
    P.map = map.id;
    if (!first) { Sound.play('door'); banner(map.name, map.kind === 'interior' ? '' : map.kind === 'dungeon' ? 'Be careful…' : ''); saveGame(true); }
    Story.refresh();
    initWeather();
    G.camX = p.x - G.vw / 2; G.camY = p.y - G.vh / 2;
  }
  function spawnNPCs() {
    const P = G.prog, map = G.map, b = Story.cur();
    G.npcs = [];
    for (const c of G.chars) {
      const loc = P.charLoc[c.id];
      if (!loc || loc.map !== map.id) continue;
      const targetNow = isTargetChar(c.id);
      if (P.gone[c.id] && !targetNow) continue;
      if (b && b.obj.type === 'boss' && b.obj.char === c.id) continue;
      if (c.hostile && !targetNow) continue;
      // someone who gets rescued later is missing until then
      const rb = G.spec.beats.findIndex((x) => x.obj.char === c.id && x.obj.type === 'rescue');
      if (rb >= 0 && P.beat < rb && !G.spec.beats.slice(0, rb).some((x) => x.obj.char === c.id)) continue;
      let px = loc.x * TS + 16, py = loc.y * TS + 16;
      let nx = px, ny = py;
      const p0 = G.player;
      if (p0 && Math.abs(p0.x - nx) < 20 && Math.abs(p0.y - ny) < 18) {
        const alt = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [loc.x + dx, loc.y + dy]).find(([tx, ty]) => !G.map.solid(tx, ty) && G.map.gr(tx, ty) !== GT.EXIT && (Math.abs(p0.x - (tx * TS + 16)) >= 20 || Math.abs(p0.y - (ty * TS + 16)) >= 18));
        if (alt) { nx = alt[0] * TS + 16; ny = alt[1] * TS + 16; }
      }
      px = nx; py = ny;
      G.npcs.push({ kind: 'npc', data: c, x: px, y: py, hx: px, hy: py, hw: 9, hh: 8, dir: 'down', look: c.look, wanderT: rand(1, 4), mx: 0, my: 0, walkT: 0, moving: false, talks: 0, captive: b && b.obj.type === 'rescue' && b.obj.char === c.id });
    }
    G.blockers = [...G.npcs, ...G.objects.filter((o) => o.kind === 'chest' || o.kind === 'sign')];
  }

  function makeEnemy(d) {
    const S = G.spec;
    const info = S.enemies[clamp(d.type, 0, S.enemies.length - 1)];
    const A = ARCH[info.archetype] || ARCH.humanoid;
    const L = d.level, Dm = [0.72, 1, 1.25][S.difficulty - 1];
    const e = {
      kind: 'enemy', src: d, name: info.name, arch: info.archetype, level: L,
      maxHp: Math.round(A.hp * (1 + 0.38 * (L - 1)) * Dm), atk: (A.atk + 1.6 * (L - 1)) * (0.8 + 0.2 * Dm), def: A.def + 0.6 * (L - 1),
      spd: A.spd * rand(0.92, 1.08), xp: Math.round(A.xp * (1 + 0.45 * (L - 1))), gold: A.gold * (1 + 0.3 * (L - 1)),
      x: d.x * TS + 16, y: d.y * TS + 16, hw: Math.round(A.size * 0.75), hh: Math.round(A.size * 0.65),
      state: 'idle', t: rand(0, 3), dir: 'down', face: 1, kbT: 0, kbx: 0, kby: 0, hurt: 0, wanderT: rand(0, 2), wx: 0, wy: 0,
      shootT: rand(1, 2.5), cd: rand(1, 3), windup: 0, dashT: 0, dashX: 0, dashY: 0, hopT: rand(0.3, 1), hopping: false, charge: 0,
      walkT: 0, moving: false, seed: Math.random() * 10, scale: 1, flyer: info.archetype === 'flyer', look: Art.lookFor(info.name, info.archetype, info.color),
    };
    // animals in the story fight as themselves
    const an = LIB.ANIMALS[RPG.Story.singular(info.name.toLowerCase().split(' ').pop())];
    if (an && !['slime'].includes(info.archetype)) e.charLook = { animal: RPG.Story.singular(info.name.toLowerCase().split(' ').pop()), color: info.color, scale: 1 };
    e.homeX = e.x; e.homeY = e.y; e.hp = e.maxHp;
    return e;
  }
  function makeBoss(ch, level, tx, ty) {
    const S = G.spec;
    const villain = !!ch.isVillain;
    const arch = ch.archetype || 'humanoid';
    const A = ARCH[arch] || ARCH.humanoid;
    const L = level + (villain ? 2 : 0), Dm = [0.72, 1, 1.22][S.difficulty - 1];
    const e = {
      kind: 'enemy', boss: villain ? 'villain' : 'mini', isVillain: villain, char: ch.id, name: ch.display, arch, level: L,
      maxHp: 0,
      atk: (A.atk + 1.6 * (L - 1)) * 1.05 * (0.8 + 0.2 * Dm), def: A.def + 0.6 * (L - 1),
      spd: Math.max(62, A.spd * (arch === 'brute' ? 1.35 : 1.05)), xp: Math.round(A.xp * L * (villain ? 4 : 3)), gold: villain ? 200 : 40 + L * 12,
      x: tx * TS + 16, y: ty * TS + 16, hw: 13, hh: 11,
      state: 'idle', t: 0, dir: 'down', face: 1, kbT: 0, kbx: 0, kby: 0, hurt: 0, wanderT: 0, wx: 0, wy: 0,
      shootT: 2, cd: 3, windup: 0, dashT: 0, dashX: 0, dashY: 0, hopT: 1, hopping: false, charge: 0, walkT: 0, moving: false, seed: 1, scale: villain ? 1.6 : 1.4,
      flyer: arch === 'flyer', awake: false, attackT: 2.2, phase: 1, spiralA: 0, spiralT: 0, summonT: 6,
      look: Art.lookFor(ch.display + ' ' + (ch.role || ch.animal || ''), arch, (ch.look && (ch.look.color || ch.look.shirt)) || '#7a3a8a'),
      charLook: Object.assign({}, ch.look, ch.animal ? { animal: ch.animal } : {}),
    };
    // tough, but sized to how hard you hit right now: about 28 blows for the villain, 13 for anyone else
    const blow = Math.max(4, atkOf() - e.def * 0.6);
    e.maxHp = Math.round(blow * (villain ? 28 : 13) * Dm);
    e.homeX = e.x; e.homeY = e.y; e.hp = e.maxHp;
    return e;
  }

  // ================= MINIMAP =================
  function buildMini(map) {
    if (G.minis[map.id]) { G.mini = G.minis[map.id]; return; }
    const cv = document.createElement('canvas'); cv.width = map.w; cv.height = map.h;
    const g = cv.getContext('2d');
    const img = g.createImageData(map.w, map.h);
    const cache = {};
    const rgb = (hex) => cache[hex] || (cache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
    const mini = { cv, g, img, map, dirty: true, colOf: (i) => rgb(Tiles.mini(map.g[i], map.d[i], G.theme)) };
    for (let i = 0; i < map.w * map.h; i++) {
      const k = i * 4;
      img.data[k + 3] = 255;
      if (map.seen) continue;
      const [r, gg, b] = mini.colOf(i);
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b;
    }
    g.putImageData(img, 0, 0);
    G.minis[map.id] = mini; G.mini = mini;
  }
  function revealAround(px, py, r) {
    const map = G.map;
    if (!map.seen) return;
    const cx = Math.floor(px / TS), cy = Math.floor(py / TS), mini = G.mini;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!map.inb(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = y * map.w + x;
      if (map.seen[i]) continue;
      map.seen[i] = 1;
      const [rr, gg, bb] = mini.colOf(i), k = i * 4;
      mini.img.data[k] = rr; mini.img.data[k + 1] = gg; mini.img.data[k + 2] = bb;
      mini.dirty = true;
    }
  }

  // ================= COLLISION =================
  function tileSolid(map, x, y, flyer) {
    if (!map.inb(x, y)) return true;
    const i = y * map.w + x, g = map.g[i], d = map.d[i];
    if (SOLID_G[g] && !(flyer && (g === GT.WATER || g === GT.LAVA || g === GT.MURK))) return true;
    if (d === DT.DOOR) return map.kind === 'over' && !G.openDoors.has(x + ',' + y);
    return !PASS_D[d];
  }
  function rectSolid(map, cx, cy, hw, hh, flyer, blockers, self) {
    const x0 = Math.floor((cx - hw) / TS), x1 = Math.floor((cx + hw - 0.01) / TS);
    const y0 = Math.floor((cy - hh) / TS), y1 = Math.floor((cy + hh - 0.01) / TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tileSolid(map, x, y, flyer)) return true;
    if (blockers) for (const b of blockers) {
      if (b === self) continue;
      if (self && Math.abs(b.x - self.x) < b.hw + hw && Math.abs(b.y - self.y) < b.hh + hh) continue; // already overlapping: let them walk apart
      if (Math.abs(b.x - cx) < b.hw + hw && Math.abs(b.y - cy) < b.hh + hh) return true;
    }
    return false;
  }
  function moveActor(a, dx, dy, blockers) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
    let bx = false, by = false;
    for (let i = 0; i < steps; i++) {
      const sx = dx / steps, sy = dy / steps;
      if (sx && !rectSolid(G.map, a.x + sx, a.y, a.hw, a.hh, a.flyer, blockers, a)) a.x += sx; else if (sx) bx = true;
      if (sy && !rectSolid(G.map, a.x, a.y + sy, a.hw, a.hh, a.flyer, blockers, a)) a.y += sy; else if (sy) by = true;
    }
    return { bx, by };
  }
  const overlap = (a, b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;

  // ================= MAIN LOOP =================
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - G.last) / 1000;
    G.last = now;
    if (!G.active) return;
    dt = Math.min(dt, 0.05);
    G.time += dt;
    if (G.transition) updateTransition(dt);
    if (UI.mode) UI.update(dt);
    else if (!G.transition && G.mode !== 'dead') { if (G.hitstop > 0) G.hitstop -= dt; else update(dt); }
    updateWeather(dt);
    render();
    Input.endFrame();
  }
  function update(dt) {
    const p = G.player;
    G.prog.time += dt;
    if (Input.hit('menu')) return pauseMenu();
    if (Input.hit('map')) return UI.openMap();
    if (Input.hit('log')) return journal();
    updatePlayer(dt);
    for (const n of G.npcs) updateNPC(n, dt);
    for (const e of G.enemies) if (!e.dead) (e.boss ? bossAI(e, dt) : enemyAI(e, dt));
    G.enemies = G.enemies.filter((e) => !e.dead);
    updateProjectiles(dt);
    updateDrops(dt);
    updateFx(dt);
    if (G.map.seen) revealAround(p.x, p.y, 6);
    checkPortals();
    Story.onTick();
    const mw = G.map.w * TS, mh = G.map.h * TS;
    const tx = mw <= G.vw ? (mw - G.vw) / 2 : clamp(p.x - G.vw / 2, 0, mw - G.vw);
    const ty = mh <= G.vh ? (mh - G.vh) / 2 : clamp(p.y - G.vh / 2, 0, mh - G.vh);
    G.camX += (tx - G.camX) * Math.min(1, dt * 10);
    G.camY += (ty - G.camY) * Math.min(1, dt * 10);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    G.focus = findInteractable();
    G.zoneT = (G.zoneT || 0) - dt;
    if (G.zoneT <= 0) { G.zoneT = 0.4; updateZone(); }
  }

  // ================= PLAYER =================
  function updatePlayer(dt) {
    const p = G.player;
    p.atkCD -= dt; p.inv -= dt; p.potionCD -= dt;
    if (p.atkT > 0) p.atkT -= dt;
    if (G.lockT > 0) G.lockT -= dt;
    if (p.kbT > 0) { p.kbT -= dt; moveActor(p, p.kbx * dt, p.kby * dt, G.blockers); return; }
    const ax = Input.axis();
    const spd = p.cls.spd * (p.atkT > 0 && !p.cls.ranged ? 0.45 : 1);
    p.moving = ax.x !== 0 || ax.y !== 0;
    if (p.moving) {
      p.aimX = ax.x; p.aimY = ax.y;
      const l = Math.hypot(p.aimX, p.aimY); p.aimX /= l; p.aimY /= l;
      if (p.atkT <= 0) { if (Math.abs(ax.x) > Math.abs(ax.y)) p.dir = ax.x < 0 ? 'left' : 'right'; else p.dir = ax.y < 0 ? 'up' : 'down'; }
      if (ax.x) p.face = ax.x < 0 ? -1 : 1;
      p.walkT += dt * 12;
      const r = moveActor(p, ax.x * spd * dt, ax.y * spd * dt, G.blockers);
      if (r.bx && Math.abs(ax.y) < 0.3) nudge(p, 'y', Math.sign(ax.x), spd * dt);
      if (r.by && Math.abs(ax.x) < 0.3) nudge(p, 'x', Math.sign(ax.y), spd * dt);
      if (r.by && ax.y < 0 && G.map.kind === 'over' && !(G.lockT > 0)) {
        const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - p.hh - 2) / TS);
        if (G.map.de(tx, ty) === DT.DOOR && !G.openDoors.has(tx + ',' + ty)) { G.lockT = 3; UI.toast(pick(['The door is locked.', 'Nobody answers.', 'Locked tight.'])); }
      }
    }
    if (Input.hit('attack') && p.atkCD <= 0) playerAttack();
    if (Input.hit('interact')) { if (G.focus) interact(G.focus); }
    if (Input.hit('potion')) drinkPotion();
  }
  function nudge(p, axis, dirSign, amt) {
    for (const s of [-1, 1]) {
      for (let k = 2; k <= 14; k += 2) {
        const ox = axis === 'x' ? s * k : dirSign * 3, oy = axis === 'y' ? s * k : dirSign * 3;
        if (!rectSolid(G.map, p.x + ox, p.y + oy, p.hw, p.hh, false, G.blockers, p)) {
          if (axis === 'y') moveActor(p, 0, s * Math.min(k, amt), G.blockers); else moveActor(p, s * Math.min(k, amt), 0, G.blockers);
          return;
        }
      }
    }
  }
  function playerAttack() {
    const p = G.player, cls = p.cls;
    p.atkCD = cls.cd; p.atkT = p.atkDur; p.swing++;
    if (cls.ranged) {
      let ax = p.aimX, ay = p.aimY;
      if (!ax && !ay) [ax, ay] = DIRV[p.dir];
      const mage = G.spec.hero.cls === 'mage';
      G.projectiles.push({ x: p.x + ax * 10, y: p.y - 6 + ay * 10, vx: ax * (mage ? 300 : 390), vy: ay * (mage ? 300 : 390), r: mage ? 5 : 3, dmg: atkOf(), owner: 'player', life: mage ? 0.75 : 0.62, color: mage ? '#b080ff' : '#e8d8b0', arrow: !mage });
      Sound.play('shoot');
      return;
    }
    Sound.play('swing');
    const [dx, dy] = DIRV[p.dir];
    const reach = G.spec.hero.cls === 'rogue' ? 18 : 21;
    const hit = { x: p.x + dx * reach, y: p.y - 2 + dy * reach, hw: dx ? 15 : 19, hh: dy ? 15 : 19 };
    for (const e of G.enemies) {
      if (e.dead || e.lastSwing === p.swing) continue;
      if (overlap(hit, e)) { e.lastSwing = p.swing; const ang = Math.atan2(e.y - p.y, e.x - p.x); damageEnemy(e, atkOf(), Math.cos(ang), Math.sin(ang)); }
    }
  }
  function drinkPotion() {
    const s = st(), p = G.player;
    if (p.potionCD > 0) return;
    if (s.potions <= 0) { UI.toast(`No ${G.spec.potion} left.`, 'warn'); Sound.play('error'); return; }
    if (s.hp >= s.maxHp) { UI.toast('Already at full health.'); return; }
    s.potions--; p.potionCD = 0.6;
    const heal = Math.round(s.maxHp * 0.45 + 15);
    s.hp = Math.min(s.maxHp, s.hp + heal);
    floatText(p.x, p.y - 24, '+' + heal, '#60f080'); burst(p.x, p.y - 8, '#60f080', 12); Sound.play('potion');
  }
  function hurtPlayer(raw, sx, sy) {
    const p = G.player, s = st();
    if (p.inv > 0 || G.mode === 'dead') return;
    const dmg = Math.max(1, Math.round(raw * rand(0.85, 1.15) - defOf() * 0.6));
    s.hp -= dmg; p.inv = 0.85;
    const a = Math.atan2(p.y - sy, p.x - sx);
    p.kbT = 0.14; p.kbx = Math.cos(a) * 240; p.kby = Math.sin(a) * 240;
    floatText(p.x, p.y - 26, '-' + dmg, '#ff5050');
    G.shake = 6; Sound.play('hurt');
    if (s.hp <= 0) { s.hp = 0; onDeath(); }
  }
  function gainXP(n) {
    const s = st();
    s.xp += n;
    let ups = 0;
    const gain = { warrior: 9, rogue: 7, mage: 6, ranger: 7 }[G.spec.hero.cls] || 8;
    while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; ups++; s.maxHp += gain; s.baseAtk += G.spec.hero.cls === 'mage' ? 2.5 : 2; s.baseDef += 1; s.hp = s.maxHp; }
    if (ups) {
      floatText(G.player.x, G.player.y - 34, 'LEVEL UP!', '#ffe060', 1.6);
      UI.toast(`Level ${s.level}! Max HP +${gain * ups}, ATK +${2 * ups}, DEF +${ups}. Fully healed.`, 'good');
      burst(G.player.x, G.player.y - 10, '#ffe060', 24); Sound.play('level');
    }
  }

  // ================= ENEMIES =================
  function damageEnemy(e, raw, kx, ky) {
    const dmg = Math.max(1, Math.round(raw * rand(0.85, 1.15) - e.def * 0.6));
    e.hp -= dmg; e.hurt = 0.12; e.state = 'chase';
    if (e.boss && e.beat) G.prog.bs.bossHp = e.hp; // a boss remembers its wounds if you step outside
    if (!e.boss || e.arch !== 'brute') { e.kbT = e.boss ? 0.05 : 0.13; e.kbx = kx * 230; e.kby = ky * 230; }
    if (e.boss && !e.awake) wakeBoss(e);
    floatText(e.x, e.y - 18 * (e.scale || 1), String(dmg), '#ffffff');
    burst(e.x, e.y - 6, (e.charLook && (e.charLook.color || e.charLook.shirt)) || e.look.color, 5);
    G.hitstop = 0.035; Sound.play('hit');
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true;
    const S = G.spec, P = G.prog;
    burst(e.x, e.y - 6, (e.charLook && (e.charLook.color || e.charLook.shirt)) || e.look.color, e.boss ? 60 : 16);
    Sound.play('kill');
    gainXP(e.xp); P.kills++;
    const coins = e.boss ? 8 : Math.random() < 0.55 ? 1 : 0;
    for (let i = 0; i < coins; i++) dropItem('coin', e.x, e.y, Math.max(1, Math.round((e.gold * rand(0.6, 1.4)) / (e.boss ? 8 : 1))));
    if (!e.boss && Math.random() < 0.1) dropItem('heart', e.x, e.y, 1);
    if (!e.boss && Math.random() < 0.035) dropItem('potion', e.x, e.y, 1);
    S.sideQuests.forEach((q, i) => {
      const qs = P.quests[i];
      if (q.type === 'kill' && qs.state === 'active' && q.target.toLowerCase() === e.name.toLowerCase()) {
        qs.kills++;
        const giver = charById(q.giver);
        if (qs.kills >= q.count) { qs.state = 'ready'; UI.toast(`Side quest done! Go back to ${giver ? giver.display : 'them'}.`, 'good'); Sound.play('chest'); }
        else UI.toast(`${plural(q.target)}: ${qs.kills}/${q.count}`);
      }
    });
    if (e.boss) {
      G.bossActive = null; G.shake = e.isVillain ? 16 : 10;
      for (const m of G.enemies) if (m.minion) m.dead = true;
      G.projectiles = G.projectiles.filter((pr) => pr.owner === 'player');
      UI.toast(`${e.name} is defeated!`, 'good');
    }
    Story.onKill(e);
  }
  function enemyAI(e, dt) {
    const p = G.player;
    e.t += dt; if (e.hurt > 0) e.hurt -= dt;
    if (e.kbT > 0) { e.kbT -= dt; moveActor(e, e.kbx * dt, e.kby * dt); return; }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const aggro = (e.arch === 'caster' ? 7 : 5.5) * TS;
    if (d > 26 * TS) { e.moving = false; return; }
    if (e.state === 'idle' && d < aggro) e.state = 'chase';
    if (e.state === 'chase' && d > aggro * 2.2 && !e.minion && !e.beat) e.state = 'idle';
    let mx = 0, my = 0, spd = e.spd;
    const ux = dx / d, uy = dy / d;
    if (e.state === 'idle') {
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = rand(1.2, 3);
        const hx = e.homeX - e.x, hy = e.homeY - e.y;
        if (Math.hypot(hx, hy) > 4 * TS) { const l = Math.hypot(hx, hy); e.wx = hx / l; e.wy = hy / l; }
        else if (Math.random() < 0.4) { e.wx = 0; e.wy = 0; }
        else { const a = rand(0, Math.PI * 2); e.wx = Math.cos(a); e.wy = Math.sin(a); }
      }
      mx = e.wx; my = e.wy; spd *= 0.4;
    } else {
      switch (e.arch) {
        case 'slime':
          e.hopT -= dt;
          if (e.hopping) { mx = e.dashX; my = e.dashY; spd *= 2.6; if (e.hopT <= 0) { e.hopping = false; e.hopT = rand(0.7, 1.1); } }
          else if (e.hopT <= 0) { e.hopping = true; e.hopT = 0.32; e.dashX = ux; e.dashY = uy; }
          break;
        case 'beast':
          e.cd -= dt;
          if (e.dashT > 0) { e.dashT -= dt; mx = e.dashX; my = e.dashY; spd *= 2.6; }
          else { mx = ux; my = uy; if (d < 3 * TS && e.cd <= 0) { e.dashT = 0.28; e.cd = rand(2, 3); e.dashX = ux; e.dashY = uy; } }
          break;
        case 'flyer': { const w = Math.sin(e.t * 4 + e.seed) * 0.9; mx = ux - uy * w; my = uy + ux * w; break; }
        case 'caster':
          if (d < 3.2 * TS) { mx = -ux; my = -uy; }
          else if (d > 6 * TS) { mx = ux; my = uy; }
          else { const s = Math.sin(e.t * 0.8 + e.seed) > 0 ? 1 : -1; mx = -uy * s * 0.6; my = ux * s * 0.6; }
          e.shootT -= dt;
          if (e.shootT < 0.35 && e.shootT > 0) e.charge = 0.35;
          if (e.shootT <= 0) { e.charge = 0; e.shootT = rand(1.8, 2.6); if (d < 9 * TS) { enemyShot(e, Math.atan2(dy, dx), 165, e.atk, 5, Art.shade(e.look.color, 0.4)); Sound.play('eshoot'); } }
          break;
        case 'brute':
          e.cd -= dt;
          if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) e.dashT = 0.45; }
          else if (e.dashT > 0) { e.dashT -= dt; mx = e.dashX; my = e.dashY; spd *= 4; }
          else { mx = ux; my = uy; if (d < 5 * TS && e.cd <= 0) { e.windup = 0.55; e.cd = rand(3, 4.5); e.dashX = ux; e.dashY = uy; } }
          break;
        default: { const w = Math.sin(e.t * 2 + e.seed) * 0.35; mx = ux - uy * w; my = uy + ux * w; }
      }
    }
    // walk around whatever is in the way instead of pushing against it
    if (e.detourT > 0) { e.detourT -= dt; if (e.dashT <= 0 && !e.hopping) { mx = e.dtx; my = e.dty; } }
    const l = Math.hypot(mx, my);
    e.moving = l > 0.01;
    if (e.moving) {
      mx /= l; my /= l;
      const r = moveActor(e, mx * spd * dt, my * spd * dt);
      if ((r.bx || r.by) && e.state === 'chase' && !(e.detourT > 0) && e.dashT <= 0) {
        const opts = r.bx ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
        const pref = r.bx ? Math.sign(dy) || 1 : Math.sign(dx) || 1;
        opts.sort((a, b) => (b[0] + b[1]) * pref - (a[0] + a[1]) * pref);
        const free = opts.find(([ox, oy]) => !rectSolid(G.map, e.x + ox * 12, e.y + oy * 12, e.hw, e.hh, e.flyer)) || opts[(Math.random() * 2) | 0];
        e.dtx = free[0]; e.dty = free[1]; e.detourT = rand(0.35, 0.7);
      }
      if ((r.bx || r.by) && e.state === 'idle') e.wanderT = 0;
      if ((r.bx || r.by) && e.dashT > 0 && e.arch === 'brute') { e.dashT = 0; G.shake = 4; }
      e.walkT += dt * 10;
      if (Math.abs(mx) > Math.abs(my)) e.dir = mx < 0 ? 'left' : 'right'; else e.dir = my < 0 ? 'up' : 'down';
      if (Math.abs(mx) > 0.2) e.face = mx < 0 ? -1 : 1;
    }
    if (overlap(e, G.player)) hurtPlayer(e.atk * (e.dashT > 0 ? 1.3 : 1), e.x, e.y);
  }
  function wakeBoss(e) {
    if (e.awake) return;
    e.awake = true; e.state = 'chase'; G.bossActive = e;
    Sound.play('boss');
    G.player.inv = 1.2;
    const ch = charById(e.char);
    const bi = G.prog.beat;
    const last = !G.spec.beats.slice(bi + 1).some((b) => b.obj.type === 'boss');
    banner(e.name, last ? 'The final battle!' : 'Battle!');
    const q = ch && ch.quotes.filter((q) => q.b === bi).pop();
    const v = ch && ['robot', 'ghost', 'zombie', 'animal'].includes(ch.voice) ? ch.voice : 'evil';
    let line = q ? q.text : fill(pick(LIB.LINES.greet[ch && ch.animal && !ch.quotes.length ? 'animal' : v] || LIB.LINES.greet.evil), ch);
    if (ch && ch.animal && !ch.quotes.length) line = '*snarls* ' + line;
    UI.say([{ name: e.name, text: line }]);
  }
  function enemyShot(e, ang, spd, dmg, r, color) {
    G.projectiles.push({ x: e.x, y: e.y - 8 * (e.scale || 1), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: r || 5, dmg, owner: 'enemy', life: 3.2, color: color || '#ff70ff' });
  }
  function radial(e, n, spd, dmg, off = 0, color) { for (let i = 0; i < n; i++) enemyShot(e, off + (i / n) * Math.PI * 2, spd, dmg, 5, color); Sound.play('eshoot'); }
  function bossAI(e, dt) {
    const p = G.player;
    e.t += dt; if (e.hurt > 0) e.hurt -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (!e.awake) {
      e.moving = false;
      const room = G.map.kind === 'dungeon' && G.map.bossRoom;
      const inRoom = room && p.x > room.x * TS && p.x < (room.x + room.w) * TS && p.y > room.y * TS && p.y < (room.y + room.h) * TS;
      if (inRoom || d < 4.5 * TS) wakeBoss(e);
      return;
    }
    if (e.kbT > 0) { e.kbT -= dt; moveActor(e, e.kbx * dt, e.kby * dt); return; }
    const ux = dx / d, uy = dy / d;
    const hpR = e.hp / e.maxHp;
    const col = e.isVillain ? '#ff50ff' : '#ff9a40';
    const dmg = e.atk * 0.8;
    let mx = 0, my = 0, spd = e.spd;
    e.attackT -= dt; e.cd -= dt;
    if (e.isVillain) {
      const ph = hpR > 0.66 ? 1 : hpR > 0.33 ? 2 : 3;
      if (ph !== e.phase) { e.phase = ph; G.shake = 10; UI.toast(ph === 2 ? `${e.name} is getting angry!` : `${e.name} unleashes everything!`, 'warn'); Sound.play('boss'); }
      if (ph === 1 && e.attackT <= 0) { e.attackT = 1.7; const a = Math.atan2(dy, dx); for (const o of [-0.25, 0, 0.25]) enemyShot(e, a + o, 185, dmg, 6, col); Sound.play('eshoot'); }
      if (ph === 2) {
        if (e.attackT <= 0) { e.attackT = 2.4; if (Math.random() < 0.5) radial(e, 12, 145, dmg, e.t, col); else { const a = Math.atan2(dy, dx); for (let o = -2; o <= 2; o++) enemyShot(e, a + o * 0.2, 200, dmg, 6, col); Sound.play('eshoot'); } }
        e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 9; summonMinions(e, 2); }
      }
      if (ph === 3) {
        e.spiralT -= dt;
        if (e.spiralT <= 0) { e.spiralT = 0.15; e.spiralA += 0.42; enemyShot(e, e.spiralA, 135, dmg * 0.8, 5, col); enemyShot(e, e.spiralA + Math.PI, 135, dmg * 0.8, 5, col); }
        e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 12; summonMinions(e, 2); }
      }
      spd *= ph === 3 ? 1.2 : 1;
    } else {
      const enraged = hpR < 0.5;
      if (e.attackT <= 0) {
        e.attackT = enraged ? 2.3 : 3.2;
        if (e.arch === 'caster' || e.arch === 'flyer' || Math.random() < 0.5) radial(e, enraged ? 12 : 8, 140, dmg, Math.random(), col);
        else { const a = Math.atan2(dy, dx); for (const o of [-0.3, -0.1, 0.1, 0.3]) enemyShot(e, a + o, 180, dmg, 6, col); Sound.play('eshoot'); }
      }
    }
    if (e.windup > 0) { e.windup -= dt; if (e.windup <= 0) e.dashT = 0.5; }
    else if (e.dashT > 0) { e.dashT -= dt; mx = e.dashX; my = e.dashY; spd *= 3.4; }
    else {
      if (e.arch === 'caster') { if (d < 3.5 * TS) { mx = -ux; my = -uy; } else if (d > 5.5 * TS) { mx = ux; my = uy; } else { mx = -uy * 0.7; my = ux * 0.7; } }
      else { mx = ux; my = uy; }
      if (e.cd <= 0 && d < 7 * TS && e.arch !== 'caster') { e.windup = 0.65; e.cd = rand(3.5, 5); e.dashX = ux; e.dashY = uy; }
    }
    const l = Math.hypot(mx, my);
    e.moving = l > 0.01;
    if (e.moving) {
      mx /= l; my /= l;
      const r = moveActor(e, mx * spd * dt, my * spd * dt);
      if ((r.bx || r.by) && e.dashT > 0) { e.dashT = 0; G.shake = 6; }
      e.walkT += dt * 9;
      if (Math.abs(mx) > Math.abs(my)) e.dir = mx < 0 ? 'left' : 'right'; else e.dir = my < 0 ? 'up' : 'down';
      if (Math.abs(mx) > 0.2) e.face = mx < 0 ? -1 : 1;
    }
    if (overlap(e, p)) hurtPlayer(e.atk * (e.dashT > 0 ? 1.4 : 1), e.x, e.y);
  }
  function summonMinions(e, n) {
    if (G.enemies.filter((m) => m.minion && !m.dead).length >= 5) return;
    const S = G.spec;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const x = e.x + Math.cos(a) * 50, y = e.y + Math.sin(a) * 50;
      if (rectSolid(G.map, x, y, 10, 10)) continue;
      const m = makeEnemy({ type: rand(0, S.enemies.length) | 0, level: Math.max(1, e.level - 3), x: Math.floor(x / TS), y: Math.floor(y / TS) });
      m.x = x; m.y = y; m.state = 'chase'; m.minion = true;
      G.enemies.push(m);
      burst(x, y, '#c070ff', 14);
    }
  }

  // ================= PROJECTILES, DROPS, FX =================
  function updateProjectiles(dt) {
    const p = G.player;
    for (const pr of G.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
      if (projBlocked(G.map, tx, ty)) { pr.life = 0; burst(pr.x, pr.y, pr.color, 4); continue; }
      if (pr.owner === 'player') {
        for (const e of G.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - pr.x) < e.hw + pr.r && Math.abs(e.y - pr.y + 4) < e.hh + pr.r + 4) { const l = Math.hypot(pr.vx, pr.vy); damageEnemy(e, pr.dmg, pr.vx / l, pr.vy / l); pr.life = 0; break; }
        }
      } else if (Math.abs(p.x - pr.x) < p.hw + pr.r - 1 && Math.abs(p.y - 4 - pr.y) < p.hh + pr.r + 2) { hurtPlayer(pr.dmg, pr.x - pr.vx, pr.y - pr.vy); pr.life = 0; }
    }
    G.projectiles = G.projectiles.filter((pr) => pr.life > 0);
  }
  const LOW_D = new Set([DT.FENCE, DT.BENCH, DT.LOG, DT.TABLE, DT.BED, DT.HOSPITALBED, DT.COUNTER, DT.PEW, DT.HAY, DT.BUSH, DT.CAMPFIRE, DT.WELL, DT.CAR, DT.TIRE, DT.LABTABLE, DT.DESK]);
  function projBlocked(map, tx, ty) {
    if (!map.inb(tx, ty)) return true;
    const i = ty * map.w + tx, g = map.g[i], d = map.d[i];
    if (g === GT.WALL || g === GT.VOID) return true;
    return !PASS_D[d] && !LOW_D.has(d);
  }
  function dropItem(type, x, y, amt) { G.drops.push({ type, x: x + rand(-6, 6), y: y + rand(-4, 4), z: 0, vz: rand(90, 140), vx: rand(-50, 50), vy: rand(-30, 30), amt, t: 0, life: 25 }); }
  function updateDrops(dt) {
    const p = G.player, s = st(), S = G.spec;
    for (const d of G.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 400 * dt; d.z = Math.max(0, d.z + d.vz * dt);
        const nx = d.x + (d.vx || 0) * dt, ny = d.y + (d.vy || 0) * dt;
        if (!G.map.solid(Math.floor(nx / TS), Math.floor(ny / TS))) { d.x = nx; d.y = ny; }
        if (d.z === 0) d.vz = 0;
      }
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist < 44 && d.t > 0.35) { d.x += ((p.x - d.x) / dist) * 220 * dt; d.y += ((p.y - d.y) / dist) * 220 * dt; }
      if (dist < 16 && d.t > 0.3) {
        d.gone = true;
        if (d.type === 'coin') { s.gold += d.amt; Sound.play('coin'); floatText(p.x, p.y - 22, `+${d.amt}`, '#ffe060'); }
        if (d.type === 'heart') { const h = Math.round(s.maxHp * 0.12); s.hp = Math.min(s.maxHp, s.hp + h); Sound.play('potion'); floatText(p.x, p.y - 22, `+${h}`, '#60f080'); }
        if (d.type === 'potion') { if (s.potions < 9) { s.potions++; UI.toast(`Found a ${S.potion}!`); } else s.gold += 10; Sound.play('coin'); }
      }
      d.life -= dt; if (d.life <= 0) d.gone = true;
    }
    G.drops = G.drops.filter((d) => !d.gone);
    for (const o of G.objects) if ((o.kind === 'questitem' || o.kind === 'item') && !o.gone && Math.hypot(p.x - o.x, p.y - o.y) < 18) takeItem(o);
  }
  function takeItem(o) {
    if (o.gone) return;
    o.gone = true;
    G.objects = G.objects.filter((x) => x !== o);
    if (o.kind === 'questitem') return takeQuestItem(o);
    const it = objById(o.obj) || { display: 'item', color: '#fff' };
    Sound.play('chest'); burst(o.x, o.y - 8, it.color || '#ffe060', 14);
    floatText(o.x, o.y - 22, it.display, '#ffe9a0', 1.4);
    UI.toast(`Found: ${it.display}`, 'good');
    Story.onPickup(o.obj);
  }
  function takeQuestItem(o) {
    const S = G.spec, P = G.prog, qi = o.def.quest, q = S.sideQuests[qi];
    P.taken[o.def.id] = true; P.quests[qi].found = true;
    if (P.quests[qi].state === 'active') P.quests[qi].state = 'ready';
    const giver = charById(q.giver);
    UI.toast(`Found: ${q.item}! ${P.quests[qi].state === 'ready' ? 'Bring it back to ' + (giver ? giver.display : 'its owner') + '.' : 'Someone might be missing this.'}`, 'good');
    Sound.play('chest');
  }
  function floatText(x, y, text, color, life = 0.9) { G.texts.push({ x, y, text, color, life, max: life }); }
  function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(30, 140); G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rand(0.3, 0.7), max: 0.7, color, size: rand(1.5, 3.5) }); } }
  function updateFx(dt) {
    for (const t of G.texts) { t.y -= 28 * dt; t.life -= dt; }
    G.texts = G.texts.filter((t) => t.life > 0);
    for (const q of G.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt; q.vx *= 0.96; q.life -= dt; }
    G.particles = G.particles.filter((q) => q.life > 0);
    if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
  }

  // ================= TURNING THE TEXT INTO SCENES =================
  const normQ = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = (s) => (String(s).match(/[A-Za-z0-9']+/g) || []).length;
  // which character says this quote? the story parser already attributed most of them
  function speakerOf(qtext, bi, around) {
    const n = normQ(qtext);
    for (const c of G.chars) for (const q of c.quotes) if (q.b === bi && normQ(q.text) === n) return c;
    for (const c of G.chars) for (const q of c.quotes) if (normQ(q.text) === n) return c;
    const a = ' ' + normQ(around) + ' ';
    for (const c of G.chars) {
      const keys = [c.name, c.role, c.animal, c.display].filter(Boolean).map(normQ).filter((k) => k.length > 2);
      if (keys.some((k) => a.includes(' ' + k + ' '))) return c;
    }
    return null;
  }
  const heroLabel = () => (G.spec.hero.display === 'You' ? 'You' : G.spec.hero.name);
  // story sentences become narration pages, and the quotes inside them become speech
  function storyPages(sentences, bi, head) {
    const out = [];
    const QRE = /["“]([^"”]{2,})["”]/g;
    for (const s of sentences) {
      const qs = [...String(s).matchAll(QRE)];
      if (!qs.length) { out.push({ narr: true, name: head, text: s }); continue; }
      let last = 0;
      qs.forEach((m, k) => {
        const before = s.slice(last, m.index).trim();
        const after = k === qs.length - 1 ? s.slice(m.index + m[0].length).trim() : '';
        const ctx = before + ' ' + after;
        if (words(before) > 3) out.push({ narr: true, name: head, text: before.replace(/[,:;]\s*$/, '.').replace(/\s+(and\s+)?(said|says|asked|cried|shouted|whispered|replied|yelled|called)\.$/i, '.') });
        const who = speakerOf(m[1], bi, ctx);
        let t = m[1].trim().replace(/,$/, '.');
        if (!/[.!?…]$/.test(t)) t += '.';
        out.push({ name: who ? who.display : heroLabel(), text: t, speaker: who ? who.id : 'hero' });
        if (after && words(after.replace(/^(said|says|asked|cried|shouted|whispered|replied|yelled|called|answered|laughed|growled|roared)\b.*?(\.|,)/i, '')) > 4) out.push({ narr: true, name: head, text: after.replace(/^[,.]\s*/, '') });
        last = m.index + m[0].length;
      });
    }
    return out;
  }
  // join short narration lines into fuller pages
  function mergeNarr(pages) {
    const out = [];
    for (const p of pages) {
      const last = out[out.length - 1];
      if (p.narr && last && last.narr && last.name === p.name && (last.text + ' ' + p.text).length < 230) last.text += ' ' + p.text;
      else out.push(Object.assign({}, p));
    }
    return out;
  }
  function greetFor(c) {
    const L = LIB.LINES.greet;
    if (c.kind === 'animal' && !c.quotes.length) return fill(pick(L.animal), c);
    return fill(pick(L[c.voice] || L[c.mood] || L.plain), c);
  }
  // fill a dialogue template from the library
  function fill(t, c, o) {
    const S = G.spec;
    const b = Story.cur();
    o = o || (b && b.obj) || {};
    const ch = o.char && charById(o.char), it = o.item && objById(o.item);
    const snd = (c && (c.sound || (c.animal && LIB.ANIMALS[c.animal] && LIB.ANIMALS[c.animal].sound))) || '...';
    return String(t)
      .replace(/\{hero\}/g, heroName()).replace(/\{HERO\}/g, heroName().toUpperCase())
      .replace(/\{heroNoun\}/g, (S.hero.role || 'hero').toLowerCase())
      .replace(/\{place\}/g, o.place ? placeName(o.place) : currentPlaceName())
      .replace(/\{dir\}/g, dirTo(o.place))
      .replace(/\{item\}/g, it ? it.display : 'it').replace(/\{itemPlural\}/g, it ? plural(it.display) : 'them')
      .replace(/\{count\}/g, String(o.count || 3)).replace(/\{char\}/g, ch ? ch.display : 'someone')
      .replace(/\{creatures\}/g, plural(o.creature || o.guard || S.enemies[0].name))
      .replace(/\{sound\}/g, snd).replace(/\{name\}/g, c ? c.display : '');
  }
  function overPos(mapId) {
    if (mapId === 'over') return null;
    const p = G.world.maps.over.portals.find((q) => q.to === mapId);
    return p ? { x: p.x, y: p.y } : null;
  }
  function dirTo(pid) {
    const a = pid && G.world.anchors[pid];
    if (!a) return 'road';
    const t = a.map === 'over' ? a : overPos(a.map) || a;
    const me = G.map.id === 'over' ? { x: G.player.x / TS, y: G.player.y / TS } : overPos(G.map.id) || t;
    if (Math.hypot(t.x - me.x, t.y - me.y) < 6) return 'right around here';
    return RPG.dirName(t.x - me.x, t.y - me.y);
  }
  function currentPlaceName() {
    if (G.map && G.map.kind !== 'over') return G.map.name;
    return G.zoneName || (G.map ? G.map.name : '');
  }

  // ================= NPCs + INTERACTION =================
  function updateNPC(n, dt) {
    const c = n.data, p = G.player;
    const near = Math.hypot(p.x - n.x, p.y - n.y) < 50;
    if (near) {
      n.mx = n.my = 0; n.moving = false;
      const ddx = p.x - n.x, ddy = p.y - n.y;
      n.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx < 0 ? 'left' : 'right') : ddy < 0 ? 'up' : 'down';
      n.face = ddx < 0 ? -1 : 1;
      return;
    }
    if (n.captive || c.job === 'shop' || c.job === 'inn') return;
    const range = c.kind === 'animal' ? 56 : 36, spd = c.kind === 'animal' ? 40 : 28;
    n.wanderT -= dt;
    if (n.wanderT <= 0) {
      n.wanderT = rand(1.5, 4);
      if (Math.random() < 0.45 || Math.hypot(n.x - n.hx, n.y - n.hy) > range) { const hx = n.hx - n.x, hy = n.hy - n.y, l = Math.hypot(hx, hy); n.mx = l > 4 ? hx / l : 0; n.my = l > 4 ? hy / l : 0; }
      else { const a = rand(0, Math.PI * 2); n.mx = Math.cos(a); n.my = Math.sin(a); }
    }
    n.moving = !!(n.mx || n.my);
    if (n.moving) {
      const bx = n.x, by = n.y;
      moveActor(n, n.mx * spd * dt, n.my * spd * dt, [G.player, ...G.blockers]);
      if (n.x === bx && n.y === by) n.mx = n.my = 0;
      n.walkT += dt * 8;
      if (Math.abs(n.mx) > Math.abs(n.my)) n.dir = n.mx < 0 ? 'left' : 'right'; else n.dir = n.my < 0 ? 'up' : 'down';
      if (n.mx) n.face = n.mx < 0 ? -1 : 1;
    }
  }
  function findInteractable() {
    const p = G.player;
    const [dx, dy] = DIRV[p.dir];
    const px = p.x + dx * 16, py = p.y + dy * 16;
    let best = null, bd = 30;
    const all = [...G.npcs, ...G.objects];
    // the story's current target (person, sparkle or item) wins when several things are in reach
    const prio = (o) => (o.kind === 'npc' && isTargetChar(o.data.id)) || o.beat ? 14 : 0;
    for (const o of all) { const d = Math.hypot(o.x - px, o.y - py) - prio(o); if (d < bd) { bd = d; best = o; } }
    if (!best) for (const o of all) { const d = Math.hypot(o.x - p.x, o.y - p.y) - prio(o); if (d < 30 && d < bd + 10) { best = o; bd = d; } }
    if (!best) {
      const tx = Math.floor((p.x + dx * 18) / TS), ty = Math.floor((p.y - 2 + dy * 18) / TS);
      const d = G.map.de(tx, ty);
      if (REST_DECO.has(d)) best = { kind: 'rest', x: tx * TS + 16, y: ty * TS + 16, d };
      else if (LOOK_DECO.has(d)) best = { kind: 'look', x: tx * TS + 16, y: ty * TS + 16, d, tx, ty };
      if (best && G.focus && G.focus.kind === best.kind && G.focus.x === best.x && G.focus.y === best.y) best = G.focus;
    }
    return best;
  }
  function interact(o) {
    const p = G.player;
    if (o.kind === 'npc') {
      const ddx = p.x - o.x, ddy = p.y - o.y;
      o.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx < 0 ? 'left' : 'right') : ddy < 0 ? 'up' : 'down';
      o.mx = o.my = 0;
      talkTo(o);
    } else if (o.kind === 'chest') openChest(o);
    else if (o.kind === 'sign') readSign(o);
    else if (o.kind === 'questitem' || o.kind === 'item') takeItem(o);
    else if (o.kind === 'marker') useMarker(o);
    else if (o.kind === 'rest') restAt(o);
    else if (o.kind === 'look') lookAt(o);
  }
  function talkTo(n) {
    const c = n.data;
    n.talks++;
    if (Story.talkHook(c)) return;
    if (c.job === 'shop') return UI.say([{ name: c.display, text: fill(pick(c.generated || c.voice === 'merchant' ? LIB.LINES.greet.merchant : LIB.LINES.greet[c.voice] || LIB.LINES.greet.merchant), c) }], () => openShop(c));
    if (c.job === 'inn') return innTalk(n);
    const qi = G.spec.sideQuests.findIndex((q) => q.giver === c.id);
    if (qi >= 0 && G.prog.quests[qi].state !== 'done' && !(G.prog.quests[qi].state === 'none' && n.talks === 1 && c.quotes.length)) return questTalk(n, qi);
    chatter(n);
  }
  function chatter(n) {
    const c = n.data, P = G.prog, b = Story.cur(), bi = P.beat;
    const pages = [];
    const say = (t) => t && pages.push({ name: c.display, text: t });
    const animal = c.kind === 'animal' && !c.quotes.length;
    const G_ = LIB.LINES.greet;
    say(fill(pick(animal ? G_.animal : G_[c.voice] || G_[c.mood] || G_.plain), c));
    if (animal) { say(fill(pick(LIB.LINES.idle.animal), c)); return UI.say(pages); }
    const prev = G.spec.beats[bi - 1];
    if (prev && P.done[bi - 1] && (prev.obj.char === c.id || prev.chars.includes(c.id)) && n.talks <= 2) say(fill(pick(LIB.LINES.react.done), c));
    const now = c.quotes.filter((q) => q.b === bi);
    const past = c.quotes.filter((q) => q.b < bi);
    const ments = c.mentions.filter((m) => m.b <= bi);
    const k = n.talks - 1;
    if (now.length && k < 2) now.slice(0, 2).forEach((q) => say(q.text));
    else if (past.length && k % 2 === 0) say(past[(k / 2) % past.length | 0].text);
    else if (ments.length) say(speakAbout(c, ments[k % ments.length].text));
    if (P.ended) say(fill(pick(LIB.LINES.react.after), c));
    else if (b) say(hintLine(c));
    if (pages.length < 3) say(fill(pick(LIB.LINES.idle[c.role] || LIB.LINES.idle[c.job] || LIB.LINES.idle[c.voice] || LIB.LINES.idle.any), c));
    UI.say(pages.slice(0, 4));
  }
  function hintLine(c) {
    const b = Story.cur();
    if (!b || b.obj.char === c.id) return '';
    const o = b.obj;
    const pool = LIB.LINES.hint[o.type === 'use' ? 'inspect' : o.type];
    return pool ? fill(pick(pool), c, o) : '';
  }
  // a sentence about a character, said in their own words:
  // "Old Tobin the blacksmith remembers when..." -> "I remember when..."
  const reE = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function synonyms(table, w) { if (!w || !table[w]) return [w].filter(Boolean); const e = table[w]; return Object.keys(table).filter((k) => table[k] === e); }
  function firstPerson(v) {
    const irr = { has: 'have', is: 'am', does: 'do', goes: 'go', was: 'was' };
    if (irr[v]) return irr[v];
    if (/(ches|shes|sses|xes|zes|oes)$/.test(v)) return v.slice(0, -2);
    if (/ies$/.test(v) && v.length > 4) return v.slice(0, -3) + 'y';
    if (/[^su]s$/.test(v) && v.length > 3) return v.slice(0, -1);
    return v;
  }
  function speakAbout(c, s) {
    const H = G.spec.hero;
    let t = String(s).replace(/["“][^"”]*["”]/g, ' ').replace(/,?\s*(and\s+)?(said|asked|cried|replied|shouted|whispered|yelled|called|answered)\s*[,:.]?\s*$/i, '.').replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    if (words(t) < 3) return fill(pick(LIB.LINES.react.after), c);
    if (!/[.!?]$/.test(t)) t += '.';
    if (H.display !== 'You' && H.name) {
      const hn = reE(H.name);
      t = t.replace(new RegExp(`\\b${hn}'s\\b`, 'g'), 'your').replace(new RegExp(`\\b${hn} (was|is|has)\\b`, 'g'), (m, v) => 'you ' + ({ was: 'were', is: 'are', has: 'have' }[v])).replace(new RegExp(`\\b${hn}\\b`, 'g'), 'you');
    }
    const keys = [...new Set([c.name, c.display, ...synonyms(LIB.ROLES, c.role), ...synonyms(LIB.ANIMALS, c.animal)].filter((k) => k && k.length > 1))].sort((a, b) => b.length - a.length);
    const K = keys.map((k) => reE(k).replace(/\b(Mr|Mrs|Ms|Dr|St)\\?\.?\s+/g, '$1\\.?\\s+')).join('|');
    const key = `(?<!\\bof\\s(?:the\\s)?(?:[a-z]+\\s)?)(?:(?:the|a|an|old|young|little|brave|sly|evil|good|kind|wise|poor|great|grand|dear|my|our|your|her|his|their)\\s+){0,3}(?:${K})(?:,?\\s+(?:${K}),?)?`;
    const VERB = `(?:has|have|had|is|was|were|did|does|could|would|will|can|gave|told|said|went|ran|saw|took|made|came|found|got|left|brought|sent|kept|met|knew|thought|felt|stood|sat|fell|led|held|lost|won|wore|began|became|grew|flew|swam|ate|drank|sang|wrote|built|caught|fought|hid|stole|[a-z]+(?:s|ed))`;
    if (/^(asked|said|cried|replied|shouted|whispered|yelled|called|answered|laughed|growled)\b/i.test(t)) return fill(pick(LIB.LINES.react.after), c);
    const before = t;
    t = t.replace(new RegExp(`\\b${key}(?:,? the [a-z]+)?'s\\b`, 'gi'), 'my');
    t = t.replace(new RegExp(`\\b${key}\\b(?:,?\\s+(?:the|a|an|of the|from the)\\s+[a-z' -]+?,?|,\\s+[A-Z][\\w.]*(?:\\s+[A-Z][\\w.]*){0,2},)?\\s+(?=${VERB}\\b)`, 'gi'), 'I ');
    t = t.replace(/\bI (\w+)\b/g, (m, v) => 'I ' + firstPerson(v));
    t = t.replace(new RegExp(`\\b${key}\\b`, 'gi'), 'me');
    t = t.replace(/\b(his|her|its) own\b/g, 'my own').replace(/^me\b/, 'I');
    if (t !== before && /\b(I|my|me)\b/.test(t)) return cap(t);
    return fill(pick(LIB.LINES.react.memory), c).replace('{s}', t);
  }
  function questTalk(n, qi) {
    const S = G.spec, P = G.prog, s = st(), q = S.sideQuests[qi], qs = P.quests[qi], c = n.data, nm = c.display;
    if (qs.state === 'ready' || (q.type === 'fetch' && qs.found && qs.state !== 'none')) {
      return UI.say([{ name: nm, text: q.type === 'kill' ? `You did it! Those ${plural(q.target)} won't bother anyone for a while. Here, ${q.reward} ${S.currency} and a ${S.potion}.` : `My ${q.item}! I thought it was gone forever. Please, take ${q.reward} ${S.currency} and this ${S.potion}.` }], () => {
        qs.state = 'done'; s.gold += q.reward; s.potions = Math.min(9, s.potions + 1);
        gainXP(10 + s.level * 6);
        UI.toast(`Side quest complete! +${q.reward} ${S.currency}`, 'good'); Sound.play('chest'); saveGame(true);
      });
    }
    if (qs.state === 'active') return UI.say([{ name: nm, text: q.type === 'kill' ? `${plural(q.target)} defeated: ${qs.kills} of ${q.count}. Keep going!` : `Any luck finding my ${q.item}? I think I lost it around ${q.where || 'the wilds'}.` }]);
    const offer = q.type === 'kill' ? `${plural(q.target)} keep causing trouble around here. Could you defeat ${q.count} of them? I'll pay you ${q.reward} ${S.currency}.` : qs.found ? `Wait... is that my ${q.item}? You found it!` : `I lost my ${q.item} somewhere around ${q.where || 'the wilds'}. Could you look for it? I'll make it worth your while.`;
    if (q.type === 'fetch' && qs.found) { qs.state = 'ready'; return questTalk(n, qi); }
    UI.say([{ name: nm, text: fill(pick(LIB.LINES.greet[c.voice] || LIB.LINES.greet.plain), c) }, { name: nm, text: offer, choices: [
      { label: 'I\'ll do it.', fn: () => { qs.state = 'active'; UI.toast('Side quest: ' + questTitle(qi), 'good'); Sound.play('chest'); } },
      { label: 'Not right now.', fn: () => UI.toast('Come back any time.') },
    ] }]);
  }
  const questTitle = (qi) => { const q = G.spec.sideQuests[qi]; return q.type === 'kill' ? `Defeat ${q.count} ${plural(q.target)}` : `Find the ${q.item}`; };
  function openShop(c, sel) {
    const S = G.spec, s = st();
    const pot = S.difficulty === 3 ? 16 : 12;
    const items = [{ label: `${S.potion} (heals ~45%)`, right: `${pot} ${S.currency}`, disabled: s.gold < pot || s.potions >= 9, fn: () => { s.gold -= pot; s.potions++; Sound.play('coin'); openShop(c, 0); } }];
    if (s.wTier < 3) { const pr = WEAPON_PRICE[s.wTier + 1]; items.push({ label: `${S.weapons[s.wTier + 1]} (ATK +${WEAPON_BONUS[s.wTier + 1] - WEAPON_BONUS[s.wTier]})`, right: `${pr} ${S.currency}`, disabled: s.gold < pr, fn: () => { s.gold -= pr; s.wTier++; Sound.play('chest'); UI.toast(`Equipped ${S.weapons[s.wTier]}!`, 'good'); openShop(c, 1); } }); }
    if (s.aTier < 3) { const pr = ARMOR_PRICE[s.aTier + 1]; items.push({ label: `${S.armors[s.aTier + 1]} (DEF +${ARMOR_BONUS[s.aTier + 1] - ARMOR_BONUS[s.aTier]})`, right: `${pr} ${S.currency}`, disabled: s.gold < pr, fn: () => { s.gold -= pr; s.aTier++; Sound.play('chest'); UI.toast(`Equipped ${S.armors[s.aTier]}!`, 'good'); openShop(c, 2); } }); }
    items.push({ label: 'Leave', fn: () => { UI.closeMenu(); UI.toast(pick(['Come back soon!', 'Stay safe out there.', 'Pleasure doing business.'])); } });
    const title = c ? (/^the /i.test(c.display) ? c.display.replace(/^the /i, 'The ') + '\'s Goods' : c.display + '\'s Shop') : 'Market Stall';
    UI.menu(title, items, { sel, sub: `${s.gold} ${S.currency} · ${s.potions}/9 ${plural(S.potion)}`, body: `<p class="eq">Weapon: <b>${esc(S.weapons[s.wTier])}</b> · Armor: <b>${esc(S.armors[s.aTier])}</b></p>` });
  }
  function innTalk(n) {
    const S = G.spec, s = st(), c = n.data;
    const cost = 5 + s.level * 3;
    UI.say([{ name: c.display, text: `${fill(pick(LIB.LINES.greet[c.voice] || LIB.LINES.greet.friendly), c)} A bed is ${cost} ${S.currency}. You'll wake fully healed, and your story will be saved.`, choices: [
      { label: `Rest (${cost} ${S.currency})`, fn: () => {
        if (s.gold < cost) { UI.toast(`Not enough ${S.currency}.`, 'warn'); Sound.play('error'); return; }
        s.gold -= cost; s.hp = s.maxHp;
        G.transition = { t: 0, dur: 1.4, cb: () => {} };
        Sound.play('potion'); saveGame(true); UI.toast('You feel rested. Game saved.', 'good');
      } },
      { label: 'No thanks', fn: () => {} },
    ] }]);
  }
  function restAt(o) {
    const s = st();
    s.hp = s.maxHp;
    G.transition = { t: 0, dur: 1.4, cb: () => {} };
    Sound.play('potion'); saveGame(true);
    UI.toast(o.d === DT.CAMPFIRE ? 'You rest by the fire. Fully healed. Game saved.' : 'You lie down for a moment. Fully healed. Game saved.', 'good');
  }
  function storySoFar() {
    const P = G.prog, out = [];
    G.spec.beats.forEach((b, i) => { if (i < P.beat || P.ended) out.push(...b.intro, ...b.outro); else if (i === P.beat) out.push(...b.intro); });
    return out.length ? out : G.spec.beats[0].intro.concat(G.spec.beats[0].outro);
  }
  function lookAt(o) {
    const S = G.spec, sents = storySoFar();
    const sent = sents[(o.tx * 7 + o.ty * 13) % sents.length] || '';
    const d = o.d;
    let text;
    if (d === DT.BOOKSHELF) text = sent ? `You pull a book off the shelf. One page reads: "${sent}"` : 'Dusty books, full of old stories.';
    else if (d === DT.BLACKBOARD) text = `Someone has written on the board: "${Story.objectiveText() || S.title}"`;
    else if (d === DT.COMPUTER) text = `The screen glows. A message is open: "${sent || S.title}"`;
    else if (d === DT.WELL) text = 'You peer into the well. Your reflection looks back at you, ready for whatever comes next.';
    else if (d === DT.STATUE) { const who = G.chars.filter((c) => !c.hostile && !c.generated).sort((a, b) => b.mentions.length - a.mentions.length)[0]; text = who ? `A statue of ${who.display}. Someone left flowers at its feet.` : 'A weathered statue. It looks a little like you.'; }
    else if (d === DT.ALTAR) { const s = st(); s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.25)); Sound.play('potion'); text = 'The altar hums softly. A warm calm washes over you. (Healed a little.)'; }
    else if (d === DT.GRAVE) text = pick(['Here lies someone the story almost forgot.', 'The name on the stone has worn away.', 'Rest in peace.']);
    else if (d === DT.THRONE) text = 'A grand seat. You resist the urge to sit in it. Mostly.';
    else if (d === DT.FIREPLACE) text = 'The fire crackles and pops. It smells like home.';
    else if (d === DT.MACHINE) text = 'The machine whirs, blinks and beeps. You decide not to touch anything.';
    else if (d === DT.BIGTREE) text = 'An ancient tree. Its bark is carved with names and dates from long ago.';
    else if (d === DT.STALL) return openShop(null);
    else text = 'Nothing out of the ordinary.';
    UI.say([{ narr: true, name: '👁', text }]);
  }
  function useMarker(o) {
    G.objects = G.objects.filter((x) => x !== o);
    Sound.play('chest'); burst(o.x, o.y - 8, G.theme.accent, 18);
    Story.onUseMarker();
  }
  function openChest(o) {
    const S = G.spec, s = st(), P = G.prog;
    if (o.opened) { UI.toast('Empty.'); return; }
    o.opened = true; P.chests[o.def.id] = true;
    Sound.play('chest'); burst(o.x, o.y - 10, '#ffe060', 16);
    const c = o.def.contents;
    if (c.type === 'gold') { s.gold += c.amount; UI.toast(`Found ${c.amount} ${S.currency}!`, 'good'); }
    else if (c.type === 'potion') { const add = Math.min(c.amount, 9 - s.potions); s.potions += add; UI.toast(add ? `Found ${c.amount} ${c.amount > 1 ? plural(S.potion) : S.potion}!` : `Your bag is full. Sold the ${S.potion} for 20 ${S.currency}.`, 'good'); if (!add) s.gold += 20; }
    else if (c.type === 'weapon') { if (s.wTier < 4) { s.wTier++; UI.say([{ narr: true, name: '✦', text: `You found the ${S.weapons[s.wTier]}! Attack increased.` }]); } else { s.gold += 100; UI.toast(`Found 100 ${S.currency}!`, 'good'); } }
    else if (c.type === 'armor') { if (s.aTier < 4) { s.aTier++; UI.say([{ narr: true, name: '✦', text: `You found the ${S.armors[s.aTier]}! Defense increased.` }]); } else { s.gold += 80; UI.toast(`Found 80 ${S.currency}!`, 'good'); } }
    saveGame(true);
  }
  function readSign(o) {
    const d = o.def;
    G.prog.read[d.id] = true;
    UI.say([{ narr: true, name: d.title, text: d.pages.join(' ') }]);
  }
  function checkPortals() {
    const p = G.player;
    if (p.kbT > 0) return; // getting knocked back doesn't throw you out of the room
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    if (G.map.kind === 'over') {
      const e = G.map.portals.find((q) => q.x === tx && q.y === ty);
      if (e) G.transition = { t: 0, dur: 0.7, cb: () => loadMap(e.to) };
    } else if (G.map.gr(tx, ty) === GT.EXIT) {
      const back = overPos(G.map.id) || G.world.maps.over.spawn;
      G.transition = { t: 0, dur: 0.7, cb: () => loadMap('over', back.x, back.y + 1) };
    }
  }
  function updateTransition(dt) {
    const tr = G.transition, half = tr.dur / 2, before = tr.t;
    tr.t += dt;
    if (before < half && tr.t >= half && tr.cb) { tr.cb(); tr.cb = null; }
    if (tr.t >= tr.dur) G.transition = null;
  }

  // ================= MENUS =================
  function pauseMenu() {
    const S = G.spec, s = st();
    UI.menu('Paused', [
      { label: 'Resume', fn: () => UI.closeMenu() },
      { label: 'Journal: the story so far', fn: () => journal() },
      { label: 'Map', fn: () => { UI.closeMenu(); UI.openMap(); } },
      { label: 'Save game', fn: () => saveGame(false) },
      { label: 'Copy share link', fn: () => RPG.App.share(G.sourceText, G.spec) },
      { label: Sound.muted ? 'Sound: OFF' : 'Sound: ON', fn: () => { Sound.muted = !Sound.muted; pauseMenu(); } },
      { label: 'How to play', fn: () => UI.menu('How to play', [{ label: 'Back', fn: pauseMenu }], { body: controlsHTML() + `<p>Your story is split into chapters. The goal at the top of the screen tells you what happens next, and the yellow arrow points the way. Talk to people, walk into buildings, open chests and read signposts. Rest at beds and campfires to heal and save.</p>` }) },
      { label: 'Quit to title (auto-saves)', fn: () => { saveGame(true); UI.closeMenu(); quit(); } },
    ], { sub: `${S.title} · Level ${s.level}` });
  }
  function journal() {
    const S = G.spec, P = G.prog, s = st();
    const chapters = S.beats.map((b, i) => {
      if (P.done[i] || P.ended) return `<li class="done">✔ <b>Chapter ${i + 1}:</b> ${esc(Story.title(b))}</li>`;
      if (i === P.beat) return `<li class="cur">▶ <b>Chapter ${i + 1}:</b> ${esc(Story.title(b))} <i>— ${esc(Story.objectiveText(b))}</i></li>`;
      return `<li class="dim">◇ Chapter ${i + 1}: ???</li>`;
    }).join('');
    const tale = storySoFar().map((t) => `<p>${esc(t)}</p>`).join('');
    const met = G.chars.filter((c) => !c.generated && S.beats.some((b, i) => i <= P.beat && (b.chars.includes(c.id) || b.obj.char === c.id))).map((c) => `<span>${esc(c.display)}${c.role && normQ(c.role) !== normQ(c.display) ? ' <i>(' + esc(c.role) + ')</i>' : ''}${P.gone[c.id] ? ' ✝' : ''}</span>`).join('');
    const side = S.sideQuests.map((q, i) => {
      const qs = P.quests[i], giver = charById(q.giver);
      if (qs.state === 'none') return `<li class="dim">? ${esc(giver ? giver.display : 'Someone')} might need help</li>`;
      const prog = q.type === 'kill' ? ` ${Math.min(qs.kills, q.count)}/${q.count}` : qs.found ? ' (found)' : '';
      return `<li class="${qs.state === 'done' ? 'done' : ''}">${qs.state === 'done' ? '✔' : qs.state === 'ready' ? '★' : '◇'} ${esc(questTitle(i))}${prog} <i>— ${esc(giver ? giver.display : '')}</i></li>`;
    }).join('');
    const inv = Object.keys(P.inv).map((id) => { const o = objById(id); return o ? `<span>${esc(o.display)}${P.inv[id] > 1 ? ' ×' + P.inv[id] : ''}</span>` : ''; }).join('');
    const mins = Math.floor(P.time / 60);
    const body = `<p class="obj">▶ ${esc(Story.objectiveText())}</p><h4>Chapters</h4><ul>${chapters}</ul>
      <h4>The story so far</h4><div class="tale">${tale}</div>
      ${met ? `<h4>People you've met</h4><div class="stats">${met}</div>` : ''}
      ${inv ? `<h4>Carrying</h4><div class="stats">${inv}</div>` : ''}
      ${side ? `<h4>Side quests</h4><ul>${side}</ul>` : ''}
      <h4>${esc(S.hero.display === 'You' ? 'You' : S.hero.name)}</h4><div class="stats"><span>Level ${s.level}</span><span>HP ${Math.ceil(s.hp)}/${s.maxHp}</span><span>ATK ${Math.round(atkOf())}</span><span>DEF ${Math.round(defOf())}</span><span>${esc(S.weapons[s.wTier])}</span><span>${esc(S.armors[s.aTier])}</span><span>${s.gold} ${esc(S.currency)}</span><span>${mins} min</span><span>${P.kills} foes defeated</span></div>`;
    UI.menu('Journal', [{ label: 'Close', fn: () => UI.closeMenu() }], { body, wide: true, sub: S.title });
    setTimeout(() => { const t = document.querySelector('#menu-body .tale'); if (t) t.scrollTop = t.scrollHeight; }, 0);
  }
  function showEnding() {
    const S = G.spec, P = G.prog;
    const mins = Math.max(1, Math.floor(P.time / 60));
    UI.menu('The End', [
      { label: 'Keep exploring', fn: () => UI.closeMenu() },
      { label: 'Copy share link', fn: () => RPG.App.share(G.sourceText, G.spec) },
      { label: 'Read the whole story', fn: () => journal() },
      { label: 'Make a new story', fn: () => { UI.closeMenu(); quit(); } },
    ], { closable: false, wide: true, sub: S.title, body: `<p class="intro">${esc(S.ending)}</p><div class="stats"><span>${S.beats.length} chapters</span><span>Level ${st().level}</span><span>${mins} minute${mins > 1 ? 's' : ''}</span><span>${P.kills} foes defeated</span><span>${P.deaths} falls</span></div>` });
  }
  function onDeath() {
    const S = G.spec, s = st();
    G.mode = 'dead';
    Sound.play('die');
    const lost = Math.floor(s.gold * 0.2);
    const rs = G.world.maps.over.restSpot || G.world.maps.over.spawn;
    const home = placeName(S.startPlace);
    const villain = S.villain && charById(S.villain);
    setTimeout(() => {
      UI.menu('You have fallen…', [
        { label: `Wake up in ${home} (lose ${lost} ${S.currency})`, fn: () => { G.mode = null; UI.closeMenu(); s.hp = s.maxHp; s.gold -= lost; G.prog.deaths++; const sp = RPG.WorldGen.findFree(G.world.maps.over, rs.x, rs.y + 1, 4) || G.world.maps.over.spawn; loadMap('over', sp.x, sp.y); } },
        { label: 'Load last save', disabled: !hasSave(), fn: () => { G.mode = null; UI.closeMenu(); const d = readSave(); if (d) start(d.spec, d.prog, d.text); } },
      ], { closable: false, body: `<p>${esc(pick([villain ? `Somewhere, ${villain.display} laughs.` : 'Everything goes dark…', 'Darkness closes in… but this story isn\'t over yet.', 'Not like this. Not in this story.']))}</p>` });
    }, 900);
  }
  function quit() {
    G.active = false;
    UI.closeDialog(); UI.closeMap(); $('menu').classList.add('hidden'); UI.mode = null;
    $('game').classList.add('hidden');
    $('home').classList.remove('hidden');
    document.body.classList.remove('playing');
    RPG.App && RPG.App.refreshHome();
  }

  // ================= SAVING =================
  function saveGame(silent) {
    if (!G.map) return;
    const p = G.player;
    G.prog.pos = { x: Math.floor(p.x / TS), y: Math.floor(p.y / TS) };
    G.prog.map = G.map.id;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, spec: G.spec, prog: Object.assign({}, G.prog, { completing: false }), text: G.sourceText, at: Date.now() }));
      if (!silent) UI.toast('Game saved.', 'good');
    } catch (e) { if (!silent) UI.toast('Could not save (storage unavailable).', 'warn'); }
  }
  function readSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && d.v === 2 && d.spec && d.spec.version === 2 && d.prog ? d : null; } catch (e) { return null; } }
  function hasSave() { return !!readSave(); }
  function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  // ================= RENDERING =================
  const ANIM_D = new Set([DT.CAMPFIRE, DT.TORCH, DT.FIREPLACE, DT.CANDLE, DT.COMPUTER, DT.MACHINE]);
  const ANIM_G = new Set([GT.WATER, GT.LAVA, GT.MURK, GT.BRIDGE]);
  const BUILD_D = new Set([DT.ROOF, DT.FACADE, DT.DOOR]);
  function resize() {
    if (!canvas) return;
    const w = innerWidth, h = innerHeight;
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * G.dpr); canvas.height = Math.round(h * G.dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    let z = clamp(Math.max(Math.min(w / (16 * TS), h / (11.5 * TS)), Math.min(w / (11 * TS), h / (16 * TS))), 0.75, 3);
    z = Math.max(1, Math.round(TS * z * G.dpr)) / (TS * G.dpr);
    G.zoom = z; G.vw = w / z; G.vh = h / z; G.sw = w; G.sh = h;
  }
  function render() {
    const c = ctx, dpr = G.dpr, z = G.zoom;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, canvas.width, canvas.height);
    if (!G.map) return;
    const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
    const k = z * dpr;
    const ox = Math.round((G.camX + sx) * k), oy = Math.round((G.camY + sy) * k);
    c.setTransform(k, 0, 0, k, -ox, -oy);
    c.imageSmoothingEnabled = false;
    drawTiles(c);
    drawObjects(c);
    drawFx(c);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLighting(c, ox / dpr, oy / dpr);
    drawWeather(c);
    drawObjectiveArrow(c, ox / dpr, oy / dpr);
    drawHUD(c);
    drawBanner(c);
    if (G.transition) { const tr = G.transition, h = tr.dur / 2; c.fillStyle = `rgba(0,0,0,${clamp(tr.t < h ? tr.t / h : 1 - (tr.t - h) / h, 0, 1)})`; c.fillRect(0, 0, G.sw, G.sh); }
    if (G.mode === 'dead') { c.fillStyle = 'rgba(80,0,0,0.35)'; c.fillRect(0, 0, G.sw, G.sh); }
  }
  function drawTiles(c) {
    const map = G.map, k = map.kind === 'interior' ? 1 : 0;
    const x0 = Math.max(0, Math.floor(G.camX / TS) - 1), y0 = Math.max(0, Math.floor(G.camY / TS) - 1);
    const x1 = Math.min(map.w - 1, Math.floor((G.camX + G.vw) / TS) + 1), y1 = Math.min(map.h - 1, Math.floor((G.camY + G.vh) / TS) + 1);
    const f = Math.floor(G.time * 1.6) % 2;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * map.w + x;
        if (map.seen && !map.seen[i]) { c.fillStyle = '#000'; c.fillRect(x * TS, y * TS, TS, TS); continue; }
        const g = map.g[i], v = map.v[i];
        let gv = v & 7, ff = 0;
        if (g === GT.WALL) { const below = y + 1 < map.h ? map.g[i + map.w] : GT.WALL; gv = (below !== GT.WALL && below !== GT.VOID ? 8 : 0) + (v & 3); }
        else if (ANIM_G.has(g)) { gv = v & 3; ff = f; }
        c.drawImage(Tiles.ground(g, gv, ff, k), x * TS, y * TS);
        const d = map.d[i];
        if (d) c.drawImage(Tiles.deco(d, BUILD_D.has(d) ? v : v & 7, ANIM_D.has(d) ? f : 0), x * TS, y * TS);
      }
  }
  function isTargetChar(id) {
    const b = Story.cur();
    return b && b.obj.char === id && ['talk', 'receive', 'give', 'rescue'].includes(b.obj.type);
  }
  function drawObjects(c) {
    const p = G.player, time = G.time;
    const list = [];
    const vis = (o) => o.x > G.camX - 64 && o.x < G.camX + G.vw + 64 && o.y > G.camY - 64 && o.y < G.camY + G.vh + 96;
    const seen = (o) => !G.map.seen || G.map.seen[Math.floor(o.y / TS) * G.map.w + Math.floor(o.x / TS)];
    for (const o of G.objects) if (vis(o) && seen(o)) list.push(o);
    for (const n of G.npcs) if (vis(n) && seen(n)) list.push(n);
    for (const e of G.enemies) if (vis(e) && seen(e)) list.push(e);
    for (const d of G.drops) if (vis(d)) { d.kind = 'drop'; list.push(d); }
    list.push(p);
    list.sort((a, b) => (a.y + (a.hh || 0)) - (b.y + (b.hh || 0)));
    c.font = '6px "Press Start 2P", monospace'; c.textAlign = 'center';
    for (const o of list) {
      if (o === p) { drawPlayer(c); continue; }
      switch (o.kind) {
        case 'npc': {
          const L = o.look || {};
          Art.drawCharacter(c, o.x, o.y + o.hh, L, { dir: o.dir, face: o.face, moving: o.moving, walk: o.walkT }, time);
          const top = o.y + o.hh - 34 * (L.scale || 1) * (L.animal ? 0.75 : 1);
          if (o.captive && (G.prog.bs.guards || 0) > (G.prog.bs.killed || 0)) { c.strokeStyle = '#c8a050'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.x - 7, o.y - 2); c.lineTo(o.x + 7, o.y + 2); c.moveTo(o.x - 7, o.y + 2); c.lineTo(o.x + 7, o.y - 2); c.stroke(); }
          if (isTargetChar(o.data.id)) { const yy = top - 8 + Math.sin(time * 5) * 2; c.fillStyle = '#000'; c.fillRect(o.x - 2, yy - 9, 5, 12); c.fillStyle = '#ffe040'; c.fillRect(o.x - 1, yy - 8, 3, 7); c.fillRect(o.x - 1, yy, 3, 2); }
          else if (o.data.job === 'shop' || o.data.job === 'inn') { c.fillStyle = '#ffe9a0'; c.fillText(o.data.job === 'shop' ? '$' : 'Zz', o.x, top - 4); }
          if (Math.hypot(o.x - p.x, o.y - p.y) < 80) { const nm = o.data.display; const w = c.measureText(nm).width + 6; c.fillStyle = 'rgba(8,8,16,0.7)'; c.fillRect(o.x - w / 2, o.y + o.hh + 3, w, 9); c.fillStyle = o.data.hostile ? '#ff9a9a' : '#ffffff'; c.fillText(nm, o.x, o.y + o.hh + 10); }
          break;
        }
        case 'enemy':
          Art.drawEnemy(c, o, time);
          if (!o.boss && o.hp < o.maxHp) { const w = 20, yy = o.y - o.hh - 18 * (o.scale || 1) - (o.flyer ? 14 : 4); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(o.x - w / 2, yy, w, 3); c.fillStyle = '#e04040'; c.fillRect(o.x - w / 2, yy, (w * o.hp) / o.maxHp, 3); }
          break;
        case 'chest': Art.drawChest(c, o.x, o.y + o.hh, o.opened, G.theme); break;
        case 'sign':
          Art.drawSign(c, o.x, o.y + o.hh, o.def.style, G.theme);
          break;
        case 'questitem': Art.drawQuestItem(c, o.x, o.y + 6, time); break;
        case 'item': {
          const it = objById(o.obj) || {};
          const b = Math.sin(time * 3 + o.x) * 2;
          c.fillStyle = 'rgba(0,0,0,0.25)'; Art.ellipse(c, o.x, o.y + 6, 6, 2);
          c.fillStyle = 'rgba(255,240,150,' + (0.18 + Math.sin(time * 4) * 0.08) + ')'; Art.circle(c, o.x, o.y - 4 + b, 11);
          Art.drawIcon(c, o.x, o.y - 4 + b, it.icon, it.color, time, 1);
          const s = Math.abs(Math.sin(time * 6)) * 2 + 1; c.fillStyle = '#fff6c0'; c.fillRect(o.x + 7, o.y - 12 + b, s, s);
          break;
        }
        case 'marker': {
          const r = 8 + Math.sin(time * 4) * 2;
          c.strokeStyle = Art.rgba(G.theme.accent, 0.8); c.lineWidth = 1.5; c.beginPath(); c.arc(o.x, o.y + 2, r, 0, Math.PI * 2); c.stroke();
          for (let k = 0; k < 4; k++) { const a = time * 2 + k * 1.57; c.fillStyle = '#fff6c0'; c.fillRect(o.x + Math.cos(a) * r - 1, o.y + 2 + Math.sin(a) * r * 0.6 - 1, 2, 2); }
          c.fillStyle = '#ffe040'; c.fillText('?', o.x, o.y - 10 + Math.sin(time * 5) * 2);
          break;
        }
        case 'drop': {
          const yy = o.y - (o.z || 0);
          if (o.type === 'coin') Art.drawCoin(c, o.x, yy, time + o.x);
          else if (o.type === 'potion') Art.drawPotion(c, o.x, yy, time);
          else if (o.type === 'heart') { c.fillStyle = '#e04050'; Art.circle(c, o.x - 2.5, yy - 7, 3); Art.circle(c, o.x + 2.5, yy - 7, 3); Art.tri(c, o.x - 5.5, yy - 6, o.x + 5.5, yy - 6, o.x, yy); }
          break;
        }
      }
    }
    c.textAlign = 'left';
    if (G.focus && !UI.mode) {
      const f = G.focus;
      const label = f.kind === 'npc' ? 'Talk' : f.kind === 'chest' ? (f.opened ? '' : 'Open') : f.kind === 'sign' ? 'Read' : f.kind === 'marker' ? f.label : f.kind === 'rest' ? 'Rest' : f.kind === 'look' ? (f.d === DT.STALL ? 'Shop' : 'Look') : 'Take';
      if (label) {
        const yy = f.y - (f.kind === 'npc' ? 44 : 30) + Math.sin(time * 5) * 1.5;
        c.font = '7px "Press Start 2P", monospace';
        const txt = `E ${label}`;
        const w = c.measureText(txt).width + 8;
        c.fillStyle = 'rgba(10,10,20,0.85)'; Art.rrect(c, f.x - w / 2, yy - 9, w, 12, 3);
        c.fillStyle = '#ffe9a0'; c.textAlign = 'center'; c.fillText(txt, f.x, yy); c.textAlign = 'left';
      }
    }
  }
  function drawPlayer(c) {
    const p = G.player, time = G.time;
    if (p.inv > 0 && Math.floor(time * 20) % 2 === 0 && G.mode !== 'dead') return;
    const st = { dir: p.dir, face: p.face, moving: p.moving, walk: p.walkT };
    if (p.atkT > 0 && !p.cls.ranged) {
      const prog = 1 - p.atkT / p.atkDur;
      const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.dir];
      const a = base - 1.1 + prog * 2.2;
      const cx = p.x, cy = p.y - 6;
      if (p.dir === 'up') drawWeapon(c, cx, cy, a);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(cx, cy, 22, Math.max(base - 1.1, a - 0.9), a); c.stroke();
      Art.drawCharacter(c, p.x, p.y + p.hh, p.look, st, time);
      if (p.dir !== 'up') drawWeapon(c, cx, cy, a);
      return;
    }
    Art.drawCharacter(c, p.x, p.y + p.hh, p.look, st, time);
  }
  function drawWeapon(c, cx, cy, a) {
    const tip = 24;
    const glow = ['scifi', 'alien', 'city', 'modern'].includes(G.spec.theme);
    c.strokeStyle = glow ? '#60f0ff' : '#e8eef4'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7); c.lineTo(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip); c.stroke();
    c.strokeStyle = '#a07a3a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4); c.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); c.stroke();
  }
  function drawFx(c) {
    for (const pr of G.projectiles) {
      if (pr.arrow) {
        const l = Math.hypot(pr.vx, pr.vy), ux = pr.vx / l, uy = pr.vy / l;
        Art.line(c, pr.x - ux * 9, pr.y - uy * 9, pr.x + ux * 4, pr.y + uy * 4, 1.6, '#c8a878');
        c.fillStyle = '#e8eef4'; Art.tri(c, pr.x + ux * 7, pr.y + uy * 7, pr.x - uy * 3, pr.y + ux * 3, pr.x + uy * 3, pr.y - ux * 3);
      } else {
        c.fillStyle = Art.rgba(pr.color, 0.3); Art.circle(c, pr.x, pr.y, pr.r + 3);
        c.fillStyle = pr.color; Art.circle(c, pr.x, pr.y, pr.r);
        c.fillStyle = '#ffffff'; Art.circle(c, pr.x - pr.r * 0.3, pr.y - pr.r * 0.3, pr.r * 0.35);
      }
    }
    for (const q of G.particles) { c.globalAlpha = clamp(q.life / q.max, 0, 1); c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    c.font = '8px "Press Start 2P", monospace';
    for (const t of G.texts) {
      c.globalAlpha = clamp((t.life / t.max) * 1.5, 0, 1);
      c.fillStyle = '#000'; c.fillText(t.text, t.x + 1, t.y + 1);
      c.fillStyle = t.color; c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1; c.textAlign = 'left';
  }
  function darkness() {
    let d = G.map.dark || 0;
    if (G.map.kind === 'over') { if (G.wx === 'night') d = Math.max(d, 0.62); else if (G.wx === 'dusk') d = Math.max(d, 0.32); else if (G.wx === 'rain') d = Math.max(d, 0.18); }
    return d;
  }
  function drawLighting(c, ox, oy) {
    const dark = darkness();
    if (G.wx === 'dusk' && G.map.kind === 'over') { c.fillStyle = 'rgba(255,120,60,0.10)'; c.fillRect(0, 0, G.sw, G.sh); }
    if (!dark) return;
    const z = G.zoom, p = G.player;
    const sx = p.x * z - ox, sy = (p.y - 8) * z - oy;
    const dg = G.map.kind === 'dungeon';
    const r0 = (dg ? 50 : 110) * z, r1 = (dg ? 190 : 360) * z;
    const g = c.createRadialGradient(sx, sy, r0, sx, sy, r1);
    const tint = G.wx === 'night' && !dg ? '4,6,24' : '0,0,8';
    g.addColorStop(0, `rgba(${tint},0)`); g.addColorStop(1, `rgba(${tint},${dark})`);
    c.fillStyle = g; c.fillRect(0, 0, G.sw, G.sh);
    c.globalCompositeOperation = 'lighter';
    for (const pr of G.projectiles) { if (pr.arrow) continue; c.fillStyle = Art.rgba(pr.color, 0.12); Art.circle(c, pr.x * z - ox, pr.y * z - oy, 16 * z); }
    c.globalCompositeOperation = 'source-over';
  }
  // the weather of the current chapter lingers until the story changes it
  function updateWeatherMode() {
    if (!G.spec) return;
    let w = null;
    for (let i = 0; i <= Math.min(G.prog.beat, G.spec.beats.length - 1); i++) { const bw = G.spec.beats[i].weather; if (bw) w = bw === 'day' ? null : bw; }
    if (w !== G.wx) { G.wx = w; if (G.map) initWeather(); }
  }
  function initWeather() {
    G.weather = [];
    const tk = G.spec.theme;
    if (G.map.kind === 'dungeon') { if (!['scifi', 'city', 'modern'].includes(tk)) for (let i = 0; i < 18; i++) G.weather.push({ x: rand(0, G.sw), y: rand(0, G.sh), vx: rand(-5, 5), vy: rand(-8, -2), s: rand(1, 2), kind: 'dust' }); return; }
    if (G.map.kind === 'interior') return;
    if (G.wx === 'rain') { for (let i = 0; i < 120; i++) G.weather.push({ x: rand(0, G.sw), y: rand(0, G.sh), s: rand(1, 2), kind: 'rain', ph: rand(0, 6) }); return; }
    if (G.wx === 'snow') { for (let i = 0; i < 110; i++) G.weather.push({ x: rand(0, G.sw), y: rand(0, G.sh), s: rand(1, 3), kind: 'snow', ph: rand(0, 6) }); return; }
    const kind = G.wx === 'night' ? 'firefly' : { ice: 'snow', fire: 'ember', swamp: 'firefly', undead: 'firefly', desert: 'sand', wasteland: 'sand', fantasy: 'leaf', countryside: 'leaf', jungle: 'leaf', scifi: 'spark', alien: 'spark', whimsy: 'spark' }[tk];
    if (!kind) return;
    const n = kind === 'snow' ? 90 : kind === 'sand' ? 40 : 30;
    for (let i = 0; i < n; i++) G.weather.push({ x: rand(0, G.sw), y: rand(0, G.sh), vx: 0, vy: 0, s: rand(1, 3), kind, ph: rand(0, 6) });
  }
  function updateWeather(dt) {
    for (const w of G.weather) {
      switch (w.kind) {
        case 'rain': w.x -= 90 * dt; w.y += (420 + w.s * 120) * dt; break;
        case 'snow': w.x += (Math.sin(G.time + w.ph) * 15 - 10) * dt; w.y += (30 + w.s * 18) * dt; break;
        case 'ember': w.x += Math.sin(G.time * 2 + w.ph) * 20 * dt; w.y -= (20 + w.s * 12) * dt; break;
        case 'firefly': w.x += Math.cos(G.time * 0.7 + w.ph) * 18 * dt; w.y += Math.sin(G.time * 0.9 + w.ph * 2) * 14 * dt; break;
        case 'sand': w.x += (120 + w.s * 60) * dt; w.y += Math.sin(G.time * 3 + w.ph) * 10 * dt; break;
        case 'leaf': w.x += (25 + Math.sin(G.time + w.ph) * 20) * dt; w.y += (18 + w.s * 6) * dt; break;
        case 'spark': w.y -= 12 * dt; w.x += Math.sin(G.time * 3 + w.ph) * 6 * dt; break;
        default: w.x += (w.vx || 0) * dt; w.y += (w.vy || 0) * dt;
      }
      if (w.x < -10) w.x = G.sw + 10; if (w.x > G.sw + 10) w.x = -10;
      if (w.y < -10) w.y = G.sh + 10; if (w.y > G.sh + 10) w.y = -10;
    }
  }
  function drawWeather(c) {
    if (G.wx === 'fog' && G.map && G.map.kind === 'over') { c.fillStyle = `rgba(220,226,234,${0.32 + Math.sin(G.time * 0.5) * 0.05})`; c.fillRect(0, 0, G.sw, G.sh); }
    for (const w of G.weather) {
      switch (w.kind) {
        case 'rain': c.strokeStyle = 'rgba(170,200,255,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w.x, w.y); c.lineTo(w.x - 3, w.y + 10 + w.s * 3); c.stroke(); break;
        case 'snow': c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(w.x, w.y, w.s + 1, w.s + 1); break;
        case 'ember': c.fillStyle = `rgba(255,${120 + w.s * 30},40,${0.5 + Math.sin(G.time * 5 + w.ph) * 0.3})`; c.fillRect(w.x, w.y, 2, 2); break;
        case 'firefly': c.fillStyle = `rgba(220,255,120,${Math.max(0, Math.sin(G.time * 2 + w.ph)) * 0.8})`; Art.circle(c, w.x, w.y, 1.6); break;
        case 'sand': c.fillStyle = 'rgba(240,220,170,0.35)'; c.fillRect(w.x, w.y, 8 * w.s, 1); break;
        case 'leaf': c.fillStyle = 'rgba(120,180,70,0.6)'; c.fillRect(w.x, w.y, 3, 2); break;
        case 'spark': c.fillStyle = `rgba(160,230,255,${Math.max(0, Math.sin(G.time * 3 + w.ph)) * 0.6})`; c.fillRect(w.x, w.y, 1.5, 1.5); break;
        default: c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(w.x, w.y, w.s, w.s);
      }
    }
  }
  function drawObjectiveArrow(c, ox, oy) {
    if (UI.mode || G.prog.ended) return;
    const t = Story.target();
    if (!t) return;
    const p = G.player, z = G.zoom;
    const tx = t.x * TS + 16, ty = t.y * TS + 16;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < (t.here ? 3.5 : 1.2) * TS) return;
    const a = Math.atan2(dy, dx);
    const sx = p.x * z - ox + Math.cos(a) * 46 * z, sy = (p.y - 8) * z - oy + Math.sin(a) * 46 * z;
    c.save(); c.translate(sx, sy); c.rotate(a);
    c.globalAlpha = 0.6 + Math.sin(G.time * 4) * 0.25;
    c.fillStyle = '#000'; Art.tri(c, 11, 0, -6, -8, -6, 8);
    c.fillStyle = '#ffe060'; Art.tri(c, 9, 0, -5, -6, -5, 6);
    c.restore(); c.globalAlpha = 1;
  }
  function fitText(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    let t = text;
    while (c.measureText(t + '…').width > maxW && t.length > 4) t = t.slice(0, -1);
    return t + '…';
  }
  function drawHUD(c) {
    const s = st(), S = G.spec, P = G.prog;
    const touch = document.body.classList.contains('touch');
    const narrow = G.sw < 620;
    c.font = '9px "Press Start 2P", monospace';
    const x = 10, y = 10, w = 196;
    c.fillStyle = 'rgba(8,8,16,0.72)'; Art.rrect(c, x, y, w, 62, 6);
    c.fillStyle = '#3a1418'; c.fillRect(x + 8, y + 8, w - 16, 12);
    c.fillStyle = s.hp / s.maxHp < 0.3 ? `rgb(${200 + Math.sin(G.time * 8) * 55},40,40)` : '#e0404a'; c.fillRect(x + 8, y + 8, ((w - 16) * s.hp) / s.maxHp, 12);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 8, y + 8, ((w - 16) * s.hp) / s.maxHp, 3);
    c.fillStyle = '#fff'; c.fillText(`${Math.ceil(s.hp)}/${s.maxHp}`, x + 12, y + 18);
    c.fillStyle = '#1a2040'; c.fillRect(x + 8, y + 23, w - 16, 4);
    c.fillStyle = '#60a0ff'; c.fillRect(x + 8, y + 23, ((w - 16) * s.xp) / xpNeed(s.level), 4);
    c.fillStyle = '#ffe9a0'; c.fillText(`Lv${s.level}`, x + 8, y + 41);
    c.fillStyle = '#ffd040'; c.fillText(`$${s.gold}`, x + 56, y + 41);
    c.fillStyle = '#ff7080'; c.fillText(`♥${s.potions}`, x + 130, y + 41);
    c.font = '7px "Press Start 2P", monospace';
    c.fillStyle = '#c8c0e0'; c.fillText(P.ended ? 'THE END' : `CH ${Math.min(P.beat + 1, S.beats.length)}/${S.beats.length}`, x + 8, y + 56);
    // items from the story you're carrying
    let ix = x + 84;
    for (const id of Object.keys(P.inv).slice(0, 6)) { const o = objById(id); if (!o) continue; Art.drawIcon(c, ix, y + 52, o.icon, o.color, G.time, 0.75); if (P.inv[id] > 1) { c.fillStyle = '#fff'; c.font = '5px "Press Start 2P", monospace'; c.fillText(P.inv[id], ix + 4, y + 59); c.font = '7px "Press Start 2P", monospace'; } ix += 18; }
    // objective
    const obj = Story.objectiveText();
    if (obj) {
      c.font = '8px "Press Start 2P", monospace';
      const maxW = Math.min(G.sw - (narrow ? 20 : 380), 560);
      const text = fitText(c, '▶ ' + obj, maxW - 16);
      const tw = c.measureText(text).width + 16;
      const oyy = narrow ? y + 70 : y;
      const oxx = narrow ? x : (G.sw - tw) / 2;
      c.fillStyle = 'rgba(8,8,16,0.75)'; Art.rrect(c, oxx, oyy, tw, 20, 5);
      c.fillStyle = '#ffe9a0'; c.fillText(text, oxx + 8, oyy + 14);
    }
    drawMinimap(c);
    const b = G.bossActive;
    if (b && !b.dead) {
      const bw = Math.min(420, G.sw - 40), bx = (G.sw - bw) / 2, by = G.sh - (touch ? 190 : 46);
      c.fillStyle = 'rgba(8,8,16,0.8)'; Art.rrect(c, bx - 6, by - 18, bw + 12, 34, 6);
      c.fillStyle = '#ffe9a0'; c.font = '8px "Press Start 2P", monospace'; c.textAlign = 'center'; c.fillText(b.name, G.sw / 2, by - 5); c.textAlign = 'left';
      c.fillStyle = '#300'; c.fillRect(bx, by, bw, 10);
      c.fillStyle = b.isVillain ? '#c040ff' : '#e04040'; c.fillRect(bx, by, (bw * Math.max(0, b.hp)) / b.maxHp, 10);
    }
  }
  function drawMinimap(c) {
    const mini = G.mini, map = G.map, p = G.player;
    if (!mini) return;
    if (mini.dirty) { mini.g.putImageData(mini.img, 0, 0); mini.dirty = false; }
    const size = G.sw < 620 ? 92 : 128, span = 48;
    const x = G.sw - size - 10, y = 10;
    const ptx = p.x / TS, pty = p.y / TS;
    const sx = clamp(ptx - span / 2, 0, Math.max(0, map.w - span)), sy = clamp(pty - span / 2, 0, Math.max(0, map.h - span));
    const sc = size / span;
    c.fillStyle = 'rgba(8,8,16,0.8)'; Art.rrect(c, x - 4, y - 4, size + 8, size + 8, 6);
    c.imageSmoothingEnabled = false;
    c.drawImage(mini.cv, sx, sy, Math.min(span, map.w), Math.min(span, map.h), x, y, Math.min(span, map.w) * sc, Math.min(span, map.h) * sc);
    c.save(); c.beginPath(); c.rect(x, y, size, size); c.clip();
    if (map.id === 'over') for (const e of map.portals) { c.fillStyle = '#ffd040'; c.fillRect(x + (e.x - sx) * sc - 2, y + (e.y - sy) * sc - 2, 4, 4); }
    for (const n of G.npcs) { if (map.seen && !map.seen[Math.floor(n.y / TS) * map.w + Math.floor(n.x / TS)]) continue; c.fillStyle = isTargetChar(n.data.id) ? '#ffe040' : '#80e0ff'; c.fillRect(x + (n.x / TS - sx) * sc - 1.5, y + (n.y / TS - sy) * sc - 1.5, 3, 3); }
    const t = !G.prog.ended && Story.target();
    if (t && Math.floor(G.time * 3) % 2) { c.fillStyle = '#ff60ff'; const tx = x + (t.x + 0.5 - sx) * sc, ty = y + (t.y + 0.5 - sy) * sc; c.fillRect(tx - 3, ty - 3, 6, 6); }
    c.fillStyle = Math.floor(G.time * 4) % 2 ? '#ffffff' : '#ff4040';
    c.fillRect(x + (ptx - sx) * sc - 2, y + (pty - sy) * sc - 2, 4, 4);
    c.restore();
    c.font = '7px "Press Start 2P", monospace'; c.textAlign = 'right';
    const nm = fitText(c, currentPlaceName(), size + 40);
    c.fillStyle = '#000'; c.fillText(nm, x + size + 1, y + size + 17);
    c.fillStyle = '#e8e0ff'; c.fillText(nm, x + size, y + size + 16);
    c.textAlign = 'left';
  }
  function drawBigMap() {
    const cv = $('bigmap'), mini = G.mini, map = G.map;
    const W = Math.min(innerWidth - 30, 900), H = Math.min(innerHeight - 90, 900);
    const sc = Math.max(1, Math.floor(Math.min(W / map.w, H / map.h)));
    const dpr = G.dpr;
    cv.width = map.w * sc * dpr; cv.height = map.h * sc * dpr;
    cv.style.width = map.w * sc + 'px'; cv.style.height = map.h * sc + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    if (mini.dirty) { mini.g.putImageData(mini.img, 0, 0); mini.dirty = false; }
    c.drawImage(mini.cv, 0, 0, map.w * sc, map.h * sc);
    c.font = '7px "Press Start 2P", monospace';
    const label = (txt, x, y, col) => { const w = c.measureText(txt).width + 6; c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(x - w / 2, y - 9, w, 12); c.fillStyle = col; c.textAlign = 'center'; c.fillText(txt, x, y); c.textAlign = 'left'; };
    const t = !G.prog.ended && Story.target();
    if (map.id === 'over') {
      for (const z of G.world.zones) if (!map.portals.some((e) => e.place === z.place.id)) label(z.place.display, z.x * sc, (z.y - 2) * sc, '#ffffff');
      for (const e of map.portals) { const pl = placeById(e.place); c.fillStyle = '#ffd040'; c.fillRect(e.x * sc - 3, e.y * sc - 3, 6, 6); if (pl) label(pl.display, e.x * sc, e.y * sc - 6, '#ffd040'); }
    }
    if (t) { c.fillStyle = '#ff60ff'; c.beginPath(); c.arc((t.x + 0.5) * sc, (t.y + 0.5) * sc, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.stroke(); }
    const p = G.player;
    c.fillStyle = '#ff3030'; c.beginPath(); c.arc((p.x / TS) * sc, (p.y / TS) * sc, 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    $('mapname').textContent = (map.id === 'over' ? (G.spec.region || G.spec.title) : map.name) + (map.seen ? ' — explored areas' : '') + (t ? '  ·  ● = where the story goes next' : '');
  }
  function banner(text, sub) { G.banner = { text, sub, start: G.time }; }
  function drawBanner(c) {
    const b = G.banner;
    if (!b) return;
    b.t = G.time - b.start;
    if (b.t > 3.4) { G.banner = null; return; }
    const a = b.t < 0.4 ? b.t / 0.4 : b.t > 2.8 ? 1 - (b.t - 2.8) / 0.6 : 1;
    c.globalAlpha = clamp(a, 0, 1);
    c.textAlign = 'center';
    const y = G.sh * 0.3;
    c.font = `${G.sw < 620 ? 11 : 16}px "Press Start 2P", monospace`;
    const text = fitText(c, b.text, G.sw - 40);
    c.font = '8px "Press Start 2P", monospace';
    const sub = b.sub ? fitText(c, b.sub, G.sw - 40) : '';
    const subW = sub ? c.measureText(sub).width : 0;
    c.font = `${G.sw < 620 ? 11 : 16}px "Press Start 2P", monospace`;
    const w = Math.min(G.sw - 20, Math.max(c.measureText(text).width, subW) + 50);
    c.fillStyle = 'rgba(8,8,16,0.75)'; c.fillRect((G.sw - w) / 2, y - 30, w, sub ? 58 : 44);
    c.fillStyle = G.theme.accent; c.fillRect((G.sw - w) / 2, y - 30, w, 2);
    c.fillStyle = '#fff'; c.fillText(text, G.sw / 2, y);
    if (sub) { c.font = '8px "Press Start 2P", monospace'; c.fillStyle = '#c8c0e0'; c.fillText(sub, G.sw / 2, y + 18); }
    c.textAlign = 'left'; c.globalAlpha = 1;
  }
  // which part of the world are you in?
  function updateZone() {
    if (G.map.kind !== 'over') { G.zoneName = ''; G.zoneId = undefined; return; }
    const px = G.player.x / TS, py = G.player.y / TS;
    let best = null, bd = Infinity;
    for (const z of G.world.zones) { const d = Math.hypot(z.x - px, z.y - py) / Math.max(4, z.r); if (d < bd) { bd = d; best = z; } }
    if (!best) return;
    G.zoneName = bd < 1.6 ? best.place.display : G.map.name;
    if (bd < 0.9 && best.id !== G.zoneId) { const first = G.zoneId === undefined; G.zoneId = best.id; if (!first && !UI.mode && !G.banner) banner(best.place.display, ''); }
  }

  function init() {
    canvas = $('screen'); ctx = canvas.getContext('2d');
    Input.init(); UI.init();
    addEventListener('resize', () => { resize(); if (G.active && G.map) initWeather(); });
    const touch = window.matchMedia && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    document.body.classList.toggle('touch', !!touch);
  }

  RPG.Game = { init, start, readSave, hasSave, deleteSave, quit, G, toast: (t, c) => UI.toast(t, c), debug: { loadMap, gainXP, killEnemy, Story, takeItem, interact, UI, storyPages, speakAbout } };
})();
