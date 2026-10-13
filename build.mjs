// Mass Productions website builder.
//
//   node build.mjs
//
// Reads  content/  (text, games, update notes) and  design/  (styles, images, videos),
// and writes the finished website to  public/ . Upload the contents of public/ to your host.
// Needs Node.js 18 or newer. Nothing to install.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const DESIGN = path.join(ROOT, 'design');
const PUBLIC = path.join(ROOT, 'public');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const studio = readJson('studio.json');
const games = readJson('games.json');
const mainGame = games.find((g) => g.type === 'main');
const jams = games.filter((g) => g.type === 'jam');
// Everything that can show in an updates list, newest first, from every folder in content/updates/.
const feedItems = readFeed();
const feedFor = (folder) => feedItems.filter((u) => u.folder === folder);

// ---------- helpers ----------

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(CONTENT, name), 'utf8'));
}

// Escape text for HTML.
function esc(s) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Paths in the content files are relative to design/; on the website they live in assets/.
function asset(p) {
	return `assets/${p}`;
}

// Full web address, used for link previews once studio.url is filled in.
function fullUrl(p) {
	return studio.url ? studio.url.replace(/\/$/, '') + '/' + p : p;
}

// Links that leave the site open in a new tab. Steam links also get a UTM tag,
// so Steamworks' UTM report shows which button people clicked.
function external(url, button = '') {
	let href = url;
	if (button && /store\.steampowered\.com/.test(url)) {
		href += (url.includes('?') ? '&' : '?') + `utm_source=website&utm_medium=web&utm_campaign=${encodeURIComponent(button)}`;
	}
	return `href="${esc(href)}" target="_blank" rel="noopener"`;
}
const newTabNote = '<span class="sr-only"> (opens in a new tab)</span>';

