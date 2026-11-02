/* worldgen.js — builds the world around the story: every place in the text becomes a zone,
   building, interior or dungeon, laid out along a road in the order the story visits them. */
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const { THEMES, RNG, makeNoise, LIB } = RPG;

  // ground layer
  const G = { GRASS: 0, PATH: 1, WATER: 2, SAND: 3, SNOW: 4, DIRT: 5, STONE: 6, ASH: 7, SHORE: 8, BRIDGE: 9, LAVA: 10, MURK: 11, CLOUD: 12, FLOOR: 13, WALL: 14, WOOD: 15, TILE: 16, CARPET: 17, SFLOOR: 18, EXIT: 19, VOID: 20, CROPS: 21, DFLOOR: 22 };
  // decoration / object layer
  const D = {
    NONE: 0, TREE: 1, OAK: 2, PINE: 3, CACTUS: 4, DEADTREE: 5, PALM: 6, MANGROVE: 7, JUNGLE: 8, CANDY: 9, CRYSTAL: 10, WRECK: 11, BASALT: 12, TECH: 13,
    BUSH: 14, ROCK: 15, CLIFF: 16, FLOWERS: 17, MUSHROOM: 18, REEDS: 19, GRAVE: 20, FENCE: 21, TENT: 22, CAMPFIRE: 23, LAMPPOST: 24, BENCH: 25, STATUE: 26, WELL: 27, RUINWALL: 28, PILLAR: 29, CRATE: 30, BARREL: 31, HAY: 32, CAR: 33, MAILBOX: 34, TRASHCAN: 35, SNOWMAN: 36, ICESPIKE: 37, SHELL: 38, BONES: 39, SKULL: 40, LOG: 41, STALL: 42, UMBRELLA: 43, TIRE: 44, VINES: 45, EMBER: 46, STAR: 47, BIGTREE: 48, GATE: 49, ALTAR: 50,
    ROOF: 60, FACADE: 61, DOOR: 62, CAVE: 66,
    BED: 70, TABLE: 71, CHAIR: 72, DESK: 73, BOOKSHELF: 74, COUNTER: 75, FIREPLACE: 76, THRONE: 77, PEW: 79, PLANT: 80, RUG: 81, COMPUTER: 82, MACHINE: 83, CELLBARS: 84, BLACKBOARD: 85, CABINET: 86, HOSPITALBED: 87, LABTABLE: 88, TORCH: 89, BANNER: 90, CANDLE: 91, SHELF: 92, WARDROBE: 93,
  };
  const SOLID_G = new Uint8Array(32);
  [G.WATER, G.LAVA, G.MURK, G.WALL, G.VOID].forEach((t) => (SOLID_G[t] = 1));
  const PASS_D = new Uint8Array(128);
  [D.NONE, D.FLOWERS, D.MUSHROOM, D.REEDS, D.SHELL, D.BONES, D.SKULL, D.VINES, D.EMBER, D.STAR, D.DOOR, D.CAVE, D.CHAIR, D.RUG, D.GATE, D.TORCH, D.BANNER, D.BLACKBOARD].forEach((t) => (PASS_D[t] = 1));
  const TREE_OF = { tree: D.TREE, oak: D.OAK, pine: D.PINE, cactus: D.CACTUS, deadtree: D.DEADTREE, palm: D.PALM, mangrove: D.MANGROVE, jungle: D.JUNGLE, candy: D.CANDY, crystal: D.CRYSTAL, wreck: D.WRECK, basalt: D.BASALT, pillar: D.TECH, none: 0 };
  const GROUND_OF = { grass: G.GRASS, sand: G.SAND, snow: G.SNOW, dirt: G.DIRT, stone: G.STONE, ash: G.ASH, cloud: G.CLOUD, path: G.PATH };
  const PROP_OF = { lamppost: D.LAMPPOST, flowers: D.FLOWERS, barrel: D.BARREL, crate: D.CRATE, car: D.CAR, trashcan: D.TRASHCAN, bench: D.BENCH, mailbox: D.MAILBOX, stall: D.STALL, tent: D.TENT, log: D.LOG, mushroom: D.MUSHROOM, bush: D.BUSH, reeds: D.REEDS, rock: D.ROCK, shell: D.SHELL, umbrella: D.UMBRELLA, cliff: D.CLIFF, ember: D.EMBER, bones: D.BONES, skull: D.SKULL, hay: D.HAY, fence: D.FENCE, grave: D.GRAVE, ruinwall: D.RUINWALL, pillar: D.PILLAR, vines: D.VINES, snowman: D.SNOWMAN, icespike: D.ICESPIKE, star: D.STAR, tire: D.TIRE, well: D.WELL, statue: D.STATUE, campfire: D.CAMPFIRE, altar: D.ALTAR, bigtree: D.BIGTREE, gate: D.GATE };
  const FURN_OF = { bed: D.BED, table: D.TABLE, chair: D.CHAIR, desk: D.DESK, bookshelf: D.BOOKSHELF, counter: D.COUNTER, fireplace: D.FIREPLACE, throne: D.THRONE, pew: D.PEW, plant: D.PLANT, rug: D.RUG, computer: D.COMPUTER, machine: D.MACHINE, cellbars: D.CELLBARS, blackboard: D.BLACKBOARD, cabinet: D.CABINET, hospitalbed: D.HOSPITALBED, labtable: D.LABTABLE, torch: D.TORCH, banner: D.BANNER, candle: D.CANDLE, shelf: D.SHELF, wardrobe: D.WARDROBE, barrel: D.BARREL, crate: D.CRATE, hay: D.HAY, fence: D.FENCE, pillar: D.PILLAR, altar: D.ALTAR, bench: D.PEW, chest: D.CRATE, carpet: 0 };
  RPG.G = G; RPG.D = D; RPG.SOLID_G = SOLID_G; RPG.PASS_D = PASS_D;

  class GameMap {
    constructor(id, name, w, h, ground) {
      this.id = id; this.name = name; this.w = w; this.h = h;
      this.g = new Uint8Array(w * h).fill(ground);
      this.d = new Uint8Array(w * h);
      this.v = new Uint8Array(w * h);
      this.entities = []; this.portals = []; this.kind = 'over'; this.dark = 0; this.spawn = { x: 1, y: 1 };
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    gr(x, y) { return this.inb(x, y) ? this.g[y * this.w + x] : -1; }
    de(x, y) { return this.inb(x, y) ? this.d[y * this.w + x] : -1; }
    setG(x, y, t) { if (this.inb(x, y)) this.g[y * this.w + x] = t; }
    setD(x, y, t, v) { if (this.inb(x, y)) { this.d[y * this.w + x] = t; if (v !== undefined) this.v[y * this.w + x] = v; } }
    solid(x, y) { if (!this.inb(x, y)) return true; const i = y * this.w + x; return SOLID_G[this.g[i]] === 1 || PASS_D[this.d[i]] !== 1; }
    free(x, y) { if (!this.inb(x, y)) return false; const i = y * this.w + x; return !SOLID_G[this.g[i]] && this.d[i] === 0; }
  }
  RPG.GameMap = GameMap;

  function bfs(map, sx, sy, passThrough) {
    const n = map.w * map.h, dist = new Int32Array(n).fill(-1), q = new Int32Array(n);
    let h = 0, t = 0;
    if (!map.inb(sx, sy)) return dist;
    dist[sy * map.w + sx] = 0; q[t++] = sy * map.w + sx;
    while (h < t) {
      const i = q[h++], x = i % map.w, y = (i / map.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!map.inb(nx, ny)) continue;
        const j = ny * map.w + nx;
        if (dist[j] >= 0) continue;
        const blocked = SOLID_G[map.g[j]] || (!PASS_D[map.d[j]] && !(passThrough && passThrough(map.d[j])));
        if (blocked) continue;
        dist[j] = dist[i] + 1;
        if (map.d[j] !== D.DOOR && map.d[j] !== D.CAVE) q[t++] = j;
      }
    }
    return dist;
  }
  RPG.bfs = bfs;
  const dirName = (dx, dy) => ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  RPG.dirName = dirName;

  // ======================= the overworld =======================
  function buildOverworld(spec, rng, world) {
    const T = THEMES[spec.theme];
    const places = spec.places;
    const byId = Object.fromEntries(places.map((p) => [p.id, p]));
    // which places get an outdoor zone, and in what story order
    const beatOrder = (pid) => { const i = spec.beats.findIndex((b) => b.place === pid || b.obj.place === pid); return i < 0 ? 999 : i; };
    const zones = [];
    const zoneOf = {};
    const addZone = (place, biome, order) => { const z = { id: 'z' + zones.length, place, biome, order, hosts: [], r: 10 }; zones.push(z); return z; };
    const outdoor = places.filter((p) => p.cat === 'area' || p.cat === 'settlement');
    for (const p of outdoor) zoneOf[p.id] = addZone(p, p.biome || 'wilds', beatOrder(p.id));
    for (const p of places.filter((x) => x.cat === 'building' || x.cat === 'dungeon' || x.cat === 'landmark')) {
      let z = p.parent && zoneOf[p.parent];
      if (!z && p.cat === 'building' && p.owner === 'hero') z = zones.find((zz) => zz.place.cat === 'settlement');
      if (!z && p.cat === 'landmark') z = zones.find((zz) => beatOrder(zz.place.id) <= beatOrder(p.id)) || zones[0];
      if (!z) {
        const biome = p.cat === 'dungeon' ? (spec.theme === 'scifi' || spec.theme === 'city' ? 'street' : 'wilds') : p.interior === 'castle' ? 'wilds' : p.interior === 'barn' ? 'farm' : p.interior === 'ship' ? 'harbor' : 'clearing';
        z = addZone(Object.assign({}, p, { hostOnly: true }), biome, beatOrder(p.id));
      }
      z.hosts.push(p);
      zoneOf[p.id] = z;
      z.order = Math.min(z.order, beatOrder(p.id));
    }
    if (!zones.length) zoneOf.none = addZone({ id: 'gen', display: 'The Wilds', cat: 'area' }, 'clearing', 0);
    // the starting zone comes first
    const startZone = zoneOf[spec.startPlace] || zones[0];
    zones.sort((a, b) => (a === startZone ? -1 : b === startZone ? 1 : a.order - b.order));
    for (const z of zones) {
      const B = LIB.BIOMES[z.biome] || LIB.BIOMES.wilds;
      z.r = (z.biome === 'city' ? 15 : z.biome === 'settlement' || z.biome === 'harbor' ? 13 : z.biome === 'forest' || z.biome === 'jungle' ? 12 : z.biome === 'sea' || z.biome === 'lake' || z.biome === 'beach' ? 12 : 10) + Math.min(6, z.hosts.length * 2) + (B.houses ? 1 : 0);
    }
    // lay zones out along a winding road
    let ang = rng.float(0, Math.PI * 2);
    zones[0].x = 0; zones[0].y = 0;
    for (let i = 1; i < zones.length; i++) {
      const prev = zones[i - 1], z = zones[i];
      let placed = false;
      for (let tries = 0; tries < 60 && !placed; tries++) {
        const a = ang + rng.float(-1.2, 1.2) * (tries < 30 ? 1 : 2.6);
        const d = prev.r + z.r + rng.int(7, 13) + (tries >= 30 ? tries - 28 : 0);
        const x = prev.x + Math.cos(a) * d, y = prev.y + Math.sin(a) * d;
        if (zones.slice(0, i).every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + z.r + 5)) { z.x = x; z.y = y; ang = a; placed = true; }
      }
      if (!placed) { z.x = prev.x + prev.r + z.r + 8; z.y = prev.y; }
    }
    const margin = 16;
    const minX = Math.min(...zones.map((z) => z.x - z.r)) - margin, minY = Math.min(...zones.map((z) => z.y - z.r)) - margin;
    const maxX = Math.max(...zones.map((z) => z.x + z.r)) + margin, maxY = Math.max(...zones.map((z) => z.y + z.r)) + margin;
    const W = Math.max(60, Math.ceil(maxX - minX)), H = Math.max(50, Math.ceil(maxY - minY));
    for (const z of zones) { z.x = Math.round(z.x - minX + (W - (maxX - minX)) / 2); z.y = Math.round(z.y - minY + (H - (maxY - minY)) / 2); }
    const map = new GameMap('over', spec.region || (startZone.place.display || 'The World'), W, H, G.GRASS);
    map.kind = 'over';
    map.dark = T.outsideDark || 0;
    map.zones = zones;
    for (let i = 0; i < map.v.length; i++) map.v[i] = rng.int(0, 7);
    // wilderness between the zones
    const nTree = makeNoise(rng.fork('trees')), nWater = makeNoise(rng.fork('water'));
    const themeTree = TREE_OF[T.obstacle] || D.TREE;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const n = nTree(x / 9, y / 9);
      if (n > 0.6) map.d[i] = themeTree;
      else if (n > 0.52 && rng.chance(0.45)) map.d[i] = themeTree;
      else if (rng.chance(0.012)) map.d[i] = D.ROCK;
      else if (rng.chance(0.03)) map.d[i] = D.FLOWERS;
      if (nWater(x / 14 + 40, y / 14 + 40) < 0.22) { map.g[i] = T.island ? G.WATER : G.WATER; map.d[i] = 0; }
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) { if (T.island) { map.g[i] = G.WATER; map.d[i] = 0; } else map.d[i] = rng.chance(0.5) ? themeTree : D.CLIFF; }
    }
    // paint every zone in its biome
    const nEdge = makeNoise(rng.fork('edge'));
    for (const z of zones) paintZone(map, z, spec, T, rng.fork('zone' + z.id), nEdge, themeTree);
    // roads between consecutive zones
    const roadFrom = (z) => ({ x: z.x, y: z.y });
    for (let i = 1; i < zones.length; i++) carveRoad(map, roadFrom(zones[i - 1]), roadFrom(zones[i]), rng, zones);
    // buildings, caves and landmarks inside zones
    world.doors = {};
    world.caves = {};
    for (const z of zones) placeHosts(map, z, spec, T, rng.fork('hosts' + z.id), world);
    // make sure everything can be reached from the start
    map.spawn = findFree(map, startZone.x, startZone.y + 2, 6) || { x: startZone.x, y: startZone.y };
    connectAll(map, map.spawn, [...Object.values(world.doors), ...Object.values(world.caves), ...zones.map((z) => ({ x: z.x, y: z.y }))], rng);
    // shore trim
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const t = map.gr(x, y);
      if (t !== G.GRASS && t !== G.SAND) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.gr(x + dx, y + dy) === G.WATER)) { if (t === G.GRASS) map.setG(x, y, G.SHORE); }
    }
    map.startZone = startZone;
    return { map, zones, zoneOf };
  }

  function disk(z, rr, fn) { const r = Math.ceil(rr); for (let y = z.y - r; y <= z.y + r; y++) for (let x = z.x - r; x <= z.x + r; x++) { const d = Math.hypot(x - z.x, y - z.y); if (d <= rr) fn(x, y, d); } }

  function paintZone(map, z, spec, T, rng, nEdge, themeTree) {
    const B = LIB.BIOMES[z.biome] || LIB.BIOMES.wilds;
    const ground = GROUND_OF[B.ground] !== undefined ? GROUND_OF[B.ground] : G.GRASS;
    const treeT = B.trees === 'theme' ? themeTree : (TREE_OF[B.trees] !== undefined ? TREE_OF[B.trees] : themeTree);
    const R = z.r;
    const inZone = (x, y, d) => d <= R + (nEdge(x / 5, y / 5) - 0.5) * 6;
    disk(z, R + 3, (x, y, d) => {
      if (!map.inb(x, y) || x < 3 || y < 3 || x >= map.w - 3 || y >= map.h - 3 || !inZone(x, y, d)) return;
      map.setG(x, y, ground === G.GRASS && (spec.theme === 'desert') ? G.GRASS : ground);
      map.setD(x, y, 0);
      const clear = R * (B.houses ? 0.85 : 0.38);
      if (d > clear && treeT && rng.chance(B.treeDensity * (d > R * 0.7 ? 1.3 : 0.8))) map.setD(x, y, treeT);
    });
    // water features
    if (B.water === 'lake') {
      const a = rng.float(0, Math.PI * 2), cx = z.x + Math.cos(a) * R * 0.45, cy = z.y + Math.sin(a) * R * 0.45, rx = R * 0.42, ry = R * 0.3;
      disk(z, R, (x, y) => { const v = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (v < 1 + (nEdge(x / 3, y / 3) - 0.5) * 0.6) { map.setG(x, y, G.WATER); map.setD(x, y, 0); } });
    } else if (B.water === 'river') {
      const a = rng.float(0, Math.PI), nx = Math.cos(a), ny = Math.sin(a);
      disk(z, R + 2, (x, y) => { const dd = Math.abs((x - z.x) * ny - (y - z.y) * nx) + (nEdge(x / 4, y / 4) - 0.5) * 2; if (dd < 1.6) { map.setG(x, y, G.WATER); map.setD(x, y, 0); } });
      z.river = true;
    } else if (B.water === 'sea') {
      const a = rng.float(0, Math.PI * 2), nx = Math.cos(a), ny = Math.sin(a);
      disk(z, R + 2, (x, y) => { const dd = (x - z.x) * nx + (y - z.y) * ny + (nEdge(x / 4, y / 4) - 0.5) * 3; if (dd > R * 0.35) { map.setG(x, y, G.WATER); map.setD(x, y, 0); } else if (dd > R * 0.1 && map.gr(x, y) !== G.WATER) { map.setG(x, y, G.SAND); } });
    } else if (B.water === 'swamp') {
      for (let k = 0; k < 7; k++) { const cx = z.x + rng.int(-R + 2, R - 2), cy = z.y + rng.int(-R + 2, R - 2); if (Math.hypot(cx - z.x, cy - z.y) < 4) continue; disk({ x: cx, y: cy }, rng.float(1.2, 2.6), (x, y) => { map.setG(x, y, G.MURK); map.setD(x, y, 0); }); }
    } else if (B.water === 'lava') {
      for (let k = 0; k < 5; k++) { const cx = z.x + rng.int(-R + 2, R - 2), cy = z.y + rng.int(-R + 2, R - 2); if (Math.hypot(cx - z.x, cy - z.y) < 4) continue; disk({ x: cx, y: cy }, rng.float(1.2, 2.4), (x, y) => { map.setG(x, y, G.LAVA); map.setD(x, y, 0); }); }
    }
    // props (no cars in fairy tales: modern things get an old-fashioned stand-in)
    const modernWorld = ['modern', 'city', 'scifi', 'wasteland', 'alien'].includes(spec.theme);
    const OLD = { car: 'hay', trashcan: 'barrel', mailbox: 'crate', tire: 'log' };
    for (const [prop0, dens] of B.props || []) {
      const prop = !modernWorld && OLD[prop0] ? OLD[prop0] : prop0;
      const dId = PROP_OF[prop];
      if (!dId || !dens) continue;
      disk(z, R - 1, (x, y, d) => { if (d > 3 && map.free(x, y) && rng.chance(dens)) map.setD(x, y, dId); });
    }
    if (B.center && PROP_OF[B.center]) { const c = findFree(map, z.x + 2, z.y - 2, 3); if (c) map.setD(c.x, c.y, PROP_OF[B.center]); }
    if (B.crops) {
      const ox = z.x + rng.int(-2, 2) - 6, oy = z.y + 2;
      for (let y = oy; y < oy + 6; y++) for (let x = ox; x < ox + 12; x++) { if (!map.inb(x, y)) continue; const edge = y === oy || y === oy + 5 || x === ox || x === ox + 11; map.setG(x, y, edge ? G.GRASS : G.CROPS); map.setD(x, y, edge && !(x === ox + 6) ? D.FENCE : 0); }
    }
    if (B.fence) { disk(z, R * 0.75, (x, y, d) => { if (d > R * 0.75 - 1 && map.free(x, y) && Math.abs(x - z.x) > 1 && Math.abs(y - z.y) > 1) map.setD(x, y, D.FENCE); }); }
    if (z.biome === 'graveyard') { for (let y = z.y - 4; y <= z.y + 4; y += 2) for (let x = z.x - 6; x <= z.x + 6; x += 2) if (Math.abs(x - z.x) > 1 && map.free(x, y)) map.setD(x, y, D.GRAVE); }
    if (B.hedges) { disk(z, R * 0.6, (x, y, d) => { if (d > R * 0.6 - 1 && map.free(x, y) && Math.abs(x - z.x) > 1 && Math.abs(y - z.y) > 1) map.setD(x, y, D.BUSH); }); }
    if (B.streets) {
      for (let x = z.x - R + 2; x <= z.x + R - 2; x++) { map.setG(x, z.y, G.PATH); map.setD(x, z.y, 0); map.setG(x, z.y + 1, G.PATH); map.setD(x, z.y + 1, 0); }
      for (let y = z.y - R + 2; y <= z.y + R - 2; y++) { map.setG(z.x, y, G.PATH); map.setD(z.x, y, 0); map.setG(z.x + 1, y, G.PATH); map.setD(z.x + 1, y, 0); }
    }
    // keep a clear heart for story scenes
    disk(z, 2.5, (x, y) => { if (!SOLID_G[map.gr(x, y)]) map.setD(x, y, 0); else { map.setG(x, y, GROUND_OF[B.ground] || G.GRASS); map.setD(x, y, 0); } });
  }

  function findFree(map, cx, cy, maxR, avoid) {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (map.free(x, y) && map.gr(x, y) !== G.EXIT && !(avoid && avoid.has(x + ',' + y))) return { x, y };
    }
    return null;
  }

  function carveRoad(map, a, b, rng, zones) {
    let x = a.x, y = a.y, guard = 0;
    const paint = (px, py) => {
      const t = map.gr(px, py);
      if (t < 0 || px < 2 || py < 2 || px >= map.w - 2 || py >= map.h - 2) return;
      const dd = map.de(px, py);
      if (dd === D.DOOR || dd === D.CAVE || (dd >= 60 && dd < 70)) return;
      if (t === G.WATER || t === G.MURK || t === G.LAVA) map.setG(px, py, G.BRIDGE);
      else if (t !== G.BRIDGE && t !== G.CROPS) map.setG(px, py, G.PATH);
      if (!PASS_D[dd] || dd === D.FLOWERS) map.setD(px, py, 0);
    };
    paint(x, y);
    while ((x !== b.x || y !== b.y) && guard++ < 5000) {
      const dx = b.x - x, dy = b.y - y;
      let mx = 0, my = 0;
      if (rng.chance(0.12) && Math.abs(dx) + Math.abs(dy) > 5) { if (rng.chance(0.5)) mx = rng.chance(0.5) ? 1 : -1; else my = rng.chance(0.5) ? 1 : -1; }
      else if (dy === 0 || (dx !== 0 && rng.chance(Math.abs(dx) / (Math.abs(dx) + Math.abs(dy))))) mx = Math.sign(dx); else my = Math.sign(dy);
      const nx = x + mx, ny = y + my;
      if (nx < 3 || ny < 3 || nx >= map.w - 3 || ny >= map.h - 3) continue;
      x = nx; y = ny;
      paint(x, y);
      if (rng.chance(0.25)) paint(x + (my ? 1 : 0), y + (mx ? 1 : 0));
    }
  }

  function connectAll(map, start, targets, rng) {
    for (let pass = 0; pass < 3; pass++) {
      const dist = bfs(map, start.x, start.y);
      let changed = false;
      for (const t of targets) {
        const ty = t.door ? t.y + 1 : t.y, tx = t.x;
        const i = ty * map.w + tx;
        if (!map.inb(tx, ty) || dist[i] >= 0) continue;
        // walk toward the start until we hit reachable ground
        let best = null, bd = 1e9;
        for (let y = 2; y < map.h - 2; y++) for (let x = 2; x < map.w - 2; x++) { const j = y * map.w + x; if (dist[j] >= 0) { const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = { x, y }; } } }
        if (best) { carveRoad(map, { x: tx, y: ty }, best, rng); changed = true; }
      }
      if (!changed) break;
    }
  }

  function placeHosts(map, z, spec, T, rng, world) {
    const B = LIB.BIOMES[z.biome] || LIB.BIOMES.wilds;
    const used = [];
    const slots = [];
    const R = z.r;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + rng.float(-0.2, 0.2); const d = R * (k % 2 ? 0.55 : 0.42); slots.push({ x: Math.round(z.x + Math.cos(a) * d), y: Math.round(z.y + Math.sin(a) * d) }); }
    const overlaps = (x0, y0, w, h) => used.some((u) => x0 - 1 < u.x + u.w && x0 + w + 1 > u.x && y0 - 1 < u.y + u.h && y0 + h + 2 > u.y) || Math.abs(x0 + w / 2 - z.x) < w / 2 + 2 && Math.abs(y0 + h / 2 - z.y) < h / 2 + 2;
    const placeBox = (w, h) => {
      for (const s of rng.shuffle(slots)) {
        const x0 = s.x - (w >> 1), y0 = s.y - h + 1;
        if (x0 < 4 || y0 < 4 || x0 + w >= map.w - 4 || y0 + h + 2 >= map.h - 4) continue;
        if (overlaps(x0, y0, w, h)) continue;
        used.push({ x: x0, y: y0, w, h });
        return { x: x0, y: y0 };
      }
      // fallback: scan outward
      for (let r = 4; r < R + 6; r++) for (let a = 0; a < 16; a++) { const x0 = Math.round(z.x + Math.cos(a / 16 * Math.PI * 2) * r) - (w >> 1), y0 = Math.round(z.y + Math.sin(a / 16 * Math.PI * 2) * r) - h + 1; if (x0 < 4 || y0 < 4 || x0 + w >= map.w - 4 || y0 + h + 2 >= map.h - 4 || overlaps(x0, y0, w, h)) continue; used.push({ x: x0, y: y0, w, h }); return { x: x0, y: y0 }; }
      return null;
    };
    const styleIdx = (name) => Object.keys(LIB.STYLES).indexOf(name);
    const building = (p, style, enterable) => {
      const S = LIB.STYLES[style] || LIB.STYLES.house;
      const w = rng.int(S.w[0], S.w[1]), h = S.h;
      const pos = placeBox(w, h);
      if (!pos) return null;
      const sIdx = styleIdx(style) * 16 + rng.int(0, 3);
      for (let y = pos.y - 1; y <= pos.y + h + 1; y++) for (let x = pos.x - 1; x <= pos.x + w; x++) { if (SOLID_G[map.gr(x, y)]) map.setG(x, y, G.GRASS); map.setD(x, y, 0); }
      for (let y = pos.y; y < pos.y + h; y++) for (let x = pos.x; x < pos.x + w; x++) {
        const front = y === pos.y + h - 1;
        map.setD(x, y, front ? D.FACADE : D.ROOF);
        map.v[y * map.w + x] = sIdx & 255;
      }
      const dx = pos.x + (w >> 1), dy = pos.y + h - 1;
      map.setD(dx, dy, D.DOOR);
      map.v[dy * map.w + dx] = sIdx & 255;
      map.setG(dx, dy + 1, G.PATH); map.setD(dx, dy + 1, 0);
      carveRoad(map, { x: dx, y: dy + 1 }, { x: z.x, y: z.y }, rng);
      const door = { x: dx, y: dy, door: true, place: p ? p.id : null, enterable, style, name: p ? p.display : '' };
      if (p) world.doors[p.id] = door;
      else (world.extraDoors = world.extraDoors || []).push(door);
      return door;
    };
    for (const p of z.hosts) {
      if (p.cat === 'building') {
        let style = p.style || 'house';
        if (style === 'house' && p.size === 'big') style = 'mansion';
        if ((z.biome === 'city' || spec.theme === 'city') && ['house', 'shop', 'tavern', 'hall', 'lab'].includes(style) && rng.chance(0.4)) style = 'tall';
        building(p, style, true);
      } else if (p.cat === 'dungeon') {
        const pos = placeBox(5, 3);
        if (!pos) continue;
        for (let y = pos.y; y < pos.y + 3; y++) for (let x = pos.x; x < pos.x + 5; x++) { map.setD(x, y, D.CLIFF); map.setG(x, y, GROUND_OF[B.ground] || G.GRASS); }
        const cx = pos.x + 2, cy = pos.y + 2;
        map.setD(cx, cy, D.CAVE);
        map.setG(cx, cy + 1, G.PATH); map.setD(cx, cy + 1, 0);
        carveRoad(map, { x: cx, y: cy + 1 }, { x: z.x, y: z.y }, rng);
        world.caves[p.id] = { x: cx, y: cy, place: p.id, name: p.display };
      } else if (p.cat === 'landmark') {
        const prop = PROP_OF[p.prop] || D.STATUE;
        if (p.prop === 'bridge') { z.wantsBridge = true; continue; }
        const c = findFree(map, z.x + rng.int(-3, 3), z.y + rng.int(-3, -1), 5);
        if (c) { map.setD(c.x, c.y, prop); world.landmarks = world.landmarks || {}; world.landmarks[p.id] = { x: c.x, y: c.y + 1 }; }
      }
    }
    // filler houses make settlements feel lived in
    if (B.houses) for (let k = 0; k < B.houses; k++) building(null, B.tall && rng.chance(0.6) ? 'tall' : 'house', false);
    if (B.building === 'barn' && !z.hosts.some((p) => p.interior === 'barn')) building(null, 'barn', false);
  }

  // ======================= interiors =======================
  function buildInterior(spec, p, rng, T) {
    const tpl = LIB.INTERIORS[p.interior] || LIB.INTERIORS.home;
    let [w, h] = tpl.size;
    if (p.size === 'huge') { w += 4; h += 2; }
    const floor = { wood: G.WOOD, tile: G.TILE, stone: G.SFLOOR, dirt: G.DFLOOR }[tpl.floor] || G.WOOD;
    const map = new GameMap('in_' + p.id, p.display, w, h, floor);
    map.kind = 'interior';
    map.dark = p.interior === 'prison' || p.interior === 'castle' ? 0.25 : 0;
    for (let i = 0; i < map.v.length; i++) map.v[i] = rng.int(0, 7);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y < 2 || x === 0 || x === w - 1 || y === h - 1) map.setG(x, y, G.WALL);
    const ex = w >> 1;
    map.setG(ex, h - 1, G.EXIT);
    map.spawn = { x: ex, y: h - 2 };
    map.portals.push({ x: ex, y: h - 1, to: 'over', exit: true });
    const reserved = new Set();
    for (let y = 2; y < h - 1; y++) reserved.add(ex + ',' + y); // a clear aisle up the middle
    const put = (x, y, f) => { if (x <= 0 || y <= 1 || x >= w - 1 || y >= h - 1 || reserved.has(x + ',' + y) || map.d[y * w + x]) return false; map.setD(x, y, f); return true; };
    for (const [what, where] of tpl.furniture) {
      const f = FURN_OF[what];
      switch (where) {
        case 'topleft': put(1, 2, f); put(2, 2, f === D.BED ? 0 : 0); break;
        case 'topright': put(w - 2, 2, f); break;
        case 'top': put(rng.int(3, w - 4), 2, f); break;
        case 'topwall': for (let x = 1; x < w - 1; x++) if (x !== ex && rng.chance(0.5)) put(x, 2, f); break;
        case 'topcenter': reserved.delete(ex + ',2'); put(ex, 2, f); break;
        case 'center': { const cx = ex + (rng.chance(0.5) ? -3 : 3), cy = (h >> 1); if (what === 'rug') { for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) put(x, y, f); } else put(cx, cy, f); break; }
        case 'aroundtable': for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (map.d[y * w + x] === D.TABLE) { put(x - 1, y, f); put(x + 1, y, f); } break;
        case 'corners': put(1, h - 2, f); put(w - 2, h - 2, f); if (h > 8) { put(1, 3, f); put(w - 2, 3, f); } break;
        case 'rows': for (let y = 4; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) if (Math.abs(x - ex) > 1) put(x, y, f); break;
        case 'teacher': put(ex + 2, 3, f); break;
        case 'colonnade': for (let y = 3; y < h - 2; y += 3) { put(ex - 4, y, f); put(ex + 4, y, f); } break;
        case 'runner': for (let y = 2; y < h - 1; y++) map.setG(ex, y, G.CARPET); break;
        case 'side': for (let y = 3; y < h - 2; y += 2) { put(1, y, f); } break;
        case 'sides': for (let y = 3; y < h - 2; y += 3) { put(2, y, f); put(w - 3, y, f); } break;
        case 'walls': for (let x = 2; x < w - 2; x += 4) map.setD(x, 1, f); break;
        case 'cells': for (let x = 1; x < w - 1; x++) if (Math.abs(x - ex) > 1 && x % 4 !== 0) put(x, 4, f); break;
        case 'scatter': for (let k = 0; k < 6; k++) put(rng.int(1, w - 2), rng.int(3, h - 3), f); break;
        case 'topband': for (let x = 2; x < w - 2; x++) if (Math.abs(x - ex) > 0) put(x, 4, f); reserved.delete(ex + ',4'); break;
        case 'stalls': for (let x = 3; x < w - 2; x += 3) for (let y = 2; y < 6; y++) put(x, y, f); break;
      }
    }
    if (p.interior === 'school') map.setD(ex, 1, D.BLACKBOARD);
    // a chest-like crate and a bed to rest in homes
    map.restSpot = null;
    for (let i = 0; i < w * h; i++) if (map.d[i] === D.BED || map.d[i] === D.HOSPITALBED) { map.restSpot = { x: i % w, y: (i / w) | 0 }; break; }
    // ensure the room is connected
    const dist = bfs(map, map.spawn.x, map.spawn.y);
    for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (dist[i] < 0 && PASS_D[map.d[i]] && !SOLID_G[map.g[i]]) { /* pocket */ } }
    return map;
  }

  // ======================= dungeons =======================
  function buildDungeon(spec, p, depth, rng, T) {
    const W = Math.min(56, 40 + depth * 3), H = W;
    const map = new GameMap('dg_' + p.id, p.display, W, H, G.WALL);
    map.kind = 'dungeon';
    map.dark = T.dark + Math.min(0.15, depth * 0.02);
    for (let i = 0; i < map.v.length; i++) map.v[i] = rng.int(0, 7);
    const rooms = [];
    const overlaps = (r) => rooms.some((o) => r.x - 2 < o.x + o.w && r.x + r.w + 2 > o.x && r.y - 2 < o.y + o.h && r.y + r.h + 2 > o.y);
    const want = 6 + Math.min(4, depth);
    for (let t = 0; rooms.length < want && t < 600; t++) { const w = rng.int(6, 11), h = rng.int(5, 9); const r = { x: rng.int(2, W - w - 3), y: rng.int(3, H - h - 3), w, h }; if (!overlaps(r)) rooms.push(r); }
    rooms.forEach((r) => { r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.setG(x, y, G.FLOOR); });
    for (const r of rooms) if (r.w >= 9 && r.h >= 7) for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) map.setG(px, py, G.WALL);
    const order = [rooms[0]], left = rooms.slice(1);
    while (left.length) { const last = order[order.length - 1]; let bi = 0, bd = 1e9; left.forEach((r, i) => { const d = Math.abs(r.cx - last.cx) + Math.abs(r.cy - last.cy); if (d < bd) { bd = d; bi = i; } }); order.push(left.splice(bi, 1)[0]); }
    const carve = (x, y) => { for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) if (x + ox > 0 && y + oy > 0 && x + ox < W - 1 && y + oy < H - 1) map.setG(x + ox, y + oy, G.FLOOR); };
    const corridor = (a, b) => { let x = a.cx, y = a.cy; const hf = rng.chance(0.5); const sx = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } }; const sy = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } }; if (hf) { sx(); sy(); } else { sy(); sx(); } carve(x, y); };
    for (let i = 1; i < order.length; i++) corridor(order[i - 1], order[i]);
    for (let k = 0; k < 2; k++) corridor(rng.pick(rooms), rng.pick(rooms));
    const start = order[0];
    const d0 = bfs(map, start.cx, start.cy);
    let far = start, fd = -1;
    for (const r of rooms) { if (r === start) continue; const dd = d0[r.cy * W + r.cx]; if (dd > fd) { fd = dd; far = r; } }
    for (let y = far.y; y < far.y + far.h; y++) for (let x = far.x; x < far.x + far.w; x++) if (map.gr(x, y) === G.FLOOR) map.setG(x, y, G.CARPET);
    map.setG(start.cx, start.y, G.EXIT);
    map.setG(start.cx, start.y - 1, G.WALL);
    map.spawn = { x: start.cx, y: start.y + 1 };
    map.portals.push({ x: start.cx, y: start.y, to: 'over', exit: true });
    for (let i = 0; i < W * H; i++) if (map.g[i] === G.FLOOR && rng.chance(0.035)) map.d[i] = rng.pick([D.BONES, D.SKULL, D.MUSHROOM]);
    map.setD(map.spawn.x, map.spawn.y, 0);
    map.rooms = rooms; map.startRoom = start; map.bossRoom = far;
    // enemies & chests
    const E = spec.enemies.length;
    const level = 2 + depth;
    const occ = new Set([map.spawn.x + ',' + map.spawn.y]);
    const freeIn = (r) => { for (let i = 0; i < 60; i++) { const x = rng.int(r.x + 1, r.x + r.w - 2), y = rng.int(r.y + 1, r.y + r.h - 2); if (map.solid(x, y) || occ.has(x + ',' + y)) continue; occ.add(x + ',' + y); return { x, y }; } return null; };
    const pool = spec.enemies.map((e, i) => i).filter((i) => !spec.critters.includes(spec.enemies[i].name) || spec.peaceful);
    for (const r of rooms) {
      if (r === start || r === far) continue;
      const n = spec.peaceful ? rng.int(0, 1) : rng.int(2, 3);
      for (let k = 0; k < n; k++) { const pp = freeIn(r); if (pp) map.entities.push({ kind: 'enemy', id: map.id + '_e' + k + '_' + r.x, type: pool.length ? rng.pick(pool) : 0, level, x: pp.x, y: pp.y }); }
    }
    rng.shuffle(rooms.filter((r) => r !== start && r !== far)).slice(0, 2).forEach((r, ci) => {
      const pp = freeIn(r);
      if (pp) map.entities.push({ kind: 'chest', id: `chest_${map.id}_${ci}`, x: pp.x, y: pp.y, contents: ci === 0 ? { type: depth % 2 ? 'armor' : 'weapon' } : rng.chance(0.5) ? { type: 'gold', amount: 30 + depth * 20 } : { type: 'potion', amount: 2 } });
    });
    return map;
  }

  // ======================= wild enemies & chests =======================
  function populateOverworld(spec, map, zones, rng) {
    const E = spec.enemies.length;
    const danger = (z) => spec.beats.filter((b) => b.place === z.place.id || z.hosts.some((h) => h.id === b.place)).reduce((n, b) => n + b.danger, 0);
    const pool = spec.enemies.map((e, i) => i).filter((i) => !spec.critters.includes(spec.enemies[i].name));
    const critterPool = spec.enemies.map((e, i) => i).filter((i) => spec.critters.includes(spec.enemies[i].name));
    let n = 0;
    zones.forEach((z, zi) => {
      const wild = !['settlement', 'city', 'plaza', 'harbor', 'street', 'garden', 'park', 'farm'].includes(z.biome);
      const level = 1 + Math.floor(zi * 1.1);
      const count = spec.peaceful ? (wild ? rng.int(1, 2) : 0) : wild ? rng.int(3, 5) + Math.min(3, danger(z)) : danger(z) > 1 ? 2 : 0;
      const usePool = spec.peaceful || zi === 0 ? (critterPool.length ? critterPool : pool) : pool.length ? pool : critterPool;
      if (!usePool.length) return;
      const tier = Math.min(usePool.length - 1, Math.floor((zi / Math.max(1, zones.length - 1)) * usePool.length));
      for (let k = 0; k < count; k++) {
        const a = rng.float(0, Math.PI * 2), d = rng.float(z.r * 0.5, z.r * 0.95);
        const c = findFree(map, Math.round(z.x + Math.cos(a) * d), Math.round(z.y + Math.sin(a) * d), 3);
        if (!c || Math.hypot(c.x - map.spawn.x, c.y - map.spawn.y) < 9) continue;
        map.entities.push({ kind: 'enemy', id: 'oe' + n++, type: usePool[Math.max(0, tier - rng.int(0, 1))], level, x: c.x, y: c.y });
      }
      if (wild && rng.chance(0.75)) {
        const a = rng.float(0, Math.PI * 2);
        const c = findFree(map, Math.round(z.x + Math.cos(a) * z.r * 0.7), Math.round(z.y + Math.sin(a) * z.r * 0.7), 4);
        if (c) map.entities.push({ kind: 'chest', id: 'chest_' + z.id, x: c.x, y: c.y, contents: rng.chance(0.5) ? { type: 'gold', amount: rng.int(15, 40) * (1 + zi) } : zi % 3 === 2 ? { type: 'armor' } : { type: 'potion', amount: 1 + (zi > 3 ? 1 : 0) } });
      }
    });
    // signposts naming every zone
    for (const z of zones) {
      const c = findFree(map, z.x - 2, z.y + 2, 3);
      if (c) map.entities.push({ kind: 'sign', id: 'post_' + z.id, style: 'post', x: c.x, y: c.y, title: 'Signpost', pages: [signText(z, zones, map)] });
    }
  }
  function signText(z, zones, map) {
    const here = z.place.display || 'Here';
    const others = zones.filter((o) => o !== z).map((o) => ({ o, d: Math.hypot(o.x - z.x, o.y - z.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    return `${here}.` + (others.length ? '\n' + others.map(({ o }) => `${cap(dirName(o.x - z.x, o.y - z.y))}: ${o.place.display}`).join('\n') : '');
  }
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ======================= build everything =======================
  function build(spec) {
    const rng = new RNG(spec.seed);
    const T = THEMES[spec.theme];
    const world = { spec, maps: {}, anchors: {} };
    const { map: over, zones, zoneOf } = buildOverworld(spec, rng.fork('over'), world);
    world.maps.over = over;
    world.zones = zones;
    // interiors and dungeons
    let depth = 0;
    for (const p of spec.places) {
      if (p.cat === 'building' && world.doors[p.id]) {
        const m = buildInterior(spec, p, rng.fork('in' + p.id), T);
        world.maps[m.id] = m;
        world.doors[p.id].to = m.id;
        over.portals.push({ x: world.doors[p.id].x, y: world.doors[p.id].y, to: m.id, place: p.id });
      } else if (p.cat === 'dungeon' && world.caves[p.id]) {
        const order = Math.max(0, spec.beats.findIndex((b) => b.place === p.id));
        const m = buildDungeon(spec, p, Math.floor(order / 2) + depth++, rng.fork('dg' + p.id), T);
        world.maps[m.id] = m;
        world.caves[p.id].to = m.id;
        over.portals.push({ x: world.caves[p.id].x, y: world.caves[p.id].y, to: m.id, place: p.id });
      }
    }
    // where each place "is" for the story engine
    for (const p of spec.places) {
      const z = zoneOf[p.id];
      if ((p.cat === 'area' || p.cat === 'settlement') && z) world.anchors[p.id] = { map: 'over', x: z.x, y: z.y, r: Math.max(5, z.r * 0.6), zone: z.id };
      else if (p.cat === 'building' && world.doors[p.id]) { const m = world.maps['in_' + p.id]; world.anchors[p.id] = { map: m.id, x: m.spawn.x, y: Math.max(3, m.spawn.y - 3), r: 3, door: world.doors[p.id] }; }
      else if (p.cat === 'dungeon' && world.caves[p.id]) { const m = world.maps['dg_' + p.id]; world.anchors[p.id] = { map: m.id, x: m.bossRoom.cx, y: m.bossRoom.cy, r: 3, cave: world.caves[p.id] }; }
      else if (p.cat === 'landmark' && world.landmarks && world.landmarks[p.id]) world.anchors[p.id] = Object.assign({ map: 'over', r: 3 }, world.landmarks[p.id]);
      else if (z) world.anchors[p.id] = { map: 'over', x: z.x, y: z.y, r: Math.max(4, z.r * 0.5), zone: z.id };
      else world.anchors[p.id] = { map: 'over', x: over.spawn.x, y: over.spawn.y, r: 4 };
    }
    populateOverworld(spec, over, zones, rng.fork('pop'));
    // rest spot at the start: a campfire if there's no home with a bed
    const sz = over.startZone;
    const fire = findFree(over, sz.x + 3, sz.y - 2, 4);
    if (fire) { over.setD(fire.x, fire.y, D.CAMPFIRE); over.restSpot = fire; }
    // side quest items go in the wilds
    (spec.sideQuests || []).forEach((q, qi) => {
      if (q.type !== 'fetch') return;
      const z = zones[Math.min(zones.length - 1, 1 + (qi % Math.max(1, zones.length - 1)))] || zones[0];
      const c = findFree(over, z.x + rng.int(-z.r + 3, z.r - 3), z.y + rng.int(-z.r + 3, z.r - 3), 5);
      if (c) { over.entities.push({ kind: 'questitem', id: 'qi' + qi, quest: qi, x: c.x, y: c.y }); q.where = z.place.display; }
    });
    // nothing important may end up somewhere you can't walk to
    for (const m of Object.values(world.maps)) {
      const reach = reachOf(m);
      const taken = new Set();
      m.entities = m.entities.filter((e) => {
        const ok = (x, y) => m.inb(x, y) && reach[y * m.w + x] >= 0 && m.free(x, y) && m.gr(x, y) !== G.EXIT && !taken.has(x + ',' + y);
        if (!ok(e.x, e.y)) {
          let found = null;
          for (let r = 1; r <= 14 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (ok(e.x + dx, e.y + dy)) { found = { x: e.x + dx, y: e.y + dy }; break; } }
          if (!found) return e.kind === 'questitem' ? (Object.assign(e, findFree(m, m.spawn.x, m.spawn.y + 2, 6) || m.spawn), true) : false;
          e.x = found.x; e.y = found.y;
        }
        taken.add(e.x + ',' + e.y);
        return true;
      });
    }
    return world;
  }
  function reachOf(map) {
    if (!map.reach) map.reach = bfs(map, map.spawn.x, map.spawn.y);
    return map.reach;
  }

  // free tiles near a place, used at runtime to stage story scenes
  function spotsFor(world, placeId, n, seed) {
    const a = world.anchors[placeId] || { map: 'over', x: world.maps.over.spawn.x, y: world.maps.over.spawn.y, r: 4 };
    const map = world.maps[a.map];
    const reach = reachOf(map);
    const rng = new RNG(RPG.hashString(placeId + ':' + seed));
    const out = [];
    const taken = new Set();
    for (let i = 0; out.length < n && i < 500; i++) {
      const ang = rng.float(0, Math.PI * 2), d = i < 4 ? rng.float(0, 2) : rng.float(1, a.r + i / 20);
      const x = Math.round(a.x + Math.cos(ang) * d), y = Math.round(a.y + Math.sin(ang) * d);
      if (!map.inb(x, y) || map.solid(x, y) || taken.has(x + ',' + y) || map.gr(x, y) === G.EXIT || map.gr(x, y) === G.BRIDGE || reach[y * map.w + x] < 0) continue;
      if (map.spawn && x === map.spawn.x && y === map.spawn.y) continue;
      taken.add(x + ',' + y);
      out.push({ map: a.map, x, y });
    }
    while (out.length < n) out.push({ map: a.map, x: a.x, y: a.y });
    return out;
  }

  RPG.WorldGen = { build, spotsFor, findFree };
})();
