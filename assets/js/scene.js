/* A film-studio lot at night — one WebGL scene behind the whole page.

   Intro: slate in. A clapperboard fills the frame and snaps shut; the camera
   swings to a projector as its reels spin up, the beam cuts through the dust,
   and the showreel flickers onto the studio screen. The camera then pulls
   back to the hero framing while the name prints onto the page. After that
   the lot stays alive behind the content: the projector hums, premiere
   searchlights sweep the sky, and the camera dollies to a different corner
   of the studio for every section. */

import * as THREE from 'three';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
/* the heavy toys — bloom, burn, drone cam — are for big screens with a GPU */
const FANCY = !TOUCH && !REDUCED && innerWidth >= 980;

const COL = {
  night: 0x07060a,
  amber: 0xf4b23c,
  red: 0xe84545,
  cream: 0xf2ede3,
  teal: 0x46c8b2,
  blue: 0x4d7cff,
};

const canvas = document.getElementById('webgl');
const holder = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COL.night, 0.0075);

const HERO_CAM = new THREE.Vector3(0, 4.5, 26);
const HERO_LOOK = new THREE.Vector3(7, 7, -40);

/* the projection axis sits right of centre so the hero text keeps the left */
const PROJ_POS = new THREE.Vector3(11, 3.5, 13);
const SCREEN_POS = new THREE.Vector3(14, 0, -40);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 700);
camera.position.copy(HERO_CAM);
camera.lookAt(HERO_LOOK);

/* ------------------------------------------------ post chain
   render → bloom (the lights finally burn) → colour grade (the Resolve
   wheels) → film burn (the big transition) → output. Desktop only. */
