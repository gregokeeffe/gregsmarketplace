/* ============================================================
   Greg's Marketplace – Homepage App
   ============================================================ */
(function () {
  'use strict';

  const CATEGORIES = ['All', 'Bicycles', 'Bicycle Parts', 'Autos & Parts', 'Household Goods', 'Clothing & Accessories', 'Furniture', 'Misc'];

  let inventory = null;
  let activeCategory = 'All';
  let searchQuery = '';
  let sortBy = 'default';

  /* --- Bootstrap ------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    renderSkeletons();
    inventory = await loadInventory();
    applyAwayBanner(inventory.settings);
    renderCategories(inventory.items);
    renderListings();
    bindEvents();
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
    let items = inventory.items.filter(i => !i.hidden);

    if (activeCategory !== 'All') {
      items = items.filter(i => i.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
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
        // Sold items last
        items.sort((a, b) => (a.sold === b.sold ? 0 : a.sold ? 1 : -1));
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
      const total = activeCategory === 'All' ? inventory.items.length : inventory.items.filter(i => i.category === activeCategory).length;
      const available = items.filter(i => !i.sold).length;
      infoEl.innerHTML = `Showing <strong>${items.length}</strong> listing${items.length !== 1 ? 's' : ''}${searchQuery ? ` for "<strong>${escHtml(searchQuery)}</strong>"` : ''} &mdash; <strong>${available}</strong> available`;
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No listings found</h3>
          <p>${searchQuery ? 'Try a different search term.' : 'No items in this category yet.'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(item => buildCard(item)).join('');
  }

  function buildCard(item) {
    const photo = (item.photos && item.photos.length) ? item.photos[0] : '/images/placeholder.svg';
    const badges = [];
    if (item.crossListings && item.crossListings.ebay) {
      badges.push('<span class="badge badge-ebay">eBay</span>');
    }
    if (item.crossListings && item.crossListings.facebook) {
      badges.push('<span class="badge badge-facebook">FB Marketplace</span>');
    }

    return `
      <article class="product-card${item.sold ? ' sold' : ''}" role="listitem">
        <a href="/item.html?id=${encodeURIComponent(item.id)}" class="card-image-wrap" tabindex="-1" aria-hidden="true">
          <img src="${escAttr(photo)}" alt="${escAttr(item.title)}" loading="lazy" onerror="this.src='/images/placeholder.svg'">
          ${item.sold ? '<div class="sold-overlay"><span>Sold</span></div>' : ''}
          ${badges.length ? `<div class="card-badges">${badges.join('')}</div>` : ''}
        </a>
        <div class="card-body">
          <div class="card-category">${escHtml(item.category)}</div>
          <div class="card-title">${escHtml(item.title)}</div>
          <div class="card-condition">${escHtml(item.condition || '')}</div>
        </div>
        <div class="card-footer">
          ${item.sold
            ? `<span class="card-price sold-price">$${formatPrice(item.price)}</span><span class="sold-tag">Sold</span>`
            : `<span class="card-price">$${formatPrice(item.price)}</span>
               <a href="/item.html?id=${encodeURIComponent(item.id)}" class="view-btn">View</a>`
          }
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

    // Search
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    if (searchForm) {
      searchForm.addEventListener('submit', e => {
        e.preventDefault();
        searchQuery = searchInput ? searchInput.value.trim() : '';
        renderListings();
      });
    }
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          searchQuery = searchInput.value.trim();
          renderListings();
        }, 300);
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
