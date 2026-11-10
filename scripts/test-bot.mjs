/* Tests the Telegram / WhatsApp Worker without any network:  node scripts/test-bot.mjs
   (build it first with  python3 scripts/build_bot.py). The pretend secrets below are only for this test. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const W_AR_THANKS = 'شكراً لتسجيلك معنا';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), 'xas-worker-test-' + process.pid + '.mjs');
fs.copyFileSync(path.join(here, '..', 'backend', 'bot-worker', 'worker.js'), tmp);
const W = (await import(pathToFileURL(tmp).href)).default;
fs.unlinkSync(tmp);

let n = 0, bad = 0;
const t = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const env = { TG_SECRET: 'tg-test-secret', WA_VERIFY: 'wa-verify-test', WA_APP_SECRET: 'app-secret-test', WA_TOKEN: 'token-test', WA_PHONE_ID: '123456' };
const ctx = { jobs: [], waitUntil(p) { this.jobs.push(p); } };
const call = (p, init) => W.fetch(new Request('https://bot.test' + p, init), env, ctx);

/* the outgoing WhatsApp call is captured, never sent */
const sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };

// health
let r = await call('/'); let j = await r.json();
t(r.status === 200 && j.ok && j.telegram && j.whatsapp, 'health shows both channels configured');
t(!JSON.stringify(j).includes('secret'), 'health does not leak secrets');
r = await W.fetch(new Request('https://bot.test/'), {}, ctx); j = await r.json();
t(j.telegram === false && j.whatsapp === false, 'health shows nothing configured when empty');
t((await call('/nope')).status === 404, '404 for other paths');

// Telegram
const tg = (text, extra, secret) => call('/telegram', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret === undefined ? env.TG_SECRET : secret }, body: JSON.stringify({ update_id: 1, message: Object.assign({ message_id: 1, chat: { id: 77, type: 'private' }, from: { id: 77, is_bot: false, language_code: 'en' }, text }, extra || {}) }) });
t((await tg('hi', null, 'wrong')).status === 403, 'telegram: wrong secret refused');
t((await tg('hi', null, '')).status === 403, 'telegram: missing secret refused');
t((await W.fetch(new Request('https://bot.test/telegram', { method: 'POST', body: '{}' }), {}, ctx)).status === 503, 'telegram: refuses when no secret is configured');
t((await call('/telegram')).status === 405, 'telegram: GET not allowed');
r = await tg('/start'); j = await r.json();
t(j.method === 'sendMessage' && j.chat_id === 77 && /[\u0600-\u06ff]/.test(j.text) && !/What are your|Thank you/.test(j.text) && j.reply_markup.keyboard.length === 5, 'telegram: /start greets in Arabic by default (even when Telegram is set to English), with quick buttons and language buttons');
r = await tg('كم سعر الدورة المسجلة', { from: { id: 77, is_bot: false, language_code: 'en' } }); j = await r.json();
t(/175|85/.test(j.text) && /ألف/.test(j.text), 'telegram: Arabic price question answered in Arabic');
t(!/wa\.me/.test(j.text) && !/t\.me/.test(j.text), 'telegram: no platform links in answers');
r = await tg('what are your prices'); j = await r.json();
t(/250/.test(j.text) && /https:\/\/xarch\.site\//.test(j.text), 'telegram: English prices with a site link');
r = await tg('blah blah qwerty zzz'); j = await r.json();
t(j.reply_markup && /message us|directly/i.test(j.text), 'telegram: unknown question gets a polite fallback and buttons');
r = await tg('xyz', { chat: { id: 5, type: 'group' } });
t((await r.text()) === 'ok', 'telegram: groups are ignored');
r = await tg(undefined, { text: undefined, photo: [{}] }); j = await r.json();
t(/النصية/.test(j.text), 'telegram: a photo gets a "text only" note (in Arabic by default)');
// rate limit: 12 per minute per person
let last; for (let i = 0; i < 16; i++) last = await call('/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': env.TG_SECRET }, body: JSON.stringify({ message: { chat: { id: 900, type: 'private' }, from: { id: 900, is_bot: false }, text: 'hi' } }) });
t((await last.text()) === 'ok', 'telegram: more than 12 a minute is ignored');

