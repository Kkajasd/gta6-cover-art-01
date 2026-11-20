// Leonida Key Art — the editor app.
//
// Wires the preview canvas to the controls: photo upload + samples, layout
// and grade pickers, per-panel photo choice, title/caption editing, drag to
// pan, zoom, one-click auto-cover, and PNG export in the three post sizes.
// Also stages deterministic screenshots when the page is opened with
// ?shot=... parameters (see shots.js).

import { GRADES, LAYOUTS, renderCover } from './cover.js';

const PREVIEW_W = 960;
const PREVIEW_H = 540;

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'LEONIDA',
  caption: 'Welcome back to Vice City — the sun never sets on the score.',
  zoom: 1.1,
  panX: 0,
  panY: 0,
  activePhoto: 'sample1',
  panelPhotos: ['sample1'],
  photos: { upload: null, sample1: null, sample2: null },
};

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');
preview.width = PREVIEW_W;
preview.height = PREVIEW_H;

function status(msg) {
  const el = $('status');
  if (el) el.textContent = msg;
}

function fitPreviewSize() {
  // Keep the preview canvas at the poster's aspect for the chosen export size.
  const size = document.querySelector('input[name="size"]:checked');
  const ratio = size ? size.value : '16:9';
  if (ratio === '1:1') {
    preview.width = 720;
    preview.height = 720;
  } else if (ratio === '4:5') {
    preview.width = 640;
    preview.height = 800;
  } else {
    preview.width = PREVIEW_W;
    preview.height = PREVIEW_H;
  }
}

export function renderPreview() {
  fitPreviewSize();
  renderCover(pctx, preview.width, preview.height, state);
  window.__shotReady = true;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  try {
    state.photos.sample1 = await loadImage('samples/boulevard.png');
  } catch (e) {
    status('Sample photo 1 failed to load.');
  }
  try {
    state.photos.sample2 = await loadImage('samples/pier.png');
  } catch (e) {
    status('Sample photo 2 failed to load.');
  }
  renderPreview();
}

function setActivePhoto(key) {
  state.activePhoto = key;
  const layout = LAYOUTS[state.layout];
  state.panelPhotos = layout.panels.map(() => key);
  buildPanelList();
  renderPreview();
  status(`Photo set: ${key === 'upload' ? 'your upload' : key}.`);
}

function buildLayoutButtons() {
  const box = $('layoutBtns');
  box.innerHTML = '';
  Object.entries(LAYOUTS).forEach(([key, layout]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.label;
    b.dataset.layout = key;
    b.className = key === state.layout ? 'picked' : '';
    b.addEventListener('click', () => {
      state.layout = key;
      state.panelPhotos = layout.panels.map(() => state.activePhoto);
      buildLayoutButtons();
      buildPanelList();
      renderPreview();
    });
    box.appendChild(b);
  });
}

function buildGradeButtons() {
  const box = $('gradeBtns');
  box.innerHTML = '';
  Object.entries(GRADES).forEach(([key, grade]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = key;
    b.className = key === state.grade ? 'picked' : '';
    const dot = document.createElement('span');
    dot.className = 'swatch';
    dot.style.background = `linear-gradient(135deg, ${grade.skyMid}, ${grade.highlight})`;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(grade.label));
    b.addEventListener('click', () => {
      state.grade = key;
      buildGradeButtons();
      renderPreview();
    });
    box.appendChild(b);
  });
}

function buildPanelList() {
  const list = $('panelList');
  if (!list) return;
  list.innerHTML = '';
  const layout = LAYOUTS[state.layout];
  layout.panels.forEach((panel, i) => {
    const row = document.createElement('label');
    row.className = 'panel-row';
    row.textContent = `Panel ${i + 1} photo`;
    const sel = document.createElement('select');
    sel.dataset.panel = String(i);
    const choices = [
      ['sample1', 'Boulevard (sample)'],
      ['sample2', 'Pier (sample)'],
      ['upload', 'Your upload'],
    ];
    choices.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (state.panelPhotos[i] === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      state.panelPhotos[i] = sel.value;
      renderPreview();
    });
    row.appendChild(sel);
    list.appendChild(row);
  });
}

