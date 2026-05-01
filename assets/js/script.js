let activeCard = null;
let validSections = new Set();

const dataCache = {};
const domCache = {};

const typeConfig = {
  stream: { label: 'Streaming', icon: 'fa-play' },
  download: { label: 'Download', icon: 'fa-download' },

  book: { label: 'Book', icon: 'fa-book' },
  audiobook: { label: 'Audiobook', icon: 'fa-headphones' },

  privacy: { label: 'Privacy', icon: 'fa-user-secret' },
  learning: { label: 'Learning', icon: 'fa-graduation-cap' },
  utilities: { label: 'Utilities', icon: 'fa-toolbox' },
};

let overlay, titleEl, bodyEl;

/* =========================
   IT'S THAT DAY AGAIN
========================= */
window.addEventListener('DOMContentLoaded', () => {
  overlay = document.getElementById('overlay');
  titleEl = document.getElementById('overlay-title');
  bodyEl = document.querySelector('.overlay-body');

  if (!overlay || !titleEl || !bodyEl) return;

  bindUI();
  schedulePreload();

  /* =========================
   BACKEND HEARTBEAT
========================= */
  fetch('https://ftlpntiymqcrtcsxfchv.supabase.co/functions/v1/beehivestream', {
    method: 'POST',
    keepalive: true,
  }).catch(() => {});

  /* =========================
   CONTINUE ./.
========================= */

  const hash = location.hash.replace('#', '');

  validSections = new Set(
    [...document.querySelectorAll('.tile')].map((t) => t.dataset.section)
  );

  if (hash && validSections.has(hash)) {
    openSection(hash, true);
  }
});

/* =========================
   DATA LAYER (CACHE)
========================= */
async function loadSectionData(section) {
  if (dataCache[section]) return dataCache[section];

  try {
    const res = await fetch(`assets/db/${section}.json`);
    if (!res.ok) throw new Error(`Failed to load ${section}`);

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    dataCache[section] = items;
    return items;
  } catch (err) {
    console.error('Data load error:', err);
    return [];
  }
}

/* =========================
   CARD FACTORY
========================= */
function createCard(item, section) {
  const card = document.createElement('div');
  card.className = 'overlay-card';

  const config = typeConfig[item.type] || typeConfig.stream;

  const preview = document.createElement('div');
  preview.className = 'preview';

  const img = document.createElement('img');
  img.src = item.image || '';
  img.alt = item.name || 'item';

  // section image handling
  img.loading = 'eager';
  img.decoding = 'async';

  preview.appendChild(img);

  const details = document.createElement('div');
  details.className = 'details';

  // const title = document.createElement('h3');
  // title.textContent = item.name || 'Unknown';
  const title = document.createElement('h3');
  const text = document.createElement('span');
  text.textContent = item.name || 'Unknown';
  text.style.cursor = 'pointer';

  text.addEventListener('click', (e) => {
    e.stopPropagation();

    const target = item.url || item.name;
    if (!target) return;

    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(target)}`,
      '_blank'
    );
  });

  title.appendChild(text);
  //

  const badge = document.createElement('span');
  badge.className = `badge ${item.type || 'stream'}`;
  badge.innerHTML = `<i class="fa-solid ${config.icon}"></i> ${config.label}`;

  const desc = document.createElement('p');
  desc.textContent = item.description || '';

  const link = document.createElement('a');
  link.className = 'overlay-visit';
  link.href = item.url || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Visit Webpage';
  link.innerHTML = 'Visit Webpage <span class="arrow">↗</span>';

  details.append(title, badge, desc, link);
  card.append(preview, details);

  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;

    if (activeCard) activeCard.classList.remove('active');
    card.classList.add('active');
    activeCard = card;
  });

  return card;
}

/* =========================
   SECTION RENDER (CACHED DOM)
========================= */
async function renderSection(section) {
  if (domCache[section]) {
    const container = domCache[section];

    const active = container.querySelectorAll('.overlay-card.active');
    active.forEach((card) => card.classList.remove('active'));

    return container;
  }

  const data = await loadSectionData(section);

  const fragment = document.createDocumentFragment();

  for (const item of data) {
    fragment.appendChild(createCard(item, section));
  }

  const container = document.createElement('div');
  container.appendChild(fragment);

  domCache[section] = container;

  return container;
}

/* =========================
   OPEN SECTION
========================= */
let renderToken = 0;

async function openSection(section, fromPop = false) {
  if (!overlay || !titleEl || !bodyEl) return;
  if (!validSections.has(section)) return;

  const current = location.hash.replace('#', '');
  if (current === section && overlay.classList.contains('active')) return;

  renderToken++;
  const token = renderToken;

  document.body.style.overflow = 'hidden';
  document.body.classList.add('overlay-open');

  titleEl.textContent = section.charAt(0).toUpperCase() + section.slice(1);
  overlay.classList.add('active');

  if (fromPop) {
    history.replaceState({ section }, '', `#${section}`);
  } else if (current !== section) {
    history.pushState({ section }, '', `#${section}`);
  }

  const content = await renderSection(section);

  // if a newer render started, kill this one
  if (token !== renderToken) return;

  // kill the stupid delay causing the flicker
  bodyEl.replaceChildren(content);
  overlay.scrollTop = 0;
  bodyEl.scrollTop = 0;

  requestAnimationFrame(() => {
    if (token !== renderToken) return;
  });
}

/* =========================
   CLOSE
========================= */
function closeSection(fromPop = false) {
  if (!overlay) return;

  document.body.style.overflow = '';
  document.body.classList.remove('overlay-open');

  overlay.classList.remove('active');

  activeCard = null;

  history.replaceState(null, '', location.pathname);
}

/* =========================
   POPSTATE
========================= */
window.addEventListener('popstate', () => {
  const section = location.hash.replace('#', '');

  if (section && validSections.has(section)) {
    openSection(section, true);
  } else {
    closeSection(true);
  }
});

/* =========================
   UI BINDINGS
========================= */
function bindUI() {
  document.querySelectorAll('.tile').forEach((tile) => {
    const open = () => openSection(tile.dataset.section);

    tile.addEventListener('click', open);

    // MOUSE FOLLOW EFFECT
    tile.addEventListener('mousemove', (e) => {
      const rect = tile.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tile.style.setProperty('--x', `${x}px`);
      tile.style.setProperty('--y', `${y}px`);
    });

    tile.addEventListener('mouseleave', () => {
      tile.style.setProperty('--x', '50%');
      tile.style.setProperty('--y', '50%');
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSection();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSection();
  });

  document.querySelector('.close-btn')?.addEventListener('click', closeSection);
}

/* =========================
   PRELOAD (NON-BLOCKING)
========================= */
function schedulePreload() {
  const sections = [...document.querySelectorAll('.tile')].map(
    (t) => t.dataset.section
  );

  const run = (i = 0) => {
    if (i >= sections.length) return;

    renderSection(sections[i]);

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => run(i + 1));
    } else {
      setTimeout(() => run(i + 1), 200);
    }
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => run());
  } else {
    setTimeout(() => run(), 800);
  }
}
