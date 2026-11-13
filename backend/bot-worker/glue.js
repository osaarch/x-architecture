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
    links.map(l => l[0] + ': ' + l[1]).join('\n') + '\n\n' + w.contact + '\n\n' + (lang === 'ar' ? 'إكس للعمارة' : 'X Architecture');
  return XASCORE.bidi(text, lang);
}
/* Arabic is the default language of the bot (most of the platform's people are Arabic speakers). Anyone can switch with the language buttons at the bottom of the chat or by writing in another language. */
const LANGBTN = [['العربية', 'ar'], ['English', 'en'], ['Türkçe', 'tr'], ['Français', 'fr'], ['کوردی', 'ku']];
const LANGMAP = {}; LANGBTN.forEach(b => { LANGMAP[b[0]] = b[1]; });
function keyboard(lang) {
  const c = (KB.chips && KB.chips[lang]) || [], rows = [];
  for (let i = 0; i < c.length; i += 2) rows.push(c.slice(i, i + 2).map(t => ({ text: t })));
  rows.push(LANGBTN.slice(0, 3).map(b => ({ text: b[0] })), LANGBTN.slice(3).map(b => ({ text: b[0] })));
  return { keyboard: rows, resize_keyboard: true };
}
const LANGPICK = 'اختر اللغة\nChoose your language\nDil seç\nChoisissez votre langue\nزمانەکەت هەڵبژێرە';

/* ---------------- Telegram news: who agreed to get it, and how it is sent ----------------
   Whoever taps "Get your welcome on Telegram" on the site (Start with the welcome link) agrees to get the platform's news here; /stop turns it off, /subscribe turns it back on.
   Only a chat id, the language and the date are kept (never names or messages). Without the SUBS binding nothing is kept and the bot behaves as before. */
const SUBTXT = {
  ar: { on: 'ستصلك هنا نشرة أسبوعية قصيرة: أخبار معمارية ومستجدات المنصة وعروضها. لإيقافها أرسل /stop، ولأحدث الأخبار في أي وقت أرسل /news', off: 'تم إيقاف الأخبار ولن نرسل لك إعلانات. إذا غيّرت رأيك أرسل /subscribe', again: 'تم تفعيل الأخبار. لإيقافها أرسل /stop', foot: 'لإيقاف الأخبار أرسل /stop' },
  en: { on: 'You will get a short weekly digest here: architecture news and the platform’s updates and offers. Send /stop to turn it off, or /news any time for the latest news.', off: 'News turned off. We will not send you announcements. Send /subscribe if you change your mind.', again: 'News turned on. Send /stop to turn them off.', foot: 'To stop the news send /stop' },
  tr: { on: 'Buraya kısa bir haftalık bülten gelecek: mimarlık haberleri ile platformun yenilikleri ve fırsatları. Kapatmak için /stop, en son haberler için istediğin zaman /news yaz.', off: 'Haberler kapatıldı, duyuru göndermeyeceğiz. Fikrini değiştirirsen /subscribe yaz.', again: 'Haberler açıldı. Kapatmak için /stop yaz.', foot: 'Haberleri durdurmak için /stop yaz' },
  fr: { on: 'Vous recevrez ici une courte lettre hebdomadaire : actualités de l’architecture, nouveautés et offres de la plateforme. Envoyez /stop pour l’arrêter, ou /news à tout moment pour les dernières actualités.', off: 'Actualités désactivées, nous ne vous enverrons plus d’annonces. Envoyez /subscribe si vous changez d’avis.', again: 'Actualités activées. Envoyez /stop pour les arrêter.', foot: 'Pour arrêter les actualités, envoyez /stop' },
  ku: { on: 'نامەیەکی هەفتانەی کورت لێرە دێت: هەواڵی تەلارسازی و نوێکارییەکان و پێشکەشکراوەکانی پلاتفۆرم. بۆ وەستاندنی /stop بنێرە، و بۆ نوێترین هەواڵ هەر کاتێک /news بنێرە.', off: 'هەواڵەکان وەستێنران و ئیتر ړاگەیاندن نانێرین. ئەگەر بیرت گۆړی /subscribe بنێرە.', again: 'هەواڵەکان چالاک کران. بۆ وەستاندنیان /stop بنێرە.', foot: 'بۆ وەستاندنی هەواڵەکان /stop بنێرە' }
};
function subText(lang, k) {
  const g = SUBTXT[lang] ? lang : 'ar', s = SUBTXT[g][k];
  return (g === 'ar' || g === 'ku') ? s.replace(/\/(stop|subscribe|news)/g, '⁦/$1⁩') : s;      /* keep the command reading left to right inside Arabic and Kurdish */
}
async function subPut(env, id, lang) {
  if (!env.SUBS) return false;
  await env.SUBS.put('t:' + id, '1', { metadata: { l: lang, t: Date.now() } });
  return true;
}
async function subDel(env, id) { if (env.SUBS) await env.SUBS.delete('t:' + id); }
async function subLang(env, id) {                 /* the language a subscriber chose, else Arabic */
  try {
    if (!env.SUBS) return 'ar';
    const r = await env.SUBS.getWithMetadata('t:' + id);
    return r && r.metadata && SUBTXT[r.metadata.l] ? r.metadata.l : 'ar';
  } catch (e) { return 'ar'; }
}