function exportPNG(w, h, name) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  renderCover(cv.getContext('2d'), w, h, state);
  cv.toBlob((blob) => {
    if (!blob) {
      status('Export failed.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status(`Exported ${name} (${w}×${h}).`);
  }, 'image/png');
}

function autoCover() {
  state.layout = 'hero';
  state.grade = 'sunset';
  state.zoom = 1.15;
  state.panX = 0;
  state.panY = 0;
  state.panelPhotos = LAYOUTS.hero.panels.map(() => state.activePhoto);
  $('zoomRange').value = '1.15';
  $('zoomVal').textContent = '1.15×';
  buildLayoutButtons();
  buildGradeButtons();
  buildPanelList();
  renderPreview();
  status('Auto-cover applied: Hero layout, Sunset grade.');
}

function bindControls() {
  $('fileInput').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    loadImage(url)
      .then((img) => {
        state.photos.upload = img;
        setActivePhoto('upload');
      })
      .catch(() => status('Could not read that photo.'));
  });
  $('sample1Btn').addEventListener('click', () => setActivePhoto('sample1'));
  $('sample2Btn').addEventListener('click', () => setActivePhoto('sample2'));
  $('zoomRange').addEventListener('input', (ev) => {
    state.zoom = parseFloat(ev.target.value);
    $('zoomVal').textContent = `${state.zoom.toFixed(2)}×`;
    renderPreview();
  });
  $('titleInput').addEventListener('input', (ev) => {
    state.title = ev.target.value;
    renderPreview();
  });
  $('captionInput').addEventListener('input', (ev) => {
    state.caption = ev.target.value;
    renderPreview();
  });
  document.querySelectorAll('input[name="size"]').forEach((radio) => {
    radio.addEventListener('change', renderPreview);
  });
  $('exportSquare').addEventListener('click', () => exportPNG(1080, 1080, 'leonida-cover-1080x1080.png'));
  $('exportPortrait').addEventListener('click', () => exportPNG(1080, 1350, 'leonida-cover-1080x1350.png'));
  $('exportWide').addEventListener('click', () => exportPNG(1920, 1080, 'leonida-cover-1920x1080.png'));
  $('autoBtn').addEventListener('click', autoCover);
  // Drag on the preview to pan the photo inside its panels.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  preview.addEventListener('pointerdown', (ev) => {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    preview.setPointerCapture(ev.pointerId);
  });
  preview.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    state.panX += (ev.clientX - lastX) / 40;
    state.panY += (ev.clientY - lastY) / 40;
    state.panX = Math.max(-6, Math.min(6, state.panX));
    state.panY = Math.max(-6, Math.min(6, state.panY));
    lastX = ev.clientX;
    lastY = ev.clientY;
    renderPreview();
  });
  preview.addEventListener('pointerup', () => {
    dragging = false;
  });
}

// Stage a deterministic screenshot from ?shot=... parameters. The shot
// stager (shots.js) parses the URL; this applies one staged shot.
export function applyShot(shot) {
  if (!shot) return false;
  if (shot.layout && LAYOUTS[shot.layout]) state.layout = shot.layout;
  if (shot.grade && GRADES[shot.grade]) state.grade = shot.grade;
  if (shot.photo) state.activePhoto = shot.photo;
  if (shot.title !== undefined) {
    state.title = shot.title;
    $('titleInput').value = shot.title;
  }
  if (shot.caption !== undefined) {
    state.caption = shot.caption;
    $('captionInput').value = shot.caption;
  }
  if (shot.zoom) {
    state.zoom = shot.zoom;
    $('zoomRange').value = String(shot.zoom);
    $('zoomVal').textContent = `${shot.zoom.toFixed(2)}×`;
  }
  if (shot.size) {
    // Match the preview canvas to the shot's poster size so a cover-only
    // screenshot fills its window exactly (no letterbox bars).
    const ratio = shot.size === '1080x1080' ? '1:1' : shot.size === '1080x1350' ? '4:5' : '16:9';
    const radio = document.querySelector(`input[name="size"][value="${ratio}"]`);
    if (radio) radio.checked = true;
  }
  const layout = LAYOUTS[state.layout];
  state.panelPhotos = layout.panels.map(() => state.activePhoto);
  if (shot.panelPhotos) {
    shot.panelPhotos.forEach((key, i) => {
      if (state.panelPhotos[i] !== undefined && (key === 'sample1' || key === 'sample2' || key === 'upload')) {
        state.panelPhotos[i] = key;
      }
    });
  }
  buildLayoutButtons();
  buildGradeButtons();
  buildPanelList();
  if (shot.mode === 'cover') {
    document.body.classList.add('cover-only');
  }
  renderPreview();
  return true;
}

export async function startApp() {
  bindControls();
  buildLayoutButtons();
  buildGradeButtons();
  buildPanelList();
  await loadSamples();
  const { stageShotFromUrl } = await import('./shots.js');
  const shot = stageShotFromUrl();
  if (shot) {
    applyShot(shot);
  } else {
    renderPreview();
  }
  status('Ready — pick a photo, a layout and a grade, then export.');
}

startApp();
