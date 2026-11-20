// Leonida Key Art — the poster renderer.
//
// Draws a GTA-style cover poster onto a canvas: photo panels with a halftone
// comic treatment and a duotone sunset/neon grade, a bold title block with a
// sun disc, and a caption strip. Everything is drawn from the state passed in;
// nothing is loaded from the network and every render is deterministic.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    shadow: [26, 12, 44],
    mid: [214, 74, 54],
    highlight: [255, 214, 130],
    contrast: 1.12,
    saturation: 1.25,
    skyTop: '#2b0f3f',
    skyMid: '#c73e4e',
    skyBottom: '#ffb347',
  },
  neon: {
    label: 'Neon Night',
    shadow: [8, 10, 34],
    mid: [146, 32, 168],
    highlight: [64, 224, 255],
    contrast: 1.18,
    saturation: 1.35,
    skyTop: '#05081f',
    skyMid: '#3b1d7a',
    skyBottom: '#ff2e88',
  },
  vice: {
    label: 'Vice Pink',
    shadow: [30, 8, 40],
    mid: [219, 48, 120],
    highlight: [255, 178, 220],
    contrast: 1.1,
    saturation: 1.3,
    skyTop: '#330a3d',
    skyMid: '#d63384',
    skyBottom: '#ff9ecf',
  },
  noir: {
    label: 'Noir',
    shadow: [10, 10, 12],
    mid: [96, 96, 104],
    highlight: [244, 238, 226],
    contrast: 1.28,
    saturation: 0.12,
    skyTop: '#0c0c0e',
    skyMid: '#3a3a40',
    skyBottom: '#c9c2b4',
  },
};

export const LAYOUTS = {
  hero: {
    label: 'Hero',
    // One big photo, title across the bottom. Focus low on the character.
    panels: [{ x: 0.03, y: 0.03, w: 0.94, h: 0.66, focus: [0.48, 0.6] }],
    title: { x: 0.05, y: 0.72, w: 0.9, h: 0.16 },
    caption: { x: 0.05, y: 0.9, w: 0.9, h: 0.07 },
  },
  split: {
    label: 'Split',
    // Two photos side by side, title bar on top.
    panels: [
      { x: 0.03, y: 0.2, w: 0.455, h: 0.56, focus: [0.32, 0.5] },
      { x: 0.515, y: 0.2, w: 0.455, h: 0.56, focus: [0.68, 0.5] },
    ],
    title: { x: 0.05, y: 0.03, w: 0.9, h: 0.14 },
    caption: { x: 0.05, y: 0.79, w: 0.9, h: 0.17 },
  },
  strip: {
    label: 'Strip',
    // Hero photo on top, three small panels in a row below.
    panels: [
      { x: 0.03, y: 0.03, w: 0.94, h: 0.44, focus: [0.5, 0.4] },
      { x: 0.03, y: 0.5, w: 0.3, h: 0.26, focus: [0.2, 0.55] },
      { x: 0.35, y: 0.5, w: 0.3, h: 0.26, focus: [0.5, 0.55] },
      { x: 0.67, y: 0.5, w: 0.3, h: 0.26, focus: [0.8, 0.55] },
    ],
    title: { x: 0.05, y: 0.79, w: 0.9, h: 0.11 },
    caption: { x: 0.05, y: 0.91, w: 0.9, h: 0.06 },
  },
};

// A tiny seeded random generator so the paper grain is identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// A grade colour is an [r, g, b] array; canvas colour APIs need a string.
function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Map every pixel through the grade: luminance picks a point on the
// shadow -> mid -> highlight ramp, then contrast and saturation are applied.
export function duotoneImageData(imageData, grade) {
  const d = imageData.data;
  const [sr, sg, sb] = grade.shadow;
  const [mr, mg, mb] = grade.mid;
  const [hr, hg, hb] = grade.highlight;
  const c = grade.contrast;
  const s = grade.saturation;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    let nr, ng, nb;
    if (lum < 0.5) {
      const t = lum / 0.5;
      nr = sr + (mr - sr) * t;
      ng = sg + (mg - sg) * t;
      nb = sb + (mb - sb) * t;
    } else {
      const t = (lum - 0.5) / 0.5;
      nr = mr + (hr - mr) * t;
      ng = mg + (hg - mg) * t;
      nb = mb + (hb - mb) * t;
    }
    // Contrast around middle grey, then saturation around luminance.
    nr = (nr - 128) * c + 128;
    ng = (ng - 128) * c + 128;
    nb = (nb - 128) * c + 128;
    const l = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    nr = l + (nr - l) * s;
    ng = l + (ng - l) * s;
    nb = l + (nb - l) * s;
    d[i] = clamp255(nr);
    d[i + 1] = clamp255(ng);
    d[i + 2] = clamp255(nb);
  }
  return imageData;
}

