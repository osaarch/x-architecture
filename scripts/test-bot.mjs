/* Tests the Telegram / WhatsApp Worker without any network:  node scripts/test-bot.mjs
   (build it first with  python3 scripts/build_bot.py). The pretend secrets below are only for this test. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
t(j.method === 'sendMessage' && j.chat_id === 77 && /X Assistant/.test(j.text) && j.reply_markup.keyboard.length === 3, 'telegram: /start greets in English with quick buttons');
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
t(/text/i.test(j.text), 'telegram: a photo gets a "text only" note');
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
t(j.reply_markup && j.reply_markup.keyboard.length === 3 && j.text.length < 1500, 'welcome: quick buttons for follow-up questions, and it is short');
for (const lg of ['en', 'tr', 'fr', 'ku']) {
  r = await tw('/start welcome_' + lg, { first_name: 'Sam', language_code: 'ar' }); j = await r.json();
  t(j.text.includes('Sam') && j.text.includes('https://xarch.site') && j.text.includes('X Architecture'), 'welcome: ' + lg + ' is complete');
}
r = await tw('/start welcome', { first_name: 'Sam', language_code: 'fr' }); j = await r.json();
t(/^Bonjour Sam,/.test(j.text), 'welcome: without a language in the link it follows the Telegram language');
r = await tw('/start welcome_en', { first_name: '<b>Evil</b> x\n[link](http://bad)' }); j = await r.json();
t(!/[<>]/.test(j.text.split('\n')[0]) && !j.parse_mode, 'welcome: a strange first name cannot inject markup (plain text, no parse mode)');
r = await tw('/start welcome_en'); j = await r.json();
t(/^Hello,/.test(j.text), 'welcome: a person without a first name still gets a clean greeting');
r = await tw('/start'); j = await r.json();
t(/X Assistant/.test(j.text) && !/Thank you for registering/.test(j.text), 'welcome: a plain /start (nobody registered) still gets the short greeting');
r = await tw('/start welcome_xx'); j = await r.json();
t(!/Thank you for registering/.test(j.text), 'welcome: an unknown payload falls back to the short greeting');

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
