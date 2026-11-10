/* GENERATED FILE: do not edit. Built by scripts/build_bot.py from assistant-core.js + assistant-kb.json (2026-11-02) + backend/bot-worker/welcome.json + backend/bot-worker/glue.js */
const XASCORE = (function () {
  var module = { exports: {} };
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
  return module.exports;
})();
const KB = XASCORE.prepare({"version":1,"updated":"2026-11-02","site":"https://xarch.site","handle":"xstudio4arch","email":"info@xarch.site","units":{"ar":"ألف د.ع","en":"K IQD","tr":"bin IQD","fr":"k IQD","ku":"هەزار د.ع"},"links":{"services":{"h":"#services","t":{"ar":"الخدمات","en":"Services","tr":"Hizmetler","fr":"Services","ku":"خزمەتەکان"}},"courses":{"h":"#courses","t":{"ar":"الدورات والأسعار","en":"Courses and prices","tr":"Kurslar ve fiyatlar","fr":"Cours et tarifs","ku":"خولەکان و نرخەکان"}},"library":{"h":"#library","t":{"ar":"المكتبة","en":"Library","tr":"Kütüphane","fr":"Bibliothèque","ku":"کتێبخانە"}},"ai":{"h":"#lib-ai","t":{"ar":"برومبتات الذكاء الاصطناعي","en":"AI prompts","tr":"Yapay zekâ istemleri","fr":"Prompts IA","ku":"پرۆمپتەکانی ژیری دەستکرد"}},"community":{"h":"#community","t":{"ar":"المجتمع","en":"Community","tr":"Topluluk","fr":"Communauté","ku":"کۆمەڵگە"}},"competitions":{"h":"#competitions","t":{"ar":"المسابقات","en":"Competitions","tr":"Yarışmalar","fr":"Concours","ku":"پێشبڕکێکان"}},"works":{"h":"#works","t":{"ar":"أعمال الطلاب","en":"Student work","tr":"Öğrenci çalışmaları","fr":"Travaux d’étudiants","ku":"کارەکانی قوتابیان"}},"news":{"h":"#news","t":{"ar":"الأخبار","en":"News","tr":"Haberler","fr":"Actualités","ku":"هەواڵەکان"}},"contact":{"h":"#contact","t":{"ar":"تواصل","en":"Contact","tr":"İletişim","fr":"Contact","ku":"پەیوەندی"}},"join":{"h":"#join","t":{"ar":"سجّل في المنصة","en":"Join the platform","tr":"Platforma katılın","fr":"Rejoindre la plateforme","ku":"تۆمارکردن لە پلاتفۆرم"}}},"intents":[{"id":"greet","w":2,"k":{"ar":["مرحبا","مرحبتين","هلا","اهلا","يا هلا","سلام","السلام عليكم","صباح الخير","مساء الخير","هاي","هلو","هلاو"],"en":["hi","hello","hey","good morning","good evening","greetings"],"tr":["merhaba","selam","gunaydin","iyi aksamlar"],"fr":["bonjour","salut","bonsoir","coucou"],"ku":["سلاو","سڵاو","بەیانی باش","ئێوارە باش"]},"a":{"ar":"أهلاً بك! أنا إكس المساعد. اسألني عن خدماتنا ودوراتنا وأسعارها، أو عن أي قسم في الموقع.","en":"Welcome! I’m X Assistant. Ask me about our services, courses and prices, or about any section of the site.","tr":"Hoş geldiniz! Ben X Asistan. Hizmetlerimiz, kurslarımız ve fiyatlarımız ya da sitenin herhangi bir bölümü hakkında soru sorabilirsiniz.","fr":"Bienvenue ! Je suis l’assistant X. Posez-moi vos questions sur nos services, nos cours et nos tarifs, ou sur n’importe quelle section du site.","ku":"بەخێربێیت! من یاریدەدەری X م. لەبارەی خزمەتگوزارییەکان و خولەکان و نرخەکانمان یان هەر بەشێکی ماڵپەڕەکە بپرسە."}},{"id":"thanks","w":2,"k":{"ar":["شكرا","مشكور","تسلم","يعطيك العافيه","ممنون","الله يعطيك","مع السلامه","وداعا","يسلمو"],"en":["thanks","thank you","thx","bye","goodbye"],"tr":["tesekkur","sag ol","tesekkurler","hosca kal","gorusuruz"],"fr":["merci","au revoir","a bientot"],"ku":["سوپاس","مەمنون","خوا حافیز","سەرچاوەت"]},"a":{"ar":"العفو! إذا عندك سؤال آخر أنا حاضر.","en":"You’re welcome! If you have another question, I’m here.","tr":"Rica ederim! Başka bir sorunuz olursa buradayım.","fr":"Avec plaisir ! Si vous avez une autre question, je suis là.","ku":"تکایە! ئەگەر پرسیارێکی ترت هەیە، لێرەم."}},{"id":"about","w":3,"k":{"ar":["من انتم","منو انتم","شنو انتم","مين انتم","عن المنصه","ما هي المنصه","شنو المنصه","تعريف بالمنصه","من انت","شنو انت","مين انت"],"en":["who are you","about you","about the platform","what is x architecture","what is this site","what is this platform"],"tr":["kimsiniz","hakkinizda","platform nedir","siz kimsiniz"],"fr":["qui etes vous","qui êtes vous","a propos","c est quoi","qu est ce que"],"ku":["تۆ کێیت","ئێوە کێن","دەربارەی پلاتفۆرم","چییە ئەم پلاتفۆرمە"]},"a":{"ar":"X للعمارة منصة معمارية للطلاب: خدمات إظهار وتصميم ونقد وإشراف، ودورات في برامج العمارة، وأعمال طلاب، ومكتبة كتب وملفات وبرامج مجانية أو بسعر طلابي.","en":"X Architecture is an architecture platform for students: visualization, design, critique and supervision services, courses in architecture software, student work, and a library of books, files and free or student-priced software.","tr":"X Architecture, öğrenciler için bir mimarlık platformudur: görselleştirme, tasarım, eleştiri ve denetim hizmetleri, mimarlık yazılımı kursları, öğrenci çalışmaları ve ücretsiz ya da öğrenci fiyatlı kitap, dosya ve yazılımlardan oluşan bir kütüphane.","fr":"X Architecture est une plateforme d’architecture pour les étudiants : visualisation, conception, critique et suivi, cours sur les logiciels d’architecture, travaux d’étudiants et une bibliothèque de livres, fichiers et logiciels gratuits ou à tarif étudiant.","ku":"X Architecture پلاتفۆرمێکی تەلارسازییە بۆ قوتابیان: خزمەتگوزاری ڕێندەر و دیزاین و ڕەخنە و سەرپەرشتی، خول لە بەرنامەکانی تەلارسازی، کارەکانی قوتابیان، و کتێبخانەیەک لە کتێب و فایل و بەرنامەی بێبەرامبەر یان بە نرخی قوتابی."},"l":["services","library"]},{"id":"services","w":3,"k":{"ar":["خدمات","خدمه","خدماتكم","شنو تسوون","شتسوون","شنو تقدمون","شنو عندكم","ماذا تقدمون","ايش تقدمون","شو تقدمون","شنو تشتغلون"],"en":["services","service","what do you offer","what do you do","what can you do","what you offer"],"tr":["hizmet","hizmetler","neler yapiyorsunuz","ne sunuyorsunuz"],"fr":["services","service","que proposez","que faites vous","quels services"],"ku":["خزمەتگوزاری","خزمەتەکان","چی پێشکەش دەکەن","چی دەکەن"]},"a":{"ar":"نقدّم:\n• تصميم معماري لأصحاب المشاريع والعملاء\n• إظهار معماري (مناظير خارجية وداخلية)\n• نقد معماري للطلاب\n• إشراف ومتابعة للطلاب\n• دورات في برامج العمارة\nاسألني عن أي خدمة لأشرح لك التفاصيل.","en":"We offer:\n• Architectural design for clients and project owners\n• Architectural visualization (exterior and interior renders)\n• Architectural critique for students\n• Supervision and follow-up for students\n• Courses in architecture software\nAsk about any of them for details.","tr":"Sunduklarımız:\n• Müşteriler ve proje sahipleri için mimari tasarım\n• Mimari görselleştirme (dış ve iç mekân)\n• Öğrenciler için mimari eleştiri\n• Öğrenciler için denetim ve takip\n• Mimarlık yazılımı kursları\nAyrıntı için istediğiniz hizmeti sorabilirsiniz.","fr":"Nous proposons :\n• Conception architecturale pour les clients et porteurs de projet\n• Visualisation architecturale (extérieur et intérieur)\n• Critique architecturale pour les étudiants\n• Suivi et supervision des étudiants\n• Cours sur les logiciels d’architecture\nDemandez-moi les détails de chacun.","ku":"ئەوەی پێشکەشی دەکەین:\n• دیزاینی تەلارسازی بۆ کڕیار و خاوەن پڕۆژەکان\n• ڕێندەری تەلارسازی (دەرەوە و ناوەوە)\n• ڕەخنەی تەلارسازی بۆ قوتابیان\n• سەرپەرشتی و شوێنکەوتن بۆ قوتابیان\n• خول لە بەرنامەکانی تەلارسازی\nلەبارەی هەر یەکێکیان بپرسە بۆ وردەکاری."},"l":["services","courses"]},{"id":"design","w":2.5,"k":{"ar":["تصميم معماري","تصميم بيت","تصميم فيلا","تصميم مشروع","اصمم","تصممون","تصمملي","صممولي","مخططات","مشروع طالب","مشاريع الطلاب","حل مشروعي","تسوون مشروعي",["تصميم",1.5]],"en":["architectural design","design my","design a house","design a villa","student projects","student project","do you design",["design",1.5],"floor plans"],"tr":["mimari tasarim","tasarim","tasarlar misiniz","ogrenci projesi","ogrenci projeleri"],"fr":["conception","concevez","projets d etudiants","projet d etudiant","dessiner ma maison"],"ku":["دیزاینی تەلارسازی","دیزاین","پڕۆژەی قوتابی","پڕۆژەی قوتابیان"]},"a":{"ar":"التصميم المعماري لأصحاب المشاريع والعملاء: من الفكرة الأولى حتى المخططات والتسليم، بما يناسب موقعك واحتياجاتك وميزانيتك. تحصل على تصور أولي، ومخططات ومقاطع وواجهات، ونموذج ثلاثي الأبعاد ومناظير، وتسليم الملفات كاملة.\nملاحظة: لا نصمّم مشاريع الطلاب، نقدّم لهم النقد والإشراف والمتابعة فقط.\nأسعار هذه الخدمة غير معلنة على الموقع، تواصل معنا بتفاصيل مشروعك لنرتّب الخطوات.","en":"Architectural design for clients and project owners: from the first idea to drawings and handover, fitted to your site, needs and budget. You get a preliminary concept, plans, sections and elevations, a 3D model with views, and the full project files.\nNote: we do not design students’ projects; for students we offer critique, supervision and follow-up only.\nPrices for this service are not listed on the site; contact us with your project details and we will arrange the next steps.","tr":"Müşteriler ve proje sahipleri için mimari tasarım: ilk fikirden çizimlere ve teslime kadar, arsanıza, ihtiyaçlarınıza ve bütçenize uygun. Ön tasarım, planlar, kesitler ve cepheler, 3B model ve görseller ile projenin tüm dosyalarını teslim alırsınız.\nNot: Öğrenci projelerini biz tasarlamıyoruz; öğrencilere yalnızca eleştiri, denetim ve takip sunuyoruz.\nBu hizmetin fiyatları sitede yayımlanmamıştır; proje ayrıntılarınızla bize ulaşın, sonraki adımları birlikte planlayalım.","fr":"Conception architecturale pour les clients et porteurs de projet : de la première idée aux plans et à la livraison, adaptée à votre terrain, vos besoins et votre budget. Vous recevez un concept préliminaire, des plans, coupes et façades, un modèle 3D avec des vues, et tous les fichiers du projet.\nRemarque : nous ne concevons pas les projets des étudiants ; nous leur offrons uniquement critique, suivi et accompagnement.\nLes tarifs de ce service ne sont pas affichés sur le site ; contactez-nous avec les détails de votre projet et nous organiserons la suite.","ku":"دیزاینی تەلارسازی بۆ خاوەن پڕۆژە و کڕیارەکان: لە یەکەم بیرۆکەوە تا نەخشە و تەسلیمکردن، بەپێی شوێن و پێداویستی و بودجەکەت. تێڕوانینێکی سەرەتایی، نەخشە و بڕگە و ڕووکار، مۆدێلی سێ ڕەهەندی لەگەڵ ڕێندەر، و هەموو فایلەکانی پڕۆژەکەت وەردەگریت.\nتێبینی: ئێمە پڕۆژەی قوتابیان دیزاین ناکەین؛ تەنیا ڕەخنە و سەرپەرشتی و شوێنکەوتنیان بۆ دەکەین.\nنرخی ئەم خزمەتگوزارییە لە ماڵپەڕەکەدا بڵاو نەکراوەتەوە؛ بە وردەکاری پڕۆژەکەتەوە پەیوەندیمان پێوە بکە و هەنگاوەکانی دواتر ڕێک دەخەین."},"l":["services","contact"]},{"id":"viz","w":2,"k":{"ar":["اظهار","ريندر","رندر","مناظير","منظور","مجسم","مجسمات"],"en":["visualization","visualisation","rendering","renders","render my",["render",1.5],"3d views","perspective views"],"tr":["gorsellestirme","render","gorsel"],"fr":["visualisation","rendu","rendus","perspective"],"ku":["ڕێندەر","ڕێندەری","ڤیژواڵایزەیشن"]},"a":{"ar":"الإظهار المعماري للطلاب وأصحاب المشاريع: نحوّل تصميمك إلى مناظير واقعية بإضاءة وخامات تُبرز فكرة المشروع. تحصل على مناظير خارجية للواجهات، ومناظير داخلية للفضاءات، وصور عالية الجودة جاهزة للعرض.\nأسعار هذه الخدمة غير معلنة على الموقع، تواصل معنا بتفاصيل مشروعك لنرتّب الخطوات.","en":"Architectural visualization for students and project owners: we turn your design into realistic renders with lighting and materials that bring out the idea. You get exterior renders of the facades, interior renders of the spaces, and high-quality images ready to present.\nPrices for this service are not listed on the site; contact us with your project details and we will arrange the next steps.","tr":"Öğrenciler ve proje sahipleri için mimari görselleştirme: tasarımınızı, projenin fikrini öne çıkaran ışık ve malzemelerle gerçekçi görsellere dönüştürürüz. Cepheler için dış mekân, mekânlar için iç mekân görselleri ve sunuma hazır yüksek kaliteli resimler alırsınız.\nBu hizmetin fiyatları sitede yayımlanmamıştır; proje ayrıntılarınızla bize ulaşın, sonraki adımları birlikte planlayalım.","fr":"Visualisation architecturale pour les étudiants et porteurs de projet : nous transformons votre conception en rendus réalistes, avec une lumière et des matériaux qui mettent en valeur l’idée. Vous obtenez des rendus extérieurs des façades, des rendus intérieurs des espaces et des images haute qualité prêtes à présenter.\nLes tarifs de ce service ne sont pas affichés sur le site ; contactez-nous avec les détails de votre projet et nous organiserons la suite.","ku":"ڕێندەری تەلارسازی بۆ قوتابیان و خاوەن پڕۆژەکان: دیزاینەکەت دەگۆڕین بۆ ڕێندەری واقیعی بە ڕووناکی و ماددەیەک کە بیرۆکەی پڕۆژەکە دەرببڕێت. ڕێندەری دەرەوەی ڕووکارەکان، ڕێندەری ناوەوەی شوێنەکان، و وێنەی بەرزی کوالێتی ئامادە بۆ پێشکەشکردن وەردەگریت.\nنرخی ئەم خزمەتگوزارییە لە ماڵپەڕەکەدا بڵاو نەکراوەتەوە؛ بە وردەکاری پڕۆژەکەتەوە پەیوەندیمان پێوە بکە و هەنگاوەکانی دواتر ڕێک دەخەین."},"l":["services","contact"]},{"id":"critique","w":2.5,"k":{"ar":["نقد","تقييم مشروعي","رايكم بمشروعي","ملاحظات على مشروعي","تقييم","راجعوا مشروعي"],"en":["critique","feedback","review my project","evaluate my project","criticism"],"tr":["elestiri","geri bildirim","projemi degerlendir"],"fr":["critique","retour sur mon projet","evaluer mon projet","avis sur mon projet"],"ku":["ڕەخنە","ڕەخنەی تەلارسازی","هەڵسەنگاندن"]},"a":{"ar":"النقد المعماري للطلاب: قراءة صريحة لمشروعك (الفكرة والمخططات والإخراج) مع ملاحظات واضحة للتطوير قبل التسليم: تقييم الفكرة ومنطق التصميم، وملاحظات على المخططات والمقاطع، وعلى الإخراج واللوحات، ونقاط واضحة للتطوير.\nأسعار هذه الخدمة غير معلنة على الموقع، تواصل معنا بتفاصيل مشروعك لنرتّب الخطوات.","en":"Architectural critique for students: a frank reading of your project (the idea, the drawings, the presentation) with clear notes to improve it before submission: evaluation of the idea and design logic, notes on plans and sections, notes on presentation and boards, and clear points to develop.\nPrices for this service are not listed on the site; contact us with your project details and we will arrange the next steps.","tr":"Öğrenciler için mimari eleştiri: projenizin (fikir, çizimler, sunum) açık sözlü bir okuması ve teslimden önce geliştirmeniz için net notlar: fikrin ve tasarım mantığının değerlendirmesi, plan ve kesitler ile sunum paftaları hakkında notlar ve geliştirilecek net noktalar.\nBu hizmetin fiyatları sitede yayımlanmamıştır; proje ayrıntılarınızla bize ulaşın, sonraki adımları birlikte planlayalım.","fr":"Critique architecturale pour les étudiants : une lecture franche de votre projet (l’idée, les plans, la présentation) avec des remarques claires pour l’améliorer avant le rendu : évaluation de l’idée et de la logique du projet, remarques sur les plans et coupes, sur la présentation et les planches, et des points clairs à développer.\nLes tarifs de ce service ne sont pas affichés sur le site ; contactez-nous avec les détails de votre projet et nous organiserons la suite.","ku":"ڕەخنەی تەلارسازی بۆ قوتابیان: خوێندنەوەیەکی ڕاستگۆیانەی پڕۆژەکەت (بیرۆکە و نەخشە و پێشکەشکردن) لەگەڵ تێبینی ڕوون بۆ پەرەپێدانی پێش تەسلیمکردن: هەڵسەنگاندنی بیرۆکە و لۆجیکی دیزاین، تێبینی لەسەر نەخشە و بڕگەکان و لەسەر پێشکەشکردن و لەوحەکان، و خاڵی ڕوون بۆ پەرەپێدان.\nنرخی ئەم خزمەتگوزارییە لە ماڵپەڕەکەدا بڵاو نەکراوەتەوە؛ بە وردەکاری پڕۆژەکەتەوە پەیوەندیمان پێوە بکە و هەنگاوەکانی دواتر ڕێک دەخەین."},"l":["services","contact"]},{"id":"supervision","w":2.5,"k":{"ar":["اشراف","متابعه مشروع","مشروع التخرج","تخرج","مشروع تخرجي","ارافقني",["متابعه",1.5]],"en":["supervision","supervise","mentoring","graduation project","follow-up","follow up"],"tr":["denetim","danismanlik","mezuniyet projesi","takip"],"fr":["supervision","suivi","projet de fin d etudes","accompagnement","encadrement"],"ku":["سەرپەرشتی","شوێنکەوتن","پڕۆژەی دەرچوون"]},"a":{"ar":"الإشراف والمتابعة للطلاب: نرافقك خطوة بخطوة حتى الإنجاز؛ متابعة مستمرة لمراحل المشروع، وتوجيه في كل مرحلة، ومراجعة للعمل قبل كل تسليم، وتنظيم للوقت وترتيب للأولويات.\nأسعار هذه الخدمة غير معلنة على الموقع، تواصل معنا بتفاصيل مشروعك لنرتّب الخطوات.","en":"Supervision and follow-up for students: we accompany you step by step until completion; continuous follow-up of the project stages, guidance at every stage, a review of the work before each submission, and help organizing your time and priorities.\nPrices for this service are not listed on the site; contact us with your project details and we will arrange the next steps.","tr":"Öğrenciler için denetim ve takip: tamamlanana kadar adım adım yanınızdayız; proje aşamalarının sürekli takibi, her aşamada yönlendirme, her tesliminden önce çalışmanın gözden geçirilmesi ve zaman ile önceliklerin düzenlenmesi.\nBu hizmetin fiyatları sitede yayımlanmamıştır; proje ayrıntılarınızla bize ulaşın, sonraki adımları birlikte planlayalım.","fr":"Suivi et supervision pour les étudiants : nous vous accompagnons pas à pas jusqu’à l’achèvement ; suivi continu des étapes du projet, orientation à chaque étape, relecture du travail avant chaque rendu, et aide pour organiser votre temps et vos priorités.\nLes tarifs de ce service ne sont pas affichés sur le site ; contactez-nous avec les détails de votre projet et nous organiserons la suite.","ku":"سەرپەرشتی و شوێنکەوتن بۆ قوتابیان: هەنگاو بە هەنگاو لەگەڵتین تا تەواوبوون؛ شوێنکەوتنی بەردەوامی قۆناغەکانی پڕۆژە، ڕێنمایی لە هەر قۆناغێکدا، پێداچوونەوەی کار پێش هەر تەسلیمکردنێک، و ڕێکخستنی کات و ئەولەویەتەکان.\nنرخی ئەم خزمەتگوزارییە لە ماڵپەڕەکەدا بڵاو نەکراوەتەوە؛ بە وردەکاری پڕۆژەکەتەوە پەیوەندیمان پێوە بکە و هەنگاوەکانی دواتر ڕێک دەخەین."},"l":["services","contact"]},{"id":"courses","w":2,"k":{"ar":[["دوره",3.5],["دورات",3.5],["كورس",3.5],["كورسات",3.5],"تدريب","تعلم","اتعلم","تعليم","تدرسون","تدرسوني","محاضرات"],"en":[["course",3.5],["courses",3.5],"training","learn","lessons","teach","class","classes"],"tr":[["kurs",3.5],["kurslar",3.5],"egitim","ders","ogrenmek"],"fr":[["cours",3.5],["formation",3.5],["formations",3.5],"apprendre","enseignez"],"ku":[["خول",3.5],["خولەکان",3.5],"فێربوون","وانە","ڕاهێنان"]},"a":{"ar":"دوراتنا نوعان:\n• تفاعلية: مجموعات أسبوعية على مدار العام، بمعدل ساعتين للمحاضرة والتوقيت بالتوافق مع المشتركين، مع شرح مباشر وأسئلة.\n• مسجّلة: محاضرات منظّمة، فترة تجريبية 24 ساعة قبل الاشتراك ثم وصول دائم مع دعم.\nنغطي برامج ثلاثية الأبعاد وبرامج إظهار معماري وتعليم الحاسوب. اسألني عن سعر أو مدة أي برنامج.","en":"We have two kinds of courses:\n• Live: weekly groups all year round, two hours per lecture, with timing agreed with the participants, live explanation and questions.\n• Recorded: organized recorded lectures, a 24-hour trial before you subscribe, then permanent access with support.\nWe cover 3D programs, architectural rendering programs and computer education. Ask me the price or duration of any program.","tr":"İki tür kursumuz var:\n• Canlı: yıl boyunca haftalık gruplar, ders başına iki saat, zamanlama katılımcılarla uyumlu; canlı anlatım ve soru imkânı.\n• Kayıtlı: düzenli kayıtlı dersler, abonelikten önce 24 saatlik deneme, sonrasında destekle birlikte kalıcı erişim.\n3B programlar, mimari görselleştirme programları ve bilgisayar eğitimi veriyoruz. Herhangi bir programın fiyatını veya süresini sorabilirsiniz.","fr":"Nous avons deux types de cours :\n• En direct : des groupes hebdomadaires toute l’année, deux heures par séance, horaires convenus avec les participants, explications en direct et questions.\n• Enregistrés : des cours structurés, un essai de 24 heures avant de vous inscrire, puis un accès permanent avec assistance.\nNous couvrons les logiciels 3D, les logiciels de rendu architectural et l’informatique. Demandez-moi le prix ou la durée de n’importe quel logiciel.","ku":"دوو جۆر خولمان هەیە:\n• ڕاستەوخۆ: گروپی هەفتانە بە درێژایی ساڵ، هەر وانەیەک دوو کاتژمێر، کاتەکانیش بە ڕێککەوتن لەگەڵ بەشداربووان، لەگەڵ ڕوونکردنەوەی ڕاستەوخۆ و پرسیار.\n• تۆمارکراو: وانەی تۆمارکراو و ڕێکخراو، 24 کاتژمێر تاقیکردنەوە پێش بەشداریکردن، دواتر دەستگەیشتنی هەمیشەیی لەگەڵ پشتگیری.\nبەرنامە سێ ڕەهەندییەکان و بەرنامەکانی ڕێندەر و خولی کۆمپیوتەر دەگرینەوە. لەبارەی نرخ یان ماوەی هەر بەرنامەیەک بپرسە."},"l":["courses","contact"]},{"id":"types","w":3,"k":{"ar":["تفاعليه","مسجله","مباشره","اونلاين","فتره تجريبيه","تجريبيه","فرق بين الدورات","الفرق بين","مسجلين","وين تنعقد"],"en":["interactive","recorded","live course","live courses","trial","difference between","online course"],"tr":["canli kurs","kayitli kurs","canli","kayitli","deneme suresi","fark nedir"],"fr":["en direct","enregistre","enregistres","essai","difference entre"],"ku":["ڕاستەوخۆ","تۆمارکراو","تاقیکردنەوە","جیاوازی"]},"a":{"ar":"الدورات التفاعلية: مجموعات أسبوعية على مدار العام (ساعتان للمحاضرة)، بشرح مباشر وإمكانية طرح الأسئلة وبرنامج منظّم متسلسل. يمكنك الانضمام لمجموعة أو تكوين مجموعتك مع أصدقائك، والمواعيد مرنة.\nالدورات المسجّلة: محاضرات مسجّلة ومنظّمة تغطي البرنامج بالتفصيل، بفترة تجريبية 24 ساعة قبل الاشتراك ثم وصول دائم مع دعم للإجابة عن استفساراتك.\nالتفاعلية أعلى سعراً من المسجّلة، اسألني عن الأسعار.","en":"Live courses: weekly groups all year round (two hours per lecture), with live explanation, a chance to ask questions and an organized sequential program. You can join a group or form your own with friends, and the timing is flexible.\nRecorded courses: organized recorded lectures that cover the software in detail, with a 24-hour trial before you subscribe, then permanent access with support for your questions.\nLive courses cost more than recorded ones; ask me about prices.","tr":"Canlı kurslar: yıl boyunca haftalık gruplar (ders başına iki saat), canlı anlatım, soru sorma imkânı ve düzenli, sıralı bir program. Bir gruba katılabilir ya da arkadaşlarınızla kendi grubunuzu kurabilirsiniz; zamanlama esnektir.\nKayıtlı kurslar: programı ayrıntılı biçimde ele alan düzenli kayıtlı dersler; abonelikten önce 24 saatlik deneme, sonrasında sorularınız için destekle birlikte kalıcı erişim.\nCanlı kurslar kayıtlılardan daha pahalıdır; fiyatları sorabilirsiniz.","fr":"Cours en direct : des groupes hebdomadaires toute l’année (deux heures par séance), avec explications en direct, possibilité de poser des questions et un programme structuré et progressif. Vous pouvez rejoindre un groupe ou former le vôtre avec des amis, et les horaires sont flexibles.\nCours enregistrés : des cours structurés qui couvrent le logiciel en détail, avec un essai de 24 heures avant de vous inscrire, puis un accès permanent avec une aide pour vos questions.\nLes cours en direct coûtent plus cher que les cours enregistrés ; demandez-moi les tarifs.","ku":"خولە ڕاستەوخۆکان: گروپی هەفتانە بە درێژایی ساڵ (هەر وانەیەک دوو کاتژمێر)، بە ڕوونکردنەوەی ڕاستەوخۆ و دەرفەتی پرسیارکردن و بەرنامەیەکی ڕێکخراوی زنجیرەیی. دەتوانیت بەشداری گروپێک بکەیت یان لەگەڵ هاوڕێکانت گروپی خۆت دروست بکەیت، کاتەکانیش نەرمن.\nخولە تۆمارکراوەکان: وانەی تۆمارکراو و ڕێکخراو کە بەرنامەکە بە وردی دەگرێتەوە، 24 کاتژمێر تاقیکردنەوە پێش بەشداریکردن، دواتر دەستگەیشتنی هەمیشەیی لەگەڵ پشتگیری.\nنرخی خولە ڕاستەوخۆکان لە تۆمارکراوەکان زیاترە؛ لەبارەی نرخەکان بپرسە."},"l":["courses"]},{"id":"duration","w":4,"k":{"ar":["مده","كم يوم","كم تاخذ","شكد تاخذ","كم تستمر","كم تدوم","شكد تدوم","كم اسبوع","محاور","كم محور"],"en":["duration","how long","how many days","how many weeks","how many hours","length of the course"],"tr":["sure","suresi","kac gun","kac hafta","ne kadar surer"],"fr":["duree","combien de temps","combien de jours","combien de semaines"],"ku":["ماوە","چەند ڕۆژ","چەند هەفتە","چەند ماوە"]},"a":{"ar":"مدة دورات البرامج ثلاثية الأبعاد 15–20 يوماً، ودورات الإظهار المعماري وتعليم الحاسوب 7–10 أيام. كل دورة تغطي 20 محوراً (Blender 19 محوراً). في الدورات التفاعلية المحاضرة ساعتان والتوقيت بالتوافق مع المشتركين.","en":"Courses in the 3D programs last 15–20 days, and the architectural rendering and computer-education courses 7–10 days. Each course covers 20 topics (Blender 19). In live courses a lecture is two hours and the timing is agreed with the participants.","tr":"3B program kursları 15–20 gün, mimari görselleştirme ve bilgisayar eğitimi kursları 7–10 gün sürer. Her kurs 20 konuyu kapsar (Blender 19). Canlı kurslarda ders iki saattir ve zamanlama katılımcılarla birlikte belirlenir.","fr":"Les cours des logiciels 3D durent 15 à 20 jours, et ceux de rendu architectural et d’informatique 7 à 10 jours. Chaque cours couvre 20 thèmes (Blender 19). En direct, une séance dure deux heures et les horaires sont convenus avec les participants.","ku":"ماوەی خولی بەرنامە سێ ڕەهەندییەکان 15 بۆ 20 ڕۆژە، و خولی ڕێندەر و کۆمپیوتەر 7 بۆ 10 ڕۆژ. هەر خولێک 20 تەوەر دەگرێتەوە (Blender 19). لە خولە ڕاستەوخۆکاندا هەر وانەیەک دوو کاتژمێرە و کاتەکان بە ڕێککەوتن لەگەڵ بەشداربووان دیاری دەکرێن."},"l":["courses"]},{"id":"programs","w":3,"k":{"ar":["برامج","البرامج","شنو البرامج","ايش البرامج","اي برنامج","شنو تدرسون","برنامج"],"en":["programs","software","which programs","what software","which software","program list"],"tr":["programlar","yazilim","hangi programlar","hangi yazilim"],"fr":["logiciels","programmes","quels logiciels","quels programmes"],"ku":["بەرنامەکان","کام بەرنامە","نەرمەکاڵا"]},"a":{"ar":"برامج ثلاثية الأبعاد: AutoCAD (ثنائي وثلاثي الأبعاد)، Revit، 3ds Max، SketchUp، Rhinoceros، Grasshopper، Blender، Maya، Unreal Engine.\nبرامج الإظهار المعماري: Corona، Lumion، D5 Render، V-Ray، Enscape، Twinmotion، Vantage، Photoshop، Illustrator.\nوتعليم الحاسوب يُقدَّم ضمن العروض. اكتب اسم أي برنامج لأعطيك سعره ومدته.","en":"3D programs: AutoCAD (2D and 3D), Revit, 3ds Max, SketchUp, Rhinoceros, Grasshopper, Blender, Maya, Unreal Engine.\nArchitectural rendering programs: Corona, Lumion, D5 Render, V-Ray, Enscape, Twinmotion, Vantage, Photoshop, Illustrator.\nComputer education is offered within the bundles. Type the name of any program and I’ll give you its price and duration.","tr":"3B programlar: AutoCAD (2B ve 3B), Revit, 3ds Max, SketchUp, Rhinoceros, Grasshopper, Blender, Maya, Unreal Engine.\nMimari görselleştirme programları: Corona, Lumion, D5 Render, V-Ray, Enscape, Twinmotion, Vantage, Photoshop, Illustrator.\nBilgisayar eğitimi kampanyaların içinde sunulur. Bir programın adını yazın, fiyatını ve süresini söyleyeyim.","fr":"Logiciels 3D : AutoCAD (2D et 3D), Revit, 3ds Max, SketchUp, Rhinoceros, Grasshopper, Blender, Maya, Unreal Engine.\nLogiciels de rendu architectural : Corona, Lumion, D5 Render, V-Ray, Enscape, Twinmotion, Vantage, Photoshop, Illustrator.\nL’informatique est proposée dans les offres. Écrivez le nom d’un logiciel et je vous donne son prix et sa durée.","ku":"بەرنامە سێ ڕەهەندییەکان: AutoCAD (دوو و سێ ڕەهەندی)، Revit، 3ds Max، SketchUp، Rhinoceros، Grasshopper، Blender، Maya، Unreal Engine.\nبەرنامەکانی ڕێندەری تەلارسازی: Corona، Lumion، D5 Render، V-Ray، Enscape، Twinmotion، Vantage، Photoshop، Illustrator.\nفێرکردنی کۆمپیوتەر لەناو پێشنیارەکاندا پێشکەش دەکرێت. ناوی هەر بەرنامەیەک بنووسە با نرخ و ماوەکەی پێت بڵێم."},"l":["courses"]},{"id":"prices","w":3.5,"k":{"ar":["اسعار","سعر","سعركم","شكد","بكم","كم سعر","كم تكلف","تكلفه","كلفه","اجور","كم الاجور","كم المبلغ","تسعيره","اسعاركم","فلوس","كم ياخذ"],"en":["price","prices","pricing","cost","costs","how much","fee","fees","rates","tuition"],"tr":["fiyat","fiyatlar","ucret","ucretler","kac para","ne kadar","maliyet"],"fr":["prix","tarif","tarifs","combien","cout","frais"],"ku":["نرخ","نرخەکان","بە چەند","چەندە","کرێ"]},"a":{"ar":"أسعار الدورات (بآلاف الدنانير العراقية):\n• التفاعلية: برامج ثلاثية الأبعاد 250 ألف د.ع ≈ $150، وبرامج الإظهار 125 ألف د.ع ≈ $75\n• المسجّلة: برامج ثلاثية الأبعاد 175 ألف د.ع ≈ $105، وبرامج الإظهار 85 ألف د.ع ≈ $50\nوهناك عروض مجمّعة تبدأ من 220 ألف د.ع ≈ $135.\nأما خدمات التصميم والإظهار والنقد والإشراف فأسعارها غير معلنة على الموقع، تواصل معنا بتفاصيل مشروعك.","en":"Course prices (in thousands of Iraqi dinars):\n• Live: 3D programs 250K IQD ≈ $150, rendering programs 125K IQD ≈ $75\n• Recorded: 3D programs 175K IQD ≈ $105, rendering programs 85K IQD ≈ $50\nThere are also bundles starting from 220K IQD ≈ $135.\nPrices for the design, visualization, critique and supervision services are not listed on the site; contact us with your project details.","tr":"Kurs fiyatları (bin Irak dinarı olarak):\n• Canlı: 3B programlar 250 bin IQD ≈ $150, görselleştirme programları 125 bin IQD ≈ $75\n• Kayıtlı: 3B programlar 175 bin IQD ≈ $105, görselleştirme programları 85 bin IQD ≈ $50\n220 bin IQD ≈ $135’den başlayan kampanyalar da var.\nTasarım, görselleştirme, eleştiri ve denetim hizmetlerinin fiyatları sitede yayımlanmamıştır; proje ayrıntılarınızla bize ulaşın.","fr":"Tarifs des cours (en milliers de dinars irakiens) :\n• En direct : logiciels 3D 250 k IQD ≈ $150, logiciels de rendu 125 k IQD ≈ $75\n• Enregistrés : logiciels 3D 175 k IQD ≈ $105, logiciels de rendu 85 k IQD ≈ $50\nIl existe aussi des offres groupées à partir de 220 k IQD ≈ $135.\nLes tarifs des services de conception, visualisation, critique et suivi ne sont pas affichés sur le site ; contactez-nous avec les détails de votre projet.","ku":"نرخی خولەکان (بە هەزار دیناری عێراقی):\n• ڕاستەوخۆ: بەرنامە سێ ڕەهەندییەکان 250 هەزار د.ع ≈ $150، بەرنامەکانی ڕێندەر 125 هەزار د.ع ≈ $75\n• تۆمارکراو: بەرنامە سێ ڕەهەندییەکان 175 هەزار د.ع ≈ $105، بەرنامەکانی ڕێندەر 85 هەزار د.ع ≈ $50\nهەروەها پێشنیاری کۆکراوە هەیە لە 220 هەزار د.ع ≈ $135 دەست پێدەکات.\nنرخی خزمەتگوزارییەکانی دیزاین و ڕێندەر و ڕەخنە و سەرپەرشتی لە ماڵپەڕەکەدا بڵاو نەکراوەتەوە؛ بە وردەکاری پڕۆژەکەتەوە پەیوەندیمان پێوە بکە."},"l":["courses","contact"]},{"id":"offers","w":3,"k":{"ar":["عروض","عرض","باقه","باقات","خصم","تخفيض","تخفيضات","اوفر","عرض اول","عرض ثاني","عرض ثالث"],"en":["offers","offer","bundle","bundles","discount","discounts","package","packages","deal","deals"],"tr":["kampanya","kampanyalar","paket","indirim","firsat"],"fr":["offres","offre","forfait","forfaits","remise","reduction","promotion"],"ku":["پێشنیار","پێشنیارەکان","داشکاندن","پاکێج","بەرزکردنەوە"]},"a":{"ar":"العروض المجمّعة (تشمل دورة تعليم الحاسوب):\n• العرض الأول: برنامج ثلاثي الأبعاد + برنامج إظهار + دورة حاسوب = 220 ألف د.ع ≈ $135\n• العرض الثاني: برنامجان ثلاثيا الأبعاد + برنامجا إظهار + دورة حاسوب = 450 ألف د.ع ≈ $275\n• العرض الثالث: 4 برامج ثلاثية الأبعاد + 5 برامج إظهار + دورة حاسوب = 750 ألف د.ع ≈ $455","en":"Bundles (they include the computer-education course):\n• Offer 1: one 3D program + one rendering program + computer course = 220K IQD ≈ $135\n• Offer 2: two 3D programs + two rendering programs + computer course = 450K IQD ≈ $275\n• Offer 3: 4 3D programs + 5 rendering programs + computer course = 750K IQD ≈ $455","tr":"Kampanyalar (bilgisayar eğitimi kursunu da içerir):\n• 1. kampanya: bir 3B program + bir görselleştirme programı + bilgisayar kursu = 220 bin IQD ≈ $135\n• 2. kampanya: iki 3B program + iki görselleştirme programı + bilgisayar kursu = 450 bin IQD ≈ $275\n• 3. kampanya: 4 3B program + 5 görselleştirme programı + bilgisayar kursu = 750 bin IQD ≈ $455","fr":"Offres groupées (elles incluent le cours d’informatique) :\n• Offre 1 : un logiciel 3D + un logiciel de rendu + cours d’informatique = 220 k IQD ≈ $135\n• Offre 2 : deux logiciels 3D + deux logiciels de rendu + cours d’informatique = 450 k IQD ≈ $275\n• Offre 3 : 4 logiciels 3D + 5 logiciels de rendu + cours d’informatique = 750 k IQD ≈ $455","ku":"پێشنیارە کۆکراوەکان (خولی کۆمپیوتەریش دەگرێتەوە):\n• پێشنیاری یەکەم: یەک بەرنامەی سێ ڕەهەندی + یەک بەرنامەی ڕێندەر + خولی کۆمپیوتەر = 220 هەزار د.ع ≈ $135\n• پێشنیاری دووەم: دوو بەرنامەی سێ ڕەهەندی + دوو بەرنامەی ڕێندەر + خولی کۆمپیوتەر = 450 هەزار د.ع ≈ $275\n• پێشنیاری سێیەم: 4 بەرنامەی سێ ڕەهەندی + 5 بەرنامەی ڕێندەر + خولی کۆمپیوتەر = 750 هەزار د.ع ≈ $455"},"l":["courses","contact"]},{"id":"includes","w":3,"k":{"ar":["يشمل","ماذا يشمل","شنو يشمل","شهاده","شهادة اتمام","دعم بعد الدوره","100 يوم","تثبيت البرامج","تفعيل البرامج","شنو اخذ","ماذا احصل"],"en":["includes","included","certificate","support after","100 days","installation","what do i get"],"tr":["dahil","sertifika","kurulum","destek"],"fr":["inclus","comprend","certificat","installation","assistance"],"ku":["دەگرێتەوە","بڕوانامە","پشتگیری","دامەزراندن"]},"a":{"ar":"يشمل الاشتراك: تثبيت وتفعيل البرامج، إضافات ومكتبات جاهزة، دعم ومتابعة حتى 100 يوم بعد انتهاء الدورة، وشهادة إتمام.","en":"The subscription includes: installing and activating the software, ready-made add-ons and libraries, support and follow-up for up to 100 days after the course ends, and a completion certificate.","tr":"Abonelik şunları içerir: programların kurulumu ve etkinleştirilmesi, hazır eklentiler ve kütüphaneler, kurs bittikten sonra 100 güne kadar destek ve takip, ve bir tamamlama sertifikası.","fr":"L’inscription comprend : l’installation et l’activation des logiciels, des extensions et bibliothèques prêtes à l’emploi, une assistance et un suivi jusqu’à 100 jours après la fin du cours, et un certificat de fin de formation.","ku":"بەشداریکردنەکە دەگرێتەوە: دامەزراندن و چالاککردنی بەرنامەکان، زیادکراو و کتێبخانەی ئامادە، پشتگیری و شوێنکەوتن تا 100 ڕۆژ دوای تەواوبوونی خولەکە، و بڕوانامەی تەواوکردن."},"l":["courses"]},{"id":"register","w":3,"k":{"ar":["تسجيل","اسجل","سجل","حساب","انضم","اشترك","اشتراك","عضويه","كيف ادخل","انشاء حساب","افتح حساب"],"en":["register","registration","sign up","signup","join","account","subscribe","enroll","enrol","create an account"],"tr":["kayit","kaydol","uye","hesap","katil","abone"],"fr":["inscription","inscrire","m inscrire","compte","rejoindre","creer un compte"],"ku":["تۆمارکردن","تۆمار","هەژمار","بەشداری","ئەندام"]},"a":{"ar":"للتسجيل في المنصة اضغط زر التسجيل أعلى الصفحة. نطلب معرّف تيليجرام أو رقم هاتف حتى نتمكّن من التواصل معك. التسجيل يتيح لك نشر مشاريعك في المجتمع والمشاركة في المسابقات.\nأما الاشتراك في دورة أو خدمة فيتم بالتواصل معنا مباشرة: أخبرنا بما تحتاجه وسنرتّب معك الخطوات.","en":"To register on the platform, press the register button at the top of the page. We ask for a Telegram username or a phone number so that we can reach you. Registering lets you publish your projects in the Community and enter the competitions.\nSubscribing to a course or a service is done by contacting us directly: tell us what you need and we will arrange the next steps.","tr":"Platforma kaydolmak için sayfanın üstündeki kayıt düğmesine basın. Size ulaşabilmemiz için bir Telegram kullanıcı adı veya telefon numarası istiyoruz. Kayıt, projelerinizi Topluluk’ta yayımlamanıza ve yarışmalara katılmanıza olanak tanır.\nBir kursa veya hizmete kaydolmak için bizimle doğrudan iletişime geçin: neye ihtiyacınız olduğunu söyleyin, sonraki adımları birlikte planlayalım.","fr":"Pour vous inscrire sur la plateforme, appuyez sur le bouton d’inscription en haut de la page. Nous demandons un nom d’utilisateur Telegram ou un numéro de téléphone afin de pouvoir vous joindre. L’inscription vous permet de publier vos projets dans la Communauté et de participer aux concours.\nPour vous inscrire à un cours ou à un service, contactez-nous directement : dites-nous ce dont vous avez besoin et nous organiserons les prochaines étapes.","ku":"بۆ تۆمارکردن لە پلاتفۆرم دوگمەی تۆمارکردن لە سەرەوەی پەڕەکە دابگرە. ناوی بەکارهێنەری تێلێگرام یان ژمارەی مۆبایل داوا دەکەین بۆ ئەوەی پەیوەندیت پێوە بکەین. تۆمارکردن ڕێگەت پێدەدات پڕۆژەکانت لە کۆمەڵگە بڵاو بکەیتەوە و بەشداری پێشبڕکێکان بکەیت.\nبۆ بەشداریکردن لە خول یان خزمەتگوزارییەک ڕاستەوخۆ پەیوەندیمان پێوە بکە: پێمان بڵێ چیت پێویستە و هەنگاوەکانی دواتر ڕێک دەخەین."},"l":["join","contact"]},{"id":"contact","w":3.5,"k":{"ar":["تواصل","اتواصل","تواصلوا","كيف اكلمكم","اكلمكم","اتكلم","اكلم شخص","شخص حقيقي","موظف","مسؤول","رقمكم","رقمك","رقم الهاتف","رقم واتساب","واتساب","واتس","تليجرام","تيليجرام","تلكرام","انستغرام","انستا","ايميل","بريد","عنوانكم","ارسل لكم","راسلكم"],"en":["contact","reach you","talk to someone","talk to a person","human","phone","phone number","your number","whatsapp","telegram","instagram","email","e-mail","message you"],"tr":["iletisim","ulasmak","bir insanla","telefon","telefon numarasi","e-posta","eposta","yazmak istiyorum"],"fr":["contact","contacter","joindre","telephone","numero de telephone","courriel","parler a quelqu un","parler a une personne"],"ku":["پەیوەندی","پەیوەندیکردن","ژمارەی مۆبایل","ژمارەی تەلەفۆن","تێلێگرام","ئینستاگرام","ئیمەیڵ","قسە لەگەڵ کەسێک"]},"a":{"ar":"تواصل معنا من أي قناة وبنفس الاسم @xstudio4arch، أو عبر البريد info@xarch.site. أخبرنا بما تحتاجه (خدمة أو دورة) وسنرتّب معك الخطوات التالية.","en":"Reach us on any channel under the same name, @xstudio4arch, or by email at info@xarch.site. Tell us what you need (a service or a course) and we will arrange the next steps with you.","tr":"Bize her kanaldan aynı adla, @xstudio4arch üzerinden ya da info@xarch.site e-posta adresinden ulaşabilirsiniz. Neye ihtiyacınız olduğunu (hizmet ya da kurs) söyleyin, sonraki adımları birlikte planlayalım.","fr":"Contactez-nous sur n’importe quel canal sous le même nom, @xstudio4arch, ou par e-mail à info@xarch.site. Dites-nous ce dont vous avez besoin (un service ou un cours) et nous organiserons les prochaines étapes avec vous.","ku":"لە هەر کەناڵێکەوە بە هەمان ناوی @xstudio4arch پەیوەندیمان پێوە بکە، یان بە ئیمەیڵی info@xarch.site. پێمان بڵێ چیت پێویستە (خزمەتگوزاری یان خول) و هەنگاوەکانی دواتر لەگەڵت ڕێک دەخەین."},"l":["contact"],"x":["contact"]},{"id":"community","w":2.5,"k":{"ar":["مجتمع","المجتمع","لوحه","بورد","انشر مشروعي","نشر مشروع","شارك مشروعي","ارفع مشروعي"],"en":["community","board","publish my project","share my project","post my project","workspace"],"tr":["topluluk","pano","projemi paylas","projemi yayimla"],"fr":["communaute","tableau","publier mon projet","partager mon projet"],"ku":["کۆمەڵگە","تەختە","پڕۆژەکەم بڵاو"]},"a":{"ar":"المجتمع مساحة عمل مفتوحة (لوح) تضع عليها صوراً وملاحظات وتربطها بخطوط، وترسم بأدوات الرسم، وتبحث في مصادر حرة. يمكنك استخدامها كضيف على جهازك، أما نشر مشروعك أو لوحتك فيحتاج حساباً مسجّلاً ويمرّ بمراجعة قبل الظهور.","en":"The Community is an open workspace (a board) where you place pictures and notes, link them with connectors, draw with the drawing tools and search free sources. You can use it as a guest on your device; publishing your project or board needs a registered account and goes through a review before it appears.","tr":"Topluluk, resim ve notlar yerleştirip bağlantı çizgileriyle birbirine bağladığınız, çizim araçlarıyla çizim yapabildiğiniz ve özgür kaynaklarda arama yapabildiğiniz açık bir çalışma alanıdır (pano). Konuk olarak cihazınızda kullanabilirsiniz; projenizi veya panonuzu yayımlamak için kayıtlı bir hesap gerekir ve görünmeden önce incelemeden geçer.","fr":"La Communauté est un espace de travail ouvert (un tableau) où vous placez des images et des notes, les reliez par des connecteurs, dessinez avec les outils de dessin et cherchez dans des sources libres. Vous pouvez l’utiliser en invité sur votre appareil ; publier votre projet ou votre tableau demande un compte inscrit et passe par une modération avant d’apparaître.","ku":"کۆمەڵگە شوێنێکی کاری کراوەیە (تەختە) کە وێنە و تێبینی لەسەر دادەنێیت و بە هێڵ پێکیانەوە دەبەستیتەوە، بە ئامرازەکانی نیگارکێشان دەکێشیت و لە سەرچاوە ئازادەکاندا دەگەڕێیت. وەک میوان لەسەر ئامێرەکەت بەکاریدەهێنیت؛ بڵاوکردنەوەی پڕۆژە یان تەختەکەت هەژمارێکی تۆمارکراوی دەوێت و پێش دەرکەوتن پێداچوونەوەی بۆ دەکرێت."},"l":["community","join"]},{"id":"competitions","w":3,"k":{"ar":["مسابقه","مسابقات","جايزه","جوائز","تحدي","منافسه","شارك بمسابقه"],"en":["competition","competitions","contest","prize","prizes","challenge"],"tr":["yarisma","yarismalar","odul","oduller"],"fr":["concours","competition","prix a gagner","defi"],"ku":["پێشبڕکێ","پێشبڕکێکان","خەڵات"]},"a":{"ar":"صفحة المسابقات فيها المسابقات الحالية وشروطها وتواريخها وقائمة المشاركات. للمشاركة سجّل في المنصة ثم أضف مشروعك من نافذة المشروع واختر المسابقة.","en":"The Competitions page lists the current competitions with their rules, dates and entries. To take part, register on the platform, then add your project from the project window and choose the competition.","tr":"Yarışmalar sayfasında güncel yarışmalar, kuralları, tarihleri ve katılımlar yer alır. Katılmak için platforma kaydolun, ardından proje penceresinden projenizi ekleyip yarışmayı seçin.","fr":"La page Concours présente les concours en cours avec leurs règles, leurs dates et les participations. Pour participer, inscrivez-vous sur la plateforme, puis ajoutez votre projet depuis la fenêtre du projet et choisissez le concours.","ku":"لاپەڕەی پێشبڕکێکان پێشبڕکێ ئێستاکان و مەرج و بەروار و بەشداربووانی تێدایە. بۆ بەشداریکردن لە پلاتفۆرم تۆمار بکە، پاشان پڕۆژەکەت لە پەنجەرەی پڕۆژە زیاد بکە و پێشبڕکێکە هەڵبژێرە."},"l":["competitions","join"]},{"id":"works","w":2.5,"k":{"ar":["اعمال الطلاب","اعمالكم","معرض","نماذج من اعمالكم","شغلكم","اشغالكم","بورتفوليو"],"en":["student work","student works","your work","your works","portfolio","gallery","examples of your work"],"tr":["ogrenci calismalari","calismalariniz","galeri","portfolyo"],"fr":["travaux d etudiants","vos travaux","galerie","portfolio","realisations"],"ku":["کارەکانی قوتابیان","کارەکانتان","گاڵەری","پۆرتفۆلیۆ"]},"a":{"ar":"قسم أعمال الطلاب معرض لأعمال إظهار ومشاريع طلاب؛ تتصفحه وتكبّر أي عمل لتشاهده بوضوح.","en":"The Student work section is a gallery of students’ renders and projects; browse it and open any work to see it clearly.","tr":"Öğrenci çalışmaları bölümü, öğrencilerin görsellerinden ve projelerinden oluşan bir galeridir; göz atın ve istediğiniz çalışmayı büyütüp net biçimde görün.","fr":"La section Travaux d’étudiants est une galerie de rendus et de projets d’étudiants ; parcourez-la et ouvrez n’importe quel travail pour le voir clairement.","ku":"بەشی کارەکانی قوتابیان گاڵەرییەکە لە ڕێندەر و پڕۆژەی قوتابیان؛ بیگەڕێ و هەر کارێک بکەرەوە بۆ ئەوەی بە ڕوونی ببینیت."},"l":["works"]},{"id":"library","w":2.5,"k":{"ar":["مكتبه","المكتبه","كتب","كتاب","مراجع","ملفات","خامات","ترخيص","تراخيص","نسخه طلابيه",["برامج مجانيه",4],["برامج للطلاب",4],["نسخه طلابيه",4],["مجاني",1.5],["مجانا",1.5],"ريفرنس","مصادر"],"en":["library","books","book","references","files","textures",["free software",4],["student license",4],["student licence",4],["student version",4],"free resources",["free",1.5]],"tr":["kutuphane","kitap","kitaplar","dosyalar",["ucretsiz yazilim",4],["ogrenci lisansi",4],["ucretsiz",1.5]],"fr":["bibliotheque","livres","livre","fichiers",["logiciels gratuits",4],["licence etudiante",4],["gratuit",1.5],["gratuits",1.5]],"ku":["کتێبخانە","کتێب","فایل",["بەرنامەی بێبەرامبەر",4],["مۆڵەتی قوتابی",4],["بێبەرامبەر",1.5]]},"a":{"ar":"المكتبة: كتب حسب المرحلة، وملفات وخامات حرة الترخيص، وبرامج للطلاب (مجانية أو بسعر طلابي)، ودروس مجانية، وبرومبتات ومراجع للذكاء الاصطناعي. فيها بحث للوصول سريعاً لما تريد.","en":"The Library: books by stage, freely licensed files and textures, software for students (free or student-priced), free lessons, and AI prompts and references. It has a search box to find what you need quickly.","tr":"Kütüphane: aşamaya göre kitaplar, özgür lisanslı dosyalar ve dokular, öğrenciler için yazılımlar (ücretsiz ya da öğrenci fiyatlı), ücretsiz dersler, yapay zekâ istemleri ve kaynakları. İstediğinizi hızlıca bulmak için bir arama kutusu var.","fr":"La Bibliothèque : des livres par niveau, des fichiers et textures sous licence libre, des logiciels pour étudiants (gratuits ou à tarif étudiant), des leçons gratuites, ainsi que des prompts et des références pour l’IA. Une barre de recherche permet de trouver vite ce qu’il vous faut.","ku":"کتێبخانە: کتێب بەپێی قۆناغ، فایل و ماددەی مۆڵەتی ئازاد، بەرنامە بۆ قوتابیان (بێبەرامبەر یان بە نرخی قوتابی)، وانەی بێبەرامبەر، و پرۆمپت و سەرچاوەکانی ژیری دەستکرد. بۆکسی گەڕان هەیە بۆ دۆزینەوەی خێرای ئەوەی دەتەوێت."},"l":["library"]},{"id":"ai","w":3,"k":{"ar":["ذكاء اصطناعي","الذكاء الاصطناعي","برومبت","بروميت","برومبتات","برومت","ميدجورني"],"en":["artificial intelligence","prompt","prompts","midjourney","ai prompts","ai render","ai tools","with ai"],"tr":["yapay zeka","istem","istemler","prompt"],"fr":["intelligence artificielle","prompt","prompts","ia"],"ku":["ژیری دەستکرد","پرۆمپت","پرۆمپتەکان"]},"a":{"ar":"برومبتات الذكاء الاصطناعي في المكتبة: برومبتات جاهزة للإظهار (من سكيتش إلى ريندر، من نهار إلى ليل، تغيير الخامات، وغيرها) مع صورة توضيحية لكل واحد وزر نسخ، إضافة إلى إضافات ومراجع ريندر. ملاحظة: البرومبتات غير مجرَّبة بعد، والصور أمثلة توضيحية.","en":"The AI prompts are in the Library: ready-made rendering prompts (sketch to render, day to night, change materials and more), each with an illustrative picture and a copy button, plus AI add-ons and render references. Note: the prompts are not tested yet, and the pictures are illustrative examples.","tr":"Yapay zekâ istemleri Kütüphane’de: render için hazır istemler (eskizden render’a, gündüzden geceye, malzeme değiştirme ve daha fazlası), her biri örnek bir görsel ve kopyala düğmesiyle; ayrıca yapay zekâ eklentileri ve render kaynakları. Not: istemler henüz denenmemiştir, görseller örnek niteliğindedir.","fr":"Les prompts IA sont dans la Bibliothèque : des prompts de rendu prêts à l’emploi (du croquis au rendu, du jour à la nuit, changement de matériaux, etc.), chacun avec une image illustrative et un bouton de copie, plus des extensions IA et des références de rendu. Remarque : les prompts ne sont pas encore testés et les images sont illustratives.","ku":"پرۆمپتەکانی ژیری دەستکرد لە کتێبخانەدان: پرۆمپتی ئامادە بۆ ڕێندەر (لە سکێچەوە بۆ ڕێندەر، لە ڕۆژەوە بۆ شەو، گۆڕینی ماددە و زیاتر)، هەر یەکێکیان لەگەڵ وێنەیەکی ڕوونکەرەوە و دوگمەی کۆپی، لەگەڵ زیادکراوە و سەرچاوەکانی ڕێندەری ژیری دەستکرد. تێبینی: پرۆمپتەکان هێشتا تاقی نەکراونەتەوە و وێنەکان نموونەی ڕوونکەرەوەن."},"l":["ai","library"]},{"id":"news","w":2.5,"k":{"ar":["اخبار","الاخبار","اخر المستجدات"],"en":["news","latest news","updates"],"tr":["haber","haberler","guncel"],"fr":["actualites","actualite","nouvelles"],"ku":["هەواڵ","هەواڵەکان"]},"a":{"ar":"قسم الأخبار يعرض أخباراً معمارية محدّثة، تتصفحها بالسحب أو بالأسهم.","en":"The News section shows up-to-date architecture news; browse it by swiping or with the arrows.","tr":"Haberler bölümü güncel mimarlık haberlerini gösterir; kaydırarak ya da oklarla gezebilirsiniz.","fr":"La section Actualités présente l’actualité de l’architecture ; parcourez-la en faisant glisser ou avec les flèches.","ku":"بەشی هەواڵەکان هەواڵی نوێی تەلارسازی پیشان دەدات؛ بە ڕاکێشان یان تیرەکان بیگەڕێ."},"l":["news"]}],"programs":[{"n":"AutoCAD","c":"3d","k":["اوتوكاد","اوتو كاد","autocad","اوتۆکاد"],"ax":20},{"n":"Revit","c":"3d","k":["ريفت","ريفيت","ريفت","revit","ڕیڤیت"],"ax":20},{"n":"3ds Max","c":"3d","k":["3ds max","3dsmax","ثري دي ماكس","ماكس","ثري دي اس ماكس"],"ax":20},{"n":"SketchUp","c":"3d","k":["سكتش اب","سكيتش اب","سكتشاب","sketchup","sketch up"],"ax":20},{"n":"Rhinoceros","c":"3d","k":["راينو","رينو","رايناسيروس","rhino","rhinoceros"],"ax":20},{"n":"Grasshopper","c":"3d","k":["جراسهوبر","غراسهوبر","جراس هوبر","grasshopper"],"ax":20},{"n":"Blender","c":"3d","k":["بلندر","بليندر","blender"],"ax":19},{"n":"Maya","c":"3d","k":["مايا","maya"],"ax":20},{"n":"Unreal Engine","c":"3d","k":["انريال","أنريال","unreal"],"ax":20},{"n":"Corona","c":"render","k":["كورونا","corona"],"ax":20},{"n":"Lumion","c":"render","k":["لوميون","لوميان","lumion"],"ax":20},{"n":"D5 Render","c":"render","k":["d5","دي فايف","دي 5"],"ax":20},{"n":"V-Ray","c":"render","k":["فيراي","في راي","vray","v-ray","v ray"],"ax":20},{"n":"Enscape","c":"render","k":["انسكيب","انسكايب","enscape"],"ax":20},{"n":"Twinmotion","c":"render","k":["توين موشن","توين موشن","twinmotion"],"ax":20},{"n":"Vantage","c":"render","k":["فانتج","فانتاج","vantage"],"ax":20},{"n":"Photoshop","c":"render","k":["فوتوشوب","فوتوشب","photoshop"],"ax":20},{"n":"Illustrator","c":"render","k":["ايلستريتر","اليستريتر","اليستراتور","illustrator"],"ax":20},{"n":"Computer","c":"pc","k":["تعليم حاسوب","تعليم الحاسوب","دوره حاسوب","دورة حاسوب","computer course","computer education","computer skills","bilgisayar kursu","cours d informatique","خولی کۆمپیوتەر"],"ax":20}],"program":{"cat":{"3d":{"ar":"برنامج ثلاثي الأبعاد","en":"3D program","tr":"3B program","fr":"logiciel 3D","ku":"بەرنامەی سێ ڕەهەندی"},"render":{"ar":"برنامج إظهار معماري","en":"architectural rendering program","tr":"mimari görselleştirme programı","fr":"logiciel de rendu architectural","ku":"بەرنامەی ڕێندەری تەلارسازی"},"pc":{"ar":"دورة تعليم الحاسوب","en":"computer-education course","tr":"bilgisayar eğitimi kursu","fr":"cours d’informatique","ku":"خولی فێرکردنی کۆمپیوتەر"}},"dur":{"3d":{"ar":"15–20 يوماً","en":"15–20 days","tr":"15–20 gün","fr":"15 à 20 jours","ku":"15 بۆ 20 ڕۆژ"},"render":{"ar":"7–10 أيام","en":"7–10 days","tr":"7–10 gün","fr":"7 à 10 jours","ku":"7 بۆ 10 ڕۆژ"},"pc":{"ar":"7–10 أيام","en":"7–10 days","tr":"7–10 gün","fr":"7 à 10 jours","ku":"7 بۆ 10 ڕۆژ"}},"price":{"3d":[250,175],"render":[125,85]},"a":{"ar":"{name} ({cat}): مدة الدورة {dur}، و{axes} محوراً.\nالدورة التفاعلية {pi} {u}، والمسجّلة {pr} {u}.\nالاشتراك يشمل تثبيت وتفعيل البرنامج، ودعماً حتى 100 يوم بعد انتهاء الدورة، وشهادة إتمام.","en":"{name} ({cat}): the course lasts {dur} and covers {axes} topics.\nThe live course is {pi} {u}, and the recorded one {pr} {u}.\nThe subscription includes installing and activating the program, support for up to 100 days after the course ends, and a completion certificate.","tr":"{name} ({cat}): kurs {dur} sürer ve {axes} konuyu kapsar.\nCanlı kurs {pi} {u}, kayıtlı kurs {pr} {u}.\nAbonelik, programın kurulumunu ve etkinleştirilmesini, kurs bittikten sonra 100 güne kadar desteği ve bir tamamlama sertifikasını içerir.","fr":"{name} ({cat}) : le cours dure {dur} et couvre {axes} thèmes.\nLe cours en direct est à {pi} {u}, le cours enregistré à {pr} {u}.\nL’inscription comprend l’installation et l’activation du logiciel, une assistance jusqu’à 100 jours après la fin du cours et un certificat.","ku":"{name} ({cat}): خولەکە {dur} دەخایەنێت و {axes} تەوەر دەگرێتەوە.\nنرخی خولی ڕاستەوخۆ {pi} {u}، و تۆمارکراو {pr} {u}.\nبەشداریکردنەکە دامەزراندن و چالاککردنی بەرنامەکە و پشتگیری تا 100 ڕۆژ دوای تەواوبوونی خولەکە و بڕوانامەی تەواوکردن دەگرێتەوە."},"a_pc":{"ar":"{name} ({cat}): مدة الدورة {dur}، و{axes} محوراً. تُقدَّم ضمن العروض المجمّعة، اسألني عن العروض.","en":"{name} ({cat}): the course lasts {dur} and covers {axes} topics. It is offered within the bundles; ask me about the bundles.","tr":"{name} ({cat}): kurs {dur} sürer ve {axes} konuyu kapsar. Kampanyaların içinde sunulur; kampanyaları sorabilirsiniz.","fr":"{name} ({cat}) : le cours dure {dur} et couvre {axes} thèmes. Il est proposé dans les offres groupées ; demandez-moi les offres.","ku":"{name} ({cat}): خولەکە {dur} دەخایەنێت و {axes} تەوەر دەگرێتەوە. لەناو پێشنیارە کۆکراوەکاندا پێشکەش دەکرێت؛ لەبارەی پێشنیارەکان بپرسە."}},"fallback":{"ar":"ما لقيت جواباً دقيقاً لسؤالك. جرّب أحد الأسئلة السريعة، أو راسلنا مباشرة وسنرد عليك.","en":"I couldn’t find an exact answer to that. Try one of the quick questions, or message us directly and we will reply.","tr":"Bu soruya tam bir yanıt bulamadım. Hızlı sorulardan birini deneyin ya da doğrudan bize yazın, size dönelim.","fr":"Je n’ai pas trouvé de réponse précise à cette question. Essayez l’une des questions rapides, ou écrivez-nous directement et nous vous répondrons.","ku":"وەڵامێکی ورد بۆ پرسیارەکەت نەدۆزییەوە. یەکێک لە پرسیارە خێراکان تاقی بکەرەوە، یان ڕاستەوخۆ پەیوەندیمان پێوە بکە و وەڵامت دەدەینەوە."},"chips":{"ar":["ما هي خدماتكم؟","كم الأسعار؟","ما هي الدورات؟","كيف أسجّل؟","كيف أتواصل معكم؟"],"en":["What are your services?","What are your prices?","What courses do you have?","How do I register?","How can I contact you?"],"tr":["Hizmetleriniz neler?","Fiyatlar nedir?","Hangi kurslar var?","Nasıl kayıt olurum?","Size nasıl ulaşırım?"],"fr":["Quels sont vos services ?","Quels sont vos tarifs ?","Quels cours proposez-vous ?","Comment m’inscrire ?","Comment vous contacter ?"],"ku":["خزمەتگوزارییەکانتان چین؟","نرخەکان چەندە؟","چ خولێکتان هەیە؟","چۆن تۆمار بکەم؟","چۆن پەیوەندیتان پێوە بکەم؟"]},"nontext":{"ar":"أقرأ الرسائل النصية فقط. اكتب سؤالك وأجاوبك.","en":"I can only read text messages. Type your question and I will answer.","tr":"Yalnızca metin mesajlarını okuyabiliyorum. Sorunuzu yazın, yanıtlayayım.","fr":"Je ne lis que les messages texte. Écrivez votre question et je vous répondrai.","ku":"تەنها نامەی نووسراو دەخوێنمەوە. پرسیارەکەت بنووسە و وەڵامت دەدەمەوە."}});
const WELCOME = {"ar":{"subj":"أهلاً بك في X Architecture","hi":"أهلاً {n}،","thanks":"شكراً لتسجيلك معنا. هذا تعريف سريع بنا:","svcH":"ماذا نقدّم","site":"زيارة الموقع","services":"الخدمات","courses":"الدورات","works":"أعمال الطلاب","community":"المجتمع","foot":"وصلتك هذه الرسالة لأنك سجّلت في xarch.site.","intro":"X للعمارة منصة معمارية للطلاب: خدمات إظهار وتصميم ونقد وإشراف، ودورات في برامج العمارة، وأعمال طلاب، ومكتبة كتب وملفات وبرامج مجانية أو بسعر طلابي.","svc":["تصميم معماري لأصحاب المشاريع والعملاء","إظهار معماري (مناظير خارجية وداخلية)","نقد معماري للطلاب","إشراف ومتابعة للطلاب","دورات في برامج العمارة"],"contact":"تواصل معنا من أي قناة وبنفس الاسم @xstudio4arch، أو عبر البريد info@xarch.site. أخبرنا بما تحتاجه (خدمة أو دورة) وسنرتّب معك الخطوات التالية."},"en":{"subj":"Welcome to X Architecture","hi":"Hello {n},","thanks":"Thank you for registering with us. A quick introduction:","svcH":"What we offer","site":"Visit the site","services":"Services","courses":"Courses","works":"Student work","community":"Community","foot":"You are receiving this because you registered at xarch.site.","intro":"X Architecture is an architecture platform for students: visualization, design, critique and supervision services, courses in architecture software, student work, and a library of books, files and free or student-priced software.","svc":["Architectural design for clients and project owners","Architectural visualization (exterior and interior renders)","Architectural critique for students","Supervision and follow-up for students","Courses in architecture software"],"contact":"Reach us on any channel under the same name, @xstudio4arch, or by email at info@xarch.site. Tell us what you need (a service or a course) and we will arrange the next steps with you."},"tr":{"subj":"X Architecture’a hoş geldiniz","hi":"Merhaba {n},","thanks":"Bizimle kaydolduğunuz için teşekkürler. Kısa bir tanıtım:","svcH":"Sunduklarımız","site":"Siteyi ziyaret edin","services":"Hizmetler","courses":"Kurslar","works":"Öğrenci çalışmaları","community":"Topluluk","foot":"Bu mesajı xarch.site’a kaydolduğunuz için aldınız.","intro":"X Architecture, öğrenciler için bir mimarlık platformudur: görselleştirme, tasarım, eleştiri ve denetim hizmetleri, mimarlık yazılımı kursları, öğrenci çalışmaları ve ücretsiz ya da öğrenci fiyatlı kitap, dosya ve yazılımlardan oluşan bir kütüphane.","svc":["Müşteriler ve proje sahipleri için mimari tasarım","Mimari görselleştirme (dış ve iç mekân)","Öğrenciler için mimari eleştiri","Öğrenciler için denetim ve takip","Mimarlık yazılımı kursları"],"contact":"Bize her kanaldan aynı adla, @xstudio4arch üzerinden ya da info@xarch.site e-posta adresinden ulaşabilirsiniz. Neye ihtiyacınız olduğunu (hizmet ya da kurs) söyleyin, sonraki adımları birlikte planlayalım."},"fr":{"subj":"Bienvenue chez X Architecture","hi":"Bonjour {n},","thanks":"Merci de vous être inscrit(e). Une courte présentation :","svcH":"Ce que nous proposons","site":"Visiter le site","services":"Services","courses":"Cours","works":"Travaux d’étudiants","community":"Communauté","foot":"Vous recevez ce message car vous vous êtes inscrit(e) sur xarch.site.","intro":"X Architecture est une plateforme d’architecture pour les étudiants : visualisation, conception, critique et suivi, cours sur les logiciels d’architecture, travaux d’étudiants et une bibliothèque de livres, fichiers et logiciels gratuits ou à tarif étudiant.","svc":["Conception architecturale pour les clients et porteurs de projet","Visualisation architecturale (extérieur et intérieur)","Critique architecturale pour les étudiants","Suivi et supervision des étudiants","Cours sur les logiciels d’architecture"],"contact":"Contactez-nous sur n’importe quel canal sous le même nom, @xstudio4arch, ou par e-mail à info@xarch.site. Dites-nous ce dont vous avez besoin (un service ou un cours) et nous organiserons les prochaines étapes avec vous."},"ku":{"subj":"بەخێربێیت بۆ X Architecture","hi":"سڵاو {n}،","thanks":"سوپاس بۆ تۆمارکردنت لەگەڵمان. ناساندنێکی کورت:","svcH":"ئەوەی پێشکەشی دەکەین","site":"سەردانی ماڵپەڕ بکە","services":"خزمەتگوزارییەکان","courses":"خولەکان","works":"کارەکانی قوتابیان","community":"کۆمەڵگە","foot":"ئەم نامەیە بۆت هاتووە چونکە لە xarch.site تۆمارت کرد.","intro":"X Architecture پلاتفۆرمێکی تەلارسازییە بۆ قوتابیان: خزمەتگوزاری ڕێندەر و دیزاین و ڕەخنە و سەرپەرشتی، خول لە بەرنامەکانی تەلارسازی، کارەکانی قوتابیان، و کتێبخانەیەک لە کتێب و فایل و بەرنامەی بێبەرامبەر یان بە نرخی قوتابی.","svc":["دیزاینی تەلارسازی بۆ کڕیار و خاوەن پڕۆژەکان","ڕێندەری تەلارسازی (دەرەوە و ناوەوە)","ڕەخنەی تەلارسازی بۆ قوتابیان","سەرپەرشتی و شوێنکەوتن بۆ قوتابیان","خول لە بەرنامەکانی تەلارسازی"],"contact":"لە هەر کەناڵێکەوە بە هەمان ناوی @xstudio4arch پەیوەندیمان پێوە بکە، یان بە ئیمەیڵی info@xarch.site. پێمان بڵێ چیت پێویستە (خزمەتگوزاری یان خول) و هەنگاوەکانی دواتر لەگەڵت ڕێک دەخەین."}};