let composer = null, burnPass = null;
if (FANCY) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.3, 0.88));

  burnPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uB: { value: 0 },
      uSeed: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uB, uSeed;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec4 t = texture2D(tDiffuse, vUv);
        if (uB <= 0.0) { gl_FragColor = t; return; }
        float n = noise(vUv * 3.5 + uSeed) * 0.8 + noise(vUv * 11.0 + uSeed) * 0.2;
        float m = smoothstep(uB - 0.04, uB + 0.05, n);   // 1 intact, 0 consumed
        vec3 rim = vec3(1.0, 0.45, 0.1) * smoothstep(uB + 0.16, uB, n) * m * 2.4;
        gl_FragColor = vec4(t.rgb * m + rim, 1.0);
      }`,
  });
  composer.addPass(burnPass);
  composer.addPass(new OutputPass());
}

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------ glow sprite for points */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();

function lightField(positions, color, size, opacity = 0.95) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color, size, map: GLOW,
    transparent: true, opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

function sprite(color, scale) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW, color, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(scale);
  return s;
}

/* ------------------------------------------------ ground */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 900),
  new THREE.MeshBasicMaterial({ color: 0x0a0910 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

/* scattered floor marks — gaffer-tape crosses where the lot's lights stand */
{
  const p = [];
  for (let i = 0; i < 70; i++) {
    p.push((Math.random() - 0.5) * 260, 0.1, -Math.random() * 220 + 50);
  }
  scene.add(lightField(p, 0x2c2740, 1.8, 0.5));
}

/* city bokeh far behind the lot */
{
  const p = [];
  for (let i = 0; i < 320; i++) {
    p.push(
      (Math.random() - 0.5) * 620,
      12 + Math.random() * 130,
      -120 - Math.random() * 380
    );
  }
  scene.add(lightField(p, 0x8a7bb0, 1.6, 0.5));
}

/* ------------------------------------------------ the cinema screen
   A studio wall with a 16:9 screen. Before the intro's beam arrives it's
   dark; then the showreel itself plays on it (muted), or a painted title
   card if the video can't. */
const screenG = new THREE.Group();
let screenMat, screenVideo;
{
  // supporting wall
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(46, 26, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x14101c, roughness: 0.9 })
  );
  wall.position.set(0, 13, -0.7);
  screenG.add(wall);

  // painted title card — the screen's face until the video is rolling
  const card = document.createElement('canvas');
  card.width = 1024; card.height = 576;
  const g = card.getContext('2d');
  g.fillStyle = '#0d0a12';
  g.fillRect(0, 0, 1024, 576);
  g.strokeStyle = 'rgba(244,178,60,0.5)';
  g.lineWidth = 6;
  g.strokeRect(26, 26, 972, 524);
  g.fillStyle = '#f4b23c';
  g.font = '700 110px "Bebas Neue", sans-serif';
  g.textAlign = 'center';
  g.fillText('AWARA FILMS', 512, 300);
  g.fillStyle = 'rgba(242,237,227,0.75)';
  g.font = '32px "IBM Plex Mono", monospace';
  g.fillText('FROM SET TO SCREEN — ALL ME', 512, 372);
  const cardTex = new THREE.CanvasTexture(card);
  cardTex.colorSpace = THREE.SRGBColorSpace;

  screenMat = new THREE.MeshBasicMaterial({ map: cardTex, color: 0x000000 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(32, 18), screenMat);
  screen.position.set(0, 12, 0.05);
  screenG.add(screen);

  // screen frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x241d30, roughness: 0.6 });
  const mkBar = (w, h, x, y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMat);
    b.position.set(x, y, 0.1);
    screenG.add(b);
  };
  mkBar(33.6, 0.8, 0, 21.4);
  mkBar(33.6, 0.8, 0, 2.6);
  mkBar(0.8, 19.6, -16.4, 12);
  mkBar(0.8, 19.6, 16.4, 12);

  screenG.position.copy(SCREEN_POS);
  screenG.rotation.y = -0.06;
  scene.add(screenG);

  // the showreel — muted, looping; swapped onto the screen once it can play
  screenVideo = document.createElement('video');
  screenVideo.src = 'assets/video/showreel.mp4';
  screenVideo.muted = true;
  screenVideo.loop = true;
  screenVideo.playsInline = true;
  screenVideo.preload = 'auto';
  screenVideo.addEventListener('canplay', () => {
    const tex = new THREE.VideoTexture(screenVideo);
    tex.colorSpace = THREE.SRGBColorSpace;
    screenMat.map = tex;
    screenMat.needsUpdate = true;
  }, { once: true });
  screenVideo.play().catch(() => { /* title card stays — still reads as a cinema */ });
}

/* ------------------------------------------------ the projector
   Body, lens, two spoked reels up top, and the beam — a long faint cone from
   the lens to the screen with dust drifting through it. */
const projector = new THREE.Group();
const reels = [];
let beamMat, lensGlow, dustBeam, ribbonTex;
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1826, roughness: 0.55, metalness: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3a3050, roughness: 0.4, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 3.4), bodyMat);
  body.position.y = 0.8;
  projector.add(body);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 18), trimMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.9, -2.1);
  projector.add(lens);

  // spoked reels — film cans up top, always turning
  const mkReel = (z, r) => {
    const reel = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.09, 10, 40),
      trimMat
    );
    reel.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 12), trimMat);
    hub.rotation.x = Math.PI / 2;
    reel.add(hub);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, r * 2 - 0.1, 0.08), bodyMat);
      spoke.rotation.z = (i / 4) * Math.PI;
      reel.add(spoke);
    }
    // wound film — a dark disc behind the spokes
    const film = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.12, 28),
      new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.35 })
    );
    film.rotation.x = Math.PI / 2;
    reel.add(film);
    reel.position.set(0, 2.6 + r * 0.4, z);
    projector.add(reel);
    reels.push(reel);
  };
  mkReel(0.9, 1.05);
  mkReel(-0.6, 0.85);

  // the film itself — a celluloid ribbon threading front reel → gate → back
  // reel, its sprockets forever travelling
  {
    const rc = document.createElement('canvas');
    rc.width = 128; rc.height = 64;
    const rg2 = rc.getContext('2d');
    rg2.fillStyle = '#191521';
    rg2.fillRect(0, 0, 128, 64);
    rg2.fillStyle = 'rgba(242,237,227,0.5)';
    for (let x = 4; x < 128; x += 16) {
      rg2.fillRect(x, 5, 8, 6);
      rg2.fillRect(x, 53, 8, 6);
    }
    rg2.strokeStyle = 'rgba(242,237,227,0.14)';
    rg2.lineWidth = 2;
    for (let x = 0; x <= 128; x += 32) {
      rg2.beginPath(); rg2.moveTo(x, 14); rg2.lineTo(x, 50); rg2.stroke();
    }
    ribbonTex = new THREE.CanvasTexture(rc);
    ribbonTex.wrapS = ribbonTex.wrapT = THREE.RepeatWrapping;
    ribbonTex.repeat.set(10, 1);

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.0, 0.98),
      new THREE.Vector3(0, 3.0, 1.9),
      new THREE.Vector3(0, 1.2, 1.45),
      new THREE.Vector3(0, 0.68, -0.3),
      new THREE.Vector3(0, 1.9, -1.5),
      new THREE.Vector3(0, 3.72, -0.66),
    ]);
    const N = 72, W = 0.17;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = path.getPointAt(i / N);
      pos.push(p.x, p.y, p.z - W, p.x, p.y, p.z + W);
      uv.push(i / N * 10, 0, i / N * 10, 1);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rGeo.setIndex(idx);
    rGeo.computeVertexNormals();
    const ribbon = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
      map: ribbonTex, side: THREE.DoubleSide,
    }));
    projector.add(ribbon);
  }

  // stand
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), bodyMat);
  leg.position.y = -1.6;
  projector.add(leg);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.18, 16), bodyMat);
  base.position.y = -3.1;
  projector.add(base);

  // lens glow
  lensGlow = sprite(0xfff3d0, 2.2);
  lensGlow.position.set(0, 0.9, -2.7);
  lensGlow.material.opacity = 0;
  projector.add(lensGlow);

  projector.position.copy(PROJ_POS);
  projector.lookAt(SCREEN_POS.x, PROJ_POS.y, SCREEN_POS.z);
  scene.add(projector);

  // the beam — a group at the lens, aimed at the screen centre; the cone
  // (and the dust inside it) live in the group's local +z
  const lensWorld = new THREE.Vector3(0, 0.9, -2.6);
  projector.localToWorld(lensWorld);
  const screenCentre = new THREE.Vector3(SCREEN_POS.x, 12, SCREEN_POS.z);
  const dist = lensWorld.distanceTo(screenCentre);

  const beamG = new THREE.Group();
  beamG.position.copy(lensWorld);
  beamG.lookAt(screenCentre);

  const beamGeo = new THREE.ConeGeometry(9.2, dist, 24, 1, true);
  beamGeo.rotateX(-Math.PI / 2);                // axis onto z
  beamGeo.translate(0, 0, dist / 2);            // apex at the lens
  beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  beamG.add(new THREE.Mesh(beamGeo, beamMat));

  // dust caught in the beam
  const dp = [];
  for (let i = 0; i < 260; i++) {
    const k = Math.random();                    // 0 at lens → 1 at screen
    const r = 0.3 + k * 4.4;
    const a = Math.random() * Math.PI * 2;
    dp.push(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.6, k * dist);
  }
  dustBeam = lightField(dp, 0xffe9bb, 0.65, 0);
  beamG.add(dustBeam);
  scene.add(beamG);
}

/* ambient studio dust, everywhere and slow */
let dustAll;
{
  const p = [];
  for (let i = 0; i < 240; i++) {
    p.push((Math.random() - 0.5) * 160, Math.random() * 26, -Math.random() * 140 + 40);
  }
  dustAll = lightField(p, 0x9d8fbd, 0.55, 0.35);
  scene.add(dustAll);
}

/* ------------------------------------------------ the slate
   Chalk-marked clapperboard: star of the intro, and after the shoot it rests
   at the wrap mark next to the contact vantage. */
const slate = new THREE.Group();
let clapArm;
{
  const face = document.createElement('canvas');
  face.width = 512; face.height = 384;
  const g = face.getContext('2d');
  g.fillStyle = '#101014';
  g.fillRect(0, 0, 512, 384);
  g.strokeStyle = 'rgba(242,237,227,0.9)';
  g.lineWidth = 3;
  for (const y of [96, 190, 284]) { g.beginPath(); g.moveTo(24, y); g.lineTo(488, y); g.stroke(); }
  g.beginPath(); g.moveTo(256, 96); g.lineTo(256, 190); g.stroke();
  g.fillStyle = '#f2ede3';
  g.font = '600 44px "Caveat", cursive';
  g.textAlign = 'left';
  g.fillText('AWARA FILMS', 30, 66);
  g.font = '600 34px "Caveat", cursive';
  g.fillText('SCENE 01', 30, 152);
  g.fillText('TAKE 05', 280, 152);
  g.fillText('DIR : A. VASHISTH', 30, 248);
  g.fillText('CAM : A   ·   SOUND : SPEED', 30, 342);
  const faceTex = new THREE.CanvasTexture(face);
  faceTex.colorSpace = THREE.SRGBColorSpace;

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.4, 0.16),
    [
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 }),
    ]
  );
  slate.add(board);

  // diagonal-striped clap sticks; the top one hinges at its left end
  const stripes = document.createElement('canvas');
  stripes.width = 256; stripes.height = 32;
  const sg = stripes.getContext('2d');
  sg.fillStyle = '#f2ede3';
  sg.fillRect(0, 0, 256, 32);
  sg.fillStyle = '#101014';
  for (let x = -32; x < 256; x += 42) {
    sg.beginPath();
    sg.moveTo(x, 32); sg.lineTo(x + 21, 0); sg.lineTo(x + 42, 0); sg.lineTo(x + 21, 32);
    sg.fill();
  }
  const stripeTex = new THREE.CanvasTexture(stripes);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  const stickMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.75 });

  const stickLow = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.34, 0.18), stickMat);
  stickLow.position.set(0, 1.37, 0.02);
  slate.add(stickLow);

  clapArm = new THREE.Group();
  const stickTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.34, 0.18), stickMat);
  stickTop.position.x = 1.6;                    // hinge at the arm's left end
  clapArm.add(stickTop);
  clapArm.position.set(-1.6, 1.56, 0.04);
  clapArm.rotation.z = 0.42;                    // open, ready to mark
  slate.add(clapArm);

  slate.position.set(11, 3.7, 17.5);
  slate.rotation.y = 0.06;
  scene.add(slate);
}

/* ------------------------------------------------ director's corner
   Chair, tripod camera and a softbox — the About vantage. */
{
  const corner = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x241c28, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x8c2430, roughness: 0.85, side: THREE.DoubleSide });

  // chair: crossed legs, canvas seat and back
  const chair = new THREE.Group();
  const mkLeg = (rz, z) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), wood);
    l.rotation.z = rz;
    l.position.set(0, 1.45, z);
    chair.add(l);
  };
  mkLeg(0.5, 0.55); mkLeg(-0.5, 0.55); mkLeg(0.5, -0.55); mkLeg(-0.5, -0.55);
  const seat = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.25), cloth);
  seat.rotation.x = -Math.PI / 2;
  seat.position.y = 2.1;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.75), cloth);
  back.position.set(0, 3.25, -0.62);
  chair.add(back);
  // name on the back
  const nc = document.createElement('canvas');
  nc.width = 256; nc.height = 96;
  const ng = nc.getContext('2d');
  ng.fillStyle = '#8c2430'; ng.fillRect(0, 0, 256, 96);
  ng.fillStyle = '#f2ede3';
  ng.font = '600 34px "Caveat", cursive';
  ng.textAlign = 'center';
  ng.fillText('A. VASHISTH', 128, 60);
  const nameTex = new THREE.CanvasTexture(nc);
  nameTex.colorSpace = THREE.SRGBColorSpace;
  back.material = new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.85, side: THREE.DoubleSide });

  chair.position.set(0, 0, 0);
  corner.add(chair);

  // tripod camera aimed at the chair
  const tripod = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2c2438, roughness: 0.45, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.1, 8), metal);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.62, 1.5, Math.sin(a) * 0.62);
    leg.rotation.z = Math.cos(a) * 0.36;
    leg.rotation.x = -Math.sin(a) * 0.36;
    tripod.add(leg);
  }
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.5), metal);
  camBody.position.y = 3.3;
  tripod.add(camBody);
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 14), metal);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0, 3.3, 0.95);
  tripod.add(camLens);
  const tally = sprite(COL.red, 0.55);
  tally.position.set(0.3, 3.75, -0.5);
  tally.name = 'tally';
  tripod.add(tally);
  tripod.position.set(2.9, 0, 2.6);
  tripod.rotation.y = Math.PI + 0.72;
  corner.add(tripod);

  // softbox on a stand, warming the corner
  const soft = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 8), metal);
  pole.position.y = 2.2;
  soft.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.5), metal);
  box.position.y = 4.5;
  box.rotation.y = 0.7;
  soft.add(box);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe4b0 })
  );
  glow.position.set(0.22, 4.5, 0.18);
  glow.rotation.y = 0.7;
  soft.add(glow);
  const softGlow = sprite(0xffe4b0, 3.2);
  softGlow.position.set(0.3, 4.5, 0.3);
  soft.add(softGlow);
  soft.position.set(-2.6, 0, -1.4);
  corner.add(soft);

  const warmth = new THREE.PointLight(0xffd9a0, 26, 24, 1.9);
  warmth.position.set(-2.2, 4.5, 0);
  corner.add(warmth);

  corner.position.set(-24, 0, -6);
  corner.rotation.y = 0.35;
  scene.add(corner);
}

/* an anamorphic streak — the cheap lens-flare that sells cinema glass */
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 24;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(150,190,255,0)');
  grad.addColorStop(0.42, 'rgba(200,220,255,0.5)');
  grad.addColorStop(0.5, 'rgba(255,250,240,1)');
  grad.addColorStop(0.58, 'rgba(200,220,255,0.5)');
  grad.addColorStop(1, 'rgba(150,190,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 8, 256, 8);
  g.filter = 'blur(3px)';
  g.fillRect(0, 4, 256, 16);
  return new THREE.CanvasTexture(c);
}
const STREAK = streakTexture();
function streak(scaleX) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: STREAK, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.set(scaleX, scaleX * 0.09, 1);
  return s;
}

/* ------------------------------------------------ the neon banner
   AWARA FILMS in flickering neon on scaffold — the business vantage. */
let neonMat, neonLight, neonStreak;
{
  const g = new THREE.Group();

  const c = document.createElement('canvas');
  c.width = 1024; c.height = 320;
  const n = c.getContext('2d');
  n.fillStyle = 'rgba(8,6,12,0)';
  n.clearRect(0, 0, 1024, 320);
  n.font = '600 148px "Caveat", cursive';
  n.textAlign = 'center';
  n.shadowColor = '#f4b23c';
  n.shadowBlur = 34;
  n.strokeStyle = '#ffd98a';
  n.lineWidth = 5;
  n.strokeText('Awara Films', 512, 150);
  n.shadowBlur = 12;
  n.fillStyle = '#fff3d6';
  n.fillText('Awara Films', 512, 150);
  n.shadowColor = '#e84545';
  n.shadowBlur = 22;
  n.fillStyle = '#ff9d9d';
  n.font = '600 56px "Caveat", cursive';
  n.fillText('est. 2020 — from set to screen', 512, 250);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  neonMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.96,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.6), neonMat);
  sign.position.y = 9;
  g.add(sign);

  // scaffold
  const bar = new THREE.MeshStandardMaterial({ color: 0x231c30, roughness: 0.6, metalness: 0.4 });
  for (const x of [-8, 0, 8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 12.4, 8), bar);
    post.position.set(x, 6.2 - 3.2, 0.4);
    g.add(post);
  }
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 17, 8), bar);
  cross.rotation.z = Math.PI / 2;
  cross.position.set(0, 5.6, 0.4);
  g.add(cross);

  neonLight = new THREE.PointLight(COL.amber, 42, 40, 1.9);
  neonLight.position.set(0, 9, 2.5);
  g.add(neonLight);

  neonStreak = streak(10);
  neonStreak.position.set(0, 9, 0.6);
  g.add(neonStreak);

  g.position.set(26, 3.2, -16);
  g.rotation.y = -0.42;
  scene.add(g);
}

/* ------------------------------------------------ the film strip
   A ribbon of celluloid curving through the lot, each frame one of the
   posters from the reel — the Featured Work vantage. */
const filmStrip = new THREE.Group();
{
  const POSTERS = [
    'assets/img/work/kambli.jpg',
    'assets/img/work/siachen.jpg',
    'assets/img/work/birdhospital.jpg',
    'assets/img/work/moonvillage.jpg',
    'assets/img/work/sanjubaba.jpg',
    'assets/img/work/bingo.jpg',
  ];
  const loader = new THREE.TextureLoader();

  // celluloid border: dark frame + sprocket holes, poster inside
  const frameW = 6.4, frameH = 4.4;
  POSTERS.forEach((src, i) => {
    const holderG = new THREE.Group();

    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(frameW, frameH),
      new THREE.MeshBasicMaterial({ color: 0x0b0910, side: THREE.DoubleSide })
    );
    holderG.add(backing);

    const img = new THREE.Mesh(
      new THREE.PlaneGeometry(frameW - 0.7, frameH - 1.3),
      new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.DoubleSide })
    );
    img.position.z = 0.02;
    holderG.add(img);
    loader.load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      img.material.map = t;
      img.material.color.set(0xffffff);
      img.material.needsUpdate = true;
    });

    // sprocket holes top + bottom
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x2b2438, side: THREE.DoubleSide });
    for (let h = 0; h < 7; h++) {
      for (const y of [frameH / 2 - 0.33, -frameH / 2 + 0.33]) {
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), holeMat);
        hole.position.set(-frameW / 2 + 0.6 + h * (frameW - 1.2) / 6, y, 0.03);
        holderG.add(hole);
      }
    }

    // frames fan out along a gentle arc, alternating tilt
    const a = (i - (POSTERS.length - 1) / 2) * 0.26;
    holderG.position.set(Math.sin(a) * 26, 6.4 + (i % 2) * 1.5, -20 - Math.cos(a) * 6 + 6);
    holderG.rotation.y = -a * 0.9;
    holderG.userData.baseY = holderG.position.y;
    holderG.userData.baseZ = holderG.position.z;
    holderG.userData.phase = i * 1.3;
    holderG.userData.hl = 0;          // hover link from the work cards
    filmStrip.add(holderG);
  });
  scene.add(filmStrip);
}

/* ------------------------------------------------ reel rack
   Six film reels on a rack — one per stop on the call sheet. */
const rackReels = [];
{
  const rack = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2338, roughness: 0.5, metalness: 0.5 });
  const filmMat = new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.35 });

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 2.4), metal);
  shelf.position.y = 2.6;
  rack.add(shelf);
  for (const x of [-7.4, 7.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 2.2), metal);
    leg.position.set(x, 1.3, 0);
    rack.add(leg);
  }

  for (let i = 0; i < 6; i++) {
    const r = 1.15 + (i % 3) * 0.18;
    const reel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 10, 36), metal);
    reel.add(rim);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.09, r * 2 - 0.12, 0.07), metal);
      spoke.rotation.z = (s / 3) * Math.PI;
      reel.add(spoke);
    }
    const film = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.1, 24), filmMat);
    film.rotation.x = Math.PI / 2;
    reel.add(film);
    reel.position.set(-6.2 + i * 2.5, 2.6 + r + 0.15, 0);
    reel.userData.speed = 0.14 + (i % 3) * 0.07;
    rack.add(reel);
    rackReels.push(reel);
  }

  const lamp = new THREE.PointLight(COL.teal, 16, 22, 2.0);
  lamp.position.set(0, 6, 4);
  rack.add(lamp);

  rack.position.set(-30, 0, -28);
  rack.rotation.y = 0.5;
  scene.add(rack);
}

/* ------------------------------------------------ premiere searchlights
   Two beams sweeping the sky over the Legends vantage. */
const searchlights = [];
{
  for (const [x, z, phase] of [[18, -42, 0], [27, -38, 2.1]]) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 1.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x231c30, roughness: 0.6 })
    );
    base.position.y = 0.7;
    g.add(base);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 46, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xd8e6ff, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beam.geometry.translate(0, 23, 0);
    beam.position.y = 1.2;
    g.add(beam);
    const hot = sprite(0xffffff, 2.4);
    hot.position.y = 1.6;
    g.add(hot);
    const flare = streak(9);
    flare.position.y = 1.7;
    g.add(flare);
    g.position.set(x, 0, z);
    g.userData.phase = phase;
    g.userData.beam = beam;
    g.userData.flare = flare;
    scene.add(g);
    searchlights.push(g);
  }
}

/* ------------------------------------------------ the edit bay
   A floating NLE timeline: glowing clip blocks on three tracks and a
   playhead that never stops — the Skills vantage. */
const editBay = new THREE.Group();
let playhead;
{
  const mkClip = (x, y, w, color) => {
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.85, 0.3),
      new THREE.MeshStandardMaterial({
        color, roughness: 0.4,
        emissive: color, emissiveIntensity: 0.5,
      })
    );
    clip.position.set(x, y, 0);
    editBay.add(clip);
  };
  // V1 / V2 / A1 — ambers, teals, reds
  mkClip(-3.4, 2.2, 3.4, 0x8a5a18); mkClip(0.6, 2.2, 3.6, 0x8a5a18); mkClip(4.2, 2.2, 2.6, 0x8a5a18);
  mkClip(-2.6, 1.1, 2.8, 0x1e6e60); mkClip(1.4, 1.1, 3.4, 0x1e6e60);
  mkClip(-3.0, 0, 4.4, 0x7c2730); mkClip(2.2, 0, 4.0, 0x7c2730);

  // track base lines
  for (const y of [2.2, 1.1, 0]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(12.4, 0.03, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x3a3050 })
    );
    rail.position.set(0, y - 0.5, 0);
    editBay.add(rail);
  }

  playhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 3.9, 0.36),
    new THREE.MeshBasicMaterial({ color: COL.cream })
  );
  playhead.position.set(-5, 1.1, 0.02);
  editBay.add(playhead);
  const phGlow = sprite(COL.cream, 1.6);
  phGlow.position.set(0, 2.1, 0.1);
  playhead.add(phGlow);

  const lamp = new THREE.PointLight(0xb0a0ff, 14, 20, 2.0);
  lamp.position.set(0, 3, 4);
  editBay.add(lamp);

  editBay.position.set(-24, 3.4, 20);
  editBay.rotation.y = 0.55;
  scene.add(editBay);
}

/* ------------------------------------------------ gallery polaroids
   A handful of the stills floating like drying prints — Gallery vantage. */
const polaroids = new THREE.Group();
{
  const loader = new THREE.TextureLoader();
  ['p02', 'p03', 'p05', 'p06'].forEach((name, i) => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9, side: THREE.DoubleSide })
    );
    g.add(paper);
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.DoubleSide })
    );
    photo.position.set(0, 0.32, 0.02);
    g.add(photo);
    loader.load(`assets/img/gallery/${name}.jpg`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      photo.material.map = t;
      photo.material.color.set(0xffffff);
      photo.material.needsUpdate = true;
    });
    g.position.set(-3.9 + i * 2.7, 6 + (i % 2) * 1.6, (i % 2) * 1.4 - 0.7);
    g.rotation.y = -0.2 + i * 0.12;
    g.userData.phase = i * 1.9;
    g.userData.baseY = g.position.y;
    polaroids.add(g);
  });
  // a clothesline they hang from
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 13, 6),
    new THREE.MeshBasicMaterial({ color: 0x4a4060 })
  );
  line.rotation.z = Math.PI / 2;
  line.position.y = 9.3;
  polaroids.add(line);

  polaroids.position.set(44, 0, -10);
  polaroids.rotation.y = -0.6;
  scene.add(polaroids);
}

/* ------------------------------------------------ wrap mark
   A big painted "THAT'S A WRAP" slate leaning at the contact vantage. */
{
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  const w = c.getContext('2d');
  w.fillStyle = '#101014';
  w.fillRect(0, 0, 640, 400);
  w.strokeStyle = 'rgba(242,237,227,0.35)';
  w.lineWidth = 4;
  w.strokeRect(18, 18, 604, 364);
  w.fillStyle = '#f4b23c';
  w.font = '700 92px "Bebas Neue", sans-serif';
  w.textAlign = 'center';
  w.fillText("THAT'S A", 320, 165);
  w.fillText('WRAP', 320, 270);
  w.fillStyle = 'rgba(242,237,227,0.7)';
  w.font = '600 36px "Caveat", cursive';
  w.fillText('— now let\'s make yours —', 320, 344);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.8 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 4.6, 0.24),
    [sideMat, sideMat, sideMat, sideMat, boardMat, sideMat]
  );
  board.position.y = 2.9;
  board.rotation.x = -0.1;
  g.add(board);

  const lamp = new THREE.PointLight(COL.amber, 22, 26, 1.9);
  lamp.position.set(0, 5, 6);
  g.add(lamp);

  g.position.set(10, 0, 34);
  g.rotation.y = -0.15;
  scene.add(g);
}

/* ------------------------------------------------ the drone
   A little quad orbiting the lot, filming everything — its feed shows on
   the corner monitor (a second scissored view of the same scene). */
const drone = new THREE.Group();
const droneCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 700);
let dronePath, droneProps = [];
{
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.45, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), shell);
  drone.add(body);
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), shell);
    arm.position.set(x * 0.6, 0.08, z * 0.6);
    arm.rotation.y = Math.atan2(z, x);
    drone.add(arm);
    const prop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.015, 12),
      new THREE.MeshBasicMaterial({ color: 0x8a7bb0, transparent: true, opacity: 0.35 })
    );
    prop.position.set(x, 0.14, z);
    drone.add(prop);
    droneProps.push(prop);
  }
  const led = sprite(COL.red, 0.5);
  led.position.set(0, -0.1, 0.34);
  led.name = 'droneLed';
  drone.add(led);
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), shell);
  gimbal.position.set(0, -0.18, 0.18);
  drone.add(gimbal);
  scene.add(drone);

  dronePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(32, 13, 12),
    new THREE.Vector3(2, 17, -34),
    new THREE.Vector3(-34, 12, -10),
    new THREE.Vector3(-10, 10, 28),
  ], true, 'catmullrom', 0.7);
}

/* ------------------------------------------------ lights */
const amb = new THREE.AmbientLight(0x3a3252, 1.5);
scene.add(amb);
const key = new THREE.DirectionalLight(0x8f86b8, 1.1);
key.position.set(18, 60, 35);
scene.add(key);

/* golden hour waits behind a toggle — a low sun and everything it changes */
const sun = sprite(0xffb066, 30);
sun.position.set(-70, 11, -110);
sun.material.opacity = 0;
scene.add(sun);
const NIGHT = {
  fog: new THREE.Color(0x07060a), amb: new THREE.Color(0x3a3252), ambI: 1.5,
  key: new THREE.Color(0x8f86b8), keyI: 1.1, keyPos: new THREE.Vector3(18, 60, 35),
  ground: new THREE.Color(0x0a0910), fogD: 0.0075,
};
const GOLDEN = {
  fog: new THREE.Color(0x241410), amb: new THREE.Color(0x9a6a4a), ambI: 2.0,
  key: new THREE.Color(0xffa04e), keyI: 2.6, keyPos: new THREE.Vector3(-55, 16, -70),
  ground: new THREE.Color(0x181014), fogD: 0.0058,
};
let dayV = 0, dayTarget = 0;
const projLight = new THREE.PointLight(0xffe9bb, 0, 60, 1.6);   // ramps with the beam
projLight.position.set(11, 5.5, 9);
scene.add(projLight);

/* ================================================ intro: slate → screen
   Beats: the arm claps at T_CLAP (flash frame, shake), the slate drops away,
   the reels spin up and the beam fires at T_BEAM, then the camera pulls back
   from the projector to the hero framing while the name prints. */
const T_CLAP = 1.0;
const T_DROP = 1.35;
const T_BEAM = 1.9;
const T_PULL = 2.5;
const T_PRINT0 = 3.6;
const T_PRINT1 = 5.4;
const T_END = 6.2;

const HUD_LINES = [
  [0.0, 'SLATE IN · SCENE 01 · TAKE 05'],
  [T_CLAP, 'MARK! · CAMERA A ROLLING · SOUND SPEED'],
  [T_BEAM, 'PROJECTOR ON · AWARA FILMS PRESENTS'],
  [4.1, 'FROM SET TO SCREEN — ACTION!'],
];

let introOn = !REDUCED;
let introT = 0;
const introEl = document.getElementById('intro');
const introLine = document.getElementById('introLine');
const introTC = document.getElementById('introTC');
const introFlash = document.getElementById('introFlash');
const heroInner = document.querySelector('.hero__inner');

function setPrintMask(pct) {
  if (!heroInner) return;
  if (pct >= 115) {
    heroInner.style.maskImage = heroInner.style.webkitMaskImage = '';
    return;
  }
  const m = `linear-gradient(100deg, #000 ${pct - 9}%, transparent ${pct}%)`;
  heroInner.style.webkitMaskImage = m;
  heroInner.style.maskImage = m;
}

