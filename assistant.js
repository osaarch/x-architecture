/* X Assistant ("إكس المساعد"): the floating helper on the home page.
   A small full-body 3D figure (boy or girl, the visitor chooses) that looks around, waves hello and can be dragged anywhere on the screen; a tap opens a small chat that answers about services, courses, prices and the site's sections.
   The 3D figure comes from assistant3d.js (loaded only on the home page, after the opening animation). Without WebGL, or with data saver on, a flat 2D figure drawn below is used instead.
   The answers come from assistant-kb.json through assistant-core.js, in the language of the page. Nothing is sent anywhere and nothing is stored except the icon's position. */
(function () {
  'use strict';
  var D = document, W = window, Q = W.XASCORE;
  if (!Q || !D.body) return;

  var S = { kb: null, loading: null, open: false, pos: null, greeted: false, tipT: 0, drag: null, lang: '', ch: 'boy', waveT: 0, talkT: 0, x3: null };
  var X3 = { st: 0, cbs: [], cache: {}, cv: null };      /* st: 0 not tried, 1 loading, 2 ready, -1 not available */
  var M = 8;                                  /* margin kept from the screen edges */
  var KEY = 'xas.pos', TIPKEY = 'xas.tip', CHKEY = 'xas.ch';

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

  function lang() { var l = String(W.L || D.documentElement.lang || 'ar').slice(0, 2); if (l === 'ck') l = 'ku'; return I18N[l] ? l : 'ar'; }
  function t() { return I18N[lang()]; }
  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return W.localStorage.getItem(k); W.localStorage.setItem(k, v); } catch (x) { } return null; }
  function sess(k, v) { try { if (v === undefined) return W.sessionStorage.getItem(k); W.sessionStorage.setItem(k, v); } catch (x) { } return null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12 20.5 4l-4.2 16-4.6-6.2zM11.7 13.8 20.5 4"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var LOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.4c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.8h.01M15 9.8h.01"/></svg>';
  var AGAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/></svg>';

  /* ---- the character: a small figure drawn in the platform's own gold-and-black style (boy or girl, the visitor chooses) ---- */
  function fig(kind, arm, id) {
    var girl = kind === 'girl', c = 'xcc' + id, h = '';
    h += '<svg class="xc" viewBox="-12 -12 124 124" aria-hidden="true" focusable="false"><defs><clipPath id="' + c + '"><circle cx="50" cy="56" r="46"/></clipPath></defs>';
    h += '<circle class="xc-disc" cx="50" cy="56" r="46"/><g clip-path="url(#' + c + ')"><g class="xc-body">';
    if (girl) h += '<path class="xc-hair" d="M27 52C24 28 36 20 50 20C64 20 76 28 73 52C74 66 76 76 80 88C70 92 30 92 20 88C24 76 26 66 27 52Z"/>';
    h += '<path class="xc-shirt" d="M6 112C6 86 26 78 50 78C74 78 94 86 94 112Z"/>';
    h += '<path class="xc-mark" d="M45.5 89.5H54.5L50 95ZM50 95L54.5 100.5H45.5Z"/>';
    h += '<rect class="xc-skin2" x="43" y="64" width="14" height="18" rx="6"/>';
    h += '<path class="xc-shirt" d="M40 79Q50 88 60 79L62 84Q50 92 38 84Z"/>';
    h += '<circle class="xc-skin" cx="31.5" cy="51" r="3.6"/><circle class="xc-skin" cx="68.5" cy="51" r="3.6"/>';
    h += '<ellipse class="xc-skin" cx="50" cy="49" rx="19" ry="21"/>';
    h += girl ? '<path class="xc-hair" d="M30 50C28 28 40 23 50 23C62 23 72 28 70 50C66 42 58 36 50 32C45 38 37 44 30 50Z"/>'
              : '<path class="xc-hair" d="M30 47C27 27 39 22 50 22C63 22 73 28 70 47C68 40 63 35 56 33C48 37 38 38 30 47Z"/>';
    h += '<circle class="xc-cheek" cx="38" cy="57" r="3.2"/><circle class="xc-cheek" cx="62" cy="57" r="3.2"/>';
    h += '<path class="xc-brow" d="M39.5 45.6Q43 44 46.5 45.6M53.5 45.6Q57 44 60.5 45.6"/>';
    h += '<g class="xc-eyes"><circle class="xc-ink" cx="43" cy="51" r="2.3"/><circle class="xc-ink" cx="57" cy="51" r="2.3"/></g>';
    if (girl) h += '<path class="xc-brow" d="M40.4 49.4L38.8 48.2M59.6 49.4L61.2 48.2"/><circle class="xc-gold" cx="31.5" cy="57.5" r="1.8"/><circle class="xc-gold" cx="68.5" cy="57.5" r="1.8"/>';
    else h += '<circle class="xc-glass" cx="43" cy="51" r="6.2"/><circle class="xc-glass" cx="57" cy="51" r="6.2"/><path class="xc-glass" d="M49.2 50.6H50.8"/>';
    h += '<path class="xc-smile xc-s" d="M43.5 59Q50 65.5 56.5 59"/><ellipse class="xc-o" cx="50" cy="60.6" rx="4.2" ry="3"/>';
    h += '</g></g><circle class="xc-ring" cx="50" cy="56" r="46"/>';
    if (arm) h += '<g class="xc-arm"><path class="xc-under" d="M80 92L93 62"/><path class="xc-sleeve" d="M80 92L93 62"/><circle class="xc-skin" cx="95" cy="54" r="6.2"/></g>';
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
  var cls = el('button', 'xas-i', CLOSE); cls.type = 'button';
  head.appendChild(av); head.appendChild(ttl); head.appendChild(look); head.appendChild(again); head.appendChild(cls);
  var pick = el('div', 'xas-pk'); pick.hidden = true;
  var pickL = el('span', 'xas-pl'), pickB = el('div', 'xas-po'), chB = {};
  ['boy', 'girl'].forEach(function (k) { var b = el('button', 'xas-ch'); b.type = 'button'; b.dataset.k = k; chB[k] = b; pickB.appendChild(b); });
  pick.appendChild(pickL); pick.appendChild(pickB);
  var msgs = el('div', 'xas-m'); msgs.setAttribute('aria-live', 'polite'); msgs.tabIndex = 0;
  var chips = el('div', 'xas-q');
  var form = el('form', 'xas-f'); form.setAttribute('autocomplete', 'off');
  var inp = el('input'); inp.type = 'text'; inp.maxLength = 300; inp.setAttribute('enterkeyhint', 'send'); inp.setAttribute('autocomplete', 'off');
  var snd = el('button', '', SEND); snd.type = 'submit';
  form.appendChild(inp); form.appendChild(snd);
  var note = el('div', 'xas-n');
  [head, pick, msgs, chips, form, note].forEach(function (n) { panel.appendChild(n); });
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
  function sw() { return btn.offsetWidth || (root.classList.contains('x3') ? (big() ? 100 : 136) : 84); }
  function sh() { return btn.offsetHeight || (root.classList.contains('x3') ? (big() ? 146 : 196) : 84); }
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
  /* a box (the chat or the tip) next to the icon, on whichever side has room, never off the screen */
  function near(box, wMax, hMax, hMin) {
    var v = view(), p = S.pos, bw = Math.min(wMax, v.w - 2 * M), up = p.y > W.innerHeight / 2, s = sh(), sx = sw();
    box.style.width = bw + 'px';
    var avail = up ? p.y - 2 * M : W.innerHeight - (p.y + s) - 2 * M;
    var bh = hMax > 0 ? Math.min(hMax, avail) : box.offsetHeight;      /* the chat is as tall as the room allows; the tip is as tall as its text */
    var left, top;
    if (hMax > 0 && bh < hMin) { bh = Math.min(hMax, v.h - 2 * M); top = v.y + M; }              /* no room beside the icon: use the screen */
    else top = up ? p.y - M - bh : p.y + s + M;
    left = (p.x + sx / 2 < v.w / 2) ? p.x : p.x + sx - bw;
    left = clamp(left, M, Math.max(M, v.w - bw - M));
    box.style.left = left + 'px'; box.style.top = top + 'px'; if (hMax > 0) box.style.height = bh + 'px';
  }
  function place() { if (S.open) near(panel, 380, 560, 300); if (!tip.hidden) near(tip, 250, 0, 0); }

  /* ---- messages ---- */
  function add(who, text, res) {
    var g = el('div', 'xas-g ' + who), p = el('p'); p.textContent = who === 'bot' ? Q.bidi(text, lang()) : text; g.appendChild(p);
    if (res && res.links && res.links.length) {
      var r = el('div', 'xas-r');
      res.links.forEach(function (l) { var a = el('a', 'xas-l'); a.href = l.h; a.textContent = l.t; r.appendChild(a); });
      g.appendChild(r);
    }
    if (res && res.actions && res.actions.indexOf('contact') >= 0) g.appendChild(contacts());
    msgs.appendChild(g); msgs.scrollTop = msgs.scrollHeight;
    return g;
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
    S.loading = W.fetch('assistant-kb.json?v=1').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { S.kb = Q.prepare(j); return S.kb; }).catch(function () { S.loading = null; return null; });
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
    var dots = el('div', 'xas-g bot xas-d', '<i></i><i></i><i></i>'); dots.setAttribute('aria-hidden', 'true'); msgs.appendChild(dots); msgs.scrollTop = msgs.scrollHeight;
    var wait = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
    talk(wait + 200);
    Promise.all([load(), new Promise(function (ok) { setTimeout(ok, wait); })]).then(function (r) {
      dots.remove();
      if (!r[0]) { var g = add('bot', t().err); g.appendChild(contacts()); return; }
      add('bot', '', null); msgs.lastChild.remove();
      var res = Q.answer(r[0], q, lang());
      add('bot', res.text, res); talk(Math.min(3400, 700 + res.text.length * 22));
    });
  }
  function reset() { msgs.innerHTML = ''; S.greeted = false; if (S.open) greet(); }
  function togglePick(on) { pick.hidden = !on; look.setAttribute('aria-expanded', String(on)); place(); }

  /* ---- open / close ---- */
  function hideTip() { tip.hidden = true; clearTimeout(S.tipT); }
  function openP() {
    if (S.open) return;
    S.open = true; hideTip(); panel.hidden = false; root.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
    place(); greet(); load();
    if (S.x3) { S.x3.open(true); S.x3.hop(); }
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
    sess(TIPKEY, '1'); tip.hidden = false; near(tip, 260, 0, 0);
    S.tipT = setTimeout(hideTip, 14000);
  }

  /* ---- dragging: the icon (and the chat's title bar) can be moved anywhere ---- */
  function startDrag(e, handle) {
    if (e.button != null && e.button !== 0) return;
    S.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: S.pos.x, py: S.pos.y, moved: false, handle: handle, lx: e.clientX };
    try { handle.setPointerCapture(e.pointerId); } catch (x) { }
  }
  function moveDrag(e) {
    var d = S.drag; if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) { d.moved = true; root.classList.add('mv'); hideTip(); if (S.x3) S.x3.drag(true); }
    if (S.x3) S.x3.push(e.clientX - d.lx);
    d.lx = e.clientX;
    setPos(d.px + dx, d.py + dy); place();
  }
  function endDrag(e) {
    var d = S.drag; if (!d || e.pointerId !== d.id) return;
    S.drag = null; root.classList.remove('mv');
    if (S.x3) S.x3.drag(false);
    if (d.moved) { save(); S.justDragged = true; setTimeout(function () { S.justDragged = false; }, 60); }
  }
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
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) closeP(true); });
  W.addEventListener('resize', function () { if (S.x3) S.x3.resize(sw(), sh()); if (S.pos) { restore(); place(); } });
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
    root.classList.remove('x3'); X3.cache = {}; figs(); if (S.pos) { restore(); place(); }
    flush3d();
  }
  function start3d() {
    var X = W.XAS3D, cv, c;
    if (!X || !X.create) return fail3d();
    cv = D.createElement('canvas'); cv.className = 'xas-3d'; cv.setAttribute('aria-hidden', 'true');
    root.classList.add('x3');
    c = null;
    try { c = X.create(cv, { kind: S.ch, calm: !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches), w: sw(), h: sh(), onLost: fail3d }); } catch (x) { c = null; }
    if (!c) { root.classList.remove('x3'); return fail3d(); }
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
    var sc = D.createElement('script'); sc.src = 'assistant3d.js?v=1'; sc.async = true;
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
  S.lang = lang(); label(); figs();
  W.XAS = { sync: sync, open: openP, close: closeP, ask: ask, x3: function () { return S.x3; } };
  /* the icon needs its size to be measured before it is placed */
  root.hidden = false; restore(); root.hidden = true; sync();
})();