/* X Assistant: the Telegram and WhatsApp reply bot (Cloudflare Worker).
   Answers visitors' questions with the same prepared answers as the website's "X Assistant" (assistant-kb.json).
   Nothing here is an AI model, so it only says what the site's own content says; anything it can't match gets a polite "message us".

   You never edit worker.js by hand: it is built by  python3 scripts/build_bot.py  from this file + assistant-core.js + assistant-kb.json.
   Setup in Arabic: backend/bot-worker/SETUP.md

   Secrets / variables (Workers -> Settings -> Variables and Secrets). Every one is yours, none is in the repository:
     TG_SECRET      Telegram: any long random text you invent; the same text goes in setWebhook as secret_token
     WA_VERIFY      WhatsApp: any text you invent; the same text goes in Meta's webhook "Verify token" box
     WA_APP_SECRET  WhatsApp: App secret (Meta app -> App settings -> Basic); used to check that a message really came from Meta
     WA_TOKEN       WhatsApp: access token used to send the replies
     WA_PHONE_ID    WhatsApp: the Phone number ID shown in WhatsApp -> API setup
     WA_API         optional, the Graph API version, default v23.0
   Telegram news (optional; without them the bot still answers, and nothing is stored):
     SUBS           a KV namespace bound under this name (Settings -> Bindings): chat id + language + date of the people who agreed to get the news
     TG_TOKEN       Telegram: the bot token, used only to send announcements
     BROADCAST_KEY  any long random text you invent; the admin page sends it to open POST /broadcast
   Messages are never stored or logged: a message is read, answered and forgotten. */

