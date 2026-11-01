/* ===== Future mode (data-theme="neo"): the pieces that CSS alone cannot draw =====
   Everything here is created only after the theme is first switched on and is hidden by neo.css in every other theme.
   - a small 3D engine on a canvas (flat polygons, painter's sort, flat shading) that draws:
       the hero scene (a twisting glass tower, a pavilion, floating cubes, two orbit rings),
       a small turning model on each of the four "doors" on the home page, and the X mark as a solid in the call-to-action band
   - two crossing bands of program names that slide with the scroll
   - a Baghdad clock in the floating bar
   - a soft tilt (with a moving sheen) on cards, and a glow that follows the pointer inside each band
   - a short letter scramble on Latin captions
   Nothing moves when the visitor prefers reduced motion (every model is drawn once). */
(function () {
  'use strict';
  var R = document.documentElement,
    RM = window.matchMedia ? matchMedia('(prefers-reduced-motion:reduce)') : { matches: false },
    FP = window.matchMedia ? matchMedia('(hover:hover) and (pointer:fine)') : { matches: false },
    S = { built: false, on: false, raf: 0, gl: 0, px: .7, py: .4, tx: .7, ty: .4, mqVis: false, bandW: 0, bandV: 0 },
    TAU = Math.PI * 2, el = {}, stages = [], clockT = 0, IO = null, scrIO = null, gcache = null, gtime = 0, mo = null;

  /* palette (the same purple, gold and black as neo.css) */
  var PU1 = [40, 12, 84], PU2 = [98, 38, 190], PU3 = [150, 104, 250], GOLD = [214, 189, 126], GOLD2 = [236, 220, 170], INK = [10, 5, 18];

    function isNeo() { return R.getAttribute('data-theme') === 'neo'; }
  function rtl() { return R.getAttribute('dir') === 'rtl'; }
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  /* ---------- the 3D engine ---------- */
  function rot(p, rx, ry, rz) {
    var x = p[0], y = p[1], z = p[2], c, s, t;
    if (rz) { c = Math.cos(rz); s = Math.sin(rz); t = x * c - y * s; y = x * s + y * c; x = t; }
    if (rx) { c = Math.cos(rx); s = Math.sin(rx); t = y * c - z * s; z = y * s + z * c; y = t; }
    if (ry) { c = Math.cos(ry); s = Math.sin(ry); t = x * c + z * s; z = -x * s + z * c; x = t; }
    return [x, y, z];
  }
  /* a mesh is { f: faces, l: lines }; a face is { v: [[x,y,z]...], o: a point inside the solid (to find the outside), c: [r,g,b], e: edge alpha, fl: flat colour, ds: two-sided } */
  function box(sx, sy, sz, c, e) {
    var k = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(function (p) { return [p[0] * sx, p[1] * sy, p[2] * sz]; }),
      I = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    return { f: I.map(function (q) { return { v: q.map(function (i) { return k[i]; }), o: [0, 0, 0], c: c, e: e == null ? .32 : e }; }), l: [] };
  }
  function place(m, off, ry, tint) {
    return {
      f: m.f.map(function (f) {
        return { v: f.v.map(function (p) { var q = rot(p, 0, ry || 0, 0); return [q[0] + off[0], q[1] + off[1], q[2] + off[2]]; }),
          o: (function () { var q = rot(f.o, 0, ry || 0, 0); return [q[0] + off[0], q[1] + off[1], q[2] + off[2]]; })(), c: tint || f.c, e: f.e, fl: f.fl, ds: f.ds };
      }), l: m.l.map(function (l) { return l; })
    };
  }
  function merge() { var o = { f: [], l: [] }; [].slice.call(arguments).forEach(function (m) { o.f = o.f.concat(m.f); o.l = o.l.concat(m.l); }); return o; }
  function ring(r, n, c, al, y) {
    var l = [], i, a, b;
    for (i = 0; i < n; i++) {
      a = i / n * TAU; b = (i + 1) / n * TAU;
      l.push({ a: [Math.cos(a) * r, y || 0, Math.sin(a) * r], b: [Math.cos(b) * r, y || 0, Math.sin(b) * r], c: c, al: al });
    }
    return { f: [], l: l };
  }
  /* a twisting tower: a lofted solid, gold floor edges, a bright roof */
  function tower(N, H, W0, tw) {
    var f = [], l = [], k, i, fl = [], y, s, a, q, ff, c, p, cur, nx;
    for (k = 0; k <= N; k++) {
      ff = k / N; y = -H / 2 + ff * H; s = W0 * (1 - .48 * Math.pow(ff, 1.25)) * (1 + .05 * Math.sin(ff * 7)); a = ff * tw + .3; cur = [];
      for (i = 0; i < 4; i++) { q = a + i * Math.PI / 2 + Math.PI / 4; cur.push([Math.cos(q) * s * 1.414, y, Math.sin(q) * s * 1.414]); }
      fl.push(cur);
    }
    for (k = 0; k < N; k++) {
      c = lerp(PU1, [112, 50, 214], Math.pow(k / N, .9));
      for (i = 0; i < 4; i++) {
        nx = (i + 1) % 4;
        f.push({ v: [fl[k][i], fl[k][nx], fl[k + 1][nx], fl[k + 1][i]], o: [0, fl[k][0][1], 0], c: c, e: .16 });
      }
      if (k % 2 === 0) for (i = 0; i < 4; i++) l.push({ a: fl[k][i], b: fl[k][(i + 1) % 4], c: k % 6 === 0 ? GOLD2 : GOLD, al: k % 6 === 0 ? .95 : .5 });
    }
    for (i = 0; i < 4; i++) l.push({ a: fl[N][i], b: fl[N][(i + 1) % 4], c: GOLD2, al: 1 });
    f.push({ v: fl[N], o: [0, fl[N][0][1] - .5, 0], c: GOLD, e: .9, fl: 1, ds: 1, zb: -1.2 });
    f.push({ v: fl[0], o: [0, fl[0][0][1] + .5, 0], c: INK, e: .5, fl: 1, ds: 1, zb: 1.2 });
    l.push({ a: [0, -H / 2, 0], b: [0, H / 2 + .8, 0], c: GOLD2, al: .8 });
    return { f: f, l: l, top: [0, H / 2 + .8, 0] };
  }
  function prism(pts, z0, z1, c, e) {
    var f = [], n = pts.length, cx = 0, cy = 0, i, j;
    pts.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
    f.push({ v: pts.map(function (p) { return [p[0], p[1], z1]; }), o: [cx, cy, (z0 + z1) / 2], c: c, e: e });
    f.push({ v: pts.map(function (p) { return [p[0], p[1], z0]; }), o: [cx, cy, (z0 + z1) / 2], c: c, e: e });
    for (i = 0; i < n; i++) { j = (i + 1) % n; f.push({ v: [[pts[i][0], pts[i][1], z0], [pts[j][0], pts[j][1], z0], [pts[j][0], pts[j][1], z1], [pts[i][0], pts[i][1], z1]], o: [cx, cy, (z0 + z1) / 2], c: c, e: e }); }
    return { f: f, l: [] };
  }

  var LIGHT = (function () { var x = -.5, y = .72, z = -.48, n = Math.sqrt(x * x + y * y + z * z); return [x / n, y / n, z / n]; })();

  function Stage(cv, objs, o) {
    this.cv = cv; this.cx = cv.getContext('2d'); this.objs = objs; this.o = o || {};
    this.W = 0; this.H = 0; this.dpr = 1; this.vis = false; this.boost = 0; this.hov = false;
    this.size();
  }
  Stage.prototype.size = function () {
    var w = this.cv.clientWidth, h = this.cv.clientHeight; if (!w || !h) return;
    this.W = w; this.H = h; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.dirty = true;
  };
  Stage.prototype.draw = function (t) {
    var W = this.W, H = this.H, cx = this.cx, o = this.o, objs = this.objs, polys = [], lines = [], d = o.d || 8,
      cen = o.center ? o.center(W, H) : [W / 2, H / 2, Math.min(W, H) * .2],
      yaw = o.yaw ? o.yaw(t, this) : t * .0003, pit = o.pit ? o.pit(t, this) : .3, i, j, ob, m, f, v, tv, p, n, nn, ctr, dd, ou, tr;
    if (!W || !H) return;
    cx.clearRect(0, 0, W, H);
    function tf(p, ob) {
      var q = [p[0] * (ob.s || 1), p[1] * (ob.s || 1), p[2] * (ob.s || 1)];
      q = rot(q, ob.rx || 0, ob.ry || 0, ob.rz || 0);
      q = [q[0] + (ob.x || 0), q[1] + (ob.y || 0), q[2] + (ob.z || 0)];
      q = rot(q, pit, yaw, 0); q[2] += d; return q;
    }
    for (i = 0; i < objs.length; i++) {
      ob = objs[i]; if (ob.upd) ob.upd(t, ob); m = ob.mesh;
      for (j = 0; j < m.f.length; j++) {
        f = m.f[j]; tv = []; ctr = [0, 0, 0];
        for (v = 0; v < f.v.length; v++) { p = tf(f.v[v], ob); tv.push(p); ctr[0] += p[0] / f.v.length; ctr[1] += p[1] / f.v.length; ctr[2] += p[2] / f.v.length; }
        n = [(tv[1][1] - tv[0][1]) * (tv[2][2] - tv[0][2]) - (tv[1][2] - tv[0][2]) * (tv[2][1] - tv[0][1]),
          (tv[1][2] - tv[0][2]) * (tv[2][0] - tv[0][0]) - (tv[1][0] - tv[0][0]) * (tv[2][2] - tv[0][2]),
          (tv[1][0] - tv[0][0]) * (tv[2][1] - tv[0][1]) - (tv[1][1] - tv[0][1]) * (tv[2][0] - tv[0][0])];
        ou = tf(f.o || [0, 0, 0], ob);
        if (n[0] * (ctr[0] - ou[0]) + n[1] * (ctr[1] - ou[1]) + n[2] * (ctr[2] - ou[2]) < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
        if (f.ds) { if (n[0] * ctr[0] + n[1] * ctr[1] + n[2] * ctr[2] > 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; } }
        else if (n[0] * ctr[0] + n[1] * ctr[1] + n[2] * ctr[2] >= 0) continue;
        dd = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
        nn = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / dd;
        polys.push({ p: tv, z: ctr[2] + (f.zb || 0), I: Math.max(0, nn), f: f });
      }
      for (j = 0; j < m.l.length; j++) {
        tr = m.l[j]; lines.push({ a: tf(tr.a, ob), b: tf(tr.b, ob), c: tr.c, al: tr.al });
      }
    }
    var k = cen[2] * d;
    function pr(p) { var s = k / p[2]; return [cen[0] + p[0] * s, cen[1] - p[1] * s]; }
    /* far to near: polygons and lines share one depth order */
    var all = [], zi;
    for (i = 0; i < polys.length; i++) all.push({ z: polys[i].z, q: polys[i] });
    for (i = 0; i < lines.length; i++) all.push({ z: (lines[i].a[2] + lines[i].b[2]) / 2 - .02, l: lines[i] });
    all.sort(function (a, b) { return b.z - a.z; });
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    for (i = 0; i < all.length; i++) {
      if (all[i].q) {
        var q = all[i].q, c = q.f.c, kk, r, g, b, s2, a0 = pr(q.p[0]), pp;
        if (q.f.fl) { r = c[0]; g = c[1]; b = c[2]; }
        else {
          kk = .3 + .8 * q.I; r = c[0] * kk; g = c[1] * kk; b = c[2] * kk;
          s2 = Math.pow(Math.max(0, q.I - .62) / .38, 2) * .5; r += (GOLD2[0] - r) * s2; g += (GOLD2[1] - g) * s2; b += (GOLD2[2] - b) * s2;
        }
        cx.beginPath(); cx.moveTo(a0[0], a0[1]);
        for (zi = 1; zi < q.p.length; zi++) { pp = pr(q.p[zi]); cx.lineTo(pp[0], pp[1]); }
        cx.closePath();
        cx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; cx.fill();
        if (q.f.e) { cx.lineWidth = .8; cx.strokeStyle = 'rgba(236,220,170,' + q.f.e + ')'; cx.stroke(); }
      } else {
        var L = all[i].l, A = pr(L.a), B = pr(L.b), dz = (L.a[2] + L.b[2]) / 2 - d, al = L.al * Math.max(.2, Math.min(1, 1 - dz * .16));
        cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]);
        cx.lineWidth = o.lw || 1.2; cx.strokeStyle = 'rgba(' + (L.c[0] | 0) + ',' + (L.c[1] | 0) + ',' + (L.c[2] | 0) + ',' + al.toFixed(3) + ')'; cx.stroke();
      }
    }
    this.dirty = false;
  };

  /* ---------- the scenes ---------- */
  function heroObjs() {
    var out = [], tw = tower(28, 4.2, .74, Math.PI * .26), i, cols = [PU2, PU3, PU1, GOLD, PU2, PU3, GOLD, PU1, PU2], pav, ob;
    out.push({ mesh: tw, ry: 0, upd: function (t, o) { o.ry = RM.matches ? 0 : t * .00018; } });
    /* orbit rings */
    out.push({ mesh: ring(2.55, 90, GOLD, .5, 0), rx: .5, upd: function (t, o) { o.ry = t * .00012; o.rz = .15; } });
    out.push({ mesh: ring(3.15, 110, GOLD2, .26, 0), rx: -.35, upd: function (t, o) { o.ry = -t * .00009; o.rz = -.2; } });
    out.push({ mesh: ring(3.6, 120, GOLD, .22, -2.15) });
    /* floating cubes */
    for (i = 0; i < 9; i++) {
      (function (i) {
        var sz = .1 + (i % 3) * .06, R0 = 1.75 + (i % 4) * .28, ph = i * 2.4, sp = .00022 + (i % 3) * .00007, yy = -1.4 + (i * 0.37) % 2.9;
        out.push({ mesh: box(sz, sz, sz, cols[i], .5), upd: function (t, o) {
          var a = ph + (RM.matches ? 0 : t * sp);
          o.x = Math.cos(a) * R0; o.z = Math.sin(a) * R0; o.y = yy + (RM.matches ? 0 : Math.sin(t * .0007 + ph) * .12);
          o.ry = a * 1.6; o.rx = a * .9;
        } });
      })(i);
    }
    /* pavilion: a roof on four columns */
    pav = merge(place(box(.78, .05, .54, PU2, .5), [0, .55, 0], 0), place(box(.05, .3, .05, GOLD, .4), [-.62, .22, -.42], 0), place(box(.05, .3, .05, GOLD, .4), [.62, .22, -.42], 0),
      place(box(.05, .3, .05, GOLD, .4), [-.62, .22, .42], 0), place(box(.05, .3, .05, GOLD, .4), [.62, .22, .42], 0), place(box(.82, .03, .58, PU1, .3), [0, -.1, 0], 0));
    ob = { mesh: pav, s: .85, upd: function (t, o) { var a = 2.2 + (RM.matches ? 0 : t * .00016); o.x = Math.cos(a) * 2.45; o.z = Math.sin(a) * 2.45; o.y = -1.1; o.ry = -a * .9; } };
    out.push(ob);
    return out;
  }
  function doorObjs(k) {
    var out = [], i, j, m;
    if (k === 0) { /* steps: a staircase going up */
      m = { f: [], l: [] };
      for (i = 0; i < 6; i++) m = merge(m, place(box(.9, .1 + i * .13, .22, i % 2 ? PU2 : PU3, .5), [0, -.9 + (.1 + i * .13) , -1.1 + i * .44], 0));
      out.push({ mesh: merge(m, { f: [], l: [{ a: [-.95, -.9, -1.2], b: [-.95, .72, 1.4], c: GOLD, al: .8 }, { a: [.95, -.9, -1.2], b: [.95, .72, 1.4], c: GOLD, al: .8 }] }), s: .78, y: .05, ry: 1.1 });
    } else if (k === 1) { /* stacked cubes */
      m = { f: [], l: [] };
      [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [-1, 0, 0]].forEach(function (p, i) {
        m = merge(m, place(box(.47, .47, .47, i === 3 ? GOLD : i % 2 ? PU3 : PU2, .55), [p[0], p[1] - .45, p[2]], 0));
      });
      out.push({ mesh: m, s: .9 });
    } else if (k === 2) { /* a small twisting tower */
      out.push({ mesh: tower(14, 2.4, .42, Math.PI * .5), y: -.2, s: 1.05 });
    } else { /* a network of nodes */
      m = { f: [], l: [] };
      var pts = [[0, 1.05, 0], [1, .35, .3], [-.9, .3, .55], [.55, -.55, -.85], [-.5, -.7, -.7], [.1, -.15, 1.05], [-.1, .1, -.1]];
      pts.forEach(function (p, i) { m = merge(m, place(box(.15, .15, .15, i === 6 ? GOLD : i % 2 ? PU3 : PU2, .6), p, 0)); });
      for (i = 0; i < pts.length - 1; i++) { m.l.push({ a: pts[i], b: pts[6], c: GOLD, al: .7 }); m.l.push({ a: pts[i], b: pts[(i + 1) % 6], c: GOLD2, al: .35 }); }
      out.push({ mesh: m, s: 1 });
    }
    return out;
  }
  function logoObjs() {
    var u = 175, top = [[-273.5, 351.5], [273.5, 351.5], [0, -.5]].map(function (p) { return [p[0] / u, p[1] / u]; }),
      bot = [[0, .5], [273.5, -351.5], [-273.5, -351.5]].map(function (p) { return [p[0] / u, p[1] / u]; });
    return [{ mesh: merge(prism(top, -.3, .3, GOLD, .6), prism(bot, -.3, .3, PU3, .6)), s: 1, upd: function (t, o) { o.ry = RM.matches ? .5 : Math.sin(t * .0007) * .9 + .3; } }];
  }

  /* ---------- one filter that puts any picture into the palette: shadows black, middle tones purple, highlights gold ---------- */
  function duo() {
    if (document.getElementById('nxduo')) return;
    var n = document.createElement('div');
    n.setAttribute('aria-hidden', 'true'); n.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    n.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" focusable="false"><filter id="nxduo" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values=".33 .59 .11 0 0  .33 .59 .11 0 0  .33 .59 .11 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues="0.03 0.06 0.40 0.93"/><feFuncG type="table" tableValues="0.016 0.02 0.14 0.84"/><feFuncB type="table" tableValues="0.06 0.14 0.78 0.62"/></feComponentTransfer></filter></svg>';
    document.body.appendChild(n);
  }
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
  function addStage(cv, objs, o, key) {
    var st = new Stage(cv, objs, o); st.key = key; stages.push(st);
    if (IO) IO.observe(cv);
    return st;
  }
  function heroStage() {
    var hero = document.querySelector('.hero'); if (!hero) return;
    el.cv = mk('canvas', 'nxc'); el.cv.setAttribute('aria-hidden', 'true'); hero.insertBefore(el.cv, hero.firstChild);
    addStage(el.cv, heroObjs(), {
      d: 8.5,
      center: function (W, H) {
        var mob = W < 760, tab = !mob && W < 900;
        return [(mob || tab) ? W * .5 : W * (rtl() ? .27 : .73), mob ? H * .7 : tab ? H * .74 : H * .55, mob ? Math.min(W * .21, H * .12) : tab ? Math.min(W * .15, H * .1) : Math.min(W * .105, H * .14)];
      },
      yaw: function (t) { return (RM.matches ? .75 : .75 + t * .00012) + (S.px - .5) * 1.5 + (RM.matches ? 0 : (window.pageYOffset || 0) * .0025); },
      pit: function () { return .3 + (RM.matches ? 0 : (S.py - .5) * .22); }
    }, 'hero');
  }
  function doorStages() {
    var rows = document.querySelectorAll('#hm .ixr');
    [].forEach.call(rows, function (r, i) {
      if (r.querySelector('.nxd')) return;
      var cv = mk('canvas', 'nxd'); cv.setAttribute('aria-hidden', 'true'); r.insertBefore(cv, r.firstChild);
      var st = addStage(cv, doorObjs(i), {
        d: 6.5, lw: 1,
        center: function (W, H) { return [W / 2, H / 2 + 4, Math.min(W, H) * .34]; },
        yaw: function (t, s) { s.boost += ((s.hov ? 1 : 0) - s.boost) * .08; return (RM.matches ? .6 : t * .0004 * (1 + s.boost * 3.2)) + .4 + (s.hov ? (S.px - .5) * .8 : 0); },
        pit: function () { return .38; }
      }, 'door');
      r.addEventListener('pointerenter', function () { st.hov = true; kick(); });
      r.addEventListener('pointerleave', function () { st.hov = false; });
      r.addEventListener('focusin', function () { st.hov = true; kick(); });
      r.addEventListener('focusout', function () { st.hov = false; });
    });
  }
  function logoStage() {
    var cta = document.querySelector('#hm .hcta'); if (!cta || cta.querySelector('.nxl')) return;
    var cv = mk('canvas', 'nxl'); cv.setAttribute('aria-hidden', 'true'); cta.insertBefore(cv, cta.firstChild);
    addStage(cv, logoObjs(), {
      d: 7, lw: 1,
      center: function (W, H) { return [W / 2, H / 2, Math.min(W * .2, H * .15)]; },
      yaw: function (t) { return (RM.matches ? 0 : 0) + (S.px - .5) * .9; },
      pit: function () { return .12 + (S.py - .5) * .25; }
    }, 'logo');
  }
  function sweep() {
    stages = stages.filter(function (s) { if (!document.body.contains(s.cv)) { if (IO) IO.unobserve(s.cv); return false; } return true; });
    doorStages(); logoStage();
  }
  function build() {
    if (S.built) return;
    S.built = true; duo();
    var hero = document.querySelector('.hero'), hd = document.querySelector('header .w'), ft = document.querySelector('footer');
    if ('IntersectionObserver' in window) {
      IO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.target === el.mq) { S.mqVis = e.isIntersecting; return; }
          stages.forEach(function (s) { if (s.cv === e.target) { s.vis = e.isIntersecting; if (s.vis) s.dirty = true; } });
        });
        kick();
      }, { rootMargin: '80px' });
    }
    if (hd) {
      el.hud = mk('div', 'nxh', '<i></i><b>BAGHDAD</b><span>33.31°N 44.37°E</span><span class="nxk">--:--:--</span>');
      el.hud.setAttribute('aria-hidden', 'true'); hd.appendChild(el.hud); el.clk = el.hud.querySelector('.nxk');
    }
    heroStage();
    if (hero) {
      var m = mk('div', 'nxm'); m.setAttribute('aria-hidden', 'true');
      el.a = band(names(), 'a'); el.b = band(['DESIGN', 'VISUALIZE', 'TEACH', 'SUPERVISE', 'CRITIQUE', 'BUILD', 'DESIGN', 'VISUALIZE', 'TEACH', 'SUPERVISE', 'CRITIQUE', 'BUILD'], 'b');
      m.appendChild(el.a); m.appendChild(el.b);
      hero.parentNode.insertBefore(m, hero.nextSibling); el.mq = m; if (IO) IO.observe(m);
    }
    if (ft) { el.wm = mk('div', 'nxp', 'X ARCHITECTURE'); el.wm.setAttribute('aria-hidden', 'true'); ft.insertBefore(el.wm, ft.firstChild); }
    sweep();
    var hm = document.getElementById('hm');
    if (hm && window.MutationObserver) { mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(function () { sweep(); kick(); }, 60); }); mo.observe(hm, { childList: true }); }
    addEventListener('resize', function () { stages.forEach(function (s) { s.size(); }); S.bandW = 0; kick(); }, { passive: true });
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

  /* ---------- pointer: glow inside each band, soft tilt on cards ---------- */
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
    for (i = 0; i < ls.length; i++) r.push(ls[i].getBoundingClientRect());
    for (i = 0; i < ls.length; i++) {
      b = r[i];
      if (b.bottom < -50 || b.top > innerHeight + 50) continue;
      ls[i].style.setProperty('--gx', (px - b.left).toFixed(0) + 'px');
      ls[i].style.setProperty('--gy', (py - b.top).toFixed(0) + 'px');
    }
  }
  var TL = null, TSEL = '.g4 .c,.nc,.ixr,.ci';
  function tiltOn(e) {
    if (!FP.matches || RM.matches) return;
    var t = e.target.closest && e.target.closest(TSEL); if (!t || t === TL) return;
    tiltOff(); TL = t; t.style.transition = 'transform .14s ease-out, background .35s'; t.style.willChange = 'transform';
  }
  function tiltOff() {
    if (!TL) return;
    TL.style.transform = ''; TL.style.transition = ''; TL.style.willChange = ''; TL.style.removeProperty('--tx'); TL.style.removeProperty('--ty'); TL.style.removeProperty('--sa');
    TL = null;
  }
  function tiltMove(e) {
    if (!TL) return;
    var r = TL.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { tiltOff(); return; }
    var mx = Math.min(1, 520 / r.width), my = Math.min(1, 320 / r.height);
    TL.style.transform = 'perspective(1100px) rotateX(' + ((.5 - y) * 7 * my).toFixed(2) + 'deg) rotateY(' + ((x - .5) * 9 * mx).toFixed(2) + 'deg) translateZ(0)';
    TL.style.setProperty('--tx', (x * 100).toFixed(1) + '%'); TL.style.setProperty('--ty', (y * 100).toFixed(1) + '%'); TL.style.setProperty('--sa', '.12');
  }
  function onMove(e) {
    if (e.pointerType === 'touch' || !S.on) return;
    S.tx = e.clientX / innerWidth; S.ty = e.clientY / innerHeight;
    if (!S.gl) S.gl = requestAnimationFrame(glow);
    tiltOn(e); tiltMove(e);
    if (!RM.matches) kick();
  }

  /* ---------- loop ---------- */
  function tick(t) {
    S.raf = 0;
    if (!S.on || document.hidden) return;
    S.px += (S.tx - S.px) * .07; S.py += (S.ty - S.py) * .07;
    var any = false, i, s;
    for (i = 0; i < stages.length; i++) {
      s = stages[i];
      if (!s.vis) continue;
      if (!s.W) s.size();
      if (RM.matches) { if (s.dirty) s.draw(t); } else { s.draw(t); any = true; }
    }
    if (S.mqVis) { bands(t); if (!RM.matches) any = true; }
    if (any) S.raf = requestAnimationFrame(tick);
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
      build(); stages.forEach(function (s) { s.size(); }); clock(); clearInterval(clockT); clockT = setInterval(clock, 1000);
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('scroll', kick, { passive: true });
      kick(); setTimeout(scan, 200); setTimeout(scan, 1400); setTimeout(function () { S.bandW = 0; sweep(); stages.forEach(function (s) { s.size(); }); kick(); }, 600);
    } else {
      clearInterval(clockT); if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; tiltOff();
      removeEventListener('pointermove', onMove); removeEventListener('scroll', kick);
      [].forEach.call(document.querySelectorAll('[style*="--gx"]'), function (n) { n.style.removeProperty('--gx'); n.style.removeProperty('--gy'); });
    }
  }
  if (window.MutationObserver) new MutationObserver(sync).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  addEventListener('hashchange', function () { gcache = null; setTimeout(function () { sweep(); scan(); kick(); }, 500); setTimeout(scan, 1500); });
  document.addEventListener('click', function () { if (S.on) { S.bandW = 0; setTimeout(function () { sweep(); scan(); stages.forEach(function (s) { s.size(); }); kick(); }, 300); } }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