// Small bits of text formatting allowed in update notes: **bold**, *italic*, [link](url).
function formatText(s) {
	return esc(s)
		.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function slugify(s) {
	return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------- updates ----------
// Every folder inside content/updates/ is one category: "purrspective", "news", or any new one you make.
// A folder named after a game (its "slug" in games.json) is that game's update log, and is labelled with the game's name.
// Two kinds of file can go in any folder:
//   v0.1.0.md      an update, named after its version. Inside: the date (2026-05-31), an optional one-line summary, then the changes:
//                    + something added
//                    - something removed
//                    * something improved or redesigned
//                  An indented line under a change is extra detail for it.
//                  Add "— [improved]" or "— [removed]" at the end of a line for things reworked or cut later.
//   anything.md    a post. Inside: the date on the first line, the title on the second, then the text.
//                  A blank line starts a new paragraph. **bold**, *italic* and [link](url) work.

function changeHtml({ mark, text, details = [] }) {
	const CHANGE_KINDS = { '+': 'added', '-': 'removed', '*': 'improved' };
	const CHANGE_MARKS = { '+': '+', '-': '−', '*': '*' };
	let t = text.trim();
	let note = '';
	const tag = t.match(/\s*[—–-]\s*\[(improved|removed)\]\s*$/i);
	if (tag) {
		t = t.slice(0, tag.index);
		note = tag[1].toLowerCase() === 'improved' ? 'improved later' : 'later removed';
	}
	return `<li class="${CHANGE_KINDS[mark]}"><span class="change-mark">${CHANGE_MARKS[mark]}</span><span>${formatText(t)}${note ? ` <em>(${note})</em>` : ''}${details.map((d) => `<span class="change-detail">${formatText(d)}</span>`).join('')}</span></li>`;
}

// Turn "2026-05-31" into "31 May 2026" (anything else is shown as written).
function formatDate(text) {
	const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : text;
}

// Compare versions like "0.10.0" and "0.9.0" by their numbers, newest first.
function newestVersionFirst(a, b) {
	const pa = a.version.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
	const pb = b.version.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
	}
	return 0;
}

// The name shown for a folder: the game's title if it is a game's folder, otherwise the folder name ("news" -> "News").
function folderLabel(folder) {
	const game = games.find((g) => g.slug === slugify(folder));
	if (game) return game.title;
	const words = folder.replace(/[-_]+/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function readVersionNote(text, version) {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const isoDate = lines.length && !/^[-+*]\s/.test(lines[0].trim()) ? lines.shift().trim() : '';
	const summary = [];
	const changes = [];
	for (const raw of lines) {
		const line = raw.trim();
		const item = line.match(/^([-+*])\s+(.*)$/);
		// An indented line is extra detail for the change above it (any + - * in front of it is dropped).
		if (/^\s/.test(raw) && changes.length) changes[changes.length - 1].details.push(item ? item[2] : line);
		else if (item) changes.push({ mark: item[1], text: item[2], details: [] });
		else if (!changes.length) summary.push(line);
	}
	const count = (mark) => changes.filter((c) => c.mark === mark).length;
	const counts = [[count('+'), 'new'], [count('-'), 'removed'], [count('*'), 'improved']];
	return {
		version,
		title: `Update v${version}`,
		isoDate,
		date: formatDate(isoDate),
		shortText: summary.join(' ') || counts.filter(([n]) => n).map(([n, word]) => `${n} ${word}`).join(', '),
		bodyHtml: `<ul class="change-list">${changes.map(changeHtml).join('')}</ul>`,
	};
}

function readPost(text, fallbackTitle) {
	const lines = text.split(/\r?\n/).map((l) => l.trim());
	while (lines.length && !lines[0]) lines.shift();
	const isoDate = lines.shift() || '';
	while (lines.length && !lines[0]) lines.shift();
	const title = lines.shift() || fallbackTitle;
	const paragraphs = lines.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
	return {
		version: '',
		title,
		isoDate,
		date: formatDate(isoDate),
		shortText: '',
		bodyHtml: paragraphs.map((p) => `<p>${formatText(p)}</p>`).join(''),
	};
}

function readFeed() {
	const dir = path.join(CONTENT, 'updates');
	if (!fs.existsSync(dir)) return [];
	const list = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			if (/\.md$/i.test(entry.name)) console.warn(`Skipped content/updates/${entry.name}: it needs to be inside a folder, like content/updates/${mainGame.slug}/`);
			continue;
		}
		const folder = slugify(entry.name);
		const isGame = games.some((g) => g.slug === folder);
		for (const file of fs.readdirSync(path.join(dir, entry.name))) {
			if (!/\.md$/i.test(file)) continue;
			const name = file.replace(/\.md$/i, '');
			const text = fs.readFileSync(path.join(dir, entry.name, file), 'utf8');
			// "v0.1.0" or "0.1.0" is an update; any other name is a post.
			const version = name.match(/^v(\d[\w.-]*)$/i) || name.match(/^(\d+(?:\.\d+)+[\w.-]*)$/);
			const item = version ? readVersionNote(text, version[1]) : readPost(text, name);
			list.push({ ...item, id: slugify(`${folder}-${name}`), folder, style: isGame ? 'game' : 'news', label: folderLabel(entry.name) });
		}
	}
	// Newest first. Two updates of the same game on the same day go by version number.
	return list.sort((a, b) => {
		if (a.isoDate !== b.isoDate) return a.isoDate < b.isoDate ? 1 : -1;
		return a.folder === b.folder && a.version && b.version ? newestVersionFirst(a, b) : 0;
	});
}

// ---------- page frame (head, header, footer) ----------

const icons = {
	moon: '<svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="icon-a" d="M20 14.5 C19.56 15.19 18.57 17.66 17.36 18.62 C16.16 19.57 14.36 20.06 12.78 20.24 C11.2 20.41 9.24 20.38 7.9 19.65 C6.56 18.92 5.45 17.29 4.76 15.88 C4.07 14.48 3.66 12.76 3.76 11.22 C3.86 9.67 4.41 7.82 5.36 6.62 C6.32 5.42 8.81 4.44 9.5 4 C9.12 4.68 7.43 6.6 7.18 8.05 C6.93 9.5 7.27 11.44 7.99 12.69 C8.72 13.94 10.21 14.9 11.53 15.56 C12.86 16.22 14.51 16.85 15.92 16.67 C17.34 16.49 19.32 14.86 20 14.5 Z"/><path class="icon-b" d="M20 14.5 C19.53 15.14 18.36 17.41 17.16 18.36 C15.96 19.31 14.31 19.99 12.78 20.19 C11.24 20.39 9.37 20.22 7.95 19.55 C6.54 18.87 4.99 17.53 4.28 16.14 C3.56 14.75 3.49 12.79 3.67 11.21 C3.86 9.63 4.41 7.84 5.38 6.63 C6.35 5.43 8.81 4.44 9.5 4 C9.22 4.69 8.06 6.69 7.79 8.15 C7.52 9.6 7.28 11.48 7.89 12.74 C8.5 14.01 10.1 15.16 11.43 15.76 C12.76 16.36 14.44 16.54 15.87 16.33 C17.3 16.12 19.31 14.8 20 14.5 Z"/></svg>',
	sun: '<svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="icon-a" d="M16 12 C16.01 12.94 15.52 14.22 14.85 14.85 C14.18 15.48 12.97 15.78 12 15.8 C11.03 15.82 9.73 15.61 9.02 14.98 C8.32 14.34 7.75 12.96 7.78 12 C7.82 11.04 8.53 9.88 9.24 9.24 C9.94 8.6 11.07 8.17 12 8.17 C12.93 8.17 14.12 8.57 14.79 9.21 C15.45 9.85 15.99 11.06 16 12 Z M19.89 12.31 L21.76 12.38 M17.74 17.89 L19.13 19.32 M12.42 19.84 L12.52 21.69 M6.44 17.8 L5.01 19.29 M4.29 11.85 L1.69 11.8 M5.78 6.68 L4.1 5.24 M11.16 3.8 L10.95 1.67 M17.46 6.18 L18.82 4.73"/><path class="icon-b" d="M16 12 C16.02 12.96 15.62 14.35 14.96 14.96 C14.29 15.57 12.99 15.67 12 15.67 C11.01 15.67 9.73 15.59 9.02 14.98 C8.31 14.37 7.73 12.97 7.76 12 C7.78 11.03 8.44 9.8 9.15 9.15 C9.85 8.49 11.06 8.07 12 8.08 C12.94 8.08 14.14 8.53 14.81 9.19 C15.48 9.84 15.98 11.04 16 12 Z M19.96 12.07 L21.62 12.08 M18.02 17.16 L19.3 18.27 M11.44 20.17 L11.3 22.31 M6.49 18.08 L4.96 19.75 M3.99 12.22 L1.75 12.28 M6.33 6.53 L4.46 4.73 M11.2 3.89 L11.01 2.03 M17.68 6.49 L18.87 5.34"/></svg>',
	pause: '<svg class="icon-pause" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
	// Two hand-drawn versions of the download arrow; hovering the Press kit link swaps between them, like the other wobbles.
	download: '<span class="download-icon" aria-hidden="true"><svg class="icon-download dl-a" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.6 3.2 C12.5 5.6 11.4 8.4 12.3 11.1 C12.7 12.6 12.1 14.2 12.4 15.8 M6.6 10.6 C8.4 11.9 10.2 13.6 12.6 16.3 M11.9 16.1 C13.4 14.1 15.2 12.6 17.6 10.2 M4.1 15.4 C4.6 17 4.2 18.8 5.1 20.4 C8.6 19.7 11.9 20.9 15.4 20.1 C16.8 19.8 18.2 20.6 19.4 20.1 C19.6 18.6 19.1 17.3 19.7 15.9"/></svg><svg class="icon-download dl-b" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.6 3.6 C11.6 6.1 12.8 8.7 11.8 11.4 C11.5 13 12.2 14.4 11.7 15.6 M7.2 10.1 C9.1 11.8 10.4 13.9 12.2 15.9 M12.3 16.2 C13.7 14.5 15.9 12.8 17.1 11.1 M4.6 15.8 C4.2 17.4 4.9 18.7 4.6 20.2 C8.2 20.6 11.6 19.6 15.1 20.4 C16.6 20.7 17.9 19.9 19.6 20.3 C19.2 18.9 19.8 17.4 19.2 15.6"/></svg></span>',
	play: '<svg class="icon-play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
};

function page({ file, title, description, image, body, onHomepage = false, currentNav = '', structuredData = null, rootBase = false }) {
	const fullTitle = title ? `${title} — ${studio.name}` : studio.name;
	const desc = description || studio.description;
	const shareImage = image || asset('images/share-image.jpg');
	const home = onHomepage ? '' : 'index.html';
	const isCurrent = (name) => (currentNav === name ? ' aria-current="page"' : '');
	const pageUrl = file ? fullUrl(file === 'index.html' ? '' : file) : '';
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	${rootBase ? (studio.url ? `<base href="${esc(studio.url.replace(/\/?$/, '/'))}">` : `<script>if (location.protocol !== 'file:') document.write('<base href="/">');</script>`) : ''}
	<title>${esc(fullTitle)}</title>
	<meta name="description" content="${esc(desc)}">
	<meta property="og:title" content="${esc(fullTitle)}">
	<meta property="og:description" content="${esc(desc)}">
	<meta property="og:image" content="${esc(fullUrl(shareImage))}">
	<meta property="og:type" content="website">
	<meta name="twitter:card" content="summary_large_image">
	${studio.url && file ? `<link rel="canonical" href="${esc(pageUrl)}">\n\t<meta property="og:url" content="${esc(pageUrl)}">` : ''}
	${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>` : ''}
	<meta name="theme-color" content="#F1D3A8">
	<link rel="icon" href="${asset('images/favicon.svg')}" type="image/svg+xml">
	<link rel="apple-touch-icon" href="${asset('images/apple-touch-icon.png')}">
	<link rel="stylesheet" href="${asset('styles.css')}">
	<script>
		(function () {
			var theme = null;
			try { theme = localStorage.getItem('theme'); } catch (e) {}
			if (!theme) theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			document.documentElement.setAttribute('data-theme', theme);
		})();
	</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
	<div class="wrap">
		<a class="logo bold" href="index.html">${esc(studio.name)}</a>
		<div class="header-right">
			<nav class="nav" aria-label="Main">
				<a class="bold" href="${home}#games">Games</a>
				${feedItems.length ? `<a class="bold" href="${home}#updates">Updates</a>` : ''}
			</nav>
			<button class="theme-button" type="button" aria-label="Switch to dark mode">${icons.moon}${icons.sun}</button>
		</div>
	</div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
	<div class="wrap">
		<div class="footer-top">
			<div class="footer-name bold">${esc(studio.name)}</div>
			<nav class="footer-links" aria-label="Social links">
				${studio.links.map((l) => `<a ${external(l.url, 'footer')}>${esc(l.label)}${newTabNote}</a>`).join('\n\t\t\t\t')}
			</nav>
		</div>
		<div class="footer-bottom">
			<a href="mailto:${esc(studio.email)}">${esc(studio.email)}</a>
			<a class="footer-download" href="${asset(studio.pressKit)}" download title="Download the press kit (.zip)">Press kit ${icons.download}</a>
		</div>
	</div>
</footer>
<script src="${asset('scripts.js')}"></script>
</body>
</html>
`;
}

// ---------- reusable pieces ----------

function jamCard(g) {
	return `<a class="card" ${external(g.url)}><span class="card-inner">
				<img src="${asset(g.cover)}" alt="${esc(g.coverAlt)}" loading="lazy" width="460" height="215"${g.coverPosition ? ` style="object-position: ${esc(g.coverPosition)}"` : ''}>
				<div class="card-body">
					<span class="tag">Game jam</span>
					<span class="card-title bold">${esc(g.title)}</span>
					<span class="card-text">${esc(g.cardText)} <span class="sr-only">(opens itch.io in a new tab)</span></span>
				</div>
			</span></a>`;
}

// The big card at the top of the Games section. It leads to the game's own page.
function mainGameCard(g) {
	return `<a class="card feature-card" href="${g.slug}.html"><span class="card-inner">
				<img src="${asset(g.cover)}" alt="${esc(g.coverAlt)}" loading="lazy" width="640" height="299">
				<div class="card-body">
					<span class="tag feed-tag game">${esc(g.heroLabel)}</span>
					<span class="card-title bold">${esc(g.title)}</span>
					<span class="card-text">${esc(g.cardText)}</span>
					<span class="text-link bold">Trailer, screenshots &amp; updates -&gt;</span>
				</div>
			</span></a>`;
}

// One row in an updates list. Rows without a summary get an empty second line, so every row is the same height. Pressing it opens the details underneath (scripts.js does the opening and the "show more").
function feedRow(u, showLabel) {
	return `<li class="feed-item" id="${u.id}">
				<button class="update-row feed-row" type="button">
					<span class="update-date">${esc(u.date)}</span>
					<span class="update-text">
						<span class="feed-title-line">${showLabel ? `<span class="tag feed-tag ${u.style}">${esc(u.label)}</span>` : ''}<span class="update-title bold">${esc(u.title)}</span></span>
						${u.shortText ? `<span class="update-summary">${esc(u.shortText)}</span>` : '<span class="update-summary" aria-hidden="true">&nbsp;</span>'}
					</span>
					<span aria-hidden="true" class="update-arrow">-&gt;</span>
				</button>
				<div class="feed-body">${u.bodyHtml}</div>
			</li>`;
}

// A list of updates. It starts with the newest few; "Show more" opens it up to ten at a time, with buttons to flip between pages.
//   labels: put a small label in front of each title saying what the row is ("Purrspective", "News")
//   openFirst: start with the newest one opened
function feed(list, { heading, labels = false, openFirst = false }) {
	if (!list.length) return '';
	return `<div class="feed" data-feed${openFirst ? ' data-open-first' : ''}>
		<h2>${heading}</h2>
		<ul class="update-rows">
			${list.map((u) => feedRow(u, labels)).join('\n\t\t\t')}
		</ul>
		<div class="feed-more" hidden>
			<button class="text-link bold feed-more-button" type="button">Show more</button>
			<span class="feed-pager" hidden>
				<button class="text-link bold feed-prev" type="button">&lt;- Newer</button>
				<span class="feed-page muted"></span>
				<button class="text-link bold feed-next" type="button">Older -&gt;</button>
			</span>
			<span class="feed-count muted"></span>
		</div>
	</div>`;
}

// ---------- pages ----------

function homePage() {
	const g = mainGame;
	const body = `
<section class="hero">
	<div class="wrap">
		<div class="hero-text">
			<div class="hero-label">${esc(g.heroLabel)}</div>
			<h1><a class="title-link bold" href="${g.slug}.html">${esc(g.title)}</a></h1>
			<p class="hero-tagline">${esc(g.tagline)}</p>
			<div class="actions">
				<a class="button bold" ${external(g.wishlistUrl, 'home-hero')}>Wishlist on Steam${newTabNote}<span class="button-shadow"></span></a>
				${g.playtestUrl ? `<a class="button plain bold" ${external(g.playtestUrl, 'home-hero-playtest')}>Sign up to playtest${newTabNote}<span class="button-shadow"></span></a>` : ''}
			</div>
			<p class="wishlist-note">${g.playtestUrl ? "Both are free. Wishlist, and Steam tells you when it's out." : "It's free, and Steam tells you the moment it's out."}</p>
			<a class="text-link bold" href="${g.slug}.html">Trailer &amp; screenshots -&gt;</a>
		</div>
		<figure class="hero-media">
			<video class="media" poster="${asset(g.gameplayLoop.poster)}" autoplay muted loop playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-label="${esc(g.gameplayLoop.alt)}">
				<source src="${asset(g.gameplayLoop.webm)}" type='video/webm; codecs="av01.0.05M.08"'>
				<source src="${asset(g.gameplayLoop.mp4)}" type="video/mp4">
			</video>
			<span class="video-toggle paused video-paused-badge" aria-hidden="true">${icons.play}</span>
		</figure>
	</div>
</section>

<section id="games" class="wrap section">
	<h2>Games</h2>
	${mainGameCard(g)}
	${jams.length ? `<div class="card-grid">
			${jams.map(jamCard).join('\n\t\t\t')}
	</div>` : ''}
</section>
${feedItems.length ? `
<section id="updates" class="wrap section">
	${feed(feedItems, { heading: 'Updates', labels: true, openFirst: true })}
</section>` : ''}
`;
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: studio.name,
		email: studio.email,
		sameAs: studio.links.map((l) => l.url),
		...(studio.url ? { url: fullUrl(''), logo: fullUrl(asset('images/apple-touch-icon.png')) } : {}),
	};
	return page({ file: 'index.html', body, onHomepage: true, structuredData });
}

function gamePage(g) {
	const wishlist = (button) => `<a class="button bold" ${external(g.wishlistUrl, button)}>Wishlist on Steam${newTabNote}<span class="button-shadow"></span></a>`;
	const body = `
<div class="page">
	<div class="title-row">
		<div>
			<h1>${esc(g.title)}</h1>
			<div class="page-details">${esc(g.details)}</div>
		</div>
		<div class="actions">
			${wishlist('game-page-top')}
			${g.playtestUrl ? `<a class="button plain bold" ${external(g.playtestUrl, 'game-page-top-playtest')}>Sign up to playtest${newTabNote}<span class="button-shadow"></span></a>` : ''}
		</div>
	</div>
	<div class="media-frame"><video class="media trailer" src="${asset(g.trailer.video)}" poster="${asset(g.trailer.poster)}" controls autoplay muted playsinline preload="auto" aria-label="${esc(g.title)} trailer"></video></div>
	<section class="block">
		<h2>About</h2>
		${g.about.map((p, i) => `<p${i === 0 ? ' class="lead"' : ''}>${esc(p)}</p>`).join('\n\t\t')}
		<ul class="feature-list">${g.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
	</section>
	${g.screenshots.length ? `<section class="block">
		<h2>Screenshots</h2>
		<div class="screenshots">
			${g.screenshots.map((s) => `<a class="screenshot" href="${asset(s.full)}" data-lightbox><img src="${asset(s.small)}" alt="${esc(s.alt)}" loading="lazy" width="640" height="360"></a>`).join('\n\t\t\t')}
		</div>
	</section>` : ''}
	${feedFor(g.slug).length ? `<section class="block" id="update-log">${feed(feedFor(g.slug), { heading: 'Update log', openFirst: true })}</section>` : ''}
	<section class="cta-box">
		<div class="big bold">Want to play it when it's out?</div>
		<div class="actions">
			${wishlist('game-page-bottom')}
			${studio.discord ? `<a class="button plain bold" ${external(studio.discord)}>Join the Discord${newTabNote}<span class="button-shadow"></span></a>` : ''}
		</div>
	</section>
</div>
`;
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'VideoGame',
		name: g.title,
		description: g.about.join(' '),
		genre: g.genre,
		gamePlatform: g.platforms,
		author: { '@type': 'Organization', name: studio.name },
		publisher: { '@type': 'Organization', name: studio.name },
		sameAs: [g.wishlistUrl],
		...(studio.url ? { url: fullUrl(`${g.slug}.html`), image: fullUrl(asset(g.cover)) } : {}),
	};
	return page({ file: `${g.slug}.html`, title: g.title, description: g.about[0], image: asset(g.cover), body, structuredData });
}

