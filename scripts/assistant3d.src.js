/* X Assistant 3D: the full-body 3D character of the floating helper (a boy or a girl, the visitor chooses).
   A short, sharp-edged figure. Its head is a glass screen with two eyes and the platform's gold hourglass X: the eyes look and blink, the X talks and flips when it waves; the same X is a badge on its belly. The boy has a hook antenna, the girl has a bob, a bow and lashes.
   Built from simple shapes in code, so no model file and no outside asset is needed. It uses a small part of three.js (MIT licence).
   This file is the SOURCE. The page loads the built file  assistant3d.js  (made by  scripts/build_assistant3d.sh, which bundles this source with three.js).
   Public API (window.XAS3D):
     create(canvas, { kind, calm, onLost })  ->  controller, or null when WebGL is not available (the page then keeps its flat 2D figure)
     controller: kind(k) setKind(k, true) spins to the new look, theme(), resize(w,h), look(nx,ny), wave(ms), talk(ms), hop(), drag(on), push(vx), open(on, dir) (dir: -1 left, 1 right = where the chat is), run(on), snap(kind,w,h,'head'|'full'), dispose() */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh,
  SphereGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, CircleGeometry, PlaneGeometry, Shape, ShapeGeometry, ExtrudeGeometry, Vector2, Vector3, BoxGeometry, OctahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, HemisphereLight, DirectionalLight, DoubleSide, AdditiveBlending, Color
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

/* ---------- shared geometry ---------- */
const G = {
  sph: new SphereGeometry(1, 36, 26),
  cap: (r, len) => new CapsuleGeometry(r, len, 8, 20),
  plane: new PlaneGeometry(1, 1),
  box: new BoxGeometry(1, 1, 1),
  dia: new OctahedronGeometry(1, 0),
  slab: prism(chamfer(.56, .5, .06), .22, .035),
  glass: new ShapeGeometry(chamfer(.5, .44, .04)),
  panel: prism(chamfer(.27, .27, .06), .02, .01),
  torso: prism(poly([[-.2, -.12], [.2, -.12], [.275, -.03], [.285, .42], [.215, .6], [.08, .66], [-.08, .66], [-.215, .6], [-.285, .42], [-.275, -.03]]), .34, .025),
  eyeL: new ShapeGeometry(poly([[-.04, -.065], [.04, -.06], [.04, .06], [-.02, .07], [-.04, .05]])),
  eyeR: new ShapeGeometry(poly([[-.04, -.06], [.04, -.065], [.04, .05], [.02, .07], [-.04, .06]])),
  eyeGL: new ShapeGeometry(poly([[-.045, -.07], [.045, -.065], [.045, .065], [-.02, .075], [-.045, .055]])),
  eyeGR: new ShapeGeometry(poly([[-.045, -.065], [.045, -.07], [.045, .055], [.02, .075], [-.045, .065]])),
  shoe: (() => { const g = new ExtrudeGeometry(poly([[-.11, 0], [.2, 0], [.2, .04], [.12, .095], [.02, .12], [-.11, .12]]), { depth: .17, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }); g.translate(0, 0, -.085); g.rotateY(-Math.PI / 2); return g; })(),
  band: (() => { const g = new CylinderGeometry(.068, .068, .035, 4, 1); g.rotateY(Math.PI / 4); return g; })(),
  hexDisc: new CylinderGeometry(.09, .09, .05, 6, 1),
  bob: prism(poly([[-.375, .36], [.375, .36], [.375, -.18], [.29, -.33], [-.29, -.33], [-.375, -.18]]), .17, .02),
  fringe: prism(poly([[-.335, .34], [.335, .34], [.335, .262], [.16, .285], [-.335, .245]]), .04, .016),
  wing: prism(poly([[0, 0], [.13, .08], [.13, -.08]]), .02, .01),
  triTop: (() => { const s = new Shape(); s.moveTo(-.16, .165); s.lineTo(.16, .165); s.lineTo(0, 0); s.closePath(); return new ShapeGeometry(s); })(),
  triBot: (() => { const s = new Shape(); s.moveTo(0, 0); s.lineTo(.16, -.165); s.lineTo(-.16, -.165); s.closePath(); return new ShapeGeometry(s); })()
};

