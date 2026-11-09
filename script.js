
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
  const u = L.u, FONT = '"Fredoka","Baloo 2","Comic Sans MS",cursive,sans-serif';
  let capSize = L.capSize;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const maxW = L.W - L.pad * 2 - 60 * u;
  if (cap) { ctx.font = `600 ${capSize}px ${FONT}`; while (ctx.measureText(cap).width > maxW && capSize > 18) { capSize -= 2; ctx.font = `600 ${capSize}px ${FONT}`; } }
  const dateSize = capSize * .5, dText = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const cy = L.footerY + L.footerH * (cap && date ? .36 : .5) + 4 * u;
  const dy = cap ? cy + capSize * .85 : L.footerY + L.footerH * .5;

  ctx.font = `600 ${capSize}px ${FONT}`;
  const w1 = cap ? ctx.measureText(cap).width : 0;
  ctx.font = `500 ${dateSize}px ${FONT}`;
  const w2 = date ? ctx.measureText(dText).width : 0;
  const pw = Math.max(w1, w2) + 56 * u;
  const top = (cap ? cy - capSize * .75 : dy - dateSize * .9), bottom = (date ? dy + dateSize * .85 : cy + capSize * .75);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.shadowColor = 'rgba(0,0,0,.15)'; ctx.shadowBlur = 10 * u;
  rr(ctx, (L.W - pw) / 2, top, pw, bottom - top, (bottom - top) / 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#4a3b52';
  if (cap) { ctx.font = `600 ${capSize}px ${FONT}`; ctx.fillText(cap, L.W / 2, cy); }
  if (date) { ctx.fillStyle = '#8b7a94'; ctx.font = `500 ${dateSize}px ${FONT}`; ctx.fillText(dText, L.W / 2, dy); }
}

