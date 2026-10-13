// Mass Productions website scripts.

// Dark mode button. (The starting theme is set by a tiny script in each page's <head>,
// so the page never flashes the wrong colours.)
(function () {
	var root = document.documentElement;
	var button = document.querySelector('.theme-button');
	if (!button) return;

	function updateLabel() {
		var text = root.getAttribute('data-theme') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
		button.setAttribute('aria-label', text);
		button.setAttribute('title', text);
	}

	updateLabel();
	button.addEventListener('click', function () {
		var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		root.setAttribute('data-theme', next);
		try { localStorage.setItem('theme', next); } catch (e) {}
		updateLabel();
	});
})();

// Tell the stylesheet how tall the header is, so jumping to Games or Updates can stop with the heading the same distance under the header line.
(function () {
	var header = document.querySelector('.site-header');
	if (!header) return;
	function measure() {
		document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
	}
	measure();
	window.addEventListener('resize', measure);
})();

// Updates lists: rows open to show their details. A list starts with the newest few;
// "Show more" opens it up a page at a time, with Newer / Older buttons to flip between pages.
// A page holds as many rows as fit on the screen (four to ten), and the list lines up under the header,
// so a whole page is visible at once without scrolling.
// Without this script every update simply shows in full.
(function () {
	var START = 3, MAX_PAGE = 10, MIN_PAGE = 4;
	var header = document.querySelector('.site-header');
	Array.prototype.forEach.call(document.querySelectorAll('[data-feed]'), function (feed) {
		var items = Array.prototype.slice.call(feed.querySelectorAll('.feed-item'));
		var heading = feed.querySelector('h2');
		var rows = feed.querySelector('.update-rows');
		var moreRow = feed.querySelector('.feed-more');
		var more = feed.querySelector('.feed-more-button');
		var pager = feed.querySelector('.feed-pager');
		var prev = feed.querySelector('.feed-prev');
		var next = feed.querySelector('.feed-next');
		var pageLabel = feed.querySelector('.feed-page');
		var count = feed.querySelector('.feed-count');
		var pageSize = MAX_PAGE, pages = 1;
		var expanded = false, page = 0;

		function setOpen(li, open) {
			li.querySelector('.feed-row').setAttribute('aria-expanded', String(open));
			li.querySelector('.feed-body').hidden = !open;
		}
		// How many closed rows fit between the header and the bottom of the screen, with the heading above and the Show less / page buttons below.
		// Starts from ten and takes rows away until the list fits.
		// The list keeps the height of its tallest page (stretched to fill the screen), so flipping to a page with fewer rows
		// doesn't make the page jump and the page buttons stay in the same place. (Opening a row still makes it taller.)
		function fitPageSize() {
			var room = window.innerHeight - (header ? header.getBoundingClientRect().height : 72) - 44;
			for (pageSize = MAX_PAGE; ; pageSize--) {
				pages = Math.max(1, Math.ceil(items.length / pageSize));
				rows.style.minHeight = '';
				var tallest = 0;
				for (page = 0; page < pages; page++) {
					render();
					tallest = Math.max(tallest, rows.getBoundingClientRect().height);
				}
				page = 0;
				rows.style.minHeight = tallest + 'px';
				render();
				if (pageSize <= MIN_PAGE || feed.getBoundingClientRect().height <= room) break;
			}
			// Stretch the list to fill the screen, so the page buttons sit at the bottom and nothing below the list (like the footer) peeks in.
			var spare = room - feed.getBoundingClientRect().height;
			if (spare > 0) rows.style.minHeight = (parseFloat(rows.style.minHeight) + spare) + 'px';
		}
		function render() {
			var from = expanded ? page * pageSize : 0;
			var to = Math.min(items.length, expanded ? from + pageSize : START);
			items.forEach(function (li, i) { li.hidden = i < from || i >= to; });
			moreRow.hidden = items.length <= START;
			more.textContent = expanded ? 'Show less' : 'Show more';
			pager.hidden = !expanded || pages < 2;
			prev.disabled = page === 0;
			next.disabled = page === pages - 1;
			pageLabel.textContent = 'Page ' + (page + 1) + ' of ' + pages;
			count.textContent = 'Showing ' + (to - from === 1 ? to : (from + 1) + ' to ' + to) + ' of ' + items.length;
		}
		// Line the list up under the header, so the whole page of rows is on screen.
		function bringIntoView() {
			feed.scrollIntoView({ block: 'start' });
		}
		function closeAll() {
			items.forEach(function (li) { setOpen(li, false); });
		}
		// Flipping a page closes any open rows, so the new page fits on screen.
		function flip(to) {
			page = Math.max(0, Math.min(pages - 1, to));
			closeAll();
			render();
			bringIntoView();
		}

		items.forEach(function (li, i) {
			setOpen(li, i === 0 && feed.hasAttribute('data-open-first'));
			li.querySelector('.feed-row').addEventListener('click', function () {
				setOpen(li, li.querySelector('.feed-row').getAttribute('aria-expanded') !== 'true');
			});
		});
		function setExpanded(open) {
			expanded = open;
			page = 0;
			if (expanded) {
				closeAll();
				fitPageSize();
			} else {
				rows.style.minHeight = '';
			}
			render();
			bringIntoView();
		}
		more.addEventListener('click', function () { setExpanded(!expanded); });

		// The Updates link in the header opens the homepage list the same way as Show more.
		// Coming from another page (index.html#updates) opens it once the page has loaded.
		if (items.length > START && feed.closest('#updates')) {
			Array.prototype.forEach.call(document.querySelectorAll('a[href$="#updates"]'), function (link) {
				link.addEventListener('click', function (e) {
					if (link.pathname !== location.pathname) return;
					e.preventDefault();
					if (location.hash !== '#updates') history.pushState(null, '', '#updates');
					if (expanded) bringIntoView(); else setExpanded(true);
				});
			});
			if (location.hash === '#updates') {
				window.addEventListener('load', function () { if (!expanded) setExpanded(true); });
			}
		}
		prev.addEventListener('click', function () { flip(page - 1); });
		next.addEventListener('click', function () { flip(page + 1); });
		// If the window changes size while the list is open, re-fit the page and stay on the same rows.
		window.addEventListener('resize', function () {
			if (!expanded) return;
			var first = page * pageSize;
			fitPageSize();
			page = Math.min(pages - 1, Math.floor(first / pageSize));
			render();
		});
		render();
	});
})();