// the welcome that the site's "Get your welcome on Telegram" button asks for: https://t.me/<bot>?start=welcome_<lang>
// (every call uses its own chat, so the 12-a-minute limit of the test chat is never touched)
let wid = 200;
const tw = (text, from) => tg(text, { chat: { id: ++wid, type: 'private' }, from: Object.assign({ id: wid, is_bot: false, language_code: 'en' }, from || {}) });
r = await tw('/start welcome_ar', { first_name: 'علي', language_code: 'en' }); j = await r.json();
t(j.method === 'sendMessage' && /^أهلاً علي،/.test(j.text) && /ماذا نقدّم/.test(j.text), 'welcome: the language in the link wins over the Telegram language, and the first name is used');
t(/https:\/\/xarch\.site\/#courses/.test(j.text) && /#works/.test(j.text) && /#services/.test(j.text) && /#community/.test(j.text), 'welcome: has the site, services, courses, student work and community links');
t(/⁦@xstudio4arch⁩/.test(j.text) && /⁦info@xarch\.site⁩/.test(j.text), 'welcome: the @name and the address keep reading left to right inside Arabic');
t(!/t\.me|wa\.me|instagram/i.test(j.text), 'welcome: no platform links');
t(j.reply_markup && j.reply_markup.keyboard.length === 5 && j.text.length < 1500, 'welcome: quick buttons for follow-up questions plus language buttons, and it is short');
for (const lg of ['en', 'tr', 'fr', 'ku']) {
  r = await tw('/start welcome_' + lg, { first_name: 'Sam', language_code: 'ar' }); j = await r.json();
  t(j.text.includes('Sam') && j.text.includes('https://xarch.site') && j.text.includes('X Architecture'), 'welcome: ' + lg + ' is complete');
}
r = await tw('/start welcome', { first_name: 'Sam', language_code: 'fr' }); j = await r.json();
t(/أهلاً Sam/.test(j.text), 'welcome: without a language in the link it is Arabic, the default');
r = await tw('/start welcome_en', { first_name: '<b>Evil</b> x\n[link](http://bad)' }); j = await r.json();
t(!/[<>]/.test(j.text.split('\n')[0]) && !j.parse_mode, 'welcome: a strange first name cannot inject markup (plain text, no parse mode)');
r = await tw('/start welcome_en'); j = await r.json();
t(/^Hello,/.test(j.text), 'welcome: a person without a first name still gets a clean greeting');
r = await tw('/start'); j = await r.json();
t(/[\u0600-\u06ff]/.test(j.text) && !/Thank you for registering/.test(j.text) && !j.text.includes(W_AR_THANKS), 'welcome: a plain /start (nobody registered) still gets the short Arabic greeting');
r = await tw('English'); j = await r.json();
t(/Hello|Hi|Welcome|X Assistant/.test(j.text) && !/[\u0600-\u06ff]{4}/.test(j.text.replace(/X Architecture/g, '')) && j.reply_markup.keyboard[0][0].text === 'What are your services?', 'language: the English button answers in English and switches the quick buttons');
r = await tw('Français'); j = await r.json();
t(/Bonjour|Bienvenue|X Assistant/.test(j.text) && j.reply_markup.keyboard[0][0].text === 'Quels sont vos services ?', 'language: the French button switches to French');
r = await tw('Türkçe'); j = await r.json();
t(j.reply_markup.keyboard[0][0].text === 'Hizmetleriniz neler?', 'language: the Turkish button switches to Turkish');
r = await tw('کوردی'); j = await r.json();
t(j.reply_markup.keyboard[0][0].text === 'خزمەتگوزارییەکانتان چین؟', 'language: the Kurdish button switches to Kurdish');
r = await tw('العربية'); j = await r.json();
t(j.reply_markup.keyboard[0][0].text === 'ما هي خدماتكم؟', 'language: the Arabic button switches back to Arabic');
r = await tw('/lang'); j = await r.json();
t(/اختر اللغة/.test(j.text) && /Choose your language/.test(j.text) && j.reply_markup.keyboard.length === 5, 'language: /lang offers the choice in every language');
t(['العربية', 'English', 'Türkçe', 'Français', 'کوردی'].every(n => JSON.stringify(j.reply_markup.keyboard).includes(n)), 'language: all five language buttons are there');
r = await tw('ما هي خدماتكم؟', { language_code: 'en' }); j = await r.json();
t(/[\u0600-\u06ff]/.test(j.text), 'language: an Arabic question gets an Arabic answer');
r = await tw('what are your services', { language_code: 'ar' }); j = await r.json();
t(/[A-Za-z]{5}/.test(j.text), 'language: writing in English gets an English answer (translation by language of the question)');
r = await tw('/start welcome_xx'); j = await r.json();
t(!/Thank you for registering/.test(j.text), 'welcome: an unknown payload falls back to the short greeting');

// ---- Telegram news: subscribers and announcements (a pretend KV namespace and a pretend Telegram API) ----
class KV {
  constructor() { this.m = new Map(); }
  async put(k, v, o) { this.m.set(k, { v, meta: o && o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async get(k) { const e = this.m.get(k); return e ? e.v : null; }
  async getWithMetadata(k) { const e = this.m.get(k); return { value: e ? e.v : null, metadata: e ? e.meta || null : null }; }
  async list({ prefix, cursor, limit }) {
    const keys = [...this.m.keys()].filter(k => k.startsWith(prefix || '')).sort(), after = cursor ? keys.filter(k => k > cursor) : keys, page = after.slice(0, limit || 1000);
    const complete = page.length >= after.length;                       /* like the real KV, the cursor is not an index: deleting keys between calls does not skip anyone */
    return { keys: page.map(name => ({ name, metadata: this.m.get(name).meta })), list_complete: complete, cursor: complete ? undefined : page[page.length - 1] };
  }
}
const kv = new KV(), env2 = Object.assign({}, env, { SUBS: kv, TG_TOKEN: 'bot-token-test-123', BROADCAST_KEY: 'broadcast-key-test-long-1234' });
const call2 = (p, init) => W.fetch(new Request('https://bot.test' + p, init), env2, ctx);
const tg2 = (id, text, from) => call2('/telegram', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': env.TG_SECRET }, body: JSON.stringify({ message: { message_id: 1, chat: { id, type: 'private' }, from: Object.assign({ id, is_bot: false, language_code: 'en' }, from || {}), text } }) });
r = await call2('/'); j = await r.json();
t(j.news === true && j.announcements === true, 'news: health shows the news are set up');
r = await call('/'); j = await r.json();
t(j.news === false && j.announcements === false, 'news: health shows them off when nothing is bound');

// subscribing happens only through the welcome link
r = await tg2(1001, '/start welcome_ar', { first_name: 'علي' }); j = await r.json();
t(kv.m.has('t:1001') && kv.m.get('t:1001').meta.l === 'ar', 'news: the welcome link subscribes the person with their language');
t(/\/stop/.test(j.text) && /ستصلك أخبار/.test(j.text), 'news: the welcome tells them about the news and /stop');
t(/⁦\/stop⁩/.test(j.text), 'news: /stop keeps reading left to right inside Arabic');
await tg2(1002, '/start'); await tg2(1002, 'what are your prices');
t(!kv.m.has('t:1002'), 'news: a plain /start or a question does not subscribe anyone');
await tg2(1003, '/start welcome_en'); await tg2(1004, '/start welcome_fr'); await tg2(1005, '/start welcome_tr'); await tg2(1006, '/start welcome_ku');
t(kv.m.size === 5, 'news: five people subscribed', kv.m.size);
r = await tg2(1003, '/stop'); j = await r.json();
t(!kv.m.has('t:1003') && /turned off/.test(j.text), 'news: /stop removes the person and says so');
r = await tg2(1003, '/subscribe'); j = await r.json();
t(kv.m.has('t:1003') && /تم تفعيل الأخبار/.test(j.text), 'news: /subscribe turns it back on (Arabic by default)');
await tg2(1003, '/start welcome_en');   /* back to English for the broadcast tests below */
r = await tg2(1005, '/stop@xstudio4arch_bot'); await r.json();
t(!kv.m.has('t:1005'), 'news: /stop works with the bot name after it (groups of commands in the menu)');
await tg2(1005, '/start welcome_tr');
r = await call2('/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': env.TG_SECRET }, body: JSON.stringify({ my_chat_member: { chat: { id: 1004, type: 'private' }, new_chat_member: { status: 'kicked' } } }) });
t((await r.text()) === 'ok' && !kv.m.has('t:1004'), 'news: someone who blocks the bot is removed');
await tg2(1004, '/start welcome_fr');
r = await tg('/stop'); j = await r.json();
t(/تم إيقاف الأخبار/.test(j.text), 'news: /stop with nothing bound still answers politely (Arabic by default)');
r = await tg('/subscribe'); j = await r.json();
t(!/turned on|تم تفعيل الأخبار/.test(j.text), 'news: /subscribe with nothing bound is just a normal question');
r = await tw('/start welcome_en'); j = await r.json();
t(!/news and offers/.test(j.text), 'news: with nothing bound the welcome does not promise news');

// announcements
let tgCalls = [], failFor = {};
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body), id = String(body.chat_id);
  tgCalls.push({ url: String(url), id, text: body.text });
  if (failFor[id] === 'blocked') return new Response(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }), { status: 403 });
  if (failFor[id] === 'bad') return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: message is too long' }), { status: 400 });
  if (failFor[id] === 'slow' && !failFor.done) { failFor.done = 1; return new Response(JSON.stringify({ ok: false, parameters: { retry_after: 0 } }), { status: 429 }); }
  return new Response('{"ok":true}', { status: 200 });
};
const bc = (body, key, method) => call2('/broadcast', { method: method || 'POST', headers: { 'content-type': 'application/json', 'Authorization': key === undefined ? 'Bearer ' + env2.BROADCAST_KEY : key }, body: method === 'GET' ? undefined : JSON.stringify(body) });
r = await call2('/broadcast', { method: 'OPTIONS' });
t(r.status === 204 && r.headers.get('access-control-allow-origin') === 'https://xarch.site' && /Authorization/i.test(r.headers.get('access-control-allow-headers')), 'broadcast: the browser preflight is answered for xarch.site only');
t((await bc({}, undefined, 'GET')).status === 405, 'broadcast: GET is not allowed');
t((await W.fetch(new Request('https://bot.test/broadcast', { method: 'POST', body: '{}' }), {}, ctx)).status === 503, 'broadcast: refuses when nothing is configured');
t((await bc({ text: 'x' }, 'Bearer nope')).status === 401, 'broadcast: wrong key refused');
t((await bc({ text: 'x' }, '')).status === 401, 'broadcast: missing key refused');
t(tgCalls.length === 0, 'broadcast: nothing sent without the right key');
r = await bc({ dry: true }); j = await r.json();
t(j.ok && j.subscribers === 5 && j.byLang.ar === 1 && j.byLang.en === 1 && tgCalls.length === 0, 'broadcast: dry run counts the subscribers by language and sends nothing', JSON.stringify(j));
t((await (await bc({ text: '   ' })).json()).err === 'empty message', 'broadcast: an empty message is refused');
t((await call2('/broadcast', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env2.BROADCAST_KEY }, body: 'not json' })).status === 400, 'broadcast: bad json refused');
t((await W.fetch(new Request('https://bot.test/broadcast', { method: 'POST', headers: { 'Authorization': 'Bearer k' }, body: '{"text":"x"}' }), { SUBS: kv, BROADCAST_KEY: 'k' }, ctx)).status === 503, 'broadcast: refuses to send without the bot token');

