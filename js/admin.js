/* ============================================================
   Greg's Marketplace – Admin Panel
   ============================================================ */
(function () {
  'use strict';

  const CATEGORIES = ['Bicycles & Parts', 'Autos & Parts', 'Furniture & Household Items', 'Clothing & Accessories', 'Misc'];
  const PACKAGE_SIZES = ['small', 'medium', 'large', 'freight'];

  let adminToken = sessionStorage.getItem('gm_admin_token') || '';
  let inventory = null;
  let filterCategory = '';
  let filterStatus = '';
  let searchText = '';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (adminToken) {
      showPanel();
    } else {
      showLogin();
    }
    bindLoginForm();
  }

  /* ---- Auth ----------------------------------------------- */
  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
  }

  function showPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'flex';
    loadAndRender();
    bindPanelEvents();
    // Expose API for photo-editor.js
    window._adminAPI = {
      getInventory: () => inventory,
      getToken: () => adminToken,
      saveInventory,
      showToast,
    };
  }

  function bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pw = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');
      const err = document.getElementById('login-error');
      btn.disabled = true;
      btn.textContent = 'Verifying…';
      err.classList.remove('visible');

      try {
        const res = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          adminToken = data.token;
          sessionStorage.setItem('gm_admin_token', adminToken);
          showPanel();
        } else {
          throw new Error(data.error || 'Invalid password');
        }
      } catch (ex) {
        err.textContent = ex.message || 'Login failed.';
        err.classList.add('visible');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log In';
      }
    });
  }

  /* ---- Data ----------------------------------------------- */
  async function loadInventory() {
    try {
      const res = await fetch('/api/inventory', {
        headers: { 'x-admin-token': adminToken }
      });
      if (res.ok) {
        const d = await res.json();
        if (d && d.items) return d;
      }
    } catch (_) {}
    const res = await fetch('/data/inventory.json');
    return res.json();
  }

  async function saveInventory(inv) {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify(inv)
    });
    if (res.status === 401) {
      sessionStorage.removeItem('gm_admin_token');
      adminToken = '';
      showLogin();
      throw new Error('Session expired – please log in again.');
    }
    if (!res.ok) throw new Error('Failed to save.');
    return res.json();
  }

  let inquiryData = null;

  async function loadAndRender() {
    inventory = await loadInventory();
    renderStats();
    renderItems();
    renderSettings();
    applyAwayToggle();
    loadInquiries();
  }

  async function loadInquiries() {
    try {
      const res = await fetch('/api/inquiries', { headers: { 'x-admin-token': adminToken } });
      if (res.ok) {
        inquiryData = await res.json();
        renderInquiries();
        updateInquiryBadge();
      }
    } catch (_) {}
  }

  function updateInquiryBadge() {
    const badge = document.getElementById('inquiry-count-badge');
    if (!badge || !inquiryData) return;
    const newCount = (inquiryData.inquiries || []).filter(i => i.status === 'new').length;
    badge.textContent = newCount;
    badge.style.display = newCount > 0 ? '' : 'none';
  }

  function renderInquiries() {
    const list = document.getElementById('inquiries-list');
    if (!list || !inquiryData) return;
    const inquiries = inquiryData.inquiries || [];

    if (!inquiries.length) {
      list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)">No inquiries yet.</div>`;
      return;
    }

    const FULFILLMENT_LABELS = { ship: 'Ship', local_pickup: 'Local Pickup', freight: 'Freight' };
    const PAYMENT_LABELS = { paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle', cash: 'Cash' };
    const REPLY_LABELS = { text: 'Text', call: 'Call', email: 'Email' };
    const STATUS_CLASS = { new: 'status-available', read: 'status-hidden', responded: 'status-sold' };

    list.innerHTML = inquiries.map(inq => {
      const date = new Date(inq.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `
        <div class="inq-card" data-id="${escAttr(inq.id)}">
          <div class="inq-card-header">
            <div class="inq-card-meta">
              <span class="status-badge ${STATUS_CLASS[inq.status] || 'status-hidden'}">${inq.status}</span>
              <strong>${escHtml(inq.name)}</strong>
              <span class="inq-card-item">re: ${escHtml(inq.itemTitle)}</span>
            </div>
            <div class="inq-card-date">${date}</div>
          </div>
          <div class="inq-card-body">
            <div class="inq-detail-row">
              <span class="inq-detail-label">Fulfillment</span>
              <span>${escHtml(FULFILLMENT_LABELS[inq.fulfillment] || inq.fulfillment)}</span>
            </div>
            <div class="inq-detail-row">
              <span class="inq-detail-label">Payment</span>
              <span>${escHtml(PAYMENT_LABELS[inq.payment] || inq.payment)}</span>
            </div>
            <div class="inq-detail-row">
              <span class="inq-detail-label">Reply via</span>
              <span>${escHtml(REPLY_LABELS[inq.replyMethod] || inq.replyMethod)} — ${escHtml(inq.contact)}</span>
            </div>
            ${inq.pickupTimes ? `<div class="inq-detail-row"><span class="inq-detail-label">Pickup Times</span><span>${escHtml(inq.pickupTimes)}</span></div>` : ''}
            ${inq.question ? `<div class="inq-detail-row inq-question"><span class="inq-detail-label">Question</span><span>${escHtml(inq.question)}</span></div>` : ''}
          </div>
          <div class="inq-card-actions">
            ${inq.status === 'new' ? `<button class="btn btn-xs btn-secondary mark-read-btn" data-id="${escAttr(inq.id)}">Mark Read</button>` : ''}
            ${inq.status !== 'responded' ? `<button class="btn btn-xs btn-success mark-responded-btn" data-id="${escAttr(inq.id)}">Mark Responded</button>` : ''}
            <a href="/item.html?id=${encodeURIComponent(inq.itemId)}" target="_blank" class="btn btn-xs btn-secondary">View Listing ↗</a>
          </div>
        </div>`;
    }).join('');

    bindInquiryActions();
  }

  function bindInquiryActions() {
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await updateInquiry(btn.dataset.id, { status: 'read' });
      });
    });
    document.querySelectorAll('.mark-responded-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await updateInquiry(btn.dataset.id, { status: 'responded' });
      });
    });
  }

  async function updateInquiry(id, patch) {
    try {
      const res = await fetch('/api/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, ...patch }),
      });
      if (res.ok) {
        const inq = (inquiryData.inquiries || []).find(i => i.id === id);
        if (inq) Object.assign(inq, patch);
        renderInquiries();
        updateInquiryBadge();
        showToast('Inquiry updated', 'success');
      }
    } catch (ex) { showToast(ex.message, 'error'); }
  }

  /* ---- Navigation ----------------------------------------- */
  function bindPanelEvents() {
    // Nav items
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.section;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        const sectionEl = document.getElementById('section-' + sec);
        if (sectionEl) sectionEl.classList.add('active');
        document.getElementById('topbar-title').textContent = btn.querySelector('span') ? btn.querySelector('span').textContent : sec;
        closeSidebar();
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      sessionStorage.removeItem('gm_admin_token');
      adminToken = '';
      showLogin();
    });

    // Mobile sidebar
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Away toggle
    const awayToggle = document.getElementById('away-toggle');
    if (awayToggle) {
      awayToggle.addEventListener('change', async () => {
        inventory.settings.sellerAwayMode = awayToggle.checked;
        try {
          await saveInventory(inventory);
          showToast(awayToggle.checked ? 'Seller away mode ON' : 'Seller away mode OFF', awayToggle.checked ? 'warning' : 'success');
        } catch (ex) { showToast(ex.message, 'error'); }
      });
    }

    // Item search / filter
    const searchInput = document.getElementById('admin-item-search');
    if (searchInput) {
      let t;
      searchInput.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { searchText = searchInput.value.trim(); renderItems(); }, 200);
      });
    }
    document.getElementById('filter-category').addEventListener('change', e => { filterCategory = e.target.value; renderItems(); });
    document.getElementById('filter-status').addEventListener('change', e => { filterStatus = e.target.value; renderItems(); });

    // Add item button
    document.getElementById('add-item-btn').addEventListener('click', openAddItemModal);
    document.getElementById('add-item-btn2').addEventListener('click', openAddItemModal);

    // Add item form submit
    document.getElementById('add-item-form').addEventListener('submit', submitNewItem);

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Refresh inquiries
    const refreshInqBtn = document.getElementById('btn-refresh-inquiries');
    if (refreshInqBtn) refreshInqBtn.addEventListener('click', loadInquiries);

    // Settings form
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
    bindFAQForm();
    bindAvatarUpload();
    bindDataTools();
  }

  function closeSidebar() {
    document.getElementById('admin-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  }

  /* ---- Away Toggle ---------------------------------------- */
  function applyAwayToggle() {
    const toggle = document.getElementById('away-toggle');
    if (toggle && inventory && inventory.settings) {
      toggle.checked = !!inventory.settings.sellerAwayMode;
    }
  }

  /* ---- Stats ---------------------------------------------- */
  function renderStats() {
    if (!inventory) return;
    const total = inventory.items.length;
    const sold = inventory.items.filter(i => i.sold).length;
    const available = total - sold;
    const totalValue = inventory.items.filter(i => !i.sold).reduce((s, i) => s + Number(i.price), 0);

    setText('stat-total', total);
    setText('stat-available', available);
    setText('stat-sold', sold);
    setText('stat-value', '$' + formatPrice(totalValue));

    // Update nav badge
    const soldBadge = document.getElementById('sold-count-badge');
    if (soldBadge) soldBadge.textContent = sold;
  }

  /* ---- Items List ----------------------------------------- */
  function renderItems() {
    if (!inventory) return;
    let items = inventory.items.slice();

    if (filterCategory) items = items.filter(i => i.category === filterCategory);
    if (filterStatus === 'available') items = items.filter(i => !i.sold && !i.hidden);
    if (filterStatus === 'sold') items = items.filter(i => i.sold);
    if (filterStatus === 'hidden') items = items.filter(i => i.hidden);
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }

    const list = document.getElementById('items-list');
    if (!list) return;

    if (items.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">No items match your filter.</div>`;
      return;
    }

    list.innerHTML = items.map(item => buildItemCard(item)).join('');
    bindCardActions();
  }

  function buildItemCard(item) {
    const photo = (item.photos && item.photos.length) ? item.photos[0] : '/images/placeholder.svg';
    const statusClass = item.hidden ? 'status-hidden' : item.sold ? 'status-sold' : 'status-available';
    const statusLabel = item.hidden ? 'Hidden' : item.sold ? 'Sold' : 'Available';
    const cl = item.crossListings || {};

    const shippingOptions = [
      ['', 'Auto-detect'],
      ['small', '$10 – Small'],
      ['standard', '$20 – Standard'],
      ['bicycle', '$250 – Bike Flights'],
      ['furniture', 'Contact – Freight'],
    ].map(([v, l]) => `<option value="${v}"${(item.shippingType || '') === v ? ' selected' : ''}>${escHtml(l)}</option>`).join('');

    const categoryOptions = CATEGORIES.map(c =>
      `<option value="${escAttr(c)}"${c === item.category ? ' selected' : ''}>${escHtml(c)}</option>`
    ).join('');

    const detailPairsHtml = Object.entries(item.details || {}).map(([k, v]) => `
      <div class="detail-pair-row">
        <input class="detail-key-input settings-input" value="${escAttr(k)}" placeholder="Label">
        <input class="detail-val-input settings-input" value="${escAttr(v)}" placeholder="Value">
        <div class="detail-row-btns">
          <button type="button" class="btn btn-xs btn-secondary move-detail-up" title="Move up">▲</button>
          <button type="button" class="btn btn-xs btn-secondary move-detail-down" title="Move down">▼</button>
          <button type="button" class="btn btn-xs btn-danger delete-detail-row" title="Remove">✕</button>
        </div>
      </div>`).join('');

    return `
      <div class="item-card" data-id="${escAttr(item.id)}">
        <div class="item-card-header">
          <img class="item-thumb" src="${escAttr(photo)}" alt="" onerror="this.src='/images/placeholder.svg'">
          <div class="item-card-info">
            <div class="item-card-title">${escHtml(item.title)}</div>
            <div class="item-card-meta">${escHtml(item.category)} · $${formatPrice(item.price)}</div>
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <div class="item-card-quick">
            <button class="btn btn-xs ${item.sold ? 'btn-success' : 'btn-secondary'} quick-toggle-sold" data-id="${escAttr(item.id)}">${item.sold ? 'Mark Available' : 'Mark Sold'}</button>
            <button class="btn btn-xs ${item.hidden ? 'btn-warning' : 'btn-secondary'} quick-toggle-hidden" data-id="${escAttr(item.id)}">${item.hidden ? '👁 Show' : '🙈 Hide'}</button>
            <a href="/item.html?id=${encodeURIComponent(item.id)}" target="_blank" class="btn btn-xs btn-secondary">↗ View</a>
          </div>
          <button class="btn btn-sm btn-secondary item-card-expand" data-id="${escAttr(item.id)}">Edit ▾</button>
        </div>
        <div class="item-card-body" id="card-body-${escAttr(item.id)}" hidden>
          <div class="item-edit-grid">
            <div class="item-edit-section">
              <h4 class="item-edit-section-title">Basic Info</h4>
              <div class="item-edit-fields">
                <div class="item-edit-field">
                  <label class="settings-label">Title</label>
                  <input type="text" class="ie-title settings-input" value="${escAttr(item.title)}">
                </div>
                <div class="item-edit-row2">
                  <div class="item-edit-field">
                    <label class="settings-label">Price ($)</label>
                    <input type="number" class="ie-price settings-input" value="${escAttr(item.price)}" min="0" step="0.01">
                  </div>
                  <div class="item-edit-field">
                    <label class="settings-label">Item ZIP</label>
                    <input type="text" class="ie-zip settings-input" value="${escAttr(item.zip || '')}" placeholder="e.g. 80202" maxlength="10">
                  </div>
                </div>
                <div class="item-edit-field">
                  <label class="settings-label">Condition</label>
                  <input type="text" class="ie-condition settings-input" value="${escAttr(item.condition || '')}">
                </div>
                <div class="item-edit-row2">
                  <div class="item-edit-field">
                    <label class="settings-label">Category</label>
                    <select class="ie-category settings-input">${categoryOptions}</select>
                  </div>
                  <div class="item-edit-field">
                    <label class="settings-label">Shipping</label>
                    <select class="ie-shipping settings-input">${shippingOptions}</select>
                  </div>
                </div>
                <div class="item-edit-field">
                  <label class="settings-label">Exact Pickup Address (hidden)</label>
                  <input type="text" class="ie-pickup-address settings-input" value="${escAttr(item.pickupAddress || '')}" placeholder="123 Main St, Highlands Ranch CO 80129">
                  <span class="settings-hint">Only shown to buyer after you toggle "Confirmed" below</span>
                </div>
                <div class="item-edit-field" style="flex-direction:row;align-items:center;gap:0.6rem">
                  <button type="button" class="btn btn-sm ${item.pickupConfirmed ? 'btn-success' : 'btn-secondary'} quick-toggle-pickup" data-id="${escAttr(item.id)}" title="Toggle whether exact address is visible to buyer">
                    ${item.pickupConfirmed ? '📍 Address Confirmed' : '📍 Confirm Address'}
                  </button>
                  <span class="settings-hint">${item.pickupConfirmed ? 'Exact address is shown to buyer' : 'Showing approximate area only'}</span>
                </div>
              </div>
            </div>
            <div>
              <div class="item-edit-section">
                <h4 class="item-edit-section-title">Cross-Listings</h4>
                <div class="item-edit-fields">
                  <div class="item-edit-field">
                    <label class="settings-label">eBay URL</label>
                    <input type="url" class="ie-ebay-url settings-input" value="${escAttr(cl.ebay || '')}" placeholder="https://www.ebay.com/itm/…">
                  </div>
                  <div class="item-edit-field">
                    <label class="settings-label">eBay Price ($)</label>
                    <input type="number" class="ie-ebay-price settings-input" value="${escAttr(cl.ebayPrice || '')}" min="0" step="0.01">
                  </div>
                  <div class="item-edit-field">
                    <label class="settings-label">Facebook URL</label>
                    <input type="url" class="ie-fb-url settings-input" value="${escAttr(cl.facebook || '')}" placeholder="https://www.facebook.com/marketplace/…">
                  </div>
                  <div class="item-edit-field">
                    <label class="settings-label">Facebook Price ($)</label>
                    <input type="number" class="ie-fb-price settings-input" value="${escAttr(cl.facebookPrice || '')}" min="0" step="0.01">
                  </div>
                </div>
              </div>
              <div class="item-edit-section" style="margin-top:0.75rem">
                <h4 class="item-edit-section-title">Visibility</h4>
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
                  <button type="button" class="btn btn-sm ${item.featured ? 'btn-primary' : 'btn-secondary'} quick-toggle-featured" data-id="${escAttr(item.id)}">${item.featured ? '⭐ Featured' : '☆ Feature'}</button>
                  ${item.sold ? `<button type="button" class="btn btn-sm ${item.showInSold ? 'btn-success' : 'btn-secondary'} quick-toggle-show-sold" data-id="${escAttr(item.id)}">${item.showInSold ? '📋 In Sold tab' : '📋 Add to Sold tab'}</button>` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="item-edit-section item-edit-full">
            <h4 class="item-edit-section-title">Description</h4>
            <textarea class="ie-description settings-input settings-textarea" rows="5">${escHtml(item.description || '')}</textarea>
          </div>

          <div class="item-edit-section item-edit-full">
            <h4 class="item-edit-section-title">Item Details</h4>
            <div class="details-pairs-container" id="details-pairs-${escAttr(item.id)}">${detailPairsHtml}</div>
            <button type="button" class="btn btn-xs btn-secondary add-detail-row" style="margin-top:0.5rem">+ Add Row</button>
          </div>

          <div class="item-edit-footer">
            <div style="display:flex;gap:0.5rem;align-items:center">
              <button type="button" class="btn btn-primary save-item-btn" data-id="${escAttr(item.id)}">Save Changes</button>
              <button type="button" class="btn btn-secondary photos-btn" data-id="${escAttr(item.id)}">📸 Photos${item.photos && item.photos.length ? ` (${item.photos.length})` : ''}</button>
            </div>
            <button type="button" class="btn btn-danger delete-item-btn" data-id="${escAttr(item.id)}">🗑 Delete</button>
          </div>
        </div>
      </div>`;
  }

  function bindDetailRowBtns(container) {
    container.querySelectorAll('.delete-detail-row').forEach(btn => {
      btn.onclick = () => btn.closest('.detail-pair-row').remove();
    });
    container.querySelectorAll('.move-detail-up').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.detail-pair-row');
        const prev = row.previousElementSibling;
        if (prev) container.insertBefore(row, prev);
      };
    });
    container.querySelectorAll('.move-detail-down').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.detail-pair-row');
        const next = row.nextElementSibling;
        if (next) container.insertBefore(next, row);
      };
    });
  }

  function bindCardActions() {
    // Expand / collapse
    document.querySelectorAll('.item-card-expand').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const body = document.getElementById('card-body-' + id);
        if (!body) return;
        const isOpen = !body.hidden;
        body.hidden = isOpen;
        btn.textContent = isOpen ? 'Edit ▾' : 'Close ▴';
      });
    });

    // Quick toggle sold
    document.querySelectorAll('.quick-toggle-sold').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        item.sold = !item.sold;
        btn.disabled = true;
        try {
          await saveInventory(inventory);
          renderItems();
          renderStats();
          showToast(item.sold ? `Marked "${item.title}" as sold` : `Marked "${item.title}" as available`, 'success');
        } catch (ex) {
          item.sold = !item.sold;
          showToast(ex.message, 'error');
        }
      });
    });

    // Quick toggle hidden
    document.querySelectorAll('.quick-toggle-hidden').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        item.hidden = !item.hidden;
        btn.disabled = true;
        try {
          await saveInventory(inventory);
          renderItems();
          renderStats();
          showToast(item.hidden ? `"${item.title}" hidden from site` : `"${item.title}" visible on site`, item.hidden ? 'warning' : 'success');
        } catch (ex) {
          item.hidden = !item.hidden;
          showToast(ex.message, 'error');
        }
      });
    });

    // Quick toggle featured
    document.querySelectorAll('.quick-toggle-featured').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        item.featured = !item.featured;
        btn.disabled = true;
        try {
          await saveInventory(inventory);
          renderItems();
          showToast(item.featured ? `"${item.title}" marked as featured` : `"${item.title}" removed from featured`, 'success');
        } catch (ex) {
          item.featured = !item.featured;
          showToast(ex.message, 'error');
        }
      });
    });

    // Quick toggle showInSold
    document.querySelectorAll('.quick-toggle-show-sold').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        item.showInSold = !item.showInSold;
        btn.disabled = true;
        try {
          await saveInventory(inventory);
          renderItems();
          showToast(item.showInSold ? `"${item.title}" will appear in Sold tab` : `"${item.title}" removed from Sold tab`, 'success');
        } catch (ex) {
          item.showInSold = !item.showInSold;
          showToast(ex.message, 'error');
        }
      });
    });

    // Pickup address confirmed toggle
    document.querySelectorAll('.quick-toggle-pickup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        item.pickupConfirmed = !item.pickupConfirmed;
        btn.disabled = true;
        try {
          await saveInventory(inventory);
          renderItems();
          showToast(item.pickupConfirmed ? 'Exact pickup address is now visible to buyers' : 'Showing approximate area only', item.pickupConfirmed ? 'success' : 'warning');
        } catch (ex) {
          item.pickupConfirmed = !item.pickupConfirmed;
          showToast(ex.message, 'error');
        }
      });
    });

    // Add detail row
    document.querySelectorAll('.add-detail-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.item-card');
        if (!card) return;
        const id = card.dataset.id;
        const container = document.getElementById('details-pairs-' + id);
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'detail-pair-row';
        row.innerHTML = `
          <input class="detail-key-input settings-input" value="" placeholder="Label">
          <input class="detail-val-input settings-input" value="" placeholder="Value">
          <button type="button" class="btn btn-xs btn-danger delete-detail-row">✕</button>`;
        container.appendChild(row);
        bindDetailRowBtns(container);
        row.querySelector('.detail-key-input').focus();
      });
    });

    // Detail delete buttons
    document.querySelectorAll('.details-pairs-container').forEach(container => {
      bindDetailRowBtns(container);
    });

    // Save all fields for an item
    document.querySelectorAll('.save-item-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        const body = document.getElementById('card-body-' + id);
        if (!body) return;

        const titleVal = body.querySelector('.ie-title').value.trim();
        if (!titleVal) { showToast('Title cannot be empty', 'error'); return; }

        const oldSnapshot = JSON.parse(JSON.stringify(item));

        item.title          = titleVal;
        item.price          = parseFloat(body.querySelector('.ie-price').value) || item.price;
        item.condition      = body.querySelector('.ie-condition').value.trim();
        item.category       = body.querySelector('.ie-category').value;
        item.zip            = body.querySelector('.ie-zip').value.trim() || null;
        item.shippingType   = body.querySelector('.ie-shipping').value || null;
        item.description    = body.querySelector('.ie-description').value.trim();
        item.pickupAddress  = body.querySelector('.ie-pickup-address').value.trim() || null;

        const ebayUrl   = body.querySelector('.ie-ebay-url').value.trim();
        const ebayPrice = parseFloat(body.querySelector('.ie-ebay-price').value) || null;
        const fbUrl     = body.querySelector('.ie-fb-url').value.trim();
        const fbPrice   = parseFloat(body.querySelector('.ie-fb-price').value) || null;
        item.crossListings = { ebay: ebayUrl, ebayPrice, facebook: fbUrl, facebookPrice: fbPrice };

        const pairsContainer = document.getElementById('details-pairs-' + id);
        const newDetails = {};
        pairsContainer.querySelectorAll('.detail-pair-row').forEach(row => {
          const k = row.querySelector('.detail-key-input').value.trim();
          const v = row.querySelector('.detail-val-input').value.trim();
          if (k) newDetails[k] = v;
        });
        item.details = newDetails;

        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await saveInventory(inventory);
          renderItems();
          renderStats();
          showToast(`"${item.title}" saved`, 'success');
        } catch (ex) {
          Object.assign(item, oldSnapshot);
          showToast(ex.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save Changes';
        }
      });
    });

    // Photos
    document.querySelectorAll('.photos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = inventory.items.find(i => i.id === btn.dataset.id);
        if (item && window.openPhotoManager) window.openPhotoManager(item);
      });
    });

    // Delete item
    document.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
        inventory.items = inventory.items.filter(i => i.id !== id);
        try {
          await saveInventory(inventory);
          renderItems();
          renderStats();
          showToast(`Deleted "${item.title}"`, 'success');
        } catch (ex) {
          inventory.items.push(item);
          showToast(ex.message, 'error');
        }
      });
    });
  }

  /* ---- Add Item ------------------------------------------- */
  function openAddItemModal() {
    document.getElementById('add-item-form').reset();
    openModal('add-item-modal');
  }

  async function submitNewItem(e) {
    e.preventDefault();
    const f = e.target;
    const id = 'item-' + Date.now();
    const photosRaw = f.photos.value.trim();

    const newItem = {
      id,
      title: f.title.value.trim(),
      category: f.category.value,
      price: parseFloat(f.price.value),
      condition: f.condition.value.trim(),
      description: f.description.value.trim(),
      details: {},
      shippingType: f.shippingType.value || null,
      photos: photosRaw ? photosRaw.split('\n').map(s => s.trim()).filter(Boolean) : [],
      sold: false,
      crossListings: {
        ebay: f.ebay_url.value.trim(),
        facebook: f.facebook_url.value.trim()
      }
    };

    const submitBtn = f.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      inventory.items.push(newItem);
      await saveInventory(inventory);
      closeModal('add-item-modal');
      renderItems();
      renderStats();
      renderCategories();
      showToast(`Added "${newItem.title}"`, 'success');
    } catch (ex) {
      inventory.items = inventory.items.filter(i => i.id !== id);
      showToast(ex.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Listing';
    }
  }

  /* ---- Settings ------------------------------------------- */
  function renderSettings() {
    if (!inventory || !inventory.settings) return;
    const s = inventory.settings;
    setValue('s-site-name', s.siteName || '');
    setValue('s-seller-zip', s.sellerZip || '');
    setValue('s-paypal-me', s.paypalMe || '');
    setValue('s-paypal-email', s.paypalEmail || '');
    setValue('s-contact-email', s.contactEmail || '');
    setValue('s-away-message', s.sellerAwayMessage || '');
    setValue('s-ebay-profile', s.ebayProfileUrl || '');
    setValue('s-facebook-profile', s.facebookProfileUrl || '');
    setValue('s-hero-title', s.heroTitle || '');
    setValue('s-hero-subtitle', s.heroSubtitle || '');
    setValue('s-about', s.about || '');
    renderAvatarPreview(s.avatarUrl || '');
    renderFAQs();
  }

  async function saveSettings(e) {
    e.preventDefault();
    const s = inventory.settings;
    s.siteName = document.getElementById('s-site-name').value.trim();
    s.sellerZip = document.getElementById('s-seller-zip').value.trim();
    s.paypalMe = document.getElementById('s-paypal-me').value.trim();
    s.paypalEmail = document.getElementById('s-paypal-email').value.trim();
    s.contactEmail = document.getElementById('s-contact-email').value.trim();
    s.sellerAwayMessage = document.getElementById('s-away-message').value.trim();
    s.ebayProfileUrl = document.getElementById('s-ebay-profile').value.trim();
    s.facebookProfileUrl = document.getElementById('s-facebook-profile').value.trim();
    s.heroTitle = document.getElementById('s-hero-title').value.trim();
    s.heroSubtitle = document.getElementById('s-hero-subtitle').value.trim();
    s.about = document.getElementById('s-about').value.trim();

    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await saveInventory(inventory);
      showToast('Settings saved!', 'success');
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Settings';
    }
  }

  /* ---- FAQ Management ------------------------------------- */
  function renderFAQs() {
    const container = document.getElementById('admin-faq-list');
    if (!container || !inventory) return;
    const faqs = inventory.settings.faqs || [];
    if (!faqs.length) {
      container.innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 0.75rem">No FAQs yet.</p>';
      return;
    }
    container.innerHTML = faqs.map((f, i) => `
      <div class="faq-admin-item" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem">${escHtml(f.q)}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.5rem">${escHtml(f.a)}</div>
        <button class="btn btn-xs btn-danger delete-faq-btn" data-index="${i}">Remove</button>
      </div>`).join('');

    container.querySelectorAll('.delete-faq-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        inventory.settings.faqs.splice(parseInt(btn.dataset.index), 1);
        try {
          await saveInventory(inventory);
          renderFAQs();
          showToast('FAQ removed', 'success');
        } catch (ex) {
          showToast(ex.message, 'error');
        }
      });
    });
  }

  function bindFAQForm() {
    const form = document.getElementById('faq-add-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const q = document.getElementById('faq-q').value.trim();
      const a = document.getElementById('faq-a').value.trim();
      if (!q || !a) return;
      if (!inventory.settings.faqs) inventory.settings.faqs = [];
      inventory.settings.faqs.push({ q, a });
      try {
        await saveInventory(inventory);
        form.reset();
        renderFAQs();
        showToast('FAQ added', 'success');
      } catch (ex) {
        inventory.settings.faqs.pop();
        showToast(ex.message, 'error');
      }
    });
  }

  function renderAvatarPreview(url) {
    const img = document.getElementById('admin-avatar-img');
    const initials = document.getElementById('admin-avatar-initials');
    if (!img) return;
    if (url) {
      img.src = url;
      img.style.display = '';
      if (initials) initials.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (initials) initials.style.display = '';
    }
  }

  function bindAvatarUpload() {
    const btn = document.getElementById('btn-upload-avatar');
    const fileInput = document.getElementById('avatar-file-input');
    const status = document.getElementById('avatar-upload-status');
    if (!btn || !fileInput) return;

    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInput.value = '';
      status.textContent = 'Processing…';
      status.style.color = '#64748b';

      try {
        // Resize to 300x300 square crop via canvas
        const base64 = await resizeAvatarToBase64(file, 300);

        status.textContent = 'Uploading…';
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ imageData: base64, key: 'avatar/1.jpg' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        // Bust cache with timestamp
        const url = data.url + '?v=' + Date.now();
        inventory.settings.avatarUrl = url;
        await saveInventory(inventory);
        renderAvatarPreview(url);
        status.textContent = 'Photo saved!';
        status.style.color = '#16a34a';
      } catch (err) {
        status.textContent = err.message;
        status.style.color = '#dc2626';
      }
    });
  }

  function resizeAvatarToBase64(file, size) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // Center-crop to square
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bindDataTools() {
    const btn = document.getElementById('btn-migrate-categories');
    const status = document.getElementById('migrate-status');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.textContent = 'Running…';
      try {
        const res = await fetch('/api/migrate-categories', {
          method: 'POST',
          headers: { 'x-admin-token': adminToken },
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = data.message || 'Done';
          status.style.color = '#16a34a';
          // Reload inventory to reflect changes
          inventory = await loadInventory();
          renderItems();
          showToast('Categories migrated — reload the homepage to verify.', 'success');
        } else {
          status.textContent = data.error || 'Error';
          status.style.color = '#dc2626';
        }
      } catch (err) {
        status.textContent = err.message;
        status.style.color = '#dc2626';
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---- Categories for filter ------------------------------ */
  function renderCategories() {
    const select = document.getElementById('filter-category');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
      CATEGORIES.map(c => `<option value="${escAttr(c)}"${c === current ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
  }

  /* ---- Modal ---------------------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    m.addEventListener('click', e => { if (e.target === m) closeModal(id); }, { once: true });
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    setTimeout(() => { m.style.display = 'none'; }, 200);
    document.body.style.overflow = '';
  }

  /* ---- Toast ---------------------------------------------- */
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || '•'}</span> ${escHtml(msg)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  }

  /* ---- Helpers -------------------------------------------- */
  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
  function formatPrice(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escAttr(str) { return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
})();