const MAX_IN = 300;                        /* longest question that is read */
const PER_MIN = 12;                        /* messages per person per minute (extra ones are ignored) */
const TG_LANG = { ar: 'ar', en: 'en', tr: 'tr', fr: 'fr', ku: 'ku', ckb: 'ku' };

const seen = new Map();                    /* sender -> recent times (kept only in memory, for the rate limit) */
const done = new Set();                    /* message ids already answered (WhatsApp may deliver one twice) */

function limited(id) {
  const now = Date.now(), a = (seen.get(id) || []).filter(t => now - t < 60000);
  a.push(now); seen.set(id, a);
  if (seen.size > 5000) { for (const [k, v] of seen) if (!v.length || now - v[v.length - 1] > 60000) seen.delete(k); }
  return a.length > PER_MIN;
}
function once(id) {
  if (!id) return true;
  if (done.has(id)) return false;
  done.add(id); if (done.size > 2000) done.delete(done.values().next().value);
  return true;
}
function safeEq(a, b) {                    /* compare two secrets without leaking where they differ */
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
const ok = () => new Response('ok', { status: 200 });

function reply(text, lang) {
  const q = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_IN);
  const res = XASCORE.answer(KB, q, lang);
  return { text: XASCORE.toText(KB, res, lang), matched: res.matched };
}
function welcome(lang) {
  return XASCORE.bidi(XASCORE.greeting(KB, lang), lang) + '\n\n' + XASCORE.bidi(XASCORE.pick(KB.intents.filter(i => i.id === 'about')[0].a, lang), lang);
}
/* The full welcome (who we are, the site, the services, the courses, the students' work, how to reach us), the same text the registration e-mail carries.
   People get it by tapping "Get your welcome on Telegram" on the site after they register: that opens https://t.me/<this bot>?start=welcome_<language>
   and the bot answers the moment they press Start. (A bot can never message someone first, so the person has to open the chat once.) */