r = await bc({ text: 'Default text', texts: { ar: 'نص عربي', en: 'English text' } }); j = await r.json();
t(j.ok && j.done === true && j.sent === 5 && j.cursor === null && tgCalls.length === 5, 'broadcast: sends to everyone in one page and says it is done', JSON.stringify(j));
const by = id => tgCalls.find(c => c.id === id).text;
t(/^نص عربي/.test(by('1001')) && /^English text/.test(by('1003')) && /^Default text/.test(by('1004')), 'broadcast: each person gets their own language, others get the default');
t(/\/stop/.test(by('1001')) && /\/stop/.test(by('1003')) && /Pour arr/.test(by('1004')), 'broadcast: every message ends with how to stop, in their language');
t(tgCalls.every(c => c.url === 'https://api.telegram.org/botbot-token-test-123/sendMessage'), 'broadcast: goes to the Telegram API with the bot token');
t(!JSON.stringify(j).includes('bot-token'), 'broadcast: the token never comes back in the answer');

// paging, blocked people, rate limit
for (let i = 2000; i < 2050; i++) kv.m.set('t:' + i, { v: '1', meta: { l: 'en' } });          // 55 people in all
tgCalls = []; failFor = { '2003': 'blocked', '2004': 'bad', '2005': 'slow' };
let cur = null, tot = { sent: 0, gone: 0, failed: 0 }, pages = 0;
do {
  j = await (await bc({ text: 'Hello all', cursor: cur || undefined })).json(); pages++;
  tot.sent += j.sent; tot.gone += j.gone; tot.failed += j.failed; cur = j.cursor;
} while (!j.done && pages < 10);
t(pages === 3 && tot.sent === 53 && tot.gone === 1 && tot.failed === 1, 'broadcast: 55 people take 3 pages (20 each); one blocked person and one failure are counted', JSON.stringify([pages, tot]));
t(!kv.m.has('t:2003') && kv.m.has('t:2004'), 'broadcast: a person who blocked the bot is removed, but a failed message does not remove anyone');
t(tgCalls.filter(c => c.id === '2005').length === 2, 'broadcast: a "slow down" from Telegram is waited out and retried once');
t(tgCalls.every(c => c.text.length < 4096), 'broadcast: messages stay under the Telegram limit');
r = await bc({ text: 'x'.repeat(9000) }); j = await r.json();
t(j.ok && tgCalls[tgCalls.length - 1].text.length < 4096, 'broadcast: a very long text is cut to fit');
// too many wrong keys
for (let i = 0; i < 9; i++) await bc({ text: 'x' }, 'Bearer wrong' + i);
t((await bc({ text: 'x' }, 'Bearer wrong')).status === 429, 'broadcast: many wrong keys in a minute are slowed down');
globalThis.fetch = async (url, init) => { sent.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };

