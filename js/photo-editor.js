/* ============================================================
   Greg's Marketplace – Photo Editor & Manager
   Canvas-based editor: pan, zoom, rotate, color, filters
   Exports as 1200×900 JPEG at 82% quality
   ============================================================ */
(function () {
  'use strict';

  let currentItem = null;
  let editor = null;

  /* ================================================================
     PhotoEditor Class
     ================================================================ */
  class PhotoEditor {
    constructor(canvasEl) {
      this.canvas = canvasEl;
      this.ctx = canvasEl.getContext('2d');
      this.img = null;

      // Transform state
      this.panX = 0;
      this.panY = 0;
      this.zoom = 1;
      this.rotation = 0;     // coarse: 0, 90, 180, 270
      this.fineRot = 0;      // fine: -15 to +15 degrees

      // Color adjustments
      this.brightness = 100;
      this.contrast = 100;
      this.saturation = 100;
      this.filterPreset = 'none';

      // Drag state
      this._drag = false;
      this._lx = 0;
      this._ly = 0;

      this._bindInteraction();
      this.render();
    }

    get totalRotation() {
      return this.rotation + this.fineRot;
    }

    get filterCSS() {
      const base = `brightness(${this.brightness}%) contrast(${this.contrast}%) saturate(${this.saturation}%)`;
      const extras = {
        none:  '',
        vivid: 'saturate(165%) contrast(113%)',
        warm:  'sepia(28%) saturate(125%) brightness(106%)',
        cool:  'hue-rotate(22deg) saturate(82%) brightness(104%)',
        bw:    'grayscale(100%)',
        fade:  'saturate(62%) brightness(114%) contrast(86%)',
      };
      const extra = extras[this.filterPreset] || '';
      return extra ? `${base} ${extra}` : base;
    }

    loadFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          const img = new Image();
          img.onload = () => {
            this.img = img;
            this.rotation = 0;
            this.fineRot = 0;
            this._fitCover();
            resolve();
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    _fitCover() {
      if (!this.img) return;
      const W = this.canvas.width;
      const H = this.canvas.height;
      // When rotated 90°/270°, width/height swap
      const isOdd = (Math.abs(Math.round(this.rotation / 90)) % 2) === 1;
      const iW = isOdd ? this.img.height : this.img.width;
      const iH = isOdd ? this.img.width : this.img.height;
      this.zoom = Math.max(W / iW, H / iH);
      this.panX = 0;
      this.panY = 0;
      this.render();
    }

    rotate(dir) {
      // dir: 1 = CW, -1 = CCW
      this.rotation = ((this.rotation + dir * 90) + 360) % 360;
      if (this.img) this._fitCover();
      else this.render();
    }

    reset() {
      this.rotation = 0;
      this.fineRot = 0;
      this.brightness = 100;
      this.contrast = 100;
      this.saturation = 100;
      this.filterPreset = 'none';
      if (this.img) this._fitCover();
      else this.render();
    }

    render() {
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (!this.img) {
        // Placeholder
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 13px system-ui, sans-serif';
        ctx.fillText('Click "Browse" or drag an image here', W / 2, H / 2 - 12);
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Any format · Will export as 1200×900 JPEG', W / 2, H / 2 + 12);
        return;
      }

      this.canvas.classList.add('has-image');
      ctx.save();
      ctx.filter = this.filterCSS;
      ctx.translate(W / 2 + this.panX, H / 2 + this.panY);
      ctx.rotate(this.totalRotation * Math.PI / 180);
      ctx.scale(this.zoom, this.zoom);
      ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
      ctx.restore();
    }

    async export() {
      if (!this.img) throw new Error('No image loaded');

      const ec = document.createElement('canvas');
      ec.width = 1200;
      ec.height = 900;
      const ctx = ec.getContext('2d');
      // Scale ratio from display canvas to export canvas
      const sr = ec.width / this.canvas.width;

      ctx.filter = this.filterCSS;
      ctx.save();
      ctx.translate(ec.width / 2 + this.panX * sr, ec.height / 2 + this.panY * sr);
      ctx.rotate(this.totalRotation * Math.PI / 180);
      ctx.scale(this.zoom * sr, this.zoom * sr);
      ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
      ctx.restore();

      return new Promise(resolve => ec.toBlob(resolve, 'image/jpeg', 0.82));
    }

    _bindInteraction() {
      const c = this.canvas;

      /* --- Mouse -------------------------------------------- */
      c.addEventListener('mousedown', e => {
        this._drag = true;
        this._lx = e.clientX;
        this._ly = e.clientY;
        c.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', e => {
        if (!this._drag) return;
        this.panX += e.clientX - this._lx;
        this.panY += e.clientY - this._ly;
        this._lx = e.clientX;
        this._ly = e.clientY;
        this.render();
      });

      document.addEventListener('mouseup', () => {
        this._drag = false;
        c.style.cursor = this.img ? 'grab' : 'default';
      });

      /* --- Scroll zoom --------------------------------------- */
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.07 : 0.93;
        this.zoom = Math.max(0.15, Math.min(12, this.zoom * factor));
        this.render();
        syncControls();
      }, { passive: false });

      /* --- Touch pan + pinch --------------------------------- */
      let tDist = null;
      c.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          this._drag = true;
          this._lx = e.touches[0].clientX;
          this._ly = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this._drag = false;
          tDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });

      c.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && this._drag) {
          this.panX += e.touches[0].clientX - this._lx;
          this.panY += e.touches[0].clientY - this._ly;
          this._lx = e.touches[0].clientX;
          this._ly = e.touches[0].clientY;
          this.render();
        } else if (e.touches.length === 2 && tDist) {
          const nd = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this.zoom = Math.max(0.15, Math.min(12, this.zoom * (nd / tDist)));
          tDist = nd;
          this.render();
          syncControls();
        }
      }, { passive: false });

      c.addEventListener('touchend', () => {
        this._drag = false;
        tDist = null;
      }, { passive: true });

      /* --- Drop image --------------------------------------- */
      c.addEventListener('dragover', e => e.preventDefault());
      c.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          editor.loadFile(file).then(syncControls);
        }
      });
    }
  }

  /* ================================================================
     UI Sync
     ================================================================ */
  function syncControls() {
    if (!editor) return;
    const el = id => document.getElementById(id);

    el('ctrl-brightness').value = editor.brightness;
    el('ctrl-contrast').value   = editor.contrast;
    el('ctrl-saturation').value = editor.saturation;
    el('ctrl-fine-rot').value   = editor.fineRot;
    el('ctrl-zoom').value       = Math.round(editor.zoom * 100);

    el('val-brightness').textContent = editor.brightness + '%';
    el('val-contrast').textContent   = editor.contrast + '%';
    el('val-saturation').textContent = editor.saturation + '%';
    el('val-fine-rot').textContent   = (editor.fineRot >= 0 ? '+' : '') + editor.fineRot + '°';
    el('val-zoom').textContent       = Math.round(editor.zoom * 100) + '%';

    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === editor.filterPreset);
    });
  }

  function resetControls() {
    const el = id => document.getElementById(id);
    el('ctrl-brightness').value = 100; el('val-brightness').textContent = '100%';
    el('ctrl-contrast').value   = 100; el('val-contrast').textContent   = '100%';
    el('ctrl-saturation').value = 100; el('val-saturation').textContent = '100%';
    el('ctrl-fine-rot').value   = 0;   el('val-fine-rot').textContent   = '+0°';
    el('ctrl-zoom').value       = 100; el('val-zoom').textContent       = '100%';
    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'none');
    });
  }

  /* ================================================================
     Photo Manager
     ================================================================ */
  function openPhotoManager(item) {
    currentItem = item;
    document.getElementById('pm-item-title').textContent = item.title;
    renderPhotoGrid();
    openModal('photo-manager-modal');
  }

  function renderPhotoGrid() {
    const grid = document.getElementById('pm-grid');
    if (!grid || !currentItem) return;

    const photos = currentItem.photos || [];

    if (photos.length === 0) {
      grid.innerHTML = `
        <div class="pm-empty">
          <strong>No photos yet</strong>
          <p>Click "Add Photo" to upload and edit your first image.</p>
        </div>`;
      return;
    }

    grid.innerHTML = photos.map((url, i) => `
      <div class="pm-thumb" data-index="${i}">
        <img src="${escAttr(url)}" alt="Photo ${i + 1}" onerror="this.src='/images/placeholder.svg'">
        <div class="pm-thumb-num">${i + 1}</div>
        <div class="pm-thumb-actions">
          <button class="pm-del-btn" data-index="${i}" title="Delete photo">×</button>
          <div class="pm-move-row">
            <button class="pm-move-btn pm-move-left" data-index="${i}" ${i === 0 ? 'disabled' : ''} title="Move left">←</button>
            <button class="pm-move-btn pm-move-right" data-index="${i}" ${i === photos.length - 1 ? 'disabled' : ''} title="Move right">→</button>
          </div>
        </div>
      </div>`).join('');

    // Delete
    grid.querySelectorAll('.pm-del-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (!confirm(`Remove photo ${idx + 1}? This cannot be undone.`)) return;
        currentItem.photos.splice(idx, 1);
        await savePhotos('Photo removed');
        renderPhotoGrid();
      });
    });

    // Reorder
    grid.querySelectorAll('.pm-move-left').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.index);
        [currentItem.photos[i - 1], currentItem.photos[i]] = [currentItem.photos[i], currentItem.photos[i - 1]];
        await savePhotos('Photo order saved');
        renderPhotoGrid();
      });
    });
    grid.querySelectorAll('.pm-move-right').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.index);
        [currentItem.photos[i], currentItem.photos[i + 1]] = [currentItem.photos[i + 1], currentItem.photos[i]];
        await savePhotos('Photo order saved');
        renderPhotoGrid();
      });
    });
  }

  async function savePhotos(toastMsg) {
    const api = window._adminAPI;
    if (!api) return;
    try {
      const inv = api.getInventory();
      const item = inv.items.find(i => i.id === currentItem.id);
      if (item) item.photos = currentItem.photos.slice();
      await api.saveInventory(inv);
      if (toastMsg) api.showToast(toastMsg, 'success');
      // Refresh the items table
      if (typeof renderItems === 'function') renderItems();
    } catch (ex) {
      api && api.showToast(ex.message, 'error');
    }
  }

  /* ================================================================
     Photo Editor
     ================================================================ */
  function openPhotoEditor() {
    const canvas = document.getElementById('editor-canvas');
    canvas.classList.remove('has-image');
    editor = new PhotoEditor(canvas);
    resetControls();
    openModal('photo-editor-modal');
  }

  async function handleUpload() {
    if (!editor || !editor.img) {
      window._adminAPI && window._adminAPI.showToast('Please select a photo first', 'error');
      return;
    }
    if (!currentItem) return;

    const btn = document.getElementById('editor-upload-btn');
    const progress = document.getElementById('editor-progress');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    progress.classList.add('visible');

    try {
      // Export to 1200×900 JPEG blob
      const blob = await editor.export();

      // Convert to base64 data URL
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });

      // Determine next photo slot
      const existing = currentItem.photos || [];
      const photoNum = existing.length + 1;
      const key = `${currentItem.id}/${photoNum}.jpg`;

      const api = window._adminAPI;
      if (!api) throw new Error('Admin API not available');

      progress.querySelector('span').textContent = 'Uploading…';

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': api.getToken(),
        },
        body: JSON.stringify({ imageData: base64, key }),
      });

      if (res.status === 401) {
        sessionStorage.removeItem('gm_admin_token');
        throw new Error('Session expired – please log in again');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const { url } = await res.json();

      // Add URL to item and save inventory
      if (!currentItem.photos) currentItem.photos = [];
      currentItem.photos.push(url);
      await savePhotos(null);

      closeModal('photo-editor-modal');
      renderPhotoGrid();
      api.showToast(`Photo ${photoNum} uploaded and saved!`, 'success');

    } catch (ex) {
      window._adminAPI && window._adminAPI.showToast(ex.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload & Save Photo';
      progress.classList.remove('visible');
      progress.querySelector('span').textContent = 'Processing…';
    }
  }

  /* ================================================================
     Modal helpers
     ================================================================ */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.style.display = 'flex';
    requestAnimationFrame(() => m.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    setTimeout(() => {
      m.style.display = 'none';
      // Restore scroll only if both modals closed
      if (!document.getElementById('photo-manager-modal').classList.contains('open') &&
          !document.getElementById('photo-editor-modal').classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }, 200);
  }

  /* ================================================================
     Init – bind all events
     ================================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    /* --- File input ----------------------------------------- */
    const fileInput = document.getElementById('photo-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file && editor) {
          editor.loadFile(file).then(syncControls);
        }
        fileInput.value = '';
      });
    }

    /* --- Browse button -------------------------------------- */
    document.getElementById('editor-browse-btn').addEventListener('click', () => {
      document.getElementById('photo-file-input').click();
    });

    /* --- Rotate -------------------------------------------- */
    document.getElementById('btn-rot-ccw').addEventListener('click', () => {
      if (!editor) return;
      editor.rotate(-1);
      syncControls();
    });
    document.getElementById('btn-rot-cw').addEventListener('click', () => {
      if (!editor) return;
      editor.rotate(1);
      syncControls();
    });

    /* --- Reset --------------------------------------------- */
    document.getElementById('btn-reset-editor').addEventListener('click', () => {
      if (!editor) return;
      editor.reset();
      syncControls();
    });

    /* --- Sliders ------------------------------------------- */
    const sliderDefs = [
      ['ctrl-brightness', v => { editor.brightness = +v; }],
      ['ctrl-contrast',   v => { editor.contrast   = +v; }],
      ['ctrl-saturation', v => { editor.saturation = +v; }],
      ['ctrl-fine-rot',   v => { editor.fineRot    = parseFloat(v); }],
      ['ctrl-zoom',       v => { editor.zoom       = +v / 100; }],
    ];
    sliderDefs.forEach(([id, setter]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', e => {
        if (!editor) return;
        setter(e.target.value);
        editor.render();
        syncControls();
      });
    });

    /* --- Filter presets ------------------------------------ */
    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!editor) return;
        editor.filterPreset = btn.dataset.filter;
        editor.render();
        syncControls();
      });
    });

    /* --- Upload button ------------------------------------- */
    document.getElementById('editor-upload-btn').addEventListener('click', handleUpload);

    /* --- Photo Manager close/done -------------------------- */
    document.getElementById('pm-close-btn').addEventListener('click', () => closeModal('photo-manager-modal'));
    document.getElementById('pm-done-btn').addEventListener('click', () => closeModal('photo-manager-modal'));

    /* --- Photo Editor cancel/close ------------------------- */
    document.getElementById('pe-close-btn').addEventListener('click', () => closeModal('photo-editor-modal'));
    document.getElementById('pe-cancel-btn').addEventListener('click', () => closeModal('photo-editor-modal'));

    /* --- Add photo button ---------------------------------- */
    document.getElementById('pm-add-photo-btn').addEventListener('click', openPhotoEditor);

    /* --- Overlay click to close --------------------------- */
    document.getElementById('photo-manager-modal').addEventListener('click', e => {
      if (e.target.id === 'photo-manager-modal') closeModal('photo-manager-modal');
    });
    document.getElementById('photo-editor-modal').addEventListener('click', e => {
      if (e.target.id === 'photo-editor-modal') closeModal('photo-editor-modal');
    });
  });

  /* ================================================================
     Helpers
     ================================================================ */
  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ================================================================
     Public API
     ================================================================ */
  window.openPhotoManager = openPhotoManager;

})();
