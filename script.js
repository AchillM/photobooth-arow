/* SnapBooth — photobooth online (HTML + CSS + JS murni) */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PHOTO_W = 800, PHOTO_H = 600, TOTAL = 4;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/* ------------------------------------------------------------------ */
/*  STATE                                                              */
/* ------------------------------------------------------------------ */
const state = {
  stream: null, facing: 'user', mirror: true,
  photos: [], running: false, cancel: false,
  layout: 'strip', filter: 'none', theme: 'dots', color: '#ffb3c7',
  caption: 'Photobooth ✨', showDate: true,
  stickers: [], selected: null, activeEmoji: '💖', nextId: 1
};
const filterCache = new Map();

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */
const FILTERS = [
  { id: 'none',    name: 'Asli',        p: {} },
  { id: 'bw',      name: 'Hitam Putih', p: { gray: 1, contrast: 1.1 } },
  { id: 'sepia',   name: 'Sepia',       p: { sepia: 1 } },
  { id: 'vintage', name: 'Vintage',     p: { sepia: .35, contrast: .92, bright: 1.05, tint: [255, 200, 140, .14] } },
  { id: 'warm',    name: 'Hangat',      p: { sat: 1.15, tint: [255, 150, 50, .16] } },
  { id: 'cool',    name: 'Sejuk',       p: { sat: 1.05, tint: [70, 140, 255, .16] } },
  { id: 'vivid',   name: 'Vivid',       p: { sat: 1.55, contrast: 1.12 } },
  { id: 'fade',    name: 'Pudar',       p: { contrast: .78, bright: 1.12, sat: .8 } },
  { id: 'pink',    name: 'Pinky',       p: { bright: 1.06, sat: 1.1, tint: [255, 110, 185, .24] } },
  { id: 'dream',   name: 'Dreamy',      p: { bright: 1.1, contrast: .9, sat: 1.2, tint: [200, 170, 255, .2] } },
  { id: 'lemon',   name: 'Lemon',       p: { bright: 1.08, sat: 1.3, tint: [255, 240, 120, .18] } },
  { id: 'noir',    name: 'Noir',        p: { gray: 1, contrast: 1.5, bright: .9 } }
];

const THEMES = [
  { id: 'solid',    name: 'Polos',    ico: '⬜' },
  { id: 'gradient', name: 'Gradasi',  ico: '🌅' },
  { id: 'dots',     name: 'Polkadot', ico: '⚪' },
  { id: 'stripes',  name: 'Garis',    ico: '🍬' },
  { id: 'gingham',  name: 'Kotak',    ico: '🧺' },
  { id: 'hearts',   name: 'Hati',     ico: '💗' },
  { id: 'stars',    name: 'Bintang',  ico: '⭐' },
  { id: 'confetti', name: 'Konfeti',  ico: '🎊' },
  { id: 'rainbow',  name: 'Pelangi',  ico: '🌈' }
];

const COLORS = ['#ffb3c7', '#ff8fab', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff',
                '#ffc6ff', '#ffffff', '#1f1b24', '#e63946', '#ff9f1c', '#2ec4b6', '#3a86ff', '#8338ec'];

const EMOJIS = ['😀', '😍', '🥰', '😎', '🤩', '😜', '🥳', '😇', '💖', '💕', '✨', '⭐', '🌟', '🎀', '🌸', '🌼',
                '🌈', '☁️', '🍓', '🍒', '🍭', '🍩', '🧁', '🐱', '🐶', '🐰', '🐻', '🦄', '🐥', '🦋', '🔥', '👑',
                '🎈', '🎉', '💌', '🕶️', '🍀', '🌙', '☀️', '💎'];

/* ------------------------------------------------------------------ */
/*  ELEMEN                                                             */
/* ------------------------------------------------------------------ */
const video = $('#video'), cdEl = $('#countdown'), flashEl = $('#flash');
const camStatus = $('#camStatus'), camError = $('#camError'), shotBadge = $('#shotBadge');
const btnStart = $('#btnStart'), btnCancel = $('#btnCancel');
const stage = $('#stage'), sctx = stage.getContext('2d');