/* ---------------- Telegram: the webhook answers in its own response, so the bot token is not needed here ---------------- */
async function telegram(req, env, ctx) {
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
  const text = typeof m.text === 'string' ? m.text : '';
  let out, lang = 'ar', kb = null, html = false;                /* Arabic unless the person picks another language or writes in one */
  if (!text) out = XASCORE.pick(KB.nontext, lang);
  else if (/^\/start(@\w+)?\s+welcome(_(ar|en|tr|fr|ku))?\s*$/i.test(text)) {      /* the button on the site after registering */
    const pl = /welcome_(ar|en|tr|fr|ku)/i.exec(text);
    if (pl) lang = pl[1].toLowerCase();
    out = welcomeFull(lang, m.from.first_name); kb = keyboard(lang);
    const had = env.SUBS ? await env.SUBS.get('t:' + m.chat.id) : null;
    if (await subPut(env, m.chat.id, lang)) {
      out += '\n\n' + subText(lang, 'on');
      if (!had && env.TG_TOKEN && ctx && ctx.waitUntil) ctx.waitUntil(followUp(env, m.chat.id, lang));        /* first time only */
    }
  }
  else if (/^\/(stop|unsubscribe)(@\w+)?\s*$/i.test(text)) { lang = await subLang(env, m.chat.id); await subDel(env, m.chat.id); out = subText(lang, 'off'); }
  else if (env.SUBS && /^\/subscribe(@\w+)?\s*$/i.test(text)) { await subPut(env, m.chat.id, lang); out = subText(lang, 'again'); }
  else if (/^\/news(@\w+)?(\s+(ar|en|tr|fr|ku))?\s*$/i.test(text)) {                /* the latest digest on request, nothing is stored or sent to anyone else */
    const al = /\s(ar|en|tr|fr|ku)\s*$/i.exec(text);
    lang = al ? al[1].toLowerCase() : await subLang(env, m.chat.id);
    out = digestText(lang, await digestNews(), weekNo(Date.now()), { ondemand: true }); html = true;
  }
  else if (/^\/(start|help)(@\w+)?(\s|$)/i.test(text)) { out = welcome(lang); kb = keyboard(lang); }
  else if (LANGMAP[text.trim()]) { lang = LANGMAP[text.trim()]; out = welcome(lang); kb = keyboard(lang); }        /* a language button */
  else if (/^\/lang(uage)?(@\w+)?\s*$/i.test(text)) { out = LANGPICK; kb = keyboard(lang); }
  else {
    lang = XASCORE.detect(KB, text);
    const r = reply(text, lang); out = r.text; if (!r.matched) kb = keyboard(lang);
  }
  const body = { method: 'sendMessage', chat_id: m.chat.id, text: out.slice(0, 4000), link_preview_options: { is_disabled: true } };
  if (kb) body.reply_markup = kb;
  if (html) body.parse_mode = 'HTML';
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
function tgSend(env, chat, text, html, markup) {
  const b = { chat_id: chat, text: text, link_preview_options: { is_disabled: true } };
  if (html) b.parse_mode = 'HTML';
  if (markup) b.reply_markup = markup;
  return fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
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
      const d = await r.json().catch(() => ({})), ra = d && d.parameters && d.parameters.retry_after;
      await sleep(Math.min(typeof ra === 'number' ? ra : 3, 10) * 1000);
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

/* ---------------- The weekly digest ----------------
   Once a week the platform's news and one reminder (courses, prompts, library, services, community) go to every subscriber, in the language they chose.
   It runs from a Cron Trigger, and only when the variable DIGEST is "on" (nothing is ever sent by default). The cron fires every few minutes during a window on one day;
   each firing sends one page of subscribers, and the progress (week, cursor, the chosen headlines) is kept in the KV key "job:digest", so every subscriber gets it once.
   Anyone can also ask for the latest digest with /news (that only answers them). The reminders and headings are in digest.json. */
const DIGEST_PAGE = 18;                                      /* people per firing: 3-4 calls + 18 sends + up to 18 clean-ups stays under 50 */
const DIGEST_CALLS = 46;                                     /* never start another call after this many in one firing (the free plan stops at 50) */
const weekNo = now => Math.floor((now + 3 * 36e5 + 3 * 864e5) / (7 * 864e5));       /* weeks counted from Monday 00:00 in Baghdad (UTC+3); also picks this week's reminder */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function cleanLine(s, max) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}
function digestPick(list, now) {                             /* up to 3 headlines from the last 8 days, from different sources first */
  const all = (Array.isArray(list) ? list : []).filter(i => i && typeof i.t === 'string' && /^https:\/\/[^\s"'<>\\]{4,500}$/.test(String(i.u || ''))).map(i => ({
    t: cleanLine(i.t, 110).replace(/^[a-z]/, c => c.toUpperCase()), s: cleanLine(i.s, 30), u: i.u, d: Date.parse(i.d) || 0
  })).filter(i => i.t).sort((a, b) => b.d - a.d);
  const recent = all.filter(i => i.d >= now - 8 * 864e5), pool = recent.length >= 3 ? recent : all, out = [], src = {};
  pool.forEach(i => { if (out.length < 3 && !src[i.s]) { src[i.s] = 1; out.push(i); } });
  pool.forEach(i => { if (out.length < 3 && out.indexOf(i) < 0) out.push(i); });
  return out.map(i => ({ t: i.t, s: i.s, u: i.u }));
}
async function digestNews() {                                /* the same news.json the website shows; if it cannot be read, the digest simply has no news block */
  try {
    const r = await fetch(String(KB.site || 'https://xarch.site').replace(/\/+$/, '') + '/news.json', { signal: AbortSignal.timeout(6000), cf: { cacheTtl: 300 } });
    if (!r.ok) return [];
    const d = await r.json();
    return digestPick(d && d.items, Date.now());
  } catch (e) { return []; }
}
const igUrl = () => 'https://instagram.com/' + String(KB.handle || 'xstudio4arch').replace(/^@/, '');
async function followUp(env, id, lang) {                     /* a second, short message right after the welcome: courses and the latest posts, as two buttons */
  try {
    const g = DIGEST.follow[lang] ? lang : 'ar', site = String(KB.site || 'https://xarch.site').replace(/\/+$/, '');
    const raw = Number(env.FOLLOW_MS), ms = env.FOLLOW_MS === undefined || env.FOLLOW_MS === '' || !Number.isFinite(raw) ? 2000 : raw;
    if (ms < 0) return;                                      /* the variable FOLLOW_MS = -1 turns the follow-up off */
    await sleep(ms);                                         /* let the welcome arrive first */
    await tgSend(env, id, DIGEST.follow[g], false, { inline_keyboard: [[{ text: KB.links.courses.t[g], url: site + '/' + KB.links.courses.h }], [{ text: DIGEST.ig[g], url: igUrl() }]] });
  } catch (e) { /* a missed follow-up is not worth an error */ }
}
function digestText(lang, items, wk, opt) {                  /* Telegram HTML: only text we escape ourselves, links open the site or the article */
  opt = opt || {};
  const g = DIGEST.head[lang] ? lang : 'ar', rtl = g === 'ar' || g === 'ku', iso = x => rtl ? '⁦' + x + '⁩' : x;
  const site = String(KB.site || 'https://xarch.site').replace(/\/+$/, ''), n = DIGEST.reminders.length, rem = DIGEST.reminders[((wk % n) + n) % n];
  const a = (u, label) => '<a href="' + esc(u).replace(/"/g, '&quot;') + '">' + esc(label) + '</a>';
  const nh = KB.links && KB.links.news ? KB.links.news.h : '#news';
  const blocks = ['<b>' + esc(DIGEST.head[g]) + '</b>'];
  if (items && items.length) blocks.push('<b>' + esc(DIGEST.newsH[g]) + '</b>\n' + items.map(i => '• ' + iso(a(i.u, i.t) + (i.s ? ' · ' + esc(i.s) : ''))).join('\n') + '\n' + a(site + '/' + nh, DIGEST.more[g]));
  else if (opt.ondemand) blocks.push('<b>' + esc(DIGEST.newsH[g]) + '</b>\n' + esc(DIGEST.nonews[g]) + '\n' + a(site + '/' + nh, DIGEST.more[g]));
  blocks.push('<b>' + esc(rem.h[g]) + '</b>\n' + esc(rem.b[g]) + '\n' + a(site + '/' + KB.links[rem.k].h, rem.cta[g]));
  blocks.push(a(igUrl(), DIGEST.ig[g]));
  return blocks.join('\n\n') + (opt.foot ? '\n\n' + esc(subText(g, 'foot')) : '');
}
async function digestRun(env) {
  if (env.DIGEST !== 'on' || !env.SUBS || !env.TG_TOKEN) return { skipped: 'off' };
  const wk = weekNo(Date.now());
  let calls = 1, job = null;
  try { job = await env.SUBS.get('job:digest', 'json'); } catch (e) { job = null; }
  if (job && job.w === wk && job.done) return { skipped: 'done' };                    /* this week's digest already went out */
  if (!job || job.w !== wk) { job = { w: wk, c: null, sent: 0, gone: 0, failed: 0, done: false, items: await digestNews() }; calls++; }
  const l = await env.SUBS.list({ prefix: 't:', cursor: job.c || undefined, limit: DIGEST_PAGE }); calls++;
  job.c = l.list_complete ? null : l.cursor; job.done = !!l.list_complete;
  await env.SUBS.put('job:digest', JSON.stringify(job)); calls++;                   /* saved before sending: if this firing is cut short nobody gets it twice */
  const texts = {}; let sent = 0, gone = 0, failed = 0;
  for (const k of l.keys) {
    const id = k.name.slice(2), g = k.metadata && BC_LANGS.indexOf(k.metadata.l) >= 0 ? k.metadata.l : 'ar';
    if (calls >= DIGEST_CALLS) { failed++; continue; }
    texts[g] = texts[g] || digestText(g, job.items, job.w, { foot: true });
    let r = await tgSend(env, id, texts[g], true); calls++;
    if (r.status === 429 && calls < DIGEST_CALLS) {
      const d = await r.json().catch(() => ({})), ra = d && d.parameters && d.parameters.retry_after;
      await sleep(Math.min(typeof ra === 'number' ? ra : 3, 10) * 1000);
      r = await tgSend(env, id, texts[g], true); calls++;
    }
    if (r.ok) sent++;
    else {
      const d = await r.json().catch(() => ({})), why = String((d && d.description) || '').toLowerCase();
      if ((r.status === 403 || /chat not found|deactivated|blocked/.test(why)) && calls < DIGEST_CALLS) { await env.SUBS.delete(k.name); calls++; gone++; }
      else failed++;
    }
    await sleep(40);
  }
  job.sent += sent; job.gone += gone; job.failed += failed;
  await env.SUBS.put('job:digest', JSON.stringify(job));
  return { week: wk, sent: sent, gone: gone, failed: failed, done: job.done, totalSent: job.sent };
}

export default {
  async scheduled(event, env, ctx) {                                                /* the Cron Trigger: sends the weekly digest, one page of subscribers per firing */
    ctx.waitUntil(digestRun(env).then(r => { if (r && !r.skipped) console.log(JSON.stringify({ digest: r })); }).catch(e => console.log('digest error: ' + String((e && e.message) || e).slice(0, 160))));
  },
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/') return json({ ok: true, bot: 'x-assistant', kb: KB.updated, telegram: !!env.TG_SECRET, whatsapp: !!(env.WA_VERIFY && env.WA_APP_SECRET && env.WA_TOKEN && env.WA_PHONE_ID), news: !!env.SUBS, announcements: !!(env.SUBS && env.TG_TOKEN && env.BROADCAST_KEY), digest: env.DIGEST === 'on' });
      if (path === '/telegram') return req.method === 'POST' ? await telegram(req, env, ctx) : new Response('method not allowed', { status: 405 });
      if (path === '/whatsapp') return await whatsapp(req, env, ctx);
      if (path === '/broadcast') { try { return await broadcast(req, env); } catch (e) { return bj({ ok: false, err: 'error' }, 500); } }
      return new Response('not found', { status: 404 });
    } catch (e) {
      return ok();                                              /* never make Telegram or Meta retry in a loop */
    }
  }
};
