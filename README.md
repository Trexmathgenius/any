# Tale Forge: step inside any story

Type any text and play it as a top-down 2D RPG. It can be a one-line idea, a fairy tale, a diary entry, a D&D campaign or a chapter of your novel. Your characters become people you can talk to, and they say the lines you wrote for them. Your places become a world you can walk through, with buildings you can go inside. Each event in the story becomes a chapter you play.

Leave the box blank to get a brand-new story invented on the spot.

**Wikipedia is the library, and an AI running inside your browser puts it together.** The AI reads your story for its plot, its pacing and who's who. Wikipedia tells the game what every person, place, creature and thing in it actually is. There's no API key, no account and no server. Your story never leaves your computer; only single words like "axolotl" are sent to Wikipedia.

If the AI can't run on a device, or there's no internet, the built-in reader and library take over automatically, so the game always works.

---

## Put it online with GitHub Pages (about 5 minutes, no coding)

1. **Sign in** at [github.com](https://github.com). A free account is fine.
2. Click **+** (top right) → **New repository**. Name it something like `tale-forge`, set it to **Public**, and click **Create repository**.
3. On the empty repository page, click the **uploading an existing file** link.
4. **Unzip** `tale-forge.zip` on your computer and open the `tale-forge` folder. Select **all the files inside it** (not the folder itself) and drag them onto the upload page. Click **Commit changes**.
   - `index.html` has to be at the top level of the repository, not inside a subfolder.
5. Go to the repository's **Settings** → **Pages** (left sidebar).
6. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then click **Save**.
7. Wait a minute or two, then refresh the Pages settings. Your link appears at the top:
   `https://YOUR-USERNAME.github.io/tale-forge/`

That link is your game. Anyone who opens it can type a story and play.

To update it later, upload the changed files the same way. GitHub replaces files that have the same name.

### Try it before uploading

Double-click `index.html`. It opens and plays straight from your computer using the built-in reader. The in-browser AI needs the page to come from a web address, so use your GitHub Pages link for that.

---

## How your text becomes a game

```
your text ─► the AI (in your browser) works out the plot, chapters and cast
          ─► Wikipedia says what each person, place, creature and thing is
          ─► story.js turns that into a blueprint ─► worldgen.js builds the world ─► game.js lets you live it
```

### 1. The AI reads your story (`ai.js`)

A small language model runs inside your browser tab using your graphics card (WebGPU). It's downloaded once the first time you press **Play my story**, then the browser keeps it, so later stories start in seconds. Nothing is sent to an AI company and there's no key.

For any story of about 25 words or more, the AI:

- **finds the plot**: it splits long stories into scenes and rewrites them into short, clear "game script" chapters, keeping your own names, places and spoken lines;
- **keeps the pacing**: a short story gets 4 chapters, a long one up to 12, and each chapter's cutscene shows the moments that matter most (everything stays in the journal);
- **works out the cast**: the hero, the villain, who's a friend and who's an enemy, what each person is ("stern glassmaker", "giant gull king"), the important places and objects, the world style, and how the story ends.

Long texts are read in pieces, with the AI carrying notes on who and where from one piece to the next.

| Setting (home page) | What it does |
|---|---|
| **AI reads my story** | On by default. Turn it off to use only the quick built-in reader |
| **Better understanding** | Llama 3.2 3B, about a 2 GB download, once. Best for long or complex stories |
| **Faster** | Llama 3.2 1B, about a 1 GB download, once. For older or slower computers |

**What it needs:** a recent desktop **Chrome or Edge** (version 113+) on a computer with a reasonably modern graphics card, and the page served over https (GitHub Pages is). Firefox and Safari are adding WebGPU but may not run it yet. Phones and tablets usually can't. On those, the game quietly uses the built-in reader instead. Reading a long story can take a minute or two; there's a **Skip the AI** button if you're in a hurry.

### 2. Wikipedia is the library (`web.js`)

Every noun in your story, plus whatever the AI said each character, place and item is, is looked up on Wikipedia (free, no key). The game reads each article's short description and works out what the thing is and how to draw it:

- *axolotl*: a kind of salamander → an animal, drawn from the salamander template
- *Kyoto*: a city in Japan → a city to visit
- *wendigo*: a creature from folklore → a monster to fight
- *igloo*: a shelter made of snow → a little dwelling, and the world leans icy
- *glassmaker* (a character the AI found) → a craftsperson with a shop

It also keeps each article's first sentence. Characters mention these facts in conversation, bookshelves and computers show them, and the **Journal** gets a "Things in this story" page with a link to each article. Wikipedia text is CC BY-SA.

Only single words are sent, never your story. Results are cached in your browser, so repeat words are instant and work offline.

### 3. The built-in reader and library (`story.js`, `library.js`)

These are the always-available fallback and the foundation underneath the AI. `library.js` holds the sprite templates and defaults: 60+ kinds of places, 90+ roles, nearly 40 animals, 70+ kinds of objects, 15 world styles, plus verbs, moods, weather, dialogue and plot patterns for growing one-line ideas into full stories. Wikipedia adds to it each time you play.

`story.js` turns the AI's script (or your raw text) into the game:

| In your text | In the game |
|---|---|
| "I woke up…", "You are Mira…", "a girl named Tess…" | Who **you** play. First-person and second-person stories put you in the main role directly |
| Mom, King Aldric, a sly wolf, my dog Biscuit, Mrs. Patel the baker | **Characters** with their own look, voice and home. Animals look like animals |
| "Take these to your grandmother," said Mom. | That character **says that line** to you, in the scene where it happens |
| the village, the dark forest, Grandma's cottage, the Goblin Caves | **Places**: outdoor areas, buildings with furnished interiors, dungeons, landmarks, laid out in story order |
| gave her a basket, bought bread, stole the crown, found the key | **Items** you receive, carry, deliver and find |
| went to, met, asked, gave, found, fought, rescued, escaped, fixed | **Chapters**: go somewhere, talk, receive or deliver, find or collect, defeat enemies or a boss, rescue, escape, use or look at something |
| the wolf, the sorcerer, the robots, crows, goblins | **Villains, bosses and enemies**, each fighting in its own way |
| rain, night, fog, snow, sunset | **Weather and time of day** for that chapter |

Actions are handled by the AI, not Wikipedia: it rewrites whatever happens in your story ("she bartered for passage", "he deciphered the runes") into the game's chapter types, while your original wording still appears in the cutscenes.

The same text always builds the same world, because the text is the random seed. Share links carry the AI's reading and the Wikipedia results with them, so a friend gets your exact game even without the AI or an internet connection.

---

## Playing

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | Left thumb (virtual stick) |
| Attack | Space or J | ⚔ |
| Talk / open / use / choose | E or Enter | E (or tap the dialog box) |
| Drink potion | H | ♥ |
| Map | M | M |
| Journal (the story so far, facts, your original text) | L | ☰ → Journal |
| Menu (save, share, sound) | Esc | ☰ |
| Skip a long scene | Esc | tap through |

- The bar at the top says what happens next in the story, and the **yellow arrow** points the way. A **!** marks the person you need.
- Walk into buildings through their doors. Caves lead to dungeons.
- **Beds and campfires** heal you and save the game. The game also autosaves at every chapter and doorway.
- Shops sell potions and better gear. Some characters have side quests.
- **Share**: Menu → *Copy share link*. The link holds your whole story, so anyone who opens it plays the same world.

---

## Files

| File | What it does |
|---|---|
| `index.html` | The page: story box, game screen, menus |
| `style.css` | How the page looks |
| `rng.js` | Seeded randomness, so the same story always makes the same world |
| `themes.js` | The 15 world styles (colors, enemies, gear, currency), character classes and enemy types |
| `library.js` | The knowledge base: places, interiors, roles, animals, objects, verbs, dialogue and plot patterns |
| `story.js` | Turns the AI's script (or your raw text) into characters, places, items and chapters |
| `web.js` | Looks up your story's words on Wikipedia and teaches the library what they are |
| `ai.js` | Runs the in-browser AI (WebLLM) that reads the plot, pacing and cast |
| `worldgen.js` | Builds the overworld, building interiors and dungeons around the story |
| `art.js` | Draws every tile, character, animal, item and monster in code (no image files) |
| `game.js` | The game: movement, combat, dialogue, the chapter engine, saving, map and HUD |
| `app.js` | The home page: examples, AI and Wikipedia settings, progress screen, continue, share links |

No build tools. Plain HTML, CSS and JavaScript. The only outside code is [WebLLM](https://github.com/mlc-ai/web-llm) (Apache-2.0), fetched from a CDN only when the AI is used.

## Notes

- Saves live in your browser (localStorage). Clearing site data deletes them. The downloaded AI is stored by the browser too; clearing site data removes it, and it re-downloads next time.
- Very long texts work. With the AI on, a novel chapter takes a minute or two to read and becomes up to 12 chapters.
- If a story comes out strange, add a little detail: who the main character is, where they go, and what they want. Or switch the AI to **Better understanding**.
- Privacy: the AI runs on your machine. Wikipedia only ever sees single words. Nothing else leaves the page.