/* a square tapered limb piece, rt at the top and rb at the bottom */
function limb(rt, rb, len) { const g = new CylinderGeometry(rt * 1.38, rb * 1.38, len, 4, 1); g.rotateY(Math.PI / 4); return g; }
function poly(pts) { const s = new Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; }
function chamfer(w, h, c) { const x = w / 2, y = h / 2; return poly([[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]]); }
/* a flat shape pushed out into a block with sharp bevelled edges, centred front to back */
function prism(shape, depth, bev) { const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g; }
function mesh(geo, mat, x, y, z, sx, sy, sz) {
  const m = new Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  return m;
}
function std(color, rough, metal) { return new MeshStandardMaterial({ color, roughness: rough == null ? .62 : rough, metalness: metal || 0 }); }

function glowTexture() {                              /* a soft round glow behind the X on the screen (white, tinted by the material colour) */
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
/* a small, sharp-edged "screen bot": a big chamfered screen for a head (two eyes and the X on it), an angular body with the X badge on its belly, short legs with wedge sneakers.
   The boy has an angular hook antenna and hexagonal ear discs; the girl has a sharp bob with a swept fringe, side strands, a gold bow and lashes. */
function bar(a, b, r, mat) {                          /* a square rod between two points (for the hook antenna) */
  const A = new Vector3(a[0], a[1], a[2]), B = new Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), len = d.length();
  const g = new CylinderGeometry(r * 1.41, r * 1.41, len, 4, 1); g.rotateY(Math.PI / 4);
  const m = new Mesh(g, mat); m.position.copy(A.clone().add(B).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()); return m;
}
function buildFigure(kind, M) {
  const girl = kind === 'girl', J = {};
  const root = new Group(), body = new Group(); root.add(body);
  J.root = root; J.body = body;
  const FZ = .145;                                                                     /* the front of the screen slab */

  /* legs: short and square-cut, wedge sneakers with gold soles (hips at y = .54) */
  const hip = new Group(); hip.position.y = .54; body.add(hip); J.hip = hip;
  [-1, 1].forEach(s => {
    const leg = new Group(); leg.position.set(s * .118, 0, 0); hip.add(leg);
    leg.add(mesh(limb(.092, .074, .24), M.pants, 0, -.12, 0));
    const shin = new Group(); shin.position.y = -.24; leg.add(shin);
    shin.add(mesh(G.box, M.pants, 0, 0, 0, .135, .13, .135));
    shin.add(mesh(limb(.074, .064, .2), M.pants, 0, -.1, 0));
    shin.add(mesh(G.shoe, M.shoe, 0, -.262, 0));
    shin.add(mesh(G.box, M.sole, 0, -.275, .04, .19, .03, .31));
    if (s < 0) { J.legL = leg; J.shinL = shin; } else { J.legR = leg; J.shinR = shin; }
  });
  if (girl) {
    const sk = new Mesh(new CylinderGeometry(.25, .4, .27, 8, 1, true), M.skirt); sk.position.y = .015; sk.rotation.y = Math.PI / 8; sk.material.side = DoubleSide; hip.add(sk);
    const hem = new Mesh(new TorusGeometry(.4, .014, 4, 8), M.gold); hem.rotation.set(Math.PI / 2, 0, Math.PI / 8); hem.position.y = -.12; hip.add(hem);
    J.skirt = sk;
  }

  /* torso (waist y = .62): a cut body, broad shoulders, flat front with a dark badge carrying the X */
  const torso = new Group(); torso.position.y = .62; body.add(torso); J.torso = torso;
  torso.add(new Mesh(G.torso, M.shirt));
  const belt = mesh(G.box, M.shirt2, 0, .02, 0, .59, .05, .4); torso.add(belt);
  const pn = new Mesh(G.panel, M.shell); pn.position.set(0, .25, .197); torso.add(pn);
  const bx = new Group(); bx.position.set(0, .25, .2205); bx.scale.setScalar(.56); torso.add(bx);
  bx.add(mesh(G.triTop, M.xmark, 0, .014, 0), mesh(G.triBot, M.xmark, 0, -.014, 0)); J.badge = bx;

  /* arms: square sleeves with a gold wrist band and a blocky light hand */
  [-1, 1].forEach(s => {
    const arm = new Group(); arm.position.set(s * .335, .49, 0); torso.add(arm);
    arm.add(mesh(G.box, M.shirt, 0, 0, 0, .13, .13, .13));
    arm.add(mesh(limb(.07, .058, .2), M.shirt, 0, -.1, 0));
    const fore = new Group(); fore.position.y = -.2; arm.add(fore);
    fore.add(mesh(G.box, M.shirt, 0, 0, 0, .108, .108, .108));
    fore.add(mesh(limb(.058, .05, .15), M.shirt, 0, -.075, 0));
    fore.add(mesh(G.band, M.shirt2, 0, -.15, 0));
    fore.add(mesh(G.box, M.hand, 0, -.2, 0, .118, .12, .1));
    if (s < 0) { J.armL = arm; J.foreL = fore; } else { J.armR = arm; J.foreR = fore; }
  });

  /* neck and head (neck base at y = 1.27) */
  const neck = new Group(); neck.position.y = 1.27; body.add(neck); J.neck = neck;
  neck.add(mesh(limb(.062, .07, .14), M.pants, 0, .02, 0));
  const head = new Group(); head.position.y = .42; head.scale.setScalar(1.55); neck.add(head); J.head = head;

  /* the head is a screen: a chamfered slab of graphite with a black glass front. Two eyes and the gold hourglass X light up on it */
  head.add(new Mesh(G.slab, M.shell));
  const glass = new Mesh(G.glass, M.glass); glass.position.z = FZ + .0015; head.add(glass);
  const glow = new Mesh(G.plane, M.glow); glow.position.set(0, 0, FZ + .0045); glow.scale.set(.58, .52, 1); head.add(glow); J.glow = glow;
  [-1, 1].forEach(s => {
    const eye = new Group(); eye.position.set(s * .195, .03, FZ + .007); head.add(eye);
    eye.add(new Mesh(s < 0 ? (girl ? G.eyeGL : G.eyeL) : (girl ? G.eyeGR : G.eyeR), M.xmark));
    if (girl) [0, 1].forEach(i => {                                                  /* two sharp lashes on the outer corner */
      const l = mesh(G.plane, M.xmark, s * (.05 + i * .01), .07 + i * .016, 0, .06, .012, 1); l.rotation.z = s * (.6 + i * .35); eye.add(l);
    });
    if (s < 0) J.eyeL = eye; else J.eyeR = eye;
  });
  const xe = new Group(); xe.position.set(0, 0, FZ + .007); head.add(xe); J.xe = xe;
  const xt = new Group(), xb = new Group(); xe.add(xt, xb); J.xt = xt; J.xb = xb;
  xt.add(new Mesh(G.triTop, M.xmark)); xb.add(new Mesh(G.triBot, M.xmark));

  if (girl) {
    /* hair: a sharp bob behind the screen, a swept fringe above it, tapered side strands, and a gold bow */
    head.add(mesh(G.bob, M.hair, 0, 0, -.115));
    head.add(mesh(G.fringe, M.hair, 0, 0, .12));
    [-1, 1].forEach(s => { const st = mesh(limb(.05, .02, .3), M.hair, s * .345, -.03, .1); st.rotation.z = s * .05; head.add(st); });
    const bow = new Group(); bow.position.set(-.2, .45, -.03); bow.rotation.z = .2; head.add(bow); J.tailL = bow;
    [-1, 1].forEach(s => { const wg = new Mesh(G.wing, M.gold); wg.scale.x = s; bow.add(wg); });
    bow.add(mesh(G.dia, M.gold, 0, 0, 0, .05, .05, .05));
  } else {
    /* the boy: an angular gold hook antenna with a bright diamond tip, and hexagonal gold ear discs */
    const hk = new Group(); hk.position.set(0, .3, -.02); head.add(hk); J.hook = hk;
    hk.add(mesh(G.box, M.gold, 0, 0, 0, .08, .05, .08));
    const P = [[0, .02, 0], [0, .21, 0], [.095, .285, 0], [.175, .21, 0], [.175, .13, 0]];
    for (let i = 0; i < P.length - 1; i++) hk.add(bar(P[i], P[i + 1], .017, M.gold));
    for (let i = 1; i < P.length - 1; i++) hk.add(mesh(G.box, M.gold, P[i][0], P[i][1], 0, .036, .036, .036));
    hk.add(mesh(G.dia, M.xmark, P[4][0], P[4][1] - .03, 0, .042, .055, .042));
    [-1, 1].forEach(s => { const ed = mesh(G.hexDisc, M.gold, s * .35, -.01, -.01); ed.rotation.z = Math.PI / 2; head.add(ed); });
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
  scene.add(new HemisphereLight(0xffffff, 0x8a7a62, 1.5));
  const key = new DirectionalLight(0xfff0dc, 2.6); key.position.set(2.6, 4, 5); scene.add(key);
  const fill = new DirectionalLight(0xc9d8ff, .55); fill.position.set(-4, 1.5, 3); scene.add(fill);
  const rimA = new DirectionalLight(0xe6cd8a, 1.5); rimA.position.set(-3, 3, -4); scene.add(rimA);
  const rimB = new DirectionalLight(0xe6cd8a, 1.0); rimB.position.set(3.5, 2, -3); scene.add(rimB);

  /* materials (shared by the two figures); colours are filled by theme() */
  const M = {
    hair: std('#4a3322', .48), hand: std('#e3d6bb', .62),
    shirt: std('#AD9154', .55, .08), shirt2: std('#d6bd7e', .5, .1), pants: std('#2a2620', .7), skirt: std('#2a2620', .7), shoe: std('#e8dfcb', .55), sole: std('#d6bd7e', .6),
    gold: std('#d6bd7e', .4, .25),
    shell: std('#1d1b19', .32, .45), glass: std('#050505', .1, .65),
    xmark: new MeshBasicMaterial({ color: 0xe6cd8a, side: DoubleSide }),
    glow: new MeshBasicMaterial({ map: glowTexture(), color: 0xd6bd7e, transparent: true, opacity: .5, blending: AdditiveBlending, depthWrite: false })
  };
  let light = false;
  function theme() {
    const c = themeColors(), X = new Color(c.gold), hsl = {}; X.getHSL(hsl, SRGBColorSpace); X.setHSL(hsl.h, Math.min(.72, hsl.s + .22), .64, SRGBColorSpace);   /* a brighter tone of the theme gold: the glass is black in both themes */
    M.shirt.color.set(c.gold); M.shirt2.color.set(c.gold2); M.sole.color.set(c.gold2); M.gold.color.set(c.gold2);
    M.xmark.color.copy(X); M.glow.color.set(c.gold); light = c.light;        /* the X is always bright on the dark glass */
  }
  const shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.56, 32), shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .004; scene.add(shadow);

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
  let T = 0, last = 0, raf = 0, running = false, openT = 0, openDir = 0, w = 120, h = 172, dead = false;
  const calm = !!o.calm;

  function fit(aspect, vh, vw, cy) {
    const tf = Math.tan(cam.fov * Math.PI / 360), d = Math.max((vh / 2) / tf, (vw / 2 / aspect) / tf);
    cam.aspect = aspect; cam.position.set(0, cy + .16, d); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  }
  function resize(cw, ch) {
    w = Math.max(40, Math.round(cw || w)); h = Math.max(60, Math.round(ch || h));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    fit(w / h, 2.96, 1.84, 1.37);
  }
  resize(o.w || 120, o.h || 172);

  /* ---- the pose: every joint is computed from the state, so it is always consistent ---- */
  function pose(s, tt, JJ) {
    const A = s.idle, br = Math.sin(tt * 2.2) * A, wv = s.wv, dg = s.dg, tk = s.tk;
    const ry = -.2 + s.spinY, jy = s.hopY + dg * .1;
    JJ.root.position.y = jy; JJ.root.rotation.y = ry;
    JJ.root.scale.set(1 - s.sq * .45, 1 + s.sq, 1 - s.sq * .45);
    JJ.body.rotation.z = -s.dvx * .2 * dg + Math.sin(tt * .8) * .018 * A;
    JJ.body.rotation.y = s.lx * .22 * (1 - dg * .6);
    JJ.body.rotation.x = wv * .04 + dg * .05;
    JJ.torso.scale.set(1 + .008 * br, 1 + .015 * br, 1 + .008 * br);
    JJ.torso.rotation.y = -wv * .1;
    const yaw = s.lx * .8 + .2 * (1 - Math.abs(s.lx)), pitch = s.ly * .3;
    JJ.neck.rotation.set(pitch * .35, yaw * .4, 0);
    JJ.head.rotation.set(pitch * .7 + tk * .035 * Math.sin(tt * 7) + wv * .03, yaw * .6, -wv * .09 - s.dvx * .1 * dg);
    /* the face: two eyes that look around and blink, and the X below them that opens like a mouth while it talks and flips like a coin when it waves */
    const m = tk * (.25 + .75 * Math.abs(Math.sin(tt * 12.5) * Math.sin(tt * 5.3 + 1)));
    const xs = (1 + .08 * m + .1 * dg + .05 * wv) * .76;
    JJ.xe.position.x = s.ex * .05; JJ.xe.position.y = -s.ey * .03 + .003 * Math.sin(tt * 1.3) * A;
    JJ.xe.scale.set(xs, xs, 1);
    JJ.xe.rotation.set(0, s.fl, -s.dvx * .3 * dg + Math.sin(tt * 9) * .05 * dg);
    JJ.xt.position.y = .014 + .05 * m + .02 * wv; JJ.xb.position.y = -JJ.xt.position.y;
    const ez = (1 - .92 * s.bl) * (1 - .22 * m) * (1 - .32 * wv) * (1 + .12 * dg);
    [JJ.eyeL, JJ.eyeR].forEach((e, i) => { e.position.x = (i ? 1 : -1) * .195 + s.ex * .04; e.position.y = .03 - s.ey * .035; e.scale.set(1 + .08 * dg, ez, 1); });
    if (JJ.hook) JJ.hook.rotation.z = Math.sin(tt * 1.3) * .035 * A - s.dvx * .3 * dg + tk * .05 * Math.sin(tt * 9);
    if (JJ.tailL) JJ.tailL.rotation.z = .2 + s.dvx * .2 * dg;
    const gl = .42 + .1 * Math.sin(tt * 1.6) * A + .26 * m + .2 * wv + .22 * dg;
    JJ.glow.material.opacity = gl;
    /* arms: rest with a small swing, lifted when carried, the right one waves */
    const sw = Math.sin(tt * 1.7) * .02 * A, fl = Math.sin(tt * 9) * dg * .25;
    JJ.armL.rotation.set(-.05 * dg, 0, -(.15 + sw + dg * .62 + fl));
    JJ.armR.rotation.set(-.35 * wv - .05 * dg, 0, .15 - sw + dg * .62 - fl + wv * 2.2);
    JJ.foreL.rotation.set(-.3 + dg * .25, 0, -dg * .2);
    JJ.foreR.rotation.set(-.3 + wv * .25 + dg * .25, 0, wv * (.7 + .5 * Math.sin(s.wt * 9.5)) + dg * .2);
    /* legs: they hang and swing while the figure is carried */
    const sl = Math.sin(tt * 7) * .32 * dg;
    JJ.legL.rotation.x = sl; JJ.legR.rotation.x = -sl;
    JJ.shinL.rotation.x = Math.max(0, -sl) * 1.3 + dg * .25; JJ.shinR.rotation.x = Math.max(0, sl) * 1.3 + dg * .25;
    const ai = clamp(jy / .25, 0, 1); JJ.legL.rotation.x -= ai * .35; JJ.legR.rotation.x -= ai * .35; JJ.shinL.rotation.x += ai * .7; JJ.shinR.rotation.x += ai * .7;
    if (JJ.skirt) JJ.skirt.scale.set(1 + Math.abs(sl) * .5, 1, 1 + Math.abs(sl) * .5);
    shadow.position.y = .004; const sc = 1 - clamp(jy, 0, .4) * 1.2; shadow.scale.set(sc, sc, sc); shadowMat.opacity = (light ? .55 : .9) * (.5 + .5 * sc);
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
    if (mode === 'head') fit(sw / sh, 1.5, 1.35, 1.82); else fit(sw / sh, 2.66, 1.72, 1.24);
    renderer.render(scene, cam);
    const url = canvas.toDataURL('image/png');
    figs.boy.root.visible = keep.k === 'boy'; figs.girl.root.visible = keep.k === 'girl';
    renderer.setPixelRatio(keep.pr); renderer.setSize(keep.cw, keep.ch, false); fit(keep.cw / keep.ch, 2.96, 1.84, 1.37);
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
