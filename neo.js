/* ===== Future mode (data-theme="neo"): the pieces that CSS alone cannot draw =====
   Everything here is created only after the theme is first switched on and is hidden by neo.css in every other theme.
   - a wireframe twisting tower in the hero (canvas, turns with the pointer and the scroll)
   - two crossing bands of program names that slide with the scroll
   - a Baghdad clock in the floating bar
   - a pointer glow that follows the mouse inside each band
   - a short letter scramble on Latin captions
   Nothing moves when the visitor prefers reduced motion. */
(function () {
  'use strict';
  var R = document.documentElement,
    RM = window.matchMedia ? matchMedia('(prefers-reduced-motion:reduce)') : { matches: false },
    S = { built: false, on: false, heroVis: true, mqVis: false, raf: 0, gl: 0, px: .7, py: .4, tx: .7, ty: .4, moved: false, last: 0, bandW: 0 },
    TAU = Math.PI * 2, el = {}, cv, cx, W = 0, H = 0, dpr = 1, clockT = 0, IO = null, scrIO = null, gcache = null, gtime = 0;

  function isNeo() { return R.getAttribute('data-theme') === 'neo'; }
  function rtl() { return R.getAttribute('dir') === 'rtl'; }
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; }

  /* ---------- build once ---------- */
  function names() {
    var o = [], p = window.PGO, m = window.PGM, i;
    if (p && m) for (i = 0; i < p.length; i++) if (m[p[i]] && m[p[i]].n) o.push(m[p[i]].n);
    return o.length ? o : ['AutoCAD', 'Revit', 'SketchUp', 'Rhinoceros', 'V-Ray', 'Lumion', 'Enscape', 'Photoshop'];
  }
  function band(items, cls) {
    var one = '', i;
    for (i = 0; i < items.length; i++) one += '<span>' + items[i] + '<s></s></span>';
    var b = mk('div', 'nxb ' + cls), t = mk('div', 'nxt', one + one);
    b.appendChild(t); return b;
  }
  function build() {
    if (S.built) return;
    S.built = true;
    var hero = document.querySelector('.hero'), hd = document.querySelector('header .w'), ft = document.querySelector('footer');
    if (hd) {
      el.hud = mk('div', 'nxh', '<i></i><b>BAGHDAD</b><span>33.31°N 44.37°E</span><span class="nxk">--:--:--</span>');
      el.hud.setAttribute('aria-hidden', 'true'); hd.appendChild(el.hud); el.clk = el.hud.querySelector('.nxk');
    }
    if (hero) {
      cv = mk('canvas', 'nxc'); cv.setAttribute('aria-hidden', 'true'); hero.insertBefore(cv, hero.firstChild);
      cx = cv.getContext('2d');
      var m = mk('div', 'nxm'); m.setAttribute('aria-hidden', 'true');
      el.a = band(names(), 'a'); el.b = band(['DESIGN', 'VISUALIZE', 'TEACH', 'SUPERVISE', 'CRITIQUE', 'BUILD', 'DESIGN', 'VISUALIZE', 'TEACH', 'SUPERVISE', 'CRITIQUE', 'BUILD'], 'b');
      m.appendChild(el.a); m.appendChild(el.b);
      hero.parentNode.insertBefore(m, hero.nextSibling); el.mq = m;
    }
    if (ft) { el.wm = mk('div', 'nxp', 'X ARCHITECTURE'); el.wm.setAttribute('aria-hidden', 'true'); ft.insertBefore(el.wm, ft.firstChild); }
    if ('IntersectionObserver' in window) {
      IO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.target === hero) S.heroVis = e.isIntersecting; else if (e.target === el.mq) S.mqVis = e.isIntersecting; });
        kick();
      }, { rootMargin: '80px' });
      if (hero) IO.observe(hero);
      if (el.mq) IO.observe(el.mq);
    }
    addEventListener('resize', size, { passive: true });
  }

  /* ---------- the tower ---------- */
  function size() {
    if (!cv) return;
    var h = cv.parentNode; W = h.clientWidth; H = h.clientHeight; if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.bandW = 0; kick();
  }
  var FL = 26, TW = Math.PI * .55, HT = 4.2;
  function draw(t) {
    if (!cx || !W) return;
    var mob = W < 760, tab = !mob && W < 900, ccx = (mob || tab) ? W * .5 : W * (rtl() ? .26 : .74),
      ccy = mob ? H * .66 : tab ? H * .72 : H * .58,
      u = mob ? Math.min(W * .3, H * .16) : tab ? Math.min(W * .2, H * .12) : Math.min(W * .14, H * .18), d = 7.5,
      yaw = RM.matches ? .7 : t * .00022 + (S.px - .5) * 1.5 + (window.pageYOffset || 0) * .0028, pit = RM.matches ? .34 : .34 + (S.py - .5) * .22,
      sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pit), cp = Math.cos(pit),
      B = [[], [], [], []], i, k, c, a, s, x, y, z, X, Y, Z, p, q, f, lime = [], pts = [], P, roof, bx, by;
    cx.clearRect(0, 0, W, H);
    function pr(x, y, z) {
      var x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, k = d / (z2 + d);
      return [ccx + x1 * u * k, ccy - y1 * u * k, z2];
    }
    function seg(A, Bp) {
      var dz = (A[2] + Bp[2]) / 2, b = dz < -.9 ? 3 : dz < 0 ? 2 : dz < .9 ? 1 : 0;
      B[b].push(A[0], A[1], Bp[0], Bp[1]);
    }
    /* ground: rings and ticks */
    var gy = -HT / 2 - .02, ring = [1.5, 2.2, 3.1], rr, n, prev, cur;
    cx.lineWidth = 1;
    for (rr = 0; rr < ring.length; rr++) {
      cx.beginPath();
      for (n = 0; n <= 72; n++) {
        a = n / 72 * TAU; cur = pr(Math.cos(a) * ring[rr], gy, Math.sin(a) * ring[rr]);
        n ? cx.lineTo(cur[0], cur[1]) : cx.moveTo(cur[0], cur[1]);
      }
      cx.strokeStyle = 'rgba(255,255,255,' + (.2 - rr * .045) + ')'; cx.stroke();
    }
    cx.beginPath();
    for (n = 0; n < 24; n++) {
      a = n / 24 * TAU; prev = pr(Math.cos(a) * 1.5, gy, Math.sin(a) * 1.5); cur = pr(Math.cos(a) * 3.1, gy, Math.sin(a) * 3.1);
      cx.moveTo(prev[0], prev[1]); cx.lineTo(cur[0], cur[1]);
    }
    cx.strokeStyle = 'rgba(255,255,255,.1)'; cx.stroke();
    /* floors */
    for (k = 0; k < FL; k++) {
      f = k / (FL - 1); y = -HT / 2 + f * HT;
      s = .64 * (1 - .46 * Math.pow(f, 1.25)) + (k % 5 === 0 ? .04 : 0);
      a = f * TW + .3; c = [];
      for (i = 0; i < 4; i++) {
        q = a + i * Math.PI / 2 + Math.PI / 4;
        c.push(pr(Math.cos(q) * s * 1.414, y, Math.sin(q) * s * 1.414));
      }
      pts.push(c);
    }
    for (k = 0; k < FL; k++) {
      c = pts[k];
      for (i = 0; i < 4; i++) {
        if (k % 5 === 0 || k === FL - 1) { lime.push(c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1]); }
        else seg(c[i], c[(i + 1) % 4]);
        if (k < FL - 1) {
          p = pts[k + 1];
          seg(c[i], p[i]);
          if (k % 3 === 1) seg(c[i], p[(i + 1) % 4]);
        }
      }
    }
    /* core */
    var core = [pr(0, -HT / 2, 0), pr(0, HT / 2 + .55, 0)];
    seg(core[0], core[1]);
    /* roof plate fill + mast */
    c = pts[FL - 1];
    cx.beginPath(); cx.moveTo(c[0][0], c[0][1]); for (i = 1; i < 4; i++) cx.lineTo(c[i][0], c[i][1]); cx.closePath();
    cx.fillStyle = 'rgba(214,255,0,.9)'; cx.fill();
    c = pts[10];
    cx.beginPath(); cx.moveTo(c[0][0], c[0][1]); for (i = 1; i < 4; i++) cx.lineTo(c[i][0], c[i][1]); cx.closePath();
    cx.fillStyle = 'rgba(255,46,147,.22)'; cx.fill();
    /* strokes by depth */
    var al = [.9, .62, .38, .2];
    cx.lineWidth = mob ? 1 : 1.25;
    for (i = 3; i >= 0; i--) {
      cx.beginPath();
      for (k = 0; k < B[i].length; k += 4) { cx.moveTo(B[i][k], B[i][k + 1]); cx.lineTo(B[i][k + 2], B[i][k + 3]); }
      cx.strokeStyle = 'rgba(255,255,255,' + al[i] + ')'; cx.stroke();
    }
    cx.beginPath();
    for (k = 0; k < lime.length; k += 4) { cx.moveTo(lime[k], lime[k + 1]); cx.lineTo(lime[k + 2], lime[k + 3]); }
    cx.lineWidth = 2; cx.strokeStyle = '#d6ff00'; cx.stroke();
    /* beacon */
    roof = pr(0, HT / 2 + .55, 0); bx = roof[0]; by = roof[1];
    var pulse = RM.matches ? 1 : .6 + .4 * Math.sin(t * .004);
    cx.beginPath(); cx.arc(bx, by, 4.5, 0, TAU); cx.fillStyle = '#ff2e93'; cx.fill();
    cx.beginPath(); cx.arc(bx, by, 4.5 + 9 * pulse, 0, TAU); cx.strokeStyle = 'rgba(255,46,147,' + (.7 - .5 * pulse) + ')'; cx.lineWidth = 1.5; cx.stroke();
  }

  /* ---------- bands that slide with the scroll ---------- */
  function bands(t) {
    if (!el.a || !el.mq) return;
    if (!S.bandW) {
      S.bandW = el.a.firstChild.scrollWidth / 2; S.bandV = el.b.firstChild.scrollWidth / 2;
      if (!S.bandW || !S.bandV) { S.bandW = 0; return; }
    }
    var sc = window.pageYOffset || 0, m = RM.matches ? 0 : t * .045 + sc * .55,
      oa = -(m % S.bandW), ob = -(S.bandV - (m * 1.1 % S.bandV));
    el.a.firstChild.style.transform = 'translate3d(' + oa.toFixed(1) + 'px,0,0)';
    el.b.firstChild.style.transform = 'translate3d(' + ob.toFixed(1) + 'px,0,0)';
  }

  /* ---------- pointer glow inside the bands ---------- */
  function glowSections() {
    var now = Date.now();
    if (!gcache || now - gtime > 900) {
      gcache = [].slice.call(document.querySelectorAll('.hero,#hm>section,#vs>section,#vp>section,#vw>section,#va>section,#vn>section,#vk>section,#vc>section'));
      gtime = now;
    }
    return gcache;
  }
  function glow() {
    S.gl = 0;
    if (!S.on) return;
    var px = S.tx * innerWidth, py = S.ty * innerHeight, ls = glowSections(), r = [], i, b;
    for (i = 0; i < ls.length; i++) { b = ls[i].getBoundingClientRect(); r.push(b); }
    for (i = 0; i < ls.length; i++) {
      b = r[i];
      if (b.bottom < -50 || b.top > innerHeight + 50) continue;
      ls[i].style.setProperty('--gx', (px - b.left).toFixed(0) + 'px');
      ls[i].style.setProperty('--gy', (py - b.top).toFixed(0) + 'px');
    }
    S.moved = false;
  }
  function onMove(e) {
    if (e.pointerType === 'touch' || !S.on) return;
    S.tx = e.clientX / innerWidth; S.ty = e.clientY / innerHeight; S.moved = true;
    if (!S.gl) S.gl = requestAnimationFrame(glow);
    if (!RM.matches) kick();
  }

  /* ---------- loop ---------- */
  function tick(t) {
    S.raf = 0;
    if (!S.on || document.hidden) return;
    S.px += (S.tx - S.px) * .07; S.py += (S.ty - S.py) * .07;
    if (S.heroVis) draw(t);
    if (S.mqVis) bands(t);
    if (!RM.matches && (S.heroVis || S.mqVis)) S.raf = requestAnimationFrame(tick);
  }
  function kick() { if (S.on && !S.raf) S.raf = requestAnimationFrame(tick); }

  function clock() {
    if (!el.clk) return;
    try {
      el.clk.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baghdad', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    } catch (e) { el.clk.textContent = new Date().toISOString().slice(11, 19); }
  }

  /* ---------- letter scramble on Latin captions ---------- */
  var SC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+#';
  function scr(n) {
    if (RM.matches) return;
    var to = n.getAttribute('data-nxt'), f = 0, F = 16;
    if (!to) return;
    (function step() {
      var o = '', i;
      for (i = 0; i < to.length; i++) o += (to[i] === ' ' || i < f / F * to.length) ? to[i] : SC[(Math.random() * SC.length) | 0];
      n.textContent = o;
      if (++f <= F) setTimeout(step, 38); else n.textContent = to;
    })();
  }
  function scan() {
    if (!S.on || !('IntersectionObserver' in window)) return;
    if (!scrIO) scrIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { scrIO.unobserve(e.target); scr(e.target); } });
    }, { threshold: .6 });
    [].forEach.call(document.querySelectorAll('.hd small,.hero .eb'), function (n) {
      var t = n.textContent;
      if (n.__nx === t || !/^[A-Za-z0-9 &.\-\/]{3,}$/.test(t)) return;
      n.__nx = t; n.setAttribute('data-nxt', t); scrIO.observe(n);
    });
  }

  /* ---------- on / off ---------- */
  function sync() {
    var on = isNeo();
    if (on === S.on) return;
    S.on = on;
    if (on) {
      build(); size(); clock(); clearInterval(clockT); clockT = setInterval(clock, 1000);
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('scroll', kick, { passive: true });
      kick(); setTimeout(scan, 200); setTimeout(scan, 1400); setTimeout(function () { S.bandW = 0; kick(); }, 600);
      if (RM.matches) { draw(0); bands(0); }
    } else {
      clearInterval(clockT); if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0;
      removeEventListener('pointermove', onMove); removeEventListener('scroll', kick);
      [].forEach.call(document.querySelectorAll('[style*="--gx"]'), function (n) { n.style.removeProperty('--gx'); n.style.removeProperty('--gy'); });
    }
  }
  if (window.MutationObserver) new MutationObserver(sync).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  addEventListener('hashchange', function () { gcache = null; setTimeout(scan, 500); setTimeout(scan, 1500); });
  document.addEventListener('click', function () { if (S.on) { S.bandW = 0; setTimeout(scan, 300); setTimeout(size, 300); } }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
