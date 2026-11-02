/* story.js — the story engine. Reads any text against the library (library.js) and turns it into
   a playable story: who you are, who everyone else is, where things happen, what you carry,
   and a chain of chapters that follow the text in order. No internet or API key needed. */
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const LIB = RPG.LIB;
  const { THEMES, MONSTERS, MONSTER_ADJ, CLASSES, ARCH_ORDER, RNG, hashString } = RPG;
  const THEME_KEYS = Object.keys(THEMES);

  // ======================= small helpers =======================
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const SMALL = /^(of|the|and|in|on|at|to|a|an)$/i;
  const titleCase = (s) => String(s).trim().split(/\s+/).map((w, i) => (i > 0 && SMALL.test(w) ? w.toLowerCase() : cap(w))).join(' ');
  const clampInt = (x, a, b, d) => { const n = parseInt(x, 10); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
  const uniq = (a) => [...new Set(a)];
  function singular(w) {
    if (w.length <= 3) return w;
    if (/(ss|us|is)$/.test(w) || /^(glasses|scissors|pants|trousers|jeans|shorts|goggles|spectacles|binoculars|pliers|tongs|clothes|news|series|species)$/.test(w)) return w;
    if (w === 'mice') return 'mouse';
    if (w === 'geese') return 'goose';
    if (w === 'children') return 'child';
    if (w === 'people') return 'person';
    if (w.endsWith('ves') && !/(eaves|ooves)$/.test(w)) return w.slice(0, -3) + 'f';
    if (/^(zombies|cookies|movies|pies|ties|brownies|genies|pixies|goalies|rookies|hoodies|collies|calories|prairies|lies|selfies|smoothies|aunties|cuties|veggies|sweeties|birdies|boogies|magpies|bogies)$/.test(w)) return w.slice(0, -1);
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('men')) return w.slice(0, -3) + 'man';
    if (w.endsWith('s')) return w.slice(0, -1);
    return w;
  }
  function pluralize(name) {
    const parts = String(name).split(' ');
    let w = parts.pop();
    const lw = w.toLowerCase();
    if (/^(sheep|fish|deer|moose|mice|people|children|data)$/.test(lw)) { parts.push(w); return parts.join(' '); }
    if (lw === 'mouse') w = w[0] === 'M' ? 'Mice' : 'mice';
    else if (/[^aeiou]y$/i.test(w)) w = w.slice(0, -1) + 'ies';
    else if (/(wolf|elf|thief|dwarf|leaf|loaf|shelf)$/i.test(lw)) w = w.slice(0, -1) + 'ves';
    else if (/(s|x|ch|sh)$/i.test(w)) w += 'es';
    else if (/man$/i.test(w) && !/human$/i.test(w)) w = w.slice(0, -3) + 'men';
    else w += 's';
    parts.push(w);
    return parts.join(' ');
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function colorFor(name) { const h = hashString(String(name).toLowerCase()); return hslToHex(h % 360, 35 + ((h >>> 9) % 30), 38 + ((h >>> 17) % 20)); }
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  RPG.color = { darken, colorFor, hslToHex };

  // ======================= sentences & words =======================
  function splitSentences(text) {
    const t = String(text).replace(/\s+/g, ' ').trim();
    const out = [];
    let start = 0, inQ = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '"') inQ = !inQ; else if (ch === '“') inQ = true; else if (ch === '”') inQ = false;
      if (ch !== '.' && ch !== '!' && ch !== '?') continue;
      let j = i + 1;
      while (j < t.length && '.!?'.includes(t[j])) j++;
      let k = j, closed = false;
      while (k < t.length && /["”’')\]]/.test(t[k])) { if (t[k] === '"' || t[k] === '”') { inQ = false; closed = true; } k++; }
      i = k - 1;
      if (inQ) continue;
      const prevWord = t.slice(start, j).split(' ').pop().replace(/[.!?]+$/, '');
      if (/^(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Prof|Capt|Lt|Gen|Sgt|vs|etc|No)$/i.test(prevWord)) continue;
      let n = k;
      while (n < t.length && t[n] === ' ') n++;
      if (n >= t.length) break;
      const nc = t[n];
      if (closed && /[a-z]/.test(nc)) continue;
      if (/[A-Z0-9"“‘(\[]/.test(nc) || nc.charCodeAt(0) > 127) { out.push(t.slice(start, k).trim()); start = n; }
    }
    if (start < t.length) { const rest = t.slice(start).trim(); if (rest) out.push(rest); }
    const final = [];
    for (let p of out) {
      while (p.length > 300) {
        let cut = p.lastIndexOf(', ', 260);
        if (cut < 80) cut = p.lastIndexOf(' ', 260);
        if (cut < 40) cut = 260;
        final.push(p.slice(0, cut + 1).trim());
        p = p.slice(cut + 1).trim();
      }
      if (p.length > 1) final.push(p);
    }
    return final;
  }
  const tokenize = (s) => { const out = []; const re = /[A-Za-z][A-Za-z0-9'’-]*|\d+/g; let m; while ((m = re.exec(s))) { const w0 = m[0].replace(/[-'’]+$/, ''); out.push({ w: w0.replace(/['’]s$/, ''), l: w0.toLowerCase().replace(/['’]s$/, ''), poss: /['’]s$/.test(w0), i: m.index }); } return out; };
  const stripQuotes = (s) => s.replace(/["“][^"”]*["”]/g, ' ');
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // nouns that make compound titles: sea witch, crime boss, star emperor, bog troll
  const COMPOUND_MOD = new Set('sea crime star moon sun fire ice frost storm shadow bog swamp forest mountain river desert sand snow space cyber sky cloud night dream bone blood iron stone rock jungle sewer hive lava flame swamp marsh cave tomb grave mud dust wind thunder lightning plague war death ghost spirit tree flower candy toy clock'.split(' '));
  const STOP = new Set("The A An And But Or So If When Then This That These Those There Here His Her Hers Their Theirs Its It He She They We You Your Yours I Me My Mine Our Ours Us Him Them One Once Long Ago After Before Now Soon Later Meanwhile However Suddenly Finally Every Each All Some Many Few Most No Not Yes In On At By For From With Without Into Onto Of To Up Down Out Over Under About Above Below Between Through During Until While Where What Who Whom Whose Which Why How Because Although Though Since As Also Only Just Even Still Yet Never Always Sometimes Today Tomorrow Yesterday Tonight Chapter Part Book Act Scene Prologue Epilogue Mr Mrs Ms Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December God Gods Hero Heroes Player Game Rpg Story Hello Hey Oh Ah Please Thanks Thank Let Make Create Generate Build Write Give Include Add Set Use Have Has Had Do Does Did Be Is Are Was Were Will Would Could Should Can May Might Must Shall Dear Like Okay Ok Lots Much More Less Very Really Great Big Small New Old First Last Next Another Other Such Both Either Neither Nor Whatever Whoever Whenever Wherever Within Upon Against Across Along Around Behind Beyond Inside Outside Toward Towards Despite Unless Whether Among Amid Unlike Nobody Everyone Everybody Someone Somebody Anyone Anything Something Nothing Everything None North South East West Northern Southern Eastern Western Evil Dark Good Ancient Lost Holy Sacred Legendary End Well Wow Yeah Sure Goodbye Bye Help Run Stop Wait Look Come Go Get See Know Think Tell Ask Maybe Perhaps Christmas Easter Halloween English Spanish French American Mom Dad Mommy Daddy Grandma Grandpa Granny Mama Papa Sir Madam Miss Lady Lord Master Teacher Doctor Captain King Queen Prince Princess Uncle Aunt Hi Bang Boom Crash Splash Oops Hmm Huh Ugh Ouch Hooray Whoa Shh Psst Aha Haha Ha Thus Hence Indeed Instead Again Far Near Inside Every Little I'll I'm I've I'd You'll You're You've We'll We're They'll They're He'll He's She'll She's It's It'll Don't Can't Won't Didn't Let's That's There's What's Who's Isn't Wasn't".split(" "));
  const TITLE_WORDS = ['King', 'Queen', 'Lord', 'Lady', 'Sir', 'Dame', 'Captain', 'Doctor', 'Dr', 'Professor', 'Prof', 'Emperor', 'Empress', 'Prince', 'Princess', 'Duke', 'Duchess', 'Baron', 'Baroness', 'General', 'Commander', 'Master', 'Elder', 'Mayor', 'Chief', 'Admiral', 'Count', 'Countess', 'Father', 'Mother', 'Sister', 'Brother', 'Saint', 'Sheriff', 'Agent', 'Officer', 'Detective', 'Inspector', 'Archmage', 'Wizard', 'Witch', 'Warlord', 'Overlord', 'Sage', 'Sergeant', 'Lieutenant', 'Major', 'Colonel', 'Sultan', 'Pharaoh', 'Chancellor', 'President', 'Director', 'Uncle', 'Aunt', 'Grandma', 'Grandpa', 'Granny', 'Nana', 'Old', 'Mr', 'Mrs', 'Ms', 'Miss', 'Coach', 'Nurse', 'Farmer', 'Baker', 'Judge', 'Pastor', 'Reverend'];
  const TITLE_SET = new Set(TITLE_WORDS);
  const DETS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'his', 'her', 'their', 'our', 'your', 'its', 'some', 'one', 'another', 'every', 'each', 'no', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'many', 'several', 'few']);
  const NUMS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, several: 4, many: 6, few: 3 };
  const BARE_PLACES = new Set(['school', 'home', 'town', 'church', 'college', 'university', 'camp', 'market', 'jail', 'prison', 'sea', 'class', 'hospital', 'kindergarten', 'downtown', 'shore']);
  const MOVE_PREPS = new Set(['to', 'into', 'toward', 'towards', 'reached', 'entered', 'onto', 'inside', 'back']);
  const SCENE_PREPS = new Set(['in', 'at', 'inside', 'near', 'by', 'through', 'across', 'within', 'beside', 'outside', 'around', 'over', 'under']);
  const VERB_OF = {};
  for (const [cat, list] of Object.entries(LIB.VERBS)) for (const v of list) (VERB_OF[v] = VERB_OF[v] || []).push(cat);
  const SPEECH = new Set(LIB.SPEECH_VERBS);
  const HOSTILE = new Set(LIB.HOSTILE);
  const VCUES = new Set(LIB.VILLAIN_CUES);
  const lookupRole = (l) => LIB.ROLES[l] || LIB.ROLES[singular(l)] || null;
  const lookupAnimal = (l) => LIB.ANIMALS[l] || LIB.ANIMALS[singular(l)] || null;
  const lookupPlace = (l) => LIB.PLACES[l] || LIB.PLACES[singular(l)] || null;
  const lookupObject = (l) => LIB.OBJECTS[l] || LIB.OBJECTS[singular(l)] || null;
  const PLACE_ADJ = new Set(LIB.PLACE_ADJ), OBJ_ADJ = new Set(LIB.OBJECT_ADJ);
  const FUNC = new Set('and or but of to in on at by for from with as than then so if when while into onto over under up down out off is was were are be been being has have had do did does not no nor yet very too also just only even still really quite'.split(' '));
  const isLooseAdj = (l) => !FUNC.has(l) && !DETS.has(l) && !VERB_OF[l] && !lookupPlace(l) && !lookupObject(l) && !lookupRole(l) && !lookupAnimal(l) && !/^(he|she|it|they|we|you|i|him|her|them|us|me|who|which|that|what|where|there|here)$/.test(l) && !/ly$/.test(l);
  const isAdjective = (l) => !!(LIB.COLORS[l] || LIB.HAIR[l] || LIB.AGE_WORDS[l] || LIB.SIZE_WORDS[l] || LIB.MOOD_WORDS[l] || PLACE_ADJ.has(l) || OBJ_ADJ.has(l) || (/(y|ful|ous|ish|ive|less|ing|ic|al)$/.test(l) && l.length > 3 && !VERB_OF[l] && !lookupPlace(l) && !lookupObject(l) && !lookupRole(l)));

  // perspective: first-person narration becomes "you"
  function toSecondPerson(s) {
    const parts = s.split(/(["“][^"”]*["”])/);
    const out = parts.map((p) => (/^["“]/.test(p) ? p : p
      .replace(/\bI am\b/g, 'you are').replace(/\bI'm\b/g, "you're").replace(/\bI was\b/g, 'you were').replace(/\bI've\b/g, "you've").replace(/\bI'd\b/g, "you'd").replace(/\bI'll\b/g, "you'll")
      .replace(/\bI\b/g, 'you').replace(/\bme\b/g, 'you').replace(/\bMe\b/g, 'You').replace(/\bmyself\b/g, 'yourself').replace(/\bmy\b/g, 'your').replace(/\bMy\b/g, 'Your').replace(/(?<!\b(?:the|a|old|gold|coal|silver|abandoned|deep|dark|dwarf|crystal|diamond|iron)\s)\bmine\b/g, 'yours')
      .replace(/\bwe were\b/g, 'you were').replace(/\bWe were\b/g, 'You were').replace(/\bwe\b/g, 'you').replace(/\bWe\b/g, 'You').replace(/\bour\b/g, 'your').replace(/\bOur\b/g, 'Your')
      .replace(/\byou am\b/g, 'you are'))).join('');
    return out.replace(/^(\W*)you\b/, (m, a) => a + 'You');
  }

  const META = /^(please\s+|ok(ay)?,?\s+|so,?\s+|hey,?\s+)?(write|make|create|generate|build|design|give me|i want|i'd like|i would like|can you|could you|let'?s make|the game|this game|the player should|include|add a|it should|there should be|set it|have it|turn this|thanks|thank you)\b/i;

  // ======================= the analyzer =======================
  function analyze(text, seed, opts = {}) {
    const rng = new RNG(seed);
    let raw = String(text || '').replace(/\r/g, '').trim();
    let source = raw ? 'text' : 'random';
    let titleLine = '';
    const firstLine = raw.split('\n')[0].trim();
    if (raw.includes('\n') && firstLine.length <= 60 && !/[.!?,;:"”]$/.test(firstLine) && raw.slice(raw.indexOf('\n')).trim().length > 40) {
      titleLine = firstLine.replace(/^#+\s*/, '').replace(/^title:\s*/i, '');
      raw = raw.slice(raw.indexOf('\n') + 1).trim();
    }
    // SHOUTED TEXT: read it in sentence case so every word isn't mistaken for a name
    { const up = (raw.match(/[A-Z]/g) || []).length, lo = (raw.match(/[a-z]/g) || []).length; if (up > 20 && up > lo * 2) raw = raw.toLowerCase().replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I'); }
    const lowerAll = raw.toLowerCase();
    const theme = pickTheme(lowerAll, rng, opts.theme);
    let sentences = splitSentences(raw).filter((s) => !META.test(s));
    const wordCount = (raw.match(/[A-Za-z]+/g) || []).length;
    const hasVerb = sentences.some((s) => tokenize(s).some((t) => VERB_OF[t.l] || /ed$/.test(t.l)));
    let premise = '', foeHint = null;
    if (!raw) { sentences = generateStory(rng, theme, {}); source = 'random'; }
    else if (isIdea(raw, wordCount, hasVerb, sentences)) {
      // an idea ("a cat who wants to be a knight", "pirates"): grow a whole plot around it
      premise = raw.replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
      source = 'prompt';
      sentences = generateStory(rng, theme, harvestSeeds(premise));
    } else if (sentences.length < 4) {
      // a tiny but real story: keep every word, and add a beginning and an ending around it
      premise = raw.replace(/\s+/g, ' ');
      const seeds = harvestSeeds(raw);
      foeHint = seeds.foe || null;
      sentences = padShort(sentences, seeds, rng, theme);
    }
    if (!sentences.length) sentences = generateStory(rng, theme, {});
    const N = sentences.length;
    const toks = sentences.map(tokenize);
    const outsideQ = sentences.map((s) => tokenize(stripQuotes(s)));
    const flat = sentences.join(' ');

    // ---------- point of view ----------
    let first = 0, second = 0;
    for (const ts of outsideQ) for (let k = 0; k < ts.length; k++) { const t = ts[k]; if (t.w === 'I' || /^(me|my|myself)$/.test(t.l) || (t.l === 'mine' && !(k > 0 && /^(the|a|old|gold|coal|silver|abandoned|deep|dark|dwarf|crystal|diamond|iron)$/.test(ts[k - 1].l)))) first++; if (/^(you|your|yours|yourself)$/.test(t.l)) second++; }
    const pov = first >= 2 && first > second ? 'first' : second >= 3 && second > first ? 'second' : 'third';

    // ---------- characters ----------
    const chars = [];
    const charByKey = new Map();
    const newChar = (key, props) => { const c = Object.assign({ id: 'c' + chars.length, key, name: '', display: '', title: '', role: null, roleWord: '', animal: null, animalWord: '', kind: 'person', adjs: new Set(), mentions: new Set(), first: 1e9, named: false, quotes: [], aliases: new Set(), subj: 0 }, props); chars.push(c); charByKey.set(key, c); return c; };
    let hero = null;
    if (pov !== 'third') {
      hero = newChar('hero', { isHero: true });
      const nm = raw.match(/\b(?:my name is|i am called|call me|they call me|people call me|your name is)\s+([A-Z][a-z'’]+)/i);
      if (nm && !STOP.has(cap(nm[1]))) { hero.name = cap(nm[1]); hero.named = true; hero.aliases.add(hero.name); }
    }
    const places = [];
    const placeByKey = new Map();
    const addPlace = (key, props) => { let p = placeByKey.get(key); if (!p) { p = Object.assign({ id: 'p' + places.length, key, name: '', display: '', cat: 'area', biome: 'wilds', mentions: new Set(), first: 1e9, owner: null }, props); places.push(p); placeByKey.set(key, p); } return p; };
    const sentPlaces = sentences.map(() => []);
    const CUE_WORDS = Object.keys(LIB.PLACES).filter((w) => !w.includes(' ') && LIB.PLACES[w].cat !== 'room').sort((a, b) => b.length - a.length);
    const cueAny = CUE_WORDS.map((w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`).join('|');
    const cueCap = CUE_WORDS.map((w) => cap(w)).join('|');
    const namedPlaceWords = new Set();
    let regionName = '';
    sentences.forEach((s, si) => {
      let m;
      const found = [];
      const re1 = new RegExp(`\\b(${cueAny})\\s+of\\s+(the\\s+)?((?:[A-Z][\\w'’-]+)(?:\\s+[A-Z][\\w'’-]+){0,2})`, 'g');
      while ((m = re1.exec(s))) { if (STOP.has(m[3])) continue; found.push({ name: /^[A-Z]/.test(m[1]) ? `${cap(m[1])} of ${m[2] ? 'the ' : ''}${m[3]}` : m[3], cue: m[1].toLowerCase(), idx: m.index }); }
      const re2 = new RegExp(`\\b((?:[A-Z][\\w'’-]+\\s+){1,3})(${cueCap})\\b`, 'g');
      while ((m = re2.exec(s))) {
        const pre = m[1].trim().split(/\s+/);
        while (pre.length && (STOP.has(pre[0]) || TITLE_SET.has(pre[0]))) pre.shift();
        if (!pre.length) continue;
        found.push({ name: `${pre.join(' ')} ${m[2]}`, cue: m[2].toLowerCase(), idx: m.index });
      }
      const re3 = /\b(Castle|Fort|Mount|Mt|Port|Camp|Lake|Isle|Planet|Tower|Temple|Station|Base|Colony)\.?\s+([A-Z][\w'’-]+)/g;
      while ((m = re3.exec(s))) { if (STOP.has(m[2])) continue; const cue = { Mt: 'mountain', Mount: 'mountain', Fort: 'fortress', Isle: 'island', Planet: 'island' }[m[1]] || m[1].toLowerCase(); found.push({ name: `${m[1]} ${m[2]}`, cue, idx: m.index }); }
      const re4 = /\b((?:[A-Z][\w'’-]+\s+){1,2})(High|Elementary|Middle|Junior High|Prep)(\s+School)?\b/g;
      while ((m = re4.exec(s))) { const pre = m[1].trim().split(/\s+/).filter((w) => !STOP.has(w)); if (!pre.length) continue; found.push({ name: `${pre.join(' ')} ${m[2]}${m[3] || ''}`, cue: 'school', idx: m.index + m[0].indexOf(pre[0]) }); }
      for (const f of found) {
        const def = lookupPlace(f.cue);
        if (!def || def.cat === 'room') continue;
        const p = addPlace('named:' + f.name.toLowerCase(), Object.assign({}, def, { name: f.name, display: f.name, word: f.cue }));
        p.mentions.add(si); p.first = Math.min(p.first, si);
        const bf = s.slice(Math.max(0, f.idx - 30), f.idx);
        sentPlaces[si].push({ p, idx: f.idx, move: false, scene: /\b(in|at|inside|near|within|beneath|under|outside)\s+(the\s+|his\s+|her\s+|their\s+|its\s+)?$/i.test(bf) });
        f.name.split(' ').forEach((w) => namedPlaceWords.add(w));
      }
    });
    // capitalized artifact names ("the Crown of Stars") and epithets ("Ignar the Destroyer") are not people
    const artifactWords = new Set();
    const epithets = new Map();
    {
      const ITEM_CAP = Object.keys(LIB.OBJECTS).filter((w) => !w.includes(' ')).map(cap).join('|');
      const re = new RegExp(`\\b((?:[A-Z][\\w'’-]+\\s+){0,3}(?:${ITEM_CAP})s?\\b(?:\\s+of\\s+(?:the\\s+)?[A-Z][\\w'’-]+(?:\\s+[A-Z][\\w'’-]+)?)?)`, 'g');
      let m;
      while ((m = re.exec(flat))) { const ws = m[1].trim().split(/\s+/); if (ws.length >= 2 || / of /.test(m[1])) ws.forEach((w) => { if (!STOP.has(w)) artifactWords.add(w); }); }
      const re2 = /\b([A-Z][a-z'’]+) the ([A-Z][a-z'’]+)\b/g;
      while ((m = re2.exec(flat))) if (!lookupPlace(m[2].toLowerCase()) && !lookupObject(m[2].toLowerCase())) epithets.set(m[1], m[2]);
    }
    // capitalized words
    const capInfo = new Map();
    sentences.forEach((s, si) => {
      const ts = tokenize(s);
      ts.forEach((t, k) => {
        if (!/^[A-Z]/.test(t.w) || t.w.length < 2 || t.w === 'I') return;
        const prevRaw = s.slice(0, t.i).trim();
        const atStart = k === 0 || /[:"“]$/.test(prevRaw);
        const info = capInfo.get(t.w) || { mid: 0, start: 0, first: si, afterTitle: '' };
        if (atStart) info.start++; else info.mid++;
        if (k > 0 && TITLE_SET.has(ts[k - 1].w) && ts[k - 1].w !== t.w) info.afterTitle = info.afterTitle || ts[k - 1].w;
        capInfo.set(t.w, info);
      });
    });
    const lowerSeen = new Set((flat.match(/\b[a-z][a-z'’-]*/g) || []));
    const capWordIsCommon = (w) => {
      const l = w.toLowerCase();
      if (STOP.has(w) || STOP.has(cap(l)) || lookupPlace(l) || lookupRole(l) || lookupAnimal(l)) return true;
      const commonish = !!lookupObject(l) || (!!MONSTERS[singular(l)]) || THEME_KEYS.some((k) => THEMES[k].keywords.includes(l)) || !!VERB_OF[l] || !!LIB.COLORS[l] || !!LIB.MOOD_WORDS[l];
      if (singular(l) !== l && (MONSTERS[singular(l)] || lookupRole(singular(l)) || lookupAnimal(singular(l)) || lookupObject(singular(l)))) return true;
      const inf = capInfo.get(w);
      return commonish && (lowerSeen.has(l) || !inf || inf.mid === 0);
    };
    const placeLikeSuffix = /(vale|ford|wick|ton|burg|borough|heim|dale|shire|port|haven|falls|moor|mere|holm|stead|gate|hold|reach|crest|ridge|thorpe|bury|field|grad|polis|stadt|ville|land)$/i;
    const placePrepCount = (w) => (flat.match(new RegExp(`\\b(in|to|from|near|at|toward|towards|across|through|reached|entered|visited|left|outside|inside|around|beyond|into|of)\\s+${reEsc(w)}\\b`, 'g')) || []).length;
    const namedPlaces = [];
    // multi-word names ("Little Red Riding Hood", "Ray Kowalski")
    const multi = new Map();
    { const re = /\b([A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+){1,3})\b/g; let m; while ((m = re.exec(flat))) { const words = m[1].split(/\s+/); while (words.length && STOP.has(words[0]) && !['Little', 'Old', 'Big'].includes(words[0])) words.shift(); if (words.length < 2) continue; if (words.slice(1).some((w) => TITLE_SET.has(w) || STOP.has(w))) continue; const k = words.join(' '); multi.set(k, (multi.get(k) || 0) + 1); } }
    const consumed = [];
    for (const [k, n] of [...multi.entries()].sort((a, b) => b[0].length - a[0].length)) {
      const words = k.split(' ');
      const last = words[words.length - 1].toLowerCase();
      if (lookupPlace(last) && !/^(hood|cap)$/.test(last)) continue;
      if (lookupObject(last) && !/^(hood|cap)$/.test(last)) continue;
      if (n < 2 && words.some((w) => capWordIsCommon(w) && !TITLE_SET.has(w))) continue;
      if (consumed.some((c) => c.includes(k)) || words.some((w) => namedPlaceWords.has(w) || artifactWords.has(w))) continue;
      if (VERB_OF[words[0].toLowerCase()] || words.some((w) => [...epithets.values()].includes(w))) continue;
      const c = newChar('name:' + k, { name: k, display: k, named: true });
      c.aliases.add(k);
      if (TITLE_SET.has(words[0]) && words.length >= 2) { c.title = words[0]; c.aliases.add(words.slice(1).join(' ')); }
      const rw = words.map((w) => w.toLowerCase()).find((w) => lookupRole(w));
      if (rw && !c.role) { c.role = lookupRole(rw); c.roleWord = rw; }
      consumed.push(k);
    }
    for (const [w, info] of capInfo) {
      if (w.length < 2 || TITLE_SET.has(w) || namedPlaceWords.has(w) || consumed.some((c) => c.split(' ').includes(w))) continue;
      if ([...epithets.values()].includes(w) && !epithets.has(w)) continue;
      if (artifactWords.has(w) && !info.afterTitle) continue;
      if (capWordIsCommon(w) && !info.afterTitle) continue;
      // a name that only ever starts a sentence still counts when a verb follows it ("Tom found a key.")
      const knownName = LIB.NAMES.f.includes(w) || LIB.NAMES.m.includes(w);
      const startsAction = info.start >= 1 && (() => { const m = flat.match(new RegExp(`(?:^|[.!?]\\s+)${reEsc(w)}\\s+([a-z]+)`)); return m && (VERB_OF[m[1]] || /ed$/.test(m[1]) || /^(was|is|had|has|could|would|will|can|went|ran|saw|met|took|made|came|found|got|lived|loved|wanted|knew)$/.test(m[1])); })();
      if (!(info.mid > 0 || info.start > 1 || info.afterTitle || knownName || startsAction)) continue;
      const pc = placePrepCount(w);
      const total = (flat.match(new RegExp(`\\b${reEsc(w)}\\b`, 'g')) || []).length;
      if (!info.afterTitle && (pc >= Math.max(1, Math.ceil(total * 0.5)) || (placeLikeSuffix.test(w) && pc >= 1))) { namedPlaces.push({ name: w, first: info.first }); continue; }
      const disp = info.afterTitle ? `${info.afterTitle} ${w}` : w;
      const c = newChar('name:' + w, { name: w, display: disp, named: true, title: info.afterTitle || '' });
      c.aliases.add(w);
      if (epithets.has(w)) { c.epithet = 'the ' + epithets.get(w); c.display = `${w} ${c.epithet}`; if (/^(cruel|dark|wicked|terrible|destroyer|mad|vile|merciless|black|undying|damned|tyrant|conqueror|defiler|betrayer|corrupted|butcher|dread|evil|grim)$/i.test(epithets.get(w))) c.adjs.add('evil'); }
      if (info.afterTitle) { const r = lookupRole(info.afterTitle.toLowerCase()); if (r) { c.role = r; c.roleWord = info.afterTitle.toLowerCase(); } }
    }

    // role & animal characters ("the old fisherman", "a talking fox", "my mom", "Grandma")
    const groupCreatures = new Map();
    const roleRefs = [];
    toks.forEach((ts, si) => {
      ts.forEach((t, k) => {
        const role = lookupRole(t.l), animal = lookupAnimal(t.l);
        if (!role && !animal) return;
        const nx = ts[k + 1];
        if (animal && nx && /^(king|queen|lord|lady|emperor|empress|boss|captain|chief|knight|witch|wizard|prince|princess|god|goddess|master|general)$/.test(nx.l)) return;
        // "caught a fish": a catch, not a character
        if (animal && ts.slice(Math.max(0, k - 4), k).some((x) => /^(caught|catch|catches|catching|hooked|reeled|fished|netted)$/.test(x.l))) return;
        if (nx && !/^[A-Z]/.test(nx.w) && (lookupPlace(nx.l) || lookupObject(nx.l) || (lookupRole(nx.l) && !lookupAnimal(t.l)) || (lookupAnimal(nx.l) && !lookupAnimal(t.l)) || (lookupAnimal(nx.l) && /^(giant|zombie|ghost|robot|monster|baby|mother|father|king|queen)$/.test(t.l)))) return; // "dog house", "giant spiders"
        const base = singular(t.l);
        const plural = base !== t.l && !!(lookupRole(base) || lookupAnimal(base));
        const adjs = [];
        let det = '', j = k - 1;
        while (j >= 0 && k - j <= 4) {
          const p = ts[j];
          if (DETS.has(p.l)) { det = p.l; break; }
          if (p.poss) { det = 'poss:' + p.w; break; }
          if (/^[A-Z]/.test(p.w) && !LIB.COLORS[p.l] && !LIB.AGE_WORDS[p.l] && !LIB.SIZE_WORDS[p.l]) break;
          if (isAdjective(p.l) || (isLooseAdj(p.l) && k - j <= 2) || ((lookupRole(p.l) || lookupAnimal(p.l) || MONSTERS[p.l] || COMPOUND_MOD.has(p.l)) && j === k - 1)) { adjs.unshift(p.l); j--; continue; }
          break;
        }
        const capitalized = /^[A-Z]/.test(t.w);
        const familyBare = !!role && /^(mom|dad|mommy|daddy|mum|mama|papa|grandma|grandpa|granny|nana|grandmother|grandfather)$/.test(base);
        if (!det && !capitalized && !familyBare && !adjs.length) return;
        if (plural) {
          const hostileCtx = ts.some((x) => HOSTILE.has(x.l));
          if ((animal && (animal.hostile || hostileCtx)) || (role && (role.hostile || (hostileCtx && /^(soldier|guard|knight|pirate|thief|robot|zombie|skeleton|ghost|monster|alien|giant|bandit|bully|vampire)$/.test(base))))) {
            const adj = adjs.find((a) => MONSTER_ADJ.includes(a) || LIB.COLORS[a]);
            const name = titleCase((adj ? adj + ' ' : '') + base);
            const g = groupCreatures.get(name) || { name, base, n: 0, si, animal: !!animal };
            g.n++; groupCreatures.set(name, g);
          }
          return;
        }
        if (role && /^(hero|heroine|champion|adventurer|explorer|traveler|traveller)$/.test(base) && !capitalized) return;
        const generic = /^(man|woman|boy|girl|kid|child|friend|stranger|person|lady|guy|creature|monster|beast|gentleman|fellow)$/.test(base);
        const distinct = adjs.find((a) => LIB.AGE_WORDS[a] || LIB.SIZE_WORDS[a] || LIB.COLORS[a]);
        let key = 'role:' + base + (generic && distinct ? ':' + distinct : '');
        if (det.startsWith('poss:')) key += ':' + det.slice(5).toLowerCase();
        let c = charByKey.get(key) || charByKey.get('role:' + base) || (!generic ? chars.find((x) => x.key.startsWith('role:' + base + ':')) : null);
        if (!c) {
          c = newChar(key, { role, roleWord: role ? base : '', animal, animalWord: animal ? base : '', kind: animal ? 'animal' : role.k === 'robot' ? 'robot' : role.k === 'ghost' ? 'ghost' : role.k === 'monster' ? 'monster' : 'person' });
          const shown = adjs.filter((a) => LIB.AGE_WORDS[a] || LIB.SIZE_WORDS[a] || LIB.COLORS[a] || LIB.MOOD_WORDS[a] || /^(talking|magic|magical|wise|wicked|evil|giant|mad|brave|royal)$/.test(a) || lookupRole(a) || lookupAnimal(a) || MONSTERS[a]).slice(-2);
          c.display = familyBare ? role.display : titleCase([...shown, base].join(' '));
          if (role && /^(mom|mother|mommy|mum|mama)$/.test(base) && !shown.length) c.display = 'Mom';
          if (role && /^(dad|father|daddy|papa)$/.test(base) && !shown.length) c.display = 'Dad';
          if (role && /^(grandma|grandmother|granny|nana)$/.test(base) && !shown.length) c.display = 'Grandma';
          if (role && /^(grandpa|grandfather|granddad)$/.test(base) && !shown.length) c.display = 'Grandpa';
        }
        adjs.forEach((a) => c.adjs.add(a));
        roleRefs.push({ si, k, char: c });
      });
    });
    // link roles to names: "a fox named Pip", "Rose, the old baker", "the baker Rose", "Grandma Rose", "Pip was a fox"
    const live = (c) => (c && c.merged ? live(c.merged) : c);
    for (const c of chars.filter((x) => x.named && !x.isHero)) {
      const full = reEsc(c.name);
      const nm = reEsc(c.name.split(' ').pop());
      const cm = flat.match(new RegExp(`\\b(?:called|named|nicknamed|known as)\\s+(?:her|him|them|it)?\\s*${full}\\b`));
      if (cm) {
        const cands = chars.filter((x) => !x.named && !x.isHero && !x.merged && x.role && /^(girl|boy|kid|child|woman|man|lady|princess|prince|orphan|teen|teenager|student)$/.test(x.roleWord));
        const fb = cands.find((x) => new RegExp(`\\b${reEsc(x.roleWord)}\\b`, 'i').test(flat.slice(0, cm.index)));
        if (fb) { fb.merged = c; if (!c.role) { c.role = fb.role; c.roleWord = fb.roleWord; } fb.adjs.forEach((a) => c.adjs.add(a)); }
      }
      const TL = '(?:(?:Mr|Mrs|Ms|Miss|Dr|Mx|Sir|Old)\\.?\\s+)?';
      const PH = '((?:[A-Za-z-]+\\s+){0,3}[A-Za-z-]+)';
      const pats = [
        [new RegExp(`\\b(?:[Aa]n?|[Tt]he)\\s+${PH}\\s*,?\\s+(?:named|called|known as)\\s+${full}\\b`), 'right'],
        [new RegExp(`\\b${full}\\s*,\\s*(?:a|an|the|my|our|his|her|your)\\s+${PH}`), 'left'],
        [new RegExp(`\\b(?:[Tt]he|[Aa]n?|[Mm]y|[Oo]ur|[Hh]is|[Hh]er|[Yy]our)\\s+${PH}\\s*,?\\s+${TL}${full}\\b`), 'right'],
        [new RegExp(`\\b${full}\\s+(?:was|is)\\s+(?:a|an|the)\\s+${PH}`), 'left'],
        [new RegExp(`\\b${full}\\s+the\\s+${PH}`), 'left'],
        [new RegExp(`\\b([A-Z][a-z]+)\\s+${nm}\\b`), 'title'],
      ];
      for (const [re, mode] of pats) {
        const m = flat.match(re);
        if (!m) continue;
        const ws = m[1].toLowerCase().split(/\s+/);
        let idx = -1;
        if (mode === 'title') { if (!/^(grandma|grandpa|granny|nana|aunt|uncle|mom|dad|mama|papa|sister|brother|cousin|grandmother|grandfather)$/.test(ws[0])) continue; idx = 0; }
        else if (mode === 'right') { for (let q = ws.length - 1; q >= 0; q--) if (lookupRole(ws[q]) || lookupAnimal(ws[q])) { idx = q; break; } if (idx !== ws.length - 1 && idx >= 0 && ws.slice(idx + 1).some((w) => VERB_OF[w])) idx = -1; }
        else { for (let q = 0; q < ws.length; q++) { if (lookupRole(ws[q]) || lookupAnimal(ws[q])) { idx = q; break; } if (VERB_OF[ws[q]] || FUNC.has(ws[q])) break; } }
        if (idx < 0) continue;
        const base = singular(ws[idx]);
        const role = lookupRole(base), animal = lookupAnimal(base);
        if (!role && !animal) continue;
        if (role && !c.role) { c.role = role; c.roleWord = base; if (role.k === 'robot') c.kind = 'robot'; if (role.k === 'ghost') c.kind = 'ghost'; }
        if (animal && !c.animal) { c.animal = animal; c.animalWord = base; c.kind = 'animal'; }
        ws.slice(0, idx).forEach((a) => { if (!FUNC.has(a)) c.adjs.add(a); });
        for (const rc of chars.filter((x) => !x.named && !x.isHero && !x.merged && (x.roleWord === base || x.animalWord === base))) { rc.merged = c; rc.adjs.forEach((a) => c.adjs.add(a)); }
        break;
      }
      // "King Aldric" and "the king" are the same person
      if (c.title) { const tl = c.title.toLowerCase(); for (const rc of chars.filter((x) => !x.named && !x.isHero && !x.merged && x.roleWord === tl)) { rc.merged = c; rc.adjs.forEach((a) => c.adjs.add(a)); } if (!c.role && lookupRole(tl)) { c.role = lookupRole(tl); c.roleWord = tl; } }
    }
    if (hero) {
      const m = raw.match(/\b(?:I am|I'm|I was|you are|you're|you were)\s+(?:a|an|the)\s+((?:[a-z-]+\s+){0,3}?)([a-z]+)\b/);
      if (m) {
        const base = singular(m[2].toLowerCase()); const role = lookupRole(base), animal = lookupAnimal(base);
        if (role) { hero.role = role; hero.roleWord = base; if (role.k === 'robot') hero.kind = 'robot'; }
        if (animal) { hero.animal = animal; hero.animalWord = base; hero.kind = 'animal'; }
        (m[1] || '').trim().split(/\s+/).filter(Boolean).forEach((a) => hero.adjs.add(a.toLowerCase()));
      }
    }
    // mentions
    const sentChars = sentences.map(() => new Set());
    const subjectOf = sentences.map(() => null);
    for (const c of chars) {
      if (c.merged || !c.named) continue;
      const re = new RegExp(`\\b(${[...c.aliases].map(reEsc).join('|')})\\b`);
      sentences.forEach((s, si) => { const m = s.match(re); if (m) { sentChars[si].add(c); if (m.index < 14) subjectOf[si] = subjectOf[si] || c; } });
    }
    for (const { si, k, char } of roleRefs) { const c = live(char); sentChars[si].add(c); if (k <= 2) subjectOf[si] = subjectOf[si] || c; }
    if (hero && pov !== 'third') sentences.forEach((s, si) => { const ts = outsideQ[si]; if (ts.some((t) => (pov === 'first' ? (t.w === 'I' || /^(me|my|myself|we|us|our)$/.test(t.l)) : /^(you|your|yourself)$/.test(t.l)))) { sentChars[si].add(hero); if (ts[0] && (ts[0].w === 'I' || /^(you|we)$/.test(ts[0].l))) subjectOf[si] = hero; } });
    const liveChars = () => chars.filter((c) => !c.merged);
    for (const c of liveChars()) sentences.forEach((s, si) => { if (sentChars[si].has(c)) { c.mentions.add(si); c.first = Math.min(c.first, si); if (subjectOf[si] === c) c.subj++; } });

    // ---------- who is doing things in each sentence ----------
    const firstVerbPos = toks.map((ts) => { const k = ts.findIndex((t) => VERB_OF[t.l] || /^(was|is|were|are|had|has)$/.test(t.l)); return k < 0 ? 99 : k; });
    const charPos = sentences.map(() => new Map());
    for (const { si, k, char } of roleRefs) { const c = live(char); if (!charPos[si].has(c) || charPos[si].get(c) > k) charPos[si].set(c, k); }
    for (const c of chars) { if (c.merged || !c.named) continue; toks.forEach((ts, si) => { const k = ts.findIndex((t) => c.aliases.has(t.w) || [...c.aliases].some((a) => a.split(' ')[0] === t.w)); if (k >= 0 && (!charPos[si].has(c) || charPos[si].get(c) > k)) charPos[si].set(c, k); }); }
    const subjectAt = toks.map((ts, si) => {
      let best = null, bk = 99;
      for (const [c, k] of charPos[si]) if (k < firstVerbPos[si] && k < bk) { bk = k; best = c; }
      if (!best && hero && pov !== 'third' && ts.slice(0, firstVerbPos[si]).some((t) => t.w === 'I' || /^(you|we)$/.test(t.l))) best = hero;
      return best;
    });
    const hsCache = new Map();
    const hostileScore = (c) => {
      const hit = hsCache.get(c);
      if (hit && hit.n === c.mentions.size) return hit.v;
      const v = hostileScore0(c);
      hsCache.set(c, { n: c.mentions.size, v });
      return v;
    };
    const hostileScore0 = (c) => {
      let v = 0;
      for (const si of c.mentions) {
        let h = 0;
        for (const t of toks[si]) if (VCUES.has(t.l)) h += /^(evil|wicked|villain|rogue|cruel|tyrant|sinister|kidnapped|kidnaps|stole|steals|cursed|insane|mad)$/.test(t.l) ? 2 : 1;
        const near = toks[si].findIndex((t) => /^(evil|wicked|villain|rogue|cruel|tyrant|sinister|mad|dark|sly)$/.test(t.l));
        const pos = charPos[si].get(c);
        const describes = near >= 0 && pos !== undefined && pos - near >= 0 && pos - near <= 3;
        v += Math.min(4, h) * (subjectAt[si] === c || describes ? 1 : 0.3);
        // being the one who gets rescued or freed makes you a victim, not a villain
        if ((subjectAt[si] !== c || /\b(was|were|got|been)\s+(trapped|captured|caught|stuck|locked|imprisoned|tied|chained|lost)\b/i.test(sentences[si])) && toks[si].some((t) => (VERB_OF[t.l] || []).includes('rescue')) && !toks[si].some((t) => (VERB_OF[t.l] || []).includes('fight'))) v -= 6;
        // being the one the hero fights counts too
        if (subjectAt[si] !== c && pos !== undefined && pos > firstVerbPos[si] && toks[si].slice(0, pos).some((t) => (VERB_OF[t.l] || []).includes('fight'))) v += 3;
      }
      if ((c.role && c.role.hostile) || (c.animal && c.animal.hostile)) v += 2;
      for (const a of c.adjs) if (LIB.MOOD_WORDS[a] === 'evil') v += 4;
      return v;
    };
    // ---------- the villain ----------
    let villain = null, vbest = 2;
    if (foeHint) { const fw = foeHint.split(' '); const fc = liveChars().find((c) => c.mentions.size && (String(c.display).toLowerCase() === foeHint || (c.roleWord === fw[fw.length - 1] && [...c.adjs].some((a) => fw.includes(a))))); if (fc) { villain = fc; vbest = 99; } }
    // the character the story follows most is the protagonist, however much fighting they do
    let protag = null, pbest = -1e9;
    if (!hero) for (const c of liveChars()) { if (!c.mentions.size) continue; const sc = c.subj * 2.5 + c.mentions.size + (c.named ? 3 : 0) - c.first * 0.35; if (sc > pbest) { pbest = sc; protag = c; } }
    const describedEvil = (c) => [...c.mentions].some((si) => { const pos = charPos[si].get(c); if (pos === undefined) return false; return toks[si].slice(Math.max(0, pos - 3), pos + 1).some((t) => /^(evil|wicked|villain|villainous|cruel|tyrant|sinister|dark|mad|dread|wicked)$/.test(t.l)); });
    const plainlyEvil = (c) => (c.role && c.role.hostile) || (c.animal && c.animal.hostile) || [...c.adjs].some((a) => LIB.MOOD_WORDS[a] === 'evil') || c.kind === 'monster' || describedEvil(c);
    for (const c of liveChars()) { if (c === hero || !c.mentions.size || c.isHero) continue; if (c === protag && c.subj >= 2 && !plainlyEvil(c)) continue; const v = hostileScore(c); if (v > vbest && v >= Math.min(5, c.mentions.size * 0.6)) { vbest = v; villain = c; } }

    // ---------- the hero (third person) ----------
    if (!hero) {
      const heroPat = flat.match(/\b(?:you are|you play as|play as|playing as|the hero(?:ine)? (?:is|was))\s+(?:a |an |the )?(?:[a-z]+\s+){0,3}?([A-Z][a-z'’]+)/);
      let best = null, bs = -1e9;
      const heroPatName = heroPat ? heroPat[1] : null;
      if (villain && heroPatName && villain.aliases.has(heroPatName)) villain = null;
      for (const c of liveChars()) {
        if (!c.mentions.size || (c === villain && !(heroPatName && c.aliases.has(heroPatName)))) continue;
        let sc = c.mentions.size + c.subj * 2.5 + (c.named ? 3 : 0) - c.first * 0.35 - hostileScore(c) * 1.2;
        if (heroPat && c.aliases.has(heroPat[1])) sc += 100;
        if (c.role && /^(hero|heroine|champion|adventurer|explorer|orphan)$/.test(c.roleWord)) sc += 4;
        if (c.kind === 'monster') sc -= 6;
        if (sc > bs) { bs = sc; best = c; }
      }
      hero = best || newChar('hero', {});
      hero.isHero = true;
    }
    if (pov === 'third' && !hero.name) {
      const g = hero.role && hero.role.g ? hero.role.g : hashString(hero.key) % 2 ? 'f' : 'm';
      hero.name = hero.animal ? rng.pick(LIB.NAMES.pet) : rng.pick(LIB.NAMES[g]);
      hero.nameGenerated = true;
    }
    // ---------- places ----------
    for (const np of namedPlaces) {
      if (namedPlaceWords.has(np.name) || artifactWords.has(np.name)) continue;
      const settle = /(ville|ton|ford|wick|burg|borough|ham|bury|stead|port|haven|thorpe|polis|stadt|grad)$/i.test(np.name) || !places.some((p) => p.cat === 'settlement');
      const isRegion = new RegExp(`\\b(kingdom|realm|land|lands|empire|world|planet|continent|country|nation|province|duchy|isles)\\s+of\\s+${reEsc(np.name)}\\b`, 'i').test(flat);
      if (isRegion) { regionName = regionName || np.name; continue; }
      const p = addPlace('named:' + np.name.toLowerCase(), settle ? { cat: 'settlement', biome: 'settlement', name: np.name, display: np.name, word: 'town' } : { cat: 'area', biome: 'wilds', name: np.name, display: np.name, word: 'land' });
      sentences.forEach((s, si) => { const m = s.match(new RegExp(`\\b${reEsc(np.name)}\\b`)); if (m) { p.mentions.add(si); p.first = Math.min(p.first, si); sentPlaces[si].push({ p, idx: m.index, move: false }); } });
    }
    let lastBuilding = null;
    const quoteSpans = sentences.map((s) => { const out = []; const re = /["“][^"”]*["”]/g; let m; while ((m = re.exec(s))) out.push([m.index, m.index + m[0].length]); return out; });
    const inQuote = (si, idx) => quoteSpans[si].some(([a, b]) => idx >= a && idx < b);
    toks.forEach((ts, si) => {
      const others = [...sentChars[si]].map(live).filter((c) => c && !c.isHero);
      ts.forEach((t, k) => {
        const def = lookupPlace(t.l);
        if (!def) return;
        if (namedPlaceWords.has(t.w) && /^[A-Z]/.test(t.w)) return;
        if (k > 0 && /^[A-Z]/.test(ts[k - 1].w) && namedPlaceWords.has(ts[k - 1].w)) return;
        const nx = ts[k + 1];
        if (nx && !/^[A-Z]/.test(nx.w) && (lookupPlace(nx.l) || lookupObject(nx.l) || lookupRole(nx.l))) return; // "forest path", "school bus"
        if (nx && nx.l === 'of' && ts[k + 2] && /^[A-Z]/.test(ts[k + 2].w)) return;
        const adjs = [];
        let det = '', j = k - 1, owner = null;
        while (j >= 0 && k - j <= 4) {
          const p = ts[j];
          if (DETS.has(p.l)) { det = p.l; break; }
          if (p.poss) { det = 'poss'; const oc = chars.find((c) => c.aliases.has(p.w) || c.roleWord === p.l || c.animalWord === p.l || (c.display && c.display.toLowerCase() === p.l)); owner = oc ? live(oc) : null; break; }
          if (isAdjective(p.l)) { adjs.unshift(p.l); j--; continue; }
          break;
        }
        const prev = k > 0 ? ts[k - 1].l : '';
        const bareOK = BARE_PLACES.has(t.l) && (SCENE_PREPS.has(prev) || MOVE_PREPS.has(prev) || prev === 'from' || /^(went|go|goes|going|came|come|walked|ran|returned|got|left|stayed|back|headed|arrived|drove|rode|biked)$/.test(prev));
        if (!det && !bareOK && !adjs.length) return;
        if (!det && !bareOK && adjs.length && !SCENE_PREPS.has(ts[j] ? ts[j].l : '') && !MOVE_PREPS.has(ts[j] ? ts[j].l : '')) return;
        let p;
        const heroOwn = (det === 'my' && pov === 'first') || (det === 'your' && pov === 'second') || (t.l === 'home' && (!det || det === 'my' || det === 'your' || det === 'our'));
        if (def.cat === 'room') {
          if (!lastBuilding && !def.home) return;
          p = lastBuilding || placeByKey.get('building:home:hero') || addPlace('building:home:hero', Object.assign({}, LIB.PLACES.house, { word: 'house', owner: hero.id }));
          if (!p.display) p.display = hero.name && pov === 'third' ? `${hero.name}'s House` : 'Your House';
        } else if (def.cat === 'building') {
          if (!owner && (det === 'her' || det === 'his' || det === 'their') && others.length) owner = others[others.length - 1];
          if (!owner && (det === 'her' || det === 'his' || det === 'their') && !others.length) owner = hero;
          if (heroOwn) owner = hero;
          if (!owner && det === 'the') { const prevB = [...places].reverse().find((x) => x.cat === 'building' && x.interior === def.interior); if (prevB) owner = prevB.owner ? chars.find((c) => c.id === prevB.owner) || null : null; }
          const ok = owner ? owner.id : '';
          p = addPlace(`building:${def.interior}:${ok}${ok ? '' : ':' + (def.interior === 'home' ? 'home' : def.word)}`, Object.assign({}, def, { owner: owner ? owner.id : null }));
          if (!p.display) {
            const noun = def.word === 'home' ? 'house' : def.word;
            p.display = owner ? (owner === hero ? (pov === 'third' ? `${hero.name}'s ${cap(noun)}` : `Your ${cap(noun)}`) : `${owner.display}'s ${cap(noun)}`) : titleCase([...adjs.filter((a) => PLACE_ADJ.has(a)).slice(0, 2), noun].join(' '));
          }
          lastBuilding = p;
        } else {
          const ckey = def.cat === 'settlement' ? 'settlement' : def.cat === 'area' ? 'area:' + def.biome : def.cat === 'dungeon' ? 'dungeon:' + def.dungeon : 'landmark:' + def.prop;
          const existingNamed = def.cat === 'settlement' ? places.find((x) => x.cat === 'settlement' && x.key.startsWith('named:')) : null;
          p = existingNamed || addPlace(ckey, Object.assign({}, def));
          if (!p.display) p.display = titleCase([...adjs.filter((a) => PLACE_ADJ.has(a)).slice(0, 2), def.word].join(' '));
        }
        let move = false;
        const chainStart = det ? j : k;
        if (chainStart > 0 && MOVE_PREPS.has(ts[chainStart - 1].l)) move = true;
        if (chainStart > 1 && ts[chainStart - 1].l === 'at' && /^(arrived|arrive|arrives|stopped)$/.test(ts[chainStart - 2].l)) move = true;
        if (!move) for (let x = chainStart - 1; x >= Math.max(0, chainStart - 5); x--) { const vv = VERB_OF[ts[x].l] || []; if (ts[x].l === 'from' || ts[x].l === 'of' || (vv.length && !vv.includes('move'))) break; if (vv.includes('move')) { move = true; break; } }
        if (t.l === 'home' && /^(went|go|goes|going|got|get|came|come|ran|walked|headed|returned|back|drove|rode|arrived|hurried|raced|flew|sailed)$/.test(prev)) move = true;
        if (inQuote(si, t.i)) move = false;
        const scenePrep = SCENE_PREPS.has(ts[Math.max(0, j)] ? ts[Math.max(0, j)].l : '') || SCENE_PREPS.has(j > 0 ? ts[j - 1].l : '') || SCENE_PREPS.has(prev);
        p.mentions.add(si); p.first = Math.min(p.first, si);
        sentPlaces[si].push({ p, idx: t.i, move, scene: scenePrep && !inQuote(si, t.i), quoted: inQuote(si, t.i) });
      });
    });
    sentences.forEach((s, si) => {
      for (const sp of sentPlaces[si]) {
        if (sp.move || sp.quoted) continue;
        const before = s.slice(Math.max(0, sp.idx - 50), sp.idx).toLowerCase();
        if (/\b(to|into|toward|towards|reached|entered|arrived at|arrived in|back to|onto)\s+(the\s+)?([a-z'’-]+\s+){0,3}$/.test(before) || /\b(went|walked|ran|traveled|travelled|headed|journeyed|sailed|flew|rode|climbed|returned|came|hurried|rushed|marched|crept|arrived|reached|entered)\b[^.,;]*$/.test(before)) sp.move = true;
      }
    });

    // ---------- objects ----------
    const objects = [];
    const objByKey = new Map();
    const sentObjects = sentences.map(() => []);
    toks.forEach((ts, si) => {
      ts.forEach((t, k) => {
        const caught = lookupAnimal(t.l) && ts.slice(Math.max(0, k - 4), k).some((x) => /^(caught|catch|catches|catching|hooked|reeled|fished|netted)$/.test(x.l));
        const def = lookupObject(t.l) || (caught ? { icon: 'fish', color: (lookupAnimal(t.l) || {}).color || '#7ab0d0' } : null);
        if (!def || lookupRole(t.l) || (lookupAnimal(t.l) && !caught)) return;
        if (/^[A-Z]/.test(t.w) && (namedPlaceWords.has(t.w) || artifactWords.has(t.w))) return;
        // "Rose" the girl is not a rose; a capitalized word mid-sentence that names a character isn't an object
        if (/^[A-Z]/.test(t.w) && (k > 0 || ts.length < 2) && chars.some((c) => c.named && (c.name === t.w || String(c.name).split(' ').includes(t.w)))) return;
        if (/^[A-Z]/.test(t.w) && k === 0 && chars.some((c) => c.named && c.name === t.w) && !(ts[1] && lookupObject(ts[1].l))) return;
        const nx = ts[k + 1];
        if (nx && (lookupObject(nx.l) || lookupPlace(nx.l) || lookupRole(nx.l) || lookupAnimal(nx.l))) return;
        const base = singular(t.l);
        const plural = base !== t.l && !!lookupObject(base);
        const adjs = [];
        let det = '', j = k - 1, count = 0;
        while (j >= 0 && k - j <= 4) {
          const p = ts[j];
          if (NUMS[p.l] || /^\d+$/.test(p.l)) { count = NUMS[p.l] || parseInt(p.l, 10); det = det || 'num'; j--; continue; }
          if (DETS.has(p.l)) { det = det || p.l; break; }
          if (p.poss) { det = 'poss'; break; }
          if (OBJ_ADJ.has(p.l) || LIB.COLORS[p.l] || isAdjective(p.l)) { adjs.unshift(p.l); j--; continue; }
          break;
        }
        const pv = k > 0 ? ts[k - 1].l : '';
        if (!det && !plural && !adjs.length && !(VERB_OF[pv] || /^(buy|bought|sell|sold|need|needed|want|wanted|eat|ate|drink|drank|carry|carried|with)$/.test(pv))) return;
        const key = 'obj:' + base;
        let o = objByKey.get(key);
        if (!o) {
          o = { id: 'o' + objects.length, key, word: base, icon: def.icon, color: def.color, display: '', count: 1, mentions: new Set(), first: si };
          const col = adjs.map((a) => LIB.COLORS[a]).find(Boolean);
          if (col) o.color = col;
          o.display = titleCase([...adjs.filter((a) => OBJ_ADJ.has(a) || LIB.COLORS[a]).slice(0, 2), base].join(' '));
          objects.push(o); objByKey.set(key, o);
        }
        if (count > 1) o.count = Math.max(o.count, Math.min(8, count));
        else if (plural && o.count < 3) o.count = 3;
        o.mentions.add(si);
        if (!sentObjects[si].includes(o)) sentObjects[si].push(o);
      });
    });
    {
      const ITEM_CAP = Object.keys(LIB.OBJECTS).filter((w) => !w.includes(' ')).map(cap).join('|');
      sentences.forEach((s, si) => {
        const re = new RegExp(`\\b((?:[A-Z][\\w'’-]+\\s+){0,3}(?:${ITEM_CAP})s?\\b(?:\\s+of\\s+(?:the\\s+)?[A-Z][\\w'’-]+(?:\\s+[A-Z][\\w'’-]+)?)?)`, 'g');
        let m;
        while ((m = re.exec(s))) {
          const words = m[1].trim().split(/\s+/);
          while (words.length > 1 && (STOP.has(words[0]) || TITLE_SET.has(words[0]))) words.shift();
          if (words.length < 2) continue;
          if (words.some((w) => chars.some((c) => c.named && c.aliases.has(w)))) continue;
          const nm = words.join(' ');
          if (words.some((w) => namedPlaceWords.has(w))) continue;
          const head = singular((/ of /i.test(nm) ? nm.split(/ of /i)[0] : nm).split(' ').pop().toLowerCase());
          const def = lookupObject(head);
          if (!def) continue;
          const key = 'obj:' + singular(head);
          let o = objByKey.get(key);
          if (!o) { o = { id: 'o' + objects.length, key, word: singular(head), icon: def.icon, color: def.color, count: 1, mentions: new Set(), first: si }; objects.push(o); objByKey.set(key, o); }
          o.display = nm; o.named = true; o.mentions.add(si);
          const nb = s.slice(Math.max(0, m.index - 12), m.index).toLowerCase().match(/(two|three|four|five|six|seven|eight|\d)\s+$/);
          if (nb) o.count = Math.max(o.count, NUMS[nb[1]] || parseInt(nb[1], 10) || 1);
          if (/s$/.test(words[words.length - 1]) && !/ of /.test(nm)) o.display = nm.replace(/s$/, '');
          if (!sentObjects[si].includes(o)) sentObjects[si].push(o);
        }
      });
    }

    // ---------- creatures (enemy types) ----------
    const creatureMap = new Map(groupCreatures);
    toks.forEach((ts, si) => {
      const hostileCtx = ts.some((x) => HOSTILE.has(x.l));
      ts.forEach((t, k) => {
        const sg = singular(t.l);
        if (!MONSTERS[sg] || sg === t.l) return; // plural mentions only: singular ones are characters
        if (lookupAnimal(sg) || lookupRole(sg)) { if (!hostileCtx && !(lookupAnimal(sg) || {}).hostile && !(lookupRole(sg) || {}).hostile) return; }
        if (k + 1 < ts.length && MONSTERS[singular(ts[k + 1].l)]) return;
        const adj = k > 0 && MONSTER_ADJ.includes(ts[k - 1].l) ? ts[k - 1].l : '';
        const name = titleCase((adj && adj !== 'evil' ? adj + ' ' : '') + sg);
        const g = creatureMap.get(name) || { name, base: sg, n: 0, si };
        g.n++; creatureMap.set(name, g);
      });
    });
    const creatures = [...creatureMap.values()].sort((a, b) => b.n - a.n || a.si - b.si).slice(0, 6).map((g) => {
      const an = lookupAnimal(g.base);
      const mon = MONSTERS[g.base] || (an ? [an.body === 'bird' || an.body === 'bug' ? 'flyer' : 'beast', an.color] : ['humanoid', colorFor(g.name)]);
      return { name: g.name, base: g.base, archetype: mon[0], color: mon[1], first: g.si };
    });

    // ---------- sentence annotations ----------
    const ann = sentences.map((s, si) => {
      const ts = toks[si];
      const verbs = new Set();
      ts.forEach((t, k) => {
        (VERB_OF[t.l] || []).forEach((v) => verbs.add(v));
        const pv = k > 0 ? ts[k - 1].l : '';
        if (t.l === 'away' && /^(ran|run|runs|running|got|get|flew|fly|swam|sailed|drove|hurried|raced)$/.test(pv)) verbs.add('escape');
        if (t.l === 'up' && /^(picked|pick|picks|picking)$/.test(pv)) verbs.add('find');
        if (t.l === 'for' && /^(looked|looking|look|searched|searching|hunted|hunting)$/.test(pv)) verbs.add('find');
        if (t.l === 'up' && /^(woke|wake|wakes)$/.test(pv)) verbs.add('sleep');
      });
      verbs.delete('collect');
      if (ts.some((t) => /^(collected|collect|collects|gathered|gather|gathers|harvested|harvest)$/.test(t.l))) verbs.add('collect');
      let request = null;
      ts.forEach((t, k) => {
        const asks = /^(asked|asks|ask|told|tells|tell|begged|begs|wanted|wants|needed|needs|ordered|orders|sent|sends|commanded|instructed|urged|challenged|dared|hired|invited|warned|reminded)$/.test(t.l);
        const goes = /^(went|goes|go|going|set|sets|headed|heads|travelled|traveled|journeyed|sailed|flew|rode|marched|hurried|ran|came|left|walked|climbed|returned)$/.test(t.l);
        if (!asks && !goes) return;
        for (let j = k + 1; j < Math.min(ts.length - 1, k + (goes ? 9 : 6)); j++) if (ts[j].l === 'to') {
          const vv = VERB_OF[ts[j + 1].l] || [];
          for (const v of ['find', 'collect', 'give', 'fight', 'rescue', 'fix']) if (vv.includes(v) || (v === 'collect' && /^(collect|gather|harvest)$/.test(ts[j + 1].l))) { verbs.delete(v); request = v; }
          if (request) { if (asks) verbs.add('talk'); break; }
          if (asks) break;
        }
      });
      let hostile = 0; for (const t of ts) if (HOSTILE.has(t.l)) hostile++;
      let weather = null; for (const t of ts) if (LIB.WEATHER_WORDS[t.l]) weather = LIB.WEATHER_WORDS[t.l];
      const cr = creatures.filter((c) => ts.some((t) => singular(t.l) === c.base));
      return { si, verbs, request, hostile, weather, chars: uniq([...sentChars[si]].map(live)), places: sentPlaces[si].sort((a, b) => a.idx - b.idx), objects: sentObjects[si], creatures: cr, quotes: [] };
    });
    // quotes and who said them
    sentences.forEach((s, si) => {
      const re = /["“]([^"”]{2,})["”]/g;
      let m;
      const qs = [];
      while ((m = re.exec(s))) qs.push(m[1].trim());
      if (!qs.length) return;
      const outside = stripQuotes(s);
      const ots = tokenize(outside);
      let speaker = null;
      const vi = ots.findIndex((t) => SPEECH.has(t.l));
      if (vi >= 0) {
        let bd = 99;
        for (const c of ann[si].chars) {
          const names = c.isHero && pov !== 'third' ? (pov === 'first' ? ['i'] : ['you']) : [...c.aliases].map((a) => a.toLowerCase().split(' ').pop()).concat(c.roleWord ? [c.roleWord] : [], c.animalWord ? [c.animalWord] : [], c.isHero && c.name ? [c.name.toLowerCase()] : []);
          ots.forEach((t, k) => { if (names.includes(t.l) || names.includes(singular(t.l))) { const d = Math.abs(k - vi); if (d < bd) { bd = d; speaker = c; } } });
        }
      }
      if (!speaker && ann[si].chars.length === 1) speaker = ann[si].chars[0];
      for (const q of qs) { ann[si].quotes.push({ text: q, speaker }); if (speaker) speaker.quotes.push({ si, text: q }); }
    });

    // ---------- chapters ----------
    const heroHome = places.find((p) => p.cat === 'building' && p.interior === 'home' && p.owner === hero.id);
    const startPlace = (() => {
      const wakes = ann[0] && (ann[0].verbs.has('sleep') || /\b(woke|bed|breakfast|morning)\b/i.test(sentences[0]));
      for (let si = 0; si < N; si++) {
        const sp = ann[si].places.find((x) => x.p.cat !== 'landmark' && !x.quoted);
        if (sp) { if (si >= 1 && heroHome && (wakes || sp.move)) return heroHome; return sp.p; }
      }
      return heroHome || null;
    })();
    const maxLen = N <= 8 ? 2 : N <= 16 ? 3 : Math.max(3, Math.ceil(N / 12));
    const heroInSubject = (si) => toks[si].slice(0, firstVerbPos[si]).some((t) => t.w === 'I' || /^(you|we)$/.test(t.l) || (hero && hero.name && t.w === hero.name));
    // the main kind of thing that happens in a sentence (used to split chapters)
    const actKind = (si) => {
      const a = ann[si], v = a.verbs;
      if (v.has('rescue')) return 'rescue';
      if ((v.has('fight') || a.hostile >= 2) && (a.creatures.length || a.chars.some((c) => !c.isHero))) return 'fight';
      if (v.has('escape')) return 'escape';
      if (v.has('give') && a.objects.length) return 'give';
      const otherDoer = subjectAt[si] && !subjectAt[si].isHero && !heroInSubject(si);
      if (v.has('collect') && a.objects.length && !otherDoer) return 'collect';
      if (v.has('find') && a.objects.length && !otherDoer) return 'find';
      if (a.request || a.quotes.some((q) => q.speaker && !q.speaker.isHero)) return 'talk';
      return null;
    };
    const beats = [];
    let cur = { s: [], place: null };
    let curPlace = startPlace;
    for (let si = 0; si < N; si++) {
      const a = ann[si];
      const moves = a.places.filter((x) => x.move && !x.quoted && x.p.cat !== 'landmark');
      const heroActs = subjectAt[si] === hero || (subjectAt[si] === null && /^(she|he|they)$/i.test((toks[si][0] || {}).l || ''));
      const mv = moves[moves.length - 1] || (si > 0 ? a.places.find((x) => x.scene && !x.quoted && x.p.cat !== 'landmark' && (x.idx < 25 || heroActs)) : null);
      const newPlace = mv ? mv.p : null;
      if (newPlace && newPlace !== curPlace && cur.s.length) { beats.push(cur); cur = { s: [], place: newPlace, prev: curPlace, movedBy: si }; }
      else if (newPlace && !cur.s.length) { cur.prev = cur.place || curPlace; cur.place = newPlace; cur.movedBy = si; }
      if (newPlace) curPlace = newPlace;
      const kind = actKind(si);
      if (kind && cur.s.length && cur.kind && cur.kind !== kind && !(newPlace && newPlace !== curPlace)) { beats.push(cur); cur = { s: [], place: curPlace }; }
      if (kind && !cur.kind) cur.kind = kind;
      if (!cur.place) cur.place = curPlace;
      cur.s.push(si);
      const strong = a.verbs.has('fight') || a.verbs.has('rescue') || a.verbs.has('give') || (a.verbs.has('find') && a.objects.length);
      if (cur.s.length >= maxLen || (strong && cur.s.length >= Math.max(2, maxLen - 1) && si < N - 1)) { beats.push(cur); cur = { s: [], place: curPlace }; }
    }
    if (cur.s.length) beats.push(cur);
    while (beats.length > 14) {
      let bi = 0, bl = 1e9;
      for (let i = 0; i < beats.length - 1; i++) { const l = beats[i].s.length + beats[i + 1].s.length + (beats[i].place === beats[i + 1].place ? 0 : 3); if (l < bl) { bl = l; bi = i; } }
      beats[bi].s.push(...beats[bi + 1].s); beats.splice(bi + 1, 1);
    }
    let homeP = startPlace;
    if (!homeP) {
      const th = LIB.VOCAB[theme] || LIB.VOCAB.fantasy;
      const def = LIB.PLACES[th.home] || LIB.PLACES.village;
      homeP = addPlace('gen:home', Object.assign({}, def, { display: th.home === 'neighborhood' ? 'The Neighborhood' : titleCase('the ' + th.home), word: th.home, generated: true }));
    }
    let lastP = homeP;
    for (const b of beats) { if (!b.place) b.place = lastP; lastP = b.place; }

    // ---------- what the player does in each chapter ----------
    const lastVillainFight = villain ? [...beats].reverse().find((b) => b.s.some((si) => ann[si].chars.includes(villain) && (ann[si].verbs.has('fight') || ann[si].hostile >= 1))) : null;
    const gotItem = new Set();
    beats.forEach((b, bi) => {
      let best = null;
      const consider = (o, prio, si) => { if (!best || prio > best.prio) best = Object.assign(o, { prio, si }); };
      for (const si of b.s) {
        const a = ann[si];
        const others = a.chars.filter((c) => !c.isHero);
        const hostileChar = others.find((c) => c === villain) || others.find((c) => hostileScore(c) >= 4);
        const freeing = a.verbs.has('rescue') && !a.verbs.has('fight');
        if ((a.verbs.has('fight') || a.hostile >= 2) && hostileChar && !freeing && (hostileChar !== villain || b === lastVillainFight)) consider({ type: 'boss', char: hostileChar }, hostileChar === villain ? 12 : 9, si);
        else if ((a.verbs.has('fight') || a.hostile >= 1) && a.creatures.length) consider({ type: 'defeat', creature: a.creatures[0].name }, 8, si);
        else if (a.verbs.has('fight') && a.hostile >= 1) consider({ type: 'defeat', creature: null }, 7, si);
        if (a.verbs.has('rescue') && others.length) { const tgt = others.find((c) => c !== villain && (hostileScore(c) < 4 || freeing)); if (tgt) consider({ type: 'rescue', char: tgt }, 8, si); }
        if (a.verbs.has('give') && a.objects.length && others.length) {
          const subj = subjectAt[si] || null;
          const pronounStart = /^(she|he|they|i|you|we)$/i.test((toks[si][0] || {}).l || '');
          if (subj && !subj.isHero && !pronounStart) consider({ type: 'receive', item: a.objects[0], char: subj }, 6.5, si);
          else consider({ type: 'give', item: a.objects[0], char: others.find((c) => c !== villain && c !== subj) || others[0] }, 7, si);
        }
        const otherDoer = subjectAt[si] && !subjectAt[si].isHero && !heroInSubject(si); // "Rex stole the backpack" is not your job
        if ((a.verbs.has('find') || a.verbs.has('collect')) && a.objects.length && !otherDoer) {
          const o = a.objects[0];
          const listed = uniq(a.places.filter((x) => !x.quoted && x.p.cat !== 'landmark' && x.p.cat !== 'settlement').map((x) => x.p));
          consider(o.count > 1 ? { type: 'collect', item: o, count: Math.min(6, o.count), multi: listed.length >= 2 ? listed : null } : { type: 'find', item: o, multi: listed.length >= 2 && o.count > 1 ? listed : null }, 6 + (si - b.s[0]) * 0.01, si);
        }
        if (a.verbs.has('escape')) consider({ type: 'escape' }, 5, si);
        if (a.verbs.has('fix')) {
          const vt = toks[si].find((t) => (VERB_OF[t.l] || []).includes('fix'));
          const sj = subjectAt[si];
          if (sj && !sj.isHero) consider({ type: 'talk', char: sj }, 4.5, si);
          else consider({ type: 'use', verb: vt ? vt.l : 'use', item: a.objects[0] || null, prop: 'table' }, 5, si);
        }
        const qsp = a.quotes.find((q) => q.speaker && !q.speaker.isHero);
        if ((a.verbs.has('talk') || qsp) && others.length) consider({ type: 'talk', char: qsp ? qsp.speaker : others[0] }, 4, si);
        if (others.length) consider({ type: 'talk', char: others[0] }, 2.5, si);
        if (a.verbs.has('sleep')) consider({ type: 'use', verb: 'rest', prop: 'bed' }, 2, si);
        const mv = a.places.find((x) => x.move);
        if (mv) consider({ type: 'reach', place: mv.p }, 3, si);
      }
      if (!best) best = { type: 'inspect', prio: 0, si: b.s[0] };
      if (best.type === 'boss') { for (const si of b.s) { const a = ann[si]; if (a.verbs.has('rescue')) { const tgt = a.chars.find((c) => !c.isHero && c !== best.char && hostileScore(c) < 4); if (tgt) b.after = { type: 'rescue', char: tgt, prio: 8, si: -1 }; } } }
      // "Fengle had one job: deliver the pearl to the shaman" is a plan, not the delivery itself: you set out carrying it
      if (best.type === 'give' && best.si >= 0 && /\b(had one job|one job|had to|has to|have to|must|needed to|needs to|need to|was supposed to|is supposed to|were supposed to|wanted to|wants to|promised to|set out to|was going to|planned to|tried to|hoped to|was sent to|were sent to|asked to)[:,]?\s+(?:\w+\s+){0,2}?(deliver|give|bring|take|carry|return|hand)\b/i.test(sentences[best.si])) {
        b.carry = [best.item];
        gotItem.add(best.item.id);
        const later = beats.slice(bi + 1).some((x) => x.s.some((si) => ann[si].verbs.has('give') && ann[si].objects.includes(best.item)));
        best = later ? { type: 'inspect', prio: 0, si: best.si } : Object.assign(best, { needFind: false });
      }
      if (best.type === 'give' && !gotItem.has(best.item.id)) best.needFind = true;
      if (best.item) gotItem.add(best.item.id);
      for (const si of b.s) { const a = ann[si]; if ((a.verbs.has('find') || a.verbs.has('give')) && a.objects.length) for (const o of a.objects) if (!gotItem.has(o.id) && best.type !== 'find' && best.type !== 'collect') { b.reward = b.reward || []; b.reward.push(o); gotItem.add(o.id); } }
      if (['rescue', 'boss', 'defeat', 'receive', 'talk'].includes(best.type) && b.movedBy === best.si && b.prev) {
        const ts = toks[best.si];
        const vpos = ts.findIndex((t) => (VERB_OF[t.l] || []).some((v) => v === 'rescue' || v === 'fight' || v === 'give' || v === 'talk'));
        const mvp = ann[best.si].places.find((x) => x.p === b.place);
        if (vpos >= 0 && mvp && ts[vpos].i < mvp.idx) b.place = b.prev;
      }
      if (best.type === 'reach' && best.place) b.place = best.place;
      // fights and gathering happen outdoors when the text says where ("chased them through the park")
      if (best.type === 'defeat' || best.type === 'collect') {
        const here = b.s.flatMap((si) => ann[si].places).some((x) => x.p === b.place && !x.quoted);
        const out = !here && b.s.flatMap((si) => ann[si].places).find((x) => !x.quoted && x.p.cat === 'area' && x.p !== b.place);
        if (out) b.place = out.p;
      }
      if ((best.type === 'boss' || best.type === 'rescue') && best.si >= 0 && !ann[best.si].places.some((x) => x.p === b.place && !x.quoted)) {
        const lair = ann[best.si].places.find((x) => !x.quoted && x.p !== b.place && ['building', 'dungeon', 'area'].includes(x.p.cat) && /\b(in|at|inside|into|to|across|through|on|around)\s+(the\s+|his\s+|her\s+|their\s+|its\s+)?$/i.test(sentences[best.si].slice(Math.max(0, x.idx - 14), x.idx)));
        if (lair) b.place = lair.p;
      }
      const sceneAt = (best.type === 'find' || best.type === 'collect') && !best.multi && best.si >= 0 && ann[best.si].places.find((x) => x.scene && !x.quoted && x.p.cat !== 'landmark' && x.p.cat !== 'settlement');
      if (sceneAt) b.place = sceneAt.p; // "deep inside the forge, she found a map"
      else if (best.type === 'find' && !best.multi && best.si >= 0 && !ann[best.si].places.some((x) => x.p === b.place && !x.quoted)) {
        const at = ann[best.si].places.find((x) => !x.quoted && x.p !== b.place && ['dungeon', 'building', 'area', 'landmark'].includes(x.p.cat));
        if (at) b.place = at.p;
      }
      if (best.type === 'reach' && bi > 0 && beats[bi - 1].place === b.place) best = { type: 'inspect', prio: 0, si: best.si };
      if (best.type === 'reach' && bi === 0) { const o = b.s.flatMap((si) => ann[si].chars).find((c) => !c.isHero); best = o ? { type: 'talk', char: o, prio: 2, si: best.si } : { type: 'inspect', prio: 0, si: best.si }; }
      if (best.type === 'talk' && best.char === villain && b !== lastVillainFight) best.taunt = true;
      if (best.type === 'escape') {
        const to = best.si >= 0 && ann[best.si].places.find((x) => !x.quoted && x.move);
        const nb = beats[bi + 1];
        best.place = to && bi > 0 && beats[bi - 1].place !== to.p ? to.p : nb && nb.place !== b.place ? nb.place : homeP === b.place ? null : homeP;
        if (to && best.place === to.p && bi > 0) b.place = beats[bi - 1].place;
        if (!best.place) best = { type: 'inspect', prio: 0, si: best.si };
      }
      // "the queen sent her knights to find the sword in the lake": if nobody does it later, you do
      if ((best.type === 'talk' || best.type === 'reach' || best.type === 'inspect') && best.si >= 0 && ann[best.si].request && !b.after) {
        const a = ann[best.si], req = a.request, item = a.objects[0];
        const at = a.places.find((x) => !x.quoted && x.p !== b.place && x.p.cat !== 'settlement');
        const fulfilled = beats.slice(bi + 1).some((x) => x.s.some((si) => ann[si].verbs.has(req) && (!item || ann[si].objects.includes(item))));
        if (!fulfilled) {
          if ((req === 'find' || req === 'collect') && item) b.after = item.count > 1 ? { type: 'collect', item, count: Math.min(6, item.count), prio: 6, si: -1, at: at ? at.p : null } : { type: 'find', item, prio: 6, si: -1, at: at ? at.p : null };
          else if (req === 'rescue') { const tgt = a.chars.find((c) => !c.isHero && c !== best.char && c !== villain); if (tgt) b.after = { type: 'rescue', char: tgt, prio: 8, si: -1, at: at ? at.p : null }; }
          else if (req === 'fight' && a.creatures.length) b.after = { type: 'defeat', creature: a.creatures[0].name, prio: 8, si: -1, at: at ? at.p : null };
          else if (req === 'give' && item) { const to = a.chars.find((c) => !c.isHero && c !== best.char); if (to) { b.carry = (b.carry || []).concat([item]); gotItem.add(item.id); b.after = { type: 'give', item, char: to, prio: 7, si: -1, at: at ? at.p : null }; } }
        }
      }
      b.obj = best;
    });
    for (let bi = beats.length - 1; bi >= 0; bi--) if (beats[bi].after) beats.splice(bi + 1, 0, { s: [], place: beats[bi].after.at || beats[bi].place, obj: beats[bi].after, synthetic: true });
    for (let bi = beats.length - 1; bi > 0; bi--) {
      const b = beats[bi], pb = beats[bi - 1];
      const cont = b.obj.type === 'defeat' && !b.obj.creature && pb.obj.type === 'defeat';
      if ((b.obj.type === 'inspect' && pb.place === b.place) || cont) { if (cont && b.place && b.place.cat === 'area' && pb.place && pb.place.cat !== 'area') pb.place = b.place; pb.s.push(...b.s); if (b.reward) pb.reward = (pb.reward || []).concat(b.reward); beats.splice(bi, 1); }
    }
    if (villain && !beats.some((b) => b.obj.type === 'boss' && b.obj.char === villain)) {
      const vb = beats.filter((b) => b.s.some((si) => ann[si].chars.includes(villain)));
      const lastB = vb.length ? vb[vb.length - 1] : beats[beats.length - 1];
      const lb = beats[beats.length - 1];
      if (lastB && lastB !== lb || (lb && ['find', 'collect', 'give', 'rescue'].includes(lb.obj.type))) {
        let lair = null;
        for (const si of villain.mentions) { const own = ann[si].places.find((x) => (x.p.cat === 'building' || x.p.cat === 'dungeon') && /\b(his|her|their|its)\s+$/i.test(sentences[si].slice(Math.max(0, x.idx - 8), x.idx))); if (own) { lair = own.p; break; } }
        lair = lair || villain.mentions.size && [...villain.mentions].map((si) => ann[si].places.find((x) => x.p.cat === 'building' || x.p.cat === 'dungeon')).filter(Boolean).map((x) => x.p).pop() || places.find((p) => p.cat === 'building' && ['castle', 'tower', 'lab', 'prison'].includes(p.interior)) || places.find((p) => p.cat === 'dungeon' && p.mentions.size) || lastB.place;
        beats.push({ s: [], place: lair, obj: { type: 'boss', char: villain, prio: 12, si: -1 }, synthetic: true });
      } else if (lastB) lastB.obj = { type: 'boss', char: villain, prio: 12, si: lastB.s.find((si) => ann[si].chars.includes(villain)) ?? lastB.s[lastB.s.length - 1] };
    }

    // ---------- narration ----------
    const narr = (s) => (pov === 'first' ? toSecondPerson(s) : s);
    let weather = null;
    for (const b of beats) {
      const ai = Math.max(0, b.s.indexOf(b.obj.si));
      b.intro = b.s.slice(0, ai).map((si) => narr(sentences[si]));
      b.outro = b.s.slice(ai).map((si) => narr(sentences[si]));
      if (b.synthetic) { b.intro = []; b.outro = []; b.chars = [b.obj.char].filter(Boolean); }
      for (const si of b.s) if (ann[si].weather) weather = ann[si].weather;
      b.weather = weather;
      b.danger = b.s.reduce((n, si) => n + ann[si].hostile, 0);
      if (!b.synthetic) b.chars = uniq(b.s.flatMap((si) => ann[si].chars)).filter((c) => c && !c.isHero);
      b.objects = uniq(b.s.flatMap((si) => ann[si].objects));
      b.creatures = uniq(b.s.flatMap((si) => ann[si].creatures.map((c) => c.name)));
    }

    // ---------- build the blueprint ----------
    const T = THEMES[theme];
    const usedChars = liveChars().filter((c) => !c.isHero && (c.mentions.size || c.quotes.length));
    const charHome = (c) => { const b = beats.find((bb) => bb.chars.includes(c)); return b ? b.place : homeP; };
    const outChars = usedChars.map((c) => buildChar(c, { T, villain, hostileScore, sentences, beats, pov, home: charHome(c) }));
    const idMap = new Map(usedChars.map((c, i) => [c, outChars[i].id]));
    const heroOut = buildHero(hero, { T, pov });
    const usedPlaces = uniq([homeP, ...beats.map((b) => b.place), ...places.filter((p) => p.mentions.size)]).filter(Boolean);
    const outPlaces = usedPlaces.map((p) => ({
      id: p.id, name: p.name, display: p.display || titleCase(p.word || 'place'), cat: p.cat, biome: p.biome || 'wilds', interior: p.interior || null, style: p.style || null, size: p.size || null, dungeon: p.dungeon || null, prop: p.prop || null,
      owner: p.owner ? (p.owner === hero.id ? 'hero' : (idMap.get(chars.find((c) => c.id === p.owner)) || null)) : null,
      word: p.word || '', generated: !!p.generated, beatFirst: beats.findIndex((b) => b.place === p), parent: null,
    }));
    for (const op of outPlaces) {
      if (op.cat === 'area' || op.cat === 'settlement') continue;
      const src = places.find((p) => p.id === op.id);
      let parent = null;
      for (const si of src ? src.mentions : []) { const z = ann[si].places.find((x) => x.p !== src && (x.p.cat === 'area' || x.p.cat === 'settlement')); if (z) { parent = z.p.id; break; } }
      if (!parent && op.cat === 'building' && ['shop', 'tavern', 'school', 'temple', 'library', 'hospital', 'hall', 'prison'].includes(op.interior)) { const st = outPlaces.find((x) => x.cat === 'settlement'); if (st) parent = st.id; }
      if (!parent && op.cat === 'building' && op.interior === 'home' && op.owner === 'hero') { const st = outPlaces.find((x) => x.cat === 'settlement'); if (st) parent = st.id; }
      op.parent = parent;
    }
    const enemies = buildEnemies(creatures, T, beats, villain);
    const outBeats = beats.map((b, i) => {
      const o = b.obj;
      const obj = { type: o.type, place: (o.place || b.place).id };
      if (o.char) obj.char = idMap.get(o.char) || null;
      if (o.item) obj.item = o.item.id;
      if (o.count) obj.count = o.count;
      if (o.type === 'defeat') {
        const pool = enemies.list.filter((e) => !enemies.critters.includes(e.name) || enemies.peaceful);
        obj.creature = o.creature || b.creatures[0] || (pool[Math.min(pool.length - 1, Math.floor((i / Math.max(1, beats.length - 1)) * (pool.length - 1)))] || enemies.list[0] || {}).name;
        obj.count = 3 + Math.min(3, Math.floor(i / 3));
      }
      if (o.type === 'rescue') obj.guard = b.creatures[0] || (enemies.list[Math.min(1, enemies.list.length - 1)] || {}).name;
      if (o.verb) obj.verb = o.verb;
      if (o.prop) obj.prop = o.prop;
      if (o.needFind) obj.needFind = true;
      if (o.taunt) obj.taunt = true;
      if ((o.type === 'talk' || o.type === 'give' || o.type === 'receive' || o.type === 'rescue' || o.type === 'boss') && !obj.char) { obj.type = 'inspect'; }
      const base = { i, place: b.place.id, obj, intro: b.intro, outro: b.outro, chars: b.chars.map((c) => idMap.get(c)).filter(Boolean), objects: b.objects.map((x) => x.id), weather: b.weather, danger: b.danger, reward: (b.reward || []).map((x) => x.id), carry: (b.carry || []).map((x) => x.id) };
      if (o.multi && o.multi.length >= 2 && o.item) {
        // "collect the three cores from the Reactor, the Hangar and the Vault" -> one stop per place
        return o.multi.map((pl, k) => Object.assign({}, base, { place: pl.id, obj: { type: 'find', item: o.item.id, place: pl.id, part: k + 1, parts: o.multi.length }, intro: k === 0 ? base.intro : [], outro: k === o.multi.length - 1 ? base.outro : [], reward: k === o.multi.length - 1 ? base.reward : [] }));
      }
      return [base];
    }).flat().map((b, i) => Object.assign(b, { i }));
    { const art = objects.find((o) => o.named && o.icon !== 'shard'); for (const o of objects) if (o.icon === 'shard' && art && !o.named) o.display = `Piece of the ${art.display.replace(/^The /, '')}`; }
    const outObjects = objects.filter((o) => o.mentions.size).map((o) => ({ id: o.id, display: o.display || titleCase(o.word), word: o.word, icon: o.icon, color: o.color, count: o.count, named: !!o.named }));
    const S = {
      version: 2, seed, source, theme, pov, premise, region: regionName,
      hero: heroOut, chars: outChars, places: outPlaces, objects: outObjects, beats: outBeats,
      enemies: enemies.list, critters: enemies.critters, peaceful: enemies.peaceful,
      villain: villain ? idMap.get(villain) || null : null,
      startPlace: homeP.id,
      story: sentences.map(narr),
      weapons: heroOut.cls === 'mage' ? ['Oak Staff', 'Apprentice Wand', 'Runed Staff', 'Archmage Rod', 'Staff of Ages'] : heroOut.cls === 'ranger' ? (['scifi', 'city', 'alien', 'wasteland', 'modern'].includes(theme) ? ['Pea Shooter', 'Laser Pistol', 'Pulse Rifle', 'Rail Gun', 'Photon Cannon'] : ['Short Bow', 'Hunting Bow', 'Longbow', 'Composite Bow', 'Starfall Bow']) : T.weapons,
      armors: T.armors, potion: T.potion, currency: T.currency,
      difficulty: /\b(easy|cozy|cosy|kids?|children|gentle|peaceful|bedtime)\b/.test(lowerAll) ? 1 : /\b(hard|brutal|difficult|deadly|nightmare|hardcore)\b/.test(lowerAll) ? 3 : 2,
    };
    S.title = titleLine || makeTitle(rng, S);
    S.ending = outBeats.length ? outBeats[outBeats.length - 1].outro.slice(-2).join(' ') : '';
    S.sideQuests = buildSideQuests(S, rng, T);
    S.stats = { sentences: N, characters: outChars.length, places: outPlaces.length, objects: outObjects.length, chapters: outBeats.length };
    return S;
  }

  // ======================= helpers for analysis =======================
  function pickTheme(lower, rng, forced) {
    if (forced && THEMES[forced]) return forced;
    const words = lower.match(/[a-z][a-z'’-]*/g) || [];
    const scores = {};
    for (const k of THEME_KEYS) {
      const set = new Set(THEMES[k].keywords);
      let sc = 0;
      for (const w of words) if (set.has(w) || set.has(singular(w))) sc++;
      for (const kw of THEMES[k].keywords) if (kw.includes(' ') && lower.includes(kw)) sc += 2;
      scores[k] = sc;
    }
    if (/sci-?fi|science fiction|outer space/.test(lower)) scores.scifi += 4;
    if (/wild west|cowboy/.test(lower)) scores.desert += 3;
    if (/once upon a time|happily ever after|fairy ?tale/.test(lower)) { scores.fantasy += 2; scores.whimsy += 1; }
    const ranked = THEME_KEYS.slice().sort((a, b) => scores[b] - scores[a]);
    return scores[ranked[0]] > 0 ? ranked[0] : rng.pick(['fantasy', 'fantasy', 'whimsy', 'countryside', 'modern', 'pirate', 'scifi', 'jungle', 'ice', 'desert', 'undead', 'swamp', 'alien', 'wasteland', 'city', 'fire']);
  }

  function harvestSeeds(premise) {
    const ts = tokenize(premise);
    const seeds = {};
    const low = premise.toLowerCase();
    const names = ts.filter((t, k) => /^[A-Z]/.test(t.w) && !STOP.has(t.w) && !lookupPlace(t.l) && !lookupObject(t.l) && !lookupRole(t.l) && !lookupAnimal(t.l) && !(k === 0)).map((t) => t.w);
    const goalAt = low.search(/\b(wants?|wanted|dreams?|dreamed|wishes|wished|hopes?|tries|tried|needs?|learns?|learned|decides|decided|plans?|planned)\s+(to|of)\b/);
    for (const t of ts) {
      if (goalAt >= 0 && t.i > goalAt) break;
      const r = lookupRole(t.l), a = lookupAnimal(t.l), p = lookupPlace(t.l), o = lookupObject(t.l);
      const sg = singular(t.l);
      const hostileThing = (r && r.hostile) || (a && a.hostile) || (!!MONSTERS[sg] && !r && !a) || /\b(evil|wicked|mean|dark|angry)\s+\w*\s*$/.test(low.slice(0, low.indexOf(t.l)));
      if ((r || a) && !seeds.heroNoun && !hostileThing && sg === t.l) { seeds.heroNoun = t.l; continue; }
      if ((r || a || MONSTERS[sg]) && sg === t.l && !seeds.foe && hostileThing && t.l !== seeds.heroNoun) { seeds.foe = t.l; continue; }
      if (MONSTERS[sg] && sg !== t.l) seeds.minions = t.l;
      if (p && p.cat !== 'room' && p.cat !== 'landmark') { if (p.cat === 'settlement' && !seeds.home) seeds.home = t.l; else if (p.cat === 'dungeon') seeds.deep = t.l; else if (p.cat === 'building' && ['castle', 'tower'].includes(p.interior)) seeds.lair = t.l; else if (p.cat === 'area') (seeds.wild = seeds.wild || []).push(t.l); else if (p.cat === 'building') seeds.deep = seeds.deep || t.l; }
      if (o && !seeds.item) seeds.item = singular(t.l);
    }
    if (!names.length) { const m0 = premise.match(/^([A-Z][a-z]{1,14})\s+([a-z]+)/); if (m0 && !STOP.has(m0[1]) && !lookupRole(m0[1].toLowerCase()) && !lookupAnimal(m0[1].toLowerCase()) && !lookupPlace(m0[1].toLowerCase()) && (VERB_OF[m0[2]] || /ed$/.test(m0[2]) || /^(was|is|had|has|went|ran|saw|met|took|made|came|found|got|lived|loved|wanted|knew)$/.test(m0[2]))) names.push(m0[1]); }
    if (names.length) seeds.heroName = names[0];
    // "with my grandpa", "my grandpa and I": a companion
    const cm = low.match(/\b(?:my|our|his|her)\s+([a-z]+)\s+and\s+(?:i|me|we)\b|\bwith\s+(?:my|our|his|her|the)\s+([a-z]+)\b|\b(?:i|we)\s+and\s+(?:my|our)\s+([a-z]+)\b/);
    if (cm) { const w = cm[1] || cm[2] || cm[3]; if (lookupRole(w) || lookupAnimal(w)) seeds.companion = w; }
    // "rescue the princess from the cat king"
    const rv = low.match(/\b(?:rescue|save|free|help|find)\s+(?:the|my|his|her|a|an)\s+((?:[a-z]+\s+)?[a-z]+?)\s+from\s+(?:the|a|an|his|her)\s+((?:[a-z]+\s+)?[a-z]+)\b/);
    if (rv) { const vw = rv[1].split(' ').pop(); if (lookupRole(vw) || lookupAnimal(vw)) seeds.victim = rv[1]; seeds.foe = rv[2]; }
    const rv2 = !rv && low.match(/\b(?:rescue|save|free)\s+(?:the|my|his|her|a|an)\s+((?:[a-z]+\s+)?[a-z]+)\b/);
    if (rv2) { const vw = rv2[1].split(' ').pop(); if (lookupRole(vw) || lookupAnimal(vw)) seeds.victim = rv2[1]; }
    const fk = low.match(/\b(?:the|a|an)\s+(?:evil\s+|wicked\s+|mean\s+|dark\s+)?([a-z]+\s+(?:king|queen|lord|emperor|witch|wizard|boss|captain|monster|beast))\b/);
    if (fk && !seeds.foe && !/^(good|kind|old|young|wise|brave|little)\s/.test(fk[1])) seeds.foe = fk[1];
    const g = premise.match(/\b(?:wants?|wanted|dreams?|dreamed|wishes|wished|hopes?|tries|tried|needs?|learns?|learned|decides|decided|plans?|planned)\s+(?:to|of)\s+(.+)$/i);
    if (g) seeds.goal = g[1].replace(/[.!?]+$/, '');
    return seeds;
  }

  function isIdea(raw, wordCount, hasVerb, sentences) {
    if (!hasVerb || wordCount < 7) return true;
    if (sentences.length === 1 && /^(?:(?:a|an|the|my)\s+)?(?:[\w'-]+\s+){0,3}(?:who|that|which)\s+(?:wants?|wanted|dreams?|dreamed|wishes|wished|hopes?|hoped|tries|tried|needs?|needed|longs?|longed|is|was|has|had|can|could|must)\b/i.test(raw.trim())) return true;
    if (sentences.length === 1 && /^(?:(?:a|an|the|my)\s+)?[\w'-]+(?:\s+[\w'-]+){0,4}\s+(?:in|on|at|from|of|with)\s+[\w' -]+$/i.test(raw.trim().replace(/[.!?]+$/, '')) && !/\b(went|goes|go|met|found|saw|ran|fought|rescued|saved|gave|took|stole|lived|woke|came|set|walked|sailed|flew)\b/i.test(raw)) return true;
    return false;
  }
  // wrap a one- to three-sentence story with an opening and a closing so it plays as a few chapters
  function padShort(sents, seeds, rng, theme) {
    const text = sents.join(' ');
    const first = /\b(I|I'm|I've|my|me)\b/.test(text);
    const V = LIB.VOCAB[theme] || LIB.VOCAB.fantasy;
    const H = first ? 'I' : seeds.heroName ? seeds.heroName : seeds.heroNoun ? `the ${seeds.heroNoun}` : null;
    if (!H) return sents;
    const Hc = cap(H);
    const home = seeds.home || (first ? 'home' : V.home);
    const where = home === 'home' ? 'at home' : `in the ${home}`;
    const out = [];
    const wakes = /\b(woke|wake|morning|bed|breakfast)\b/i.test(sents[0]);
    if (!wakes) out.push(rng.pick([`It was a bright morning ${where}, and ${H} could feel that today would be different.`, `It was a quiet morning ${where}.`, `${Hc} had been waiting ${where} for this day.`]));
    const comp = seeds.companion;
    if (comp && !wakes) out.push(`${first ? 'My' : 'The'} ${comp} was already waiting by the door and said, "${rng.pick(['Are you ready? Today is the day.', 'Come on, let\'s go!', 'Stay close to me today.'])}"`);
    out.push(...sents);
    if (seeds.foe && !/\b(defeated|beat|fought|killed|vanquished|stopped|chased away|drove away)\b/i.test(text)) out.push(`At last ${H} faced the ${seeds.foe} and defeated it.`);
    if (seeds.victim && !/\b(rescued|saved|freed)\b/i.test(text)) out.push(`${Hc} rescued the ${seeds.victim}.`);
    out.push(first ? rng.pick(['That night I went home and told everyone the whole story.', 'When I got home, I could not stop smiling.']) : `Then ${H} went back ${home === 'home' ? 'home' : 'to the ' + home} and told everyone the whole story.`);
    return out;
  }

  function generateStory(rng, theme, seeds) {
    const V = LIB.VOCAB[theme] || LIB.VOCAB.fantasy;
    const plot = rng.pick(LIB.PLOTS);
    const T = THEMES[theme];
    let H;
    if (seeds.heroName) H = seeds.heroName;
    else if (seeds.heroNoun && lookupAnimal(seeds.heroNoun)) H = rng.pick(LIB.NAMES.pet);
    else if (seeds.heroNoun && lookupRole(seeds.heroNoun) && lookupRole(seeds.heroNoun).g) H = rng.pick(LIB.NAMES[lookupRole(seeds.heroNoun).g]);
    else if (rng.chance(0.4)) { const [A, B] = T.syl; H = cap((rng.pick(A) + rng.pick(B)).toLowerCase()); } else H = rng.pick(LIB.NAMES[rng.chance(0.5) ? 'f' : 'm']);
    const wild = uniq([...(seeds.wild || []), ...rng.shuffle(V.wild)]);
    const slot = { H, home: seeds.home || V.home, wild1: wild[0], wild2: wild[1] || wild[0], deep: seeds.deep || rng.pick(V.deep), lair: seeds.lair || V.lair, M: rng.pick(V.mentor), A: rng.pick(V.ally), F: seeds.foe || rng.pick(V.foe), minions: cap(seeds.minions || rng.pick(V.minions)), I: seeds.item || rng.pick(V.item) };
    if (slot.A === seeds.heroNoun) slot.A = V.ally.find((x) => x !== seeds.heroNoun) || 'owl';
    if (slot.M === seeds.heroNoun) slot.M = V.mentor.find((x) => x !== seeds.heroNoun) || 'old sage';
    const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => slot[k] || m);
    const out = [];
    if (seeds.heroNoun || seeds.goal) {
      const art = /^[aeiou]/i.test(seeds.heroNoun || '') ? 'an' : 'a';
      out.push(`This is the story of ${H}, ${seeds.heroNoun ? `${art} ${seeds.heroNoun}` : 'a dreamer'}${seeds.goal ? ` who wanted to ${seeds.goal}` : ''}.`);
    }
    for (const line of plot) out.push(fill(line));
    if (seeds.goal) out.push(`And at last, ${H} got to ${seeds.goal.replace(/\bmy\b/g, 'their').replace(/\bhis\b|\bher\b/g, 'their')}.`);
    return out;
  }

  function baseLook(c) {
    const h = hashString(c.key + (c.name || ''));
    const skins = ['#f0c8a0', '#e0b090', '#c89068', '#a87048', '#8a5a3a', '#f4d8c0'];
    const hairs = ['#2a1a10', '#5a3a1a', '#8a5a2a', '#d0a040', '#a03a1a', '#3a3a4a', '#1a1a22'];
    const L = { skin: skins[h % skins.length], hair: hairs[(h >>> 4) % hairs.length], shirt: hslToHex((h >>> 8) % 360, 45, 45), pants: hslToHex((h >>> 12) % 360, 20, 25), longHair: (h >>> 16) % 2 === 0, scale: 1 };
    if (c.role && c.role.g === 'f') L.longHair = true;
    if (c.role && c.role.look) Object.assign(L, c.role.look);
    if (c.role && c.role.age === 'old' && !(c.role.look && c.role.look.hair)) L.hair = '#d0d0d4';
    if (c.role && c.role.age === 'child') L.scale = Math.min(L.scale || 1, 0.85);
    for (const a of c.adjs) {
      if (LIB.HAIR[a]) L.hair = LIB.HAIR[a] === 'none' ? null : LIB.HAIR[a];
      if (LIB.SIZE_WORDS[a]) L.scale = LIB.SIZE_WORDS[a];
      if (LIB.AGE_WORDS[a] === 'old') { L.hair = '#d0d0d4'; if (c.role && c.role.g === 'm') L.beard = L.beard || '#d8d8dc'; }
      if (LIB.AGE_WORDS[a] === 'child') L.scale = Math.min(L.scale || 1, 0.85);
      if (LIB.COLORS[a]) L.shirt = LIB.COLORS[a];
    }
    const nameWords = String(c.name || c.display || '').toLowerCase().split(/\s+/);
    const nameColor = nameWords.map((w) => LIB.COLORS[w]).find(Boolean);
    if (nameColor) { if (nameWords.some((w) => /^(hood|cap|riding|cloak)$/.test(w))) { L.hat = 'hood'; L.hatColor = nameColor; L.cape = nameColor; } else L.shirt = nameColor; }
    if (c.animal) { L.animal = c.animalWord; L.color = [...c.adjs].map((a) => LIB.COLORS[a]).find(Boolean) || c.animal.color; }
    else { const aw = [...c.adjs].find((a) => lookupAnimal(a)); if (aw) { L.animal = singular(aw); L.color = [...c.adjs].map((a) => LIB.COLORS[a]).find(Boolean) || lookupAnimal(aw).color; L.scale = Math.max(L.scale || 1, 1.2); } } // the cat king is a cat
    if (c.kind === 'robot') { L.metal = true; L.skin = '#a8b0b8'; }
    if (c.kind === 'ghost') { L.ghost = true; L.shirt = '#d8e4ff'; L.skin = '#e8f0ff'; }
    if (c.kind === 'monster') { L.wide = true; L.scale = (L.scale || 1) * 1.2; L.horns = true; L.skin = colorFor(c.key); L.shirt = darken(L.skin, 0.3); }
    return L;
  }

  function buildHero(c, ctx) {
    const { T, pov } = ctx;
    const look = baseLook(c);
    if (!c.role && !c.animal && c.kind === 'person') { look.shirt = T.heroColor; }
    let cls = 'warrior';
    const words = [c.roleWord, c.animalWord, ...c.adjs].filter(Boolean);
    for (const [k, def] of Object.entries(CLASSES)) if (words.some((w) => def.words.includes(w))) cls = k;
    if (/^(wizard|witch|sorcerer|sorceress|mage|magician|priest|priestess|fairy|warlock|enchantress)$/.test(c.roleWord)) cls = 'mage';
    if (/^(hunter|ranger|archer|police|policeman|policewoman|officer|cop|sheriff|detective|astronaut|pilot)$/.test(c.roleWord)) cls = 'ranger';
    if (/^(thief|rogue|bandit|burglar|outlaw|pirate)$/.test(c.roleWord)) cls = 'rogue';
    const name = c.name || (pov === 'third' ? c.display : 'You');
    return { id: 'hero', name, display: pov === 'third' ? (c.display && !c.named && !c.nameGenerated ? c.display : name) : (c.name || 'You'), cls, kind: c.kind, animal: c.animal ? c.animalWord : null, role: c.roleWord || null, look, pov, generatedName: !!c.nameGenerated, roleDisplay: c.display && c.display !== name ? c.display : '' };
  }

  function buildChar(c, ctx) {
    const { villain, hostileScore, sentences, beats, pov } = ctx;
    const look = baseLook(c);
    const isVillain = c === villain;
    for (const si of [...c.mentions].slice(0, 5)) {
      const low = sentences[si].toLowerCase();
      const m = low.match(/\b(?:wearing|wore|wears|in|with|had)\s+(?:a|an|her|his|their)?\s*(red|blue|green|yellow|purple|pink|orange|black|white|gray|grey|brown|golden|silver|crimson|scarlet)\s+(cloak|cape|hood|dress|coat|shirt|hat|scarf|jacket|robe|robes|armor|armour|suit|uniform|tunic|gown|sweater)\b/);
      if (m) { const col = LIB.COLORS[m[1]]; if (/cloak|cape/.test(m[2])) look.cape = col; else if (/hood/.test(m[2])) { look.hat = 'hood'; look.hatColor = col; } else if (/hat/.test(m[2])) look.hatColor = col; else look.shirt = col; }
      if (/\bbeard\b/.test(low) && c.mentions.size < 6) look.beard = look.beard || look.hair || '#6a4a2a';
      if (/\b(glasses|spectacles)\b/.test(low)) look.glasses = true;
    }
    let mood = null;
    for (const a of c.adjs) if (LIB.MOOD_WORDS[a]) mood = LIB.MOOD_WORDS[a];
    if (isVillain) mood = 'evil';
    let voice = c.animal ? 'animal' : c.role ? c.role.voice : 'plain';
    if (c.kind === 'robot') voice = 'robot';
    if (c.kind === 'ghost') voice = 'ghost';
    const display = c.display || c.name || (c.role ? c.role.display : c.animal ? c.animal.display : 'Stranger');
    const hs = hostileScore(c);
    const bIdx = (si) => beats.findIndex((b) => b.s.includes(si));
    return {
      id: c.id, name: c.name || '', display, title: c.title || '', role: c.roleWord || null, animal: c.animal ? c.animalWord : null, kind: c.kind,
      gender: c.role && c.role.g ? c.role.g : '', look, mood: mood || 'plain', voice,
      job: c.role && c.role.job ? c.role.job : null, sound: c.animal ? c.animal.sound : null,
      hostile: isVillain || hs >= 4, isVillain, archetype: villainArch(c),
      quotes: c.quotes.map((q) => ({ b: bIdx(q.si), text: q.text })),
      mentions: [...c.mentions].sort((a, b) => a - b).map((si) => ({ b: bIdx(si), text: pov === 'first' ? toSecondPerson(sentences[si]) : sentences[si] })),
      home: ctx.home ? ctx.home.id : null,
    };
  }

  function villainArch(c) {
    if (c.animal) { const b = c.animal.body; return b === 'bird' || b === 'bug' ? 'flyer' : (c.animal.size || 1) >= 1.3 ? 'brute' : 'beast'; }
    if (c.kind === 'ghost') return 'caster';
    if (c.kind === 'robot' || c.kind === 'monster') return 'brute';
    if (c.roleWord) { if (/^(wizard|witch|sorcerer|sorceress|mage|warlock|priest|priestess|enchantress|magician)$/.test(c.roleWord)) return 'caster'; if (/^(giant|ogre|troll|king|emperor)$/.test(c.roleWord)) return 'brute'; }
    return 'humanoid';
  }

  function buildEnemies(creatures, T, beats, villain) {
    if (villain && villain.animal && !creatures.some((c) => c.base === villain.animalWord)) creatures = creatures.concat([{ name: titleCase(villain.animalWord), base: villain.animalWord, archetype: villain.animal.body === 'bird' || villain.animal.body === 'bug' ? 'flyer' : 'beast', color: villain.animal.color }]);
    const totalDanger = beats.reduce((n, b) => n + b.danger, 0) + (villain ? 3 : 0);
    const peaceful = totalDanger < 2 && !creatures.length;
    const list = [];
    const seen = new Set();
    const add = (name, arch, color) => {
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      if (!arch || !color) {
        for (const w of name.toLowerCase().split(/\s+/).reverse()) {
          const m = MONSTERS[singular(w)];
          if (m) { arch = arch || m[0]; color = color || m[1]; break; }
          const a = lookupAnimal(w);
          if (a) { arch = arch || (a.body === 'bird' || a.body === 'bug' ? 'flyer' : 'beast'); color = color || a.color; break; }
        }
      }
      list.push({ name, archetype: arch || ARCH_ORDER[hashString(name) % ARCH_ORDER.length], color: color || colorFor(name) });
    };
    creatures.forEach((c) => add(c.name, c.archetype, c.color));
    if (!peaceful && creatures.length < 2) for (const e of T.enemies) { if (list.length >= 4) break; add(e); }
    const critters = (T.critters || T.enemies.slice(0, 2)).slice();
    critters.forEach((c) => add(c));
    list.sort((a, b) => ARCH_ORDER.indexOf(a.archetype) - ARCH_ORDER.indexOf(b.archetype));
    return { list, critters, peaceful };
  }

  function buildSideQuests(S, rng, T) {
    const helpers = S.chars.filter((c) => !c.hostile && !c.job && c.kind !== 'animal');
    const sq = [];
    const givers = rng.shuffle(helpers).slice(0, 2);
    const pool = S.enemies.filter((e) => S.peaceful || !S.critters.includes(e.name));
    if (givers[0] && !S.peaceful && pool.length) sq.push({ type: 'kill', giver: givers[0].id, target: pool[0].name, count: 5, reward: 50 });
    const g2 = givers[1] || (S.peaceful ? givers[0] : null);
    if (g2) sq.push({ type: 'fetch', giver: g2.id, item: rng.pick(T.questItems), reward: 70 });
    return sq;
  }

  function makeTitle(rng, S) {
    const obj = S.objects.find((o) => o.named) || S.objects[0];
    const pl = S.places.find((p) => p.cat === 'area' && !p.generated) || S.places.find((p) => !p.generated);
    const villain = S.chars.find((c) => c.id === S.villain);
    const hn = S.hero.display === 'You' ? '' : (S.hero.generatedName ? '' : S.hero.name);
    if (hn && hn.split(' ').length >= 3) return hn;
    const tp = S.story.join(' ').match(/\b(?:the|one|a)\s+((?:first|last|longest|coldest|hottest|strangest)\s+)?(day|night|morning|evening|summer|winter|spring|autumn)(\s+of\s+(?:the\s+)?(?:summer|winter|spring|autumn|school|the year|my life|camp))?\b/i);
    if (tp && (tp[1] || tp[3])) return titleCase('the ' + tp[0].replace(/^(the|one|a)\s+/i, ''));
    const opts = [];
    if (obj) opts.push(hn ? `${hn} and the ${obj.display}` : `The ${obj.display}`);
    if (villain && hn) opts.push(`${hn} and the ${villain.display.replace(/^The /, '')}`);
    if (pl) opts.push(`Beyond the ${pl.display.replace(/^The /, '')}`, `The ${pl.display.replace(/^The /, '')}`);
    if (hn) opts.push(`The Tale of ${hn}`, `${hn}'s Adventure`);
    if (!opts.length) opts.push('A Story Come to Life');
    return rng.pick(opts);
  }

  function fromText(text, opts) {
    const clean = String(text || '').trim();
    const seed = clean ? hashString(clean) : (Math.random() * 4294967296) >>> 0;
    return analyze(clean, seed, opts);
  }
  function fromSeed(seed) { return analyze('', seed >>> 0); }

  RPG.Story = { analyze, fromText, fromSeed, pluralize, singular, titleCase, splitSentences, colorFor, toSecondPerson, cap, tokenize };
})();
