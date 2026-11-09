/* X Assistant 3D: the 3D character of the floating helper (a boy or a girl robot, the visitor chooses).
   A small, soft, glossy flying robot: a big rounded head with a dark screen face (two gold hourglass-X eyes that look around and blink, and a smile that opens when it talks), ear cups like headphones, a small cup-shaped body with a dark collar,
   smooth flipper arms (the left one waves) and no legs: it hovers with a shadow below and leans into the direction when it is carried. The boy has nothing on his head; the girl has a bob and a fringe.
   Built from simple shapes in code, so no model file and no outside asset is needed. It uses a small part of three.js (MIT licence).
   This file is the SOURCE. The page loads the built file  assistant3d.js  (made by  scripts/build_assistant3d.sh, which bundles this source with three.js).
   Public API (window.XAS3D):
     create(canvas, { kind, calm, onLost })  ->  controller, or null when WebGL is not available (the page then keeps its flat 2D figure)
     controller: kind(k) setKind(k, true) spins to the new look, theme(), resize(w,h), look(nx,ny), wave(ms), talk(ms), hop(), drag(on), push(vx), open(on, dir) (dir: -1 left, 1 right = where the chat is), run(on), snap(kind,w,h,'head'|'full'), dispose() */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh,
  SphereGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, CircleGeometry, PlaneGeometry, Shape, ShapeGeometry, ExtrudeGeometry, LatheGeometry, SplineCurve, Vector2,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, HemisphereLight, DirectionalLight, DoubleSide, AdditiveBlending, Color
} from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- colours: the site's own theme variables, so the figure follows dark+gold and light+gold ---------- */
function themeColors() {
  const cs = getComputedStyle(document.documentElement), g = n => (cs.getPropertyValue(n) || '').trim();
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  return { gold: g('--gold') || '#AD9154', gold2: g('--gold2') || '#d6bd7e', ong: g('--ong') || '#0a0a0a', light };
}


/* ---------- shapes ---------- */
function poly(pts) { const s = new Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; }
/* a polygon with softly rounded corners (radius r) */
function roundPoly(pts, r) {
  const s = new Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, da / 2) / da, rb = Math.min(r, db / 2) / db;
    const p1 = [p[0] + (a[0] - p[0]) * ra, p[1] + (a[1] - p[1]) * ra], p2 = [p[0] + (b[0] - p[0]) * rb, p[1] + (b[1] - p[1]) * rb];
    if (i) s.lineTo(p1[0], p1[1]); else s.moveTo(p1[0], p1[1]);
    s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  }
  s.closePath(); return s;
}
function roundRect(w, h, r) { const x = w / 2, y = h / 2; return roundPoly([[-x, -y], [x, -y], [x, y], [-x, y]], r); }
/* a soft block: a rounded rectangle pushed out with a big round bevel, flat in front (the head and the hair) */
function softBlock(w, h, d, r, bev) {
  const g = new ExtrudeGeometry(roundRect(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 18 });
  g.translate(0, 0, -d / 2); return g;
}