// The old update notes page now just sends people to the updates list on the homepage.
function updatesRedirectPage() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Updates</title>
	<meta http-equiv="refresh" content="0; url=index.html#updates">
</head>
<body>
<p><a href="index.html#updates">The updates have moved to the homepage.</a></p>
</body>
</html>
`;
}

// Shown by most hosts at any broken address.
function notFoundPage() {
	const body = `
<div class="page">
	<div class="block">
		<h1 class="page-title">This page wandered off</h1>
		<p class="lead">The link might be old, or the page has moved. Try one of these instead:</p>
	</div>
	<div class="actions">
		<a class="button bold" href="index.html">Go to the homepage<span class="button-shadow"></span></a>
		<a class="text-link bold" href="${mainGame.slug}.html">${esc(mainGame.title)} -&gt;</a>
		${feedItems.length ? '<a class="text-link bold" href="index.html#updates">Updates -&gt;</a>' : ''}
	</div>
</div>
`;
	return page({ title: 'Page not found', body, rootBase: true });
}

// ---------- build ----------

function copyFolder(from, to, skip = []) {
	fs.mkdirSync(to, { recursive: true });
	for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
		if (skip.includes(entry.name)) continue;
		const a = path.join(from, entry.name);
		const b = path.join(to, entry.name);
		if (entry.isDirectory()) copyFolder(a, b);
		else fs.copyFileSync(a, b);
	}
}

// Start from an empty public/ folder, so removed pages and files don't linger.
fs.rmSync(PUBLIC, { recursive: true, force: true });
copyFolder(DESIGN, path.join(PUBLIC, 'assets'), ['fonts']);

// Put the fonts inside the stylesheet, so they also work when the pages are opened
// straight from your disk (browsers block separate font files there).
{
	const cssFile = path.join(PUBLIC, 'assets', 'styles.css');
	const css = fs.readFileSync(cssFile, 'utf8').replace(/url\("fonts\/([^"]+\.woff2)"\)/g, (m, name) => {
		const data = fs.readFileSync(path.join(DESIGN, 'fonts', name)).toString('base64');
		return `url("data:font/woff2;base64,${data}")`;
	});
	fs.writeFileSync(cssFile, css);
}

const write = (name, text) => fs.writeFileSync(path.join(PUBLIC, name), text);
write('index.html', homePage());
write(`${mainGame.slug}.html`, gamePage(mainGame));
if (feedItems.length) write('updates.html', updatesRedirectPage());
write('404.html', notFoundPage());
if (studio.url) {
	const pages = ['', `${mainGame.slug}.html`];
	write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `\t<url><loc>${esc(fullUrl(p))}</loc></url>`).join('\n')}\n</urlset>\n`);
	write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${fullUrl('sitemap.xml')}\n`);
}

const folderCounts = [...new Set(feedItems.map((u) => u.folder))].map((f) => `${feedFor(f).length} in ${f}`).join(', ');
console.log(`Done: built the website into public/ (${jams.length} jam games; updates: ${folderCounts || 'none'}).`);
