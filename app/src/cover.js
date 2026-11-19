// Vice Panel Press — cover engine. Draws a multi-panel GTA-style poster cover
// onto any 2D canvas from a plain state object. Pure canvas, no network.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

export const LAYOUTS = {
  grid4: { label: 'Four Panels', slots: 4 },
  hero3: { label: 'Hero + Three', slots: 4 },
  fullbleed: { label: 'Full Bleed', slots: 1 },
  tilt: { label: 'Tilted Snapshots', slots: 3 },
  grid9: { label: 'Nine Panels', slots: 9 },
  strip: { label: 'Three Bands', slots: 3 },
};

// Gradient-map ramps: [stop, r, g, b]. Luminance in, poster colour out.
export const GRADES = {
  sunset: { label: 'Sunset', stops: [[0, 10, 6, 26], [0.25, 66, 18, 66], [0.5, 178, 64, 96], [0.75, 255, 140, 64], [1, 255, 236, 190]] },
  neon: { label: 'Neon Night', stops: [[0, 2, 8, 20], [0.3, 10, 42, 82], [0.55, 16, 122, 140], [0.8, 230, 40, 160], [1, 255, 240, 255]] },
  vice: { label: 'Vice Gold', stops: [[0, 12, 4, 34], [0.35, 92, 20, 112], [0.6, 202, 62, 142], [0.85, 255, 182, 82], [1, 255, 244, 202]] },
  dusk: { label: 'Dusk Blue', stops: [[0, 4, 8, 22], [0.3, 24, 42, 92], [0.6, 92, 92, 152], [0.85, 242, 122, 82], [1, 255, 222, 172]] },
  mono: { label: 'Noir', stops: [[0, 5, 5, 9], [0.5, 122, 112, 106], [1, 250, 244, 230]] },
};

const GRADE_CACHE = new Map();
const RAMP_CACHE = new Map();

function buildRamp(stops) {
  const ramp = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    ramp[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    ramp[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    ramp[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  return ramp;
}

function gradeRamp(name) {
  if (!RAMP_CACHE.has(name)) RAMP_CACHE.set(name, buildRamp(GRADES[name].stops));
  return RAMP_CACHE.get(name);
}

// Cover-fit draw of img into rect, with per-panel zoom and pan offsets.
function drawFitted(ctx, img, x, y, w, h, zoom, dx, dy) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2 + dx, y + (h - dh) / 2 + dy, dw, dh);
}

// Applies the grade's gradient map to a canvas region, cached per photo+grade+size.
function gradedPhoto(img, grade, w, h) {
  const key = `${img.dataset.pid || img.src}|${grade}|${w}x${h}`;
  if (GRADE_CACHE.has(key)) return GRADE_CACHE.get(key);
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const octx = off.getContext('2d');
  const scale = Math.max(off.width / img.naturalWidth, off.height / img.naturalHeight);
  octx.drawImage(img, (off.width - img.naturalWidth * scale) / 2, (off.height - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  const data = octx.getImageData(0, 0, off.width, off.height);
  const px = data.data;
  const ramp = gradeRamp(grade);
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = ramp[lum * 3];
    px[i + 1] = ramp[lum * 3 + 1];
    px[i + 2] = ramp[lum * 3 + 2];
  }
  octx.putImageData(data, 0, 0);
  GRADE_CACHE.set(key, off);
  if (GRADE_CACHE.size > 24) GRADE_CACHE.delete(GRADE_CACHE.keys().next().value);
  return off;
}

export function clearGradeCache() { GRADE_CACHE.clear(); }

// Panel rectangles for a layout, in canvas pixels. Returns [{x,y,w,h,rot}] plus
// the title band rect. gap is the gutter between panels, bandH the title strip.
export function layoutSlots(layout, W, H) {
  const bandH = Math.round(H * 0.18);
  const frame = Math.max(10, Math.round(W * 0.012));
  const gap = Math.max(6, Math.round(W * 0.008));
  const ax = frame;
  const ay = frame;
  const aw = W - frame * 2;
  const ah = H - bandH - frame * 2;
  const box = (fx, fy, fw, fh, rot = 0) => ({
    x: ax + fx * aw, y: ay + fy * ah, w: fw * aw, h: fh * ah, rot,
  });
  let slots;
  switch (layout) {
    case 'hero3':
      slots = [box(0, 0, 0.62, 1), box(0.62 + gap / aw, 0, 0.38 - gap / aw, 1 / 3 - gap / ah), box(0.62 + gap / aw, 1 / 3, 0.38 - gap / aw, 1 / 3), box(0.62 + gap / aw, 2 / 3 + gap / ah, 0.38 - gap / aw, 1 / 3 - gap / ah)];
      break;
    case 'fullbleed':
      slots = [{ x: 0, y: 0, w: W, h: H, rot: 0 }];
      break;
    case 'tilt':
      slots = [box(0.02, 0.3, 0.44, 0.52, -6), box(0.54, 0.28, 0.44, 0.52, 5), box(0.2, 0.04, 0.6, 0.62, -2)];
      break;
    case 'grid9':
      slots = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) slots.push(box(c / 3 + (c ? gap / aw / 2 : 0), r / 3 + (r ? gap / ah / 2 : 0), 1 / 3 - (c === 2 ? 0 : gap / aw / 2) - (c === 0 ? gap / aw / 2 : 0), 1 / 3 - (r === 2 ? 0 : gap / ah / 2) - (r === 0 ? gap / ah / 2 : 0)));
      break;
    case 'strip':
      slots = [box(0, 0, 1, 1 / 3 - gap / ah / 2), box(0, 1 / 3 + gap / ah / 2, 1, 1 / 3 - gap / ah), box(0, 2 / 3 + gap / ah / 2, 1, 1 / 3 - gap / ah / 2)];
      break;
    case 'grid4':
    default:
      slots = [box(0, 0, 0.5 - gap / aw / 2, 0.5 - gap / ah / 2), box(0.5 + gap / aw / 2, 0, 0.5 - gap / aw / 2, 0.5 - gap / ah / 2), box(0, 0.5 + gap / ah / 2, 0.5 - gap / aw / 2, 0.5 - gap / ah / 2), box(0.5 + gap / aw / 2, 0.5 + gap / ah / 2, 0.5 - gap / aw / 2, 0.5 - gap / ah / 2)];
      break;
  }
  return { slots, band: { x: 0, y: H - bandH, w: W, h: bandH }, text: { x: frame, y: H - bandH, w: W - frame * 2, h: bandH - frame }, frame };
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = 128;
  noiseTile.height = 128;
  const c = noiseTile.getContext('2d');
  const d = c.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 28;
  }
  c.putImageData(d, 0, 0);
  return noiseTile;
}