function welcomeFull(lang, name) {
  const w = WELCOME[lang] || WELCOME.ar, site = String(KB.site || 'https://xarch.site').replace(/\/+$/, '');
  const nm = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')[0].slice(0, 40);
  const hi = nm ? w.hi.replace('{n}', nm) : w.hi.replace(/\s*\{n\}/, '');
  const links = [[w.site, site], [w.services, site + '/#services'], [w.courses, site + '/#courses'], [w.works, site + '/#works'], [w.community, site + '/#community']];
  const text = hi + '\n' + w.thanks + '\n\n' + w.intro + '\n\n' + w.svcH + ':\n' + w.svc.map(x => '\u2022 ' + x).join('\n') + '\n\n' +
    links.map(l => l[0] + ': ' + l[1]).join('\n') + '\n\n' + w.contact + '\n\nX Architecture';
  return XASCORE.bidi(text, lang);
}
function keyboard(lang) {
  const c = (KB.chips && KB.chips[lang]) || [], rows = [];
  for (let i = 0; i < c.length; i += 2) rows.push(c.slice(i, i + 2).map(t => ({ text: t })));
  return { keyboard: rows, resize_keyboard: true };
}

/* ---------------- Telegram news: who agreed to get it, and how it is sent ----------------
   Whoever taps "Get your welcome on Telegram" on the site (Start with the welcome link) agrees to get the platform's news here; /stop turns it off, /subscribe turns it back on.
   Only a chat id, the language and the date are kept (never names or messages). Without the SUBS binding nothing is kept and the bot behaves as before. */
