(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };

  /* ---------- Loader -> hero entrance ---------- */
  var loader = $('#loader'), started = false;
  function start() {
    if (started) return; started = true;
    loader.classList.add('is-done');
    document.body.classList.add('is-ready');
    setTimeout(function () { loader.style.display = 'none'; }, 1300);
  }
  window.addEventListener('load', function () { setTimeout(start, reduce ? 0 : 1300); });
  setTimeout(start, 3800);
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Split headings into masked words ---------- */
  function splitNode(node, state) {
    $$('*', node); // no-op, keeps structure readable
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var s = document.createElement('span'); s.textContent = part;
          s.style.setProperty('--i', state.i++);
          w.appendChild(s); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) { splitNode(n, state); }
    });
  }
  $$('[data-split]').forEach(function (h) {
    var label = h.textContent.trim();
    splitNode(h, { i: 0 });
    h.setAttribute('aria-label', label);
  });

  /* ---------- Scroll reveal (reveal, split, mask) ---------- */
  var targets = $$('.reveal, [data-split], [data-reveal-mask]');
  $$('.reveal').forEach(function (el, i) { el.style.setProperty('--d', ((i % 4) * 0.08) + 's'); });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Count-up ---------- */
  function runCount(el) {
    var target = parseInt(el.dataset.count, 10);
    if (reduce) { el.textContent = target; return; }
    var t0 = null;
    (function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (c) { cio.observe(c); });
  } else { $$('[data-count]').forEach(runCount); }

  /* ---------- Nav + mobile menu ---------- */
  var nav = $('#nav'), toggle = $('#navToggle'), menu = $('#menu'), navBackdrop = $('#navBackdrop');
  function closeMenu() {
    menu.classList.remove('is-open');
    nav.classList.remove('is-menu-open');
    navBackdrop.classList.remove('is-visible');
    navBackdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }
  function openMenu() {
    menu.classList.add('is-open');
    nav.classList.add('is-menu-open');
    navBackdrop.classList.add('is-visible');
    navBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
  }
  toggle.addEventListener('click', function () {
    if (menu.classList.contains('is-open')) closeMenu();
    else openMenu();
  });
  navBackdrop.addEventListener('click', closeMenu);
  $$('a', menu).forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('pointerdown', function (e) {
    if (!menu.classList.contains('is-open') || menu.contains(e.target) || toggle.contains(e.target)) return;
    closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });

  /* ---------- Expandable service cards ---------- */
  var serviceTriggers = $$('.svc__trigger');
  serviceTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var opening = trigger.getAttribute('aria-expanded') !== 'true';
      serviceTriggers.forEach(function (item) {
        item.setAttribute('aria-expanded', 'false');
        item.parentNode.classList.remove('is-open');
        $('#' + item.getAttribute('aria-controls')).hidden = true;
      });
      if (opening) {
        trigger.setAttribute('aria-expanded', 'true');
        trigger.parentNode.classList.add('is-open');
        $('#' + trigger.getAttribute('aria-controls')).hidden = false;
      }
    });
  });
  $$('.svc__book').forEach(function (link) {
    link.addEventListener('click', function () {
      $('#fType').value = link.dataset.service;
    });
  });

  /* ---------- Scroll-driven stuff (one rAF loop) ---------- */
  var progress = $('#progress'), backTop = $('#backTop');
  var par = $$('[data-parallax]');
  var parY = $$('[data-parallax-y]');
  var lines = $$('[data-line]');
  var showcase = $('#looks'), track = $('#track'), bar = $('#trackBar');
  var dist = 0, native = false;

  function measureShowcase() {
    native = window.innerWidth <= 760 || reduce;
    showcase.classList.toggle('is-native', native);
    if (native) { showcase.style.height = ''; track.style.transform = ''; return; }
    dist = Math.max(track.scrollWidth - window.innerWidth, 0);
    showcase.style.height = (dist + window.innerHeight) + 'px';
  }
  window.addEventListener('resize', measureShowcase);
  window.addEventListener('load', measureShowcase);
  $$('img', track).forEach(function (im) { im.addEventListener('load', measureShowcase); });
  measureShowcase();

  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    nav.classList.toggle('is-stuck', y > 40);
    var showBackTop = y > 420;
    backTop.classList.toggle('is-visible', showBackTop);
    backTop.setAttribute('aria-hidden', showBackTop ? 'false' : 'true');
    backTop.setAttribute('tabindex', showBackTop ? '0' : '-1');

    if (!reduce) {
      if (y < vh * 1.3) par.forEach(function (el) {
        el.style.transform = 'translate3d(0,' + (y * parseFloat(el.dataset.parallax)) + 'px,0)';
      });
      parY.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = 'translate3d(0,' + (p * parseFloat(el.dataset.parallaxY)) + 'px,0)';
      });
    }
    lines.forEach(function (ol) {
      var r = ol.getBoundingClientRect();
      ol.style.setProperty('--p', clamp((vh * 0.75 - r.top) / r.height, 0, 1));
    });
    if (!native) {
      var top = showcase.offsetTop;
      var p = dist > 0 ? clamp((y - top) / dist, 0, 1) : 0;
      track.style.transform = 'translate3d(' + (-p * dist) + 'px,0,0)';
      bar.style.transform = 'scaleX(' + p + ')';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  /* ---------- Rotating word ---------- */
  var words = $$('#rotor b'), wi = 0;
  if (words.length && !reduce) {
    setInterval(function () {
      var cur = words[wi]; wi = (wi + 1) % words.length;
      cur.classList.remove('is-on'); cur.classList.add('is-off');
      var nxt = words[wi]; nxt.classList.remove('is-off'); nxt.classList.add('is-on');
      setTimeout(function () { cur.classList.remove('is-off'); }, 750);
    }, 2200);
  }

  /* ---------- Pointer effects (desktop only) ---------- */
  var glow = $('#glow'), cursor = $('#cursor');
  if (fine && !reduce) {
    var gx = 0, gy = 0, cx = 0, cy = 0, kx = 0, ky = 0;
    window.addEventListener('pointermove', function (e) {
      gx = e.clientX; gy = e.clientY; cursor.classList.add('is-on');
    }, { passive: true });
    (function loop() {
      cx += (gx - cx) * 0.07; cy += (gy - cy) * 0.07;
      kx += (gx - kx) * 0.22; ky += (gy - ky) * 0.22;
      glow.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      cursor.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
      requestAnimationFrame(loop);
    })();
    $$('a, button, .svc__row, .look, .tile').forEach(function (el) {
      el.addEventListener('pointerenter', function () { cursor.classList.add('is-big'); });
      el.addEventListener('pointerleave', function () { cursor.classList.remove('is-big'); });
    });

    /* magnetic buttons */
    $$('.magnetic').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.28) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.35) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });

    /* hero 3D tilt */
    var art = $('#tilt'), frameEl = $('.hero__frame');
    art.addEventListener('pointermove', function (e) {
      var r = art.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      frameEl.style.transform = 'rotateY(' + (px * 10) + 'deg) rotateX(' + (-py * 8) + 'deg)';
    });
    art.addEventListener('pointerleave', function () { frameEl.style.transform = ''; });

    /* services hover preview */
    var peek = $('#peek'), peekImg = $('img', peek), px = 0, py = 0, sx = 0, sy = 0, over = false;
    $$('.svc__row').forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        peekImg.src = row.dataset.img; peek.classList.add('is-on'); over = true;
      });
      row.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); over = false; });
    });
    window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; }, { passive: true });
    (function peekLoop() {
      sx += (px - sx) * 0.14; sy += (py - sy) * 0.14;
      if (over) peek.style.transform = 'translate(' + (sx + 140) + 'px,' + (sy - 20) + 'px) translate(-50%,-50%) rotate(' + ((px - sx) * 0.06) + 'deg)';
      requestAnimationFrame(peekLoop);
    })();
  }

  /* ---------- Hero sparkle (rose-gold glitter) ---------- */
  var cv = $('#sparkle');
  if (cv && !reduce) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, dots = [], run = true;
    function size() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function make() {
      return { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 0.6, v: Math.random() * 0.25 + 0.05, t: Math.random() * 6.28, s: Math.random() * 0.03 + 0.01, star: Math.random() < 0.25 };
    }
    size();
    var n = W < 700 ? 40 : 85;
    for (var i = 0; i < n; i++) dots.push(make());
    window.addEventListener('resize', size);
    function draw() {
      if (!run) return;
      ctx.clearRect(0, 0, W, H);
      dots.forEach(function (d) {
        d.y -= d.v; d.t += d.s;
        if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
        var a = 0.25 + Math.abs(Math.sin(d.t)) * 0.75;
        ctx.globalAlpha = a; ctx.fillStyle = '#f3d3c8';
        if (d.star) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - d.r * 3); ctx.lineTo(d.x + d.r * 0.7, d.y - d.r * 0.7);
          ctx.lineTo(d.x + d.r * 3, d.y); ctx.lineTo(d.x + d.r * 0.7, d.y + d.r * 0.7);
          ctx.lineTo(d.x, d.y + d.r * 3); ctx.lineTo(d.x - d.r * 0.7, d.y + d.r * 0.7);
          ctx.lineTo(d.x - d.r * 3, d.y); ctx.lineTo(d.x - d.r * 0.7, d.y - d.r * 0.7);
          ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill(); }
      });
      requestAnimationFrame(draw);
    }
    new IntersectionObserver(function (en) { run = en[0].isIntersecting; if (run) draw(); }).observe(cv);
    draw();
  }

  /* ---------- Lightbox ---------- */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lastFocus = null;
  function openLb(el) {
    lastFocus = el; lbImg.src = el.dataset.full; lbImg.alt = $('img', el).alt;
    lb.hidden = false; $('#lbClose').focus(); document.body.style.overflow = 'hidden';
  }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  $$('.look').forEach(function (t) { t.addEventListener('click', function () { openLb(t); }); });
  $('#lbClose').addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  /* ---------- Testimonial slider ---------- */
  var slides = $$('.slide'), dotsBox = $('#dots'), idx = 0, timer = null;
  slides.forEach(function (_, i) {
    var d = document.createElement('button');
    d.type = 'button'; d.setAttribute('aria-label', 'Show review ' + (i + 1));
    d.addEventListener('click', function () { go(i); restart(); });
    dotsBox.appendChild(d);
  });
  var dots = $$('button', dotsBox);
  function go(n) {
    idx = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
    dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
  }
  function restart() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(idx + 1); }, 5500); }
  $('#prev').addEventListener('click', function () { go(idx - 1); restart(); });
  $('#next').addEventListener('click', function () { go(idx + 1); restart(); });
  go(0); restart();

  /* ---------- Booking form -> WhatsApp ---------- */
  var form = $('#bookForm'), err = $('#formErr');
  var today = new Date();
  $('#fDate').min = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#fName'), type = $('#fType'), date = $('#fDate'), msg = $('#fMsg');
    var required = [name, type, date];
    var missing = required.filter(function (f) {
      var invalid = !f.value.trim();
      f.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      return invalid;
    });
    if (missing.length) {
      err.hidden = false;
      err.textContent = 'Please fill in your name, the occasion and the date.';
      missing[0].focus();
      return;
    }
    if (date.value < date.min) {
      date.setAttribute('aria-invalid', 'true');
      err.hidden = false;
      err.textContent = 'Please choose today or a future date.';
      date.focus();
      return;
    }
    err.hidden = true;
    var text = 'Hello! I would like to book ' + type.value + '.\nName: ' + name.value.trim() + '\nDate: ' + date.value +
      (msg.value.trim() ? '\nMessage: ' + msg.value.trim() : '');
    window.open('https://wa.me/916394868362?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
})();