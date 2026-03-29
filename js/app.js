/* ============================================================
   Greg's Marketplace – Homepage App
   ============================================================ */
(function () {
  'use strict';

  const CATEGORIES = ['All', 'Bicycles & Parts', 'Autos & Parts', 'Furniture & Household Items', 'Clothing & Accessories', 'Misc', 'Sold'];

  let inventory = null;
  let activeCategory = 'All';
  let sortBy = 'default';

  /* --- Bootstrap ------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    applyAvatarFromCache();
    renderSkeletons();
    inventory = await loadInventory();
    applyAwayBanner(inventory.settings);
    applyHeroText(inventory.settings);
    applyAvatar(inventory.settings);
    renderCategories(inventory.items);
    renderListings();
    renderAboutSection(inventory.settings);
    bindEvents();
  }

  function applyAvatarFromCache() {
    try {
      const url = localStorage.getItem('gm_avatar_url');
      if (!url) return;
      const img = document.getElementById('header-avatar-img');
      if (!img) return;
      img.parentElement.classList.remove('initials-only');
      img.src = url;
    } catch (_) {}
  }

  function applyAvatar(settings) {
    if (!settings || !settings.avatarUrl) return;
    const img = document.getElementById('header-avatar-img');
    if (!img) return;
    img.parentElement.classList.remove('initials-only');
    img.src = settings.avatarUrl;
    try { localStorage.setItem('gm_avatar_url', settings.avatarUrl); } catch (_) {}
  }

  function applyHeroText(settings) {
    if (!settings) return;
    const h1 = document.getElementById('hero-title');
    const p = document.getElementById('hero-subtitle');
    if (h1 && settings.heroTitle) h1.textContent = settings.heroTitle;
    if (p && settings.heroSubtitle) p.textContent = settings.heroSubtitle;
  }

  function renderAboutSection(settings) {
    if (!settings) return;
    const section = document.getElementById('about-section');
    if (!section) return;
    let show = false;
    const aboutEl = document.getElementById('about-text-public');
    if (settings.about && aboutEl) {
      const avatarHtml = settings.avatarUrl
        ? `<img src="${escAttr(settings.avatarUrl)}" alt="Greg OKeeffe" class="about-avatar">`
        : '';
      const profileLinks = [];
      if (settings.ebayProfileUrl) {
        profileLinks.push(`<a href="${escAttr(settings.ebayProfileUrl)}" target="_blank" rel="noopener" class="about-profile-link about-profile-ebay">
          <svg viewBox="0 0 36 16" height="14" aria-hidden="true"><text y="13" font-family="Arial Black,sans-serif" font-size="13" font-weight="900"><tspan fill="#E53238">e</tspan><tspan fill="#0064D2">B</tspan><tspan fill="#F5AF02">a</tspan><tspan fill="#86B817">y</tspan></text></svg>
          View my eBay listings
        </a>`);
      }
      if (settings.facebookProfileUrl) {
        profileLinks.push(`<a href="${escAttr(settings.facebookProfileUrl)}" target="_blank" rel="noopener" class="about-profile-link about-profile-fb">
          <svg viewBox="0 0 18 18" height="15" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#1877F2"/><path d="M10.2 9.5h1.6l.3-2H10.2V6.3c0-.55.27-.88.9-.88H12V4.1s-.57-.08-1.2-.08c-1.6 0-2.6.97-2.6 2.72V7.5H6.6v2h1.6V15h2V9.5z" fill="white"/></svg>
          View my Facebook listings
        </a>`);
      }
      const linksHtml = profileLinks.length
        ? `<div class="about-profile-links">${profileLinks.join('')}</div>`
        : '';
      aboutEl.innerHTML = `
        <div class="about-with-avatar">
          ${avatarHtml}
          <div class="about-text-block">
            <h2>About</h2>
            <p>${escHtml(settings.about)}</p>
            ${linksHtml}
          </div>
        </div>`;
      show = true;
    }
    const faqSection = document.getElementById('faq-section-public');
    const faqList = document.getElementById('faq-list-public');
    if (settings.faqs && settings.faqs.length && faqList && faqSection) {
      faqList.innerHTML = settings.faqs.map(f => `
        <div class="faq-public-item">
          <dt class="faq-public-q">${escHtml(f.q)}</dt>
          <dd class="faq-public-a">${escHtml(f.a)}</dd>
        </div>`).join('');
      faqSection.removeAttribute('hidden');
      show = true;
    }
    if (show) section.removeAttribute('hidden');
  }

  /* --- Data Loading ---------------------------------------- */
  async function loadInventory() {
    // 1. Try live Netlify Blobs endpoint
    try {
      const res = await fetch('/api/inventory', { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
      if (res.ok) {
        const data = await res.json();
        if (data && data.items) return data;
      }
    } catch (_) {}

    // 2. Fall back to static JSON
    try {
      const res = await fetch('/data/inventory.json');
      if (res.ok) return res.json();
    } catch (_) {}

    return { settings: {}, items: [] };
  }

  /* --- Away Banner ------------------------------------------ */
  function applyAwayBanner(settings) {
    const banner = document.getElementById('away-banner');
    if (!banner) return;
    if (settings && settings.sellerAwayMode) {
      banner.textContent = settings.sellerAwayMessage || "Seller is currently away.";
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  /* --- Categories ------------------------------------------ */
  function renderCategories(items) {
    const container = document.getElementById('category-list');
    if (!container) return;
    container.innerHTML = '';

    CATEGORIES.forEach(cat => {
      const count = cat === 'All'
        ? items.filter(i => !i.sold && !i.hidden).length
        : cat === 'Sold'
          ? items.filter(i => i.sold && i.showInSold).length
          : items.filter(i => i.category === cat && !i.sold && !i.hidden).length;

      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat === activeCategory ? ' active' : '');
      btn.dataset.cat = cat;
      btn.innerHTML = `${escHtml(cat)} <span class="cat-count">${count}</span>`;
      container.appendChild(btn);
    });
  }

  /* --- Filtering & Sorting --------------------------------- */
  function getFilteredItems() {
    if (!inventory) return [];

    let items;
    if (activeCategory === 'Sold') {
      items = inventory.items.filter(i => i.sold && i.showInSold);
    } else {
      items = inventory.items.filter(i => !i.hidden && !i.sold);
      if (activeCategory !== 'All') {
        items = items.filter(i => i.category === activeCategory);
      }
    }

    switch (sortBy) {
      case 'price-asc':
        items.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        items.sort((a, b) => b.price - a.price);
        break;
      case 'title':
        items.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        if (activeCategory !== 'Sold') {
          items.sort((a, b) => (a.featured === b.featured) ? 0 : a.featured ? -1 : 1);
        }
    }
    return items;
  }

  /* --- Render Listings ------------------------------------- */
  function renderListings() {
    const grid = document.getElementById('product-grid');
    const loadingEl = document.getElementById('loading-grid');
    const infoEl = document.getElementById('results-info');

    if (loadingEl) loadingEl.remove();
    if (!grid) return;

    const items = getFilteredItems();

    if (infoEl) {
      const available = items.filter(i => !i.sold).length;
      infoEl.innerHTML = `Showing <strong>${items.length}</strong> listing${items.length !== 1 ? 's' : ''} &mdash; <strong>${available}</strong> available`;
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No listings found</h3>
          <p>No items in this category yet.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(item => buildCard(item)).join('');
  }

  function buildCard(item) {
    const photo = (item.photos && item.photos.length) ? item.photos[0] : '/images/placeholder.svg';
    const cl = item.crossListings || {};

    const crossRows = [];
    if (cl.ebay && cl.ebayPrice) {
      crossRows.push(`
        <a href="${escAttr(cl.ebay)}" target="_blank" rel="noopener" class="card-cross-item card-cross-ebay" title="Also on eBay">
          <svg viewBox="0 0 36 16" height="12" aria-hidden="true"><text y="13" font-family="Arial Black,sans-serif" font-size="13" font-weight="900"><tspan fill="#E53238">e</tspan><tspan fill="#0064D2">B</tspan><tspan fill="#F5AF02">a</tspan><tspan fill="#86B817">y</tspan></text></svg>
          <span>$${formatPrice(cl.ebayPrice)}</span>
        </a>`);
    }
    if (cl.facebook && cl.facebookPrice) {
      crossRows.push(`
        <a href="${escAttr(cl.facebook)}" target="_blank" rel="noopener" class="card-cross-item card-cross-fb" title="Also on Facebook Marketplace">
          <svg viewBox="0 0 18 18" height="13" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#1877F2"/><path d="M10.2 9.5h1.6l.3-2H10.2V6.3c0-.55.27-.88.9-.88H12V4.1s-.57-.08-1.2-.08c-1.6 0-2.6.97-2.6 2.72V7.5H6.6v2h1.6V15h2V9.5z" fill="white"/></svg>
          <span>$${formatPrice(cl.facebookPrice)}</span>
        </a>`);
    }

    return `
      <article class="product-card${item.sold ? ' sold' : ''}${item.featured ? ' featured-card' : ''}" role="listitem">
        <a href="/item.html?id=${encodeURIComponent(item.id)}" class="card-image-wrap" tabindex="-1" aria-hidden="true">
          <img src="${escAttr(photo)}" alt="${escAttr(item.title)}" loading="lazy" onerror="this.src='/images/placeholder.svg'">
          ${item.sold ? '<div class="sold-overlay"><span>Sold</span></div>' : ''}
        </a>
        <div class="card-body">
          <div class="card-category">${escHtml(item.category)}</div>
          <div class="card-title">${escHtml(item.title)}</div>
          ${item.condition ? `<div class="card-condition"><span class="condition-label">Condition:</span> ${escHtml(item.condition)}</div>` : ''}
        </div>
        <div class="card-footer">
          ${item.sold
            ? `<span class="card-price sold-price">$${formatPrice(item.price)}</span><span class="sold-tag">Sold</span>`
            : `<span class="card-price">$${formatPrice(item.price)}</span>
               <a href="/item.html?id=${encodeURIComponent(item.id)}" class="view-btn">View</a>`
          }
          ${crossRows.length ? `<div class="card-cross"><span class="card-cross-label">Cross-listed:</span>${crossRows.join('')}</div>` : ''}
        </div>
      </article>`;
  }

  /* --- Skeletons ------------------------------------------- */
  function renderSkeletons() {
    const loadingEl = document.getElementById('loading-grid');
    if (!loadingEl) return;
    loadingEl.innerHTML = Array.from({ length: 8 }, () => `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
        </div>
      </div>`).join('');
  }

  /* --- Events ---------------------------------------------- */
  function bindEvents() {
    // Category tabs
    const catList = document.getElementById('category-list');
    if (catList) {
      catList.addEventListener('click', e => {
        const btn = e.target.closest('.cat-btn');
        if (!btn) return;
        activeCategory = btn.dataset.cat;
        catList.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeCategory));
        renderListings();
      });
    }

    // Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        sortBy = sortSelect.value;
        renderListings();
      });
    }
  }

  /* --- Helpers --------------------------------------------- */
  function formatPrice(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(str) {
    return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
})();