/* ------------------------------------------------------------------ */
/*  UTIL                                                               */
/* ------------------------------------------------------------------ */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb2css = a => `rgb(${a[0]},${a[1]},${a[2]})`;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ------------------------------------------------------------------ */
/*  EMOJI MELAYANG DI LATAR                                            */
/* ------------------------------------------------------------------ */
(function bgEmoji() {
  const box = $('#bgEmoji'), list = ['💖', '✨', '🌸', '⭐', '🎀', '🍓', '☁️', '🦋', '🌈', '🍭'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = list[i % list.length];
    s.style.left = Math.random() * 96 + '%'; s.style.top = Math.random() * 92 + '%';
    s.style.fontSize = (20 + Math.random() * 28) + 'px';
    s.style.animationDelay = (-Math.random() * 9) + 's';
    s.style.animationDuration = (7 + Math.random() * 6) + 's';
    box.appendChild(s);
  }
})();

/* ------------------------------------------------------------------ */
/*  KAMERA                                                             */
/* ------------------------------------------------------------------ */
function showCamError(msg) {
  if (msg) { $('#camErrorText').textContent = msg; camError.classList.remove('hidden'); camStatus.textContent = ''; btnStart.disabled = true; }
  else camError.classList.add('hidden');
}
function applyMirror() {
  video.classList.toggle('mirror', state.mirror);
  $('#btnMirror').classList.toggle('active', state.mirror);
}
function stopCamera() {
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  video.srcObject = null;
}
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|GSA\/|; wv\)/i.test(navigator.userAgent);

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms))]);
}
async function openStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false
    });
  } catch (err) {
    if (['OverconstrainedError', 'NotFoundError', 'TypeError'].includes(err.name))
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    throw err;
  }
}

async function startCamera() {
  stopCamera(); showCamError(null); $('#camGate').classList.add('hidden');
  camStatus.textContent = 'Menyiapkan kamera…'; btnStart.disabled = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCamError('Browser ini tidak mendukung kamera, atau halaman belum dibuka lewat HTTPS / localhost. Kamu tetap bisa memilih foto dari galeri.');
    return;
  }
  try {
    state.stream = await withTimeout(openStream(), 25000);
    video.muted = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
    video.srcObject = state.stream;
    await video.play().catch(() => {});
    state.camAllowed = true;
    applyMirror(); camStatus.textContent = ''; btnStart.disabled = false;
  } catch (err) {
    const m = {
      NotAllowedError: 'Izin kamera ditolak. Klik ikon gembok di address bar, izinkan kamera, lalu coba lagi.',
      NotFoundError: 'Kamera tidak ditemukan di perangkat ini.',
      NotReadableError: 'Kamera sedang dipakai aplikasi lain. Tutup dulu aplikasi tersebut.',
      OverconstrainedError: 'Kamera yang diminta tidak tersedia.',
      SecurityError: 'Akses kamera diblokir oleh browser atau kebijakan situs. Buka lewat Safari / Chrome langsung.',
      AbortError: 'Kamera gagal dimulai. Tutup aplikasi lain yang memakai kamera lalu coba lagi.',
      TimeoutError: 'Kamera tidak merespons. Buka halaman ini langsung di Safari (iPhone) atau Chrome (Android), bukan dari dalam aplikasi lain.'
    };
    showCamError(m[err.name] || ('Kamera tidak bisa dibuka (' + (err.name || 'error') + ').'));
  }
}

function capture() {
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw || !vh) return null;
  const c = document.createElement('canvas'); c.width = PHOTO_W; c.height = PHOTO_H;
  const x = c.getContext('2d'), target = PHOTO_W / PHOTO_H, va = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (va > target) { sw = vh * target; sx = (vw - sw) / 2; } else { sh = vw / target; sy = (vh - sh) / 2; }
  x.save();
  if (state.mirror) { x.translate(PHOTO_W, 0); x.scale(-1, 1); }
  x.drawImage(video, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
  x.restore();
  return c;
}

let audioCtx;
function initAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
function shutterSound() {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = 950; g.gain.value = .06;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .12); o.stop(audioCtx.currentTime + .13);
  } catch (e) {}
}

function updateThumbs() {
  $$('#shots .shot').forEach((el, i) => {
    const p = state.photos[i];
    if (p) { el.style.backgroundImage = `url(${p.toDataURL('image/jpeg', .5)})`; el.classList.add('filled'); }
    else { el.style.backgroundImage = ''; el.classList.remove('filled'); }
  });
  shotBadge.textContent = `Foto ${state.photos.length}/${TOTAL}`;
}

