# Mass Productions website

## Look at it

Open `public/index.html` in your browser. That folder is the finished website.

## What's where

| Folder / file | What it is | Do you edit it? |
|---|---|---|
| `content/studio.json` | Studio name, email, Discord, footer links | Yes |
| `content/games.json` | Purrspective's text and media, and the jam game cards | Yes |
| `content/updates/` | Everything for the Updates lists. One folder per category: `purrspective/`, `news/`, and any you add | Yes |
| `design/` | Colours and layout (`styles.css`), fonts, images, videos, press kit | Sometimes |
| `source-files/` | Full-size originals of images and fonts. Not part of the website | No |
| `build.mjs` | Turns `content/` + `design/` into `public/` | No |
| `public/` | The finished website. Rebuilt from scratch every time | Never by hand |

After changing anything, rebuild the website:

- **Windows:** double-click `build-website.bat`.
- **Linux:** run `./build-website.sh` (or `node build.mjs`) in this folder.

The only thing you need is [Node.js](https://nodejs.org) (the LTS version), installed once.

## Updates

Everything in the Updates lists lives in `content/updates/`, sorted into folders. Each folder is one category:

```
content/updates/purrspective/   update notes for Purrspective
content/updates/news/           announcements
```

- The **Updates** list on the homepage shows every folder mixed together by date. Each row gets a small label with its folder's name.
- A folder named after a game is that game's **Update log**, shown at the bottom of the game's page. Purrspective uses `purrspective/`.
- Both lists start with the newest three. "Show more" opens the list a page at a time (as many rows as fit on the screen, four to ten), with Newer and Older buttons to flip between pages. Pressing a row opens it.

### Write a game update

Make a new file in the game's folder, named after the version:

```
content/updates/purrspective/v0.14.0.md
```

Inside: the date on the first line, an optional one-line summary, then the list of changes:

```
2026-11-20
Rain, snow and puddles you can splash in.

+ Rain and snow
+ Puddles
- Old fog effect
* Faster loading
```

- It shows as **Update v0.14.0**.
- The summary shows under the title. Without it the row shows something like "8 new, 1 removed, 2 improved".
- Start each line with `+` for something added, `-` for something removed, or `*` for something improved or redesigned. Keep them in that order: additions first, then removals, then improvements.
- `— [improved]` / `— [removed]` at the end of a line mark things that were reworked or cut later.
- To add detail under a change, put it on the next line and indent it with a tab or spaces. It shows smaller, underneath that change.
- To fix an old update, edit its file; to remove one, delete its file.

### Write an announcement

Make a new file in `content/updates/news/` with any name that is not a version number:

```
content/updates/news/new-website.md
```

Inside: the date on the first line, the title on the second, then the text:

```
2026-11-20
The website got a new look

Everything is hand-drawn now.

A blank line starts a new paragraph. You can add a [link](https://example.com).
```

A file like this works in any folder. Put one in `purrspective/` and it shows in Purrspective's update log too, as a post between the version updates.

### Add a new category

Make a new folder in `content/updates/` and put files in it. That is all: it shows up on the homepage with its own label.

- The name shown is the folder's name with a capital letter: `devlog/` shows as "Devlog", `behind-the-scenes/` as "Behind the scenes".
- For a new game, name the folder after the game's `slug` in `content/games.json`. The name shown is then the game's title, and the folder is used as that game's update log.

## Add a jam game

Copy one of the `"type": "jam"` entries in `content/games.json`, change the title, `cardText`, `url` (its itch.io page) and `cover`, and put the cover image in `design/images/`. If the cover is cut off badly, add `"coverPosition": "center top"` (or a percentage like `"center 30%"`).

## Images and video

Keep the site fast:

- Use **WebP** images at the size they're shown: covers about 640px wide, screenshots 1600px plus a `-small` copy at 640px (the small one shows on the page, the big one opens when clicked).
- The homepage gameplay loop is a short silent clip in two versions: `.webm` (smaller) and `.mp4` (works everywhere). Keep it under about 1 MB.

## Put it online

Upload the **contents** of `public/` to any static host (GitHub Pages, Cloudflare Pages, Netlify, or your own server). Once it has an address, put it in `"url"` in `content/studio.json` and rebuild: link previews, search engines and the "page not found" page then use it.

## Tracking wishlists from your videos

Steam links on the site carry tags, so Steamworks' UTM report shows which button was clicked. When you link to the site from a video, add a tag like `?utm_source=youtube&utm_campaign=scaling-trailer`; the site passes it on to Steam.