function fitTitleFont(ctx, text, maxW, startPx, family) {
  let px = startPx;
  while (px > 24) {
    ctx.font = `900 ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return px;
    px = Math.floor(px * 0.92);
  }
  return px;
}

function drawTitleBlock(ctx, state, text, W) {
  const { title, subtitle, badge } = state;
  const pad = Math.round(text.w * 0.04);
  const tx = text.x + pad;
  const titlePx = fitTitleFont(ctx, title.toUpperCase(), text.w - pad * 2, Math.round(text.h * 0.46), '"Arial Black", "Noto Sans Black", "Noto Sans", sans-serif');
  const cy = text.y + text.h * 0.52;
  ctx.save();
  // Shear the title around its own baseline start, so the slant never
  // shifts the text off the canvas the way a global shear would.
  ctx.translate(tx, cy);
  ctx.transform(1, 0, -0.05, 1, 0, 0);
  ctx.translate(-tx, -cy);
  ctx.font = `900 ${titlePx}px "Arial Black", "Noto Sans Black", "Noto Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(titlePx * 0.12);
  ctx.shadowOffsetY = Math.round(titlePx * 0.05);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14081f';
  ctx.lineWidth = Math.max(2, Math.round(titlePx / 11));
  ctx.strokeText(title.toUpperCase(), tx + Math.round(titlePx * 0.03), cy);
  const grad = ctx.createLinearGradient(tx, cy - titlePx / 2, tx, cy + titlePx / 2);
  grad.addColorStop(0, '#fff7e8');
  grad.addColorStop(0.55, '#ffffff');
  grad.addColorStop(1, '#ffd166');
  ctx.fillStyle = grad;
  ctx.fillText(title.toUpperCase(), tx + Math.round(titlePx * 0.03), cy);
  ctx.restore();
  if (subtitle) {
    const subPx = Math.max(16, Math.round(text.h * 0.16));
    ctx.font = `italic 700 ${subPx}px Georgia, "Noto Serif", serif`;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = Math.round(subPx * 0.7);
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(subtitle, tx + 2, text.y + text.h * 0.88);
    ctx.shadowBlur = 0;
  }
  if (badge) {
    const bPx = Math.max(13, Math.round(text.h * 0.13));
    ctx.font = `700 ${bPx}px "Noto Sans", sans-serif`;
    const tw = ctx.measureText(badge).width + bPx * 1.6;
    const bx = text.x + text.w - pad - tw;
    const by = text.y + Math.round(text.h * 0.1);
    const bh = bPx * 2;
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.roundRect(bx, by, tw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, bx + bPx * 0.8, by + bh / 2 + 1);
  }
}

// Main entry: draws the whole cover for `state` onto `canvas`.
// state: {size, layout, grade, title, subtitle, badge, grain, vignette, frame,
//          photos: HTMLImageElement[], panels: [{photo, zoom, dx, dy}]}
export function drawCover(canvas, state) {
  const size = SIZES[state.size] || SIZES.square;
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const W = size.w;
  const H = size.h;
  const { slots, band, text, frame } = layoutSlots(state.layout, W, H);

  // Base: deep dusk gradient.
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#1a0b2e');
  base.addColorStop(0.5, '#2b0f3c');
  base.addColorStop(1, '#0d0a1a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const photos = state.photos || [];
  const panels = state.panels || [];
  slots.forEach((slot, i) => {
    const p = panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const img = photos[p.photo] || photos[0];
    if (!img) return;
    ctx.save();
    if (slot.rot) {
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      ctx.rotate((slot.rot * Math.PI) / 180);
      ctx.translate(-slot.w / 2, -slot.h / 2);
    } else {
      ctx.translate(slot.x, slot.y);
    }
    if (state.layout === 'tilt') {
      // Polaroid card: white border, thicker lip at the bottom.
      ctx.fillStyle = '#fdf8ef';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = Math.round(W * 0.015);
      ctx.shadowOffsetY = Math.round(W * 0.008);
      ctx.fillRect(-slot.w * 0.03, -slot.h * 0.03, slot.w * 1.06, slot.h * 1.1);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    const inset = state.layout === 'tilt' ? slot.w * 0.015 : 0;
    const lip = state.layout === 'tilt' ? slot.h * 0.07 : 0;
    const pw = slot.w - inset * 2;
    const ph = slot.h - inset * 2 - lip;
    ctx.beginPath();
    ctx.rect(inset, inset, pw, ph);
    ctx.clip();
    if (state.grade && state.grade !== 'none') {
      const g = gradedPhoto(img, state.grade, Math.round(pw), Math.round(ph));
      const scale = Math.max(pw / g.width, ph / g.height) * (p.zoom || 1);
      ctx.drawImage(g, inset + (pw - g.width * scale) / 2 + (p.dx || 0), inset + (ph - g.height * scale) / 2 + (p.dy || 0), g.width * scale, g.height * scale);
    } else {
      drawFitted(ctx, img, inset, inset, pw, ph, p.zoom || 1, p.dx || 0, p.dy || 0);
    }
    ctx.restore();
    // Thin inner keyline on flat layouts.
    if (state.layout !== 'tilt' && state.layout !== 'fullbleed') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, Math.round(W * 0.0015));
      ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.w - 1, slot.h - 1);
      ctx.restore();
    }
  });

  // Title band: solid strip, or a scrim over full-bleed.
  if (state.layout === 'fullbleed') {
    const scrim = ctx.createLinearGradient(0, band.y - band.h, 0, H);
    scrim.addColorStop(0, 'rgba(10,4,24,0)');
    scrim.addColorStop(0.45, 'rgba(10,4,24,0.72)');
    scrim.addColorStop(1, 'rgba(10,4,24,0.94)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, band.y - band.h, W, band.h * 2 - frame);
  } else {
    const strip = ctx.createLinearGradient(0, band.y, 0, H);
    strip.addColorStop(0, '#241040');
    strip.addColorStop(1, '#12081f');
    ctx.fillStyle = strip;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(band.x, band.y, band.w, Math.max(3, Math.round(H * 0.004)));
  }
  drawTitleBlock(ctx, state, text, W);

  // Outer frame.
  if (state.frame) {
    ctx.strokeStyle = '#fdf8ef';
    ctx.lineWidth = frame;
    ctx.strokeRect(frame / 2, frame / 2, W - frame, H - frame);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(1, Math.round(W * 0.0015));
    ctx.strokeRect(frame + 1, frame + 1, W - frame * 2 - 2, H - frame * 2 - 2);
  }

  // Grain + vignette.
  if (state.grain) {
    const tile = grainTile();
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  return canvas;
}
