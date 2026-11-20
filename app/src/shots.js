// Leonida Key Art — the shot stager.
//
// Reads ?shot=... parameters from the page URL and turns them into one staged
// shot for screenshots: which layout, grade and photo, what title and caption,
// and whether the page shows the bare cover (for exported-cover shots) or the
// full editor (for editor shots). The screenshot commands pass these params so
// every screenshot is reproducible from the URL alone.
//
// Examples:
//   ?shot=cover&layout=hero&grade=sunset&photo=sample1&size=1920x1080
//   ?shot=editor&layout=split&grade=neon&photo=sample2
//   ?shot=cover&layout=strip&grade=vice&photo=sample1&panels=sample1,sample2,sample1,sample2

export function parseShotParams(search) {
  const q = new URLSearchParams(search);
  if (!q.get('shot')) return null;
  const shot = {
    mode: q.get('shot'),
    layout: q.get('layout') || undefined,
    grade: q.get('grade') || undefined,
    photo: q.get('photo') || undefined,
    title: q.get('title') === null ? undefined : q.get('title'),
    caption: q.get('caption') === null ? undefined : q.get('caption'),
    zoom: q.get('zoom') ? parseFloat(q.get('zoom')) : undefined,
    panelPhotos: q.get('panels') ? q.get('panels').split(',') : undefined,
    size: q.get('size') || undefined,
  };
  return shot;
}

export function stageShotFromUrl() {
  return parseShotParams(window.location.search);
}

// The four shots this entry ships, in dossier order. The first is the cover:
// a landscape exported cover, shown largest on the judge's contact sheet.
export const SHOTS = [
  {
    name: '1-cover.jpg',
    mode: 'cover',
    layout: 'hero',
    grade: 'sunset',
    photo: 'sample1',
    title: 'LEONIDA',
    caption: 'Welcome back to Vice City — the sun never sets on the score.',
    zoom: 1.3,
    size: '1920x1080',
    blurb: 'Exported landscape cover, Hero layout, Sunset grade.',
  },
  {
    name: '2-editor.jpg',
    mode: 'editor',
    layout: 'split',
    grade: 'neon',
    photo: 'sample2',
    title: 'LEONIDA',
    caption: 'Two nights, one city — every light is a promise.',
    zoom: 1.1,
    size: '1280x800',
    blurb: 'Editor in the browser with the pier photo loaded.',
  },
  {
    name: '3-cover-portrait.jpg',
    mode: 'cover',
    layout: 'split',
    grade: 'neon',
    photo: 'sample2',
    title: 'LEONIDA',
    caption: 'Two nights, one city — every light is a promise.',
    zoom: 1.2,
    size: '1080x1350',
    blurb: 'Exported portrait cover, Split layout, Neon Night grade.',
  },
  {
    name: '4-cover-square.jpg',
    mode: 'cover',
    layout: 'strip',
    grade: 'vice',
    photo: 'sample1',
    title: 'LEONIDA',
    caption: 'Welcome back to Vice City — the sun never sets on the score.',
    zoom: 1.15,
    size: '1080x1080',
    blurb: 'Exported square cover, Strip layout, Vice Pink grade.',
  },
];
