/* web.js — optional online helper. When a story uses words the built-in library doesn't know
   ("axolotl", "zeppelin", "wendigo", "Kyoto"), it looks them up on Wikipedia (free, no key),
   works out what kind of thing each one is, and teaches the library a new entry built from the
   closest thing it already knows, plus a real fact characters can share in the game.
   Only those single words are sent, never your story. Everything still works offline without it. */
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const PREF_KEY = 'taleforge_web_on';
  const CACHE_KEY = 'taleforge_web_cache_v1';
  const API = 'https://en.wikipedia.org/w/api.php';
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ---------- what kind of thing is it? ----------
  const CUES = [
    ['monster', /\b(mythological|mythical|legendary creature|legendary monster|folklore|cryptid|monster|demon|evil spirit|supernatural being|supernatural creature|undead|fictional creature|fictional monster|creature in|creatures in|ogre|troll|vampire|ghoul|goblin|giant in)\b/],
    ['plant', /\b(species of (?:flowering )?plant|plant|tree|shrub|flowering|herb|fungus|fungi|mushroom|moss|fern|grass|cactus|vine|algae|seaweed)\b/],
    ['animal', /\b(species|subspecies|genus|breed|mammal|marsupial|rodent|bird|fish|reptile|amphibian|insect|arachnid|crustacean|mollusc|mollusk|cetacean|primate|dinosaur|animal|lizard|snake|frog|salamander|beetle|butterfly|moth|shark|whale|dolphin|deer|antelope|monkey|ape|parrot|owl)\b/],
    ['person', /\b(occupation|profession|warrior|soldier|class of|caste|person who|people who|someone who|practitioner|nobility|clergy|monk|priest|mercenary|performer|worker|tradesman|tradesperson|artisan|member of|military rank|title given|officer)\b/],
    ['place', /\b(city|town|village|capital|municipality|prefecture|country|state in|province|island|archipelago|mountain|volcano|river|lake|sea|ocean|bay|desert|forest|jungle|rainforest|planet|moon|dwarf planet|region|valley|canyon|cave|building|structure|tower|temple|shrine|castle|palace|fortress|church|cathedral|mosque|house|dwelling|shelter|hut|room|park|garden|market|station|bridge|monument|ruins|landmark|stadium|museum|library|neighbourhood|neighborhood|district|water|walkway|path|road|street|pier|dock|wharf|harbou?r|port|quay|lighthouse|mill|farm|inn|tavern|shop|store|factory|mine|well|fountain|square|plaza|courtyard|camp|settlement|base|outpost|ship interior|room|hall|chamber|tomb|grave|cemetery|graveyard|swamp|marsh|bog|meadow|field|plain|hill|cliff|beach|coast|shore|reef|glacier|waterfall|spring|pond|stream|creek|grove|orchard|vineyard|ranch|estate|manor|mansion|cottage|cabin|tent|igloo|pagoda|pyramid|ziggurat|arena|theatre|theater|school|university|hospital|prison|jail|barracks|stable|barn|shed|warehouse|garage|airport|harbor)\b/],
    ['object', /\b(dish|food|cuisine|bread|pastry|dessert|snack|fruit|vegetable|drink|beverage|tool|device|instrument|weapon|firearm|sword|blade|vehicle|aircraft|airship|ship|boat|toy|game|garment|clothing|hat|container|jewelry|jewellery|gemstone|mineral|metal|coin|machine|engine|musical|artifact|artefact|object|item|implement|utensil|equipment|ornament|enclosure|cage|furniture|seat|throne|closet|cupboard|cabinet|chest|drawer|shelf|clothes|chair|stool|bench|table|box|basket|bag|sack|lamp|lighting|light|lantern|candle|covering|material|fabric|textile|substance|feather|plumage|shell|rope|net|vessel|barrel|bottle|cup|bowl|plate|pot|jar|key|lock|book|scroll|map|mirror|crown|ring|necklace|amulet|gem|jewel|pearl|stone|rock|crystal|bone|horn|tooth|fang|claw|egg|seed|flower|leaf|wheel|cart|wagon|carriage|sled|sledge|kite|balloon|instrument|drum|flute|horn|bell|whistle|mask|costume|uniform|armor|armour|shield|helmet|boot|shoe|glove|cloak|robe|dress|coat|staff|wand|rod|stick|club|hammer|axe|bow|arrow|spear|knife|dagger)\b/],
  ];
  // how a newly learned thing is drawn: the nearest thing the library already knows
  const ANIMAL_DEFAULTS = [[/\bbird|parrot|owl|eagle|hawk\b/, 'bird'], [/\bfish|shark\b/, 'fish'], [/\bwhale|dolphin|cetacean\b/, 'whale'], [/\binsect|beetle|butterfly|moth|bee\b/, 'bee'], [/\barachnid|spider\b/, 'spider'], [/\bcrustacean|crab|lobster\b/, 'crab'], [/\bmollus[ck]|octopus|squid\b/, 'octopus'], [/\bsnake|serpent\b/, 'snake'], [/\bamphibian|frog|toad\b/, 'frog'], [/\bsalamander|newt\b/, 'salamander'], [/\breptile|lizard|dinosaur\b/, 'salamander'], [/\bturtle|tortoise\b/, 'turtle'], [/\bprimate|monkey|ape\b/, 'monkey'], [/\brodent|mouse|rat\b/, 'mouse'], [/\bmarsupial|kangaroo|wallaby\b/, 'rabbit'], [/\bdeer|antelope|goat\b/, 'deer'], [/\bbear\b/, 'bear'], [/\bcat|feline\b/, 'cat'], [/\bdog|canine|wolf\b/, 'dog'], [/\bhorse|equine\b/, 'horse'], [/\bpig|boar\b/, 'pig'], [/\bcattle|cow|bovine\b/, 'cow']];
  const PLACE_DEFAULTS = [[/\bplanet|dwarf planet|moon\b/, 'crater'], [/\bcapital|city|metropolis|municipality|prefecture\b/, 'city'], [/\btown\b/, 'town'], [/\bvillage|hamlet\b/, 'village'], [/\bisland|archipelago\b/, 'island'], [/\bvolcano\b/, 'volcano'], [/\bmountain|peak\b/, 'mountain'], [/\bdesert\b/, 'desert'], [/\bjungle|rainforest\b/, 'jungle'], [/\bforest|wood\b/, 'forest'], [/\briver\b/, 'river'], [/\blake\b/, 'lake'], [/\bsea|ocean|bay\b/, 'beach'], [/\bvalley|canyon\b/, 'canyon'], [/\bcave\b/, 'cave'], [/\btemple|shrine|pagoda|mosque|church|cathedral\b/, 'temple'], [/\bcastle|palace|fortress|citadel\b/, 'castle'], [/\btower|lighthouse\b/, 'tower'], [/\bhouse|dwelling|shelter|hut|home\b/, 'hut'], [/\bpark|garden\b/, 'garden'], [/\bmarket|bazaar\b/, 'market'], [/\bstation\b/, 'station'], [/\bmuseum\b/, 'museum'], [/\blibrary\b/, 'library'], [/\bstadium|arena\b/, 'arena'], [/\bruins|monument|landmark\b/, 'ruins'], [/\bregion|country|province|state|district\b/, 'town'], [/\bbuilding|structure\b/, 'tower']];
  const ICON_DEFAULTS = [[/\bdessert|cake|pastry|sweet\b/, 'cake'], [/\bbread|dish|food|cuisine|snack|sandwich|taco|noodle|soup\b/, 'bread'], [/\bfruit\b/, 'fruit'], [/\bvegetable\b/, 'carrot'], [/\bdrink|beverage|tea|coffee\b/, 'cup'], [/\bmushroom|fungus|fungi\b/, 'mushroom'], [/\bflower|flowering\b/, 'flower'], [/\bplant|tree|shrub|herb|moss|fern|grass|vine|seaweed\b/, 'leaf'], [/\bfirearm|gun|rifle|pistol|cannon\b/, 'gun'], [/\bsword|blade|weapon|spear|axe\b/, 'sword'], [/\bbow|arrow\b/, 'bow'], [/\bshield|armou?r\b/, 'shield'], [/\bmusical|instrument\b/, 'music'], [/\bairship|aircraft|balloon|blimp\b/, 'balloon'], [/\bship|boat|vessel\b/, 'flag'], [/\btoy|doll|puppet\b/, 'teddy'], [/\bgame|ball\b/, 'ball'], [/\bgarment|clothing|cloth|robe|dress\b/, 'cloth'], [/\bhat|helmet|cap\b/, 'hat'], [/\bjewel|necklace|pendant\b/, 'amulet'], [/\bring\b/, 'ring'], [/\bgem|gemstone|crystal|mineral|jade\b/, 'gem'], [/\bmetal|ore\b/, 'ore'], [/\bcoin|currency\b/, 'coin'], [/\bbook|manuscript|document\b/, 'book'], [/\bmap|chart\b/, 'map'], [/\bclock|watch|timepiece\b/, 'clock'], [/\blamp|lantern|light\b/, 'lantern'], [/\bcontainer|jar|pot|vessel|urn\b/, 'jar'], [/\bkey\b/, 'key'], [/\bmask\b/, 'mask'], [/\bmachine|engine|device|robot|computer\b/, 'gear'], [/\btool|implement|utensil|equipment\b/, 'tool']];
  const ARCH_DEFAULTS = [[/\bslime|ooze|blob|jelly\b/, 'slime'], [/\bspirit|ghost|phantom|wraith|witch|sorcer|magic|shaman\b/, 'caster'], [/\bgiant|ogre|troll|golem|colossal|huge|enormous\b/, 'brute'], [/\bwinged|bird|flying|bat|harpy|insect\b/, 'flyer'], [/\bserpent|dragon|beast|wolf|hound|dog|cat|lizard|animal|creature with\b/, 'beast']];
  // nouns that name an idea or an activity, not something you could meet, visit or hold
  const ABSTRACT = /^(technique|method|process|season|concept|idea|practice|style|term|word|name|period|era|event|activity|sport|discipline|field|study|science|art|genre|emotion|feeling|state|condition|quality|phenomenon|action|act|behaviou?r|theory|system|language|unit|number|colou?r|time|day|month|year|festival|holiday|celebration|tradition|custom|religion|belief|philosophy|movement|organi[sz]ation|institution|law|crime|offence|offense|game|competition|ceremony|ritual|process|principle|field|trade|industry|transportation|transport|communication|relationship|status|team|people|ethnic|nationality|disease|disorder|symptom|injury|medication|drug|virus|chemical|compound|element|protein|hormone|process|programming|software|format|protocol|algorithm|equation|mathematics|music|dance|film|story|tale|myth|legend|character)$|^[a-z]{4,}(tion|sion|ness|ism|logy|graphy)$/;
  // "Family of seabirds" -> seabirds, "Tower containing a source of light" -> tower, "Raised walkway over water" -> walkway
  function headOf(desc) {
    let d = String(desc || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 3; i++) { const m = d.match(/^(?:[a-z-]+\s+){0,3}?(?:family|subfamily|genus|species|subspecies|group|type|kind|class|order|breed|variety|form|sort|piece|set|pair|range|chain|body|member|item|article)\s+of\s+(?:the\s+|a\s+|an\s+)?(.*)$/); if (m && m[1]) d = m[1]; else break; }
    const cut = d.split(/\s(?:of|used|that|which|who|whose|where|in|for|from|with|by|containing|consisting|made|found|native|produced|located|on|at|to|over|between|known|and|or|built|designed|typically|usually|commonly|often|worn|eaten|served|named|near|under|is|are|was|were|endemic|originating|traditionally|associated|belonging|living|growing)\s/)[0];
    let ws = cut.split(/\s+/).filter(Boolean);
    // "Person learning a trade" -> person: a describing -ing/-ed word after the noun ends it
    const k = ws.findIndex((w, i) => i > 0 && /[a-z]{3,}(ing|ed)$/.test(w));
    if (k > 0) ws = ws.slice(0, k);
    return (ws[ws.length - 1] || '').replace(/^[a-z]+-/, '');
  }
  // "A cage is an enclosure often made of mesh" -> "enclosure often made of mesh"
  const firstIs = (ext) => { const m = String(ext || '').match(/^[^.]{0,80}?\b(?:is|are|was|were)\s+(?:a|an|the|any)\s+([^.]{3,120})/i); return m ? m[1] : ''; };
  const pickBy = (table, text, dflt) => { for (const [re, v] of table) if (re.test(text)) return v; return dflt; };

  function classify(word, page) {
    const LIB = RPG.LIB, S = RPG.Story;
    const desc = String(page.description || '').toLowerCase();
    const ext = String(page.extract || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const low = (desc + ' . ' + ext.toLowerCase()).slice(0, 600);
    if (!desc && !ext) return null;
    if (/\b(may refer to|refers to|disambiguation|can mean|given name|surname|family name)\b/.test(low)) return null;
    // a real, named human being ("American singer (born 1958)") is not a kind of thing to put in a story
    if (/\((?:born|b\.)\s|\(\d{3,4}\s*[–-]\s*\d{3,4}\)|\b(?:born|died) (?:in )?\d{3,4}\b/.test(String(page.extract || '').slice(0, 200) + ' ' + desc)) return null;
    if (/\b(singer|actor|actress|politician|footballer|rapper|musician|songwriter|businessman|businesswoman|athlete|journalist|novelist|youtuber|comedian|entrepreneur|television presenter|band|album|song|film|novel|tv series|television series|video game|magazine|newspaper|company|brand|software|website|sports team|football club)\b/.test(desc)) return null;
    let cat = null;
    if (CUES[0][1].test(desc)) cat = 'monster';
    // otherwise go by the head noun of the description: "Enclosure used to confine animals" is an enclosure
    const head = headOf(desc || firstIs(ext));
    if (!cat && head) {
      if (ABSTRACT.test(head)) return null;
      const hs = S.singular(head);
      // "seabirds" is a kind of bird, "lighthouse" a kind of house
      for (let i = 0; !cat && i <= hs.length - 3; i++) {
        const w = hs.slice(i);
        cat = LIB.ANIMALS[w] ? 'animal' : LIB.ROLES[w] && !LIB.ROLES[w].hostile ? 'person' : LIB.PLACES[w] ? 'place' : LIB.OBJECTS[w] ? 'object' : null;
        if (!cat) for (const [c, re] of CUES) if (re.test(w) || (i === 0 && re.test(head))) { cat = c; break; }
      }
    }
    if (!cat) for (const [c, re] of CUES) if (re.test(desc)) { cat = c; break; }
    if (!cat && !desc) for (const [c, re] of CUES) if (re.test(low)) { cat = c; break; }
    if (!cat) return null;
    if (page.proper && cat === 'person') return null;
    // the first word in the description that the library already knows decides how it looks
    const dWords = desc.match(/[a-z]+/g) || [];
    const words = (desc + ' ' + ext.toLowerCase()).match(/[a-z]+/g) || [];
    const self = word.toLowerCase();
    const findIn = (tbl, ws, ok) => { for (const w of ws) { if (w === self || w.length < 3) continue; const sg = S.singular(w); const e = tbl[w] || tbl[sg]; if (e && (!ok || ok(e))) return tbl[w] ? w : sg; } return null; };
    const best = (tbl, defaults, dflt, ok) => findIn(tbl, dWords, ok) || (desc && pickBy(defaults, desc, null)) || findIn(tbl, words.slice(0, 40), ok) || pickBy(defaults, low, dflt);
    const color = (() => { for (const w of words.slice(0, 60)) if (LIB.COLORS[w]) return LIB.COLORS[w]; return null; })();
    const sentence = firstSentence(ext);
    const out = { word: self, display: page.proper ? page.title.replace(/\s*\(.*\)$/, '') : cap(self), cat, color, fact: sentence, source: page.title };
    if (cat === 'animal') out.base = best(LIB.ANIMALS, ANIMAL_DEFAULTS, 'dog');
    else if (cat === 'monster') { out.arch = pickBy(ARCH_DEFAULTS, low, 'humanoid'); const kin = findIn(LIB.ANIMALS, words.slice(0, 40)); if (kin && (out.arch === 'beast' || out.arch === 'flyer')) out.animal = kin; }
    else if (cat === 'person') out.base = findIn(LIB.ROLES, dWords, (e) => !e.hostile) || (/\b(monk|priest|clergy|religious)\b/.test(low) ? 'priest' : /\b(warrior|soldier|military|mercenary|fighter|nobility)\b/.test(low) ? 'knight' : /\b(merchant|trader|seller)\b/.test(low) ? 'merchant' : findIn(LIB.ROLES, words.slice(0, 40), (e) => !e.hostile) || 'stranger');
    else if (cat === 'place') out.base = best(LIB.PLACES, PLACE_DEFAULTS, 'ruins', (e) => e.cat !== 'room');
    else { out.cat = 'object'; const o = findIn(LIB.OBJECTS, dWords); out.icon = o ? LIB.OBJECTS[o].icon : pickBy(ICON_DEFAULTS, desc, null) || (findIn(LIB.OBJECTS, words.slice(0, 40)) && LIB.OBJECTS[findIn(LIB.OBJECTS, words.slice(0, 40))].icon) || pickBy(ICON_DEFAULTS, low, 'box'); }
    // which world it belongs to: "Fourth planet from the Sun" leans sci-fi, "Japanese castle" doesn't care
    const scores = {};
    for (const [k, th] of Object.entries(RPG.THEMES)) { let n = 0; for (const kw of th.keywords) if (!kw.includes(' ') && words.includes(kw)) n++; scores[k] = n; }
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) out.theme = top[0];
    return out;
  }

  // a character the AI called "glassmaker" is a person even though Wikipedia files it under glassblowing
  function forceKind(L, c, p) {
    const LIB = RPG.LIB, S = RPG.Story;
    const low = (String(p.description || '') + ' ' + String(p.extract || '')).toLowerCase();
    const base = L || { word: c.word.toLowerCase(), display: cap(c.word.toLowerCase()), color: null, fact: factOf(p), source: p.title };
    const want = c.kind;
    if (want === 'person' && L && ['person', 'animal', 'monster'].includes(L.cat)) return L;
    if (want === 'place' && L && L.cat === 'place') return L;
    if (want === 'object' && L && (L.cat === 'object' || L.cat === 'plant')) return L;
    const out = Object.assign({}, base, { cat: want === 'object' ? 'object' : want });
    delete out.arch; delete out.animal; delete out.theme;
    const ws = low.match(/[a-z]+/g) || [];
    const first = (tbl, ok) => { for (const w of ws.slice(0, 50)) { const e = tbl[w] || tbl[S.singular(w)]; if (e && (!ok || ok(e))) return tbl[w] ? w : S.singular(w); } return null; };
    if (want === 'person') out.base = first(LIB.ROLES, (e) => !e.hostile) || (/\b(glass|metal|wood|stone|leather|craft|maker|smith)\b/.test(low) ? 'blacksmith' : 'stranger');
    else if (want === 'place') out.base = first(LIB.PLACES, (e) => e.cat !== 'room') || pickBy(PLACE_DEFAULTS, low, 'ruins');
    else { const o = first(LIB.OBJECTS); out.icon = o ? LIB.OBJECTS[o].icon : pickBy(ICON_DEFAULTS, low, 'box'); }
    if (out.base && !LIB.ROLES[out.base] && want === 'person') out.base = 'stranger';
    return out;
  }

  // the first sentence, or a clean cut at a word with "…" when it runs on
  function firstSentence(ext) {
    const m = ext.match(/^.{20,300}?[.!?](?=\s|$)/);
    if (m) return m[0];
    if (ext.length <= 240) return ext;
    return ext.slice(0, 240).replace(/[\s,;:–—-]+\S*$/, '') + '…';
  }
  function factOf(p) {
    return firstSentence(String(p.extract || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim());
  }
  // ---------- teach the library ----------
  function apply(learned) {
    const LIB = RPG.LIB, S = RPG.Story;
    if (!learned || !LIB) return;
    for (const L of Object.values(learned)) {
      if (!L || !L.word || L.cat === 'known') continue;
      const w = L.word, pl = S.pluralize(w).toLowerCase();
      const keys = L.proper ? [w] : [w, pl];
      if (L.cat === 'animal') { const b = LIB.ANIMALS[L.base] || LIB.ANIMALS.dog; for (const k of keys) LIB.ANIMALS[k] = Object.assign({}, b, { word: w, display: L.display, color: L.color || b.color }); }
      else if (L.cat === 'monster') {
        const color = L.color || S.colorFor(w);
        for (const k of keys) RPG.MONSTERS[k] = [L.arch || 'humanoid', color];
        if (L.animal && LIB.ANIMALS[L.animal]) { const b = LIB.ANIMALS[L.animal]; LIB.ANIMALS[w] = Object.assign({}, b, { word: w, display: L.display, color, hostile: 1 }); }
        else LIB.ROLES[w] = { word: w, k: 'monster', age: 'adult', display: L.display, voice: 'gruff', hostile: 1, look: { skin: color, shirt: RPG.color.darken(color, 0.3) } };
      } else if (L.cat === 'person') { const b = LIB.ROLES[L.base] || LIB.ROLES.stranger || {}; for (const k of keys) LIB.ROLES[k] = Object.assign({}, b, { word: w, display: L.display }); }
      else if (L.cat === 'place') { const b = LIB.PLACES[L.base] || LIB.PLACES.ruins; for (const k of keys) LIB.PLACES[k] = Object.assign({}, b, { word: L.proper ? L.display : w }); }
      else if (L.cat === 'object') { for (const k of keys) LIB.OBJECTS[k] = { word: w, icon: L.icon || 'box', color: L.color || S.colorFor(w) }; }
      if (L.theme && ['place', 'animal', 'monster'].includes(L.cat) && RPG.THEMES[L.theme] && !RPG.THEMES[L.theme].keywords.includes(w)) RPG.THEMES[L.theme].keywords.push(w);
    }
  }

  // ---------- network + cache ----------
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function writeCache(c) {
    try {
      const keys = Object.keys(c);
      if (keys.length > 600) for (const k of keys.slice(0, keys.length - 600)) delete c[k];
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }
  async function fetchPages(titles, signal) {
    const url = `${API}?action=query&format=json&formatversion=2&origin=*&prop=extracts%7Cdescription%7Cpageprops&ppprop=disambiguation&exintro=1&explaintext=1&exsentences=2&exlimit=20&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`;
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const q = data.query || {};
    // follow Wikipedia's renames (lowercase → Capitalised, plurals → redirects)
    const map = {};
    for (const t of titles) map[t] = t;
    for (const n of q.normalized || []) for (const t of titles) if (map[t] === n.from) map[t] = n.to;
    for (const n of q.redirects || []) for (const t of titles) if (map[t] === n.from) map[t] = n.to;
    const pages = Array.isArray(q.pages) ? q.pages : Object.values(q.pages || {});
    const byTitle = {};
    for (const p of pages) byTitle[p.title] = p;
    const out = {};
    for (const t of titles) { const p = byTitle[map[t]]; out[t] = p && !p.missing && !p.invalid && !(p.pageprops && 'disambiguation' in p.pageprops) ? p : null; }
    return out;
  }

  const Web = {
    isOn() { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch (e) { return true; } },
    setOn(v) { try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch (e) {} },
    apply,
    classify,
    // facts for the game: [{ word, display, fact, source }]
    facts(learned) { return Object.values(learned || {}).filter((L) => L && L.fact && L.fact.length > 30 && !/may refer to|refers to/.test(L.fact)).map((L) => ({ word: L.word, display: L.display, fact: L.fact, source: L.source })); },
    // look up the story's things on Wikipedia; resolves to { learned, looked, failed }
    // every noun in the story is looked up (Wikipedia is the library); words the built-in
    // library already draws get a fact, words it has never seen also get a new entry
    async learn(text, opts = {}) {
      const S = RPG.Story, LIB = RPG.LIB;
      const seen = new Set();
      const cands = [];
      const add = (c) => { const k = c.proper ? c.word : c.word.toLowerCase(); if (!seen.has(k) && cands.length < (opts.max || 60)) { seen.add(k); cands.push(c); } };
      const hints = opts.hints || {};
      const fold = S.fold || ((x) => x);
      // people's names are not looked up ("Odile" is a ballet role on Wikipedia, not the glassmaker)
      const names = new Set();
      for (const h of [...(hints.characters || []), { name: hints.hero }, { name: hints.villain }]) for (const w of (fold(h && h.name || '').match(/[A-Za-z]+/g) || [])) if (/^[A-Z]/.test(w)) names.add(w);
      // what the AI says each character, place and item is ("stern glassmaker" -> glassmaker)
      // the AI already knows whether it's a person, a place or a thing; Wikipedia says what it looks like
      const heads = new Set(), mods = new Set();
      const kinds = [['person', hints.characters], ['place', hints.places], ['object', hints.items]];
      for (const [kind, list] of kinds) for (const h of list || []) {
        const ws = fold(h.is || '').toLowerCase().match(/[a-z]+/g) || [];
        const head = ws[ws.length - 1];
        ws.slice(0, -1).forEach((w) => { if (!(LIB.ANIMALS[w] || LIB.ROLES[w] || LIB.PLACES[w] || LIB.OBJECTS[w] || RPG.MONSTERS[w])) mods.add(w); });
        if (head && head.length > 3 && !/^(man|woman|girl|boy|person|people|thing|things|place|places|one|kid|guy|lady|stuff|area)$/.test(head)) { heads.add(head); add({ word: S.singular(head), proper: false, n: 2, first: 0, kind }); }
      }
      for (const h of heads) mods.delete(h);
      const o = { skip: [...names], heads, mods };
      for (const c of S.unknownWords(text, 40, o)) add(c);
      for (const c of S.unknownWords(text, 80, Object.assign({ all: true }, o))) add(c);
      const cache = readCache();
      const learned = {}, need = [];
      for (const c of cands) {
        const k = c.proper ? c.word : c.word.toLowerCase();
        if (k in cache) { if (cache[k]) learned[k] = cache[k]; } else need.push(c);
      }
      let failed = false;
      if (need.length && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => ctl && ctl.abort(), opts.timeout || 7000);
        try {
          const titles = need.map((c) => (c.proper ? c.word : cap(c.word)));
          const pages = {};
          const groups = [];
          for (let i = 0; i < titles.length; i += 20) groups.push(titles.slice(i, i + 20));
          for (const r of await Promise.all(groups.map((g) => fetchPages(g, ctl && ctl.signal)))) Object.assign(pages, r);
          need.forEach((c, i) => {
            const k = c.proper ? c.word : c.word.toLowerCase();
            const p = pages[titles[i]];
            let L = p ? classify(c.word, Object.assign({ proper: c.proper }, p)) : null;
            // the AI said what it is in the story; trust that over Wikipedia's other meanings
            if (p && c.kind) L = forceKind(L, c, p);
            const lw = c.word.toLowerCase();
            const knownHere = !c.proper && (LIB.ANIMALS[lw] || LIB.ROLES[lw] || LIB.PLACES[lw] || LIB.OBJECTS[lw] || RPG.MONSTERS[lw]);
            // the library already knows how to draw it: keep that, add what Wikipedia says about it
            if (knownHere && p) L = { word: lw, display: cap(lw), cat: 'known', fact: L ? L.fact : factOf(p), source: p.title };
            if (L) { L.proper = c.proper; if (c.proper) L.word = lw; learned[k] = L; }
            cache[k] = L || 0;
          });
          writeCache(cache);
        } catch (e) { failed = true; }
        clearTimeout(timer);
      }
      return { learned, looked: cands.length, failed };
    },
  };
  RPG.Web = Web;
})();
