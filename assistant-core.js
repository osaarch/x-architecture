/* X Assistant: the matching engine. No network, no storage: text in, answer out.
   One file used by three places: the site widget (assistant.js), the chat bots (backend/bot-worker) and the tests (scripts/test-assistant.js).
   The answers live in assistant-kb.json; edit that file, not this one, to change what the assistant says. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.XASCORE = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANGS = ['ar', 'en', 'tr', 'fr', 'ku'];
  var KU = { 'ک': 'ك', 'ی': 'ي', 'ى': 'ي', 'ە': 'ه', 'ێ': 'ي', 'ۆ': 'و', 'ۊ': 'و', 'ڕ': 'ر', 'ڵ': 'ل', 'ڤ': 'ف', 'گ': 'ك', 'چ': 'ج', 'پ': 'ب', 'ژ': 'ز' };
  var PREFIXES = ['وبال', 'ولل', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف', 'ك'];
  var MIN = 1.5; /* below this score nothing matched well enough */

  /* lower-case, no accents / Arabic marks, one spelling for the letters people mix up (أ إ آ ا, ى ي, ة ه), Kurdish letters folded to Arabic ones */
  function norm(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1632); })
         .replace(/[۰-۹]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1776); });
    s = s.normalize('NFD').replace(/[̀-ًͯ-ٰٟـ]/g, '');
    s = s.toLowerCase().replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
    s = s.replace(/ة/g, 'ه').replace(/[ڕڵۆۊێەڤگچپژکیى]/g, function (c) { return KU[c] || c; });
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  function isAr(s) { return /[؀-ۿ]/.test(s); }

  /* the spellings of one word with its Arabic prefixes (و ب ل ف ك ال) taken off */
  function variants(t) {
    var v = [t];
    if (!isAr(t)) return v;
    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (t.indexOf(p) === 0 && t.length - p.length >= 3) v.push(t.slice(p.length));
    }
    return v;
  }

  function prepKw(list, lang, w0) {
    var out = [];
    (list || []).forEach(function (k) {
      var w = w0, kw = k;
      if (Array.isArray(k)) { kw = k[0]; w = k[1]; }
      var n = norm(kw);
      if (n) out.push({ k: n, w: w, lang: lang, ph: n.indexOf(' ') >= 0, ar: isAr(n) });
    });
    return out;
  }

  /* normalise every keyword once */
  function prepare(kb) {
    if (kb._p) return kb;
    kb.intents.forEach(function (it) {
      it._k = [];
      LANGS.forEach(function (l) { it._k = it._k.concat(prepKw(it.k && it.k[l], l, it.w || 2)); });
    });
    (kb.programs || []).forEach(function (p) { p._k = prepKw(p.k.concat([p.n]), 'x', 3); });
    Object.defineProperty(kb, '_p', { value: true, enumerable: false });
    return kb;
  }

  function hit(q, toks, vs, kw) {
    if (kw.ph) return (' ' + q + ' ').indexOf(' ' + kw.k) >= 0 || (kw.ar && q.indexOf(kw.k) >= 0);
    for (var i = 0; i < toks.length; i++) {
      if (kw.ar) {
        var v = vs[i];
        for (var j = 0; j < v.length; j++) { if (v[j] === kw.k || (kw.k.length >= 3 && v[j].indexOf(kw.k) === 0)) return true; }
      } else if (toks[i] === kw.k || (kw.k.length >= 4 && toks[i].indexOf(kw.k) === 0)) return true;
    }
    return false;
  }

  /* which intent fits the text best: {id, score, langs, programs} */
  function analyse(kb, text) {
    prepare(kb);
    var q = norm(String(text || '').slice(0, 300)), toks = q ? q.split(' ') : [], vs = toks.map(variants);
    var best = null, byLang = {};
    kb.intents.forEach(function (it, idx) {
      var sc = 0;
      it._k.forEach(function (kw) {
        if (hit(q, toks, vs, kw)) { sc += kw.w; byLang[kw.lang] = (byLang[kw.lang] || 0) + kw.w; }
      });
      if (sc > 0 && (!best || sc > best.score)) best = { id: it.id, score: sc, idx: idx };
    });
    var progs = [];
    (kb.programs || []).forEach(function (p) {
      if (p._k.some(function (kw) { return hit(q, toks, vs, kw); })) progs.push(p);
    });
    return { id: best && best.score >= MIN ? best.id : null, score: best ? best.score : 0, byLang: byLang, programs: progs, q: q };
  }

  /* which of the five languages a message is written in (for the chat bots; the site uses the language of the page) */
  function detect(kb, text) {
    var s = String(text || '');
    if (/[ڕڵۆێەڤ]/.test(s)) return 'ku';
    if (isAr(s)) return 'ar';
    var a = analyse(kb, s), best = null;
    ['en', 'tr', 'fr'].forEach(function (l) { if (a.byLang[l] && (!best || a.byLang[l] > a.byLang[best])) best = l; });
    if (best) return best;
    if (/[çğışöüÇĞİŞÖÜ]/.test(s)) return 'tr';
    if (/[éèêàùâîôûëïœ]|\b(le|la|les|des|vous|je|est|quel|quels|combien)\b/i.test(s)) return 'fr';
    return 'en';
  }

  function pick(o, lang) { return o ? (o[lang] || o.en || o.ar || '') : ''; }
  function fill(t, d) { return t.replace(/\{(\w+)\}/g, function (m, k) { return d[k] == null ? m : d[k]; }); }

  function programText(kb, p, lang) {
    var P = kb.program, d = {
      name: p.n, cat: pick(P.cat[p.c], lang), dur: pick(P.dur[p.c], lang), axes: p.ax,
      pi: P.price[p.c] ? P.price[p.c][0] : '', pr: P.price[p.c] ? P.price[p.c][1] : '', u: pick(kb.units, lang)
    };
    return fill(pick(p.c === 'pc' ? P.a_pc : P.a, lang), d);
  }

  var PRICEY = { prices: 1, courses: 1, duration: 1, programs: 1, includes: 1, types: 1 };

  /* the answer: {id, text, links:[{h,t}], actions:[...], matched} */
  function answer(kb, text, lang) {
    lang = LANGS.indexOf(lang) >= 0 ? lang : 'ar';
    var a = analyse(kb, text), links = [], actions = [], out;
    if (a.programs.length && (!a.id || PRICEY[a.id])) {
      out = { id: 'program', matched: true, text: a.programs.slice(0, 3).map(function (p) { return programText(kb, p, lang); }).join('\n\n') };
      links = ['courses', 'contact'];
    } else if (a.id) {
      var it = kb.intents.filter(function (x) { return x.id === a.id; })[0];
      out = { id: it.id, matched: true, text: pick(it.a, lang) };
      links = it.l || []; actions = it.x || [];
    } else {
      out = { id: 'fallback', matched: false, text: pick(kb.fallback, lang) };
      links = ['contact']; actions = ['contact'];
    }
    out.links = links.map(function (k) { var L = kb.links[k]; return L ? { k: k, h: L.h, t: pick(L.t, lang) } : null; }).filter(Boolean);
    out.actions = actions;
    out.lang = lang;
    return out;
  }

  function greeting(kb, lang) {
    var it = kb.intents.filter(function (x) { return x.id === 'greet'; })[0];
    return pick(it && it.a, lang);
  }

  /* in Arabic and Kurdish text keep handles, e-mail addresses and links reading left-to-right, so "@name." does not turn into "name@." */
  var LTRRUN = /(https?:\/\/[^\s)،]*[^\s).،]|[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|@[A-Za-z0-9_]+|\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:site|com|net|org)\b)/g;
  function bidi(text, lang) {
    if (lang !== 'ar' && lang !== 'ku') return text;
    return String(text).replace(LTRRUN, '\u2066$1\u2069');
  }

  /* plain text for a chat app: the answer plus the site links (no platform links, only the site and the shared name) */
  function toText(kb, res, lang, opt) {
    opt = opt || {};
    var site = (kb.site || '').replace(/\/+$/, ''), t = bidi(res.text, lang);
    var ls = res.links.filter(function (l) { return l.k !== 'contact'; }).slice(0, 2);
    if (ls.length) t += '\n\n' + ls.map(function (l) { return '• ' + l.t + ': ' + site + '/' + l.h; }).join('\n');
    else if (res.actions && res.actions.indexOf('contact') >= 0 && res.id === 'fallback') t += '\n\n' + site;
    return t;
  }

  return { LANGS: LANGS, bidi: bidi, norm: norm, prepare: prepare, analyse: analyse, detect: detect, answer: answer, greeting: greeting, toText: toText, pick: pick };
});
