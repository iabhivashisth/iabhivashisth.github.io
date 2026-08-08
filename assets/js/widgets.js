/* Section widgets — tiny 2D-canvas set pieces (the priyanka pattern): each
   draws only while its section is on screen.

   tc     — a dialogue waveform with a running timecode, in About
   leader — the 8-to-1 countdown film leader, spinning in Contact */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const AMBER = '#f4b23c';
const CREAM = '#f2ede3';
const RED = '#e84545';
const TEAL = '#46c8b2';

/* one lazy widget = canvas + draw(g, t, w, h), alive only on screen */
function widget(canvas, draw) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  let raf = 0;
  let live = false;
  const t0 = performance.now();

  function size() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame() {
    const t = (performance.now() - t0) / 1000;
    draw(g, t, canvas.clientWidth, canvas.clientHeight);
    if (live && !REDUCED) raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting && !live) {
        live = true;
        size();
        frame();
      } else if (!en.isIntersecting && live) {
        live = false;
        cancelAnimationFrame(raf);
      }
    }
  }, { rootMargin: '80px' }).observe(canvas);

  addEventListener('resize', () => { if (live) size(); });
}

/* ------------------------------------------------ tc: waveform + timecode */
widget(document.getElementById('tcCanvas'), (g, t, w, h) => {
  g.clearRect(0, 0, w, h);

  const mid = h * 0.52;
  const speech = (x) => {
    // clumps of dialogue with gaps — reads as a real voice track
    const phrase = Math.sin(x * 0.018 + t * 1.4);
    const gate = phrase > -0.25 ? 1 : 0.12;
    return gate * (
      Math.sin(x * 0.16 + t * 9) * 0.45 +
      Math.sin(x * 0.31 + t * 13.7) * 0.3 +
      Math.sin(x * 0.53 + t * 6.1) * 0.25
    );
  };

  // waveform bars
  const step = 4;
  for (let x = 0; x < w; x += step) {
    const played = x / w < ((t * 0.11) % 1);
    const amp = Math.abs(speech(x)) * (h * 0.36) + 1.5;
    g.fillStyle = played ? AMBER : 'rgba(242,237,227,0.28)';
    g.fillRect(x, mid - amp, step - 1.2, amp * 2);
  }

  // playhead
  const px = ((t * 0.11) % 1) * w;
  g.fillStyle = CREAM;
  g.fillRect(px, 4, 1.5, h - 8);

  // running timecode chip
  const f = Math.floor(t * 24) % 24;
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  g.font = '600 11px "IBM Plex Mono", monospace';
  const label = `TC 00:${pad(m)}:${pad(s)}:${pad(f)}`;
  const tw = g.measureText(label).width + 12;
  g.fillStyle = 'rgba(7,6,10,0.85)';
  g.fillRect(Math.min(px + 6, w - tw - 4), 6, tw, 18);
  g.fillStyle = RED;
  g.fillText('●', Math.min(px + 12, w - tw + 2), 19);
  g.fillStyle = CREAM;
  g.fillText(label.slice(0), Math.min(px + 22, w - tw + 12), 19);
});

/* ------------------------------------------------ leader: countdown reel */
widget(document.getElementById('leaderCanvas'), (g, t, w, h) => {
  g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.42;

  // academy-leader field
  g.fillStyle = 'rgba(242,237,227,0.06)';
  g.fillRect(0, 0, w, h);

  // cross hairs
  g.strokeStyle = 'rgba(242,237,227,0.35)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, cy); g.lineTo(w, cy);
  g.moveTo(cx, 0); g.lineTo(cx, h);
  g.stroke();

  // rings
  for (const r of [R, R * 0.82]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }

  // rotating wipe
  const a = (t * 1.05) % (Math.PI * 2);
  g.fillStyle = 'rgba(244,178,60,0.30)';
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, R * 0.82, -Math.PI / 2, -Math.PI / 2 + a);
  g.closePath();
  g.fill();
  g.strokeStyle = AMBER;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(-Math.PI / 2 + a) * R * 0.82, cy + Math.sin(-Math.PI / 2 + a) * R * 0.82);
  g.stroke();

  // the counting number, 8 → 1
  const n = 8 - Math.floor(t * 1.05 / (Math.PI * 2) % 8);
  g.fillStyle = CREAM;
  g.font = `700 ${Math.round(R * 1.05)}px "Bebas Neue", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), cx, cy + R * 0.06);

  // corner marks
  g.fillStyle = TEAL;
  g.font = '600 10px "IBM Plex Mono", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText('PICTURE START', 8, 14);
  g.textAlign = 'right';
  g.fillText('AWARA FILMS', w - 8, h - 8);
});
