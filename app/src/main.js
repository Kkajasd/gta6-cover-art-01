// Vice Panel Press — editor wiring: state, photos, panels, history, export.
// Own design; the cover itself is drawn by cover.js.

import { SIZES, LAYOUTS, GRADES, layoutSlots, drawCover, clearGradeCache } from './cover.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_MAX = 860;

let pidCounter = 0;

function defaultPanels(layout, photoCount) {
  const n = LAYOUTS[layout].slots;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ photo: photoCount ? i % photoCount : 0, zoom: 1, dx: 0, dy: 0 });
  return out;
}

function defaultState() {
  return {
    size: 'square',
    layout: 'grid4',
    grade: 'sunset',
    title: 'VICE CITY',
    subtitle: 'Neon nights, golden days',
    badge: 'EST. 2026',
    grain: true,
    vignette: true,
    frame: true,
    photos: [],
    panels: defaultPanels('grid4', 0),
    selected: 0,
  };
}

const state = defaultState();
let history = [];
let future = [];
let offscreen = null;
let previewScale = 1;

function snapshot() {
  return JSON.stringify({
    size: state.size, layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle, badge: state.badge,
    grain: state.grain, vignette: state.vignette, frame: state.frame,
    panels: state.panels, selected: state.selected,
    photoIds: state.photos.map((p) => p.dataset.pid),
  });
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateHistoryButtons();
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.photos = state.photos.filter((p) => s.photoIds.includes(p.dataset.pid));
  state.panels = s.panels;
  syncControls();
  render();
}

function updateHistoryButtons() {
  $('undoBtn').disabled = history.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  updateHistoryButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  updateHistoryButtons();
}

function photoById(pid) {
  return state.photos.find((p) => p.dataset.pid === pid);
}

