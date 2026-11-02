# Tale Forge: step inside any story

Type any text and play it as a top-down 2D RPG. It can be a one-line idea, a fairy tale, a diary entry, a D&D campaign or a chapter of your novel. Your characters become people you can talk to, and they say the lines you wrote for them. Your places become a world you can walk through, with buildings you can go inside. Each event in the story becomes a chapter you play.

Leave the box blank to get a brand-new story invented on the spot.

Everything runs in the browser, so there is no server, no account, no API key and no build step. It works offline.

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

Double-click `index.html`. It opens and plays straight from your computer.

---

## How your text becomes a game

```
your text ─► story.js reads it, using library.js ─► a story blueprint ─► worldgen.js builds the world ─► game.js lets you live it
```

**`library.js` is the knowledge base.** It's a big set of tables describing how things look, sound and behave. It covers 60+ kinds of places (over 300 words, from *cottage* and *bakery* to *space station* and *haunted crypt*), 29 kinds of outdoor area, 14 furnished interiors and 16 building styles. There are 90+ roles (mom, wizard, baker, robot, pirate captain…) with their clothes and way of talking, nearly 40 animals, and 70+ kinds of objects with icons (over 300 words). It also holds verbs for every kind of action, colors, hair, moods, weather, dialogue for each kind of character, and plot patterns for growing short ideas into full stories. Add words to it and the game understands more.

**`story.js` reads your text** sentence by sentence:

| In your text | In the game |
|---|---|
| "I woke up…", "You are Mira…", "a girl named Tess…" | Who **you** play. First-person and second-person stories put you in the main role directly |
| Mom, King Aldric, a sly wolf, my dog Biscuit, Mrs. Patel the baker | **Characters** with their own look, voice and home. Animals look like animals |
| "Take these to your grandmother," said Mom. | That character **says that line** to you, in the scene where it happens |
| the village, the dark forest, Grandma's cottage, the bakery, the Goblin Caves | **Places**: outdoor areas, buildings with furnished interiors, dungeons, landmarks. They're laid out in the order the story visits them |
| gave her a basket, bought bread, stole the crown, found the key | **Items** you receive, carry, deliver and find |
| went to, met, asked, gave, found, collected, fought, rescued, escaped, fixed | **Chapters**: go somewhere, talk to someone, receive or deliver something, find or collect things, defeat enemies or a boss, rescue someone, escape, use or look at something |
| the wolf, the sorcerer, the robots, crows, goblins | **Villains, bosses and enemies**, each fighting in its own way |
| rain, night, fog, snow, sunset | **Weather and time of day** for that chapter |
| desert, pirate, space station, haunted, volcano, school, farm, jungle | One of **15 world styles** |

Every sentence you wrote appears in the game, in order, as narration or dialogue, so playing it really is like stepping into your story. Very short ideas ("a cat who wants to become a knight") are grown into a full plot from the library's plot patterns. Long texts become longer adventures.

The same text always builds the same world, because the text is the random seed. That's why share links work.

---

## Playing

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | Left thumb (virtual stick) |
| Attack | Space or J | ⚔ |
| Talk / open / use / choose | E or Enter | E (or tap the dialog box) |
| Drink potion | H | ♥ |
| Map | M | M |
| Journal (the story so far) | L | ☰ → Journal |
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
| `story.js` | Reads your text and turns it into characters, places, items and chapters |
| `worldgen.js` | Builds the overworld, building interiors and dungeons around the story |
| `art.js` | Draws every tile, character, animal, item and monster in code (no image files) |
| `game.js` | The game: movement, combat, dialogue, the chapter engine, saving, map and HUD |
| `app.js` | The home page: examples, continue, share links |

No libraries, no build tools. Plain HTML, CSS and JavaScript.

## Notes

- Saves live in your browser (localStorage). Clearing site data deletes them.
- Very long texts work. Reading a whole novel chapter takes a moment, and you get a long game.
- If a story comes out strange, add a little detail: who the main character is, where they go, and what they want.
