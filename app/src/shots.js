// Screenshot scenes for the cover maker. Driven by URL params, e.g.
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&size=wide&layout=hero3
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
// Sets window.__shotReady once the scene has painted.

import { SIZES, LAYOUTS, drawCover } from './cover.js';
import { getApp, setCaption } from './main.js';

const SAMPLES = ['pier', 'boulevard'];

function loadSampleImage(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.dataset.pid = `shot-${name}`;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sample ${name} failed to load`));
    img.src = `samples/${name}.jpg`;
  });
}

async function loadScenePhotos(first) {
  const order = [first, ...SAMPLES.filter((s) => s !== first)];
  const imgs = [];
  for (const name of order) {
    try { imgs.push(await loadSampleImage(name)); } catch (e) { /* skip */ }
  }
  return imgs;
}

function sceneState(app, query, photos) {
  const layout = LAYOUTS[query.get('layout')] ? query.get('layout') : 'hero3';
  const grade = query.get('grade') || 'sunset';
  const size = SIZES[query.get('size')] ? query.get('size') : 'wide';
  const n = LAYOUTS[layout].slots;
  const panels = [];
  for (let i = 0; i < n; i++) panels.push({ photo: photos.length ? i % photos.length : 0, zoom: 1.1, dx: 0, dy: 0 });
  return {
    ...app.state,
    size, layout, grade,
    title: query.get('caption') || 'Sunset Heist',
    subtitle: query.get('subtitle') || 'Neon nights, golden days',
    badge: query.get('badge') || 'EST. 2026',
    photos, panels,
  };
}

function paintCoverToViewport(state) {
  const off = document.createElement('canvas');
  drawCover(off, state);
  const cv = document.getElementById('preview');
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(off, 0, 0, cv.width, cv.height);
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

async function runCoverScene(query) {
  document.body.classList.add('shot-cover');
  const app = getApp();
  const photos = await loadScenePhotos(query.get('photo') || 'pier');
  paintCoverToViewport(sceneState(app, query, photos));
  markReady();
}

async function runEditorScene(query) {
  const app = getApp();
  // Load both samples in a fixed order, so the panels can show two photos
  // and the scene never depends on which sample finished first.
  await app.loadSample('pier');
  await app.loadSample(query.get('photo') || 'boulevard');
  setCaption(query.get('caption') || 'Boulevard Queen', query.get('subtitle') || 'Neon nights, golden days');
  if (query.get('layout')) app.changeLayout(query.get('layout'));
  if (query.get('grade')) app.changeGrade(query.get('grade'));
  if (query.get('size')) app.changeSize(query.get('size'));
  app.state.panels.forEach((p, i) => { p.photo = i % app.state.photos.length; });
  app.render();
  markReady();
}

export async function playScene() {
  const query = new URLSearchParams(window.location.search);
  const shot = query.get('shot');
  if (!shot) return false;
  if (shot === 'cover') await runCoverScene(query);
  else if (shot === 'editor') await runEditorScene(query);
  else return false;
  return true;
}

playScene().catch(() => { window.__shotReady = true; });
