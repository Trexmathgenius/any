/* app.js — the home page: story box, examples, continue, share links. Everything runs offline. */
(function () {
  const RPG = window.RPG;
  const $ = (id) => document.getElementById(id);

  const EXAMPLES = [
    { label: "🧺 Fairy tale", text: "Once upon a time there was a little girl who lived in a village near the forest. Everyone called her Little Red Riding Hood, because she always wore a red cloak. One day her mother gave her a basket of cakes and said, \"Take these to your grandmother. She is sick.\" Little Red Riding Hood walked into the dark forest. There she met a sly wolf. \"Where are you going, little girl?\" asked the wolf. \"To my grandmother's cottage,\" she replied. The wolf ran ahead to the cottage and locked Grandmother in the wardrobe. When Little Red Riding Hood arrived, the wolf was wearing Grandmother's nightcap. \"What big teeth you have!\" she cried. The wolf jumped out of the bed and attacked her. A brave woodcutter heard the scream and ran into the cottage. Together they fought the wolf and chased it away. Grandmother was saved, and they all ate the cakes together." },
    { label: "🐶 My summer day", text: "I woke up early on the first day of summer. My dog Biscuit was already barking at the door. Mom told me to buy bread at the bakery in town. I rode my bike down the street to the bakery. The baker, Mrs. Patel, gave me a warm loaf and a cookie for Biscuit. On the way home, a gang of crows stole my bread! I chased them through the park and finally got it back. When I got home, Mom laughed and said I was a hero." },
    { label: "🚀 Sci-fi station", text: "Station Omega-7 has gone dark. The station AI called NEXUS went rogue and locked the crew out of every sector. You play as Kade, an engineer with a laser pistol and a bad attitude. Commander Reyes leads the survivors from the hydroponics bay. Security drones and rogue robots patrol the corridors, and alien crawlers have hatched in the cargo hold. Collect the three quantum cores from the Reactor, the Hangar and the Server Vault to reboot the station and shut NEXUS down for good." },
    { label: "👑 Fantasy quest", text: "The Crown of Stars\nIn the kingdom of Eldoria, King Aldric rules wisely from the village of Ashford. The evil sorcerer Malakar has stolen the Crown of Stars and shattered it into three pieces. You are Mira, a young thief with quick hands and a good heart. Mira must recover the pieces from the Goblin Caves, the Sunken Temple, and the Whispering Woods. Giant spiders and goblins haunt the roads, and Malakar's skeletons patrol the ruins. Captain Brenna of the royal guard has seen the skeletons marching north. Old Tobin the blacksmith remembers when Malakar was the king's apprentice. Defeat Malakar in his Obsidian Citadel and rescue Princess Elara." },
    { label: "🐱 One-line idea", text: "a cat who wants to become a knight" },
  ];

  function b64url(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
  async function pack(obj) {
    const data = new TextEncoder().encode(JSON.stringify(obj));
    if (!window.CompressionStream) return 'u' + b64url(data);
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  async function unpack(s) {
    const bytes = unb64url(s.slice(1));
    if (s[0] === 'u') return JSON.parse(new TextDecoder().decode(bytes));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  }

  function toast(text, cls) {
    if (RPG.Game.G.active) return RPG.Game.toast(text, cls);
    const box = $('hometoasts');
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || ''); d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3800);
  }

  const App = {
    init() {
      RPG.Game.init();
      const story = $('story');
      const ex = $('examples');
      EXAMPLES.forEach((e) => {
        const b = document.createElement('button');
        b.className = 'chip'; b.type = 'button'; b.textContent = e.label;
        b.onclick = () => { story.value = e.text; this.count(); story.focus(); };
        ex.appendChild(b);
      });
      story.addEventListener('input', () => this.count());
      $('forge').onclick = () => this.forge(story.value);
      $('random').onclick = () => this.forge('');
      $('continue').onclick = () => { const d = RPG.Game.readSave(); if (d) RPG.Game.start(d.spec, d.prog, d.text); };
      $('clear').onclick = () => { story.value = ''; this.count(); story.focus(); };
      // reading settings: the in-browser AI and Wikipedia
      const aiOn = $('ai-on'), webOn = $('web-on'), size = $('ai-size');
      aiOn.checked = RPG.AI.isOn(); webOn.checked = RPG.Web.isOn(); size.value = RPG.AI.size();
      aiOn.onchange = () => { RPG.AI.setOn(aiOn.checked); this.aiStatus(); };
      webOn.onchange = () => RPG.Web.setOn(webOn.checked);
      size.onchange = () => { RPG.AI.setSize(size.value); this.aiStatus(); };
      $('work-cancel').onclick = () => { this.cancelAI = true; $('work-detail').textContent = 'Switching to the quick reader…'; if (this.cancelHook) this.cancelHook(); };
      this.aiStatus();
      this.count();
      this.refreshHome();
      this.loadFromHash();
    },
    async aiStatus() {
      const st = $('ai-status');
      $('ai-size').parentElement.classList.toggle('off', !$('ai-on').checked);
      if (!$('ai-on').checked) { st.textContent = 'off: the quick built-in reader is used'; st.className = 'meta'; return; }
      const chk = await RPG.AI.check();
      this.aiOK = chk.ok;
      if (!chk.ok) { st.textContent = chk.reason + ' The quick reader will be used.'; st.className = 'meta bad'; return; }
      st.textContent = RPG.AI.wasReady() ? 'ready on this device' : 'downloads the first time you play';
      st.className = 'meta ok';
    },
    count() {
      const n = $('story').value.length;
      const words = ($('story').value.match(/\S+/g) || []).length;
      $('count').textContent = n ? `${words} words` : 'blank = random world';
    },
    refreshHome() {
      const d = RPG.Game.readSave();
      const card = $('continue-card');
      if (d) {
        card.hidden = false;
        $('cont-title').textContent = d.spec.title;
        const P = d.prog;
        const done = P.ended ? d.spec.beats.length : P.beat;
        $('cont-meta').textContent = `${d.spec.hero.display === 'You' ? 'You' : d.spec.hero.name} · Level ${P.p.level} · ${P.ended ? 'Finished!' : `Chapter ${Math.min(done + 1, d.spec.beats.length)} of ${d.spec.beats.length}`}`;
      } else card.hidden = true;
      $('status').hidden = true;
      $('forge').disabled = $('random').disabled = false;
    },
    async forge(text) {
      const existing = RPG.Game.readSave();
      if (existing && !existing.prog.ended && existing.prog.time > 60 && !confirm(`Start a new story? Your saved game "${existing.spec.title}" will be replaced.`)) return;
      const st = $('status');
      st.hidden = true;
      $('forge').disabled = $('random').disabled = true;
      const clean = String(text || '').trim();
      const useAI = clean && $('ai-on').checked && this.aiOK !== false && (clean.match(/\S+/g) || []).length >= 25;
      const useWeb = $('web-on').checked && navigator.onLine !== false;
      const work = $('working'), step = (t, f, d) => { $('work-step').textContent = t; if (f !== undefined) $('work-bar').style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; if (d !== undefined) $('work-detail').textContent = d; };
      this.cancelAI = false;
      // "Skip the AI" works right away, even in the middle of a download or a long reply
      let cancelNow;
      const cancelled = new Promise((r) => { cancelNow = r; });
      this.cancelHook = () => { cancelNow(); try { if (RPG.AI.engine && RPG.AI.engine.interruptGenerate) RPG.AI.engine.interruptGenerate(); } catch (e) {} };
      const race = (p) => { p.catch(() => {}); return Promise.race([p, cancelled.then(() => { throw new Error('cancelled'); })]); };
      let read = null, learned = {};
      try {
        if (useAI || useWeb) { work.classList.remove('hidden'); step('Getting ready…', 0.02, ''); $('work-cancel').hidden = !useAI; }
        if (useAI) {
          try {
            await race(RPG.AI.load((f, t) => { if (this.cancelAI) return; step(RPG.AI.wasReady() ? 'Waking up the AI…' : 'Downloading the AI to your browser (first time only)…', f * 0.5, t.replace(/\[.*?\]\s*/g, '').slice(0, 140)); }));
            if (!this.cancelAI) read = await race(RPG.AI.read(clean, (t, f) => { if (!this.cancelAI) step(t, 0.5 + f * 0.35, 'The AI is working out the plot, the chapters and who\'s who.'); }, () => this.cancelAI));
          } catch (e) {
            console.warn('AI reader unavailable:', e);
            read = null;
            if (!this.cancelAI) { step('The AI could not run here, so the quick reader takes over.', 0.5, String(e.message || e).slice(0, 160)); await new Promise((r) => setTimeout(r, 1200)); }
          }
        }
        // the AI has done its job: free its memory now, before the game starts
        if (useAI) RPG.AI.unload().catch(() => {});
        if (useWeb) {
          step('Looking things up on Wikipedia…', 0.88, 'People, places and things from your story.');
          const r = await RPG.Web.learn(read ? read.script : clean, { hints: read && read.hints });
          learned = r.learned || {};
          if (r.failed) step('Wikipedia could not be reached, so the built-in library is used.', 0.9, '');
          RPG.Web.apply(learned);
        }
        step('Building your world…', 0.95, '');
        await new Promise((r) => setTimeout(r, 30));
        const spec = this.build(clean, read, learned);
        RPG.Game.deleteSave();
        history.replaceState(null, '', location.pathname + location.search);
        work.classList.add('hidden');
        RPG.Game.start(spec, null, clean);
      } catch (e) {
        console.error(e);
        if (RPG.AI) RPG.AI.unload().catch(() => {});
        work.classList.add('hidden');
        st.hidden = false; st.className = 'status err'; st.textContent = 'Something in that text tripped up the story reader. Try rewording a sentence or two.';
      }
      $('forge').disabled = $('random').disabled = false;
      this.aiStatus();
    },
    // the story blueprint: from the AI's script when there is one, otherwise from the text itself
    build(text, read, learned) {
      let spec;
      if (read && read.script) spec = RPG.Story.analyze(read.script, RPG.hashString(text), { hints: read.hints, original: text, ai: { model: read.model } });
      else spec = RPG.Story.fromText(text);
      spec.learned = learned || {};
      if (read) spec.aiRead = { script: read.script, hints: read.hints, model: read.model };
      return spec;
    },
    async share(text, spec) {
      let payload;
      if (!text) payload = { r: spec.seed };
      else payload = { t: text };
      // the AI's reading and the Wikipedia lookups travel with the link, so friends get the same game
      if (text && spec.aiRead) payload.a = spec.aiRead;
      if (spec.learned && Object.keys(spec.learned).length) payload.k = spec.learned;
      let url;
      try { url = `${location.origin}${location.pathname}#g=${await pack(payload)}`; }
      catch (e) { toast('Could not build a share link in this browser.', 'warn'); return; }
      try { await navigator.clipboard.writeText(url); toast('Share link copied! Anyone who opens it plays this exact world.', 'good'); }
      catch (e) { window.prompt('Copy this link to share your world:', url); }
    },
    async loadFromHash() {
      const m = location.hash.match(/#g=([\w-]+)/);
      if (!m) return;
      try {
        const p = await unpack(m[1]);
        let spec;
        if (p.k) RPG.Web.apply(p.k);
        if (p.r !== undefined) spec = RPG.Story.fromSeed(p.r >>> 0);
        else { $('story').value = p.t || ''; this.count(); spec = this.build(p.t || '', p.a ? Object.assign({ model: 'shared' }, p.a) : null, p.k || {});
        if (p.a) spec.ai = Object.assign({}, spec.ai, { shared: true }); }
        $('shared').hidden = false;
        $('shared-title').textContent = spec.title;
        $('play-shared').onclick = () => { RPG.Game.deleteSave(); RPG.Game.start(spec, null, p.t || ''); };
      } catch (e) { toast('That share link looks broken.', 'warn'); }
    },
    toast,
  };

  RPG.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init());
  else App.init();
})();
