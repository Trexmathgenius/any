/* ai.js — an AI that runs entirely inside your browser (WebLLM + WebGPU). No API key, no account,
   no server: the model is downloaded once (about 1–2 GB), cached by the browser, and then reads
   your story on your own graphics card. It works out the plot, splits it into chapters, names
   who's who and what every place and thing is, and writes extra in-character lines. Wikipedia
   (web.js) is the library it draws on; the game engine builds the world from what it writes.
   If the browser can't run it, the built-in story reader takes over automatically. */
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const LIB_URLS = ['https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.83/+esm', 'https://esm.run/@mlc-ai/web-llm@0.2.83'];
  const PREF_ON = 'taleforge_ai_on', PREF_SIZE = 'taleforge_ai_size', PREF_READY = 'taleforge_ai_ready';
  const MODELS = {
    better: { f16: ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-3B-Instruct-q4f16_1-MLC', 'Phi-3.5-mini-instruct-q4f16_1-MLC'], f32: ['Llama-3.2-3B-Instruct-q4f32_1-MLC', 'Qwen2.5-3B-Instruct-q4f32_1-MLC'] },
    faster: { f16: ['Llama-3.2-1B-Instruct-q4f16_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'], f32: ['Llama-3.2-1B-Instruct-q4f32_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'] },
  };
  const SETTINGS = ['fantasy', 'desert', 'ice', 'undead', 'scifi', 'pirate', 'fire', 'swamp', 'modern', 'city', 'countryside', 'jungle', 'whimsy', 'wasteland', 'alien'];
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const AI = {
    engine: null, modelId: null, lib: null, loading: null,
    isOn() { return pref(PREF_ON, '1') === '1'; },
    setOn(v) { setPref(PREF_ON, v ? '1' : '0'); },
    size() { return pref(PREF_SIZE, 'better'); },
    setSize(v) { setPref(PREF_SIZE, v); },
    wasReady() { return pref(PREF_READY, '') !== ''; },

    // can this browser run it?
    async check() {
      if (!('gpu' in navigator) || !navigator.gpu) return { ok: false, reason: 'This browser has no WebGPU. Use a recent Chrome or Edge on a computer.' };
      if (!window.isSecureContext) return { ok: false, reason: 'The AI needs the page to be served over https (GitHub Pages is fine).' };
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) return { ok: false, reason: 'No usable graphics card was found for WebGPU.' };
        const f16 = adapter.features && adapter.features.has('shader-f16');
        return { ok: true, f16, maxBuffer: adapter.limits ? adapter.limits.maxBufferSize : 0 };
      } catch (e) { return { ok: false, reason: 'WebGPU is blocked here (' + e.message + ').' }; }
    },
    async lib_() {
      if (this.lib) return this.lib;
      let err;
      for (const u of LIB_URLS) { try { this.lib = await import(u); return this.lib; } catch (e) { err = e; } }
      throw new Error('Could not download the AI library (' + (err && err.message) + ').');
    },
    async pickModel(f16) {
      const lib = await this.lib_();
      const have = new Set(((lib.prebuiltAppConfig && lib.prebuiltAppConfig.model_list) || []).map((m) => m.model_id));
      const order = [...MODELS[this.size()] ? MODELS[this.size()][f16 ? 'f16' : 'f32'] : [], ...MODELS.faster[f16 ? 'f16' : 'f32'], ...MODELS.faster.f32];
      const id = order.find((m) => have.has(m)) || order[0];
      const rec = ((lib.prebuiltAppConfig && lib.prebuiltAppConfig.model_list) || []).find((m) => m.model_id === id);
      return { id, mb: rec && rec.vram_required_MB ? Math.round(rec.vram_required_MB) : null };
    },
    // download (first time) and start the model; onProgress(fraction, text)
    async load(onProgress) {
      if (this.engine) return this.engine;
      if (this.loading) return this.loading;
      this.loading = (async () => {
        const chk = await this.check();
        if (!chk.ok) throw new Error(chk.reason);
        const lib = await this.lib_();
        const { id } = await this.pickModel(chk.f16);
        const engine = await lib.CreateMLCEngine(id, { initProgressCallback: (r) => onProgress && onProgress(typeof r.progress === 'number' ? r.progress : 0, String(r.text || '')) });
        this.engine = engine; this.modelId = id;
        setPref(PREF_READY, id);
        return engine;
      })();
      try { return await this.loading; } finally { this.loading = null; }
    },
    // give the graphics-card memory back; the downloaded files stay cached, so the next story reloads quickly
    async unload() {
      const e = this.engine; this.engine = null;
      try { if (e && e.interruptGenerate) e.interruptGenerate(); } catch (x) {}
      try { if (e && e.unload) await e.unload(); } catch (x) {}
    },

    async chat(messages, opts = {}) {
      const req = { messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.max_tokens || 900 };
      if (opts.json) req.response_format = opts.schema ? { type: 'json_object', schema: JSON.stringify(opts.schema) } : { type: 'json_object' };
      let r;
      try { r = await this.engine.chat.completions.create(req); }
      catch (e) { if (opts.schema) { delete req.response_format.schema; r = await this.engine.chat.completions.create(req); } else throw e; }
      if (this.engine.resetChat) { try { await this.engine.resetChat(); } catch (e) {} }
      return String((r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    },

    // ---------- reading a story ----------
    // returns { script, hints } — script is the story retold as "## Chapter" blocks the engine reads reliably
    async read(text, onStep, cancelled) {
      const raw = String(text || '').trim();
      const words = (raw.match(/\S+/g) || []).length;
      const firstPerson = povFirst(raw);
      const step = (t, f) => onStep && onStep(t, f);
      const stop = () => { if (cancelled && cancelled()) throw new Error('cancelled'); };
      let script = raw;
      if (words >= 120) {
        const parts = chunk(raw, 4800);
        const totalCh = Math.max(4, Math.min(12, Math.round(3 + words / 220)));
        let notes = '';
        const out = [];
        for (let i = 0; i < parts.length; i++) {
          stop();
          step(parts.length > 1 ? `Reading your story (part ${i + 1} of ${parts.length})…` : 'Reading your story…', i / (parts.length + 1));
          const k = Math.max(1, Math.round(totalCh * parts[i].length / raw.length));
          const hero = firstPerson ? 'I (first person, as in the story)' : 'the main character, by name';
          const res = await this.chat([
            { role: 'system', content: REWRITE_RULES.replace('{HERO}', hero) },
            { role: 'user', content: `${parts.length > 1 ? `This is part ${i + 1} of ${parts.length} of the story.` : ''}${notes ? `\nWho and where so far: ${notes}` : ''}\nWrite about ${k} chapter${k > 1 ? 's' : ''} for this part.\n\nSTORY:\n${parts[i]}` },
          ], { max_tokens: 260 + k * 170, temperature: 0.3 });
          const seg = cleanScript(res, parts[i], i);
          out.push(seg);
          notes = castNotes(out.join('\n'));
        }
        script = out.join('\n\n');
      }
      stop();
      step('Working out who\'s who…', parts_done(words));
      let hints = {};
      try {
        const js = await this.chat([
          { role: 'system', content: CAST_RULES },
          { role: 'user', content: `STORY:\n${script.slice(0, 7000)}` },
        ], { json: true, schema: CAST_SCHEMA, max_tokens: 900, temperature: 0.2 });
        hints = sanitizeHints(parseJSON(js));
      } catch (e) { hints = {}; }
      return { script, hints, model: this.modelId, firstPerson };
    },
  };
  const parts_done = (w) => (w >= 120 ? 0.85 : 0.5);

  const REWRITE_RULES = `You turn stories into scripts for a 2D adventure game. Follow every rule.
1. Keep the story's own events, names and order. Never invent a different plot. Leave out small details.
2. Split it into chapters. Start each chapter with a line beginning "## " and a short title of 2 to 5 words.
3. Under each title write 3 to 7 short sentences in the past tense, one event per sentence.
4. Each chapter needs one clear thing the hero does: goes to a place, talks to someone, receives or gives an item, finds or collects something, fights enemies, defeats a villain, rescues someone, escapes somewhere, or uses or fixes something.
5. Say where things happen: "went to Duskhold Castle", "in the Whispering Woods". Every place gets a name that ends with what it is, like Castle, Cave, Forest, Village, Tower, Lake, School, Ship or House.
6. The first time a character appears, say what they are: "Brenna, the old blacksmith," or "a sly fox named Pip". The first time a villain appears, call them "the evil ...".
7. Keep the most important spoken lines as quotes and say who said them: "We must hurry," said Brenna.
8. Write about the hero as {HERO}.
Write only the chapters, nothing else.`;

  const CAST_RULES = `You read a story and list who and what is in it, as JSON.
- "hero": the main character's name ("I" if the story is told by "I").
- "villain": the main enemy's name, or "" if there is none.
- "setting": the best match from this list: ${SETTINGS.join(', ')}.
- "title": a short title for the story. "ending": one sentence that ends the story.
- "characters": up to 10 people or animals (not the hero). For each: "name", "is" (2 to 4 words saying what they are, like "old blacksmith" or "talking fox" or "evil sorcerer"), "side" ("friend", "enemy" or "neutral"), and "lines": two short things they might say, in their own voice, that fit the story.
- "places": up to 10. For each: "name" and "is" (2 to 4 words, like "stone castle" or "dark forest" or "small bakery").
- "items": up to 8 important objects. For each: "name" and "is" (2 to 4 words).
Only use names that appear in the story.`;

  const CAST_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string' }, hero: { type: 'string' }, villain: { type: 'string' }, setting: { type: 'string', enum: [...SETTINGS, 'other'] }, ending: { type: 'string' },
      characters: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, is: { type: 'string' }, side: { type: 'string', enum: ['friend', 'enemy', 'neutral'] }, lines: { type: 'array', items: { type: 'string' } } }, required: ['name', 'is', 'side', 'lines'] } },
      places: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, is: { type: 'string' } }, required: ['name', 'is'] } },
      items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, is: { type: 'string' } }, required: ['name', 'is'] } },
    },
    required: ['title', 'hero', 'villain', 'setting', 'ending', 'characters', 'places', 'items'],
  };

  // ---------- helpers (also used by the tests) ----------
  function povFirst(raw) {
    const t = raw.replace(/["“][^"”]*["”]/g, ' ');
    const first = (t.match(/\b(I|my|me|myself)\b/g) || []).length;
    const third = (t.match(/\b(he|she|they|his|her|their)\b/gi) || []).length;
    return first >= 3 && first > third * 0.6;
  }
  // split long text into pieces at paragraph (then sentence) boundaries
  function chunk(raw, max) {
    const paras = raw.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    const out = [];
    let cur = '';
    const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
    for (const p of paras) {
      if (p.length > max) {
        push();
        const sents = p.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g) || [p];
        for (const s of sents) { if ((cur + s).length > max) push(); cur += s; }
        push();
        continue;
      }
      if ((cur + '\n\n' + p).length > max) push();
      cur += (cur ? '\n\n' : '') + p;
    }
    push();
    return out.length ? out : [raw];
  }
  // make sure a model answer really is a chapter script; otherwise keep the original words
  function cleanScript(res, original, i) {
    let s = String(res || '').replace(/```[a-z]*\n?/g, '').replace(/\r/g, '').trim();
    // small models like to chat around the answer: "Sure! Here is the script:" … "Let me know if…"
    const CHAT = /^\s*(?:(?:sure|okay|certainly|of course|absolutely|alright)[!,.](?:\s.*)?|(?:here(?:'s| is| are)|below (?:is|are)|this is)\b.*:\s*|(?:let me know|i hope|hope this|feel free|note:|if you(?:'d| would) like|i(?:'ve| have) (?:kept|written|rewritten|made|tried))\b.*)$/i;
    s = s.split('\n').filter((l) => !CHAT.test(l)).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+(?=\S)/, '')).join('\n');
    s = s.replace(/^\s*(?:#{1,6}|\*\*)\s*(?:chapter\s+\d+\s*[:.\-–]\s*)?([^\n*#]+?)\**\s*$/gim, (m, t) => '## ' + t.trim());
    s = s.replace(/^\s*chapter\s+(\d+|[a-z]+)\s*[:.\-–]\s*(.+)$/gim, (m, n, t) => '## ' + t.trim());
    s = s.replace(/^## (.+?):\s*$/gm, '## $1').replace(/\*\*/g, '');
    const heads = (s.match(/^## .+$/gm) || []).length;
    const sents = (s.replace(/^## .+$/gm, '').match(/[.!?]["”']?(\s|$)/g) || []).length;
    // names the story uses a lot should survive the retelling
    const names = [...new Set((original.match(/\b[A-Z][a-z]{2,}\b/g) || []).filter((w, k, a) => a.indexOf(w) !== a.lastIndexOf(w) && !/^(The|And|But|When|Then|She|He|They|There|This|That|What|Where|Why|How|After|Before|Once|One|Now|Her|His|It|In|On|At|As|So|If|We|You|My|Our|Your|Its)$/.test(w)))];
    const kept = names.filter((n) => s.includes(n)).length;
    const good = heads >= 1 && sents >= 3 && (names.length < 2 || kept >= Math.ceil(names.length * 0.4));
    if (!good) return `## Part ${i + 1}\n${original}`;
    if (!/^## /.test(s)) s = `## Part ${i + 1}\n` + s;
    return s;
  }
  function castNotes(script) {
    const found = [];
    const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s+(?:the|a|an)\s+([a-z][a-z ]{2,30}?)[,.]/g;
    let m;
    while ((m = re.exec(script)) && found.length < 12) found.push(`${m[1]} (${m[2].trim()})`);
    const pl = [...new Set((script.match(/\b(?:[A-Z][a-z]+\s+){1,2}(?:Castle|Cave|Caves|Forest|Woods|Village|Town|City|Tower|Lake|River|School|Ship|House|Temple|Mountain|Mountains|Island|Station|Palace|Inn|Tavern|Shop|Swamp|Desert|Valley|Ruins|Mine|Mines|Bakery|Library|Park|Farm)\b/g) || []).map((x) => x.trim()))].slice(0, 10);
    return [...found, ...pl].join('; ').slice(0, 600);
  }
  function parseJSON(s) {
    s = String(s || '').replace(/```[a-z]*\n?/g, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('no json');
    const body = s.slice(a, b + 1);
    try { return JSON.parse(body); } catch (e) {
      // forgive the usual slips: trailing commas, curly quotes
      return JSON.parse(body.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'));
    }
  }
  const str = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n || 80);
  function sanitizeHints(j) {
    if (!j || typeof j !== 'object') return {};
    const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
    const h = {
      title: str(j.title, 60), hero: str(j.hero, 40), villain: str(j.villain, 40), ending: str(j.ending, 240),
      theme: SETTINGS.includes(String(j.setting || '').toLowerCase()) ? String(j.setting).toLowerCase() : '',
      characters: arr(j.characters, 12).map((c) => ({ name: str(c && c.name, 40), is: str(c && c.is, 40).toLowerCase(), side: /enemy|friend|neutral/.test(c && c.side) ? c.side : 'neutral', lines: arr(c && c.lines, 3).map((l) => str(l, 140)).filter(Boolean) })).filter((c) => c.name && c.name.length > 1),
      places: arr(j.places, 12).map((p) => ({ name: str(p && p.name, 40), is: str(p && p.is, 40).toLowerCase() })).filter((p) => p.name),
      items: arr(j.items, 10).map((p) => ({ name: str(p && p.name, 40), is: str(p && p.is, 40).toLowerCase() })).filter((p) => p.name),
    };
    if (/^(i|me|myself|you)$/i.test(h.hero)) h.hero = '';
    if (h.villain && h.villain.toLowerCase() === h.hero.toLowerCase()) h.villain = '';
    return h;
  }
  AI._test = { chunk, cleanScript, castNotes, parseJSON, sanitizeHints, povFirst, REWRITE_RULES, CAST_RULES };
  RPG.AI = AI;
})();
