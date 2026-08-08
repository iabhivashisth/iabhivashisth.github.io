/* Interaction layer: nav state, IST clock, scroll reveals, stat counters,
   the work filter, and the video lightbox. No dependencies. */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------- nav */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');

  function navState() {
    nav.classList.toggle('scrolled', scrollY > 30);
  }
  addEventListener('scroll', navState, { passive: true });
  navState();

  burger.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      links.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  // active section highlight
  var sections = document.querySelectorAll('section[id]');
  var navAnchors = links.querySelectorAll('a[href^="#"]');
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      navAnchors.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id);
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(function (s) { spy.observe(s); });

  /* ---------------------------------------------- IST clock */
  var clockEl = document.getElementById('clock');
  if (clockEl) {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    var tickClock = function () { clockEl.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------------------------------------------- cursor spotlight */
  var spot = document.getElementById('spotlight');
  if (spot && matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', function (e) {
      spot.style.setProperty('--sx', e.clientX + 'px');
      spot.style.setProperty('--sy', e.clientY + 'px');
    }, { passive: true });
  }

  /* ---------------------------------------------- split section titles */
  document.querySelectorAll('.sec__title').forEach(function (title) {
    var text = title.textContent;
    title.textContent = '';
    title.setAttribute('aria-label', text);
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--c', i);
      s.textContent = text[i] === ' ' ? ' ' : text[i];
      title.appendChild(s);
    }
  });

  /* ---------------------------------------------- pointer tilt */
  if (!REDUCED && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.stat, .service, .panel, .workcard, .legend, .laurel').forEach(function (card) {
      card.setAttribute('data-tilt', '');
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        card.style.transform = 'perspective(700px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------- reveals */
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealer.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

  /* ---------------------------------------------- stat counters */
  function countUp(el) {
    var target = +el.dataset.count;
    var suffix = el.dataset.suffix || '';
    if (REDUCED) { el.textContent = target + suffix; return; }
    var t0 = null;
    var dur = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counter = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        countUp(en.target);
        counter.unobserve(en.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { counter.observe(el); });

  /* ---------------------------------------------- concept-chip icons */
  var STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
    wave: '<path d="M2 12h2l2-7 3 14 3-10 2 5 2-3 2 1h4"/>',
    palette: '<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 22a10 10 0 0 1 0-20"/>',
    motion: '<polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="5" x2="23" y2="5"/><line x1="19" y1="12" x2="23" y2="12"/><line x1="19" y1="19" x2="23" y2="19"/>',
    captions: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 13h4M6 16h8M14 13h4"/>',
    clap: '<path d="M20.2 6 3 11l-.9-2.4a2 2 0 0 1 1.3-2.5l13.5-4a2 2 0 0 1 2.5 1.4z"/><path d="M6.2 5.3l3.1 3.9M10.6 4l3.1 3.9M15 2.7l3.1 3.9"/><rect x="3" y="11" width="18" height="10" rx="1.5"/>',
    cam: '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>',
    sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    thumb: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M22 15l-5-5L6 21"/>',
    poster: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    brand: '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>',
    canva: '<circle cx="12" cy="12" r="10"/><path d="M8 14c1 2 4 2.5 6 1M9 9.5a2 2 0 1 1 4 .5c0 2-3 2-3 4"/>',
    ads: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    meta: '<path d="M2 12c0-3.5 2-6 4.5-6S11 9 12 12c1-3 3-6 5.5-6S22 8.5 22 12s-2 6-4.5 6S13 15 12 12c-1 3-3 6-5.5 6S2 15.5 2 12z"/>',
    lead: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    yt: '<rect x="2" y="5" width="20" height="14" rx="4"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/>',
  };
  document.querySelectorAll('[data-icon]').forEach(function (el) {
    var body = ICONS[el.getAttribute('data-icon')];
    if (!body) return;
    var span = document.createElement('span');
    span.className = 'chip-icon';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" ' + STROKE + '>' + body + '</svg>';
    el.insertBefore(span, el.firstChild);
  });

  /* ---------------------------------------------- filmstrip scroll bar */
  var scrollCursor = document.getElementById('scrollCursor');
  if (scrollCursor) {
    var barTick = function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      var p = max > 0 ? scrollY / max : 0;
      scrollCursor.style.top = (p * 100).toFixed(2) + '%';
    };
    addEventListener('scroll', barTick, { passive: true });
    barTick();
  }

  /* ---------------------------------------------- camera down the call sheet */
  var route = document.getElementById('route');
  var routeCam = document.getElementById('routeCam');
  if (route && routeCam) {
    var routeYear = document.getElementById('routeYear');
    var nodes = route.querySelectorAll('.leg__node');
    var routeTick = function () {
      var r = route.getBoundingClientRect();
      var focus = innerHeight * 0.45;
      var p = Math.min(1, Math.max(0, (focus - r.top) / r.height));
      routeCam.style.top = (p * 100).toFixed(2) + '%';
      // the call sheet runs newest → oldest, 2025 at the top, 2020 at the wrap
      if (routeYear) routeYear.textContent = String(Math.round(2025.4 - p * 5.4));
      nodes.forEach(function (n) {
        n.classList.toggle('passed', n.getBoundingClientRect().top < focus);
      });
    };
    addEventListener('scroll', routeTick, { passive: true });
    routeTick();
  }

  /* ---------------------------------------------- edit-bay render pass
     The playhead runs the timeline on a loop and "renders in" each clip as
     it passes; grab it (or scrub anywhere on the panel) to drive it. */
  var nle = document.querySelector('.nle');
  var nlePlayhead = document.getElementById('nlePlayhead');
  var nleDone = document.getElementById('nleDone');
  if (nle && nlePlayhead && !REDUCED) {
    var nleClips = Array.prototype.map.call(document.querySelectorAll('.nle__clip'), function (c) {
      return { el: c, x: parseFloat(c.style.getPropertyValue('--x')) || 0 };
    });
    var nleP = 0;          // 0..100 along the timeline
    var nleDrag = false;
    var nleLive = false;
    var doneShown = false;
    var nleLast = performance.now();

    var nleFrame = function (now) {
      var dt = Math.min((now - nleLast) / 1000, 0.05);
      nleLast = now;
      if (!nleDrag) nleP += dt * (100 / 9);          // full pass ≈ 9s
      if (nleP >= 100) {
        if (!doneShown) {
          doneShown = true;
          nleDone.classList.add('show');
          if (window.__sfx) window.__sfx.tick();
          setTimeout(function () { nleDone.classList.remove('show'); }, 1800);
        }
        if (nleP >= 100 + 22) { nleP = 0; doneShown = false; }  // hold, then loop
        else nleP += dt * (100 / 9);
      }
      var shown = Math.min(nleP, 100);
      nlePlayhead.style.left = 'calc(46px + (100% - 64px) * ' + (shown / 100).toFixed(4) + ')';
      nleClips.forEach(function (c) { c.el.classList.toggle('lit', c.x <= shown); });
      if (nleLive) requestAnimationFrame(nleFrame);
    };

    var nleScrub = function (e) {
      var r = nle.getBoundingClientRect();
      nleP = Math.min(100, Math.max(0, ((e.clientX - r.left - 46) / (r.width - 64)) * 100));
      doneShown = nleP >= 100;
    };
    nle.addEventListener('pointerdown', function (e) {
      nleDrag = true;
      try { nle.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      nleScrub(e);
    });
    nle.addEventListener('pointermove', function (e) { if (nleDrag) nleScrub(e); });
    nle.addEventListener('pointerup', function () { nleDrag = false; });

    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !nleLive) {
          nleLive = true;
          nleLast = performance.now();
          requestAnimationFrame(nleFrame);
        } else if (!en.isIntersecting) {
          nleLive = false;
        }
      });
    }, { rootMargin: '60px' }).observe(nle);
  } else if (nle) {
    // reduced motion: everything rendered, no moving playhead
    document.querySelectorAll('.nle__clip').forEach(function (c) { c.classList.add('lit'); });
  }

  /* ---------------------------------------------- work filter */
  var tabs = document.querySelectorAll('.worktab');
  var cards = document.querySelectorAll('.workcard');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var f = tab.dataset.filter;
      tabs.forEach(function (t) {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      cards.forEach(function (c) {
        var show = f === 'all' || c.dataset.cat === f;
        c.classList.toggle('workcard--hide', !show);
      });
    });
  });

  /* ---------------------------------------------- video lightbox
     Cards with data-yt open an embedded player; data-href opens the channel
     in a new tab. The showreel button plays the local reel. */
  var lightbox = document.getElementById('lightbox');
  var lightboxFrame = document.getElementById('lightboxFrame');
  var lightboxClose = document.getElementById('lightboxClose');
  var lastFocus = null;

  function openLightbox(html) {
    lastFocus = document.activeElement;
    lightboxFrame.innerHTML = html;
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    lightboxClose.focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxFrame.innerHTML = '';
    document.body.classList.remove('lightbox-open');
    if (lastFocus) lastFocus.focus();
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  document.querySelectorAll('.workcard__open').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var yt = btn.dataset.yt;
      var href = btn.dataset.href;
      if (yt && /^[\w-]{6,16}$/.test(yt)) {
        openLightbox('<iframe src="https://www.youtube-nocookie.com/embed/' + yt +
          '?autoplay=1&rel=0" title="Video player" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>');
      } else if (href) {
        window.open(href, '_blank', 'noopener');
      }
    });
  });

  var showreelBtn = document.getElementById('showreelBtn');
  if (showreelBtn) {
    showreelBtn.addEventListener('click', function () {
      openLightbox('<video src="assets/video/showreel.mp4" controls autoplay playsinline></video>');
    });
  }

  /* ---------------------------------------------- camera HUD
     Running production timecode plus the LOG ↔ GRADED slider that regrades
     the whole 3D lot (scene.js exposes window.__lot). */
  var camTC = document.getElementById('camTC');
  if (camTC && !REDUCED) {
    var tcStart = performance.now();
    setInterval(function () {
      if (document.hidden) return;
      var s = (performance.now() - tcStart) / 1000;
      var pad = function (n) { return String(n).padStart(2, '0'); };
      camTC.textContent = '00:' + pad(Math.floor(s / 60) % 60) + ':' + pad(Math.floor(s) % 60) + ':' + pad(Math.floor(s * 24) % 24);
    }, 42);
  }

  var gradeRange = document.getElementById('gradeRange');
  if (gradeRange) {
    gradeRange.addEventListener('input', function () {
      if (window.__lot) window.__lot.setGrade(gradeRange.value / 100);
    });
  }

  /* ---------------------------------------------- work cards ↔ the 3D strip */
  if (matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.workcard[data-frame]').forEach(function (card) {
      var i = +card.dataset.frame;
      card.addEventListener('pointerenter', function () { if (window.__lot) window.__lot.highlightFrame(i); });
      card.addEventListener('pointerleave', function () { if (window.__lot) window.__lot.highlightFrame(-1); });
    });
  }

  /* ---------------------------------------------- storyboard cards
     Touch has no hover — tap flips; hovering also swings the department gel
     onto the banner light in the lot. */
  var hoverable = matchMedia('(hover: hover)').matches;
  document.querySelectorAll('.service').forEach(function (card) {
    if (!hoverable) {
      card.addEventListener('click', function () { card.classList.toggle('open'); });
    }
    card.addEventListener('pointerenter', function () {
      card.style.setProperty('--gel', card.dataset.gel);
      if (hoverable && window.__lot) window.__lot.gel(card.dataset.gel);
    });
    card.addEventListener('pointerleave', function () {
      if (hoverable && window.__lot) window.__lot.gel(null);
    });
    card.style.setProperty('--gel', card.dataset.gel);
  });

  /* ---------------------------------------------- premiere sweep
     The searchlights criss-cross once whenever the Legends wall arrives. */
  var clientsSec = document.getElementById('clients');
  if (clientsSec && !REDUCED) {
    var lastSweep = 0;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && Date.now() - lastSweep > 8000) {
          lastSweep = Date.now();
          if (window.__lot) window.__lot.sweep();
        }
      });
    }, { threshold: 0.25 }).observe(clientsSec);
  }

  /* ---------------------------------------------- contact slate clap */
  var whiteFlash = document.getElementById('whiteFlash');
  function markIt() {
    if (window.__lot) window.__lot.wrapClap();
    if (window.__sfx) window.__sfx.clap();
    if (whiteFlash && !REDUCED) {
      whiteFlash.classList.remove('go');
      void whiteFlash.offsetWidth;
      whiteFlash.classList.add('go');
    }
  }
  document.querySelectorAll('#contact a[href^="mailto:"]').forEach(function (a) {
    a.addEventListener('click', markIt);
  });

  /* ---------------------------------------------- filmbar scene preview
     Hover the celluloid rail for a look at the scene you'd land on;
     click to jump there. */
  var SCENES = [
    ['home', 'SC 00 · TITLE', 'assets/img/work/kkcreate.jpg'],
    ['about', 'SC 01 · COLD OPEN', 'assets/img/work/about-poster.jpg'],
    ['awara', 'SC 02 · THE BANNER', 'assets/img/graphics/g08.jpg'],
    ['work', 'SC 03 · NOW SHOWING', 'assets/img/work/kambli.jpg'],
    ['experience', 'SC 04 · CALL SHEET', 'assets/img/work/siachen.jpg'],
    ['clients', 'SC 05 · PREMIERE', 'assets/img/people/sanjeev.jpg'],
    ['skills', 'SC 06 · EDIT BAY', 'assets/img/work/moonvillage.jpg'],
    ['graphics', 'SC 07 · KEY ART', 'assets/img/graphics/g05.jpg'],
    ['gallery', 'SC 08 · STILLS', 'assets/img/gallery/p03.jpg'],
    ['education', 'SC 09 · FILM SCHOOL', 'assets/img/gallery/p04.jpg'],
    ['contact', 'SC 10 · THE WRAP', 'assets/img/work/birdhospital.jpg'],
  ];
  var sceneFor = function (frac) {
    var target = frac * (document.documentElement.scrollHeight - innerHeight);
    var pick = SCENES[0];
    for (var i = 0; i < SCENES.length; i++) {
      var el = document.getElementById(SCENES[i][0]);
      if (el && el.offsetTop - innerHeight * 0.45 <= target) pick = SCENES[i];
    }
    return pick;
  };

  var filmbar = document.getElementById('filmbar');
  var fbPreview = document.getElementById('filmbarPreview');
  var fbThumb = document.getElementById('filmbarThumb');
  var fbLabel = document.getElementById('filmbarLabel');
  if (filmbar && fbPreview && hoverable) {
    filmbar.addEventListener('pointermove', function (e) {
      var frac = Math.min(1, Math.max(0, e.clientY / innerHeight));
      var sc = sceneFor(frac);
      fbThumb.src = sc[2];
      fbLabel.textContent = sc[1];
      fbPreview.style.top = Math.min(innerHeight - 80, Math.max(76, e.clientY)) + 'px';
      fbPreview.hidden = false;
    });
    filmbar.addEventListener('pointerleave', function () { fbPreview.hidden = true; });
    filmbar.addEventListener('click', function (e) {
      var frac = Math.min(1, Math.max(0, e.clientY / innerHeight));
      var sc = sceneFor(frac);
      document.getElementById(sc[0]).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------- sound (opt-in)
     Everything synthesized with WebAudio — projector hum, a slate clap, a
     shutter tick on scene changes. Off until the visitor turns it on. */
  var sndBtn = document.getElementById('sndBtn');
  if (sndBtn) {
    var actx = null, humGain = null;
    function buildAudio() {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      // projector hum: low rumble + a 24fps shutter flutter on its level
      var master = actx.createGain();
      master.gain.value = 1;
      master.connect(actx.destination);
      humGain = actx.createGain();
      humGain.gain.value = 0;
      humGain.connect(master);
      var rumble = actx.createOscillator();
      rumble.type = 'sawtooth';
      rumble.frequency.value = 52;
      var rumbleLp = actx.createBiquadFilter();
      rumbleLp.type = 'lowpass';
      rumbleLp.frequency.value = 130;
      rumble.connect(rumbleLp).connect(humGain);
      var flutter = actx.createOscillator();
      flutter.frequency.value = 24;
      var flutterGain = actx.createGain();
      flutterGain.gain.value = 0.008;
      flutter.connect(flutterGain).connect(humGain.gain);
      rumble.start();
      flutter.start();

      sfxApi = {
        tick: function () {          // camera-shutter blip
          if (!actx) return;
          var o = actx.createOscillator();
          var g = actx.createGain();
          o.type = 'square';
          o.frequency.value = 1900;
          g.gain.setValueAtTime(0.05, actx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.045);
          o.connect(g).connect(master);
          o.start();
          o.stop(actx.currentTime + 0.05);
        },
        clap: function () {          // slate crack: a short filtered noise burst
          if (!actx) return;
          var len = actx.sampleRate * 0.09;
          var buf = actx.createBuffer(1, len, actx.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
          var src = actx.createBufferSource();
          src.buffer = buf;
          var bp = actx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 2600;
          bp.Q.value = 0.8;
          var g = actx.createGain();
          g.gain.value = 0.5;
          src.connect(bp).connect(g).connect(master);
          src.start();
        },
      };
    }
    var sndOn = false;
    var sfxApi = null;
    sndBtn.addEventListener('click', function () {
      if (!actx) buildAudio();
      sndOn = !sndOn;
      if (actx.state === 'suspended') actx.resume().catch(function () {});
      humGain.gain.setTargetAtTime(sndOn ? 0.05 : 0, actx.currentTime, 0.4);
      sndBtn.textContent = sndOn ? '🔊' : '🔇';
      sndBtn.setAttribute('aria-pressed', String(sndOn));
      window.__sfx = sndOn ? sfxApi : null;
    });
  }

  /* ---------------------------------------------- director's cut tour
     One continuous dolly through every scene: letterbox bars in, the page
     drives itself, the HUD narrates, any input hands control back. */
  var tourBtn = document.getElementById('tourBtn');
  var tourLabel = document.getElementById('tourLabel');
  var tourOn = false;
  var tourRaf = 0;
  function endTour(fin) {
    if (!tourOn) return;
    tourOn = false;
    cancelAnimationFrame(tourRaf);
    document.body.classList.remove('touring');
    if (fin && tourLabel) {
      tourLabel.textContent = 'FIN.';
      setTimeout(function () { tourLabel.textContent = ''; }, 1600);
    } else if (tourLabel) {
      tourLabel.textContent = '';
    }
  }
  function startTour() {
    if (tourOn) return;
    tourOn = true;
    document.body.classList.add('touring');
    var max = document.documentElement.scrollHeight - innerHeight;
    var from = scrollY;
    var total = ((max - from) / max) * SCENES.length * 4600;   // ~4.6s a scene
    var t0 = performance.now();
    var lastLabel = '';
    var frame = function (now) {
      if (!tourOn) return;
      var p = Math.min(1, (now - t0) / total);
      // ease the first and last five percent so the dolly breathes
      var eased = p < 0.05 ? p * p / 0.05 : p > 0.95 ? 1 - (1 - p) * (1 - p) / 0.05 : p;
      scrollTo({ top: from + (max - from) * eased, behavior: 'instant' });
      var sc = sceneFor(scrollY / max);
      if (sc[1] !== lastLabel) {
        lastLabel = sc[1];
        tourLabel.textContent = sc[1];
      }
      if (p >= 1) { endTour(true); return; }
      tourRaf = requestAnimationFrame(frame);
    };
    tourRaf = requestAnimationFrame(frame);
  }
  if (tourBtn) {
    tourBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startTour();
    });
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
      addEventListener(ev, function (e) {
        if (tourOn && e.target !== tourBtn) endTour(false);
      }, { passive: true });
    });
  }

  /* ---------------------------------------------- tint wheel
     One ring that recolours the site's accent — drag around it to pick a
     hue, double-click to come back to Awara amber. */
  var hueWheel = document.getElementById('hueWheel');
  if (hueWheel) {
    var hueDot = hueWheel.querySelector('i');
    var STOPS = [[232, 69, 69], [244, 178, 60], [124, 214, 90], [70, 200, 178], [77, 124, 255], [176, 124, 255], [232, 69, 69]];
    var applyTint = function (c) {
      var hex = '#' + c.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
      document.documentElement.style.setProperty('--amber', hex);
      document.documentElement.style.setProperty('--amber-rgb', c.join(', '));
      if (window.__lot) window.__lot.theme(hex);
      try { localStorage.setItem('tint', JSON.stringify(c)); } catch (err) { /* private mode */ }
    };
    // bring back a returning visitor's colour
    try {
      var saved = JSON.parse(localStorage.getItem('tint'));
      if (saved && saved.length === 3) setTimeout(function () { applyTint(saved); }, 450);
    } catch (err) { /* fine, default amber */ }
    var setHue = function (e) {
      var r = hueWheel.getBoundingClientRect();
      var x = e.clientX - r.left - r.width / 2;
      var y = e.clientY - r.top - r.height / 2;
      var a = Math.atan2(y, x);
      var deg = (a * 180 / Math.PI + 90 + 360) % 360;   // conic starts at 12 o'clock
      var f = deg / 360 * 6;
      var i0 = Math.floor(f), t = f - i0;
      var c = STOPS[i0].map(function (v, k) { return Math.round(v + (STOPS[i0 + 1][k] - v) * t); });
      applyTint(c);
      hueDot.style.transform = 'translate(' + (Math.cos(a) * 7).toFixed(1) + 'px,' + (Math.sin(a) * 7).toFixed(1) + 'px)';
    };
    var hueDrag = false;
    hueWheel.addEventListener('pointerdown', function (e) {
      hueDrag = true;
      try { hueWheel.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      setHue(e);
    });
    hueWheel.addEventListener('pointermove', function (e) { if (hueDrag) setHue(e); });
    hueWheel.addEventListener('pointerup', function () { hueDrag = false; });
    hueWheel.addEventListener('dblclick', function () {
      document.documentElement.style.removeProperty('--amber');
      document.documentElement.style.removeProperty('--amber-rgb');
      hueDot.style.transform = '';
      if (window.__lot) window.__lot.theme(null);
      try { localStorage.removeItem('tint'); } catch (err) { /* fine */ }
    });
  }

  /* ---------------------------------------------- golden hour + drone */
  var dayBtn = document.getElementById('dayBtn');
  if (dayBtn) {
    var golden = false;
    dayBtn.addEventListener('click', function () {
      golden = !golden;
      dayBtn.textContent = golden ? '🌅' : '🌙';
      dayBtn.setAttribute('aria-pressed', String(golden));
      if (window.__lot) window.__lot.setDay(golden);
    });
  }
  var droneBtn = document.getElementById('droneBtn');
  var dronecamEl = document.getElementById('dronecam');
  if (droneBtn && dronecamEl) {
    var droneOn = !!(window.__lot && window.__lot.fancy);
    var syncDrone = function () {
      dronecamEl.hidden = !droneOn;
      droneBtn.setAttribute('aria-pressed', String(droneOn));
      droneBtn.style.opacity = droneOn ? '' : '0.4';
      if (window.__lot) window.__lot.drone(droneOn);
    };
    // scene.js loads as a module after this script parses — sync once ready
    setTimeout(function () {
      droneOn = !!(window.__lot && window.__lot.fancy);
      syncDrone();
    }, 400);
    droneBtn.addEventListener('click', function () {
      droneOn = !droneOn && !!(window.__lot && window.__lot.fancy);
      syncDrone();
    });
  }

  /* ---------------------------------------------- ACTION! easter egg
     Type "action": the searchlights swing onto the screen, the slate flash
     fires, and the showreel rolls. */
  var actionFlash = document.getElementById('actionFlash');
  var buf = '';
  addEventListener('keydown', function (e) {
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-6);
    if (buf !== 'action') return;
    buf = '';
    if (window.__lot) window.__lot.action();
    if (window.__sfx) window.__sfx.clap();
    if (actionFlash) {
      actionFlash.classList.remove('go');
      void actionFlash.offsetWidth; // restart the animation
      actionFlash.classList.add('go');
    }
    setTimeout(function () {
      if (lightbox.hidden) openLightbox('<video src="assets/video/showreel.mp4" controls autoplay playsinline></video>');
    }, 1100);
  });
})();