// Draw one photo into a panel rect, cover-fit, centred on the panel's focus
// point and scaled by the shared zoom. Returns the offscreen canvas holding
// the graded, halftoned panel image.
export function renderPanel(img, rect, grade, zoom, panX, panY, seed) {
  const w = Math.max(2, Math.round(rect.w));
  const h = Math.max(2, Math.round(rect.h));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const fx = rect.focus ? rect.focus[0] : 0.5;
  const fy = rect.focus ? rect.focus[1] : 0.5;
  const dx = w / 2 - fx * dw + panX * w * 0.1;
  const dy = h / 2 - fy * dh + panY * h * 0.1;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
  const data = ctx.getImageData(0, 0, w, h);
  duotoneImageData(data, grade);
  ctx.putImageData(data, 0, 0);
  // Halftone dot screen in the shadows: bigger dots where the image is dark.
  // Read the pixels once from a single snapshot instead of once per dot.
  const step = Math.max(5, Math.round(w / 160));
  const snap = ctx.getImageData(0, 0, w, h).data;
  const rnd = mulberry32(seed);
  ctx.fillStyle = 'rgba(8, 6, 16, 0.55)';
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const pi = (Math.min(h - 1, Math.floor(y)) * w + Math.min(w - 1, Math.floor(x))) * 4;
      const lum = (0.299 * snap[pi] + 0.587 * snap[pi + 1] + 0.114 * snap[pi + 2]) / 255;
      const r = (1 - lum) * step * 0.42;
      if (r > 0.6) {
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * 1.5, y + (rnd() - 0.5) * 1.5, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return cv;
}

function drawSky(ctx, W, H, grade) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, grade.skyTop);
  g.addColorStop(0.55, grade.skyMid);
  g.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTitleBlock(ctx, rect, grade, title) {
  const { x, y, w, h } = rect;
  // Sun disc behind the title, kept inside the title band.
  const cx = x + w * 0.82;
  const cy = y + h * 0.42;
  const rad = h * 0.68;
  const sun = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
  sun.addColorStop(0, rgb(grade.highlight));
  sun.addColorStop(0.7, rgb(grade.mid));
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  // Giant title, heavy face, black outline, bright fill.
  const size = Math.floor(h * 0.92);
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const text = (title || 'LEONIDA').toUpperCase();
  const tx = x + w * 0.02;
  const ty = y + h * 0.52;
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeStyle = '#0b0614';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, tx, ty);
  const fill = ctx.createLinearGradient(tx, y, tx, y + h);
  fill.addColorStop(0, '#fff7e6');
  fill.addColorStop(0.55, rgb(grade.highlight));
  fill.addColorStop(1, rgb(grade.mid));
  ctx.fillStyle = fill;
  ctx.fillText(text, tx, ty);
  // Small "VI" badge tucked after the title.
  const badge = 'VI';
  const bw = ctx.measureText(text).width;
  const bx = tx + bw + size * 0.22;
  ctx.font = `900 ${Math.floor(size * 0.58)}px "Arial Black", system-ui, sans-serif`;
  ctx.fillStyle = rgb(grade.highlight);
  ctx.strokeStyle = '#0b0614';
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.strokeText(badge, bx, ty - size * 0.08);
  ctx.fillText(badge, bx, ty - size * 0.08);
}

function drawCaptionStrip(ctx, rect, grade, caption) {
  const { x, y, w, h } = rect;
  ctx.fillStyle = 'rgba(8, 5, 18, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgb(grade.highlight);
  ctx.fillRect(x, y, Math.max(4, w * 0.012), h);
  const size = Math.floor(h * 0.52);
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5efe4';
  const text = caption || '';
  ctx.fillText(text, x + w * 0.03, y + h * 0.54, w * 0.94);
}

function drawGrain(ctx, W, H, seed) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const n = Math.floor((W * H) / 9000);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < n / 2; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
}

// Render the whole poster. `state` carries the photos (a map from photo key
// to an HTMLImageElement), the layout and grade names, zoom/pan, title and
// caption. Every call with the same state draws the same pixels.
export function renderCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
  drawSky(ctx, W, H, grade);
  const photos = state.photos || {};
  const fallback = photos.sample1 || photos.sample2 || null;
  layout.panels.forEach((p, i) => {
    const rect = {
      x: p.x * W,
      y: p.y * H,
      w: p.w * W,
      h: p.h * H,
      focus: p.focus,
    };
    const key = (state.panelPhotos && state.panelPhotos[i]) || 'sample1';
    const img = photos[key] || fallback;
    if (img) {
      const panel = renderPanel(img, rect, grade, state.zoom || 1, state.panX || 0, state.panY || 0, 1000 + i * 77);
      ctx.drawImage(panel, rect.x, rect.y);
    } else {
      ctx.fillStyle = '#1a1026';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    // Thick comic outline + white gutter keyline around every panel.
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.strokeStyle = '#0b0614';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
  });
  drawTitleBlock(
    ctx,
    { x: layout.title.x * W, y: layout.title.y * H, w: layout.title.w * W, h: layout.title.h * H },
    grade,
    state.title
  );
  drawCaptionStrip(
    ctx,
    { x: layout.caption.x * W, y: layout.caption.y * H, w: layout.caption.w * W, h: layout.caption.h * H },
    grade,
    state.caption
  );
  drawGrain(ctx, W, H, 7);
}
