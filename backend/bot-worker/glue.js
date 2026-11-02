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
function keyboard(lang) {
  const c = (KB.chips && KB.chips[lang]) || [], rows = [];
  for (let i = 0; i < c.length; i += 2) rows.push(c.slice(i, i + 2).map(t => ({ text: t })));
  return { keyboard: rows, resize_keyboard: true };
}

/* ---------------- Telegram: the webhook answers in its own response, so the bot token is not needed here ---------------- */
async function telegram(req, env) {
  if (!env.TG_SECRET) return new Response('not configured', { status: 503 });
  if (!safeEq(req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TG_SECRET)) return new Response('forbidden', { status: 403 });
  if (+req.headers.get('content-length') > 65536) return ok();
  let u; try { u = await req.json(); } catch (e) { return ok(); }
  const m = u && u.message;
  if (!m || !m.chat || m.chat.type !== 'private' || !m.from || m.from.is_bot) return ok();   /* private chats only, edits ignored */
  if (limited('t' + m.chat.id)) return ok();
  const hint = TG_LANG[String(m.from.language_code || '').toLowerCase().slice(0, 3)] || TG_LANG[String(m.from.language_code || '').toLowerCase().slice(0, 2)] || 'ar';
  const text = typeof m.text === 'string' ? m.text : '';
  let out, lang = hint, kb = null;
  if (!text) out = XASCORE.pick(KB.nontext, lang);
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

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/') return json({ ok: true, bot: 'x-assistant', kb: KB.updated, telegram: !!env.TG_SECRET, whatsapp: !!(env.WA_VERIFY && env.WA_APP_SECRET && env.WA_TOKEN && env.WA_PHONE_ID) });
      if (path === '/telegram') return req.method === 'POST' ? await telegram(req, env) : new Response('method not allowed', { status: 405 });
      if (path === '/whatsapp') return await whatsapp(req, env, ctx);
      return new Response('not found', { status: 404 });
    } catch (e) {
      return ok();                                              /* never make Telegram or Meta retry in a loop */
    }
  }
};
