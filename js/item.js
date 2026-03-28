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
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');
    if (!itemId) { window.location.href = '/'; return; }

    inventory = await loadInventory();
    applyAwayBanner(inventory.settings);
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
        const ebayPrice = item.crossListings.ebayPrice
          ? item.crossListings.ebayPrice
          : Math.round(item.price / 0.90);
        const fbPrice = item.crossListings.facebookPrice
          ? item.crossListings.facebookPrice
          : Math.round(item.price / 0.80);
        const rows = [];

        if (item.crossListings.ebay) {
          rows.push(`
            <a href="${escAttr(item.crossListings.ebay)}" target="_blank" rel="noopener noreferrer" class="cross-platform-row cross-row-ebay">
              <div class="cross-platform-logo">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2 9.5C2 7 3.5 5 6.5 5c2.5 0 4 1.3 4.3 3.3H9c-.2-1.3-1.1-2.1-2.5-2.1C4.5 6.2 3.3 7.6 3.3 9.5s1.2 3.3 3.2 3.3c1.4 0 2.3-.8 2.6-2.1h1.8C10.5 12.7 9 14 6.5 14 3.5 14 2 12 2 9.5zm10.8 3.7 2.5-4.6 2.5 4.6h-5zm-.8-7h1.8l4 7.3-1.2 2.2-1-1.8H11l-1 1.8-1.2-2.2 4-7.3z"/></svg>
              </div>
              <div class="cross-platform-info">
                <span class="cross-platform-name">Also on eBay</span>
                <span class="cross-platform-note">Buyer protection &amp; returns</span>
              </div>
              <div class="cross-platform-price">$${formatPrice(ebayPrice)}</div>
            </a>`);
        }

        if (item.crossListings.facebook) {
          rows.push(`
            <a href="${escAttr(item.crossListings.facebook)}" target="_blank" rel="noopener noreferrer" class="cross-platform-row cross-row-facebook">
              <div class="cross-platform-logo">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
              </div>
              <div class="cross-platform-info">
                <span class="cross-platform-name">Also on Facebook Marketplace</span>
                <span class="cross-platform-note">Local pickup preferred</span>
              </div>
              <div class="cross-platform-price">$${formatPrice(fbPrice)}</div>
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
    if (condEl) condEl.textContent = item.condition || '';

    if (priceEl) {
      priceEl.textContent = `$${formatPrice(item.price)}`;
      if (item.sold) priceEl.classList.add('sold-price');
    }
    if (priceAreaEl && item.sold) {
      priceAreaEl.insertAdjacentHTML('beforeend', '<span class="item-sold-label">Sold</span>');
    }

    // Location — prefer per-item ZIP, fall back to global
    const locEl = document.getElementById('item-location');
    const zip = item.sellerZip || (settings && settings.sellerZip) || '';
    if (locEl && zip) {
      locEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Seller ZIP: ${escHtml(zip)}`;
    }

    // PayPal
    renderPayPal(item, settings);

    // Shipping estimate — use per-item ZIP if available
    renderShippingEstimate(item, settings);

    // Accordion content
    const descEl = document.getElementById('acc-description');
    if (descEl) descEl.textContent = item.description || 'No description provided.';

    const detailsEl = document.getElementById('acc-details');
    if (detailsEl && item.details && Object.keys(item.details).length) {
      detailsEl.innerHTML = `<table class="details-table">${
        Object.entries(item.details).map(([k, v]) =>
          `<tr><td>${escHtml(k)}</td><td>${escHtml(String(v))}</td></tr>`
        ).join('')
      }</table>`;
    }

    const shippingEl = document.getElementById('acc-shipping');
    if (shippingEl && item.shipping) {
      const s = item.shipping;
      const lines = [];
      if (s.localPickup) lines.push('<strong>Local Pickup:</strong> Available');
      if (s.available) {
        if (s.estimatedNationalCost > 0) {
          lines.push(`<strong>Estimated Shipping:</strong> $${formatPrice(s.estimatedLocalCost)} local / $${formatPrice(s.estimatedNationalCost)} national`);
        } else {
          lines.push('<strong>Shipping:</strong> Available – price calculated based on your location');
        }
      } else {
        lines.push('<strong>Shipping:</strong> Local pickup only – item cannot be shipped economically');
      }
      if (s.notes) lines.push(`<strong>Note:</strong> ${escHtml(s.notes)}`);
      shippingEl.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
    }
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

  /* --- PayPal ---------------------------------------------- */
  function renderPayPal(item, settings) {
    const area = document.getElementById('paypal-area');
    if (!area) return;

    if (item.sold) {
      area.innerHTML = `
        <div class="sold-notice">
          <strong>This item has been sold</strong>
          <p>Check back for more listings or browse other items.</p>
        </div>
        <a href="/" class="btn btn-secondary" style="justify-content:center;margin-top:0.5rem">← Back to all listings</a>`;
      return;
    }

    if (settings && settings.sellerAwayMode) {
      area.innerHTML = `
        <div class="sold-notice" style="background:#fef3c7;border-color:#fde68a;color:#92400e;">
          <strong>Seller is currently away</strong>
          <p>${escHtml(settings.sellerAwayMessage || 'Check back soon!')}</p>
        </div>`;
      return;
    }

    const paypalMe = (settings && settings.paypalMe) ? settings.paypalMe : '';
    const amount = formatPrice(item.price);
    let paypalUrl;
    if (paypalMe && paypalMe !== 'YourPayPalUsername') {
      paypalUrl = `https://www.paypal.me/${encodeURIComponent(paypalMe)}/${amount}`;
    } else {
      const email = (settings && settings.paypalEmail) ? settings.paypalEmail : '';
      paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(email)}&item_name=${encodeURIComponent(item.title)}&amount=${amount}&currency_code=USD&no_note=0`;
    }

    area.innerHTML = `
      <a href="${escAttr(paypalUrl)}" target="_blank" rel="noopener noreferrer" class="paypal-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 00-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 00.554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 01.923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
        Buy Now with PayPal – $${amount}
      </a>
      <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:0.25rem">
        Secure checkout via PayPal. You do not need a PayPal account.
      </p>`;
  }

  /* --- Shipping Estimate ------------------------------------ */
  function renderShippingEstimate(item, settings) {
    const wrap = document.getElementById('shipping-estimate');
    if (!wrap) return;

    if (!item.shipping || !item.shipping.available) {
      wrap.innerHTML = `<p class="no-ship-msg">📦 Local pickup only – this item cannot be shipped.</p>`;
      return;
    }

    const sellerZip = item.sellerZip || (settings && settings.sellerZip) || '';

    wrap.innerHTML = `
      <h4>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        Estimate Shipping Cost
      </h4>
      <form class="zip-form" id="zip-form">
        <input type="text" class="zip-input" id="buyer-zip" placeholder="Your ZIP code" maxlength="5" pattern="[0-9]{5}" inputmode="numeric" ${sellerZip ? '' : 'disabled'}>
        <button type="submit" class="zip-btn">Estimate</button>
      </form>
      <div id="shipping-result"></div>`;

    document.getElementById('zip-form').addEventListener('submit', e => {
      e.preventDefault();
      const buyerZip = document.getElementById('buyer-zip').value.trim();
      if (buyerZip.length !== 5 || !/^\d{5}$/.test(buyerZip)) {
        showShippingResult('Please enter a valid 5-digit ZIP code.', null);
        return;
      }
      estimateShipping(buyerZip, sellerZip, item.shipping);
    });
  }

  function estimateShipping(buyerZip, sellerZip, shipping) {
    const zone = getShippingZone(sellerZip, buyerZip);
    const localCost = shipping.estimatedLocalCost || 0;
    const nationalCost = shipping.estimatedNationalCost || 0;

    let cost, zoneLabel;
    if (zone === 'same') {
      if (!shipping.available) {
        showShippingResult('Local pickup only from seller ZIP ' + sellerZip + '.', null);
        return;
      }
      cost = localCost;
      zoneLabel = 'Local / Nearby';
    } else if (zone === 'regional') {
      cost = Math.round(localCost + (nationalCost - localCost) * 0.5);
      zoneLabel = 'Regional';
    } else {
      cost = nationalCost;
      zoneLabel = 'National';
    }

    if (shipping.localPickup && zone === 'same') {
      showShippingResult(
        `<span class="ship-cost">Free local pickup available!</span> Seller ZIP: ${escHtml(sellerZip)}`,
        'Shipping zone: ' + zoneLabel + (cost > 0 ? ` | Estimated ship cost: ~$${formatPrice(cost)}` : '')
      );
    } else if (!shipping.available) {
      showShippingResult('This item is local pickup only.', 'Seller ZIP: ' + escHtml(sellerZip));
    } else {
      showShippingResult(
        `<span class="ship-cost">Estimated shipping: ~$${formatPrice(cost)}</span>`,
        `Shipping zone: ${zoneLabel} | This is an estimate — actual cost calculated at shipment.`
      );
    }
  }

  function getShippingZone(sellerZip, buyerZip) {
    if (!sellerZip || !buyerZip) return 'national';
    const s = parseInt(sellerZip.charAt(0));
    const b = parseInt(buyerZip.charAt(0));
    if (sellerZip.substring(0, 3) === buyerZip.substring(0, 3)) return 'same';
    if (Math.abs(s - b) <= 1) return 'regional';
    return 'national';
  }

  function showShippingResult(main, sub) {
    const el = document.getElementById('shipping-result');
    if (!el) return;
    el.innerHTML = `
      <div class="shipping-result">
        <div class="ship-cost">${main}</div>
        ${sub ? `<div class="ship-note">${sub}</div>` : ''}
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
