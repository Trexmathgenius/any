/* art.js — every tile and sprite is drawn with code (no image files needed). */
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const TS = 32;

  // ---------- color + shape helpers ----------
  function hexToRgb(h) { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(hex, amt) {
    if (!hex || hex[0] !== '#') return hex;
    const [r, g, b] = hexToRgb(hex);
    const f = amt >= 0 ? (v) => v + (255 - v) * amt : (v) => v * (1 + amt);
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(f(v)))).toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function prng(seed) { let s = (Math.abs(seed | 0) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fill(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); c.fill(); }
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  function tri(c, x1, y1, x2, y2, x3, y3) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill(); }
  function speck(g, rnd, color, n, s) { g.fillStyle = color; for (let i = 0; i < n; i++) g.fillRect((rnd() * (TS - s)) | 0, (rnd() * (TS - s)) | 0, s, s); }
  function line(c, x1, y1, x2, y2, w, color) { c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  // ---------- TILES (ground layer + object layer) ----------
  const G = RPG.G, D = RPG.D;
  function grassBase(g, th, tk, v, rnd) {
    const c = th.ground[v % th.ground.length];
    g.fillStyle = c; g.fillRect(0, 0, TS, TS);
    if (tk === 'scifi') {
      g.fillStyle = shade(c, -0.3); g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS);
      g.fillStyle = shade(c, 0.12); g.fillRect(1, 1, TS - 1, 1); g.fillRect(1, 1, 1, TS - 1);
      g.fillStyle = shade(c, -0.35); [[4, 4], [TS - 6, 4], [4, TS - 6], [TS - 6, TS - 6]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
      return;
    }
    if (tk === 'city') { g.fillStyle = shade(c, -0.12); g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS); speck(g, rnd, shade(c, -0.06), 5, 2); return; }
    speck(g, rnd, shade(c, -0.09), 8, 2);
    speck(g, rnd, shade(c, 0.09), 5, 2);
    if (['fantasy', 'pirate', 'swamp', 'modern', 'countryside', 'jungle', 'whimsy'].includes(tk)) {
      g.fillStyle = shade(c, -0.2);
      for (let i = 0; i < 4; i++) { const x = (rnd() * 27) | 0, y = (rnd() * 26) | 0; g.fillRect(x, y + 1, 1, 3); g.fillRect(x + 2, y, 1, 4); g.fillRect(x + 4, y + 2, 1, 2); }
    }
    if (tk === 'ice') speck(g, rnd, '#ffffff', 5, 1);
    if (tk === 'alien') speck(g, rnd, 'rgba(96,240,208,0.5)', 3, 1);
    if (tk === 'fire' && v % 3 === 0) { line(g, 6, 20, 14, 16, 1, 'rgba(255,110,40,0.5)'); line(g, 14, 16, 20, 22, 1, 'rgba(255,110,40,0.4)'); }
  }
  function flat(g, c, rnd, n = 7) { g.fillStyle = c; g.fillRect(0, 0, TS, TS); speck(g, rnd, shade(c, -0.1), n, 2); speck(g, rnd, shade(c, 0.1), (n / 2) | 0, 2); }
  function waterTile(g, th, tk, v, f, rnd, col1, col2) {
    g.fillStyle = col1; g.fillRect(0, 0, TS, TS);
    g.fillStyle = col2;
    for (let i = 0; i < 3; i++) { const y = 3 + ((rnd() * 26) | 0), x = (((rnd() * 20) | 0) + f * 5) % 24; g.fillRect(x, y, 6, 1); g.fillRect(x + 2, y - 1, 3, 1); }
  }
  function paintGround(g, t, v, f, th, tk, k) {
    const rnd = prng(t * 977 + v * 131 + 7);
    switch (t) {
      case G.GRASS: grassBase(g, th, tk, v, rnd); break;
      case G.PATH:
        if (tk === 'city' || tk === 'modern' || tk === 'scifi') { g.fillStyle = th.path; g.fillRect(0, 0, TS, TS); speck(g, rnd, shade(th.path, -0.15), 4, 1); if (v % 4 === 0) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(14, 4, 3, 8); } }
        else { flat(g, th.path, rnd); g.fillStyle = shade(th.path, -0.2); ellipse(g, 8 + rnd() * 16, 8 + rnd() * 16, 2, 1.4); }
        break;
      case G.WATER:
        if (tk === 'fire') { waterTile(g, th, tk, v, f, rnd, '#e8601c', '#ffb030'); }
        else if (tk === 'scifi') { g.fillStyle = th.water; g.fillRect(0, 0, TS, TS); g.fillStyle = 'rgba(42,208,224,0.22)'; g.fillRect(0, (6 + f * 13 + v) % 32, 32, 1); speck(g, rnd, 'rgba(160,240,255,0.7)', 3, 1); }
        else { waterTile(g, th, tk, v, f, rnd, th.water, th.water2); if (tk === 'ice') line(g, 4, 6, 14, 12, 1, 'rgba(255,255,255,0.6)'); }
        break;
      case G.SAND: flat(g, tk === 'alien' ? '#8a7ab0' : '#e0c27a', rnd, 8); if (v % 3 === 0) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(4, 12, 14, 1); } break;
      case G.SNOW: flat(g, '#eef4f8', rnd, 6); speck(g, rnd, '#ffffff', 4, 1); break;
      case G.DIRT: flat(g, tk === 'wasteland' ? '#7a6a4a' : '#9a7a52', rnd, 9); break;
      case G.STONE: {
        const c = tk === 'city' || tk === 'modern' ? '#a8a8ac' : '#9a968c';
        g.fillStyle = c; g.fillRect(0, 0, TS, TS);
        g.fillStyle = shade(c, -0.15);
        if (tk === 'city' || tk === 'modern') { g.fillRect(0, 0, TS, 1); g.fillRect(0, 0, 1, TS); }
        else { for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); for (let x = ((y / 8) % 2) * 8; x < 32; x += 16) g.fillRect(x, y, 1, 8); } }
        speck(g, rnd, shade(c, 0.08), 4, 1);
        break;
      }
      case G.ASH: flat(g, '#4a3a34', rnd, 8); if (v % 2) { line(g, 6, 20, 14, 16, 1, 'rgba(255,110,40,0.55)'); } break;
      case G.SHORE: flat(g, th.shore, rnd, 8); break;
      case G.BRIDGE: {
        waterTile(g, th, tk, v, f, rnd, tk === 'fire' ? '#e8601c' : th.water, tk === 'fire' ? '#ffb030' : th.water2);
        const wood = tk === 'scifi' || tk === 'city' ? '#5a6470' : '#8a6438';
        g.fillStyle = shade(wood, -0.3); g.fillRect(0, 0, 32, 32);
        g.fillStyle = wood; for (let i = 0; i < 32; i += 6) g.fillRect(0, i, 32, 5);
        g.fillStyle = shade(wood, 0.15); for (let i = 0; i < 32; i += 6) g.fillRect(0, i, 32, 1);
        break;
      }
      case G.LAVA: waterTile(g, th, tk, v, f, rnd, '#e8601c', '#ffd040'); g.fillStyle = 'rgba(90,20,0,0.4)'; ellipse(g, 8 + v * 2, 20, 5, 2); break;
      case G.MURK: waterTile(g, th, tk, v, f, rnd, '#3a5a3a', '#5a7a4a'); if (v % 3 === 0) { g.fillStyle = '#4a8a3a'; ellipse(g, 12, 14, 5, 3.5); g.fillStyle = '#d070a0'; circle(g, 10, 13, 1.4); } break;
      case G.CLOUD: flat(g, '#e8f0ff', rnd, 4); g.fillStyle = '#ffffff'; circle(g, 10 + (v % 3) * 4, 12, 7); circle(g, 20, 18, 6); break;
      case G.CROPS: {
        flat(g, '#8a6a42', rnd, 4);
        const crop = tk === 'whimsy' ? '#ff8ac8' : '#d0b040';
        for (let x = 3; x < 32; x += 7) { line(g, x, 30, x, 8, 2, '#5a9a3a'); g.fillStyle = crop; ellipse(g, x, 9, 2, 3.5); }
        break;
      }
      case G.FLOOR: case G.EXIT: {
        const base = k === 1 ? '#8a8078' : th.dFloor;
        g.fillStyle = base; g.fillRect(0, 0, TS, TS);
        g.fillStyle = shade(base, -0.16); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
        speck(g, rnd, shade(base, -0.1), 6, 2);
        if (v % 4 === 0) line(g, 6, 8, 12, 14, 1, shade(base, -0.25));
        if (t === G.EXIT) {
          if (k === 1) { g.fillStyle = '#6a3a2a'; g.fillRect(4, 8, 24, 20); g.fillStyle = '#c8a050'; g.fillRect(6, 10, 20, 16); g.fillStyle = 'rgba(255,240,200,0.6)'; tri(g, 16, 30, 10, 22, 22, 22); }
          else { for (let i = 0; i < 4; i++) { g.fillStyle = shade(base, 0.1 + i * 0.12); g.fillRect(5, 26 - i * 6, 22, 5); } g.fillStyle = '#ffffff'; tri(g, 16, 3, 11, 9, 21, 9); }
        }
        break;
      }
      case G.WOOD: { const c = '#a07a4a'; g.fillStyle = c; g.fillRect(0, 0, TS, TS); g.fillStyle = shade(c, -0.18); for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); g.fillRect((y * 3 + v * 5) % 32, y, 1, 8); } speck(g, rnd, shade(c, 0.08), 3, 1); break; }
      case G.TILE: { g.fillStyle = '#e4e4ea'; g.fillRect(0, 0, TS, TS); g.fillStyle = '#d0d0da'; g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); break; }
      case G.SFLOOR: { const c = '#8a8a90'; g.fillStyle = c; g.fillRect(0, 0, TS, TS); g.fillStyle = shade(c, -0.18); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(0, 16, 32, 1); g.fillRect(16, 0, 1, 16); speck(g, rnd, shade(c, 0.1), 4, 2); break; }
      case G.DFLOOR: flat(g, '#9a7a52', rnd, 6); g.fillStyle = '#d8b850'; for (let i = 0; i < 3; i++) g.fillRect(rnd() * 28, rnd() * 28, 4, 1); break;
      case G.CARPET: {
        const c = k === 1 ? '#a02a2a' : th.dFloor2;
        g.fillStyle = c; g.fillRect(0, 0, TS, TS);
        g.fillStyle = shade(c, -0.2); g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32);
        g.fillStyle = rgba(th.accent, 0.35); tri(g, 16, 8, 8, 16, 16, 24); tri(g, 16, 8, 24, 16, 16, 24);
        break;
      }
      case G.WALL: {
        const isFace = v >= 8;
        const base = k === 1 ? th.house : th.dWall, top = k === 1 ? shade(th.house, -0.35) : th.dWallTop;
        if (isFace) {
          g.fillStyle = base; g.fillRect(0, 0, TS, TS);
          if (k === 1) { g.fillStyle = shade(base, -0.08); for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32); g.fillStyle = shade(base, -0.3); g.fillRect(0, 28, 32, 4); }
          else { g.fillStyle = shade(base, 0.14); for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); for (let x = (y / 8) % 2 ? 4 : 12; x < 32; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 28, 32, 4); }
          g.fillStyle = top; g.fillRect(0, 0, 32, 4);
        } else { g.fillStyle = top; g.fillRect(0, 0, TS, TS); g.fillStyle = shade(top, -0.18); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); }
        break;
      }
      case G.VOID: g.fillStyle = '#000'; g.fillRect(0, 0, TS, TS); break;
      default: g.fillStyle = '#f0f'; g.fillRect(0, 0, TS, TS);
    }
  }

  // ---- objects that stand on the ground ----
  const treeTypes = { [D.TREE]: null, [D.OAK]: 'oak', [D.PINE]: 'pine', [D.CACTUS]: 'cactus', [D.DEADTREE]: 'deadtree', [D.PALM]: 'palm', [D.MANGROVE]: 'mangrove', [D.JUNGLE]: 'jungle', [D.CANDY]: 'candy', [D.CRYSTAL]: 'crystal', [D.WRECK]: 'wreck', [D.BASALT]: 'basalt', [D.TECH]: 'pillar' };
  function drawTree(g, type, th, v, rnd) {
    const shadow = () => { g.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(g, 16, 27, 11, 4); };
    const leaf = th.leaf, leaf2 = th.leaf2, trunk = th.trunk;
    switch (type) {
      case 'oak': shadow(); g.fillStyle = '#6b4a2a'; g.fillRect(13, 18, 6, 10); g.fillStyle = '#2f6a2a'; circle(g, 16, 13, 12); g.fillStyle = '#3d8a35'; circle(g, 12, 10, 7); circle(g, 21, 12, 6); g.fillStyle = '#4f9a40'; circle(g, 13, 8, 3.5); break;
      case 'tree': shadow(); g.fillStyle = trunk; g.fillRect(13, 18, 6, 10); g.fillStyle = shade(leaf, -0.15); circle(g, 16, 14, 12); g.fillStyle = leaf; circle(g, 16, 12, 11); circle(g, 9, 16, 7); circle(g, 23, 16, 7); g.fillStyle = leaf2; circle(g, 13, 9, 6); circle(g, 21, 11, 4); if (v % 4 === 0) { g.fillStyle = '#d04040'; circle(g, 10, 14, 1.6); circle(g, 20, 17, 1.6); } break;
      case 'pine': shadow(); g.fillStyle = '#5a4030'; g.fillRect(14, 22, 4, 7); for (let i = 0; i < 3; i++) { const y = 2 + i * 7, w = 7 + i * 3.5; g.fillStyle = shade('#2e5a4a', -0.1 + i * 0.05); tri(g, 16, y, 16 - w, y + 11, 16 + w, y + 11); if (th === RPG.THEMES.ice || v % 3 === 0) { g.fillStyle = '#f4f8fb'; tri(g, 16, y, 16 - w * 0.55, y + 5, 16 + w * 0.55, y + 5); } } break;
      case 'cactus': shadow(); g.fillStyle = '#3f7a2a'; rrect(g, 12, 6, 9, 22, 4.5); g.fillStyle = '#4f8a3a'; rrect(g, 12, 6, 6, 22, 3); g.fillStyle = '#3f7a2a'; rrect(g, 5, 11, 5, 9, 2.5); g.fillRect(7, 17, 6, 4); if (v % 2) { rrect(g, 22, 9, 5, 9, 2.5); g.fillRect(19, 15, 6, 4); } if (v % 3 === 0) { g.fillStyle = '#f070a0'; circle(g, 16, 6, 2.5); } break;
      case 'deadtree': shadow(); line(g, 16, 28, 16, 9, 4, '#4a3a3a'); line(g, 16, 16, 7, 9, 2.5, '#4a3a3a'); line(g, 16, 13, 25, 6, 2.5, '#4a3a3a'); line(g, 9, 11, 6, 4, 1.5, '#4a3a3a'); line(g, 22, 8, 26, 2, 1.5, '#4a3a3a'); break;
      case 'palm': shadow(); g.fillStyle = '#8a6a3a'; for (let i = 0; i < 6; i++) { const y = 27 - i * 3.5, x = 15 + Math.sin(i * 0.5) * 3; rrect(g, x - 2.5, y - 3, 5, 4, 1.5); } g.fillStyle = '#3a8a3a'; for (let i = 0; i < 6; i++) { g.save(); g.translate(18, 7); g.rotate((i / 6) * Math.PI * 2 + 0.3); ellipse(g, 7, 0, 8, 2.6); g.restore(); } g.fillStyle = '#6a4a2a'; circle(g, 16, 9, 2); circle(g, 20, 9, 2); break;
      case 'mangrove': shadow(); g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(16, 18); g.quadraticCurveTo(6 + i * 7, 20, 4 + i * 8, 29); g.stroke(); } g.fillStyle = '#1e3a1e'; ellipse(g, 16, 11, 14, 9); g.fillStyle = '#2a4a2a'; ellipse(g, 15, 9, 12, 7); g.fillStyle = '#3a5a2a'; circle(g, 11, 7, 4); break;
      case 'jungle': shadow(); g.fillStyle = '#5a3a1a'; g.fillRect(14, 16, 5, 12); g.fillStyle = '#1e5a1e'; for (let i = 0; i < 7; i++) { g.save(); g.translate(16, 12); g.rotate((i / 7) * Math.PI * 2); ellipse(g, 8, 0, 9, 4); g.restore(); } g.fillStyle = '#3a8a3a'; circle(g, 16, 12, 6); g.fillStyle = '#f05a8a'; if (v % 3 === 0) circle(g, 22, 8, 2); break;
      case 'candy': shadow(); g.fillStyle = '#f4f4f4'; g.fillRect(15, 14, 3, 15); { const c1 = ['#ff8ac8', '#8ad0ff', '#ffd060', '#a0e080'][v % 4]; g.fillStyle = c1; circle(g, 16, 11, 10); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 12; a += 0.4) { const r = a * 0.75; g.lineTo(16 + Math.cos(a) * r, 11 + Math.sin(a) * r); } g.stroke(); } break;
      case 'crystal': shadow(); { const c = v % 2 ? '#60e0f0' : '#d080ff'; g.fillStyle = shade(c, -0.25); tri(g, 9, 28, 13, 6, 17, 28); g.fillStyle = c; tri(g, 14, 28, 19, 2, 24, 28); g.fillStyle = shade(c, 0.4); tri(g, 19, 2, 20, 28, 17, 28); g.fillStyle = shade(c, -0.1); tri(g, 21, 28, 25, 14, 28, 28); } break;
      case 'wreck': shadow(); g.fillStyle = '#7a4a2a'; rrect(g, 4, 12, 24, 13, 4); g.fillStyle = '#5a5a5a'; rrect(g, 8, 8, 14, 8, 3); g.fillStyle = '#2a2a2a'; circle(g, 9, 26, 3); circle(g, 23, 26, 3); g.fillStyle = 'rgba(160,90,40,0.6)'; g.fillRect(12, 16, 6, 4); break;
      case 'basalt': shadow(); g.fillStyle = '#2e2622'; g.beginPath(); g.moveTo(5, 28); g.lineTo(8, 10); g.lineTo(13, 4); g.lineTo(18, 9); g.lineTo(23, 3); g.lineTo(27, 14); g.lineTo(28, 28); g.closePath(); g.fill(); line(g, 12, 26, 15, 16, 1.2, '#ff7a2a'); line(g, 15, 16, 21, 12, 1.2, '#ffb030'); break;
      case 'pillar': g.fillStyle = '#4a5260'; g.fillRect(7, 4, 18, 24); g.fillStyle = '#6a7480'; g.fillRect(8, 4, 12, 24); g.fillStyle = '#8a94a0'; g.fillRect(8, 4, 4, 24); g.fillStyle = v % 2 ? '#2ad0e0' : '#e0a02a'; g.fillRect(8, 12, 17, 2); break;
      default: drawTree(g, 'tree', th, v, rnd);
    }
  }
  const STYLE_KEYS = () => Object.keys(RPG.LIB.STYLES);
  function styleOf(v, th) {
    const key = STYLE_KEYS()[v >> 4] || 'house';
    const S = RPG.LIB.STYLES[key] || {};
    const varI = v & 15;
    return { key, S, roof: S.roofColor || th.roof[varI % th.roof.length], wall: S.wallColor || th.house, door: th.door, varI };
  }
  function paintDeco(g, d, v, f, th, tk) {
    const rnd = prng(d * 733 + v * 97 + 3);
    if (treeTypes[d] !== undefined) return drawTree(g, treeTypes[d] || th.obstacle, th, v, rnd);
    const sh = (rx = 9, y = 27) => { g.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(g, 16, y, rx, 3.5); };
    switch (d) {
      case D.BUSH: sh(10, 26); g.fillStyle = shade(th.leaf2, -0.2); circle(g, 11, 19, 7); circle(g, 21, 19, 7); g.fillStyle = th.leaf2 === '#ffb8e0' ? '#8ad08a' : th.leaf2; circle(g, 16, 15, 8); if (v % 3 === 0) { g.fillStyle = '#f05a8a'; circle(g, 12, 14, 1.5); circle(g, 20, 17, 1.5); } break;
      case D.ROCK: sh(11, 26); g.fillStyle = shade(th.rock, -0.2); ellipse(g, 16, 19, 12, 9); g.fillStyle = th.rock; ellipse(g, 15, 17, 11, 8); g.fillStyle = shade(th.rock, 0.2); ellipse(g, 12, 14, 5, 3); break;
      case D.CLIFF: { const c = shade(th.rock, -0.15); g.fillStyle = c; g.fillRect(0, 0, TS, TS); for (let i = 0; i < 5; i++) { g.fillStyle = shade(c, (rnd() - 0.5) * 0.3); const x = rnd() * 24, y = rnd() * 24; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + 4, y); g.lineTo(x + 10, y + 2); g.lineTo(x + 9, y + 9); g.lineTo(x + 2, y + 10); g.closePath(); g.fill(); } g.fillStyle = shade(c, 0.2); g.fillRect(0, 0, 32, 2); if (tk === 'ice') { g.fillStyle = '#f4f8fb'; g.fillRect(0, 0, 32, 4); } break; }
      case D.CAVE: { const c = shade(th.rock, -0.15); g.fillStyle = c; g.fillRect(0, 0, TS, TS); g.fillStyle = shade(th.rock, 0.15); rrect(g, 5, 5, 22, 27, 9); g.fillStyle = '#0a0806'; rrect(g, 8, 8, 16, 24, 7); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(11, 26, 10, 6); break; }
      case D.FLOWERS: for (let i = 0; i < 3; i++) { const x = 5 + rnd() * 20, y = 5 + rnd() * 20; g.fillStyle = th.detail[(v + i) % th.detail.length]; g.fillRect(x - 2, y, 2, 2); g.fillRect(x + 2, y, 2, 2); g.fillRect(x, y - 2, 2, 2); g.fillRect(x, y + 2, 2, 2); g.fillStyle = '#f8e080'; g.fillRect(x, y, 2, 2); } break;
      case D.MUSHROOM: for (let i = 0; i < 2; i++) { const x = 9 + i * 11 + rnd() * 3, y = 18 + rnd() * 6; g.fillStyle = '#f0e8d8'; g.fillRect(x - 1, y, 3, 4); g.fillStyle = i ? '#c8443a' : '#9a6ab0'; ellipse(g, x, y, 4.5, 3); g.fillStyle = '#fff'; circle(g, x - 1, y - 1, 0.8); } break;
      case D.REEDS: for (let i = 0; i < 4; i++) { const x = 6 + rnd() * 20; line(g, x, 28, x + (rnd() - 0.5) * 3, 12 + rnd() * 5, 1.2, '#5a8a3a'); g.fillStyle = '#6a4a2a'; ellipse(g, x, 13, 1.5, 3); } break;
      case D.GRAVE: sh(8, 27); g.fillStyle = '#5a5a62'; rrect(g, 9, 7, 15, 20, 7); g.fillStyle = '#7a7a84'; rrect(g, 9, 6, 13, 20, 6); g.fillStyle = '#4a4a52'; g.fillRect(14, 10, 3, 10); g.fillRect(11, 13, 9, 3); break;
      case D.FENCE: g.fillStyle = '#8a6438'; g.fillRect(0, 12, 32, 3); g.fillRect(0, 20, 32, 3); g.fillStyle = '#a07a4a'; g.fillRect(3, 8, 4, 18); g.fillRect(19, 8, 4, 18); break;
      case D.TENT: sh(13, 28); { const c = ['#c8643a', '#3a7ab0', '#6a9a3a'][v % 3]; g.fillStyle = shade(c, -0.2); tri(g, 16, 4, 2, 28, 30, 28); g.fillStyle = c; tri(g, 16, 4, 6, 28, 26, 28); g.fillStyle = '#2a1a10'; tri(g, 16, 14, 12, 28, 20, 28); } break;
      case D.CAMPFIRE: sh(9, 27); line(g, 8, 26, 24, 20, 3, '#6a4a2a'); line(g, 8, 20, 24, 26, 3, '#6a4a2a'); g.fillStyle = '#ff7a2a'; tri(g, 10 + f, 24, 16, 8 - f * 2, 22 - f, 24); g.fillStyle = '#ffd040'; tri(g, 13, 24, 16, 13 + f, 19, 24); break;
      case D.LAMPPOST: sh(5, 29); g.fillStyle = '#3a3a44'; g.fillRect(15, 6, 3, 23); g.fillRect(12, 28, 9, 2); g.fillStyle = '#ffe070'; circle(g, 16.5, 6, 3.5); g.fillStyle = 'rgba(255,224,112,0.25)'; circle(g, 16.5, 6, 7); break;
      case D.BENCH: sh(12, 27); g.fillStyle = '#8a5a2a'; g.fillRect(4, 14, 24, 4); g.fillRect(4, 20, 24, 4); g.fillStyle = '#3a3a3a'; g.fillRect(6, 24, 2, 5); g.fillRect(24, 24, 2, 5); break;
      case D.STATUE: sh(10, 28); g.fillStyle = '#7a7a80'; g.fillRect(8, 22, 16, 6); g.fillStyle = '#a8a8b0'; rrect(g, 12, 9, 8, 14, 3); circle(g, 16, 7, 4); g.fillStyle = '#c8c8d0'; g.fillRect(13, 10, 2, 10); break;
      case D.WELL: sh(12, 26); g.fillStyle = '#7a7a7a'; ellipse(g, 16, 18, 12, 9); g.fillStyle = '#9a9a9a'; ellipse(g, 16, 16, 12, 8); g.fillStyle = tk === 'fire' ? '#e8601c' : '#2c4f88'; ellipse(g, 16, 16, 8, 5); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(12, 15, 4, 1); break;
      case D.RUINWALL: g.fillStyle = shade(th.rock, -0.1); g.fillRect(2, 8 + (v % 3) * 3, 28, 20); g.fillStyle = th.rock; for (let y = 10 + (v % 3) * 3; y < 28; y += 6) g.fillRect(2, y, 28, 1); g.fillStyle = shade(th.rock, 0.15); g.fillRect(2, 8 + (v % 3) * 3, 28, 2); break;
      case D.PILLAR: sh(7, 29); g.fillStyle = '#9a9aa4'; g.fillRect(10, 4, 12, 25); g.fillStyle = '#c0c0c8'; g.fillRect(10, 4, 4, 25); g.fillStyle = '#7a7a84'; g.fillRect(8, 2, 16, 4); g.fillRect(8, 27, 16, 3); break;
      case D.CRATE: sh(10, 28); g.fillStyle = '#8a5a2a'; g.fillRect(6, 8, 20, 19); g.fillStyle = '#a07040'; g.fillRect(7, 9, 18, 17); line(g, 7, 9, 25, 26, 2, '#6a4020'); line(g, 25, 9, 7, 26, 2, '#6a4020'); break;
      case D.BARREL: sh(9, 28); g.fillStyle = '#7a4a2a'; rrect(g, 8, 7, 16, 21, 5); g.fillStyle = '#9a6a3a'; rrect(g, 10, 7, 12, 21, 4); g.fillStyle = '#4a4a4a'; g.fillRect(8, 11, 16, 2); g.fillRect(8, 22, 16, 2); break;
      case D.HAY: sh(12, 27); g.fillStyle = '#c8a040'; rrect(g, 4, 10, 24, 17, 5); g.fillStyle = '#e0c060'; for (let i = 0; i < 5; i++) g.fillRect(6 + i * 5, 12, 1, 13); break;
      case D.CAR: { const c = ['#c83a3a', '#3a6ad0', '#e0c040', '#f0f0f0', '#3a3a44'][v % 5]; g.fillStyle = 'rgba(0,0,0,0.25)'; rrect(g, 3, 9, 27, 18, 5); g.fillStyle = c; rrect(g, 2, 7, 27, 17, 5); g.fillStyle = '#a8d0f0'; g.fillRect(8, 9, 6, 13); g.fillRect(19, 9, 5, 13); g.fillStyle = '#1a1a1a'; g.fillRect(5, 5, 5, 3); g.fillRect(21, 5, 5, 3); g.fillRect(5, 23, 5, 3); g.fillRect(21, 23, 5, 3); break; }
      case D.MAILBOX: sh(5, 29); g.fillStyle = '#5a4030'; g.fillRect(15, 14, 3, 15); g.fillStyle = '#3a5ab0'; rrect(g, 9, 6, 14, 10, 4); g.fillStyle = '#d03a3a'; g.fillRect(22, 5, 2, 6); break;
      case D.TRASHCAN: sh(7, 28); g.fillStyle = '#6a7078'; rrect(g, 9, 9, 14, 19, 2); g.fillStyle = '#8a9098'; g.fillRect(8, 7, 16, 4); break;
      case D.SNOWMAN: sh(9, 28); g.fillStyle = '#ffffff'; circle(g, 16, 22, 8); circle(g, 16, 11, 6); g.fillStyle = '#222'; g.fillRect(14, 9, 1.5, 1.5); g.fillRect(17, 9, 1.5, 1.5); g.fillStyle = '#f08a2a'; tri(g, 16, 11, 22, 12, 16, 13); g.fillStyle = '#d03a3a'; g.fillRect(10, 15, 12, 3); break;
      case D.ICESPIKE: g.fillStyle = '#a8d8f0'; tri(g, 8, 28, 12, 6, 16, 28); g.fillStyle = '#d0f0ff'; tri(g, 14, 28, 19, 3, 24, 28); break;
      case D.SHELL: g.fillStyle = '#f0c8b0'; ellipse(g, 12 + (v % 3) * 3, 18, 4, 3); g.fillStyle = '#e0a090'; tri(g, 9 + (v % 3) * 3, 18, 15 + (v % 3) * 3, 18, 12 + (v % 3) * 3, 14); break;
      case D.BONES: g.fillStyle = '#d8d4c4'; g.fillRect(9, 18, 12, 2); circle(g, 9, 19, 2); circle(g, 21, 19, 2); break;
      case D.SKULL: g.fillStyle = '#d8d4c4'; circle(g, 16, 17, 5); g.fillRect(13, 20, 6, 3); g.fillStyle = '#222'; g.fillRect(13, 15, 2, 2); g.fillRect(17, 15, 2, 2); break;
      case D.LOG: sh(12, 26); g.fillStyle = '#7a4a2a'; rrect(g, 3, 15, 26, 9, 4); g.fillStyle = '#c8a070'; ellipse(g, 27, 19.5, 3, 4.5); g.fillStyle = '#7a4a2a'; ellipse(g, 27, 19.5, 1.5, 2.5); break;
      case D.STALL: { const c = ['#d03a3a', '#3a7ab0', '#e0a030'][v % 3]; sh(13, 28); g.fillStyle = '#8a5a2a'; g.fillRect(4, 16, 24, 10); g.fillStyle = c; g.fillRect(2, 6, 28, 8); g.fillStyle = '#ffffff'; for (let x = 2; x < 30; x += 8) g.fillRect(x, 6, 4, 8); g.fillStyle = '#e0c040'; circle(g, 10, 18, 2); g.fillStyle = '#6ab040'; circle(g, 16, 18, 2); g.fillStyle = '#d03a3a'; circle(g, 22, 18, 2); break; }
      case D.UMBRELLA: g.fillStyle = '#e0e0e0'; g.fillRect(15, 12, 2, 16); g.fillStyle = v % 2 ? '#e83a5a' : '#3ab0e8'; g.beginPath(); g.arc(16, 13, 12, Math.PI, 0); g.fill(); break;
      case D.TIRE: sh(8, 27); g.fillStyle = '#2a2a2a'; circle(g, 16, 19, 8); g.fillStyle = '#5a5a5a'; circle(g, 16, 19, 3.5); break;
      case D.VINES: for (let i = 0; i < 3; i++) { const x = 6 + i * 9; g.strokeStyle = '#3a7a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 5, 14, x - 2, 30); g.stroke(); g.fillStyle = '#4a9a3a'; circle(g, x + 2, 10, 2); circle(g, x, 22, 2); } break;
      case D.EMBER: g.fillStyle = '#ff7a2a'; for (let i = 0; i < 4; i++) g.fillRect(6 + rnd() * 20, 8 + rnd() * 18, 2, 2); break;
      case D.STAR: g.fillStyle = '#fff6b0'; { const x = 10 + (v % 4) * 3, y = 12 + (v % 3) * 3; g.fillRect(x, y - 3, 1, 7); g.fillRect(x - 3, y, 7, 1); } break;
      case D.BIGTREE: g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, 16, 28, 14, 4); g.fillStyle = '#5a3a1a'; g.fillRect(11, 14, 10, 15); g.fillStyle = '#1e4a1e'; circle(g, 16, 11, 15); g.fillStyle = '#2f6a2a'; circle(g, 12, 8, 9); circle(g, 22, 10, 8); g.fillStyle = '#4f9a40'; circle(g, 14, 5, 4); break;
      case D.GATE: g.fillStyle = '#6a6a72'; g.fillRect(2, 4, 6, 26); g.fillRect(24, 4, 6, 26); g.fillRect(2, 2, 28, 5); break;
      case D.ALTAR: sh(12, 28); g.fillStyle = '#8a8a94'; g.fillRect(5, 14, 22, 13); g.fillStyle = '#a8a8b2'; g.fillRect(3, 11, 26, 5); g.fillStyle = th.accent; circle(g, 16, 8, 3); g.fillStyle = rgba(th.accent, 0.3); circle(g, 16, 8, 7); break;
      case D.ROOF: case D.FACADE: case D.DOOR: paintBuilding(g, d, v, th, tk); break;
      // furniture
      case D.BED: g.fillStyle = '#6a4a2a'; g.fillRect(4, 3, 24, 27); g.fillStyle = '#f0ece0'; g.fillRect(6, 5, 20, 8); g.fillStyle = ['#c84a4a', '#4a6ac8', '#6a9a4a'][v % 3]; g.fillRect(6, 12, 20, 16); g.fillStyle = shade(['#c84a4a', '#4a6ac8', '#6a9a4a'][v % 3], 0.2); g.fillRect(6, 12, 20, 3); break;
      case D.HOSPITALBED: g.fillStyle = '#9aa0a8'; g.fillRect(4, 3, 24, 27); g.fillStyle = '#ffffff'; g.fillRect(6, 5, 20, 22); g.fillStyle = '#b0d0f0'; g.fillRect(6, 13, 20, 14); break;
      case D.TABLE: sh(12, 28); g.fillStyle = '#7a4a2a'; g.fillRect(6, 20, 3, 8); g.fillRect(23, 20, 3, 8); g.fillStyle = '#a06a3a'; rrect(g, 3, 9, 26, 13, 3); g.fillStyle = '#f0e8d0'; circle(g, 12, 15, 2.5); g.fillStyle = '#e0c060'; g.fillRect(19, 13, 4, 4); break;
      case D.CHAIR: g.fillStyle = '#7a4a2a'; g.fillRect(10, 8, 12, 4); g.fillRect(10, 14, 12, 8); g.fillRect(10, 22, 2, 6); g.fillRect(20, 22, 2, 6); break;
      case D.DESK: sh(12, 28); g.fillStyle = '#8a5a30'; g.fillRect(3, 10, 26, 12); g.fillStyle = '#6a4020'; g.fillRect(3, 22, 4, 6); g.fillRect(25, 22, 4, 6); g.fillStyle = '#f0f0e8'; g.fillRect(8, 12, 8, 6); g.fillStyle = '#3a3a3a'; g.fillRect(20, 13, 5, 1); break;
      case D.BOOKSHELF: g.fillStyle = '#5a3a1a'; g.fillRect(2, 2, 28, 28); for (let r = 0; r < 3; r++) { g.fillStyle = '#3a2410'; g.fillRect(4, 4 + r * 9, 24, 7); for (let b = 0; b < 6; b++) { g.fillStyle = ['#c84a4a', '#4a6ac8', '#6a9a4a', '#d0a040', '#8a4ab0'][(b + r + v) % 5]; g.fillRect(5 + b * 4, 5 + r * 9 + (b % 2), 3, 6 - (b % 2)); } } break;
      case D.COUNTER: g.fillStyle = '#7a4a2a'; g.fillRect(0, 8, 32, 22); g.fillStyle = '#a06a3a'; g.fillRect(0, 6, 32, 5); if (v % 3 === 0) { g.fillStyle = '#e0c040'; circle(g, 10, 6, 2.5); } if (v % 3 === 1) { g.fillStyle = '#c84a4a'; g.fillRect(18, 2, 5, 5); } break;
      case D.FIREPLACE: g.fillStyle = '#6a6a72'; g.fillRect(2, 2, 28, 28); g.fillStyle = '#1a1010'; rrect(g, 7, 10, 18, 18, 4); g.fillStyle = '#ff7a2a'; tri(g, 10, 26, 16, 13 + f * 2, 22, 26); g.fillStyle = '#ffd040'; tri(g, 13, 26, 16, 18 - f, 19, 26); break;
      case D.THRONE: sh(12, 29); g.fillStyle = '#c8a030'; g.fillRect(6, 2, 20, 26); g.fillStyle = '#a02020'; g.fillRect(9, 6, 14, 18); g.fillStyle = '#e8c040'; circle(g, 9, 3, 2.5); circle(g, 23, 3, 2.5); circle(g, 16, 2, 3); break;
      case D.PEW: g.fillStyle = '#6a4020'; g.fillRect(2, 10, 28, 6); g.fillStyle = '#8a5a30'; g.fillRect(2, 16, 28, 8); break;
      case D.PLANT: sh(7, 29); g.fillStyle = '#b0603a'; g.fillRect(11, 20, 10, 9); g.fillStyle = '#3a8a3a'; circle(g, 16, 14, 7); circle(g, 11, 17, 4); circle(g, 21, 17, 4); break;
      case D.RUG: g.fillStyle = ['#a03a3a', '#3a5aa0', '#7a5a2a'][v % 3]; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(255,230,160,0.4)'; g.fillRect(2, 2, 28, 2); g.fillRect(2, 28, 28, 2); break;
      case D.COMPUTER: g.fillStyle = '#5a6470'; g.fillRect(4, 14, 24, 14); g.fillStyle = '#2a2e36'; g.fillRect(6, 3, 20, 14); g.fillStyle = f ? '#3ad0e0' : '#2ab0c0'; g.fillRect(8, 5, 16, 10); g.fillStyle = '#ffffff'; g.fillRect(9, 7, 8, 1); g.fillRect(9, 10, 11, 1); break;
      case D.MACHINE: g.fillStyle = '#4a5260'; g.fillRect(2, 2, 28, 28); g.fillStyle = '#6a7480'; g.fillRect(4, 4, 24, 12); g.fillStyle = f ? '#3ae070' : '#e0c040'; circle(g, 9, 22, 2.5); g.fillStyle = '#e04040'; circle(g, 16, 22, 2.5); g.fillStyle = '#3ad0e0'; g.fillRect(6, 6, 20, 2); break;
      case D.CELLBARS: g.fillStyle = '#5a5a62'; for (let x = 2; x < 32; x += 6) g.fillRect(x, 0, 3, 32); g.fillRect(0, 4, 32, 3); break;
      case D.BLACKBOARD: g.fillStyle = '#6a4a2a'; g.fillRect(-2, 4, 36, 22); g.fillStyle = '#2a4a3a'; g.fillRect(0, 6, 32, 18); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(4, 10, 14, 1); g.fillRect(4, 14, 20, 1); g.fillRect(4, 18, 9, 1); break;
      case D.CABINET: g.fillStyle = '#c8c8d0'; g.fillRect(4, 2, 24, 28); g.fillStyle = '#a0a0a8'; g.fillRect(15, 4, 2, 24); g.fillStyle = '#e04040'; g.fillRect(8, 8, 4, 1.5); g.fillRect(9.25, 6.75, 1.5, 4); break;
      case D.LABTABLE: sh(12, 28); g.fillStyle = '#e8e8f0'; g.fillRect(3, 10, 26, 12); g.fillStyle = '#9aa0a8'; g.fillRect(4, 22, 3, 6); g.fillRect(25, 22, 3, 6); g.fillStyle = '#60e060'; rrect(g, 8, 4, 4, 9, 1.5); g.fillStyle = '#d060e0'; rrect(g, 18, 6, 5, 7, 2); break;
      case D.TORCH: g.fillStyle = '#5a3a1a'; g.fillRect(14, 12, 4, 12); g.fillStyle = '#ff8a2a'; tri(g, 11, 13, 16, 2 + f * 2, 21, 13); g.fillStyle = '#ffe060'; tri(g, 13.5, 13, 16, 6 + f, 18.5, 13); break;
      case D.BANNER: g.fillStyle = th.accent; g.fillRect(9, 2, 14, 24); tri(g, 9, 26, 23, 26, 16, 31); g.fillStyle = shade(th.accent, -0.3); circle(g, 16, 12, 4); break;
      case D.CANDLE: g.fillStyle = '#f0ecd0'; g.fillRect(14, 14, 4, 12); g.fillStyle = '#ffd040'; ellipse(g, 16, 11 - f, 2, 3.5); g.fillStyle = 'rgba(255,220,100,0.25)'; circle(g, 16, 11, 6); break;
      case D.SHELF: g.fillStyle = '#7a4a2a'; g.fillRect(2, 2, 28, 28); for (let r = 0; r < 3; r++) { g.fillStyle = '#5a3418'; g.fillRect(3, 9 + r * 9, 26, 2); for (let b = 0; b < 4; b++) { g.fillStyle = ['#e0c040', '#c84a4a', '#6ab040', '#4a8ad0'][(b + r + v) % 4]; circle(g, 7 + b * 6, 6 + r * 9, 2.2); } } break;
      case D.WARDROBE: g.fillStyle = '#6a4020'; g.fillRect(3, 1, 26, 29); g.fillStyle = '#8a5a30'; g.fillRect(5, 3, 10, 25); g.fillRect(17, 3, 10, 25); g.fillStyle = '#e0c060'; g.fillRect(14, 14, 1.5, 3); g.fillRect(17, 14, 1.5, 3); break;
      default: break;
    }
  }
  function paintBuilding(g, d, v, th, tk) {
    const st = styleOf(v, th);
    const S = st.S;
    if (d === D.ROOF) {
      const c = st.roof;
      g.fillStyle = c; g.fillRect(0, 0, TS, TS);
      if (S.roof === 'flat' || S.roof === 'deck') { g.fillStyle = shade(c, -0.12); g.fillRect(0, 0, 32, 2); g.fillRect(0, 0, 2, 32); g.fillStyle = shade(c, 0.08); g.fillRect(6, 6, 6, 4); if (S.roof === 'deck') { g.fillStyle = shade(c, -0.18); for (let y = 0; y < 32; y += 5) g.fillRect(0, y, 32, 1); } }
      else if (S.roof === 'crenel') { g.fillStyle = shade(c, -0.15); for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); for (let x = (y / 8) % 2 ? 4 : 12; x < 32; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = shade(c, 0.12); for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 5, 4); }
      else if (S.roof === 'metal') { g.fillStyle = shade(c, -0.15); for (let x = 0; x < 32; x += 5) g.fillRect(x, 0, 1, 32); g.fillStyle = '#e0a02a'; g.fillRect(0, 0, 32, 1); }
      else if (S.roof === 'awning') { for (let x = 0; x < 32; x += 8) { g.fillStyle = x % 16 ? '#ffffff' : c; g.fillRect(x, 0, 8, 32); } g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 26, 32, 6); }
      else if (S.roof === 'cone' || S.roof === 'steep') { g.fillStyle = shade(c, -0.1); for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 32, 1); g.fillStyle = shade(c, 0.12); g.fillRect(0, 0, 32, 2); }
      else { for (let y = 0; y < 32; y += 6) { g.fillStyle = shade(c, -0.18); g.fillRect(0, y + 4, 32, 2); g.fillStyle = shade(c, -0.1); for (let x = (y / 6) % 2 ? 0 : 4; x < 32; x += 8) g.fillRect(x, y, 1, 4); } g.fillStyle = shade(c, 0.15); g.fillRect(0, 0, 32, 1); }
      return;
    }
    const wall = st.wall;
    g.fillStyle = wall; g.fillRect(0, 0, TS, TS);
    if (S.wall === 'brick') { g.fillStyle = shade(wall, -0.18); for (let y = 2; y < 32; y += 6) { g.fillRect(0, y, 32, 1); for (let x = (y % 12) ? 3 : 9; x < 32; x += 12) g.fillRect(x, y, 1, 6); } }
    else if (S.wall === 'stone') { g.fillStyle = shade(wall, -0.15); for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); for (let x = (y / 8) % 2 ? 4 : 12; x < 32; x += 16) g.fillRect(x, y, 1, 8); } }
    else if (S.wall === 'metal' || S.wall === 'glass') { g.fillStyle = shade(wall, -0.18); g.fillRect(0, 0, 1, 32); g.fillRect(16, 0, 1, 32); }
    else if (S.wall === 'timber') { g.fillStyle = '#5a3a1a'; g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32); g.fillRect(0, 14, 32, 2); }
    else if (S.wall === 'hull') { g.fillStyle = shade(wall, 0.12); for (let y = 0; y < 32; y += 6) g.fillRect(0, y, 32, 1); }
    else { g.fillStyle = shade(wall, -0.08); for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, 32, 4);
    g.fillStyle = shade(wall, -0.3); g.fillRect(0, 30, 32, 2);
    if (d === D.DOOR) {
      const door = st.key === 'castle' || st.key === 'temple' ? '#4a3018' : st.key === 'lab' || st.key === 'tall' || st.key === 'hospital' ? '#5a7a9a' : th.door;
      g.fillStyle = shade(door, -0.3); rrect(g, 8, 8, 16, 24, 4);
      g.fillStyle = door; rrect(g, 9, 9, 14, 23, 3);
      g.fillStyle = '#e8c060'; circle(g, 20, 21, 1.3);
      if (st.key === 'lab' || st.key === 'tall' || st.key === 'hospital') { g.fillStyle = 'rgba(200,230,255,0.6)'; g.fillRect(11, 11, 10, 9); }
      const sign = S.sign;
      if (sign) {
        g.fillStyle = '#e8dcc0'; g.fillRect(0, 6, 7, 8);
        g.fillStyle = { shop: '#c84a4a', tavern: '#c88a2a', school: '#3a6ad0', temple: '#e8c040', book: '#8a4a2a', cross: '#e03a3a', gear: '#5a6470', bars: '#3a3a44' }[sign] || '#888';
        if (sign === 'cross') { g.fillRect(2.5, 7, 2, 6); g.fillRect(0.5, 9, 6, 2); } else circle(g, 3.5, 10, 2.5);
      }
    } else if (S.windows !== false && (v & 15) % 3 !== 2) {
      g.fillStyle = shade(th.door, -0.25); g.fillRect(8, 9, 16, 14);
      g.fillStyle = tk === 'scifi' || tk === 'alien' ? '#2ad0e0' : tk === 'undead' ? '#e0c060' : S.wall === 'glass' ? '#9ac8e8' : '#a8d8f0';
      g.fillRect(9, 10, 14, 12);
      g.fillStyle = shade(th.door, -0.25); g.fillRect(15, 10, 2, 12); g.fillRect(9, 15, 14, 1);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(10, 11, 3, 3);
    }
  }

  const Tiles = {
    gcache: new Map(), dcache: new Map(), tk: '',
    setTheme(tk) { if (this.tk !== tk) { this.gcache.clear(); this.dcache.clear(); this.tk = tk; this.th = RPG.THEMES[tk]; } },
    ground(t, v, f, k) {
      const key = (((k || 0) * 32 + t) << 9) | (v << 1) | f;
      let cv = this.gcache.get(key);
      if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = TS; paintGround(cv.getContext('2d'), t, v, f, this.th, this.tk, k || 0); this.gcache.set(key, cv); }
      return cv;
    },
    deco(d, v, f) {
      const key = (d << 9) | (v << 1) | f;
      let cv = this.dcache.get(key);
      if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = TS; paintDeco(cv.getContext('2d'), d, v, f, this.th, this.tk); this.dcache.set(key, cv); }
      return cv;
    },
    mini(g, d, th) {
      if (d === D.DOOR || d === D.CAVE) return '#ffd040';
      if (d === D.ROOF || d === D.FACADE) return th.roof[0];
      if (d === D.CLIFF || d === D.ROCK) return th.rock;
      if (d && treeTypes[d] !== undefined) return shade(th.leaf, -0.1);
      switch (g) {
        case G.GRASS: return th.ground[0];
        case G.PATH: case G.BRIDGE: return th.path;
        case G.WATER: return th.water;
        case G.SAND: return '#e0c27a';
        case G.SNOW: return '#eef4f8';
        case G.DIRT: case G.CROPS: case G.DFLOOR: return '#9a7a52';
        case G.STONE: return '#9a9aa0';
        case G.ASH: return '#4a3a34';
        case G.SHORE: return th.shore;
        case G.LAVA: return '#e8601c';
        case G.MURK: return '#3a5a3a';
        case G.CLOUD: return '#e8f0ff';
        case G.WALL: return th.dWall;
        case G.FLOOR: case G.WOOD: case G.TILE: case G.SFLOOR: return th.dFloor;
        case G.CARPET: return th.dFloor2;
        case G.EXIT: return '#ffffff';
      }
      return '#000';
    },
  };

  // ---------- SPRITES ----------
  function lookFor(name, arch, color) {
    const n = String(name).toLowerCase();
    const has = (...w) => w.some((x) => n.includes(x));
    const L = { arch, color, skin: '#e0b090', shirt: color, pants: shade(color, -0.4), hat: null, robe: false, ghost: false, bony: false, metal: false, kind: null, horns: false, ears: false, mask: false, wraps: false, fur: false };
    if (has('skeleton', 'bone', 'lich', 'skelet')) { L.bony = true; L.skin = '#e8e4d0'; L.shirt = '#5a5048'; L.pants = '#3a3430'; }
    if (has('zombie', 'ghoul', 'undead')) { L.skin = '#8aa070'; L.shirt = shade(color, -0.3); }
    if (has('mummy')) { L.skin = '#d8cca0'; L.wraps = true; L.shirt = '#d8cca0'; L.pants = '#c8bc90'; }
    if (has('robot', 'droid', 'android', 'cyborg', 'mech', 'bot', 'turret', 'machine', 'security', 'sentinel')) { L.metal = true; L.skin = '#a8b0b8'; L.shirt = shade(color, -0.1); }
    if (has('ghost', 'spirit', 'wraith', 'specter', 'spectre', 'phantom', 'banshee', 'wisp', 'soul', 'shade')) L.ghost = true;
    if (has('goblin', 'orc', 'troll', 'ogre', 'lizard', 'alien', 'gnoll', 'kobold', 'imp', 'demon')) { L.skin = color; L.shirt = '#5a4030'; L.pants = '#3a2a20'; }
    if (has('goblin', 'kobold', 'imp', 'elf')) L.ears = true;
    if (has('pirate', 'buccaneer', 'raider', 'thug', 'brigand')) L.hat = 'bandana';
    if (has('bandit', 'thief', 'outlaw', 'assassin', 'ninja')) { L.mask = true; L.hat = 'hood'; }
    if (has('knight', 'guard', 'soldier', 'trooper', 'warrior', 'samurai', 'sentinel')) L.hat = 'helmet';
    if (has('wizard', 'mage', 'sorcer', 'warlock', 'necromancer', 'witch', 'shaman', 'priest', 'druid', 'cultist', 'oracle', 'hag', 'psi', 'psychic', 'lich')) {
      L.robe = true; L.hat = has('witch', 'hag') ? 'witch' : has('cultist', 'necromancer', 'priest', 'lich') ? 'hood' : has('psi', 'psychic') ? null : 'wizard';
    }
    if (has('demon', 'imp', 'devil', 'minotaur', 'horned', 'fiend')) L.horns = true;
    if (has('dragon', 'drake', 'wyvern', 'wyrm', 'hydra')) L.kind = 'dragon';
    else if (has('spider', 'ant', 'beetle', 'insect', 'bug', 'crawler', 'tick')) L.kind = 'spider';
    else if (has('scorpion')) L.kind = 'scorpion';
    else if (has('crab', 'lobster')) L.kind = 'crab';
    else if (has('snake', 'serpent', 'worm', 'eel', 'naga')) L.kind = 'snake';
    else if (has('bat')) L.kind = 'bat';
    else if (has('drone')) L.kind = 'drone';
    else if (has('eye')) L.kind = 'eye';
    else if (has('golem', 'stone', 'rock', 'statue', 'gargoyle')) L.kind = 'golem';
    else if (has('frog', 'toad')) L.kind = 'frog';
    if (has('yeti', 'bear', 'gorilla', 'werewolf', 'ape')) L.fur = true;
    if (has('yeti')) L.skin = '#e8eef5';
    return L;
  }

  // a person-shaped sprite: player, NPCs, humanoid/caster/brute enemies, the villain
  function drawPerson(c, x, y, o, time) {
    const s = o.scale || 1, dir = o.dir || 'down';
    const W = (v) => (o.flash ? '#ffffff' : v);
    const step = o.moving ? Math.sin(o.walk || 0) : 0;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.28)'; ellipse(c, 0, 0, 8, 3);
    if (o.ghost) { c.globalAlpha *= 0.78; c.translate(0, Math.sin(time * 3) * 1.5 - 3); }
    const wide = o.wide ? 2 : 0;
    if (o.wings) { c.fillStyle = 'rgba(220,240,255,0.7)'; const fl = Math.sin(time * 14) * 3; ellipse(c, -9, -16 - fl * 0.3, 7, 4 + fl * 0.4); ellipse(c, 9, -16 - fl * 0.3, 7, 4 + fl * 0.4); }
    // cape (behind)
    if (o.cape) { c.fillStyle = W(o.cape); rrect(c, -7 - wide, -16, 14 + wide * 2, dir === 'up' ? 15 : 13, 3); }
    // legs
    if (!o.robe && !o.ghost) {
      c.fillStyle = W(o.pants);
      c.fillRect(-4 - wide / 2, -7, 3.5, 6 + step * 1.5);
      c.fillRect(0.5 + wide / 2, -7, 3.5, 6 - step * 1.5);
      c.fillStyle = W(shade(o.pants, -0.35));
      c.fillRect(-4.5 - wide / 2, -1 + step * 1.5, 4.5, 2); c.fillRect(0 + wide / 2, -1 - step * 1.5, 4.5, 2);
    }
    // body
    c.fillStyle = W(o.shirt);
    if (o.robe || o.ghost) {
      c.beginPath(); c.moveTo(-5 - wide, -16); c.lineTo(5 + wide, -16); c.lineTo(8 + wide, o.ghost ? -3 : 0); c.lineTo(-8 - wide, o.ghost ? -3 : 0); c.closePath(); c.fill();
      if (o.ghost) { c.fillStyle = W(o.shirt); for (let i = -6; i <= 6; i += 4) tri(c, i - 2, -3, i + 2, -3, i, 1 + Math.sin(time * 6 + i) * 1.5); }
      c.fillStyle = W(shade(o.shirt, -0.2)); c.fillRect(-1, -15, 2, 14);
    } else {
      rrect(c, -6 - wide, -16, 12 + wide * 2, 10, 3);
      c.fillStyle = W(shade(o.shirt, -0.25)); c.fillRect(-6 - wide, -8, 12 + wide * 2, 2);
      if (o.bony) { c.fillStyle = W('#e8e4d0'); for (let i = 0; i < 3; i++) c.fillRect(-4, -14 + i * 2.5, 8, 1); }
      if (o.wraps) { c.fillStyle = W('#b8ac80'); for (let i = 0; i < 4; i++) c.fillRect(-6, -15 + i * 3, 12, 1); }
      if (o.apron) { c.fillStyle = W('#f0ece0'); c.fillRect(-4, -12, 8, 7); }
      if (o.coat) { c.fillStyle = W(o.coat); c.fillRect(-6 - wide, -16, 3.5, 13); c.fillRect(2.5 + wide, -16, 3.5, 13); }
      if (o.tie) { c.fillStyle = W('#c83a3a'); c.fillRect(-1, -15, 2, 7); }
    }
    // arms
    const armSwing = o.moving ? step * 2 : 0;
    c.fillStyle = W(o.robe ? o.shirt : shade(o.shirt, -0.08));
    if (o.armsForward && dir !== 'up') { c.fillRect(-8 - wide, -15, 3, 6); c.fillRect(5 + wide, -15, 3, 6); }
    else { c.fillRect(-8.5 - wide, -15 + armSwing, 3, 8); c.fillRect(5.5 + wide, -15 - armSwing, 3, 8); }
    c.fillStyle = W(o.skin);
    if (!o.armsForward) { c.fillRect(-8.5 - wide, -8 + armSwing, 3, 2.5); c.fillRect(5.5 + wide, -8 - armSwing, 3, 2.5); }
    // held item
    if (o.staff) {
      const sx = dir === 'left' ? -9 : 9;
      line(c, sx, -4, sx, -24, 1.6, W('#7a5a3a'));
      c.fillStyle = W(o.staff); circle(c, sx, -25, o.charging ? 3.6 : 2.4);
      if (o.charging) { c.fillStyle = rgba(o.staff[0] === '#' ? o.staff : '#ffffff', 0.35); circle(c, sx, -25, 7); }
    }
    // head
    const hy = -21;
    if (o.metal) { c.fillStyle = W(o.skin); rrect(c, -6, hy - 6, 12, 11, 2); c.fillStyle = W(o.eyeColor || '#ff3030'); if (dir !== 'up') c.fillRect(dir === 'left' ? -5 : dir === 'right' ? -1 : -4, hy - 2, dir === 'down' ? 8 : 6, 2.5); line(c, 0, hy - 6, 0, hy - 10, 1, W('#888')); c.fillStyle = W('#ff3030'); circle(c, 0, hy - 10, 1.2); }
    else {
      c.fillStyle = W(o.skin); circle(c, 0, hy, o.bigHead ? 7.5 : 6);
      if (o.ears) { tri(c, -5, hy - 1, -11, hy - 4, -5, hy + 2); tri(c, 5, hy - 1, 11, hy - 4, 5, hy + 2); }
      // hair
      if (o.hair && !o.hat) {
        c.fillStyle = W(o.hair);
        if (dir === 'up') circle(c, 0, hy, 6.2);
        else { c.beginPath(); c.arc(0, hy - 0.5, 6.3, Math.PI, 0); c.fill(); c.fillRect(-6.3, hy - 1, 2, 4); c.fillRect(4.3, hy - 1, 2, 4); if (o.longHair) { c.fillRect(-6.3, hy, 2.5, 8); c.fillRect(3.8, hy, 2.5, 8); } }
      }
      if (o.beard && dir !== 'up') { c.fillStyle = W(o.beard); c.beginPath(); c.arc(0, hy + 2, 5, 0, Math.PI); c.fill(); tri(c, -3, hy + 5, 3, hy + 5, 0, hy + 10); }
      // face
      if (dir !== 'up') {
        const ex = dir === 'left' ? -3 : dir === 'right' ? 3 : 0;
        c.fillStyle = W(o.bony ? '#201818' : o.eyeColor || '#1a1a2a');
        if (dir === 'down') { c.fillRect(-3 + ex, hy - 1, o.bony ? 2.5 : 1.6, 2.4); c.fillRect(1.6 + ex, hy - 1, o.bony ? 2.5 : 1.6, 2.4); }
        else c.fillRect(ex - 0.8, hy - 1, 1.8, 2.4);
        if (o.mask) { c.fillStyle = W('#2a2a2a'); c.fillRect(-5 + ex * 0.4, hy + 1, 10, 3.5); }
        if (o.glasses && dir === 'down') { c.strokeStyle = W('#2a2a2a'); c.lineWidth = 0.8; c.strokeRect(-4.2, hy - 1.8, 3.2, 3); c.strokeRect(1, hy - 1.8, 3.2, 3); }
      }
    }
    if (o.horns) { c.fillStyle = W('#e8dcc0'); tri(c, -5, hy - 4, -9, hy - 12, -2, hy - 5); tri(c, 5, hy - 4, 9, hy - 12, 2, hy - 5); }
    // hats
    switch (o.hat) {
      case 'wizard': c.fillStyle = W(o.hatColor || o.shirt); tri(c, -8, hy - 3, 8, hy - 3, 2, hy - 18); c.fillRect(-8, hy - 4, 16, 2.5); c.fillStyle = W('#f0d040'); circle(c, 1, hy - 9, 1.2); break;
      case 'witch': c.fillStyle = W('#2a2030'); tri(c, -6, hy - 4, 6, hy - 4, 4, hy - 17); c.fillRect(-10, hy - 5, 20, 2.5); break;
      case 'hood': c.fillStyle = W(o.hatColor || shade(o.shirt, -0.15)); c.beginPath(); c.arc(0, hy - 1, 7.5, Math.PI * 1.02, Math.PI * 1.98); c.fill(); c.fillRect(-7.5, hy - 2, 2.5, 7); c.fillRect(5, hy - 2, 2.5, 7); if (dir === 'up') circle(c, 0, hy, 7); break;
      case 'helmet': c.fillStyle = W(o.hatColor || '#9aa0aa'); c.beginPath(); c.arc(0, hy - 1, 6.8, Math.PI, 0); c.fill(); c.fillRect(-6.8, hy - 2, 13.6, 2.5); if (o.plume) { c.fillStyle = W(o.plume); rrect(c, -1.5, hy - 13, 3, 7, 1.5); } break;
      case 'bandana': c.fillStyle = W(o.hatColor || '#c83a3a'); c.beginPath(); c.arc(0, hy - 1, 6.4, Math.PI, 0); c.fill(); c.fillRect(-6.4, hy - 2, 12.8, 2); tri(c, dir === 'left' ? 5 : -5, hy - 2, dir === 'left' ? 10 : -10, hy + 2, dir === 'left' ? 6 : -6, hy + 1); break;
      case 'crown': c.fillStyle = W('#f0c840'); c.fillRect(-5, hy - 9, 10, 3); tri(c, -5, hy - 9, -5, hy - 13, -2, hy - 9); tri(c, -1.5, hy - 9, 0, hy - 14, 1.5, hy - 9); tri(c, 2, hy - 9, 5, hy - 13, 5, hy - 9); break;
      case 'cap': c.fillStyle = W(o.hatColor || '#3a7a3a'); c.beginPath(); c.arc(0, hy - 1, 6.4, Math.PI, 0); c.fill(); c.fillRect(dir === 'left' ? -10 : -2, hy - 2, 12, 2); if (o.plume) { c.fillStyle = W(o.plume); tri(c, 3, hy - 6, 9, hy - 14, 5, hy - 5); } break;
      case 'chef': c.fillStyle = W('#ffffff'); c.fillRect(-5, hy - 10, 10, 6); circle(c, -3, hy - 11, 3.5); circle(c, 3, hy - 11, 3.5); circle(c, 0, hy - 13, 3.5); break;
      case 'nurse': c.fillStyle = W('#ffffff'); c.fillRect(-5, hy - 9, 10, 4); c.fillStyle = W('#e03a3a'); c.fillRect(-1, hy - 8.5, 2, 3); c.fillRect(-2, hy - 7.5, 4, 1); break;
      case 'straw': c.fillStyle = W('#e0c060'); ellipse(c, 0, hy - 4, 11, 3); c.fillStyle = W('#d0a840'); c.beginPath(); c.arc(0, hy - 4, 6, Math.PI, 0); c.fill(); c.fillStyle = W('#c84a4a'); c.fillRect(-6, hy - 5, 12, 1.5); break;
      case 'tophat': c.fillStyle = W('#1a1a22'); c.fillRect(-8, hy - 6, 16, 2.5); c.fillRect(-5, hy - 16, 10, 11); c.fillStyle = W('#c83a3a'); c.fillRect(-5, hy - 8, 10, 2); break;
      case 'jester': c.fillStyle = W('#d03ab0'); tri(c, -7, hy - 4, 0, hy - 4, -11, hy - 13); c.fillStyle = W('#3a8ad0'); tri(c, 0, hy - 4, 7, hy - 4, 11, hy - 13); c.fillStyle = W('#f0d040'); circle(c, -11, hy - 13, 1.8); circle(c, 11, hy - 13, 1.8); break;
      case 'tricorn': c.fillStyle = W('#2a2a2a'); c.fillRect(-9, hy - 5, 18, 3); tri(c, -6, hy - 4, 6, hy - 4, 0, hy - 12); c.fillStyle = W('#e0c060'); c.fillRect(-9, hy - 5, 18, 1); break;
    }
    c.restore();
  }

  function drawSlime(c, x, y, o, time) {
    const s = o.scale || 1;
    const W = (v) => (o.flash ? '#ffffff' : v);
    const sq = o.hop ? 1.25 : 1 + Math.sin(time * 6 + (o.seed || 0)) * 0.08;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, 0, 0, 10, 3);
    const lift = o.hop ? -6 : 0;
    const w = 10 / Math.sqrt(sq), h = 10 * sq;
    c.fillStyle = W(shade(o.color, -0.2));
    c.beginPath(); c.moveTo(-w, lift); c.quadraticCurveTo(-w, lift - h * 1.3, 0, lift - h * 1.3); c.quadraticCurveTo(w, lift - h * 1.3, w, lift); c.closePath(); c.fill();
    c.fillStyle = W(o.color);
    c.beginPath(); c.moveTo(-w + 1.5, lift - 1); c.quadraticCurveTo(-w + 1.5, lift - h * 1.2, 0, lift - h * 1.2); c.quadraticCurveTo(w - 1.5, lift - h * 1.2, w - 1.5, lift - 1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(c, -3, lift - h * 0.9, 2.5, 1.6);
    if (/mushroom|fung/.test(o.name || '')) { c.fillStyle = W('#c8443a'); ellipse(c, 0, lift - h * 1.15, w + 3, 4); c.fillStyle = '#fff'; circle(c, -3, lift - h * 1.2, 1); circle(c, 3, lift - h * 1.15, 1); }
    c.fillStyle = W('#1a1a1a');
    const ex = o.dir === 'left' ? -2 : o.dir === 'right' ? 2 : 0;
    if (o.dir !== 'up') { c.fillRect(-3.5 + ex, lift - h * 0.55, 2, 3); c.fillRect(1.5 + ex, lift - h * 0.55, 2, 3); }
    c.restore();
  }

  function drawBeast(c, x, y, o, time) {
    const s = o.scale || 1;
    const W = (v) => (o.flash ? '#ffffff' : v);
    const face = o.face || 1;
    const ph = o.moving ? time * 14 : 0;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s * face, s);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, 0, 0, 11, 3);
    const col = o.color, dark = shade(col, -0.3), light = shade(col, 0.2);
    switch (o.kind) {
      case 'spider': {
        c.strokeStyle = W(dark); c.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
          const a = Math.sin(ph + i + (sd > 0 ? 1.5 : 0)) * 1.5;
          c.beginPath(); c.moveTo(sd * 3, -6); c.lineTo(sd * (8 + i), -10 + i * 1.5 + a); c.lineTo(sd * (11 + i), -1); c.stroke();
        }
        c.fillStyle = W(dark); ellipse(c, -4, -7, 7, 5.5);
        c.fillStyle = W(col); ellipse(c, 4, -7, 4.5, 4);
        c.fillStyle = W('#ff3030'); c.fillRect(6, -9, 1.5, 1.5); c.fillRect(4, -9, 1.5, 1.5); c.fillRect(7, -7, 1, 1);
        break;
      }
      case 'scorpion': {
        c.fillStyle = W(col); ellipse(c, 0, -5, 8, 4);
        c.strokeStyle = W(col); c.lineWidth = 3; c.beginPath(); c.moveTo(-7, -5); c.quadraticCurveTo(-14, -18, -4, -18 + Math.sin(time * 4) * 2); c.stroke();
        c.fillStyle = W(dark); tri(c, -4, -20, -1, -16, -6, -16);
        c.fillStyle = W(light); circle(c, 10, -6, 3); circle(c, 10, -2, 2.5);
        c.strokeStyle = W(dark); c.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, -3); c.lineTo(i * 4 + 2, 0 + Math.sin(ph + i)); c.stroke(); }
        break;
      }
      case 'crab': {
        c.strokeStyle = W(dark); c.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 5, -4); c.lineTo(sd * (9 + i * 1.5), -1 + Math.sin(ph + i) * 1); c.stroke(); }
        c.fillStyle = W(col); ellipse(c, 0, -6, 9, 5.5);
        c.fillStyle = W(light); circle(c, -11, -11, 3.5); circle(c, 11, -11, 3.5);
        c.fillStyle = W(col); tri(c, -11, -13, -14, -16, -9, -15); tri(c, 11, -13, 14, -16, 9, -15);
        line(c, -3, -10, -3, -14, 1.2, W(dark)); line(c, 3, -10, 3, -14, 1.2, W(dark));
        c.fillStyle = W('#111'); circle(c, -3, -14.5, 1.3); circle(c, 3, -14.5, 1.3);
        break;
      }
      case 'snake': {
        c.fillStyle = W(col);
        for (let i = 0; i < 6; i++) circle(c, -10 + i * 3.5, -4 - Math.sin(time * 6 - i * 0.9) * 2, 3.2 - i * 0.1);
        c.fillStyle = W(light); ellipse(c, 11, -8, 4.5, 3.5);
        c.fillStyle = W('#111'); c.fillRect(12, -10, 1.5, 1.5);
        line(c, 15, -7, 18, -7 + Math.sin(time * 20), 0.8, W('#e02020'));
        break;
      }
      case 'frog': {
        c.fillStyle = W(dark); ellipse(c, -6, -2, 5, 3); ellipse(c, 6, -2, 5, 3);
        c.fillStyle = W(col); ellipse(c, 0, -7, 9, 7);
        c.fillStyle = W(light); ellipse(c, 0, -5, 6, 4);
        c.fillStyle = W(col); circle(c, -4, -13, 3); circle(c, 4, -13, 3);
        c.fillStyle = W('#111'); circle(c, -4, -13.5, 1.4); circle(c, 4, -13.5, 1.4);
        break;
      }
      default: {
        const wings = o.kind === 'dragon';
        if (wings) {
          c.fillStyle = W(shade(col, -0.15));
          const fl = Math.sin(time * 5) * 4;
          c.beginPath(); c.moveTo(-2, -12); c.lineTo(-14, -26 - fl); c.lineTo(-6, -20); c.lineTo(-2, -25 - fl); c.lineTo(4, -12); c.closePath(); c.fill();
        }
        // tail
        c.strokeStyle = W(col); c.lineWidth = wings ? 3 : 2; c.beginPath(); c.moveTo(-8, -8); c.quadraticCurveTo(-14, -10, -15, -14 + Math.sin(time * 5) * 2); c.stroke();
        if (wings) { c.fillStyle = W(dark); tri(c, -15, -16, -18, -13, -13, -12); }
        // legs
        c.fillStyle = W(dark);
        const lg = (lx, off) => c.fillRect(lx, -5, 2.6, 5 + Math.sin(ph + off) * 1.5);
        lg(-7, 0); lg(-3, Math.PI); lg(3, Math.PI); lg(6, 0);
        c.fillStyle = W(col); ellipse(c, 0, -8, 10, 5.5);
        c.fillStyle = W(light); ellipse(c, 0, -6, 7, 2.5);
        if (o.fur) { c.fillStyle = W(light); for (let i = -6; i <= 6; i += 3) tri(c, i - 1.5, -13, i + 1.5, -13, i, -15.5); }
        // head
        c.fillStyle = W(col); circle(c, 10, -12, 5);
        c.fillStyle = W(dark); ellipse(c, 14, -11, 3.5, 2.4);
        c.fillStyle = W(col); tri(c, 7, -15, 9, -21, 11, -16); if (!wings) tri(c, 10, -16, 13, -21, 13, -15);
        if (wings) { c.fillStyle = W('#e8dcc0'); tri(c, 8, -16, 6, -22, 10, -17); tri(c, 11, -16, 11, -22, 13, -16); }
        c.fillStyle = W(o.aggro ? '#ff3020' : '#111'); c.fillRect(11, -14, 1.8, 1.8);
        c.fillStyle = W('#fff'); c.fillRect(15, -10, 1, 1.4); c.fillRect(13, -10, 1, 1.4);
      }
    }
    c.restore();
  }

  function drawFlyer(c, x, y, o, time) {
    const s = o.scale || 1;
    const W = (v) => (o.flash ? '#ffffff' : v);
    const col = o.color, dark = shade(col, -0.3);
    const hover = -16 + Math.sin(time * 4 + (o.seed || 0)) * 3;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(c, 0, 0, 7, 2.5);
    c.translate(0, hover);
    const flap = Math.sin(time * 22 + (o.seed || 0));
    switch (o.kind) {
      case 'drone': {
        c.fillStyle = W(dark); c.fillRect(-12, -2, 24, 2);
        c.fillStyle = W('#d0d8e0'); ellipse(c, -12, -3, 5, 1 + Math.abs(flap)); ellipse(c, 12, -3, 5, 1 + Math.abs(flap));
        c.fillStyle = W(col); rrect(c, -6, -4, 12, 9, 3);
        c.fillStyle = W('#ff3030'); circle(c, 0, 1, 2);
        break;
      }
      case 'eye': {
        c.fillStyle = W('#f0ece8'); circle(c, 0, 0, 8);
        c.fillStyle = W(col === '#e0e0e0' ? '#c03030' : col); circle(c, (o.face || 1) * 2, 0, 4);
        c.fillStyle = W('#111'); circle(c, (o.face || 1) * 3, 0, 2);
        c.strokeStyle = W('#c06060'); c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6, -2 + i * 2); c.lineTo(-10 - i, 4 + i * 2 + Math.sin(time * 5 + i) * 2); c.stroke(); }
        break;
      }
      default: {
        const bat = o.kind === 'bat';
        c.fillStyle = W(dark);
        const wy = flap * 6;
        c.beginPath(); c.moveTo(-3, -1); c.lineTo(-15, -4 - wy); c.lineTo(bat ? -11 : -13, 2 - wy * 0.3); c.lineTo(bat ? -7 : -8, 1); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(3, -1); c.lineTo(15, -4 - wy); c.lineTo(bat ? 11 : 13, 2 - wy * 0.3); c.lineTo(bat ? 7 : 8, 1); c.closePath(); c.fill();
        c.fillStyle = W(col); ellipse(c, 0, 0, 6, 5.5);
        if (bat || o.horns) { tri(c, -4, -4, -5, -9, -1, -5); tri(c, 4, -4, 5, -9, 1, -5); }
        else { c.fillStyle = W('#f0c040'); tri(c, (o.face || 1) * 5, -1, (o.face || 1) * 9, 0, (o.face || 1) * 5, 1.5); }
        c.fillStyle = W(bat ? '#ff4040' : '#111'); c.fillRect(-3, -2, 1.8, 1.8); c.fillRect(1.5, -2, 1.8, 1.8);
      }
    }
    c.restore();
  }

  function drawGolem(c, x, y, o, time) {
    const s = o.scale || 1;
    const W = (v) => (o.flash ? '#ffffff' : v);
    const col = o.color, dark = shade(col, -0.3), light = shade(col, 0.15);
    const step = o.moving ? Math.sin(o.walk || 0) : 0;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, 0, 0, 12, 4);
    c.fillStyle = W(dark); c.fillRect(-8, -8, 6, 8 + step); c.fillRect(2, -8, 6, 8 - step);
    c.fillStyle = W(col); rrect(c, -11, -24, 22, 17, 4);
    c.fillStyle = W(light); rrect(c, -9, -22, 10, 6, 2);
    c.fillStyle = W(dark); rrect(c, -16, -23, 6, 15, 3); rrect(c, 10, -23, 6, 15, 3);
    c.fillStyle = W(col); rrect(c, -6, -32, 12, 9, 2);
    c.fillStyle = W(o.eyeColor || '#60e0ff'); if (o.dir !== 'up') { c.fillRect(-4, -29, 3, 2); c.fillRect(1, -29, 3, 2); }
    line(c, -5, -18, 1, -12, 1, W(shade(col, -0.45)));
    c.restore();
  }

  // ---------- animals (friendly or not) ----------
  function drawAnimal(c, x, y, o, time) {
    const A = (RPG.LIB.ANIMALS[o.animal] || RPG.LIB.ANIMALS.dog);
    const body = A.body;
    const W = (v) => (o.flash ? '#ffffff' : v);
    const col = o.color || A.color, dark = shade(col, -0.3), light = shade(col, 0.25);
    const s = (o.scale || 1) * (A.size || 1);
    const face = o.face || 1;
    const ph = o.moving ? time * 14 : 0;
    if (body === 'bird' && !A.grounded) return drawFlyer(c, x, y, Object.assign({}, o, { color: col, kind: o.animal === 'crow' || o.animal === 'raven' ? 'bird' : 'bird', scale: s }), time);
    if (body === 'bug') return drawFlyer(c, x, y, Object.assign({}, o, { color: col, kind: 'bat', scale: s * 0.7 }), time);
    if (body === 'snake' || body === 'spider' || body === 'crab' || body === 'frog') return drawBeast(c, x, y, Object.assign({}, o, { color: col, kind: body, scale: s, face }), time);
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(s * face, s);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, 0, 0, 11, 3);
    if (body === 'bird') { // grounded birds: ducks, chickens, penguins
      c.fillStyle = W(dark); c.fillRect(-2, -3, 1.5, 3); c.fillRect(1, -3, 1.5, 3);
      c.fillStyle = W(col); ellipse(c, 0, -8, 7, 6); circle(c, 5, -15, 4.5);
      c.fillStyle = W(o.animal === 'penguin' ? '#ffffff' : light); ellipse(c, 1, -7, 4, 4);
      c.fillStyle = W('#f0a030'); tri(c, 8, -16, 12, -15, 8, -13.5);
      c.fillStyle = W('#111'); c.fillRect(6, -17, 1.6, 1.6);
      c.restore(); return;
    }
    if (body === 'fish') { c.fillStyle = W(col); ellipse(c, 0, -8, 9, 5); tri(c, -8, -8, -14, -13, -14, -3); c.fillStyle = W('#111'); c.fillRect(5, -10, 1.6, 1.6); c.restore(); return; }
    if (body === 'turtle') { c.fillStyle = W('#6aa05a'); circle(c, 10, -6, 3.5); c.fillRect(-8, -3, 3, 3); c.fillRect(5, -3, 3, 3); c.fillStyle = W(dark); ellipse(c, 0, -7, 9, 6); c.fillStyle = W(col); ellipse(c, 0, -8, 7, 4.5); c.fillStyle = W('#111'); c.fillRect(11, -7, 1.4, 1.4); c.restore(); return; }
    const legsH = 5 * (A.legs || 1);
    const small = body === 'small';
    // tail
    if (A.tail === 'bushy') { c.fillStyle = W(col); ellipse(c, -11, -10 - legsH * 0.3, 6, 3.5); c.fillStyle = W('#f8f0e0'); circle(c, -15, -11 - legsH * 0.3, 2); }
    else if (A.tail === 'mane') { c.fillStyle = W(A.mane || dark); ellipse(c, -11, -8 - legsH * 0.3, 3, 6); }
    else if (A.tail === 'puff') { c.fillStyle = W('#ffffff'); circle(c, -9, -7 - legsH * 0.3, 2.5); }
    else if (A.tail === 'curl') { c.strokeStyle = W(col); c.lineWidth = 1.5; c.beginPath(); c.arc(-11, -10, 3, 0, Math.PI * 1.6); c.stroke(); }
    else if (A.tail === 'spike') { c.strokeStyle = W(col); c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -8); c.quadraticCurveTo(-15, -9, -17, -14); c.stroke(); c.fillStyle = W(dark); tri(c, -18, -16, -19, -12, -15, -13); }
    else if (A.tail !== 'none') { c.strokeStyle = W(col); c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, -8 - legsH * 0.3); c.quadraticCurveTo(-13, -10, -13, -15 + Math.sin(time * 6) * (A.tail === 'wag' ? 3 : 1)); c.stroke(); }
    if (A.wings) { c.fillStyle = W(shade(col, -0.15)); const fl = Math.sin(time * 5) * 4; c.beginPath(); c.moveTo(-2, -12 - legsH * 0.4); c.lineTo(-14, -26 - fl); c.lineTo(-6, -20); c.lineTo(-2, -25 - fl); c.lineTo(4, -12 - legsH * 0.4); c.closePath(); c.fill(); }
    // legs
    c.fillStyle = W(dark);
    const lg = (lx, off) => c.fillRect(lx, -legsH, small ? 2 : 2.6, legsH + Math.sin(ph + off) * 1.2);
    lg(-7, 0); lg(-3, Math.PI); lg(3, Math.PI); lg(6, 0);
    // body
    const by = -legsH - 4;
    c.fillStyle = W(col); ellipse(c, 0, by, small ? 7 : 10, small ? 5 : 6);
    if (A.fluffy) { c.fillStyle = W('#ffffff'); for (let i = -8; i <= 8; i += 4) circle(c, i, by - 2, 3.5); }
    if (A.spiky) { c.fillStyle = W(dark); for (let i = -6; i <= 6; i += 3) tri(c, i - 1.5, by - 3, i + 1.5, by - 3, i, by - 8); }
    if (A.spots) { c.fillStyle = W(A.spots); circle(c, -3, by - 1, 2.5); circle(c, 4, by + 1, 2); }
    c.fillStyle = W(A.belly || light); ellipse(c, 1, by + 2, small ? 4 : 7, 2.2);
    // head
    const hx = small ? 7 : 10, hy = by - (small ? 3 : 5);
    if (A.mane && A.tail !== 'mane') { c.fillStyle = W(A.mane); circle(c, hx - 1, hy, 7); }
    if (A.tail === 'mane') { c.fillStyle = W(A.mane || dark); c.fillRect(hx - 6, hy - 4, 4, 9); }
    c.fillStyle = W(col); circle(c, hx, hy, small ? 4 : 5);
    const sn = A.snout || 0.8;
    if (A.trunk) { c.strokeStyle = W(col); c.lineWidth = 3; c.beginPath(); c.moveTo(hx + 4, hy); c.quadraticCurveTo(hx + 9, hy + 3, hx + 7, hy + 9); c.stroke(); }
    else { c.fillStyle = W(shade(col, -0.1)); ellipse(c, hx + 3 * sn + 1, hy + 1.5, 2.5 * sn + 1, 2.2); c.fillStyle = W('#2a1a1a'); circle(c, hx + 5 * sn + 1.2, hy + 1, 1.1); }
    if (A.mask) { c.fillStyle = W('#2a2a2a'); c.fillRect(hx - 2, hy - 2, 6, 2.5); }
    // ears
    c.fillStyle = W(col);
    if (A.ears === 'pointy') { tri(c, hx - 3, hy - 3, hx - 1, hy - 9, hx + 1, hy - 3); tri(c, hx, hy - 3, hx + 3, hy - 9, hx + 4, hy - 2); }
    else if (A.ears === 'floppy') { c.fillStyle = W(dark); ellipse(c, hx - 3, hy - 1, 2, 4); }
    else if (A.ears === 'round') { circle(c, hx - 3, hy - 4, 2); circle(c, hx + 2, hy - 4.5, 2); }
    else if (A.ears === 'long') { ellipse(c, hx - 2, hy - 9, 1.6, 5); ellipse(c, hx + 1, hy - 9, 1.6, 5); c.fillStyle = W('#f0b0c0'); ellipse(c, hx - 2, hy - 9, 0.7, 3.5); }
    else if (A.ears === 'big') { c.fillStyle = W(shade(col, -0.1)); ellipse(c, hx - 4, hy, 4, 6); }
    else if (A.ears === 'horn') { c.fillStyle = W('#e8dcc0'); tri(c, hx - 2, hy - 3, hx - 4, hy - 10, hx, hy - 4); tri(c, hx + 1, hy - 3, hx + 1, hy - 10, hx + 3, hy - 3); }
    if (A.horn) { c.fillStyle = W(A.horn); tri(c, hx + 1, hy - 4, hx + 4, hy - 13, hx + 3, hy - 3); }
    if (A.horns) { c.fillStyle = W('#e8dcc0'); tri(c, hx - 3, hy - 3, hx - 6, hy - 7, hx - 1, hy - 4); }
    if (A.antlers) { c.strokeStyle = W('#8a6a3a'); c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx, hy - 4); c.lineTo(hx - 2, hy - 11); c.moveTo(hx - 1, hy - 8); c.lineTo(hx - 5, hy - 10); c.moveTo(hx + 2, hy - 4); c.lineTo(hx + 4, hy - 11); c.stroke(); }
    c.fillStyle = W(o.aggro ? '#ff3020' : '#111'); c.fillRect(hx + 1, hy - 2, 1.7, 1.7);
    if (o.hat === 'crown') { c.fillStyle = W('#e8c040'); c.fillRect(hx - 3.5, hy - 8, 7, 3); tri(c, hx - 3.5, hy - 8, hx - 3.5, hy - 11, hx - 1.5, hy - 8); tri(c, hx - 1, hy - 8, hx, hy - 11.5, hx + 1, hy - 8); tri(c, hx + 1.5, hy - 8, hx + 3.5, hy - 11, hx + 3.5, hy - 8); }
    c.restore();
  }

  // ---------- story item icons ----------
  function drawIcon(c, x, y, icon, color, time, size) {
    const s = size || 1, col = color || '#e8c040', dk = shade(col, -0.3), lt = shade(col, 0.35);
    c.save(); c.translate(x, y); c.scale(s, s);
    switch (icon) {
      case 'key': c.fillStyle = col; circle(c, -4, 0, 4); c.fillRect(-1, -1.2, 10, 2.4); c.fillRect(6, 0, 2, 4); c.fillRect(3, 0, 2, 3); c.fillStyle = dk; circle(c, -4, 0, 1.6); break;
      case 'letter': c.fillStyle = col; c.fillRect(-7, -5, 14, 10); c.strokeStyle = dk; c.lineWidth = 1; c.beginPath(); c.moveTo(-7, -5); c.lineTo(0, 1); c.lineTo(7, -5); c.stroke(); c.fillStyle = '#d03a3a'; circle(c, 0, 1, 1.5); break;
      case 'book': c.fillStyle = col; c.fillRect(-6, -7, 12, 14); c.fillStyle = '#f0ecd8'; c.fillRect(-5, -6, 2, 12); c.fillStyle = '#e8c040'; c.fillRect(-1, -3, 5, 1.5); break;
      case 'scroll': case 'map': c.fillStyle = col; c.fillRect(-6, -5, 12, 10); c.fillStyle = dk; c.fillRect(-7, -6, 2, 12); c.fillRect(5, -6, 2, 12); if (icon === 'map') { c.strokeStyle = '#c83a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, 2); c.lineTo(0, -1); c.lineTo(3, 1); c.stroke(); } else { c.fillStyle = dk; c.fillRect(-3, -2, 6, 1); c.fillRect(-3, 1, 5, 1); } break;
      case 'sword': c.fillStyle = col; c.fillRect(-1, -9, 2.4, 12); tri(c, -1, -9, 1.4, -9, 0.2, -12); c.fillStyle = '#a07a3a'; c.fillRect(-4, 3, 8, 2); c.fillRect(-0.6, 4, 1.6, 5); break;
      case 'shield': c.fillStyle = col; c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, -7); c.lineTo(7, 0); c.quadraticCurveTo(0, 9, 0, 9); c.quadraticCurveTo(-7, 4, -7, 0); c.closePath(); c.fill(); c.fillStyle = lt; c.fillRect(-1, -6, 2, 12); break;
      case 'bow': c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(-3, 0, 8, -1.2, 1.2); c.stroke(); c.strokeStyle = '#e0e0e0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -7.5); c.lineTo(0, 7.5); c.stroke(); break;
      case 'wand': line(c, -6, 7, 5, -6, 2, col); c.fillStyle = '#ffe060'; circle(c, 6, -7, 2.5); break;
      case 'ring': c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 2, 5, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#60d0ff'; circle(c, 0, -4, 2.5); break;
      case 'amulet': c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(0, -4, 6, Math.PI * 0.1, Math.PI * 0.9, true); c.stroke(); c.fillStyle = col; circle(c, 0, 3, 4.5); c.fillStyle = '#d03a6a'; circle(c, 0, 3, 2.2); break;
      case 'crown': c.fillStyle = col; c.fillRect(-7, -1, 14, 6); tri(c, -7, -1, -7, -7, -3, -1); tri(c, -2, -1, 0, -8, 2, -1); tri(c, 3, -1, 7, -7, 7, -1); c.fillStyle = '#d03a3a'; circle(c, 0, 2, 1.5); break;
      case 'gem': case 'shard': c.fillStyle = col; tri(c, 0, -8, -6, 0, 6, 0); c.fillStyle = dk; tri(c, 0, 8, -6, 0, 6, 0); c.fillStyle = 'rgba(255,255,255,0.7)'; tri(c, 0, -8, -2, -1, 1, -1); break;
      case 'coin': c.fillStyle = dk; circle(c, 0, 0, 6); c.fillStyle = col; circle(c, 0, 0, 4.5); break;
      case 'bag': c.fillStyle = col; rrect(c, -6, -3, 12, 10, 4); c.fillStyle = dk; c.fillRect(-3, -6, 6, 4); break;
      case 'box': c.fillStyle = col; c.fillRect(-6, -4, 12, 10); c.fillStyle = '#f0d040'; c.fillRect(-1, -4, 2, 10); c.fillRect(-6, 0, 12, 2); tri(c, 0, -4, -5, -8, -1, -4); tri(c, 0, -4, 5, -8, 1, -4); break;
      case 'flower': line(c, 0, 8, 0, -1, 1.5, '#3a8a3a'); c.fillStyle = col; for (let a = 0; a < 5; a++) circle(c, Math.cos(a * 1.26) * 3.5, -4 + Math.sin(a * 1.26) * 3.5, 2.5); c.fillStyle = '#ffe060'; circle(c, 0, -4, 2); break;
      case 'fruit': c.fillStyle = col; circle(c, 0, 1, 6); c.fillStyle = 'rgba(255,255,255,0.4)'; circle(c, -2, -1, 1.5); line(c, 0, -5, 1, -8, 1.2, '#6a4a2a'); c.fillStyle = '#4a9a3a'; ellipse(c, 3, -7, 2.5, 1.2); break;
      case 'bread': c.fillStyle = col; ellipse(c, 0, 0, 8, 5); c.fillStyle = dk; for (let i = -4; i <= 4; i += 4) c.fillRect(i, -3, 1.5, 4); break;
      case 'cake': c.fillStyle = '#f0e0c0'; c.fillRect(-7, -1, 14, 8); c.fillStyle = col; c.fillRect(-7, -4, 14, 4); c.fillStyle = '#d03a3a'; circle(c, 0, -6, 2); break;
      case 'candy': c.fillStyle = col; circle(c, 0, 0, 4.5); tri(c, -4, 0, -9, -4, -9, 4); tri(c, 4, 0, 9, -4, 9, 4); break;
      case 'basket': c.fillStyle = col; c.fillRect(-7, -1, 14, 8); c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -1, 6, Math.PI, 0); c.stroke(); c.fillStyle = '#d03a3a'; circle(c, -2, -2, 2); c.fillStyle = '#f0d040'; circle(c, 2, -2, 2); break;
      case 'potion': c.fillStyle = '#d8e8f0'; c.fillRect(-1.5, -8, 3, 4); c.fillStyle = col; circle(c, 0, 2, 5.5); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-2.5, -1, 1.5, 3); break;
      case 'cup': c.fillStyle = col; c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, -6); c.lineTo(4, 3); c.lineTo(-4, 3); c.closePath(); c.fill(); c.fillRect(-1, 3, 2, 3); c.fillRect(-4, 6, 8, 2); break;
      case 'compass': c.fillStyle = col; circle(c, 0, 0, 7); c.fillStyle = '#f0ecd8'; circle(c, 0, 0, 5); c.fillStyle = '#d03a3a'; tri(c, 0, -4.5, -1.5, 0, 1.5, 0); c.fillStyle = '#3a3a3a'; tri(c, 0, 4.5, -1.5, 0, 1.5, 0); break;
      case 'lantern': c.fillStyle = '#3a3a3a'; c.fillRect(-5, -7, 10, 2); c.fillRect(-4, 5, 8, 2); c.fillStyle = col; c.fillRect(-4, -5, 8, 10); c.fillStyle = 'rgba(255,240,150,0.3)'; circle(c, 0, 0, 9 + Math.sin((time || 0) * 5)); break;
      case 'candle': c.fillStyle = col; c.fillRect(-2, -3, 4, 10); c.fillStyle = '#ffd040'; ellipse(c, 0, -6, 1.8, 3); break;
      case 'phone': c.fillStyle = col; rrect(c, -4, -7, 8, 14, 2); c.fillStyle = '#60c0f0'; c.fillRect(-3, -5, 6, 9); break;
      case 'laptop': c.fillStyle = col; c.fillRect(-7, -6, 14, 9); c.fillStyle = '#60c0f0'; c.fillRect(-6, -5, 12, 7); c.fillStyle = shade(col, -0.2); c.fillRect(-8, 3, 16, 3); break;
      case 'camera': c.fillStyle = col; rrect(c, -7, -4, 14, 10, 2); c.fillStyle = '#9ad0f0'; circle(c, 0, 1, 3); c.fillRect(-5, -6, 4, 2); break;
      case 'ball': c.fillStyle = col; circle(c, 0, 0, 6); c.fillStyle = '#2a2a2a'; circle(c, 0, 0, 2); circle(c, 4, -3, 1.4); circle(c, -4, 3, 1.4); break;
      case 'teddy': c.fillStyle = col; circle(c, 0, 2, 5); circle(c, 0, -5, 4); circle(c, -3.5, -8, 1.8); circle(c, 3.5, -8, 1.8); c.fillStyle = '#2a1a1a'; c.fillRect(-1.6, -6, 1.2, 1.2); c.fillRect(0.6, -6, 1.2, 1.2); break;
      case 'hat': c.fillStyle = col; ellipse(c, 0, 4, 9, 2.5); c.fillRect(-5, -6, 10, 10); c.fillStyle = '#d03a3a'; c.fillRect(-5, 1, 10, 2); break;
      case 'shoe': c.fillStyle = col; c.fillRect(-6, -4, 6, 8); rrect(c, -6, 1, 13, 5, 2); break;
      case 'umbrella': line(c, 0, -2, 0, 8, 1.4, '#3a3a3a'); c.fillStyle = col; c.beginPath(); c.arc(0, -1, 8, Math.PI, 0); c.fill(); break;
      case 'feather': c.fillStyle = col; ellipse(c, 0, -1, 3, 8); line(c, 0, -8, 0, 9, 1, shade(col, -0.4)); break;
      case 'egg': c.fillStyle = col; ellipse(c, 0, 1, 5, 6.5); c.fillStyle = 'rgba(255,255,255,0.5)'; circle(c, -1.5, -1.5, 1.4); break;
      case 'bone': c.fillStyle = col; c.fillRect(-5, -1.5, 10, 3); circle(c, -6, -2, 2); circle(c, -6, 2, 2); circle(c, 6, -2, 2); circle(c, 6, 2, 2); break;
      case 'shell': c.fillStyle = col; c.beginPath(); c.arc(0, 2, 6, Math.PI, 0); c.fill(); c.fillStyle = dk; for (let a = -2; a <= 2; a++) line(c, 0, 4, a * 2.5, -3, 0.8, dk); break;
      case 'star': c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, a = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); break;
      case 'heart': c.fillStyle = col; circle(c, -3, -2, 3.5); circle(c, 3, -2, 3.5); tri(c, -6.5, -1, 6.5, -1, 0, 7); break;
      case 'clock': c.fillStyle = col; circle(c, 0, 0, 7); c.fillStyle = '#f8f4e8'; circle(c, 0, 0, 5.5); line(c, 0, 0, 0, -4, 1.2, '#2a2a2a'); line(c, 0, 0, 3, 1, 1.2, '#2a2a2a'); break;
      case 'mirror': c.fillStyle = '#c8a040'; ellipse(c, 0, -2, 6, 7); c.fillStyle = col; ellipse(c, 0, -2, 4.5, 5.5); c.fillStyle = '#c8a040'; c.fillRect(-1, 5, 2, 5); break;
      case 'frame': c.fillStyle = col; c.fillRect(-7, -6, 14, 12); c.fillStyle = '#8ab0d0'; c.fillRect(-5, -4, 10, 8); c.fillStyle = '#5a9a4a'; tri(c, -5, 4, 0, -1, 5, 4); break;
      case 'ticket': c.fillStyle = col; c.fillRect(-7, -4, 14, 8); c.fillStyle = dk; c.fillRect(-3, -4, 1, 8); break;
      case 'rope': c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, 2.5, 0, Math.PI * 2); c.stroke(); break;
      case 'tool': line(c, -5, 6, 4, -3, 2, '#8a5a2a'); c.fillStyle = col; c.fillRect(1, -7, 8, 4); break;
      case 'gun': c.fillStyle = col; c.fillRect(-7, -3, 12, 4); c.fillRect(-6, 0, 4, 6); c.fillStyle = '#3ad0e0'; c.fillRect(4, -2.5, 3, 2); break;
      case 'battery': c.fillStyle = '#3a3a3a'; c.fillRect(-4, -7, 8, 14); c.fillRect(-1.5, -9, 3, 2); c.fillStyle = col; c.fillRect(-3, -1, 6, 7); break;
      case 'chip': c.fillStyle = col; c.fillRect(-5, -5, 10, 10); c.fillStyle = '#c0c8d0'; for (let i = -4; i <= 4; i += 4) { c.fillRect(i - 0.5, -7, 1, 2); c.fillRect(i - 0.5, 5, 1, 2); } break;
      case 'gear': c.fillStyle = col; circle(c, 0, 0, 5.5); for (let a = 0; a < 8; a++) { c.save(); c.rotate((a * Math.PI) / 4 + (time || 0)); c.fillRect(-1.5, -8, 3, 4); c.restore(); } c.fillStyle = '#3a3a3a'; circle(c, 0, 0, 2); break;
      case 'seed': c.fillStyle = col; ellipse(c, 0, 1, 4, 5.5); c.fillStyle = '#5aa03a'; ellipse(c, 2, -5, 3, 1.5); break;
      case 'leaf': c.fillStyle = col; ellipse(c, 0, 0, 4, 7); line(c, 0, -6, 0, 8, 0.8, shade(col, -0.4)); break;
      case 'mushroom': c.fillStyle = '#f0e8d8'; c.fillRect(-1.5, 0, 3, 6); c.fillStyle = col; c.beginPath(); c.arc(0, 1, 6, Math.PI, 0); c.fill(); c.fillStyle = '#ffffff'; circle(c, -2, -2, 1); circle(c, 2, -1, 1); break;
      case 'orb': c.fillStyle = rgba(col, 0.3); circle(c, 0, 0, 9); c.fillStyle = col; circle(c, 0, 0, 6); c.fillStyle = 'rgba(255,255,255,0.6)'; circle(c, -2, -2, 2); break;
      case 'horn': c.fillStyle = col; c.beginPath(); c.moveTo(-7, 3); c.quadraticCurveTo(0, -6, 7, -6); c.lineTo(7, 0); c.quadraticCurveTo(0, 0, -5, 6); c.closePath(); c.fill(); break;
      case 'bell': c.fillStyle = col; c.beginPath(); c.moveTo(-6, 4); c.quadraticCurveTo(-5, -7, 0, -7); c.quadraticCurveTo(5, -7, 6, 4); c.closePath(); c.fill(); circle(c, 0, 5, 1.6); break;
      case 'music': c.fillStyle = col; ellipse(c, -3, 2, 5, 6); c.fillRect(1, -9, 2.5, 9); c.fillStyle = '#2a1a1a'; circle(c, -3, 2, 1.6); break;
      case 'flag': line(c, -5, 8, -5, -8, 1.5, '#5a4030'); c.fillStyle = col; tri(c, -4, -8, 7, -4, -4, 0); break;
      case 'balloon': line(c, 0, 4, 0, 10, 0.8, '#5a5a5a'); c.fillStyle = col; ellipse(c, 0, -3, 5, 6.5); break;
      case 'carrot': c.fillStyle = col; tri(c, -3, -4, 3, -4, 0, 8); c.fillStyle = '#4a9a3a'; tri(c, -2, -4, 0, -9, 2, -4); break;
      case 'cheese': c.fillStyle = col; tri(c, -7, 5, 7, 5, 7, -4); c.fillStyle = dk; circle(c, 3, 2, 1.2); circle(c, 5, -1, 0.8); break;
      case 'jar': c.fillStyle = col; rrect(c, -5, -4, 10, 11, 2); c.fillStyle = '#c8a050'; c.fillRect(-5, -6, 10, 3); break;
      case 'log': c.fillStyle = col; rrect(c, -8, -3, 16, 7, 3); c.fillStyle = '#c8a070'; ellipse(c, 8, 0.5, 2, 3.5); break;
      case 'ore': c.fillStyle = col; c.beginPath(); c.moveTo(-6, 4); c.lineTo(-4, -4); c.lineTo(3, -6); c.lineTo(7, 1); c.lineTo(2, 6); c.closePath(); c.fill(); c.fillStyle = '#ffe060'; circle(c, -1, 0, 1.4); break;
      case 'mask': c.fillStyle = col; ellipse(c, 0, 0, 7, 6); c.fillStyle = '#2a2a2a'; ellipse(c, -2.5, -1, 1.6, 1.2); ellipse(c, 2.5, -1, 1.6, 1.2); break;
      case 'idol': c.fillStyle = col; c.fillRect(-3, -1, 6, 8); circle(c, 0, -4, 4); c.fillStyle = '#d03a3a'; c.fillRect(-2, -5, 1.4, 1.4); c.fillRect(0.6, -5, 1.4, 1.4); break;
      case 'cloth': c.fillStyle = col; c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, -6); c.lineTo(8, 6); c.lineTo(-8, 6); c.closePath(); c.fill(); break;
      case 'bucket': c.fillStyle = col; c.beginPath(); c.moveTo(-6, -4); c.lineTo(6, -4); c.lineTo(4, 6); c.lineTo(-4, 6); c.closePath(); c.fill(); break;
      case 'glasses': c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(-4, 0, 3.4, 0, Math.PI * 2); c.moveTo(7.4, 0); c.arc(4, 0, 3.4, 0, Math.PI * 2); c.moveTo(-0.6, -0.5); c.lineTo(0.6, -0.5); c.stroke(); c.fillStyle = 'rgba(160,210,255,0.5)'; circle(c, -4, 0, 2.6); circle(c, 4, 0, 2.6); break;
      case 'fish': c.fillStyle = col; ellipse(c, -1, 0, 6, 3.5); tri(c, 4, 0, 9, -4, 9, 4); c.fillStyle = '#111'; c.fillRect(-5, -1.5, 1.4, 1.4); break;
      case 'rod': line(c, -7, 7, 6, -7, 1.6, col); c.strokeStyle = '#d0d0d0'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(6, -7); c.lineTo(7, 4); c.stroke(); break;
      default: c.fillStyle = col; circle(c, 0, 0, 5);
    }
    c.restore();
  }

  // any character: person, robot, ghost or animal
  function drawCharacter(c, x, y, look, st, time) {
    const o = Object.assign({}, look, st || {});
    if (look.animal) return drawAnimal(c, x, y, o, time);
    return drawPerson(c, x, y, o, time);
  }

  function drawEnemy(c, e, time) {
    if (e.charLook) {
      const st = { dir: e.dir, face: e.face, moving: e.moving, walk: e.walkT, flash: e.hurt > 0 || (e.windup > 0 && Math.floor(time * 20) % 2 === 0), scale: (e.charLook.scale || 1) * (e.scale || 1), aggro: true };
      if (e.isVillain && !e.charLook.animal) { st.cape = e.charLook.cape || shade(e.charLook.shirt || '#5a2a6a', -0.35); st.eyeColor = '#ff3030'; }
      return drawCharacter(c, e.x, e.y + e.hh, e.charLook, st, time);
    }
    const L = e.look;
    const o = Object.assign({}, L, {
      dir: e.dir, face: e.face, moving: e.moving, walk: e.walkT, flash: e.hurt > 0, scale: e.scale, hop: e.hopping, seed: e.seed, aggro: e.state === 'chase',
      charging: e.charge > 0, name: e.name.toLowerCase(), color: L.color,
    });
    if (e.windup > 0) o.flash = Math.floor(time * 20) % 2 === 0;
    if (e.arch === 'slime') return drawSlime(c, e.x, e.y + e.hh, o, time);
    if (e.arch === 'flyer') return drawFlyer(c, e.x, e.y + e.hh, o, time);
    if (e.arch === 'beast' || L.kind === 'dragon' || L.kind === 'spider' || L.kind === 'crab' || L.kind === 'snake' || L.kind === 'scorpion' || L.kind === 'frog') {
      if (L.kind === 'dragon' && e.arch !== 'beast') o.scale = (o.scale || 1) * 1.3;
      return drawBeast(c, e.x, e.y + e.hh, o, time);
    }
    if (L.kind === 'bat' || L.kind === 'drone' || L.kind === 'eye') return drawFlyer(c, e.x, e.y + e.hh, o, time);
    if (L.kind === 'golem' || (L.metal && e.arch === 'brute')) return drawGolem(c, e.x, e.y + e.hh, o, time);
    const p = Object.assign(o, { skin: L.skin, shirt: L.shirt, pants: L.pants, hat: L.hat, robe: L.robe, ghost: L.ghost, bony: L.bony, metal: L.metal, horns: L.horns, ears: L.ears, mask: L.mask, wraps: L.wraps });
    if (e.arch === 'brute') { p.wide = true; p.scale = (p.scale || 1) * 1.3; if (L.fur) { p.shirt = L.skin === '#e0b090' ? L.color : L.skin; p.pants = shade(p.shirt, -0.2); p.skin = p.shirt; } }
    if (e.arch === 'caster') { p.staff = e.boss ? '#ff60ff' : shade(L.color, 0.5); if (!L.hat && !L.ghost) p.hat = 'hood'; }
    if (/zombie|ghoul|mummy/.test(o.name)) p.armsForward = true;
    if (/alien/.test(o.name)) { p.bigHead = true; p.eyeColor = '#101010'; }
    if (e.isVillain) { p.cape = shade(L.color, -0.35); if (!p.hat || p.hat === 'hood') p.hat = 'crown'; p.eyeColor = '#ff3030'; }
    drawPerson(c, e.x, e.y + e.hh, p, time);
  }

  // ---------- misc objects ----------
  function drawChest(c, x, y, opened, th) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, 0, 1, 11, 3);
    const wood = th && th.obstacle === 'pillar' ? '#5a6470' : '#8a5a2a';
    c.fillStyle = shade(wood, -0.3); c.fillRect(-10, -12, 20, 13);
    c.fillStyle = wood; c.fillRect(-9, -11, 18, 11);
    if (opened) { c.fillStyle = '#1a1008'; c.fillRect(-9, -15, 18, 4); c.fillStyle = shade(wood, 0.1); c.fillRect(-10, -21, 20, 6); }
    else { c.fillStyle = shade(wood, 0.12); rrect(c, -10, -18, 20, 8, 3); }
    c.fillStyle = '#e8c040'; c.fillRect(-10, -11, 20, 1.5); c.fillRect(-1.5, opened ? -11 : -13, 3, 5);
    c.restore();
  }
  function drawSign(c, x, y, style, th) {
    c.save(); c.translate(Math.round(x), Math.round(y));
    c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, 0, 1, 8, 2.5);
    if (style === 'tablet') {
      c.fillStyle = '#5a5a62'; rrect(c, -8, -20, 16, 21, 5);
      c.fillStyle = '#7a7a84'; rrect(c, -7, -19, 14, 19, 4);
      c.fillStyle = th ? th.accent : '#e8c060'; for (let i = 0; i < 4; i++) c.fillRect(-4, -15 + i * 4, 8 - (i % 2) * 3, 1.5);
    } else if (style === 'book') {
      c.fillStyle = '#5a3a1a'; c.fillRect(-2, -10, 4, 10); c.fillRect(-9, -14, 18, 5);
      c.fillStyle = '#f0e8d0'; c.fillRect(-8, -18, 7, 5); c.fillRect(1, -18, 7, 5);
      c.fillStyle = '#7a2a2a'; c.fillRect(-1, -18, 2, 5);
    } else if (style === 'post') {
      c.fillStyle = '#6a4a2a'; c.fillRect(-1.5, -22, 3, 22);
      c.fillStyle = '#a07a4a'; c.beginPath(); c.moveTo(-9, -20); c.lineTo(7, -20); c.lineTo(10, -17); c.lineTo(7, -14); c.lineTo(-9, -14); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(9, -12); c.lineTo(-7, -12); c.lineTo(-10, -9); c.lineTo(-7, -6); c.lineTo(9, -6); c.closePath(); c.fill();
    } else {
      c.fillStyle = '#6a4a2a'; c.fillRect(-1.5, -12, 3, 12);
      c.fillStyle = '#a07a4a'; c.fillRect(-9, -20, 18, 11);
      c.fillStyle = '#7a5a30'; c.fillRect(-7, -17, 14, 1); c.fillRect(-7, -14, 10, 1);
    }
    c.restore();
  }
  function drawCoin(c, x, y, t) { const w = Math.abs(Math.cos(t * 5)) * 4 + 0.6; c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, x, y + 1, 4, 1.5); c.fillStyle = '#c89a20'; ellipse(c, x, y - 5, w, 4.5); c.fillStyle = '#f8d040'; ellipse(c, x, y - 5, w * 0.7, 3.2); }
  function drawPotion(c, x, y, t) { c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, x, y + 1, 4, 1.5); const b = Math.sin(t * 4) * 1; c.fillStyle = '#d8e8f0'; c.fillRect(x - 1.5, y - 13 + b, 3, 3); c.fillStyle = '#d83a4a'; circle(c, x, y - 6 + b, 4.5); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x - 2.5, y - 8 + b, 1.5, 2); }
  function drawShard(c, x, y, t, color) {
    const b = Math.sin(t * 3) * 3;
    c.fillStyle = rgba(color, 0.25); circle(c, x, y - 12 + b, 12 + Math.sin(t * 5) * 2);
    c.save(); c.translate(x, y - 12 + b); c.scale(Math.cos(t * 2.5), 1);
    c.fillStyle = color; tri(c, 0, -9, -6, 0, 6, 0); c.fillStyle = shade(color, -0.25); tri(c, 0, 9, -6, 0, 6, 0);
    c.fillStyle = 'rgba(255,255,255,0.7)'; tri(c, 0, -9, -2, -1, 1, -1);
    c.restore();
  }
  function drawQuestItem(c, x, y, t) {
    const b = Math.sin(t * 3) * 2;
    c.fillStyle = 'rgba(255,240,150,0.25)'; circle(c, x, y - 8 + b, 9);
    c.fillStyle = '#c89a50'; rrect(c, x - 5, y - 12 + b, 10, 9, 3); c.fillStyle = '#8a6a30'; c.fillRect(x - 2, y - 14 + b, 4, 3);
    c.fillStyle = '#fff6c0'; const s = Math.abs(Math.sin(t * 6)) * 2 + 1; c.fillRect(x + 6, y - 16 + b, s, s);
  }

  RPG.Art = { drawAnimal, drawIcon, drawCharacter, TS, Tiles, shade, rgba, ellipse, circle, rrect, tri, line, lookFor, drawPerson, drawEnemy, drawSlime, drawBeast, drawFlyer, drawChest, drawSign, drawCoin, drawPotion, drawShard, drawQuestItem };
})();