const SUBTXT = {
  ar: { on: 'ستصلك أخبار المنصة وعروضها هنا من وقت لآخر. لإيقافها أرسل /stop', off: 'تم إيقاف الأخبار ولن نرسل لك إعلانات. إذا غيّرت رأيك أرسل /subscribe', again: 'تم تفعيل الأخبار. لإيقافها أرسل /stop', foot: 'لإيقاف الأخبار أرسل /stop' },
  en: { on: 'You will get the platform’s news and offers here from time to time. Send /stop to turn them off.', off: 'News turned off. We will not send you announcements. Send /subscribe if you change your mind.', again: 'News turned on. Send /stop to turn them off.', foot: 'To stop the news send /stop' },
  tr: { on: 'Platformun haberleri ve fırsatları zaman zaman buraya gelecek. Kapatmak için /stop yaz.', off: 'Haberler kapatıldı, duyuru göndermeyeceğiz. Fikrini değiştirirsen /subscribe yaz.', again: 'Haberler açıldı. Kapatmak için /stop yaz.', foot: 'Haberleri durdurmak için /stop yaz' },
  fr: { on: 'Vous recevrez ici de temps en temps les actualités et offres de la plateforme. Envoyez /stop pour les arrêter.', off: 'Actualités désactivées, nous ne vous enverrons plus d’annonces. Envoyez /subscribe si vous changez d’avis.', again: 'Actualités activées. Envoyez /stop pour les arrêter.', foot: 'Pour arrêter les actualités, envoyez /stop' },
  ku: { on: 'هەواڵ و پێشکەشکراوەکانی پلاتفۆرم جار جار لێرە دێن. بۆ وەستاندنیان /stop بنێرە.', off: 'هەواڵەکان وەستێنران و ئیتر ړاگەیاندن نانێرین. ئەگەر بیرت گۆړی /subscribe بنێرە.', again: 'هەواڵەکان چالاک کران. بۆ وەستاندنیان /stop بنێرە.', foot: 'بۆ وەستاندنی هەواڵەکان /stop بنێرە' }
};
function subText(lang, k) {
  const g = SUBTXT[lang] ? lang : 'ar', s = SUBTXT[g][k];
  return (g === 'ar' || g === 'ku') ? s.replace(/\/(stop|subscribe)/g, '⁦/$1⁩') : s;      /* keep the command reading left to right inside Arabic and Kurdish */
}
async function subPut(env, id, lang) {
  if (!env.SUBS) return false;
  await env.SUBS.put('t:' + id, '1', { metadata: { l: lang, t: Date.now() } });
  return true;
}
async function subDel(env, id) { if (env.SUBS) await env.SUBS.delete('t:' + id); }