/* a smooth solid of revolution from a rough profile: points are [radius, y], from the lowest to the highest */
function lathe(pts, seg) {
  const c = new SplineCurve(pts.map(p => new Vector2(p[0], p[1]))), v = c.getPoints(44);
  v.forEach(p => { p.x = Math.max(0, p.x); });
  return new LatheGeometry(v, seg || 40);
}
const G = {
  sph: new SphereGeometry(1, 40, 28),
  cap: (r, len) => new CapsuleGeometry(r, len, 8, 20),
  plane: new PlaneGeometry(1, 1),
  head: softBlock(.58, .44, .24, .17, .1),
  hair: softBlock(.66, .5, .22, .2, .12),
  screen: new ShapeGeometry(roundRect(.54, .4, .13), 18),
  rim: new ShapeGeometry(roundRect(.575, .435, .145), 18),
  cup: (() => { const g = new CylinderGeometry(.115, .115, .075, 36, 1); g.rotateZ(Math.PI / 2); return g; })(),
  cupRing: (() => { const g = new TorusGeometry(.082, .012, 8, 36); g.rotateY(Math.PI / 2); return g; })(),
  eyeT: new ShapeGeometry(roundPoly([[-.058, .07], [.058, .07], [0, .0]], .014)),
  eyeB: new ShapeGeometry(roundPoly([[0, -.0], [.058, -.07], [-.058, -.07]], .014)),
  smile: (() => { const arc = Math.PI * .72, g = new TorusGeometry(.062, .0085, 8, 28, arc); g.rotateZ(Math.PI + (Math.PI - arc) / 2); g.translate(0, .02, 0); return g; })(),
  mouth: (() => { const g = new CircleGeometry(.05, 24, Math.PI, Math.PI); g.translate(0, -.085, 0); return g; })(),
  /* the body: a small cup that is widest at the shoulders and narrows to a round bottom, with a dark collar band around the top */
  torso: lathe([[0, -.27], [.07, -.262], [.14, -.225], [.2, -.14], [.235, -.03], [.25, .07], [.245, .16], [.215, .235], [.15, .28], [.1, .292]], 44),
  collar: lathe([[.215, .205], [.234, .222], [.228, .245], [.19, .272], [.13, .289], [.09, .293]], 44),
  /* the arms: smooth and tapered like a flipper, thin at the shoulder and wide and rounded at the hand */
  armUp: lathe([[0, -.16], [.045, -.15], [.058, -.1], [.06, -.02], [.055, .03], [.04, .06], [0, .075]], 24),
  armFore: lathe([[0, -.24], [.045, -.228], [.07, -.185], [.082, -.12], [.076, -.055], [.062, -.01], [.05, .03], [.03, .05], [0, .056]], 24),
  wing: (() => { const g = new SphereGeometry(1, 20, 14); return g; })()
};
function mesh(geo, mat, x, y, z, sx, sy, sz) {
  const m = new Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  return m;
}
function std(color, rough, metal) { return new MeshStandardMaterial({ color, roughness: rough == null ? .62 : rough, metalness: metal || 0 }); }