// WhatsApp verification
r = await call('/whatsapp?hub.mode=subscribe&hub.verify_token=wa-verify-test&hub.challenge=CHAL123');
t(r.status === 200 && (await r.text()) === 'CHAL123', 'whatsapp: verify returns the challenge as plain text');
t((await call('/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=x')).status === 403, 'whatsapp: wrong verify token refused');

// WhatsApp messages
const sign = (raw, secret) => 'sha256=' + crypto.createHmac('sha256', secret || env.WA_APP_SECRET).update(raw).digest('hex');
const hook = (text, id, sig, type) => {
  const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: '9647700000000', id: id, type: type || 'text', text: type ? undefined : { body: text } }] } }] }] });
  return call('/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Hub-Signature-256': sig === undefined ? sign(raw) : sig }, body: raw });
};
t((await hook('hi', 'm0', 'sha256=' + '0'.repeat(64))).status === 403, 'whatsapp: bad signature refused');
t((await hook('hi', 'm0', '')).status === 403, 'whatsapp: missing signature refused');
t((await hook('hi', 'm0', sign('{}', 'other-secret'))).status === 403, 'whatsapp: signature from another secret refused');
t(sent.length === 0, 'whatsapp: nothing sent for refused requests');
r = await hook('شكد سعر الدورة', 'm1'); await Promise.all(ctx.jobs);
t(r.status === 200 && sent.length === 1, 'whatsapp: a valid message gets one reply');
const o = sent[0], body = JSON.parse(o.init.body);
t(o.url === 'https://graph.facebook.com/v23.0/123456/messages', 'whatsapp: replies to the right endpoint');
t(o.init.headers.Authorization === 'Bearer token-test', 'whatsapp: replies with the token');
t(body.to === '9647700000000' && body.messaging_product === 'whatsapp' && body.type === 'text' && body.text.preview_url === false, 'whatsapp: reply format');
t(/ألف/.test(body.text.body) && !/wa\.me/.test(body.text.body), 'whatsapp: Arabic answer without a platform link');
await hook('شكد سعر الدورة', 'm1'); await Promise.all(ctx.jobs);
t(sent.length === 1, 'whatsapp: the same message id is answered only once');
await hook('', 'm2', undefined, 'image'); await Promise.all(ctx.jobs);
t(sent.length === 2 && /text/i.test(JSON.parse(sent[1].init.body).text.body), 'whatsapp: an image gets a "text only" note');
t((await W.fetch(new Request('https://bot.test/whatsapp', { method: 'POST', body: '{}' }), { WA_VERIFY: 'x' }, ctx)).status === 503, 'whatsapp: refuses when not configured');
t((await call('/whatsapp', { method: 'PUT' })).status === 405, 'whatsapp: other methods refused');

console.log('total', n, 'failed', bad);
process.exit(bad ? 1 : 0);