/* ---------------- Telegram: the webhook answers in its own response, so the bot token is not needed here ---------------- */
async function telegram(req, env) {
  if (!env.TG_SECRET) return new Response('not configured', { status: 503 });
  if (!safeEq(req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TG_SECRET)) return new Response('forbidden', { status: 403 });
  if (+req.headers.get('content-length') > 65536) return ok();
  let u; try { u = await req.json(); } catch (e) { return ok(); }
  const mc = u && u.my_chat_member;                                                         /* someone blocked the bot: stop sending to them */
  if (mc && mc.chat && mc.chat.type === 'private') {
    if (mc.new_chat_member && mc.new_chat_member.status === 'kicked') await subDel(env, mc.chat.id);
    return ok();
  }
  const m = u && u.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return ok();   /* private chats only, edits ignored */
  if (limited('t' + m.chat.id)) return ok();
  const hint = TG_LANG[String(m.from.language_code || '').toLowerCase().slice(0, 3)] || TG_LANG[String(m.from.language_code || '').toLowerCase().slice(0, 2)] || 'ar';
  const text = typeof m.text === 'string' ? m.text : '';
  let out, lang = hint, kb = null;
  if (!text) out = XASCORE.pick(KB.nontext, lang);
  else if (/^\/start(@\w+)?\s+welcome(_(ar|en|tr|fr|ku))?\s*$/i.test(text)) {      /* the button on the site after registering */
    const pl = /welcome_(ar|en|tr|fr|ku)/i.exec(text);
    if (pl) lang = pl[1].toLowerCase();
    out = welcomeFull(lang, m.from.first_name); kb = keyboard(lang);
    if (await subPut(env, m.chat.id, lang)) out += '\n\n' + subText(lang, 'on');
  }
  else if (/^\/(stop|unsubscribe)(@\w+)?\s*$/i.test(text)) { await subDel(env, m.chat.id); out = subText(lang, 'off'); }
  else if (env.SUBS && /^\/subscribe(@\w+)?\s*$/i.test(text)) { await subPut(env, m.chat.id, lang); out = subText(lang, 'again'); }
  else if (/^\/(start|help)(@\w+)?(\s|$)/i.test(text)) { out = welcome(lang); kb = keyboard(lang); }
  else {
    lang = XASCORE.detect(KB, text);
    const r = reply(text, lang); out = r.text; if (!r.matched) kb = keyboard(lang);
  }
  const body = { method: 'sendMessage', chat_id: m.chat.id, text: out.slice(0, 4000), link_preview_options: { is_disabled: true } };
  if (kb) body.reply_markup = kb;
  return json(body);
}