function endIntro() {
  if (!introOn) return;
  introOn = false;
  document.body.classList.add('ready');
  document.body.classList.remove('intro-lock');
  if (introEl) introEl.classList.add('intro--done');
  setPrintMask(120);
  // the shot is set: slate rests at the wrap mark, beam and screen stay lit
  slate.position.set(7.2, 1.25, 36.5);
  slate.rotation.set(0, 0.6, 0.06);
  slate.scale.setScalar(0.8);
  clapArm.rotation.z = 0.02;
  beamMat.opacity = 0.11;
  dustBeam.material.opacity = 0.7;
  lensGlow.material.opacity = 0.85;
  projLight.intensity = 30;
  screenMat.color.setRGB(1, 1, 1);
  camera.fov = 52;
  camera.updateProjectionMatrix();
}

if (introOn) {
  document.body.classList.add('intro-lock');
  setPrintMask(-10);
  const skip = () => endIntro();
  document.getElementById('introSkip')?.addEventListener('click', skip);
  addEventListener('wheel', skip, { once: true, passive: true });
  addEventListener('touchmove', skip, { once: true, passive: true });
  addEventListener('keydown', skip, { once: true });
} else {
  if (introEl) introEl.classList.add('intro--done');
  introOn = true;   // arm the guard so endIntro applies the finished state
  endIntro();
}