async function countdown(sec) {
  for (let s = sec; s > 0; s--) {
    if (state.cancel) { cdEl.textContent = ''; return false; }
    cdEl.textContent = s; cdEl.classList.remove('pop'); void cdEl.offsetWidth; cdEl.classList.add('pop');
    await sleep(1000);
  }
  cdEl.textContent = '';
  return !state.cancel;
}

function setRunning(on) {
  state.running = on;
  btnStart.classList.toggle('hidden', on); btnCancel.classList.toggle('hidden', !on);
  $('#timerSel').disabled = on; $('#btnSwitch').disabled = on; $('#btnMirror').disabled = on;
}

async function runSequence() {
  if (state.running) return;
  initAudio();
  state.photos = []; state.cancel = false; filterCache.clear(); updateThumbs(); setRunning(true);
  const sec = +$('#timerSel').value;
  for (let i = 0; i < TOTAL; i++) {
    camStatus.textContent = `Siap-siap! Foto ${i + 1} dari ${TOTAL} 😄`;
    const ok = await countdown(sec); if (!ok) break;
    camStatus.textContent = '';
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    shutterSound();
    const c = capture();
    if (!c) { toast('Gagal mengambil gambar dari kamera'); break; }
    state.photos.push(c); updateThumbs();
    if (i < TOTAL - 1) { await sleep(1100); if (state.cancel) break; }
  }
  camStatus.textContent = ''; setRunning(false);
  if (state.photos.length === TOTAL) { await sleep(700); goEdit(); }
  else { state.photos = []; updateThumbs(); if (state.cancel) toast('Dibatalkan'); }
}

/* ambil dari galeri */
function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => rej(new Error('gagal'));
    img.src = url;
  });
}
async function fromFiles(files) {
  files = [...files].filter(f => f.type.startsWith('image/')).slice(0, TOTAL);
  if (files.length < TOTAL) { toast(`Pilih ${TOTAL} foto ya (kamu memilih ${files.length})`); return; }
  try {
    const out = [];
    for (const f of files) {
      const img = await loadImage(f), c = document.createElement('canvas'); c.width = PHOTO_W; c.height = PHOTO_H;
      const x = c.getContext('2d'), t = PHOTO_W / PHOTO_H, a = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (a > t) { sw = img.height * t; sx = (img.width - sw) / 2; } else { sh = img.width / t; sy = (img.height - sh) / 2; }
      x.drawImage(img, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H); out.push(c);
    }
    state.photos = out; filterCache.clear(); updateThumbs(); goEdit();
  } catch (e) { toast('Foto tidak bisa dibaca'); }
}