function loadImage(src, pid) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.dataset.pid = pid;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`, `sample-${name}`);
  addPhoto(img, `${name}.jpg`);
  return img;
}

function addPhoto(img, name) {
  // Same photo twice (a sample button pressed again, or the startup sample
  // racing a scene load) adds one thumbnail, not two.
  if (state.photos.some((p) => p.dataset.pid === img.dataset.pid)) return;
  state.photos.push(img);
  const li = document.createElement('button');
  li.className = 'thumb';
  li.type = 'button';
  li.title = name;
  const t = document.createElement('img');
  t.src = img.src;
  t.alt = name;
  li.appendChild(t);
  li.addEventListener('click', () => {
    pushHistory();
    state.panels[state.selected].photo = state.photos.indexOf(img);
    render();
  });
  $('photoList').appendChild(li);
  // Fill any panel that has no photo yet, and point the selected panel at it.
  state.panels.forEach((p) => { if (!state.photos[p.photo]) p.photo = state.photos.length - 1; });
  render();
}

async function addFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url, `up-${pidCounter++}`);
      addPhoto(img, f.name);
    } catch (e) { /* skip unreadable files */ }
  }
}

function render() {
  if (!state.photos.length) {
    const cv = $('preview');
    const ctx = cv.getContext('2d');
    cv.width = 640; cv.height = 640;
    ctx.fillStyle = '#1a0b2e';
    ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = '#fdf8ef';
    ctx.font = '700 28px "Noto Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add a photo to start', 320, 320);
    return;
  }
  if (!offscreen) offscreen = document.createElement('canvas');
  drawCover(offscreen, state);
  const size = SIZES[state.size];
  const scale = Math.min(1, PREVIEW_MAX / Math.max(size.w, size.h));
  previewScale = scale;
  const cv = $('preview');
  cv.width = Math.round(size.w * scale);
  cv.height = Math.round(size.h * scale);
  const ctx = cv.getContext('2d');
  ctx.drawImage(offscreen, 0, 0, cv.width, cv.height);
  // Selection outline over the selected panel.
  const { slots } = layoutSlots(state.layout, size.w, size.h);
  const sel = slots[state.selected];
  if (sel && state.layout !== 'fullbleed') {
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(sel.x * scale + 1.5, sel.y * scale + 1.5, sel.w * scale - 3, sel.h * scale - 3);
    ctx.restore();
  }
  updateCounts();
}

function updateCounts() {
  $('statusLine').textContent =
    `${LAYOUTS[state.layout].label} · ${GRADES[state.grade].label} · ${SIZES[state.size].label} · ${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} · panel ${state.selected + 1} selected`;
}

function syncControls() {
  document.querySelectorAll('#layoutBar button').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradeBar button').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizeBar button').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  $('frameToggle').checked = state.frame;
  const p = state.panels[state.selected];
  if (p) $('zoomSlider').value = String(Math.round((p.zoom || 1) * 100));
}

function changeLayout(layout) {
  if (!LAYOUTS[layout]) return;
  pushHistory();
  const old = state.panels;
  state.layout = layout;
  state.panels = defaultPanels(layout, state.photos.length);
  for (let i = 0; i < Math.min(old.length, state.panels.length); i++) state.panels[i] = { ...old[i] };
  if (state.selected >= state.panels.length) state.selected = 0;
  syncControls();
  render();
}

function changeGrade(grade) {
  if (!GRADES[grade]) return;
  pushHistory();
  state.grade = grade;
  clearGradeCache();
  syncControls();
  render();
}

function changeSize(size) {
  if (!SIZES[size]) return;
  pushHistory();
  state.size = size;
  syncControls();
  render();
}

function randomize() {
  pushHistory();
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.panels = defaultPanels(state.layout, state.photos.length);
  state.panels.forEach((p) => { p.zoom = 1 + Math.random() * 0.5; p.dx = (Math.random() - 0.5) * 60; p.dy = (Math.random() - 0.5) * 60; });
  clearGradeCache();
  syncControls();
  render();
}

function exportPNG() {
  if (!state.photos.length) return;
  if (!offscreen) offscreen = document.createElement('canvas');
  drawCover(offscreen, state);
  const size = SIZES[state.size];
  offscreen.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-panel-press-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function previewPoint(ev) {
  const r = $('preview').getBoundingClientRect();
  return { x: (ev.clientX - r.left) / previewScale, y: (ev.clientY - r.top) / previewScale };
}

function panelAt(x, y) {
  const size = SIZES[state.size];
  const { slots } = layoutSlots(state.layout, size.w, size.h);
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return i;
  }
  return -1;
}

function bindEvents() {
  $('photoInput').addEventListener('change', (ev) => { addFiles(ev.target.files); ev.target.value = ''; });
  document.querySelectorAll('#sampleBar button').forEach((b) => b.addEventListener('click', () => loadSample(b.dataset.sample).catch(() => {})));
  document.querySelectorAll('#layoutBar button').forEach((b) => b.addEventListener('click', () => changeLayout(b.dataset.layout)));
  document.querySelectorAll('#gradeBar button').forEach((b) => b.addEventListener('click', () => changeGrade(b.dataset.grade)));
  document.querySelectorAll('#sizeBar button').forEach((b) => b.addEventListener('click', () => changeSize(b.dataset.size)));
  $('titleInput').addEventListener('input', (ev) => { state.title = ev.target.value; render(); });
  $('subtitleInput').addEventListener('input', (ev) => { state.subtitle = ev.target.value; render(); });
  $('badgeInput').addEventListener('input', (ev) => { state.badge = ev.target.value; render(); });
  $('grainToggle').addEventListener('change', (ev) => { pushHistory(); state.grain = ev.target.checked; render(); });
  $('vignetteToggle').addEventListener('change', (ev) => { pushHistory(); state.vignette = ev.target.checked; render(); });
  $('frameToggle').addEventListener('change', (ev) => { pushHistory(); state.frame = ev.target.checked; render(); });
  $('zoomSlider').addEventListener('input', (ev) => {
    const p = state.panels[state.selected];
    if (p) { p.zoom = Number(ev.target.value) / 100; render(); }
  });
  $('zoomSlider').addEventListener('change', () => pushHistory());
  $('exportBtn').addEventListener('click', exportPNG);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('randomBtn').addEventListener('click', randomize);

  let drag = null;
  const cv = $('preview');
  cv.addEventListener('pointerdown', (ev) => {
    const pt = previewPoint(ev);
    const i = panelAt(pt.x, pt.y);
    if (i < 0) return;
    state.selected = i;
    const p = state.panels[i];
    drag = { x: pt.x, y: pt.y, dx: p.dx || 0, dy: p.dy || 0, moved: false };
    cv.setPointerCapture(ev.pointerId);
    syncControls();
    render();
  });
  cv.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const pt = previewPoint(ev);
    const p = state.panels[state.selected];
    p.dx = drag.dx + (pt.x - drag.x) / previewScale;
    p.dy = drag.dy + (pt.y - drag.y) / previewScale;
    drag.moved = true;
    render();
  });
  cv.addEventListener('pointerup', () => { if (drag && drag.moved) pushHistory(); drag = null; });
  cv.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = state.panels[state.selected];
    if (!p) return;
    p.zoom = Math.min(3, Math.max(0.6, (p.zoom || 1) * (ev.deltaY < 0 ? 1.08 : 0.93)));
    $('zoomSlider').value = String(Math.round(p.zoom * 100));
    render();
  }, { passive: false });
}

export function getApp() {
  return { state, render, loadSample, exportPNG, changeLayout, changeGrade, changeSize };
}

export function setCaption(title, subtitle) {
  if (title !== undefined) state.title = title;
  if (subtitle !== undefined) state.subtitle = subtitle;
  syncControls();
  render();
}

bindEvents();
syncControls();
render();
updateHistoryButtons();
// First paint with a sample photo so the editor is never empty.
loadSample('pier').catch(() => {});

window.__coverApp = getApp();