// The homepage gameplay video: click it (or press Enter / Space on it) to pause, and again to play.
// People whose device asks for less motion get it paused from the start.
(function () {
	var figure = document.querySelector('.hero-media');
	var video = figure && figure.querySelector('video');
	if (!video) return;
	var description = video.getAttribute('aria-label') || 'Gameplay video';
	video.setAttribute('role', 'button');
	video.setAttribute('tabindex', '0');

	function update() {
		figure.classList.toggle('is-paused', video.paused);
		video.setAttribute('aria-label', description + (video.paused ? '. Press to play.' : '. Press to pause.'));
	}
	function toggle() {
		if (video.paused) video.play(); else video.pause();
	}

	if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
		video.removeAttribute('autoplay');
		video.pause();
	}
	video.addEventListener('click', toggle);
	video.addEventListener('keydown', function (e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	});
	video.addEventListener('play', update);
	video.addEventListener('pause', update);
	update();
})();

// The trailer on the game page starts playing by itself, muted (the sound button in its controls turns sound on).
// People whose device asks for less motion get it stopped, so they can start it themselves.
(function () {
	var trailer = document.querySelector('video.trailer');
	if (!trailer) return;
	if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
		trailer.removeAttribute('autoplay');
		trailer.pause();
	}
})();

// Screenshots open full size. Arrow keys or the buttons flip through them; Esc or a click outside closes.
(function () {
	var links = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox]'));
	if (!links.length || typeof HTMLDialogElement === 'undefined') return;

	var viewer = document.createElement('dialog');
	viewer.className = 'lightbox';
	viewer.setAttribute('aria-label', 'Screenshot viewer');
	viewer.innerHTML =
		'<div class="lightbox-inner">' +
		'<img alt="">' +
		'<button class="close" type="button" aria-label="Close">✕</button>' +
		'<button class="previous" type="button" aria-label="Previous screenshot">&lt;-</button>' +
		'<button class="next" type="button" aria-label="Next screenshot">-&gt;</button>' +
		'<div class="counter" aria-live="polite"></div>' +
		'</div>';
	document.body.appendChild(viewer);

	var image = viewer.querySelector('img');
	var counter = viewer.querySelector('.counter');
	var index = 0;

	function show(i) {
		index = (i + links.length) % links.length;
		var thumb = links[index].querySelector('img');
		image.src = links[index].getAttribute('href');
		image.alt = thumb ? thumb.alt : '';
		counter.textContent = (index + 1) + ' / ' + links.length;
	}

	links.forEach(function (link, i) {
		link.addEventListener('click', function (e) {
			e.preventDefault();
			show(i);
			viewer.showModal();
		});
	});
	viewer.querySelector('.close').addEventListener('click', function () { viewer.close(); });
	viewer.querySelector('.previous').addEventListener('click', function () { show(index - 1); });
	viewer.querySelector('.next').addEventListener('click', function () { show(index + 1); });
	viewer.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowLeft') show(index - 1);
		if (e.key === 'ArrowRight') show(index + 1);
	});
	viewer.addEventListener('click', function (e) {
		if (e.target === viewer || e.target.classList.contains('lightbox-inner')) viewer.close();
	});
})();

// If someone arrives through a tagged link from one of your videos (e.g. ?utm_source=youtube),
// pass the tag on to every Steam link, so Steamworks shows which video they came from.
(function () {
	var query = new URLSearchParams(location.search);
	var source = query.get('utm_source');
	if (!source) return;
	document.querySelectorAll('a[href*="store.steampowered.com"]').forEach(function (a) {
		try {
			var url = new URL(a.href);
			url.searchParams.set('utm_source', source);
			url.searchParams.set('utm_medium', query.get('utm_medium') || 'website');
			if (query.get('utm_campaign')) url.searchParams.set('utm_campaign', query.get('utm_campaign'));
			a.href = url.toString();
		} catch (e) {}
	});
})();