/* ------------------------------------------------------------------ */
/*  FILTER (pixel — jalan di semua browser termasuk iOS Safari)        */
/* ------------------------------------------------------------------ */
function applyFilter(src, p, tw, th) {
  const c = document.createElement('canvas'); c.width = tw || src.width; c.height = th || src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
  if (!p || !Object.keys(p).length) return c;
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  const { gray = 0, sepia = 0, sat = 1, contrast = 1, bright = 1, tint = null } = p;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (sepia) {
      const sr = .393 * r + .769 * g + .189 * b, sg = .349 * r + .686 * g + .168 * b, sb = .272 * r + .534 * g + .131 * b;
      r += (sr - r) * sepia; g += (sg - g) * sepia; b += (sb - b) * sepia;
    }
    if (gray) { const l = .299 * r + .587 * g + .114 * b; r += (l - r) * gray; g += (l - g) * gray; b += (l - b) * gray; }
    if (sat !== 1) { const l = .299 * r + .587 * g + .114 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
    if (contrast !== 1) { r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128; }
    if (bright !== 1) { r *= bright; g *= bright; b *= bright; }
    if (tint) { const a = tint[3]; r += (tint[0] - r) * a; g += (tint[1] - g) * a; b += (tint[2] - b) * a; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  x.putImageData(img, 0, 0);
  return c;
}
function getFiltered() {
  const key = state.filter;
  if (!filterCache.has(key)) {
    const f = FILTERS.find(f => f.id === key) || FILTERS[0];
    filterCache.set(key, state.photos.map(p => applyFilter(p, f.p)));
  }
  return filterCache.get(key);
}

/* ------------------------------------------------------------------ */
/*  LAYOUT & RENDER                                                    */
/* ------------------------------------------------------------------ */
function getLayout() {
  if (state.layout === 'grid') {
    const pad = 50, pw = 520, ph = 390, gap = 24, footerH = 170, W = pad * 2 + pw * 2 + gap, H = pad + ph * 2 + gap + footerH;
    return { W, H, pad, u: W / 600, footerH, footerY: H - footerH, capSize: 64,
      slots: [0, 1, 2, 3].map(i => ({ x: pad + (i % 2) * (pw + gap), y: pad + Math.floor(i / 2) * (ph + gap), w: pw, h: ph })) };
  }
  const pad = 44, pw = 512, ph = 384, gap = 22, footerH = 150, W = 600, H = pad + ph * 4 + gap * 3 + footerH;
  return { W, H, pad, u: 1, footerH, footerY: H - footerH, capSize: 50,
    slots: [0, 1, 2, 3].map(i => ({ x: pad, y: pad + i * (ph + gap), w: pw, h: ph })) };
}

function drawFrameBg(ctx, L) {
  const { W, H, u } = L, base = state.color, rgb = hex2rgb(base);
  const light = rgb2css(mix(rgb, [255, 255, 255], .5)), dark = rgb2css(mix(rgb, [0, 0, 0], .18));
  ctx.save();
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

  switch (state.theme) {
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, light); g.addColorStop(.5, base); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break;
    }
    case 'dots': {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let y = 0, row = 0; y < H + 60 * u; y += 52 * u, row++)
        for (let x = (row % 2) * 26 * u; x < W + 60 * u; x += 52 * u) { ctx.beginPath(); ctx.arc(x, y, 11 * u, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'stripes': {
      ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 22 * u;
      for (let i = -H; i < W; i += 60 * u) { ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke(); }
      break;
    }
    case 'gingham': {
      const cell = 44 * u; ctx.fillStyle = 'rgba(255,255,255,.28)';
      for (let r = 0; r * cell < H; r += 2) ctx.fillRect(0, r * cell, W, cell);
      for (let c = 0; c * cell < W; c += 2) ctx.fillRect(c * cell, 0, cell, H);
      break;
    }
    case 'hearts': case 'stars': {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${36 * u}px "Segoe UI Symbol","Arial Unicode MS",sans-serif`;
      const ch = state.theme === 'hearts' ? '\u2665\uFE0E' : '\u2605';
      for (let y = 0, row = 0; y < H + 60 * u; y += 62 * u, row++)
        for (let x = (row % 2) * 31 * u; x < W + 60 * u; x += 62 * u) ctx.fillText(ch, x, y);
      break;
    }
    case 'confetti': {
      const rnd = mulberry32(2024), cols = ['rgba(255,255,255,.8)', light, dark, '#ffe66d', '#4ecdc4', '#ff6b6b', '#a29bfe'];
      const n = Math.round(W * H / (u * u) / 3000);
      for (let i = 0; i < n; i++) {
        const x = rnd() * W, y = rnd() * H, s = (6 + rnd() * 10) * u;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * 6.28);
        ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]; ctx.globalAlpha = .85;
        if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(-s / 2, -s / 4, s, s / 2);
        ctx.restore();
      }
      break;
    }
    case 'rainbow': {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff']
        .forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break;
    }
  }
  ctx.restore();

  // jahitan putus-putus di pinggir frame
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3 * u; ctx.setLineDash([14 * u, 10 * u]);
  rr(ctx, 12 * u, 12 * u, W - 24 * u, H - 24 * u, 26 * u); ctx.stroke();
  ctx.restore();
}

function drawCard(ctx, L, s, img) {
  const u = L.u, inset = 10 * u;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 6 * u;
  ctx.fillStyle = '#fff'; rr(ctx, s.x, s.y, s.w, s.h, 14 * u); ctx.fill();
  ctx.restore();
  if (!img) return;
  const x = s.x + inset, y = s.y + inset, w = s.w - inset * 2, h = s.h - inset * 2;
  ctx.save(); rr(ctx, x, y, w, h, 8 * u); ctx.clip();
  const t = w / h, a = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (a > t) { sw = img.height * t; sx = (img.width - sw) / 2; } else { sh = img.width / t; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function drawFooter(ctx, L) {
  const cap = state.caption.trim(), date = state.showDate;
  if (!cap && !date) return;
  const u = L.u, FONT = '"Fredok
