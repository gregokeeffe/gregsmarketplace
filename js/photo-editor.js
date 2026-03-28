/* ============================================================
   Greg's Marketplace – Photo Editor & Manager
   Canvas-based editor: pan, zoom, rotate, color, filters
   Exports as 1200×900 JPEG at 82% quality
   ============================================================ */
(function () {
  'use strict';

  let currentItem = null;
  let editor = null;
  let fileQueue = [];
  let queueIndex = 0;

  // Persisted settings carried forward through the queue
  let savedSettings = {
    brightness: 100, contrast: 100, saturation: 100,
    fineRot: 0, filterPreset: 'none'
    // zoom and pan intentionally NOT persisted — each photo fits to its own frame
  };

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

    async loadFile(file) {
      // Auto-convert HEIC/HEIF (iPhone photos) to JPEG in-browser
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      const isHeic = name.endsWith('.heic') || name.endsWith('.heif') ||
                     type.includes('heic') || type.includes('heif');

      let sourceFile = file;
      if (isHeic) {
        if (typeof heic2any === 'undefined') {
          throw new Error(`"${file.name}" is HEIC — converter not loaded yet. Try again in a moment.`);
        }
        try {
          window._adminAPI && window._adminAPI.showToast(`Converting ${file.name}…`, 'success');
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
          sourceFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
          throw new Error(`Could not convert "${file.name}": ${err.message || err}`);
        }
      }

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
          img.onerror = () => reject(new Error(`"${file.name}" could not be decoded.`));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
        reader.readAsDataURL(sourceFile);
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

      // Watermark
      const padding = 14;
      const text = '© gregsmarketplace.com';
      const fontSize = 22;
      ctx.save();
      ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      // Shadow for readability on any background
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText(text, ec.width - padding, ec.height - padding);
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
        this.zoom = Math.max(0.01, Math.min(12, this.zoom * factor));
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
          this.zoom = Math.max(0.01, Math.min(12, this.zoom * (nd / tDist)));
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
  function setSlider(sliderId, numId, value) {
    const slider = document.getElementById(sliderId);
    const num    = document.getElementById(numId);
    if (!slider || !num) return;
    slider.value = value;
    num.value    = value;
    updateSliderFill(slider);
  }

  function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min) * 100).toFixed(1) + '%';
    slider.style.setProperty('--pct', pct);
  }

  function syncControls() {
    if (!editor) return;
    setSlider('ctrl-brightness', 'val-brightness', editor.brightness);
    setSlider('ctrl-contrast',   'val-contrast',   editor.contrast);
    setSlider('ctrl-saturation', 'val-saturation', editor.saturation);
    setSlider('ctrl-fine-rot',   'val-fine-rot',   editor.fineRot);
    setSlider('ctrl-zoom',       'val-zoom',       Math.round(editor.zoom * 100));

    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === editor.filterPreset);
    });
  }

  function resetControls(clearAll) {
    // clearAll=true resets to factory defaults AND clears savedSettings
    // clearAll=false (default) syncs UI to current savedSettings
    if (clearAll) {
      savedSettings = { brightness:100, contrast:100, saturation:100, fineRot:0, filterPreset:'none' };
      if (editor) {
        editor.brightness = 100; editor.contrast = 100; editor.saturation = 100;
        editor.fineRot = 0; editor.filterPreset = 'none';
        editor.render();
      }
    }
    const s = clearAll ? { brightness:100, contrast:100, saturation:100, fineRot:0 } : savedSettings;
    setSlider('ctrl-brightness', 'val-brightness', s.brightness);
    setSlider('ctrl-contrast',   'val-contrast',   s.contrast);
    setSlider('ctrl-saturation', 'val-saturation', s.saturation);
    setSlider('ctrl-fine-rot',   'val-fine-rot',   s.fineRot);
    setSlider('ctrl-zoom',       'val-zoom',       100);
    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === (clearAll ? 'none' : savedSettings.filterPreset));
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
      <div class="pm-thumb" data-index="${i}" draggable="true">
        <img src="${escAttr(url)}" alt="Photo ${i + 1}" onerror="this.src='/images/placeholder.svg'">
        <div class="pm-thumb-num">${i + 1}</div>
        <div class="pm-thumb-actions">
          <button class="pm-del-btn" data-index="${i}" title="Delete photo">×</button>
          <div class="pm-drag-hint">⠿ drag to reorder</div>
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

    // Drag-and-drop reorder
    let dragSrc = null;

    grid.querySelectorAll('.pm-thumb').forEach(thumb => {
      thumb.addEventListener('dragstart', e => {
        dragSrc = thumb;
        thumb.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      thumb.addEventListener('dragend', () => {
        thumb.classList.remove('dragging');
        grid.querySelectorAll('.pm-thumb').forEach(t => t.classList.remove('drag-over'));
      });

      thumb.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (thumb !== dragSrc) {
          grid.querySelectorAll('.pm-thumb').forEach(t => t.classList.remove('drag-over'));
          thumb.classList.add('drag-over');
        }
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });

      thumb.addEventListener('drop', async e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === thumb) return;
        const from = parseInt(dragSrc.dataset.index);
        const to   = parseInt(thumb.dataset.index);
        // Reorder array
        const moved = currentItem.photos.splice(from, 1)[0];
        currentItem.photos.splice(to, 0, moved);
        await savePhotos('Photo order saved');
        renderPhotoGrid();
      });
    });

    // Touch drag (mobile)
    let touchDragSrc = null;
    let touchClone = null;

    grid.querySelectorAll('.pm-thumb').forEach(thumb => {
      thumb.addEventListener('touchstart', e => {
        touchDragSrc = thumb;
        thumb.classList.add('dragging');
      }, { passive: true });

      thumb.addEventListener('touchmove', e => {
        e.preventDefault();
        const touch = e.touches[0];
        // Move a visual clone
        if (!touchClone) {
          touchClone = thumb.cloneNode(true);
          touchClone.style.cssText = `position:fixed;pointer-events:none;opacity:0.8;z-index:9999;width:${thumb.offsetWidth}px;height:${thumb.offsetHeight}px;`;
          document.body.appendChild(touchClone);
        }
        touchClone.style.left = (touch.clientX - thumb.offsetWidth / 2) + 'px';
        touchClone.style.top  = (touch.clientY - thumb.offsetHeight / 2) + 'px';

        // Highlight target
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = el && el.closest('.pm-thumb');
        grid.querySelectorAll('.pm-thumb').forEach(t => t.classList.remove('drag-over'));
        if (target && target !== touchDragSrc) target.classList.add('drag-over');
      }, { passive: false });

      thumb.addEventListener('touchend', async e => {
        if (touchClone) { touchClone.remove(); touchClone = null; }
        thumb.classList.remove('dragging');
        grid.querySelectorAll('.pm-thumb').forEach(t => t.classList.remove('drag-over'));

        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = el && el.closest('.pm-thumb');
        if (target && target !== touchDragSrc) {
          const from = parseInt(touchDragSrc.dataset.index);
          const to   = parseInt(target.dataset.index);
          const moved = currentItem.photos.splice(from, 1)[0];
          currentItem.photos.splice(to, 0, moved);
          await savePhotos('Photo order saved');
          renderPhotoGrid();
        }
        touchDragSrc = null;
      }, { passive: true });
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
  function openPhotoEditor(files) {
    if (files && files.length) {
      fileQueue = Array.from(files);
      queueIndex = 0;
    } else {
      fileQueue = [];
      queueIndex = 0;
    }

    const canvas = document.getElementById('editor-canvas');
    canvas.classList.remove('has-image');
    editor = new PhotoEditor(canvas);
    resetControls();
    updateQueueUI();
    openModal('photo-editor-modal');

    if (fileQueue.length) {
      editor.loadFile(fileQueue[0]).then(syncControls).catch(err => {
        window._adminAPI && window._adminAPI.showToast(err.message, 'error');
        advanceQueue();
      });
    }
  }

  function captureSettings() {
    if (!editor) return;
    savedSettings = {
      brightness:   editor.brightness,
      contrast:     editor.contrast,
      saturation:   editor.saturation,
      fineRot:      editor.fineRot,
      filterPreset: editor.filterPreset,
    };
  }

  function applySettings() {
    if (!editor) return;
    editor.brightness   = savedSettings.brightness;
    editor.contrast     = savedSettings.contrast;
    editor.saturation   = savedSettings.saturation;
    editor.fineRot      = savedSettings.fineRot;
    editor.filterPreset = savedSettings.filterPreset;
    editor.render();
  }

  function advanceQueue() {
    if (queueIndex < fileQueue.length) {
      const canvas = document.getElementById('editor-canvas');
      canvas.classList.remove('has-image');
      editor = new PhotoEditor(canvas);
      applySettings();   // restore previous photo's adjustments
      updateQueueUI();
      editor.loadFile(fileQueue[queueIndex]).then(() => {
        syncControls();
      }).catch(err => {
        window._adminAPI && window._adminAPI.showToast(err.message, 'error');
        queueIndex++;
        advanceQueue();
      });
    } else {
      fileQueue = [];
      queueIndex = 0;
      closeModal('photo-editor-modal');
    }
  }

  function updateQueueUI() {
    const btn = document.getElementById('editor-upload-btn');
    const queueLabel = document.getElementById('queue-label');
    const skipBtn = document.getElementById('editor-skip-btn');

    if (fileQueue.length > 1) {
      const remaining = fileQueue.length - queueIndex;
      if (queueLabel) {
        queueLabel.textContent = `Photo ${queueIndex + 1} of ${fileQueue.length}`;
        queueLabel.style.display = 'inline';
      }
      if (skipBtn) skipBtn.style.display = 'inline-flex';
      if (btn) btn.textContent = queueIndex < fileQueue.length - 1 ? 'Upload & Next →' : 'Upload & Finish';
    } else {
      if (queueLabel) queueLabel.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      if (btn) btn.textContent = 'Upload & Save Photo';
    }
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

      renderPhotoGrid();
      api.showToast(`Photo ${photoNum} uploaded!`, 'success');

      // Carry settings forward to next photo
      captureSettings();
      queueIndex++;
      advanceQueue();

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
     pickFiles — creates a fresh input element each time,
     guaranteed to fire 'change' in all browsers
     ================================================================ */
  function pickFiles(multiple, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);
      if (files.length) callback(files);
    });
    // Clean up if user cancels without selecting
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
    });
    input.click();
  }

  /* ================================================================
     Init – bind all events
     ================================================================ */
  document.addEventListener('DOMContentLoaded', () => {

    /* --- Browse button inside editor ----------------------- */
    document.getElementById('editor-browse-btn').addEventListener('click', () => {
      pickFiles(true, files => {
        if (files.length === 1) {
          if (editor) editor.loadFile(files[0]).then(syncControls);
        } else {
          fileQueue = files;
          queueIndex = 0;
          const canvas = document.getElementById('editor-canvas');
          canvas.classList.remove('has-image');
          editor = new PhotoEditor(canvas);
          resetControls();
          updateQueueUI();
          editor.loadFile(fileQueue[0]).then(syncControls);
        }
      });
    });

    /* --- Add Photo button in Photo Manager ----------------- */
    document.getElementById('pm-add-photo-btn').addEventListener('click', () => {
      pickFiles(true, files => openPhotoEditor(files));
    });

    /* --- Skip button --------------------------------------- */
    const skipBtn = document.getElementById('editor-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        captureSettings();
        queueIndex++;
        advanceQueue();
      });
    }

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
      resetControls(true);  // clear all including savedSettings
    });

    /* --- Sliders + number inputs (two-way binding) --------- */
    const sliderDefs = [
      ['ctrl-brightness', 'val-brightness', v => { editor.brightness = +v; },        0,   300],
      ['ctrl-contrast',   'val-contrast',   v => { editor.contrast   = +v; },        0,   300],
      ['ctrl-saturation', 'val-saturation', v => { editor.saturation = +v; },        0,   300],
      ['ctrl-fine-rot',   'val-fine-rot',   v => { editor.fineRot    = parseFloat(v); }, -15, 15],
      ['ctrl-zoom',       'val-zoom',       v => { editor.zoom       = +v / 100; },   1,   500],
    ];
    sliderDefs.forEach(([sliderId, numId, setter, min, max]) => {
      const slider = document.getElementById(sliderId);
      const num    = document.getElementById(numId);
      if (!slider || !num) return;

      // Slider → number + render
      slider.addEventListener('input', () => {
        if (!editor) return;
        num.value = slider.value;
        updateSliderFill(slider);
        setter(slider.value);
        editor.render();
      });

      // Number → slider + render (on Enter or blur)
      const applyNum = () => {
        if (!editor) return;
        let v = parseFloat(num.value);
        if (isNaN(v)) return;
        v = Math.max(min, Math.min(max, v));
        num.value    = v;
        slider.value = v;
        updateSliderFill(slider);
        setter(v);
        editor.render();
      };
      num.addEventListener('change', applyNum);
      num.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyNum(); } });
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