/* intro camera path: tight on the slate → swing past the projector →
   settle on the hero framing */
const INTRO_CAM = new THREE.CatmullRomCurve3([
  new THREE.Vector3(11.3, 3.9, 21.2),
  new THREE.Vector3(13.8, 4.1, 17.4),
  new THREE.Vector3(12.4, 4.7, 22),
  HERO_CAM.clone(),
], false, 'catmullrom', 0.45);

const _look = new THREE.Vector3();
const _pos = new THREE.Vector3();
const LOOK_SLATE = new THREE.Vector3(11, 3.7, 17.5);
const LOOK_PROJ = new THREE.Vector3(11, 4.3, 12.5);

function fmtTC(t) {
  const f = Math.floor(t * 24) % 24;
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `00:${pad(m)}:${pad(s)}:${pad(f)}`;
}

function introFrame(dt) {
  introT += dt;
  if (introT >= T_END) { endIntro(); return; }

  // clap: the arm snaps shut just before the mark
  if (introT < T_CLAP) {
    const k = clamp01((introT - (T_CLAP - 0.22)) / 0.22);
    clapArm.rotation.z = 0.42 * (1 - easeOutCubic(k));
  } else {
    clapArm.rotation.z = 0;
  }

  // flash frame on the mark
  if (introFlash) {
    const since = introT - T_CLAP;
    introFlash.style.opacity = (since > 0 && since < 0.22) ? String(0.85 * (1 - since / 0.22)) : '0';
  }

  // slate drops out of frame after the mark
  if (introT > T_DROP) {
    const k = easeInOutCubic(clamp01((introT - T_DROP) / 0.55));
    slate.position.y = 3.7 - k * 6.8;
    slate.rotation.x = -k * 0.9;
  }

  // reels spin up after the mark; beam + screen fire at T_BEAM
  const spin = clamp01((introT - T_CLAP) / 1.2);
  for (const r of reels) r.rotation.z += dt * spin * 7;

  if (introT > T_BEAM) {
    const b = clamp01((introT - T_BEAM) / 0.7);
    // projector light stutters before it settles — old carbon-arc habit
    const flick = b < 1 ? (Math.random() < 0.35 ? 0.4 : 1) : 1;
    beamMat.opacity = 0.16 * b * flick;
    dustBeam.material.opacity = 0.85 * b;
    lensGlow.material.opacity = b * flick;
    projLight.intensity = 34 * b * flick;
    const lum = (0.15 + 0.85 * b) * flick;
    screenMat.color.setRGB(lum, lum, lum);
  }

  // camera rides the intro curve
  let k;
  if (introT <= T_PULL) {
    k = 0.42 * easeInOutSine(introT / T_PULL);
  } else {
    k = 0.42 + 0.58 * easeInOutCubic(clamp01((introT - T_PULL) / (T_END - T_PULL)));
  }
  INTRO_CAM.getPointAt(clamp01(k), _pos);
  camera.position.copy(_pos);

  // look target: slate → projector → screen/hero
  if (introT < T_DROP) {
    _look.copy(LOOK_SLATE);
  } else if (introT < T_PULL) {
    _look.lerpVectors(LOOK_SLATE, LOOK_PROJ, easeInOutSine(clamp01((introT - T_DROP) / (T_PULL - T_DROP))));
  } else {
    _look.lerpVectors(LOOK_PROJ, HERO_LOOK, easeInOutCubic(clamp01((introT - T_PULL) / (T_END - T_PULL))));
  }
  camera.lookAt(_look);

  // clap shake
  if (introT > T_CLAP && introT < T_CLAP + 0.3) {
    const j = (1 - (introT - T_CLAP) / 0.3) * 0.16;
    camera.position.x += (Math.random() - 0.5) * j;
    camera.position.y += (Math.random() - 0.5) * j;
  }

  // a touch of wide-angle drama early on
  camera.fov = 52 + (1 - clamp01(introT / T_PULL)) * 6;
  camera.updateProjectionMatrix();

  // hero text prints while the camera settles
  if (introT > T_PRINT0) {
    if (!document.body.classList.contains('ready')) document.body.classList.add('ready');
    setPrintMask(-10 + 130 * clamp01((introT - T_PRINT0) / (T_PRINT1 - T_PRINT0)));
  }

  // running timecode
  if (introTC) introTC.textContent = fmtTC(introT);

  // HUD lines
  if (introLine) {
    for (let i = HUD_LINES.length - 1; i >= 0; i--) {
      if (introT >= HUD_LINES[i][0]) {
        if (introLine.textContent !== HUD_LINES[i][1]) introLine.textContent = HUD_LINES[i][1];
        break;
      }
    }
  }
}

