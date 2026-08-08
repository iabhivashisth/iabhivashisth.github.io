/* Section widgets — tiny 2D-canvas set pieces (the priyanka pattern): each
   draws only while its section is on screen.

   tc       — a dialogue waveform with a running timecode, in About
   leader   — the 8-to-1 countdown film leader, spinning in Contact
   slate    — the sync-the-slate reflex game, also in Contact
   parallax — luminance-depth displacement over hovered work posters */

import * as THREE from 'three';

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

/* ------------------------------------------------ sync the slate
   Three beeps, the arm falls, click exactly on the mark. An editor's
   reflex test — best time kept on this machine. */
{
  const canvas = document.getElementById('slateGameCanvas');
  if (canvas) {
    const g = canvas.getContext('2d');
    const W = 300, H = 170;
    const HIT = 2.4;                       // the arm lands on beat four
    let state = 'idle';                    // idle | run | done
    let t0 = 0, result = null, raf = 0;
    let best = +(localStorage.getItem('slateBest') || 0) || null;
    let confetti = [];
    let lastBeep = -1;

    function drawSlate(armAngle) {
      g.clearRect(0, 0, W, H);
      // board
      g.fillStyle = '#14121a';
      g.strokeStyle = 'rgba(242,237,227,0.4)';
      g.lineWidth = 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(70, 62, 160, 74, 6); else g.rect(70, 62, 160, 74);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(242,237,227,0.35)';
      g.beginPath(); g.moveTo(80, 92); g.lineTo(220, 92); g.stroke();
      g.beginPath(); g.moveTo(80, 114); g.lineTo(220, 114); g.stroke();
      g.fillStyle = '#f2ede3';
      g.font = '600 13px "Caveat", cursive';
      g.textAlign = 'left';
      g.fillText('AWARA FILMS', 82, 84);
      g.fillText('TAKE: YOURS', 82, 108);
      // fixed lower stick
      const stripes = (x, y, w2, h2, a) => {
        g.save();
        g.translate(x, y); g.rotate(a);
        g.fillStyle = '#f2ede3';
        g.fillRect(0, -h2, w2, h2);
        g.fillStyle = '#14121a';
        for (let i = 6; i < w2; i += 26) {
          g.beginPath();
          g.moveTo(i, 0); g.lineTo(i + 9, -h2); g.lineTo(i + 18, -h2); g.lineTo(i + 9, 0);
          g.fill();
        }
        g.restore();
      };
      stripes(70, 62, 160, 11, 0);
      // the falling arm, hinged at the left
      stripes(70, 51, 160, 11, -armAngle);
    }

    function draw() {
      const t = state === 'run' ? (performance.now() - t0) / 1000 : 0;
      const arm = state === 'run'
        ? 0.62 * Math.max(0, 1 - t / HIT)
        : state === 'idle' ? 0.62 : 0;
      drawSlate(arm);

      g.font = '600 11px "IBM Plex Mono", monospace';
      g.textAlign = 'center';
      if (state === 'idle') {
        g.fillStyle = '#f4b23c';
        g.fillText('CLICK TO ROLL', W / 2, 26);
        if (best) { g.fillStyle = 'rgba(242,237,227,0.55)'; g.fillText('BEST SYNC ' + best + 'ms', W / 2, 42); }
      } else if (state === 'run') {
        // count-in pips
        const beat = Math.floor(t / 0.6);
        g.fillStyle = '#e84545';
        g.fillText(beat < 3 ? String(3 - beat) : '●', W / 2, 30);
        if (beat !== lastBeep && beat <= 3) {
          lastBeep = beat;
          if (window.__sfx) window.__sfx.tick();
        }
        if (t > HIT + 0.6) { state = 'idle'; result = null; }   // let it pass — missed
      } else if (state === 'done' && result) {
        g.fillStyle = result.verdict === 'PERFECT SYNC' ? '#7cd65a' : result.verdict === 'GOOD TAKE' ? '#f4b23c' : '#e84545';
        g.fillText(result.verdict + ' · ' + result.ms + 'ms', W / 2, 26);
        g.fillStyle = 'rgba(242,237,227,0.55)';
        g.fillText('CLICK FOR ANOTHER TAKE', W / 2, 42);
      }

      // film-strip confetti
      confetti = confetti.filter((c) => c.life > 0);
      for (const c of confetti) {
        c.x += c.vx; c.y += c.vy; c.vy += 0.12; c.rot += c.vr; c.life -= 0.016;
        g.save();
        g.translate(c.x, c.y); g.rotate(c.rot);
        g.globalAlpha = Math.min(1, c.life);
        g.fillStyle = '#191521';
        g.fillRect(-7, -4, 14, 8);
        g.fillStyle = '#f4b23c';
        g.fillRect(-6, -3, 2.5, 2); g.fillRect(-1, -3, 2.5, 2); g.fillRect(4, -3, 2.5, 2);
        g.restore();
      }
      g.globalAlpha = 1;

      if (state === 'run' || confetti.length) raf = requestAnimationFrame(draw);
    }

    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', () => {
      if (state === 'run') {
        const diff = Math.round(Math.abs((performance.now() - t0) / 1000 - HIT) * 1000);
        const verdict = diff < 55 ? 'PERFECT SYNC' : diff < 150 ? 'GOOD TAKE' : 'CUT! AGAIN';
        result = { ms: diff, verdict };
        state = 'done';
        if (window.__sfx) window.__sfx.clap();
        if (verdict === 'PERFECT SYNC') {
          if (!best || diff < best) { best = diff; localStorage.setItem('slateBest', String(diff)); }
          for (let i = 0; i < 42; i++) {
            confetti.push({
              x: W / 2, y: 70,
              vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 4,
              rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
              life: 1.4 + Math.random() * 0.5,
            });
          }
        }
        drawSlate(0);
        raf = requestAnimationFrame(draw);
      } else {
        state = 'run';
        lastBeep = -1;
        t0 = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    });
    drawSlate(0.62);
    draw();
  }
}