function drawSticker(ctx, L, s) {
  ctx.save();
  ctx.translate(s.x * L.W, s.y * L.H); ctx.rotate(s.rot * Math.PI / 180);
  ctx.font = `${s.size * L.W}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s.ch, 0, 0);
  ctx.restore();
}

function render(ctx, L, opts = {}) {
  ctx.clearRect(0, 0, L.W, L.H);
  drawFrameBg(ctx, L);
  const ph = state.photos.length === TOTAL ? getFiltered() : [];
  L.slots.forEach((s, i) => drawCard(ctx, L, s, ph[i]));
  drawFooter(ctx, L);
  state.stickers.forEach(s => drawSticker(ctx, L, s));
  if (opts.selection) {
    const s = state.stickers.find(s => s.id === state.selected);
    if (s) {
      const r = s.size * L.W * .62;
      ctx.save(); ctx.translate(s.x * L.W, s.y * L.H);
      ctx.lineWidth = 3 * L.u; ctx.setLineDash([8 * L.u, 6 * L.u]);
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r + 2 * L.u, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ff6fae'; ctx.lineDashOffset = 7 * L.u; ctx.beginPath(); ctx.arc(0, 0, r + 2 * L.u, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
}

let raf = 0;
function queueDraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawStage); }
function drawStage() {
  const L = getLayout();
  if (stage.width !== L.W || stage.height !== L.H) { stage.width = L.W; stage.height = L.H; }
  render(sctx, L, { selection: true });
}

/* ------------------------------------------------------------------ */
/*  STIKER EMOJI                                                       */
/* ------------------------------------------------------------------ */
function addSticker(ch, x = .5, y = .5, size = .16, rot = 0, border = false) {
  const s = { id: state.nextId++, ch, x, y, size, rot, border };
  state.stickers.push(s); return s;
}
function selectSticker(id) { state.selected = id; syncStickerCtl(); queueDraw(); }
function syncStickerCtl() {
  const s = state.stickers.find(s => s.id === state.selected), box = $('#stickerCtl');
  box.classList.toggle('hidden', !s);
  if (s) { $('#stSize').value = s.size; $('#stRot').value = s.rot; }
}
function scatter(random) {
  state.stickers = state.stickers.filter(s => !s.border);
  const L = getLayout(), m = L.pad / 2, step = 160 * L.u, size = L.pad * 1.3 / L.W;
  const pts = [];
  for (let y = m; y <= L.H - m + 1; y += (L.H - 2 * m) / Math.round((L.H - 2 * m) / step)) { pts.push([m, y]); pts.push([L.W - m, y]); }
  for (let x = m + (L.W - 2 * m) / Math.round((L.W - 2 * m) / step); x < L.W - m - 1; x += (L.W - 2 * m) / Math.round((L.W - 2 * m) / step)) { pts.push([x, m]); pts.push([x, L.H - m]); }
  pts.forEach(([x, y], i) => {
    const ch = random ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] : state.activeEmoji;
    addSticker(ch, x / L.W, y / L.H, size, (i % 2 ? 1 : -1) * (8 + Math.random() * 18), true);
  });
  state.selected = null; syncStickerCtl(); queueDraw();
}

/* drag di canvas */
let drag = null;
function canvasPos(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * stage.width, y: (e.clientY - r.top) / r.height * stage.height };
}
function hitSticker(p) {
  const L = getLayout();
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i], dx = p.x - s.x * L.W, dy = p.y - s.y * L.H;
    if (Math.hypot(dx, dy) <= s.size * L.W * .6) return s;
  }
  return null;
}
stage.addEventListener('pointerdown', e => {
  const p = canvasPos(e), s = hitSticker(p);
  if (s) {
    const L = getLayout();
    state.stickers = state.stickers.filter(t => t !== s); state.stickers.push(s); // ke depan
    drag = { id: s.id, ox: p.x - s.x * L.W, oy: p.y - s.y * L.H };
    stage.setPointerCapture(e.pointerId); stage.style.cursor = 'grabbing';
    selectSticker(s.id);
  } else if (state.selected !== null) selectSticker(null);
});
stage.addEventListener('pointermove', e => {
  const p = canvasPos(e);
  if (!drag) { stage.style.cursor = hitSticker(p) ? 'grab' : 'default'; return; }
  const L = getLayout(), s = state.stickers.find(s => s.id === drag.id); if (!s) return;
  s.x = Math.min(1, Math.max(0, (p.x - drag.ox) / L.W));
  s.y = Math.min(1, Math.max(0, (p.y - drag.oy) / L.H));
  s.border = false; queueDraw();
});
const endDrag = () => { drag = null; stage.style.cursor = 'default'; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected !== null && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    state.stickers = state.stickers.filter(s => s.id !== state.selected); selectSticker(null);
  }
});

/* ------------------------------------------------------------------ */
/*  UI EDITOR                                                          */
/* ------------------------------------------------------------------ */
function buildFilterThumbs() {
  const grid = $('#filterGrid'); grid.innerHTML = '';
  FILTERS.forEach(f => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'opt' + (f.id === state.filter ? ' active' : ''); b.dataset.id = f.id;
    if (state.photos[0]) b.appendChild(applyFilter(state.photos[0], f.p, 120, 90));
    const sp = document.createElement('span'); sp.textContent = f.name; b.appendChild(sp);
    b.onclick = () => { state.filter = f.id; $$('#filterGrid .opt').forEach(o => o.classList.toggle('active', o === b)); queueDraw(); };
    grid.appendChild(b);
  });
}
function buildThemes() {
  const grid = $('#themeGrid'); grid.innerHTML = '';
  THEMES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'opt' + (t.id === state.theme ? ' active' : '');
    b.innerHTML = `<div class="ico">${t.ico}</div><span>${t.name}</span>`;
    b.onclick = () => { state.theme = t.id; $$('#themeGrid .opt').forEach(o => o.classList.toggle('active', o === b)); queueDraw(); };
    grid.appendChild(b);
  });
}
function buildSwatches() {
  const box = $('#swatches'); box.innerHTML = '';
  COLORS.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch' + (c === state.color ? ' active' : ''); b.style.background = c; b.title = c;
    b.onclick = () => setColor(c); box.appendChild(b);
  });
}
function setColor(c) {
  state.color = c; $('#customColor').value = c;
  $$('#swatches .swatch').forEach(s => s.classList.toggle('active', s.title === c)); queueDraw();
}
function buildEmojis() {
  const grid = $('#emojiGrid'); grid.innerHTML = '';
  EMOJIS.forEach(ch => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'emoji-btn' + (ch === state.activeEmoji ? ' active' : ''); b.textContent = ch;
    b.onclick = () => {
      state.activeEmoji = ch; $$('#emojiGrid .emoji-btn').forEach(o => o.classList.toggle('active', o === b));
      const a = (Math.random() - .5) * 30, s = addSticker(ch, .3 + Math.random() * .4, .25 + Math.random() * .5, .16, a);
      selectSticker(s.id);
    };
    grid.appendChild(b);
  });
}

$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.toggle('active', x === t));
  $$('.pane').forEach(p => p.classList.toggle('active', p.id === t.dataset.tab));
});
$$('[data-layout]').forEach(b => b.onclick = () => {
  state.layout = b.dataset.layout; $$('[data-layout]').forEach(x => x.classList.toggle('active', x === b)); queueDraw();
});
$('#customColor').addEventListener('input', e => setColor(e.target.value));
$('#btnScatter').onclick = () => scatter(false);
$('#btnScatterRandom').onclick = () => scatter(true);
$('#btnClearEmoji').onclick = () => { state.stickers = []; selectSticker(null); };
$('#btnDelSticker').onclick = () => { state.stickers = state.stickers.filter(s => s.id !== state.selected); selectSticker(null); };
$('#stSize').addEventListener('input', e => { const s = state.stickers.find(s => s.id === state.selected); if (s) { s.size = +e.target.value; s.border = false; queueDraw(); } });
$('#stRot').addEventListener('input', e => { const s = state.stickers.find(s => s.id === state.selected); if (s) { s.rot = +e.target.value; queueDraw(); } });
$('#captionInput').addEventListener('input', e => { state.caption = e.target.value; queueDraw(); });
$('#showDate').addEventListener('change', e => { state.showDate = e.target.checked; queueDraw(); });

/* ------------------------------------------------------------------ */
/*  UNDUH                                                              */
/* ------------------------------------------------------------------ */
function exportBlob(type = 'image/png') {
  const L = getLayout(), c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  render(c.getContext('2d'), L, { selection: false });
  return new Promise(res => c.toBlob(res, type, .95));
}
function showSaveModal(blobs) {
  const box = $('#saveImgs'); box.innerHTML = '';
  blobs.forEach(b => { const im = new Image(); im.src = URL.createObjectURL(b); box.appendChild(im); });
  $('#saveModal').classList.remove('hidden');
}
$('#btnCloseModal').onclick = () => $('#saveModal').classList.add('hidden');

// iOS: pakai lembar Bagikan (Simpan ke Foto); fallback: tahan lama gambar. Desktop/Android: unduh langsung.
async function deliver(blobs, names) {
  if (isIOS) {
    const files = blobs.map((b, i) => new File([b], names[i], { type: b.type }));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
    showSaveModal(blobs); return true;
  }
  for (let i = 0; i < blobs.length; i++) { saveBlob(blobs[i], names[i]); if (i < blobs.length - 1) await sleep(350); }
  return true;
}
$('#btnDownload').onclick = async () => {
  const blob = await exportBlob('image/png');
  if (!blob) { toast('Gagal membuat gambar'); return; }
  if (await deliver([blob], [`photobooth-${stamp()}.png`])) toast(isIOS ? 'Pilih "Simpan Gambar" 🎉' : 'Foto berhasil diunduh 🎉');
};
$('#btnDownloadSingles').onclick = async () => {
  const ph = getFiltered(), id = stamp();
  const blobs = await Promise.all(ph.map(c => new Promise(r => c.toBlob(r, 'image/jpeg', .95))));
  if (await deliver(blobs, blobs.map((_, i) => `photobooth-${id}-${i + 1}.jpg`))) toast('4 foto satuan siap 📸');
};

/* ------------------------------------------------------------------ */
/*  NAVIGASI LAYAR                                                     */
/* ------------------------------------------------------------------ */
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  $('#step1').classList.toggle('active', id === 'screenCam');
  $('#step2').classList.toggle('active', id === 'screenEdit');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goEdit() {
  stopCamera(); filterCache.clear(); state.selected = null;
  buildFilterThumbs(); syncStickerCtl(); showScreen('screenEdit'); queueDraw();
}
function goCam() {
  state.photos = []; filterCache.clear(); updateThumbs(); showScreen('screenCam'); initAudio(); startCamera();
}

/* tombol kamera */
btnStart.onclick = runSequence;
btnCancel.onclick = () => { state.cancel = true; };
$('#btnRetryCam').onclick = startCamera;
$('#btnMirror').onclick = () => { state.mirror = !state.mirror; applyMirror(); };
$('#btnSwitch').onclick = () => { state.facing = state.facing === 'user' ? 'environment' : 'user'; state.mirror = state.facing === 'user'; startCamera(); };
$('#btnRetake').onclick = goCam;
$('#fileInput').addEventListener('change', e => { fromFiles(e.target.files); e.target.value = ''; });

/* ------------------------------------------------------------------ */
/*  INIT                                                               */
/* ------------------------------------------------------------------ */
buildSwatches(); buildThemes(); buildEmojis(); updateThumbs();
if (document.fonts) { document.fonts.load('600 40px Fredoka').then(queueDraw).catch(() => {}); document.fonts.ready.then(queueDraw); }
if (inApp) $('#inappWarn').classList.remove('hidden');
$('#btnEnableCam').onclick = () => { initAudio(); startCamera(); };
(async function initCamera() {
  // Jika izin sudah pernah diberikan, kamera menyala otomatis. Jika belum (mis. iOS Safari), tampilkan tombol Aktifkan.
  let granted = false;
  try { const p = await navigator.permissions.query({ name: 'camera' }); granted = p.state === 'granted'; } catch (e) {}
  if (granted) startCamera();
  else { camStatus.textContent = ''; $('#camGate').classList.remove('hidden'); }
})();
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.running) stopCamera();
  else if (!document.hidden && state.camAllowed && $('#screenCam').classList.contains('active') && !state.stream && !state.running) startCamera();
});
})();