/* ------------------------------------------------ interaction state */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
if (!TOUCH) {
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------ the look
   Grade slider (LOG ↔ GRADED) plus a rack-focus blur driven by scroll speed,
   both composed into one CSS filter on the WebGL canvas. */
let gradeV = 1;      // 1 = graded, 0 = flat log
let blurV = 0;
let lastFilter = '';
function applyLook() {
  const g = gradeV;
  let f = `saturate(${(0.36 + 0.64 * g).toFixed(3)}) contrast(${(0.84 + 0.16 * g).toFixed(3)}) brightness(${(1.13 - 0.13 * g).toFixed(3)})`;
  if (blurV > 0.04) f += ` blur(${blurV.toFixed(2)}px)`;
  if (f !== lastFilter) { lastFilter = f; canvas.style.filter = f; }
}

let stageIdx = -1;

/* ACTION! — both searchlights swing onto the screen for a few seconds */
let actionT = 0;
/* premiere criss-cross when the Legends wall scrolls in */
let sweepT = 0;
/* the wrap slate claps when someone reaches out */
let wrapClapT = 0;
/* department gel — service cards tint the banner light; the tint wheel
   moves the resting colour itself */
const gelDefault = new THREE.Color(COL.amber);
const gelTarget = new THREE.Color(COL.amber);

/* hooks for the DOM layer */
let hlIndex = -1;
let pipOn = FANCY;      // the drone monitor, on by default where it's cheap
window.__lot = {
  fancy: FANCY,
  setGrade(v) { gradeV = clamp01(v); applyLook(); },
  highlightFrame(i) { hlIndex = i; },
  action() { actionT = 5.2; },
  sweep() { if (actionT <= 0) sweepT = 2.8; },
  wrapClap() { wrapClapT = 0.62; },
  gel(hex) { gelTarget.set(hex || gelDefault); },
  theme(hex) { gelDefault.set(hex || COL.amber); gelTarget.copy(gelDefault); },
  setDay(on) { dayTarget = on ? 1 : 0; },
  drone(on) { pipOn = FANCY && on; },
};

/* film-burn state — fires on the big boundary between the client-facing
   half and the craft half of the page */
const BURN_DUR = 1.25;
let burnT = BURN_DUR;

/* draggable projector reel — grab it in the hero to scrub the showreel */
const reelDrag = { near: false, on: false, lastX: 0, vel: 0, px: 0, py: 0, vis: false };
const _proj = new THREE.Vector3();
if (!TOUCH && !REDUCED) {
  addEventListener('pointermove', (e) => {
    if (reelDrag.on) {
      const dx = e.clientX - reelDrag.lastX;
      reelDrag.lastX = e.clientX;
      reelDrag.vel = dx * 0.16;
      for (const r of reels) r.rotation.z -= dx * 0.012;
      if (screenVideo.duration) {
        let t = screenVideo.currentTime + dx * 0.03;
        const d = screenVideo.duration;
        screenVideo.currentTime = ((t % d) + d) % d;
      }
      return;
    }
    const near = reelDrag.vis &&
      Math.hypot(e.clientX - reelDrag.px, e.clientY - reelDrag.py) < 76 &&
      scrollY < innerHeight * 0.6;
    if (near !== reelDrag.near) {
      reelDrag.near = near;
      document.body.style.cursor = near ? 'grab' : '';
    }
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (!reelDrag.near) return;
    reelDrag.on = true;
    reelDrag.lastX = e.clientX;
    reelDrag.vel = 0;
    screenVideo.pause();
    document.body.style.cursor = 'grabbing';
  });
  addEventListener('pointerup', () => {
    if (!reelDrag.on) return;
    reelDrag.on = false;
    document.body.style.cursor = reelDrag.near ? 'grab' : '';
  });
}

/* scroll state: a different corner of the lot for every section */
const STAGE_DEFS = [
  ['home',       [0, 4.5, 26],    [0, 6.5, -40],   1.0],   // projector alley
  ['about',      [-13, 4.2, 8],   [-26, 3, -10],   0.5],   // director's corner
  ['awara',      [11, 5, 5],      [28, 9, -18],    0.5],   // the neon banner
  ['work',       [0, 6.2, 4],     [0, 7, -22],     0.45],  // the film strip
  ['experience', [-12, 5, -4],    [-32, 4, -30],   0.5],   // reel rack
  ['clients',    [5, 5.5, -8],    [24, 14, -42],   0.5],   // searchlights
  ['skills',     [-8, 5, 32],     [-26, 4.5, 18],  0.5],   // the edit bay
  ['graphics',   [4, 7, 16],      [10, 6, -30],    0.38],  // drift over the lot
  ['gallery',    [26, 5.5, 2],    [46, 7, -12],    0.5],   // the print line
  ['education',  [-4, 6, 20],     [-20, 4, -12],   0.42],  // slow pan home
  ['contact',    [4, 18, 55],     [10, 2, 34],     0.85],  // crane shot on the wrap
];
const stages = STAGE_DEFS.map(([id, cam, look, fade]) => ({
  el: document.getElementById(id),
  cam: new THREE.Vector3(...cam),
  look: new THREE.Vector3(...look),
  fade,
  y: 0,
})).filter((s) => s.el);

function layoutStages() {
  for (const s of stages) s.y = Math.max(0, s.el.offsetTop - innerHeight * 0.45);
}
layoutStages();
addEventListener('load', layoutStages);

let lastScrollY = scrollY;
let scrollVel = 0;

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
function stageCamera() {
  let i = 0;
  while (i < stages.length - 1 && scrollY >= stages[i + 1].y) i++;
  // crossing the big boundary between the two halves, the film catches fire
  if (i !== stageIdx) {
    if (stageIdx !== -1 && !REDUCED) {
      const bigCut = burnPass && (Math.min(i, stageIdx) === 5 && Math.max(i, stageIdx) === 6);
      if (bigCut && burnT >= BURN_DUR) {
        burnT = 0;
        burnPass.uniforms.uSeed.value = Math.random() * 40;
      }
      if (window.__sfx) window.__sfx.tick();
    }
    stageIdx = i;
  }
  const a = stages[i];
  const b = stages[Math.min(i + 1, stages.length - 1)];
  const span = Math.max(1, b.y - a.y);
  const f = a === b ? 0 : easeInOutSine(clamp01((scrollY - a.y) / span));
  _camPos.lerpVectors(a.cam, b.cam, f);
  _camLook.lerpVectors(a.look, b.look, f);
  // narrow screens put text right over the lot — keep the backdrop quieter
  const mob = innerWidth < 720 ? 0.72 : 1;
  holder.style.opacity = ((a.fade + (b.fade - a.fade) * f) * mob).toFixed(3);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  layoutStages();
});

