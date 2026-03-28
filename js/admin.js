/* ============================================================
   Greg's Marketplace – Admin Panel
   ============================================================ */
(function () {
  'use strict';

  const CATEGORIES = ['Bicycles', 'Bicycle Parts', 'Household Goods', 'Clothing & Accessories', 'Furniture', 'Misc'];
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

  async function loadAndRender() {
    inventory = await loadInventory();
    renderStats();
    renderItems();
    renderSettings();
    applyAwayToggle();
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

    // Settings form
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
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
    if (filterStatus === 'available') items = items.filter(i => !i.sold);
    if (filterStatus === 'sold') items = items.filter(i => i.sold);
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }

    const tbody = document.getElementById('items-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No items match your filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => buildItemRow(item)).join('');
    bindRowActions();
  }

  function buildItemRow(item) {
    const photo = (item.photos && item.photos.length) ? item.photos[0] : '/images/placeholder.svg';
    const ebayLink = item.crossListings && item.crossListings.ebay ? `<a href="${escAttr(item.crossListings.ebay)}" target="_blank" title="eBay listing" class="btn btn-xs btn-secondary">eBay</a>` : '';
    const fbLink = item.crossListings && item.crossListings.facebook ? `<a href="${escAttr(item.crossListings.facebook)}" target="_blank" title="Facebook listing" class="btn btn-xs btn-secondary">FB</a>` : '';

    return `
      <tr data-id="${escAttr(item.id)}">
        <td data-label="Item">
          <div class="item-thumb-cell">
            <img class="item-thumb" src="${escAttr(photo)}" alt="" onerror="this.src='/images/placeholder.svg'">
            <div class="item-title-cell">
              <div class="item-name">${escHtml(item.title)}</div>
              <div class="item-cat">${escHtml(item.category)}</div>
            </div>
          </div>
        </td>
        <td data-label="ID"><code style="font-size:0.75rem">${escHtml(item.id)}</code></td>
        <td data-label="Price">
          <div class="price-cell">
            <span class="price-display" id="price-display-${escAttr(item.id)}">$${formatPrice(item.price)}</span>
            <button class="btn btn-xs btn-secondary edit-price-btn" data-id="${escAttr(item.id)}" title="Edit price">✏️</button>
          </div>
        </td>
        <td data-label="Status">
          <span class="status-badge ${item.sold ? 'status-sold' : 'status-available'}" id="status-badge-${escAttr(item.id)}">
            ${item.sold ? 'Sold' : 'Available'}
          </span>
        </td>
        <td data-label="Cross-listings">
          <div class="cross-links-cell" id="cross-cell-${escAttr(item.id)}">
            <div class="cross-links-display">
              ${ebayLink}${fbLink}
              <button class="btn btn-xs btn-secondary edit-cross-btn" data-id="${escAttr(item.id)}" title="Edit cross-listing URLs">✏️</button>
            </div>
          </div>
        </td>
        <td data-label="Actions">
          <div class="actions-cell">
            <button class="btn btn-xs btn-secondary photos-btn" data-id="${escAttr(item.id)}" title="Manage photos">
              📸 Photos${item.photos && item.photos.length ? ` (${item.photos.length})` : ''}
            </button>
            <button class="btn btn-xs ${item.sold ? 'btn-success' : 'btn-secondary'} toggle-sold-btn" data-id="${escAttr(item.id)}">
              ${item.sold ? 'Mark Available' : 'Mark Sold'}
            </button>
            <a href="/item.html?id=${encodeURIComponent(item.id)}" target="_blank" class="btn btn-xs btn-secondary" title="View listing">👁</a>
            <button class="btn btn-xs btn-danger delete-item-btn" data-id="${escAttr(item.id)}" title="Delete">🗑</button>
          </div>
        </td>
      </tr>`;
  }

  function bindRowActions() {
    // Toggle sold
    document.querySelectorAll('.toggle-sold-btn').forEach(btn => {
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
          item.sold = !item.sold; // revert
          showToast(ex.message, 'error');
        }
      });
    });

    // Edit price
    document.querySelectorAll('.edit-price-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        const cell = btn.closest('td');
        const displayEl = document.getElementById('price-display-' + id);

        displayEl.style.display = 'none';
        btn.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.value = item.price;
        input.className = 'price-edit-input';
        input.id = 'price-input-' + id;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-xs btn-success save-price-btn';
        saveBtn.textContent = '✓';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-xs btn-secondary cancel-price-btn';
        cancelBtn.textContent = '✕';

        const priceCell = cell.querySelector('.price-cell');
        priceCell.appendChild(input);
        priceCell.appendChild(saveBtn);
        priceCell.appendChild(cancelBtn);
        input.focus();
        input.select();

        const finish = () => {
          input.remove(); saveBtn.remove(); cancelBtn.remove();
          displayEl.style.display = '';
          btn.style.display = '';
        };

        saveBtn.addEventListener('click', async () => {
          const newPrice = parseFloat(input.value);
          if (isNaN(newPrice) || newPrice < 0) { showToast('Invalid price', 'error'); return; }
          const oldPrice = item.price;
          item.price = newPrice;
          saveBtn.disabled = true;
          try {
            await saveInventory(inventory);
            displayEl.textContent = '$' + formatPrice(newPrice);
            finish();
            renderStats();
            showToast(`Price updated to $${formatPrice(newPrice)}`, 'success');
          } catch (ex) {
            item.price = oldPrice;
            showToast(ex.message, 'error');
            finish();
          }
        });

        cancelBtn.addEventListener('click', finish);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') saveBtn.click();
          if (e.key === 'Escape') cancelBtn.click();
        });
      });
    });

    // Edit cross-listing URLs
    document.querySelectorAll('.edit-cross-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = inventory.items.find(i => i.id === id);
        if (!item) return;
        const cell = document.getElementById('cross-cell-' + id);
        if (!cell) return;

        const cl = item.crossListings || {};

        cell.innerHTML = `
          <div class="cross-links-edit" style="display:flex;flex-direction:column;gap:0.5rem;min-width:260px">
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);padding-bottom:0.2rem;border-bottom:1px solid var(--border)">
              eBay
            </div>
            <div style="display:flex;gap:0.4rem">
              <input type="url" class="admin-search-input" id="ebay-url-${escAttr(id)}"
                placeholder="eBay listing URL" value="${escAttr(cl.ebay || '')}"
                style="font-size:0.75rem;padding:0.3rem 0.5rem;flex:1">
              <input type="number" class="admin-search-input" id="ebay-price-${escAttr(id)}"
                placeholder="Price $" value="${escAttr(cl.ebayPrice ? cl.ebayPrice : '')}" min="0" step="0.01"
                style="font-size:0.75rem;padding:0.3rem 0.5rem;width:80px">
            </div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);padding-bottom:0.2rem;border-bottom:1px solid var(--border)">
              Facebook Marketplace
            </div>
            <div style="display:flex;gap:0.4rem">
              <input type="url" class="admin-search-input" id="fb-url-${escAttr(id)}"
                placeholder="Facebook Marketplace URL" value="${escAttr(cl.facebook || '')}"
                style="font-size:0.75rem;padding:0.3rem 0.5rem;flex:1">
              <input type="number" class="admin-search-input" id="fb-price-${escAttr(id)}"
                placeholder="Price $" value="${escAttr(cl.facebookPrice ? cl.facebookPrice : '')}" min="0" step="0.01"
                style="font-size:0.75rem;padding:0.3rem 0.5rem;width:80px">
            </div>
            <div style="display:flex;gap:0.4rem">
              <button class="btn btn-xs btn-primary save-cross-btn" data-id="${escAttr(id)}">Save</button>
              <button class="btn btn-xs btn-secondary cancel-cross-btn" data-id="${escAttr(id)}">Cancel</button>
            </div>
          </div>`;

        cell.querySelector('.save-cross-btn').addEventListener('click', async () => {
          const ebay       = document.getElementById('ebay-url-'   + id).value.trim();
          const ebayPrice  = parseFloat(document.getElementById('ebay-price-' + id).value) || null;
          const fb         = document.getElementById('fb-url-'     + id).value.trim();
          const fbPrice    = parseFloat(document.getElementById('fb-price-'   + id).value) || null;
          if (!item.crossListings) item.crossListings = {};
          item.crossListings.ebay           = ebay;
          item.crossListings.ebayPrice      = ebayPrice;
          item.crossListings.facebook       = fb;
          item.crossListings.facebookPrice  = fbPrice;
          try {
            await saveInventory(inventory);
            renderItems();
            showToast('Cross-listing links saved', 'success');
          } catch (ex) {
            showToast(ex.message, 'error');
          }
        });

        cell.querySelector('.cancel-cross-btn').addEventListener('click', () => {
          renderItems();
        });
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
      shipping: {
        available: f.shipping_available.checked,
        localPickup: f.local_pickup.checked,
        packageSize: f.package_size.value,
        estimatedLocalCost: parseFloat(f.local_cost.value) || 0,
        estimatedNationalCost: parseFloat(f.national_cost.value) || 0,
        notes: f.shipping_notes.value.trim()
      },
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
