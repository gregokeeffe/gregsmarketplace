/* ============================================================
   Greg's Marketplace – Item Detail Page
   ============================================================ */
(function () {
  'use strict';

  let currentItem = null;
  let inventory = null;
  let lightboxIndex = 0;
  let photos = [];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    applyAvatarFromCache();
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');
    if (!itemId) { window.location.href = '/'; return; }

    inventory = await loadInventory();
    applyAwayBanner(inventory.settings);
    applyAvatar(inventory.settings);
    currentItem = inventory.items.find(i => i.id === itemId);

    if (!currentItem) {
      document.getElementById('item-content').innerHTML =
        '<div class="no-results" style="padding:4rem 1rem"><div class="no-results-icon">😕</div><h3>Listing not found</h3><p><a href="/">Browse all listings →</a></p></div>';
      return;
    }

    renderItem(currentItem, inventory.settings);
    initAccordions();
    initLightbox();
  }

  /* --- Data ------------------------------------------------ */
  async function loadInventory() {
    try {
      const res = await fetch('/api/inventory', { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
      if (res.ok) { const d = await res.json(); if (d && d.items) return d; }
    } catch (_) {}
    try {
      const res = await fetch('/data/inventory.json');
      if (res.ok) return res.json();
    } catch (_) {}
    return { settings: {}, items: [] };
  }

  /* --- Avatar --------------------------------------------- */
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

  /* --- Away Banner ----------------------------------------- */
  function applyAwayBanner(settings) {
    const banner = document.getElementById('away-banner');
    if (!banner) return;
    if (settings && settings.sellerAwayMode) {
      banner.textContent = settings.sellerAwayMessage || 'Seller is currently away.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  /* --- Render Item ----------------------------------------- */
  function renderItem(item, settings) {
    document.title = `${item.title} – Greg's Marketplace`;

    // Breadcrumb
    const crumb = document.getElementById('breadcrumb');
    if (crumb) {
      crumb.innerHTML = `
        <a href="/">All Listings</a>
        <span class="breadcrumb-sep">›</span>
        <a href="/?cat=${encodeURIComponent(item.category)}">${escHtml(item.category)}</a>
        <span class="breadcrumb-sep">›</span>
        <span>${escHtml(item.title)}</span>`;
    }

    // Gallery
    photos = (item.photos && item.photos.length) ? item.photos : ['/images/placeholder.svg'];
    renderGallery(photos, item.sold);

    // Cross-listing panel
    const badgesEl = document.getElementById('cross-badges');
    if (badgesEl) {
      const hasCross = item.crossListings &&
        (item.crossListings.ebay || item.crossListings.facebook);

      if (hasCross) {
        const rows = [];

        // Only show a platform row if BOTH a URL and a price have been entered
        if (item.crossListings.ebay && item.crossListings.ebayPrice) {
          rows.push(`
            <a href="${escAttr(item.crossListings.ebay)}" target="_blank" rel="noopener noreferrer" class="cross-platform-row cross-row-ebay">
              <div class="cross-platform-logo">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2 9.5C2 7 3.5 5 6.5 5c2.5 0 4 1.3 4.3 3.3H9c-.2-1.3-1.1-2.1-2.5-2.1C4.5 6.2 3.3 7.6 3.3 9.5s1.2 3.3 3.2 3.3c1.4 0 2.3-.8 2.6-2.1h1.8C10.5 12.7 9 14 6.5 14 3.5 14 2 12 2 9.5zm10.8 3.7 2.5-4.6 2.5 4.6h-5zm-.8-7h1.8l4 7.3-1.2 2.2-1-1.8H11l-1 1.8-1.2-2.2 4-7.3z"/></svg>
              </div>
              <div class="cross-platform-info">
                <span class="cross-platform-name">Also on eBay</span>
                <span class="cross-platform-note">Buyer protection &amp; returns</span>
              </div>
              <div class="cross-platform-price">$${formatPrice(item.crossListings.ebayPrice)}</div>
            </a>`);
        }

        if (item.crossListings.facebook && item.crossListings.facebookPrice) {
          rows.push(`
            <a href="${escAttr(item.crossListings.facebook)}" target="_blank" rel="noopener noreferrer" class="cross-platform-row cross-row-facebook">
              <div class="cross-platform-logo">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
              </div>
              <div class="cross-platform-info">
                <span class="cross-platform-name">Also on Facebook Marketplace</span>
                <span class="cross-platform-note">Local pickup preferred</span>
              </div>
              <div class="cross-platform-price">$${formatPrice(item.crossListings.facebookPrice)}</div>
            </a>`);
        }

        badgesEl.innerHTML = `
          <div class="cross-platform-panel">
            <div class="cross-platform-header">
              <span class="cross-platform-title">Also listed on</span>
              <span class="cross-platform-best">Best price here ✓</span>
            </div>
            ${rows.join('')}
          </div>`;
      } else {
        badgesEl.innerHTML = '';
      }
    }

    // Title / price / condition
    const titleEl = document.getElementById('item-title');
    const catEl = document.getElementById('item-category');
    const condEl = document.getElementById('item-condition');
    const priceEl = document.getElementById('item-price');
    const priceAreaEl = document.getElementById('price-area');

    if (catEl) catEl.textContent = item.category;
    if (titleEl) titleEl.textContent = item.title;
    if (condEl) {
      if (item.condition) {
        condEl.innerHTML = `<span class="condition-label">Condition:</span> ${escHtml(item.condition)}`;
      } else {
        condEl.textContent = '';
      }
    }

    if (priceEl) {
      priceEl.textContent = `$${formatPrice(item.price)}`;
      if (item.sold) priceEl.classList.add('sold-price');
    }
    if (priceAreaEl && item.sold) {
      priceAreaEl.insertAdjacentHTML('beforeend', '<span class="item-sold-label">Sold</span>');
    }

    // Location — prefer per-item ZIP, fall back to global default
    const locEl = document.getElementById('item-location');
    const zip = item.zip || (settings && settings.sellerZip) || '';
    if (locEl && zip) {
      locEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Item ZIP: ${escHtml(zip)}`;
    }

    // Approximate pickup area map (above inquiry button)
    initLocationMap(item, settings);

    // Inquire / purchase area
    renderInquireForm(item, settings);

    // Accordion content
    const descEl = document.getElementById('acc-description');
    if (descEl) descEl.innerHTML = item.description
      ? escHtml(item.description).replace(/\n/g, '<br>')
      : '<em style="color:var(--text-muted)">No description provided.</em>';

    const detailsEl = document.getElementById('acc-details');
    if (detailsEl && item.details && Object.keys(item.details).length) {
      detailsEl.innerHTML = `<table class="details-table">${
        Object.entries(item.details).map(([k, v]) =>
          `<tr><td>${escHtml(k)}</td><td>${escHtml(String(v))}</td></tr>`
        ).join('')
      }</table>`;
    }

  }

  /* --- Inquire to Purchase --------------------------------- */
  function renderInquireForm(item, settings) {
    const area = document.getElementById('inquire-area');
    if (!area) return;

    if (item.sold) {
      area.innerHTML = `
        <div class="sold-notice">
          <strong>This item has been sold</strong>
          <p>Check back for more listings.</p>
        </div>
        <a href="/" class="btn btn-secondary" style="display:flex;justify-content:center;margin-top:0.5rem">← Browse all listings</a>`;
      return;
    }

    if (settings && settings.sellerAwayMode) {
      area.innerHTML = `
        <div class="sold-notice" style="background:#fef3c7;border-color:#fde68a;color:#92400e">
          <strong>Seller is currently away</strong>
          <p>${escHtml(settings.sellerAwayMessage || 'Please check back soon.')}</p>
        </div>`;
      return;
    }

    area.innerHTML = `
      <button class="inquire-purchase-btn" id="inquire-btn" aria-expanded="false" aria-controls="inq-form-wrap">
        ✉&#xFE0E; Inquire to Purchase
        <svg class="inq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="inq-form-wrap" class="inq-form-wrap" hidden>

        <form id="inq-form" class="inq-form" novalidate>

          <div class="inq-field">
            <label class="inq-label" for="inq-name">Name *</label>
            <input type="text" id="inq-name" class="inq-input" required autocomplete="name" placeholder="Your name">
          </div>

          <div class="inq-field">
            <label class="inq-label">Fulfillment Preference *</label>
            <div class="inq-radio-group">
              <label class="inq-radio-opt"><input type="radio" name="fulfillment" value="ship"> Ship</label>
              <label class="inq-radio-opt"><input type="radio" name="fulfillment" value="local_pickup"> Local Pickup</label>
              <label class="inq-radio-opt"><input type="radio" name="fulfillment" value="freight"> Freight</label>
            </div>
          </div>

          <div id="inq-shipping-row" hidden>
            <button type="button" class="inq-ship-info-btn" id="inq-ship-info-btn" aria-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
              Shipping details
            </button>
            <div id="inq-ship-detail" class="inq-ship-detail" hidden></div>
          </div>

          <div class="inq-field">
            <label class="inq-label">Payment Preference *</label>
            <div class="inq-radio-group">
              <label class="inq-radio-opt"><input type="radio" name="payment" value="paypal">
                <svg class="pay-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#003087" d="M7.4 2h7c2.7 0 4.8 1.9 4.5 5-.4 3.5-2.8 5-5.8 5H11l-.9 5H6.6l2-13h-1.2z"/><path fill="#009cde" d="M9 7h4c1.8 0 3 1 2.8 2.9-.3 2.2-1.8 3.1-3.8 3.1H10L9 7z"/></svg>
                PayPal
              </label>
              <label class="inq-radio-opt"><input type="radio" name="payment" value="venmo">
                <svg class="pay-logo" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#3D95CE"/><path fill="#fff" d="M17.5 4.5c.4.7.6 1.5.6 2.5 0 3-2.6 6.9-4.7 9.5H9.2L7 5.1l3.9-.4 1.1 8.7c1-1.7 2.2-4.3 2.2-6.1 0-.9-.2-1.6-.4-2.1l3.7-.7z"/></svg>
                Venmo
              </label>
              <label class="inq-radio-opt"><input type="radio" name="payment" value="zelle">
                <svg class="pay-logo" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#6D1ED4"/><path fill="#fff" d="M6 7h9l-7 5 7 5H6v-2h5.5l-5-3.5L11.5 9H6V7z"/></svg>
                Zelle
              </label>
              <label class="inq-radio-opt"><input type="radio" name="payment" value="cash">
                <svg class="pay-logo" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#1a7a4a"/><text x="12" y="17" text-anchor="middle" fill="#fff" font-size="14" font-weight="700" font-family="Arial,sans-serif">$</text></svg>
                Cash
              </label>
            </div>
          </div>

          <div class="inq-field">
            <label class="inq-label" for="inq-question">Do you have any questions?</label>
            <textarea id="inq-question" class="inq-input inq-textarea" rows="3" placeholder="Ask about condition, history, measurements, dimensions, etc."></textarea>
          </div>

          <div class="inq-field">
            <label class="inq-label">How would you like me to get back to you? *</label>
            <div class="inq-radio-group">
              <label class="inq-radio-opt"><input type="radio" name="replyMethod" value="text"> Text</label>
              <label class="inq-radio-opt"><input type="radio" name="replyMethod" value="call"> Call</label>
              <label class="inq-radio-opt"><input type="radio" name="replyMethod" value="email"> Email</label>
            </div>
          </div>

          <div class="inq-field" id="inq-contact-field" hidden>
            <label class="inq-label" id="inq-contact-label" for="inq-contact">Phone Number *</label>
            <input type="tel" id="inq-contact" class="inq-input" autocomplete="tel" placeholder="555-867-5309">
          </div>

          <div id="inq-error" class="inq-error" hidden></div>

          <div class="inq-submit-row">
            <button type="submit" id="inq-submit-btn" class="inquire-submit-btn">Send Inquiry →</button>
          </div>

        </form>
      </div>`;

    // Toggle open/close
    document.getElementById('inquire-btn').addEventListener('click', () => {
      const wrap = document.getElementById('inq-form-wrap');
      const opening = wrap.hidden;
      wrap.hidden = !opening;
      document.getElementById('inquire-btn').setAttribute('aria-expanded', String(opening));
      document.querySelector('.inq-chevron').classList.toggle('flipped', opening);
      if (opening) {
        document.getElementById('inq-name').focus();
      }
    });

    // Fulfillment → show shipping 'i' button when "Ship" is selected
    document.querySelectorAll('input[name=fulfillment]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('inq-shipping-row').hidden = r.value !== 'ship';
      });
    });

    // Shipping info toggle
    document.getElementById('inq-ship-info-btn').addEventListener('click', () => {
      const detail = document.getElementById('inq-ship-detail');
      const btn    = document.getElementById('inq-ship-info-btn');
      const open   = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) detail.innerHTML = buildInqShippingHtml(item);
    });

    // Reply method → show contact field with correct type
    document.querySelectorAll('input[name=replyMethod]').forEach(r => {
      r.addEventListener('change', () => {
        const field   = document.getElementById('inq-contact-field');
        const label   = document.getElementById('inq-contact-label');
        const input   = document.getElementById('inq-contact');
        const isEmail = r.value === 'email';
        field.hidden       = false;
        label.textContent  = isEmail ? 'Email Address *' : 'Phone Number *';
        input.type         = isEmail ? 'email' : 'tel';
        input.autocomplete = isEmail ? 'email' : 'tel';
        input.placeholder  = isEmail ? 'you@example.com' : '555-867-5309';
        input.focus();
      });
    });

    // Form submit
    document.getElementById('inq-form').addEventListener('submit', async e => {
      e.preventDefault();
      await submitInquiry(item);
    });
  }

  async function initLocationMap(item, settings) {
    const mapEl = document.getElementById('item-location-map');
    if (!mapEl || typeof L === 'undefined') return;
    if (mapEl._leaflet_id) return; // already initialised

    const zip = item.zip || (settings && settings.sellerZip) || '';
    const query = zip ? zip + ', USA' : null;
    if (!query) return;

    mapEl.style.display = 'block';

    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=1',
        { headers: { 'User-Agent': 'GregsMarketplace/1.0' } }
      );
      const results = await res.json();
      if (!results.length) { mapEl.style.display = 'none'; return; }

      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);

      const map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lon], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      // Shaded circle ~0.5 mile radius
      L.circle([lat, lon], {
        radius: 800,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      L.popup({ closeButton: false, className: 'inq-map-popup', offset: [0, -4] })
        .setLatLng([lat, lon])
        .setContent('Approximate pickup area')
        .openOn(map);

    } catch (_) {
      mapEl.style.display = 'none';
    }
  }

  async function submitInquiry(item) {
    const errEl = document.getElementById('inq-error');
    errEl.hidden = true;

    const name          = document.getElementById('inq-name').value.trim();
    const fulfillmentEl = document.querySelector('input[name=fulfillment]:checked');
    const paymentEl     = document.querySelector('input[name=payment]:checked');
    const replyEl       = document.querySelector('input[name=replyMethod]:checked');
    const contact       = document.getElementById('inq-contact').value.trim();
    const question      = document.getElementById('inq-question').value.trim();

    if (!name)          { showInqError('Please enter your name.'); return; }
    if (!fulfillmentEl) { showInqError('Please select a fulfillment preference.'); return; }
    if (!paymentEl)     { showInqError('Please select a payment preference.'); return; }
    if (!replyEl)       { showInqError('Please select a preferred reply method.'); return; }
    if (!contact)       { showInqError(replyEl.value === 'email' ? 'Please enter your email address.' : 'Please enter your phone number.'); return; }

    const btn = document.getElementById('inq-submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId:      item.id,
          itemTitle:   item.title,
          name,
          fulfillment: fulfillmentEl.value,
          payment:     paymentEl.value,
          replyMethod: replyEl.value,
          contact,
          question,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed. Please try again.');

      document.getElementById('inq-form-wrap').innerHTML = `
        <div class="inq-confirmation">
          <div class="inq-confirm-icon">✓</div>
          <p>Thank you, I'll try to get back to you within 12h!</p>
        </div>`;

    } catch (ex) {
      showInqError(ex.message);
      btn.disabled    = false;
      btn.textContent = 'Send Inquiry →';
    }
  }

  function showInqError(msg) {
    const el = document.getElementById('inq-error');
    el.textContent = msg;
    el.hidden = false;
  }

  /* --- Gallery --------------------------------------------- */
  function renderGallery(photoList, isSold) {
    const mainImg = document.getElementById('gallery-main-img');
    const thumbsEl = document.getElementById('gallery-thumbs');
    const soldBadge = document.getElementById('gallery-sold-badge');

    if (!mainImg) return;

    mainImg.src = photoList[0];
    mainImg.alt = currentItem ? currentItem.title : 'Item photo';

    if (soldBadge) soldBadge.classList.toggle('hidden', !isSold);

    if (thumbsEl) {
      thumbsEl.innerHTML = photoList.map((src, i) => `
        <div class="gallery-thumb${i === 0 ? ' active' : ''}" data-index="${i}" role="button" tabindex="0" aria-label="View photo ${i+1}">
          <img src="${escAttr(src)}" alt="Photo ${i+1}" loading="lazy" onerror="this.src='/images/placeholder.svg'">
        </div>`).join('');

      thumbsEl.addEventListener('click', e => {
        const thumb = e.target.closest('.gallery-thumb');
        if (!thumb) return;
        const idx = parseInt(thumb.dataset.index);
        setMainPhoto(idx);
      });
      thumbsEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          const thumb = e.target.closest('.gallery-thumb');
          if (thumb) setMainPhoto(parseInt(thumb.dataset.index));
        }
      });
    }

    // Click main to open lightbox
    const mainWrap = document.getElementById('gallery-main');
    if (mainWrap) {
      mainWrap.addEventListener('click', () => openLightbox(lightboxIndex));
    }

    // Detect portrait orientation and apply side-stack layout
    applyPortraitLayout(photoList);
  }

  function applyPortraitLayout(photoList) {
    const gallery = document.querySelector('.item-gallery');
    if (!gallery) return;

    // Remove existing side stack
    const existing = gallery.querySelector('.gallery-side-stack');
    if (existing) existing.remove();
    gallery.classList.remove('portrait-layout');

    const probe = new Image();
    probe.onload = () => {
      const isPortrait = probe.naturalHeight > probe.naturalWidth * 1.1;
      if (!isPortrait || photoList.length < 2) return;

      gallery.classList.add('portrait-layout');
      const mainEl = document.getElementById('gallery-main');
      if (!mainEl) return;

      const sidePhotos = photoList.slice(1, 4);
      const stack = document.createElement('div');
      stack.className = 'gallery-side-stack';
      stack.innerHTML = sidePhotos.map((src, i) => `
        <div class="gallery-side-item" data-index="${i + 1}" role="button" tabindex="0" aria-label="View photo ${i + 2}">
          <img src="${escAttr(src)}" alt="Photo ${i + 2}" loading="lazy" onerror="this.src='/images/placeholder.svg'">
        </div>`).join('');

      mainEl.after(stack);

      stack.addEventListener('click', e => {
        const sitem = e.target.closest('.gallery-side-item');
        if (sitem) setMainPhoto(parseInt(sitem.dataset.index));
      });
      stack.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          const sitem = e.target.closest('.gallery-side-item');
          if (sitem) setMainPhoto(parseInt(sitem.dataset.index));
        }
      });
    };
    probe.src = photoList[0];
  }

  function setMainPhoto(idx) {
    lightboxIndex = idx;
    const mainImg = document.getElementById('gallery-main-img');
    if (mainImg) {
      mainImg.style.opacity = '0';
      mainImg.src = photos[idx];
      mainImg.onload = () => { mainImg.style.opacity = '1'; };
    }
    document.querySelectorAll('.gallery-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === idx);
    });
  }

  /* --- Inline Shipping Info (inquiry form) ----------------- */
  function buildInqShippingHtml(item) {
    const type = shippingTypeForItem(item);
    const cfg = SHIPPING_CONFIGS[type] || SHIPPING_CONFIGS.standard;
    return `
      <div class="inq-shipping-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        ${cfg.rate ? `<strong>${cfg.rate} flat rate</strong> — ` : ''}${cfg.detail}
      </div>`;
  }

  /* --- Flat Shipping --------------------------------------- */
  const SHIPPING_CONFIGS = {
    small:     { rate: '$10',  detail: 'Flat $10 shipping anywhere in the continental US.' },
    standard:  { rate: '$20',  detail: 'Flat $20 shipping anywhere in the continental US.' },
    bicycle:   { rate: '$250', detail: 'Flat $250 shipping via <strong>Bike Flights</strong> — professionally packed and insured, anywhere in the continental US.' },
    furniture: { rate: null,   detail: 'Local pickup or freight delivery — contact me to coordinate. A deposit is required with the balance due at pickup or delivery.' },
  };

  const SHIPPING_POLICY = 'I\'ll refund any shipping cost in excess of what\'s actually charged, and will absorb any overage up to $25. Rates apply to deliveries within the continental US. Contact me for international shipping rates.';

  function shippingTypeForItem(item) {
    if (item.shippingType) return item.shippingType;
    const cat = item.category || '';
    if (cat === 'Bicycles & Parts') return 'bicycle';
    if (cat === 'Furniture & Household Items') return 'furniture';
    if (cat === 'Clothing & Accessories' || cat === 'Misc') return 'small';
    return 'standard';
  }

  function buildFlatShippingHtml(item) {
    const type = shippingTypeForItem(item);
    const cfg = SHIPPING_CONFIGS[type] || SHIPPING_CONFIGS.standard;
    const rateHtml = cfg.rate
      ? `<div class="flat-ship-rate">${cfg.rate} flat rate</div>`
      : `<div class="flat-ship-rate flat-ship-contact">Contact seller for shipping</div>`;
    const policyHtml = cfg.rate
      ? `<div class="flat-ship-policy">${SHIPPING_POLICY}</div>`
      : '';
    return `
      <div class="flat-ship-detail">${cfg.detail}</div>
      ${policyHtml}`;
  }

  function renderFlatShipping(item) {
    const wrap = document.getElementById('shipping-estimate');
    if (!wrap) return;
    const type = shippingTypeForItem(item);
    const cfg = SHIPPING_CONFIGS[type] || SHIPPING_CONFIGS.standard;
    wrap.innerHTML = `
      <div class="flat-ship-box">
        <div class="flat-ship-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Shipping
        </div>
        ${cfg.rate
          ? `<div class="flat-ship-rate">${cfg.rate} flat rate</div>`
          : `<div class="flat-ship-rate flat-ship-contact">Contact seller</div>`
        }
        <div class="flat-ship-detail">${cfg.detail}</div>
        ${cfg.rate ? `<div class="flat-ship-policy">${SHIPPING_POLICY}</div>` : ''}
      </div>`;
  }

  /* --- Lightbox -------------------------------------------- */
  function initLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeLightbox();
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', () => {
      lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
      updateLightbox();
    });
    document.getElementById('lightbox-next').addEventListener('click', () => {
      lightboxIndex = (lightboxIndex + 1) % photos.length;
      updateLightbox();
    });

    // Touch swipe
    let touchStartX = 0;
    overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          lightboxIndex = (lightboxIndex + 1) % photos.length;
        } else {
          lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
        }
        updateLightbox();
      }
    }, { passive: true });
  }

  function openLightbox(idx) {
    lightboxIndex = idx;
    const overlay = document.getElementById('lightbox-overlay');
    if (!overlay) return;
    updateLightbox();
    overlay.classList.add('open');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Keyboard nav
    document.addEventListener('keydown', onLightboxKey);
  }

  function closeLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onLightboxKey);
  }

  function onLightboxKey(e) {
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key === 'ArrowRight') { lightboxIndex = (lightboxIndex + 1) % photos.length; updateLightbox(); }
    if (e.key === 'ArrowLeft') { lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length; updateLightbox(); }
  }

  function updateLightbox() {
    const img = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    if (img) { img.src = photos[lightboxIndex]; }
    if (counter) counter.textContent = `${lightboxIndex + 1} / ${photos.length}`;
    if (prevBtn) prevBtn.style.display = photos.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = photos.length > 1 ? 'flex' : 'none';

    setMainPhoto(lightboxIndex);
  }

  /* --- Accordions ------------------------------------------ */
  function initAccordions() {
    document.querySelectorAll('.accordion-item').forEach(item => {
      const header = item.querySelector('.accordion-header');
      const body = item.querySelector('.accordion-body');
      if (!header || !body) return;

      header.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        if (isOpen) {
          item.classList.remove('open');
          body.style.maxHeight = null;
        } else {
          item.classList.add('open');
          body.style.maxHeight = body.scrollHeight + 'px';
        }
      });

      // Open first accordion by default
      if (item.classList.contains('open')) {
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
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