/* ------------------------------------------------ loop */
const clock = new THREE.Clock();
const _sdir = new THREE.Vector3();
const _sup = new THREE.Vector3(0, 1, 0);
const _squat = new THREE.Quaternion();
const _seul = new THREE.Euler();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  // smoothed scroll velocity feeds the machinery
  const v = Math.abs(scrollY - lastScrollY);
  lastScrollY = scrollY;
  scrollVel += (Math.min(v, 60) - scrollVel) * 0.06;

  if (introOn) {
    introFrame(dt);
  } else {
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    stageCamera();
    camera.position.set(
      _camPos.x + mouse.x * 2.6 + Math.sin(t * 0.1) * 0.6,
      _camPos.y - mouse.y * 1.2,
      _camPos.z
    );
    camera.lookAt(_camLook.x + mouse.x * 5, _camLook.y - mouse.y * 2, _camLook.z);

    // the projector never stops — faster when the visitor scrolls fast,
    // still under the visitor's hand when they've grabbed the reel
    let reelRate;
    if (reelDrag.on) {
      reelRate = -reelDrag.vel * 14;
    } else if (Math.abs(reelDrag.vel) > 0.02) {
      reelRate = -reelDrag.vel * 14;
      for (const r of reels) r.rotation.z += dt * reelRate;
      reelDrag.vel *= 1 - Math.min(1, dt * 2.2);
      if (Math.abs(reelDrag.vel) <= 0.02 && screenVideo.paused) screenVideo.play().catch(() => {});
    } else {
      reelRate = 2.4 * (1 + scrollVel * 0.12);
      for (const r of reels) r.rotation.z += dt * reelRate;
    }
    // the celluloid rides whatever the reels do
    if (ribbonTex) ribbonTex.offset.x -= reelRate * dt * 0.09;

    // where the reel sits on screen, for the grab affordance
    reels[0].getWorldPosition(_proj).project(camera);
    reelDrag.vis = _proj.z < 1;
    reelDrag.px = (_proj.x * 0.5 + 0.5) * innerWidth;
    reelDrag.py = (-_proj.y * 0.5 + 0.5) * innerHeight;

    // beam breathes very slightly, like a live lamp
    beamMat.opacity = 0.11 + Math.sin(t * 1.7) * 0.012;
    lensGlow.material.opacity = 0.85 + Math.sin(t * 2.3) * 0.08;
  }

  // rack focus: fast scrolling softens the lot, then it pulls back to sharp
  if (!REDUCED) {
    blurV += (Math.min(scrollVel * 0.055, 2.6) - blurV) * 0.1;
  }
  applyLook();

  // camera tally blink
  const tally = scene.getObjectByName('tally');
  if (tally) tally.material.opacity = (t % 1.6) < 0.12 ? 1 : 0.15;

  // neon flicker — mostly steady, the odd stutter
  if (neonMat) {
    const n = Math.sin(t * 13.7) * Math.sin(t * 3.1);
    neonMat.opacity = n > 0.985 ? 0.38 : 0.8;
    neonLight.intensity = neonMat.opacity > 0.7 ? 26 : 12;
  }

  // film-strip frames breathe on their arc; a hovered work card pulls its
  // frame forward out of the strip
  filmStrip.children.forEach((f, i) => {
    f.userData.hl += ((i === hlIndex ? 1 : 0) - f.userData.hl) * Math.min(1, dt * 7);
    const hl = f.userData.hl;
    f.position.y = f.userData.baseY + Math.sin(t * 0.6 + f.userData.phase) * 0.35 * (1 - hl);
    f.position.z = f.userData.baseZ + hl * 3.2;
    f.scale.setScalar(1 + hl * 0.22);
  });

  // rack reels idle over the call sheet
  for (const r of rackReels) r.rotation.z += dt * r.userData.speed * (1 + scrollVel * 0.08);

  // searchlights: ACTION! > premiere criss-cross > idle sweep
  if (actionT > 0) actionT -= dt;
  if (sweepT > 0) sweepT -= dt;
  for (const s of searchlights) {
    let opTarget;
    if (actionT > 0) {
      _sdir.set(SCREEN_POS.x - s.position.x, 11, SCREEN_POS.z - s.position.z).normalize();
      _squat.setFromUnitVectors(_sup, _sdir);
      opTarget = 0.3;
    } else if (sweepT > 0) {
      // fast opposing criss-cross, like a premiere carpet
      const k = (2.8 - sweepT) * 3.4;
      _seul.set(
        Math.cos(k + s.userData.phase * 2) * 0.5,
        0,
        Math.sin(k) * (s.userData.phase > 1 ? -0.85 : 0.85)
      );
      _squat.setFromEuler(_seul);
      opTarget = 0.22;
    } else {
      _seul.set(Math.cos(t * 0.33 + s.userData.phase) * 0.35, 0, Math.sin(t * 0.4 + s.userData.phase) * 0.5);
      _squat.setFromEuler(_seul);
      opTarget = 0.085 + Math.sin(t * 0.9 + s.userData.phase) * 0.03;
    }
    s.quaternion.slerp(_squat, Math.min(1, dt * (actionT > 0 ? 4 : 3)));
    s.userData.beam.material.opacity += (opTarget - s.userData.beam.material.opacity) * Math.min(1, dt * 3);
    // flare rides the beam intensity
    s.userData.flare.material.opacity = s.userData.beam.material.opacity * 1.6;
  }

  // wrap slate claps when someone reaches out from the contact section
  if (wrapClapT > 0) {
    wrapClapT -= dt;
    const k = clamp01(1 - wrapClapT / 0.62);
    clapArm.rotation.z = 0.02 + (k < 0.55
      ? 0.5 * easeOutCubic(k / 0.55)
      : 0.5 * (1 - easeInOutCubic((k - 0.55) / 0.45)));
  }

  // department gel tints the banner light
  neonLight.color.lerp(gelTarget, Math.min(1, dt * 3.5));

  // neon flare breathes with the sign
  if (neonStreak) {
    neonStreak.material.opacity = (neonMat.opacity > 0.7 ? 0.14 : 0.05) + Math.sin(t * 1.3) * 0.03;
  }

  // playhead scrubs the edit bay, loops like a preview render
  if (playhead) playhead.position.x = -5.4 + ((t * 1.4) % 10.8);

  // polaroids sway on the line
  for (const p of polaroids.children) {
    if (p.userData.phase === undefined) continue;
    p.position.y = p.userData.baseY + Math.sin(t * 0.8 + p.userData.phase) * 0.16;
    p.rotation.z = Math.sin(t * 0.6 + p.userData.phase) * 0.05;
  }

  // dust drifts
  dustAll.rotation.y = t * 0.006;
  dustBeam.position.y = Math.sin(t * 0.5) * 0.12;

  // the drone flies its circuit, gimbal on the current scene
  {
    const k = (t * 0.014) % 1;
    drone.position.copy(dronePath.getPointAt(k));
    drone.position.y += Math.sin(t * 1.7) * 0.35;
    const ahead = dronePath.getPointAt((k + 0.02) % 1);
    drone.lookAt(ahead);
    for (const p of droneProps) p.rotation.y += dt * 46;
    const led = drone.getObjectByName('droneLed');
    led.material.opacity = (t % 1.3) < 0.1 ? 1 : 0.12;
    droneCam.position.copy(drone.position);
    droneCam.position.y -= 0.3;
    droneCam.lookAt(introOn ? HERO_LOOK : _camLook);
  }

  // golden hour drifts in and out
  dayV += (dayTarget - dayV) * Math.min(1, dt * 1.6);
  if (Math.abs(dayTarget - dayV) > 0.002 || dayV > 0.002) {
    scene.fog.color.lerpColors(NIGHT.fog, GOLDEN.fog, dayV);
    scene.fog.density = NIGHT.fogD + (GOLDEN.fogD - NIGHT.fogD) * dayV;
    amb.color.lerpColors(NIGHT.amb, GOLDEN.amb, dayV);
    amb.intensity = NIGHT.ambI + (GOLDEN.ambI - NIGHT.ambI) * dayV;
    key.color.lerpColors(NIGHT.key, GOLDEN.key, dayV);
    key.intensity = NIGHT.keyI + (GOLDEN.keyI - NIGHT.keyI) * dayV;
    key.position.lerpVectors(NIGHT.keyPos, GOLDEN.keyPos, dayV);
    ground.material.color.lerpColors(NIGHT.ground, GOLDEN.ground, dayV);
    sun.material.opacity = dayV * 0.9;
  }

  // film burn sweep
  if (burnPass) {
    if (burnT < BURN_DUR) {
      burnT += dt;
      burnPass.uniforms.uB.value = 1.15 * Math.sin(Math.PI * clamp01(burnT / BURN_DUR));
    } else if (burnPass.uniforms.uB.value !== 0) {
      burnPass.uniforms.uB.value = 0;
    }
  }

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  // the drone monitor — its own little renderer so the feed rides above
  // the page content inside the frame
  if (pipOn && !introOn) {
    if (!pipRenderer) {
      const holder2 = document.getElementById('dronecam');
      if (holder2) {
        pipRenderer = new THREE.WebGLRenderer({ antialias: false });
        pipRenderer.setPixelRatio(1);
        pipRenderer.setSize(300, 169);
        holder2.appendChild(pipRenderer.domElement);
      }
    }
    if (pipRenderer) pipRenderer.render(scene, droneCam);
  }
}
let pipRenderer = null;

/* pause only when the tab is hidden — the lot lives behind the whole page */
let running = false;
let raf = 0;
function loop() {
  tick();
  raf = requestAnimationFrame(loop);
}
function setRunning(on) {
  if (on === running) return;
  running = on;
  if (on) { clock.getDelta(); loop(); }
  else { cancelAnimationFrame(raf); }
}

if (REDUCED) {
  tick(); // single static frame
} else {
  setRunning(true);
  document.addEventListener('visibilitychange', () => setRunning(!document.hidden));
}
