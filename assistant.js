/* X Assistant ("إكس المساعد"): the floating helper on the home page.
   A small full-body 3D figure (boy or girl, the visitor chooses; its head is a screen with the platform's X) that looks around, waves hello and can be dragged anywhere on the screen; a tap opens a small chat beside it that answers about services, courses, prices and the site's sections.
   The chat opens to the left or right of the figure, can be dragged on its own and resized; the figure itself can be made smaller or bigger.
   The 3D figure comes from assistant3d.js (loaded only on the home page, after the opening animation). Without WebGL, or with data saver on, a flat 2D figure drawn below is used instead.
   The answers come from assistant-kb.json through assistant-core.js, in the language of the page. Nothing is sent anywhere and nothing is stored except the figure's place, look and size and the chat's place and size. */
(function () {
  'use strict';
  var D = document, W = window, Q = W.XASCORE;
  if (!Q || !D.body) return;

  var S = { kb: null, loading: null, open: false, pos: null, greeted: false, tipT: 0, drag: null, lang: '', ch: 'boy', waveT: 0, talkT: 0, x3: null, si: 2, sc: 1, ppf: null, ps: null, dir: 0, rs: null };
  var X3 = { st: 0, cbs: [], cache: {}, cv: null };      /* st: 0 not tried, 1 loading, 2 ready, -1 not available */
  var M = 8;                                  /* margin kept from the screen edges */
  var KEY = 'xas.pos', TIPKEY = 'xas.tip', CHKEY = 'xas.ch', SCKEY = 'xas.sc', PPKEY = 'xas.pp', PSKEY = 'xas.ps';
  var SCALES = [.7, .85, 1, 1.25, 1.5];            /* the figure's size steps */
  var MINW = 300, MINH = 340, GAP = 8;             /* the chat's smallest size, and the gap between it and the figure */

  var I18N = {
    ar: { name: 'إكس المساعد', sub: 'يجاوب عن الخدمات والأسعار والأقسام', ph: 'اكتب سؤالك…', send: 'إرسال', close: 'إغلاق', open: 'افتح إكس المساعد', drag: 'اسحبه لتحريكه وين ما تريد', tip: 'مرحباً! أنا إكس. شنو تريد تعرف؟', look: 'غيّر شكل المساعد', pick: 'اختر شخصية المساعد', boy: 'ولد', girl: 'بنت', swap: 'هذا شكلي الجديد! شنو تريد تعرف؟', note: 'أجوبة جاهزة من محتوى الموقع. لا نحفظ أسئلتك.', again: 'محادثة جديدة', err: 'تعذّر تحميل المساعد الآن. تواصل معنا مباشرة:',
      wa: 'واتساب', tg: 'تيليجرام', ig: 'إنستغرام', mail: 'البريد',
      q: ['ما هي خدماتكم؟', 'كم الأسعار؟', 'ما هي الدورات؟', 'كيف أسجّل؟', 'كيف أتواصل معكم؟'] },
    en: { name: 'X Assistant', sub: 'Answers about services, prices and sections', ph: 'Type your question…', send: 'Send', close: 'Close', open: 'Open X Assistant', drag: 'Drag it anywhere on the screen', tip: 'Hi! I’m X. What would you like to know?', look: 'Change the assistant’s look', pick: 'Choose your assistant', boy: 'Boy', girl: 'Girl', swap: 'This is my new look! What would you like to know?', note: 'Ready answers from the site’s content. We don’t keep your questions.', again: 'New chat', err: 'The assistant could not load right now. Contact us directly:',
      wa: 'WhatsApp', tg: 'Telegram', ig: 'Instagram', mail: 'Email',
      q: ['What are your services?', 'What are your prices?', 'What courses do you have?', 'How do I register?', 'How can I contact you?'] },
    tr: { name: 'X Asistan', sub: 'Hizmetler, fiyatlar ve bölümler hakkında yanıtlar', ph: 'Sorunuzu yazın…', send: 'Gönder', close: 'Kapat', open: 'X Asistan’ı aç', drag: 'Ekranda istediğiniz yere sürükleyin', tip: 'Merhaba! Ben X. Ne öğrenmek istersiniz?', look: 'Asistanın görünümünü değiştir', pick: 'Asistanını seç', boy: 'Erkek', girl: 'Kız', swap: 'İşte yeni görünümüm! Ne öğrenmek istersiniz?', note: 'Sitenin içeriğinden hazır yanıtlar. Sorularınızı saklamıyoruz.', again: 'Yeni sohbet', err: 'Asistan şu anda yüklenemedi. Doğrudan bize ulaşın:',
      wa: 'WhatsApp', tg: 'Telegram', ig: 'Instagram', mail: 'E-posta',
      q: ['Hizmetleriniz neler?', 'Fiyatlar nedir?', 'Hangi kurslar var?', 'Nasıl kayıt olurum?', 'Size nasıl ulaşırım?'] },
    fr: { name: 'Assistant X', sub: 'Répond sur les services, les tarifs et les sections', ph: 'Écrivez votre question…', send: 'Envoyer', close: 'Fermer', open: 'Ouvrir l’assistant X', drag: 'Faites-le glisser où vous voulez à l’écran', tip: 'Bonjour ! Je suis X. Que voulez-vous savoir ?', look: 'Changer l’apparence de l’assistant', pick: 'Choisissez votre assistant', boy: 'Garçon', girl: 'Fille', swap: 'Voici mon nouveau look ! Que voulez-vous savoir ?', note: 'Des réponses prêtes tirées du contenu du site. Nous ne gardons pas vos questions.', again: 'Nouvelle conversation', err: 'L’assistant n’a pas pu se charger. Contactez-nous directement :',
      wa: 'WhatsApp', tg: 'Telegram', ig: 'Instagram', mail: 'E-mail',
      q: ['Quels sont vos services ?', 'Quels sont vos tarifs ?', 'Quels cours proposez-vous ?', 'Comment m’inscrire ?', 'Comment vous contacter ?'] },
    ku: { name: 'یاریدەدەری X', sub: 'وەڵامی خزمەتگوزاری و نرخ و بەشەکان دەداتەوە', ph: 'پرسیارەکەت بنووسە…', send: 'ناردن', close: 'داخستن', open: 'یاریدەدەری X بکەرەوە', drag: 'هەر شوێنێکی شاشە بتەوێت ڕایبکێشە', tip: 'سڵاو! من X م. دەتەوێت چی بزانیت؟', look: 'شێوەی یاریدەدەر بگۆڕە', pick: 'یاریدەدەرەکەت هەڵبژێرە', boy: 'کوڕ', girl: 'کچ', swap: 'ئەمە شێوە نوێیەکەمە! دەتەوێت چی بزانیت؟', note: 'وەڵامی ئامادە لە ناوەڕۆکی ماڵپەڕەکە. پرسیارەکانت ناپارێزین.', again: 'گفتوگۆی نوێ', err: 'یاریدەدەرەکە ئێستا بار نەبوو. ڕاستەوخۆ پەیوەندیمان پێوە بکە:',
      wa: 'WhatsApp', tg: 'Telegram', ig: 'Instagram', mail: 'ئیمەیڵ',
      q: ['خزمەتگوزارییەکانتان چین؟', 'نرخەکان چەندە؟', 'چ خولێکتان هەیە؟', 'چۆن تۆمار بکەم؟', 'چۆن پەیوەندیتان پێوە بکەم؟'] }
  };

  var X18 = {
    ar: { size: 'حجم الشخصية', sm: 'أصغر', bg: 'أكبر', dock: 'أرجع الدردشة بجانب الشخصية', grip: 'اسحب لتغيير حجم الدردشة' },
    en: { size: 'Figure size', sm: 'Smaller', bg: 'Bigger', dock: 'Put the chat back next to the figure', grip: 'Drag to resize the chat' },
    tr: { size: 'Karakter boyutu', sm: 'Küçült', bg: 'Büyüt', dock: 'Sohbeti figürün yanına geri koy', grip: 'Sohbeti yeniden boyutlandırmak için sürükleyin' },
    fr: { size: 'Taille du personnage', sm: 'Plus petit', bg: 'Plus grand', dock: 'Remettre le chat à côté du personnage', grip: 'Faites glisser pour redimensionner le chat' },
    ku: { size: 'قەبارەی کارەکتەر', sm: 'بچووکتر', bg: 'گەورەتر', dock: 'گفتوگۆ بگەڕێنەوە لای کارەکتەرەکە', grip: 'ڕایبکێشە بۆ گۆڕینی قەبارەی گفتوگۆ' }
  };
  Object.keys(X18).forEach(function (l) { Object.keys(X18[l]).forEach(function (k) { I18N[l][k] = X18[l][k]; }); });

  function lang() { var l = String(W.L || D.documentElement.lang || 'ar').slice(0, 2); if (l === 'ck') l = 'ku'; return I18N[l] ? l : 'ar'; }
  function t() { return I18N[lang()]; }
  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return W.localStorage.getItem(k); W.localStorage.setItem(k, v); } catch (x) { } return null; }
  function sess(k, v) { try { if (v === undefined) return W.sessionStorage.getItem(k); W.sessionStorage.setItem(k, v); } catch (x) { } return null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12 20.5 4l-4.2 16-4.6-6.2zM11.7 13.8 20.5 4"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var LOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.4c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.8h.01M15 9.8h.01"/></svg>';
  var DOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  var GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10 10 20M20 15l-5 5"/></svg>';
  var AGAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/></svg>';

  /* ---- the flat 2D character (used only when the 3D one cannot run): the same figure as the 3D one, sharp-edged: a screen with two eyes and the platform's X; the boy has a hook antenna, the girl has a bob and a bow ---- */
  function fig(kind, arm, id) {
    var girl = kind === 'girl', c = 'xcc' + id, h = '';
    h += '<svg class="xc" viewBox="-12 -12 124 124" aria-hidden="true" focusable="false"><defs><clipPath id="' + c + '"><circle cx="50" cy="56" r="46"/></clipPath></defs>';
    h += '<circle class="xc-disc" cx="50" cy="56" r="46"/><g clip-path="url(#' + c + ')"><g class="xc-body">';
    if (girl) h += '<path class="xc-hair" d="M22 30H78V78L70 90H30L22 78Z"/>';
    h += '<path class="xc-shirt" d="M12 112L16 88L33 78H67L84 88L88 112Z"/>';
    h += '<path class="xc-neck" d="M44 64H56V80H44Z"/>';
    h += '<path class="xc-shirt2" d="M41 79H59L61 85H39Z"/>';
    if (!girl) h += '<path class="xc-gold" d="M21.5 38H26.5V52H21.5ZM73.5 38H78.5V52H73.5Z"/><path class="xc-hook" d="M50 26V18L57 13L63 18V22"/><path class="xc-gold" d="M63 21.5L65.5 25L63 28.5L60.5 25Z"/>';
    h += '<path class="xc-scr" d="M33 26H67L73 32V62L67 68H33L27 62V32Z"/>';
    h += '<g class="xc-x"><path class="xc-xm" d="M32.5 41L39.5 40.5V52L33.5 52.5ZM60.5 40.5L67.5 41L66.5 52.5L60.5 52ZM43 38H57L50 47ZM50 47L57 56H43Z"/></g>';
    if (girl) {
      h += '<path class="xc-hair" d="M25 22H75V28L58 31L25 34Z"/>';
      h += '<path class="xc-hair" d="M22 36H28L27 62L23 64ZM78 36H72L73 62L77 64Z"/>';
      h += '<path class="xc-gold" d="M28 16L35 20L28 24ZM42 16L35 20L42 24ZM35 18L37 20L35 22L33 20Z"/>';
    }
    h += '</g></g><circle class="xc-ring" cx="50" cy="56" r="46"/>';
    if (arm) h += '<g class="xc-arm"><path class="xc-under" d="M80 92L93 62"/><path class="xc-sleeve" d="M80 92L93 62"/><path class="xc-hand" d="M89 47H101V59H89Z"/></g>';
    return h + '</svg>';
  }

  /* ---- the DOM ---- */
  var root = el('div', 'xas pend'); root.id = 'xas'; root.hidden = true;
  var btn = el('button', 'xas-b'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'xas-p');
  var tip = el('div', 'xas-tip'); tip.hidden = true; tip.setAttribute('role', 'status');
  var tipB = el('div', 'xas-tb'), tipT = el('span'), tipX = el('button', 'xas-tx', CLOSE), tipQ = el('div', 'xas-tq'); tipX.type = 'button';
  tipB.appendChild(tipT); tipB.appendChild(tipX); tip.appendChild(tipB); tip.appendChild(tipQ);
  var panel = el('div', 'xas-p'); panel.id = 'xas-p'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  var head = el('div', 'xas-h');
  var av = el('span', 'xas-av'), ttl = el('div', 'xas-t'), nm = el('span', 'xas-nm'), sb = el('span', 'xas-sb');
  ttl.appendChild(nm); ttl.appendChild(sb);
  var look = el('button', 'xas-i', LOOK); look.type = 'button'; look.setAttribute('aria-expanded', 'false');
  var again = el('button', 'xas-i', AGAIN); again.type = 'button';
  var dockB = el('button', 'xas-i', DOCK); dockB.type = 'button'; dockB.hidden = true;
  var cls = el('button', 'xas-i', CLOSE); cls.type = 'button';
  head.appendChild(av); head.appendChild(ttl); head.appendChild(look); head.appendChild(again); head.appendChild(dockB); head.appendChild(cls);
  var pick = el('div', 'xas-pk'); pick.hidden = true;
  var pickL = el('span', 'xas-pl'), pickB = el('div', 'xas-po'), chB = {};
  ['boy', 'girl'].forEach(function (k) { var b = el('button', 'xas-ch'); b.type = 'button'; b.dataset.k = k; chB[k] = b; pickB.appendChild(b); });
  var szR = el('div', 'xas-sz'), szL = el('span', 'xas-pl'), szS = el('button', 'xas-zb', '−'), szB = el('button', 'xas-zb', '+');
  szS.type = 'button'; szB.type = 'button';
  szR.appendChild(szL); szR.appendChild(szS); szR.appendChild(szB);
  pick.appendChild(pickL); pick.appendChild(pickB); pick.appendChild(szR);
  var msgs = el('div', 'xas-m'); msgs.setAttribute('aria-live', 'polite'); msgs.tabIndex = 0;
  var chips = el('div', 'xas-q');
  var form = el('form', 'xas-f'); form.setAttribute('autocomplete', 'off');
  var inp = el('input'); inp.type = 'text'; inp.maxLength = 300; inp.setAttribute('enterkeyhint', 'send'); inp.setAttribute('autocomplete', 'off');
  var snd = el('button', '', SEND); snd.type = 'submit';
  form.appendChild(inp); form.appendChild(snd);
  var note = el('div', 'xas-n');
  var rz = el('button', 'xas-rz', GRIP); rz.type = 'button';
  [head, pick, msgs, chips, form, note, rz].forEach(function (n) { panel.appendChild(n); });
  [btn, tip, panel].forEach(function (n) { root.appendChild(n); });
  D.body.appendChild(root);

  function label() {
    var s = t(), dir = D.documentElement.dir || 'ltr';
    btn.setAttribute('aria-label', s.open); btn.title = s.drag;
    panel.setAttribute('aria-label', s.name); panel.dir = dir; tip.dir = dir;
    nm.textContent = s.name; sb.textContent = s.sub; inp.placeholder = s.ph; inp.setAttribute('aria-label', s.ph);
    snd.setAttribute('aria-label', s.send); snd.title = s.send; cls.setAttribute('aria-label', s.close); cls.title = s.close;
    again.setAttribute('aria-label', s.again); again.title = s.again; note.textContent = s.note; tipT.textContent = s.tip; tipX.setAttribute('aria-label', s.close);
    look.setAttribute('aria-label', s.look); look.title = s.look; pickL.textContent = s.pick;
    szL.textContent = s.size; szS.setAttribute('aria-label', s.sm); szS.title = s.sm; szB.setAttribute('aria-label', s.bg); szB.title = s.bg;
    dockB.setAttribute('aria-label', s.dock); dockB.title = s.dock; rz.setAttribute('aria-label', s.grip); rz.title = s.grip;
    ['boy', 'girl'].forEach(function (k) { chB[k].setAttribute('aria-label', s[k]); });
    tipQ.innerHTML = '';
    [0, 1, 4].forEach(function (i) { var b = el('button', 'xas-c'); b.type = 'button'; b.textContent = s.q[i]; tipQ.appendChild(b); });
    chips.innerHTML = '';
    s.q.forEach(function (q) { var b = el('button', 'xas-c'); b.type = 'button'; b.textContent = q; chips.appendChild(b); });
  }

  /* a still picture of the 3D figure (for the chat's avatar and the choose-a-look buttons), cached until the theme changes */
  function snap(k, mode) {
    var key = k + mode; if (X3.cache[key]) return X3.cache[key];
    try { return (X3.cache[key] = mode === 'head' ? S.x3.snap(k, 112, 112, 'head') : S.x3.snap(k, 112, 160, 'full')); } catch (x) { return ''; }
  }
  function figs() {
    if (!S.x3) { btn.innerHTML = fig(S.ch, true, 'b'); av.innerHTML = fig(S.ch, false, 'h'); }
    else av.innerHTML = '<img alt="" width="46" height="46" src="' + snap(S.ch, 'head') + '">';
    ['boy', 'girl'].forEach(function (k) {
      chB[k].innerHTML = (S.x3 ? '<img class="xc3" alt="" width="56" height="80" src="' + snap(k, 'full') + '">' : fig(k, false, 'p' + k)) + '<span>' + t()[k] + '</span>';
      chB[k].setAttribute('aria-pressed', String(k === S.ch));
    });
  }
  function setCh(k) {
    if (k !== 'boy' && k !== 'girl') k = 'boy';
    var changed = k !== S.ch; S.ch = k; store(CHKEY, k);
    if (S.x3) S.x3.setKind(k, changed);
    figs();
    return changed;
  }
  /* the figure waves hello, and moves its mouth while it answers */
  function wave() {
    if (S.open || root.hidden) return;
    if (S.x3) { S.x3.wave(2400); return; }
    root.classList.remove('wave'); void root.offsetWidth; root.classList.add('wave');
    clearTimeout(S.waveT); S.waveT = setTimeout(function () { root.classList.remove('wave'); }, 2400);
  }
  function talk(ms) {
    if (S.x3) S.x3.talk(ms);
    root.classList.add('talk'); clearTimeout(S.talkT);
    S.talkT = setTimeout(function () { root.classList.remove('talk'); }, ms);
  }

  /* ---- where things are on the screen ---- */
  function view() { var v = W.visualViewport; return { w: D.documentElement.clientWidth, h: v ? v.height : W.innerHeight, y: v ? v.offsetTop : 0 }; }
  function big() { return W.innerWidth <= 700; }
  function baseSize() { return root.classList.contains('x3') ? (big() ? [112, 170] : [152, 230]) : (big() ? [72, 72] : [84, 84]); }
  function sw() { return btn.offsetWidth || Math.round(baseSize()[0] * S.sc); }
  function sh() { return btn.offsetHeight || Math.round(baseSize()[1] * S.sc); }
  function setPos(x, y) {
    var v = view();
    x = clamp(x, M, Math.max(M, v.w - sw() - M)); y = clamp(y, M, Math.max(M, W.innerHeight - sh() - M));
    btn.style.left = x + 'px'; btn.style.top = y + 'px';
    S.pos = { x: x, y: y };
  }
  function save() {
    var v = view(), ax = Math.max(1, v.w - sw() - 2 * M), ay = Math.max(1, W.innerHeight - sh() - 2 * M);
    store(KEY, JSON.stringify({ x: +((S.pos.x - M) / ax).toFixed(4), y: +((S.pos.y - M) / ay).toFixed(4) }));
  }
  function restore() {
    var v = view(), ax = Math.max(1, v.w - sw() - 2 * M), ay = Math.max(1, W.innerHeight - sh() - 2 * M), f = null;
    try { f = JSON.parse(store(KEY) || 'null'); } catch (x) { }
    if (f && isFinite(f.x) && isFinite(f.y)) setPos(M + clamp(f.x, 0, 1) * ax, M + clamp(f.y, 0, 1) * ay);
    else { var rtl = (D.documentElement.dir === 'rtl'); setPos(rtl ? 18 : v.w - sw() - 18, W.innerHeight - sh() - 22); }
  }
  /* the figure's size: a few steps (the picker has the smaller / bigger buttons); the feet and the centre stay where they were */
  function applySize(keep) {
    var b = baseSize(), nw = Math.round(b[0] * S.sc), nh = Math.round(b[1] * S.sc), ow = btn.offsetWidth, oh = btn.offsetHeight;
    btn.style.width = nw + 'px'; btn.style.height = nh + 'px';
    if (keep && S.pos && ow) setPos(S.pos.x + (ow - nw) / 2, S.pos.y + (oh - nh));
    if (S.x3) S.x3.resize(nw, nh);
    szS.disabled = S.si <= 0; szB.disabled = S.si >= SCALES.length - 1;
    if (keep && S.pos) { save(); place(); }
  }
  function setScale(i) {
    i = clamp(i, 0, SCALES.length - 1); if (i === S.si) return;
    S.si = i; S.sc = SCALES[i]; store(SCKEY, String(i)); X3.cache = {};
    applySize(true);
  }

  /* ---- the speech goes beside the figure: to its right or left, whichever has room (above or below it on a phone) ---- */
  function inset() { return S.x3 ? Math.round(sw() * .2) : 0; }       /* the 3D canvas has empty margin at its sides, the bubble may overlap it */
  function sideRoom() { var v = view(), p = S.pos; return { r: v.w - (p.x + sw() - inset()) - GAP - M, l: p.x + inset() - GAP - M }; }
  function pickSide(w) {
    var rm = sideRoom(), v = view(), mid = S.pos.x + sw() / 2 < v.w / 2;
    if (mid) return rm.r >= w ? 'r' : rm.l >= w ? 'l' : '';
    return rm.l >= w ? 'l' : rm.r >= w ? 'r' : '';
  }
  function placePanel() {
    var v = view(), p = S.pos, ph = big(), bw, bh, left, top, side, rm, m;
    bw = Math.min(ph ? 380 : clamp(S.ps ? S.ps.w : 380, MINW, 640), v.w - 2 * M);
    bh = Math.min(ph ? 560 : clamp(S.ps ? S.ps.h : 560, MINH, 800), v.h - 2 * M);
    if (!ph && S.ppf) {                                              /* the chat was moved on its own: it keeps its own place */
      side = 'f';
      left = M + S.ppf.x * Math.max(1, v.w - bw - 2 * M); top = v.y + M + S.ppf.y * Math.max(1, v.h - bh - 2 * M);
    } else {
      side = ph ? '' : pickSide(bw);
      if (!side && !ph) { rm = sideRoom(); m = Math.max(rm.r, rm.l); if (m >= MINW) { side = rm.r >= rm.l ? 'r' : 'l'; bw = Math.min(bw, m); } }
      if (side) {                                                    /* beside the figure, its bottom level with the figure's feet (or its top level with the head when the figure is up high) */
        left = side === 'r' ? p.x + sw() - inset() + GAP : p.x + inset() - GAP - bw;
        top = p.y + sh() / 2 > v.h / 2 ? p.y + sh() - 6 - bh : p.y + 6;
      } else {                                                       /* above or below the figure: phones, or no room at the sides */
        var up = p.y > W.innerHeight / 2, avail = up ? p.y - 2 * M : W.innerHeight - (p.y + sh()) - 2 * M;
        bh = Math.min(bh, avail); side = 'v';
        if (bh < 300) { bh = Math.min(560, v.h - 2 * M); top = v.y + M; } else top = up ? p.y - M - bh : p.y + sh() + M;
        left = (p.x + sw() / 2 < v.w / 2) ? p.x : p.x + sw() - bw;
      }
    }
    left = clamp(left, M, Math.max(M, v.w - bw - M)); top = clamp(top, v.y + M, Math.max(v.y + M, v.y + v.h - bh - M));
    panel.style.width = bw + 'px'; panel.style.height = bh + 'px'; panel.style.left = left + 'px'; panel.style.top = top + 'px';
    panel.dataset.s = side;
    dockB.hidden = !(S.ppf && !ph);
    var dir = side === 'r' ? 1 : side === 'l' ? -1 : side === 'f' ? (left + bw / 2 > p.x + sw() / 2 ? 1 : -1) : 0;   /* the figure turns toward the chat */
    S.dir = dir; if (S.x3) S.x3.open(true, dir);
  }
  function placeTip() {
    var v = view(), p = S.pos, bw = Math.min(260, v.w - 2 * M), side = big() ? '' : pickSide(bw), th, left, top;
    tip.style.width = bw + 'px'; th = tip.offsetHeight;
    if (side) {
      left = side === 'r' ? p.x + sw() - inset() + GAP + 6 : p.x + inset() - GAP - 6 - bw;
      top = clamp(p.y + sh() * .06, M, Math.max(M, W.innerHeight - th - M));
      tip.style.setProperty('--ty', clamp(p.y + sh() * (S.x3 ? .2 : .45) - top, 16, Math.max(16, th - 16)) + 'px');
    } else {
      var up = p.y > W.innerHeight / 2;
      left = (p.x + sw() / 2 < v.w / 2) ? p.x : p.x + sw() - bw;
      top = up ? p.y - M - th : p.y + sh() + M;
      side = 'v';
    }
    left = clamp(left, M, Math.max(M, v.w - bw - M));
    tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.dataset.s = side;
  }
  function place() { if (S.open) placePanel(); if (!tip.hidden) placeTip(); }

  /* ---- messages ---- */
  function add(who, text, res) {
    var g = el('div', 'xas-g ' + who), p;
    if (who === 'bot') {                                              /* an answer is laid out in order: a heading line, plain lines and a list of points */
      var ul = null;
      String(text).split('\n').forEach(function (line, i) {
        line = line.trim(); if (!line) return;
        if (/^[•–-]\s+/.test(line)) {
          if (!ul) { ul = el('ul', 'xas-ul'); g.appendChild(ul); }
          var li = el('li'); li.textContent = Q.bidi(line.replace(/^[•–-]\s+/, ''), lang()); ul.appendChild(li);
        } else {
          ul = null; p = el('p', i === 0 && /[:：]$/.test(line) ? 'xas-hd' : ''); p.textContent = Q.bidi(line, lang()); g.appendChild(p);
        }
      });
    } else { p = el('p'); p.textContent = text; g.appendChild(p); }
    if (res && res.links && res.links.length) {
      var r = el('div', 'xas-r');
      res.links.forEach(function (l) { var a = el('a', 'xas-l'); a.href = l.h; a.textContent = l.t; r.appendChild(a); });
      g.appendChild(r);
    }
    if (res && res.actions && res.actions.indexOf('contact') >= 0) g.appendChild(contacts());
    msgs.appendChild(g); reveal(g);
    return g;
  }
  /* after a question the answer is shown from its start (with the question above it when both fit), never scrolled past */
  function reveal(g) {
    var prev = g.previousElementSibling, top = g.offsetTop - 10;
    if (g.classList.contains('bot') && prev && prev.classList.contains('me') && g.offsetTop + g.offsetHeight - prev.offsetTop + 20 <= msgs.clientHeight) top = prev.offsetTop - 10;
    else if (!g.classList.contains('bot') || g.offsetTop + g.offsetHeight - msgs.scrollTop <= msgs.clientHeight - 10) top = msgs.scrollHeight;
    top = Math.max(0, top);
    if (msgs.scrollTo && !(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches)) msgs.scrollTo({ top: top, behavior: 'smooth' }); else msgs.scrollTop = top;
  }
  function contacts() {
    var s = t(), SITE = W.SITE || {}, h = (SITE.wa || 'xstudio4arch'), em = SITE.email || 'info@xarch.site', r = el('div', 'xas-r xas-k');
    [['wa', 'https://wa.me/' + h], ['tg', 'https://t.me/' + h], ['ig', 'https://instagram.com/' + h], ['mail', 'mailto:' + em]].forEach(function (c) {
      var a = el('a', 'xas-l'); a.href = c[1]; a.textContent = s[c[0]]; if (c[0] !== 'mail') { a.target = '_blank'; a.rel = 'noopener'; } r.appendChild(a);
    });
    return r;
  }
  function load() {
    if (S.kb) return Promise.resolve(S.kb);
    if (S.loading) return S.loading;
    S.loading = W.fetch('assistant-kb.json?v=2').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { S.kb = Q.prepare(j); return S.kb; }).catch(function () { S.loading = null; return null; });
    return S.loading;
  }
  function greet() {
    if (S.greeted) return;
    S.greeted = true;
    load().then(function (kb) {
      if (!kb) { var g = add('bot', t().err); g.appendChild(contacts()); return; }
      var gt = Q.greeting(kb, lang()); add('bot', gt); talk(Math.min(3000, 600 + gt.length * 22));
    });
  }
  function ask(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!q) return;
    add('me', q);
    var dots = el('div', 'xas-g bot xas-d', '<i></i><i></i><i></i>'); dots.setAttribute('aria-hidden', 'true'); msgs.appendChild(dots); reveal(dots);
    var wait = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
    talk(wait + 200);
    Promise.all([load(), new Promise(function (ok) { setTimeout(ok, wait); })]).then(function (r) {
      dots.remove();
      if (!r[0]) { var g = add('bot', t().err); g.appendChild(contacts()); return; }
      var res = Q.answer(r[0], q, lang());
      add('bot', res.text, res); talk(Math.min(3400, 700 + res.text.length * 22));
    });
  }
  function reset() { msgs.innerHTML = ''; S.greeted = false; if (S.open) greet(); }
  function togglePick(on) {
    pick.hidden = !on; look.setAttribute('aria-expanded', String(on));
    if (on) pick.style.top = head.offsetHeight + 'px';
    place();
  }
  D.addEventListener('pointerdown', function (e) { if (!pick.hidden && !pick.contains(e.target) && !look.contains(e.target)) togglePick(false); }, true);

  /* ---- open / close ---- */
  function hideTip() { tip.hidden = true; clearTimeout(S.tipT); }
  function openP() {
    if (S.open) return;
    S.open = true; hideTip(); panel.hidden = false; root.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
    place(); greet(); load();
    if (S.x3) S.x3.hop();
    if (!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches)) setTimeout(function () { inp.focus({ preventScroll: true }); }, 30);
  }
  function closeP(focus) {
    if (!S.open) return;
    S.open = false; panel.hidden = true; togglePick(false); root.classList.remove('on'); btn.setAttribute('aria-expanded', 'false');
    if (S.x3) S.x3.open(false);
    if (focus) btn.focus({ preventScroll: true });
  }
  function showTip() {
    if (S.open || root.hidden || sess(TIPKEY)) return;
    sess(TIPKEY, '1'); tip.hidden = false; placeTip();
    S.tipT = setTimeout(hideTip, 14000);
  }

  /* ---- dragging: the figure can be moved anywhere; the chat's title bar moves the chat on its own (the pin button puts it back beside the figure) ---- */
  function startDrag(e, handle) {
    if (e.button != null && e.button !== 0) return;
    var pr = panel.getBoundingClientRect();
    S.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: S.pos.x, py: S.pos.y, moved: false, handle: handle, lx: e.clientX, own: handle === head && !big(), pl: pr.left, pt: pr.top };
    try { handle.setPointerCapture(e.pointerId); } catch (x) { }
  }
  function moveDrag(e) {
    var d = S.drag; if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) { d.moved = true; root.classList.add(d.own ? 'mvp' : 'mv'); hideTip(); if (S.x3 && !d.own) S.x3.drag(true); }
    if (d.own) {                                                       /* the chat alone */
      var v = view(), bw = panel.offsetWidth, bh = panel.offsetHeight;
      var l = clamp(d.pl + dx, M, Math.max(M, v.w - bw - M)), t = clamp(d.pt + dy, v.y + M, Math.max(v.y + M, v.y + v.h - bh - M));
      S.ppf = { x: (l - M) / Math.max(1, v.w - bw - 2 * M), y: (t - v.y - M) / Math.max(1, v.h - bh - 2 * M) };
      placePanel(); return;
    }
    if (S.x3) S.x3.push(e.clientX - d.lx);
    d.lx = e.clientX;
    setPos(d.px + dx, d.py + dy); place();
  }
  function endDrag(e) {
    var d = S.drag; if (!d || e.pointerId !== d.id) return;
    S.drag = null; root.classList.remove('mv'); root.classList.remove('mvp');
    if (S.x3 && !d.own) S.x3.drag(false);
    if (d.moved && d.own) savePanel();
    else if (d.moved) { save(); S.justDragged = true; setTimeout(function () { S.justDragged = false; }, 60); }
  }
  function savePanel() {
    if (S.ppf) store(PPKEY, JSON.stringify({ x: +S.ppf.x.toFixed(4), y: +S.ppf.y.toFixed(4) })); else store(PPKEY, '');
    if (S.ps) store(PSKEY, JSON.stringify(S.ps));
  }
  /* the chat's resize grip (bottom corner away from the figure); resizing also frees the chat, keeping its top and the edge nearest the figure where they are */
  function resizeTo(r, w, h) {
    var v = view();
    w = clamp(w, MINW, Math.min(640, v.w - 2 * M)); h = clamp(h, MINH, Math.min(800, v.y + v.h - M - r.t));
    var left = r.left ? r.rt - w : r.l;
    left = clamp(left, M, Math.max(M, v.w - w - M));
    S.ps = { w: w, h: h };
    S.ppf = { x: (left - M) / Math.max(1, v.w - w - 2 * M), y: (r.t - v.y - M) / Math.max(1, v.h - h - 2 * M) };
    placePanel();
  }
  function gripRect() { var pr = panel.getBoundingClientRect(); return { l: pr.left, t: pr.top, rt: pr.right, w: pr.width, h: pr.height, left: panel.dataset.s === 'l' }; }
  rz.addEventListener('pointerdown', function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var r = gripRect(); r.id = e.pointerId; r.sx = e.clientX; r.sy = e.clientY; S.rs = r; root.classList.add('mvp');
    try { rz.setPointerCapture(e.pointerId); } catch (x) { }
  });
  rz.addEventListener('pointermove', function (e) { var r = S.rs; if (r && e.pointerId === r.id) resizeTo(r, r.w + (r.left ? -1 : 1) * (e.clientX - r.sx), r.h + (e.clientY - r.sy)); });
  function endResize(e) { var r = S.rs; if (!r || e.pointerId !== r.id) return; S.rs = null; root.classList.remove('mvp'); savePanel(); }
  rz.addEventListener('pointerup', endResize); rz.addEventListener('pointercancel', endResize);
  rz.addEventListener('keydown', function (e) {                         /* the keyboard can resize it too: arrows */
    var d = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key]; if (!d) return;
    e.preventDefault(); var r = gripRect(); resizeTo(r, r.w + (r.left ? -1 : 1) * d[0], r.h + d[1]); savePanel();
  });
  dockB.addEventListener('click', function () { S.ppf = null; savePanel(); placePanel(); });
  szS.addEventListener('click', function () { setScale(S.si - 1); });
  szB.addEventListener('click', function () { setScale(S.si + 1); });
  btn.addEventListener('pointerdown', function (e) { startDrag(e, btn); });
  head.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; startDrag(e, head); });
  [btn, head].forEach(function (h) { h.addEventListener('pointermove', moveDrag); h.addEventListener('pointerup', endDrag); h.addEventListener('pointercancel', endDrag); });
  btn.addEventListener('click', function () { if (S.justDragged) return; if (S.open) closeP(); else openP(); });
  btn.addEventListener('keydown', function (e) {                       /* the keyboard can move it too: Shift + arrows */
    if (!e.shiftKey || !/^Arrow/.test(e.key)) return;
    e.preventDefault(); var st = 24, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    setPos(S.pos.x + d[0], S.pos.y + d[1]); save(); place();
  });
  tipX.addEventListener('click', hideTip);
  tipQ.addEventListener('click', function (e) { var b = e.target.closest('.xas-c'); if (!b) return; var q = b.textContent; hideTip(); S.greeted = true; openP(); ask(q); });
  btn.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !S.drag) wave(); });
  look.addEventListener('click', function () { togglePick(pick.hidden); });
  pickB.addEventListener('click', function (e) {
    var b = e.target.closest('.xas-ch'); if (!b) return;
    var changed = setCh(b.dataset.k); togglePick(false);
    if (changed) { add('bot', t().swap); talk(1800); }
  });
  cls.addEventListener('click', function () { closeP(true); });
  again.addEventListener('click', reset);
  form.addEventListener('submit', function (e) { e.preventDefault(); var q = inp.value; inp.value = ''; ask(q); });
  chips.addEventListener('click', function (e) { var b = e.target.closest('.xas-c'); if (b) ask(b.textContent); });
  panel.addEventListener('click', function (e) { var a = e.target.closest('a.xas-l'); if (a && a.getAttribute('href').charAt(0) === '#' && W.innerWidth <= 700) closeP(); });
  D.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || !S.open) return; if (!pick.hidden) { togglePick(false); look.focus({ preventScroll: true }); } else closeP(true); });
  W.addEventListener('resize', function () { applySize(false); if (S.pos) { restore(); place(); } });
  /* the figure's eyes and head follow the pointer (or a finger) */
  D.addEventListener('pointermove', function (e) {
    if (!S.x3 || root.hidden || S.drag || !S.pos) return;
    var v = view(), cx = S.pos.x + sw() / 2, cy = S.pos.y + sh() * .3;
    S.x3.look((e.clientX - cx) / Math.max(240, v.w * .32), (e.clientY - cy) / Math.max(220, W.innerHeight * .32));
  }, { passive: true });
  D.addEventListener('visibilitychange', function () { if (S.x3) S.x3.run(!root.hidden && !D.hidden); });
  new MutationObserver(function () { X3.cache = {}; if (S.x3) { S.x3.theme(); figs(); } }).observe(D.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (W.visualViewport) { W.visualViewport.addEventListener('resize', place); W.visualViewport.addEventListener('scroll', place); }

  /* ---- the 3D figure: loaded once, only when the home page is shown; anything that goes wrong leaves the flat 2D figure ---- */
  function flush3d() { root.classList.remove('pend'); var c = X3.cbs; X3.cbs = []; c.forEach(function (f) { f(); }); }
  function fail3d() {
    X3.st = -1;
    if (S.x3) { try { S.x3.dispose(); } catch (x) { } S.x3 = null; }
    root.classList.remove('x3'); X3.cache = {}; applySize(false); figs(); if (S.pos) { restore(); place(); }
    flush3d();
  }
  function start3d() {
    var X = W.XAS3D, cv, c;
    if (!X || !X.create) return fail3d();
    cv = D.createElement('canvas'); cv.className = 'xas-3d'; cv.setAttribute('aria-hidden', 'true');
    root.classList.add('x3'); applySize(false);
    c = null;
    try { c = X.create(cv, { kind: S.ch, calm: !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches), w: sw(), h: sh(), onLost: fail3d }); } catch (x) { c = null; }
    if (!c) { root.classList.remove('x3'); applySize(false); return fail3d(); }
    S.x3 = c; X3.cv = cv; X3.st = 2; X3.cache = {};
    btn.innerHTML = ''; btn.appendChild(cv);
    c.resize(sw(), sh()); figs(); if (S.pos) { restore(); place(); }
    c.run(!root.hidden && !D.hidden);
    flush3d();
  }
  function load3d(cb) {
    if (X3.st === 2 || X3.st === -1) { cb(); return; }
    X3.cbs.push(cb);
    if (X3.st === 1) return;
    var nav = W.navigator || {}, off = store('xas.3d') === '0' || !W.WebGLRenderingContext || (nav.connection && nav.connection.saveData) || (nav.deviceMemory && nav.deviceMemory <= 1);
    if (off) { X3.st = -1; flush3d(); return; }
    X3.st = 1;
    var sc = D.createElement('script'); sc.src = 'assistant3d.js?v=3'; sc.async = true;
    sc.onload = start3d; sc.onerror = function () { fail3d(); };
    D.head.appendChild(sc);
    setTimeout(function () { if (X3.st === 1) flush3d(); }, 6000);       /* a very slow connection: show the flat figure meanwhile */
  }

  /* the first hello waits until the site's own opening animation (the X flying to its place) has finished */
  function greetWhenReady() {
    clearTimeout(S.waveT0); clearTimeout(S.tipT0);
    var n = 0, de = D.documentElement;
    (function poll() {
      var busy = (de.classList.contains('intro') && !de.classList.contains('introd')) || de.classList.contains('xw');
      if (busy && n++ < 45) { S.waveT0 = setTimeout(poll, 300); return; }
      load3d(function () { S.waveT0 = setTimeout(wave, 500); S.tipT0 = setTimeout(showTip, 1500); });
    })();
  }

  /* the helper lives on the home page only; route() in index.html calls XAS.sync() */
  function sync() {
    var home = !/(^|\s)r[nwskpcl](\s|$)/.test(D.body.className), was = root.hidden;
    root.hidden = !home;
    if (S.x3) S.x3.run(home && !D.hidden);
    if (!home) { closeP(); hideTip(); return; }
    if (was) { if (!S.pos) { restore(); } greetWhenReady(); }
  }
  new MutationObserver(function () {                                    /* the page language changed */
    var l = lang(); if (l === S.lang) return; S.lang = l; label(); figs(); reset(); place();
  }).observe(D.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

  S.ch = store(CHKEY) === 'girl' ? 'girl' : 'boy';
  (function () {                                                         /* the saved size of the figure, and the saved place and size of the chat */
    var i = parseInt(store(SCKEY), 10), pp = null, ps = null;
    if (isFinite(i) && i >= 0 && i < SCALES.length) { S.si = i; S.sc = SCALES[i]; }
    try { pp = JSON.parse(store(PPKEY) || 'null'); ps = JSON.parse(store(PSKEY) || 'null'); } catch (x) { }
    if (pp && isFinite(pp.x) && isFinite(pp.y)) S.ppf = { x: clamp(pp.x, 0, 1), y: clamp(pp.y, 0, 1) };
    if (ps && isFinite(ps.w) && isFinite(ps.h)) S.ps = { w: clamp(ps.w, MINW, 640), h: clamp(ps.h, MINH, 800) };
  })();
  S.lang = lang(); label(); figs();
  W.XAS = { sync: sync, open: openP, close: closeP, ask: ask, x3: function () { return S.x3; } };
  /* the icon needs its size to be measured before it is placed */
  root.hidden = false; applySize(false); restore(); root.hidden = true; sync();
})();