/* ---------------- WhatsApp Cloud API ---------------- */
async function signed(secret, raw, header) {
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header || '');
  if (!m) return false;
  const sig = new Uint8Array(32); for (let i = 0; i < 32; i++) sig[i] = parseInt(m[1].substr(i * 2, 2), 16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, sig, raw);
}
async function sendWA(env, to, text) {
  const r = await fetch('https://graph.facebook.com/' + (env.WA_API || 'v23.0') + '/' + env.WA_PHONE_ID + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text.slice(0, 4000), preview_url: false } })
  });
  if (!r.ok) throw new Error('wa ' + r.status);
}
async function whatsapp(req, env, ctx) {
  if (req.method === 'GET') {                                   /* Meta checks the address once when you save the webhook */
    const q = new URL(req.url).searchParams;
    if (env.WA_VERIFY && q.get('hub.mode') === 'subscribe' && safeEq(q.get('hub.verify_token') || '', env.WA_VERIFY))
      return new Response(q.get('hub.challenge') || '', { status: 200, headers: { 'content-type': 'text/plain' } });
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env.WA_APP_SECRET || !env.WA_TOKEN || !env.WA_PHONE_ID) return new Response('not configured', { status: 503 });
  const raw = await req.arrayBuffer();
  if (raw.byteLength > 262144) return ok();
  if (!(await signed(env.WA_APP_SECRET, raw, req.headers.get('X-Hub-Signature-256')))) return new Response('forbidden', { status: 403 });
  let b; try { b = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { return ok(); }
  const jobs = [];
  ((b && b.entry) || []).forEach(en => (en.changes || []).forEach(ch => {
    const v = ch.value || {};
    (v.messages || []).forEach(msg => {
      if (!msg || !msg.from || !once(msg.id) || limited('w' + msg.from)) return;
      let out;
      if (msg.type === 'text' && msg.text && typeof msg.text.body === 'string') {
        const lang = XASCORE.detect(KB, msg.text.body);
        out = reply(msg.text.body, lang).text;
      } else if (msg.type === 'reaction' || msg.type === 'system' || msg.type === 'unsupported') return;
      else out = XASCORE.pick(KB.nontext, 'ar') + '\n' + XASCORE.pick(KB.nontext, 'en');
      jobs.push(sendWA(env, msg.from, out).catch(() => { }));
    });
  }));
  if (jobs.length) ctx.waitUntil(Promise.all(jobs));
  return ok();
}

/* ---------------- Announcements: POST /broadcast (used by the admin page) ----------------
   Body: { text, texts: {ar,en,tr,fr,ku}, cursor, dry }.  Header: Authorization: Bearer <BROADCAST_KEY>.
   Each call sends to one page of subscribers and returns the cursor for the next call (done: true at the end), because the free plan
   allows only 50 outgoing calls per request. { dry: true } only counts the subscribers. */
const BC_ORIGIN = 'https://xarch.site';                    /* the admin page lives here; other sites cannot call this from a browser */
const CORS = { 'Access-Control-Allow-Origin': BC_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', 'Vary': 'Origin' };
const bj = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) });
const bcFails = [];                                          /* times of wrong keys (kept only in memory) */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE = 20;                                             /* people per call: 1 list + 20 sends + up to 20 clean-ups stays under 50 */
const BC_LANGS = ['ar', 'en', 'tr', 'fr', 'ku'];
function tgSend(env, chat, text) {
  return fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text, link_preview_options: { is_disabled: true } })
  });
}
async function broadcast(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return bj({ ok: false, err: 'method not allowed' }, 405);
  if (!env.BROADCAST_KEY || !env.SUBS) return bj({ ok: false, err: 'not configured' }, 503);
  const now = Date.now(); while (bcFails.length && now - bcFails[0] > 60000) bcFails.shift();
  if (bcFails.length >= 8) return bj({ ok: false, err: 'too many wrong keys, wait a minute' }, 429);
  const given = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
  if (!given || !safeEq(given[1], env.BROADCAST_KEY)) { bcFails.push(now); return bj({ ok: false, err: 'wrong key' }, 401); }
  if (+req.headers.get('content-length') > 32768) return bj({ ok: false, err: 'too big' }, 413);
  let b; try { b = await req.json(); } catch (e) { return bj({ ok: false, err: 'bad json' }, 400); }
  b = b || {};
  if (b.dry) {                                               /* only count */
    let n = 0, by = {}, cur;
    for (let i = 0; i < 40; i++) {
      const l = await env.SUBS.list({ prefix: 't:', cursor: cur, limit: 1000 });
      l.keys.forEach(k => { n++; const g = (k.metadata && k.metadata.l) || 'ar'; by[g] = (by[g] || 0) + 1; });
      if (l.list_complete) return bj({ ok: true, subscribers: n, byLang: by });
      cur = l.cursor;
    }
    return bj({ ok: true, subscribers: n, byLang: by, partial: true });
  }
  const texts = {}; let any = '';
  const put = (k, v) => { if (typeof v === 'string' && v.trim()) { texts[k] = v.trim().slice(0, 3500); any = any || texts[k]; } };
  put('_', b.text);
  if (b.texts && typeof b.texts === 'object') BC_LANGS.forEach(k => put(k, b.texts[k]));
  if (!any) return bj({ ok: false, err: 'empty message' }, 400);
  if (!env.TG_TOKEN) return bj({ ok: false, err: 'no bot token' }, 503);
  const cursor = typeof b.cursor === 'string' && b.cursor.length < 400 ? b.cursor : undefined;
  const l = await env.SUBS.list({ prefix: 't:', cursor: cursor, limit: PAGE });
  let sent = 0, gone = 0, failed = 0;
  for (const k of l.keys) {
    const id = k.name.slice(2), g = (k.metadata && k.metadata.l) || 'ar';
    const body = (texts[g] || texts._ || texts.ar || any) + '\n\n' + subText(g, 'foot');
    let r = await tgSend(env, id, body);
    if (r.status === 429) {                                  /* Telegram asks to slow down: wait as long as it says (at most 10 s), try once more */
      const d = await r.json().catch(() => ({}));
      await sleep(Math.min(((d && d.parameters && d.parameters.retry_after) || 3), 10) * 1000);
      r = await tgSend(env, id, body);
    }
    if (r.ok) sent++;
    else {
      const d = await r.json().catch(() => ({})), why = String((d && d.description) || '').toLowerCase();
      if (r.status === 403 || /chat not found|deactivated|blocked/.test(why)) { gone++; await env.SUBS.delete(k.name); }   /* they blocked the bot or left Telegram */
      else failed++;
    }
    await sleep(40);                                         /* about 25 a second, under Telegram's 30 */
  }
  return bj({ ok: true, sent: sent, gone: gone, failed: failed, cursor: l.list_complete ? null : l.cursor, done: !!l.list_complete });
}

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/') return json({ ok: true, bot: 'x-assistant', kb: KB.updated, telegram: !!env.TG_SECRET, whatsapp: !!(env.WA_VERIFY && env.WA_APP_SECRET && env.WA_TOKEN && env.WA_PHONE_ID), news: !!env.SUBS, announcements: !!(env.SUBS && env.TG_TOKEN && env.BROADCAST_KEY) });
      if (path === '/telegram') return req.method === 'POST' ? await telegram(req, env) : new Response('method not allowed', { status: 405 });
      if (path === '/whatsapp') return await whatsapp(req, env, ctx);
      if (path === '/broadcast') { try { return await broadcast(req, env); } catch (e) { return bj({ ok: false, err: 'error' }, 500); } }
      return new Response('not found', { status: 404 });
    } catch (e) {
      return ok();                                              /* never make Telegram or Meta retry in a loop */
    }
  }
};