function glowTexture() {                              /* a soft round glow (white, tinted by the material colour) */
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.55, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/* ---------- the figure ---------- */
/* A small flying helper robot, soft and glossy: a big rounded head with a dark screen face (two gold X eyes and a smile), ear cups like headphones, a small cup-shaped body with a dark collar,
   smooth flipper arms, and no legs: it hovers with a shadow below. The boy has nothing on his head; the girl has a bob of hair and a fringe. */
const HOVER = .14, PIV = .55, FZ = .22;
function buildFigure(kind, M) {
  const girl = kind === 'girl', J = {};
  const root = new Group(), fig = new Group(), body = new Group(), rig = new Group();
  root.add(fig); fig.add(body); body.position.y = PIV; body.add(rig); rig.position.y = -PIV;
  J.root = root; J.fig = fig; J.body = body;

  /* the body, a cup with a dark collar */
  const torso = new Group(); torso.position.y = .5; rig.add(torso); J.torso = torso;
  const tb = new Mesh(G.torso, M.pearl); tb.scale.z = .88; torso.add(tb);
  const tc = new Mesh(G.collar, M.shell); tc.scale.z = .88; torso.add(tc);

  /* arms: smooth flippers with no joints showing; the left one (on the viewer's left) waves */
  [-1, 1].forEach(s => {
    const arm = new Group(); arm.position.set(s * .225, .66, 0); rig.add(arm);
    arm.add(new Mesh(G.armUp, M.pearl));
    const fore = new Group(); fore.position.y = -.15; arm.add(fore);
    fore.add(new Mesh(G.armFore, M.pearl));
    if (s < 0) { J.armL = arm; J.foreL = fore; } else { J.armR = arm; J.foreR = fore; }
  });

  /* neck and head (the neck pivot is at the base of the head) */
  const neck = new Group(); neck.position.y = .85; rig.add(neck); J.neck = neck;
  neck.add(mesh(G.sph, M.shell, 0, -.05, 0, .085, .09, .085));
  const head = new Group(); head.position.y = .32; neck.add(head); J.head = head;
  head.add(new Mesh(G.head, M.pearl));
  head.add(mesh(G.rim, M.gold, 0, 0, FZ + .001));
  head.add(mesh(G.screen, M.glass, 0, 0, FZ + .0025));
  const glow = mesh(G.plane, M.glow, 0, .02, FZ + .0045, .52, .3, 1); head.add(glow); J.glow = glow;
  [-1, 1].forEach(s => {                                                                  /* two X eyes: the platform's hourglass X, one on each side */
    const eye = new Group(); eye.position.set(s * .135, .045, FZ + .007); head.add(eye);
    const t = mesh(G.eyeT, M.xmark, 0, .004, 0), b = mesh(G.eyeB, M.xmark, 0, -.004, 0); eye.add(t, b);
    if (s < 0) { J.eyeL = eye; J.eyeLt = t; J.eyeLb = b; } else { J.eyeR = eye; J.eyeRt = t; J.eyeRb = b; }
  });
  const sm = mesh(G.smile, M.xmark, 0, -.09, FZ + .007); head.add(sm); J.smile = sm;
  const mo = mesh(G.mouth, M.xmark, 0, 0, FZ + .0072); mo.scale.y = 0; head.add(mo); J.mouth = mo;
  [-1, 1].forEach(s => {                                                                  /* ear cups, like headphones */
    const cup = new Group(); cup.position.set(s * .405, -.01, 0); head.add(cup);
    cup.add(new Mesh(G.cup, M.shell));
    cup.add(mesh(G.cupRing, M.gold, s * .04, 0, 0));
  });

  if (girl) {
    /* hair: a rounded bob behind the face, a parted fringe and two side locks */
    head.add(mesh(G.hair, M.hair, 0, .075, -.075));
    [-1, 1].forEach(s => {
      const fr = mesh(G.sph, M.hair, s * .125, .285, .15, .2, .075, .1); fr.rotation.z = s * -.2; head.add(fr);
      const lock = mesh(G.cap(.07, .2), M.hair, s * .405, -.2, -.05); lock.rotation.z = s * .08; head.add(lock);
    });
  }
  return J;
}

/* ---------- the controller ---------- */
function create(canvas, o) {
  o = o || {};
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene(), cam = new PerspectiveCamera(26, .7, .1, 40);
  scene.add(new HemisphereLight(0xffffff, 0x8a7a62, 1.05));
  const key = new DirectionalLight(0xfff0dc, 1.9); key.position.set(2.6, 4, 5); scene.add(key);
  const fill = new DirectionalLight(0xc9d8ff, .55); fill.position.set(-4, 1.5, 3); scene.add(fill);
  const rimA = new DirectionalLight(0xe6cd8a, 1.5); rimA.position.set(-3, 3, -4); scene.add(rimA);
  const rimB = new DirectionalLight(0xe6cd8a, 1.0); rimB.position.set(3.5, 2, -3); scene.add(rimB);

  /* materials (shared by the two figures); colours are filled by theme() */
  const M = {
    pearl: new MeshPhysicalMaterial({ color: '#f8f6f1', roughness: .34, metalness: 0, clearcoat: .7, clearcoatRoughness: .25 }),
    hair: std('#6b4529', .42, .05),
    gold: std('#d6bd7e', .38, .3),
    shell: std('#2a2724', .35, .4), glass: std('#050505', .12, .6),
    xmark: new MeshBasicMaterial({ color: 0xe6cd8a, side: DoubleSide }),
    glow: new MeshBasicMaterial({ map: glowTexture(), color: 0xd6bd7e, transparent: true, opacity: .4, blending: AdditiveBlending, depthWrite: false })
  };
  let light = false;
  function theme() {
    const c = themeColors(), X = new Color(c.gold), hsl = {}; X.getHSL(hsl, SRGBColorSpace); X.setHSL(hsl.h, Math.min(.72, hsl.s + .22), .64, SRGBColorSpace);   /* a brighter tone of the theme gold: the screen is black in both themes */
    M.gold.color.set(c.gold2);
    M.xmark.color.copy(X); M.glow.color.set(c.gold); light = c.light;
  }
  const shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.5, 32), shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .004; scene.add(shadow);

  const figs = { boy: buildFigure('boy', M), girl: buildFigure('girl', M) };
  scene.add(figs.boy.root, figs.girl.root);
  let kind = o.kind === 'girl' ? 'girl' : 'boy', J = figs[kind];
  figs.boy.root.visible = kind === 'boy'; figs.girl.root.visible = kind === 'girl';
  theme();

  /* ---- state ---- */
  const st = {
    lx: 0, ly: 0, ex: 0, ey: 0, bl: 0, wv: 0, wt: 0, tk: 0, dg: 0, dvx: 0, hopY: 0, hvy: 0, sq: 0, sqv: 0, spinY: 0, fl: 0, open: 0, idle: o.calm ? 0 : 1
  };
  const L = { px: 0, py: 0, seen: -99, gx: 0, gy: 0, gUntil: 0, gNext: 4 };
  const Wv = { t: -1, dur: 2.4 }, Tk = { until: 0 }, Sp = { t: -1, swapped: false, to: kind }, Dg = { on: false, vx: 0 }, Bk = { next: 2.5, t: -1 };
  let T = 0, last = 0, raf = 0, running = false, openT = 0, openDir = 0, w = 112, h = 128, dead = false;
  const calm = !!o.calm;

  function fit(aspect, vh, vw, cy) {
    const tf = Math.tan(cam.fov * Math.PI / 360), d = Math.max((vh / 2) / tf, (vw / 2 / aspect) / tf);
    cam.aspect = aspect; cam.position.set(0, cy + .16, d); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  }
  function resize(cw, ch) {
    w = Math.max(40, Math.round(cw || w)); h = Math.max(60, Math.round(ch || h));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    fit(w / h, 2.08, 1.45, .92);
  }
  resize(o.w || 112, o.h || 128);

  /* ---- the pose: every joint is computed from the state, so it is always consistent ---- */
  function pose(s, tt, JJ) {
    const A = s.idle, wv = s.wv, dg = s.dg, tk = s.tk, jy = s.hopY;
    const bob = Math.sin(tt * 2.0) * .03 * A, lift = jy * .6 + dg * .05;
    JJ.root.position.y = jy * .6; JJ.root.rotation.y = -.2 + s.spinY;
    JJ.fig.position.y = HOVER + bob + dg * .05;
    JJ.fig.scale.set(1 - s.sq * .3, 1 + s.sq * .55, 1 - s.sq * .3);
    JJ.body.rotation.z = -s.dvx * .35 * dg + Math.sin(tt * .8) * .03 * A;
    JJ.body.rotation.x = wv * .05 + dg * .14 + Math.sin(tt * 1.1) * .015 * A;
    JJ.body.rotation.y = s.lx * .2 * (1 - dg * .6);
    const br = Math.sin(tt * 2.2) * A;
    JJ.torso.scale.set(1 + .01 * br, 1 + .015 * br, 1 + .01 * br);
    const yaw = s.lx * .8 + .2 * (1 - Math.abs(s.lx)), pitch = s.ly * .3;
    JJ.neck.rotation.set(pitch * .4, yaw * .35, 0);
    JJ.head.rotation.set(pitch * .6 + tk * .03 * Math.sin(tt * 7) + wv * .03, yaw * .55, -wv * .1 - s.dvx * .12 * dg + Math.sin(tt * 1.3) * .02 * A);
    /* the face: two X eyes that look around, blink and flip like a coin when it waves; a smile that opens like a mouth while it talks */
    const m = Math.max(tk * (.25 + .75 * Math.abs(Math.sin(tt * 12.5) * Math.sin(tt * 5.3 + 1))), wv * .35);
    const ez = (1 - .95 * s.bl) * (1 - .15 * m) * (1 + .1 * dg);
    [JJ.eyeL, JJ.eyeR].forEach((e, i) => { e.position.x = (i ? 1 : -1) * .135 + s.ex * .03; e.position.y = .045 - s.ey * .03; e.scale.set(1 + .06 * dg, ez, 1); e.rotation.y = s.fl; });
    JJ.smile.position.x = s.ex * .03; JJ.smile.position.y = -.09 - s.ey * .02; JJ.smile.scale.set(1 + .12 * wv + .1 * dg, 1 + .3 * wv, 1); JJ.smile.visible = m < .16;
    JJ.mouth.position.x = s.ex * .03; JJ.mouth.position.y = -s.ey * .02; JJ.mouth.scale.y = Math.max(.001, m * 1.15); JJ.mouth.visible = m >= .16;
    JJ.glow.material.opacity = .3 + .08 * Math.sin(tt * 1.6) * A + .2 * m + .12 * wv + .1 * dg;
    /* arms: a small swing at rest, out to the sides when it is carried; the left one (on the viewer's left) waves */
    const sw = Math.sin(tt * 1.7) * .03 * A, fl = Math.sin(tt * 9) * dg * .3;
    JJ.armR.rotation.set(-.05 * dg, 0, .2 + sw + dg * .55 - fl);
    JJ.armL.rotation.set(-.3 * wv - .05 * dg, 0, -(.2 - sw + dg * .55 + fl + wv * 2.1));
    JJ.foreR.rotation.set(-.1 + dg * .2, 0, .05 + dg * .2);
    JJ.foreL.rotation.set(-.1 + wv * .15 + dg * .2, 0, -(dg * .2 + wv * (.3 + .45 * Math.sin(s.wt * 9.5))));
    /* the shadow on the ground shrinks as it rises */
    shadow.position.y = .004; const sc = 1 - clamp(lift, 0, .5) * 1.1 - bob * 1.2; shadow.scale.set(sc, sc, sc); shadowMat.opacity = (light ? .5 : .85) * (.55 + .45 * sc);
  }

  /* ---- time step ---- */
  function step(dt) {
    T += dt;
    const k = (r) => 1 - Math.exp(-dt * r);
    /* where it looks: the pointer while it moves, a glance around when it has been still, the visitor when the chat is open */
    let tx = 0, ty = 0;
    if (openT) { tx = openDir * .75; ty = -.05; }
    else if (T - L.seen < 3.4) { tx = L.px; ty = L.py; }
    else if (!calm) {
      if (T > L.gNext) { const a = Math.random(); L.gx = a < .4 ? rnd(.55, 1) : a < .8 ? rnd(-1, -.55) : rnd(-.2, .2); L.gy = rnd(-.25, .15); L.gUntil = T + rnd(1.0, 1.8); L.gNext = T + rnd(3.6, 7.5); }
      if (T < L.gUntil) { tx = L.gx; ty = L.gy; }
    }
    st.ex += (tx - st.ex) * k(16); st.ey += (ty - st.ey) * k(16);
    st.lx += (tx - st.lx) * k(openT ? 5 : 4.2); st.ly += (ty - st.ly) * k(4.2);
    /* blink */
    if (!calm) { if (Bk.t < 0 && T > Bk.next) { Bk.t = 0; } if (Bk.t >= 0) { Bk.t += dt; st.bl = Math.sin(clamp(Bk.t / .15, 0, 1) * Math.PI); if (Bk.t > .15) { Bk.t = -1; st.bl = 0; Bk.next = T + rnd(2.4, 5.8); } } }
    /* wave */
    if (Wv.t >= 0) {
      Wv.t += dt; const p = Wv.t / Wv.dur;
      st.wv = sstep(0, .14, p) * (1 - sstep(.82, 1, p)); st.wt += dt * (calm ? 0 : 1);
      st.fl = calm ? 0 : TAU * sstep(.1, .42, p);                                   /* the X turns right round, like a coin, as a hello */
      if (Wv.t >= Wv.dur) { Wv.t = -1; st.wv = 0; st.fl = 0; }
    }
    /* talk */
    st.tk += ((T < Tk.until ? 1 : 0) - st.tk) * k(14);
    /* carried */
    st.dg += ((Dg.on ? 1 : 0) - st.dg) * k(11); Dg.vx *= Math.exp(-dt * 6); st.dvx += (clamp(Dg.vx, -1, 1) - st.dvx) * k(12);
    /* hop and squash spring */
    if (st.hopY > 0 || st.hvy !== 0) { st.hvy -= 15 * dt; st.hopY += st.hvy * dt; if (st.hopY <= 0) { st.sqv -= clamp(-st.hvy, 0, 3) * 1.1; st.hopY = 0; st.hvy = 0; } }
    st.sqv += (-120 * st.sq - 13 * st.sqv) * dt; st.sq += st.sqv * dt;
    /* the spin when the look changes */
    if (Sp.t >= 0) {
      Sp.t += dt; const p = Sp.t / .85;
      st.spinY = sstep(0, 1, p) * TAU;
      if (p >= .5 && !Sp.swapped) { setKind(Sp.to, false); Sp.swapped = true; }
      if (p >= 1) { Sp.t = -1; st.spinY = 0; }
    }
    st.open += ((openT ? 1 : 0) - st.open) * k(8);
  }
  function settled() {
    return calm && Wv.t < 0 && T > Tk.until + .3 && !Dg.on && st.dg < .01 && Math.abs(st.sq) < .004 && st.hopY === 0 && Sp.t < 0 && Math.abs(st.lx) < .01;
  }
  function busy() {
    return T - L.seen < 3.6 || Wv.t >= 0 || T < Tk.until + .6 || Dg.on || st.dg > .01 || Sp.t >= 0 || st.hopY > 0 || Math.abs(st.sq) > .004 || openT;
  }
  function frame(now) {
    raf = 0; if (!running || dead) return;
    const el = last ? now - last : 16;
    if (last && el < 32 && !busy()) { raf = requestAnimationFrame(frame); return; }      /* nothing is happening: about 30 frames a second is plenty */
    const dt = last ? Math.min(.05, el / 1000) : .016; last = now;
    step(dt); pose(st, T, J); renderer.render(scene, cam);
    if (calm ? !settled() : (T - lastUser < 120 || busy())) raf = requestAnimationFrame(frame); else last = 0;   /* after 2 quiet minutes it sleeps until the visitor does something */
  }
  let lastUser = 0;
  function kick() { lastUser = T; if (running && !raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } }

  function setKind(k, spin) {
    if (k !== 'boy' && k !== 'girl') return;
    if (spin && k !== kind) { Sp.to = k; Sp.t = 0; Sp.swapped = false; st.hvy = 2.2; kick(); return; }
    kind = k; J = figs[k]; figs.boy.root.visible = k === 'boy'; figs.girl.root.visible = k === 'girl';
    pose(st, T, J); if (!running) renderer.render(scene, cam);
  }

  /* a still picture of a figure (for the chat's avatar and the choose-a-look buttons) */
  function snap(k, sw, sh, mode) {
    const keep = { k: kind, pr: renderer.getPixelRatio(), cw: w, ch: h, a: cam.aspect, pos: cam.position.clone() };
    const fi = figs[k]; figs.boy.root.visible = k === 'boy'; figs.girl.root.visible = k === 'girl';
    const ns = { lx: 0, ly: 0, ex: 0, ey: 0, bl: 0, wv: 0, wt: 0, tk: 0, dg: 0, dvx: 0, hopY: 0, hvy: 0, sq: 0, sqv: 0, spinY: 0, fl: 0, open: 0, idle: 0 };
    pose(ns, 0, fi); renderer.setPixelRatio(1); renderer.setSize(sw, sh, false);
    if (mode === 'head') fit(sw / sh, 1.05, 1.0, 1.3); else fit(sw / sh, 2.0, 1.45, .88);
    renderer.render(scene, cam);
    const url = canvas.toDataURL('image/png');
    figs.boy.root.visible = keep.k === 'boy'; figs.girl.root.visible = keep.k === 'girl';
    renderer.setPixelRatio(keep.pr); renderer.setSize(keep.cw, keep.ch, false); fit(keep.cw / keep.ch, 2.08, 1.45, .92);
    pose(st, T, J); renderer.render(scene, cam);
    return url;
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); dead = true; if (o.onLost) o.onLost(); });
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => { theme(); if (!running) { pose(st, T, J); renderer.render(scene, cam); } }) : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  pose(st, 0, J); renderer.render(scene, cam);
  return {
    kind: () => kind, setKind, theme, resize,
    look(nx, ny) { L.px = clamp(nx, -1, 1); L.py = clamp(ny, -1, 1); L.seen = T; kick(); },
    wave(ms) { Wv.dur = Math.max(1.2, (ms || 2400) / 1000); Wv.t = 0; kick(); },
    talk(ms) { Tk.until = T + (ms || 1500) / 1000; kick(); },
    hop() { st.hvy = 2.5; kick(); },
    drag(on) { if (Dg.on && !on) st.sqv -= 1.9; Dg.on = !!on; kick(); },
    push(vx) { Dg.vx = clamp(vx / 30, -1, 1); kick(); },
    open(on, dir) { openT = on ? 1 : 0; openDir = on ? clamp(dir || 0, -1, 1) : 0; kick(); },
    run(on) { running = !!on; if (running) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    snap,
    advance(sec) { const n = Math.max(1, Math.round(sec * 60)); for (let i = 0; i < n; i++) step(1 / 60); pose(st, T, J); renderer.render(scene, cam); },
    state: () => ({ wave: st.wv, talk: st.tk, look: [st.lx, st.ly], drag: st.dg, kind }),
    dispose() { dead = true; running = false; if (raf) cancelAnimationFrame(raf); if (mo) mo.disconnect(); renderer.dispose(); }
  };
}

export { create };