/* ------------------------------------------------ depth-parallax posters
   One shared WebGL quad that rides whichever work card is hovered —
   luminance stands in for depth, the pointer shifts the frame in fake 3D. */
if (matchMedia('(hover: hover)').matches && !REDUCED) {
  const cards = document.querySelectorAll('.workcard__open');
  if (cards.length) {
    const prenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    prenderer.setPixelRatio(1);
    const pcanvas = prenderer.domElement;
    pcanvas.className = 'parallaxfx';
    const pscene = new THREE.Scene();
    const pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      map: { value: null },
      uM: { value: new THREE.Vector2(0, 0) },
      uScale: { value: new THREE.Vector2(1, 1) },
      uShift: { value: new THREE.Vector2(0, 0) },
    };
    pscene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
          uniform sampler2D map;
          uniform vec2 uM, uScale, uShift;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv * uScale + uShift;
            float d = dot(texture2D(map, uv).rgb, vec3(0.299, 0.587, 0.114));
            vec2 off = uM * (d - 0.45) * 0.05;
            gl_FragColor = texture2D(map, uv + off);
          }`,
      })
    ));
    const loader = new THREE.TextureLoader();
    const cache = {};
    let live = false, raf = 0;
    const mTarget = new THREE.Vector2();

    function frame() {
      uniforms.uM.value.lerp(mTarget, 0.12);
      prenderer.render(pscene, pcam);
      if (live) raf = requestAnimationFrame(frame);
    }

    cards.forEach((card) => {
      const img = card.querySelector('img');
      if (!img) return;
      card.addEventListener('pointerenter', () => {
        const src = img.currentSrc || img.src;
        const tex = cache[src] || (cache[src] = loader.load(src, (t2) => {
          t2.colorSpace = THREE.SRGBColorSpace;
          fit();
        }));
        uniforms.map.value = tex;
        const fit = () => {
          // cover-fit the texture into the card's box
          if (!tex.image) return;
          const ba = card.clientWidth / card.clientHeight;
          const ta = tex.image.width / tex.image.height;
          if (ta > ba) uniforms.uScale.value.set(ba / ta, 1);
          else uniforms.uScale.value.set(1, ta / ba);
          uniforms.uShift.value.set((1 - uniforms.uScale.value.x) / 2, (1 - uniforms.uScale.value.y) / 2);
        };
        fit();
        prenderer.setSize(card.clientWidth, card.clientHeight, false);
        card.appendChild(pcanvas);
        pcanvas.classList.add('on');
        live = true;
        cancelAnimationFrame(raf);
        frame();
      });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        mTarget.set(
          ((e.clientX - r.left) / r.width - 0.5) * 2,
          -((e.clientY - r.top) / r.height - 0.5) * 2
        );
      });
      card.addEventListener('pointerleave', () => {
        live = false;
        cancelAnimationFrame(raf);
        pcanvas.classList.remove('on');
        mTarget.set(0, 0);
        if (pcanvas.parentNode) pcanvas.parentNode.removeChild(pcanvas);
      });
    });
  }
}
