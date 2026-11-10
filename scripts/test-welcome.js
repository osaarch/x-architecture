/* Tests the welcome message of backend/Code.gs without Google: the script runs in a sandbox with small in-memory stand-ins for
   the Sheet, the mail service, the cache and the lock. Run: node scripts/test-welcome.js */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');

class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.rows[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v == null ? '' : v); } o.push(row); } return o; }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) { while (this.sh.rows.length < this.r) this.sh.rows.push([]); const row = this.sh.rows[this.r - 1]; while (row.length < this.c - 1) row.push(''); row[this.c - 1] = v; return this; }
  setNumberFormat() { return this; } setFontWeight() { return this; }
  createTextFinder(text) {
    const self = this, st = { whole: false, cs: true };
    const f = { matchEntireCell(b) { st.whole = b; return f; }, matchCase(b) { st.cs = b; return f; },
      findNext() {
        for (let i = 0; i < self.nr; i++) { const v = String((self.sh.rows[self.r - 1 + i] || [])[self.c - 1] || ''); const a = st.cs ? v : v.toLowerCase(), b = st.cs ? text : text.toLowerCase();
          if (st.whole ? a === b : a.indexOf(b) >= 0) return { getRow: () => self.r + i }; }
        return null;
      } };
    return f;
  }
}
class Sheet {
  constructor() { this.rows = []; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return this.rows.length + 100; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  appendRow(a) { this.rows.push(a.slice()); }
  setFrozenRows() {}
}

function fresh(opts) {
  opts = opts || {};
  const sent = [], logs = [], sheets = {}, props = {}, cache = new Map(), fetched = [];
  const st = { quota: opts.quota == null ? 100 : opts.quota, failSend: false };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet()) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, String(v)); }, remove: k => { cache.delete(k); } }) },
    MailApp: { sendEmail: o => { if (st.failSend) throw new Error('mail down'); sent.push(o); }, getRemainingDailyQuota: () => st.quota },
    GmailApp: { getAliases: () => [], sendEmail() { throw new Error('not used'); } },
    UrlFetchApp: { fetch: (u, o) => { fetched.push({ u, o }); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    Logger: { log: s => logs.push(String(s)) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), sleep() {},
      formatDate: (d, tz, f) => d.toISOString().slice(0, 10).replace(/-/g, f === 'yyyyMMdd' ? '' : '-'),
      computeHmacSha256Signature: (s, k) => Array.from(crypto.createHmac('sha256', k).update(s).digest()),
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    console
  };
  vm.createContext(ctx); vm.runInContext(CODE, ctx, { filename: 'Code.gs' });
  const post = d => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(d) } }).getContent());
  const reg = (o) => { const email = (o.email || 'ali.tester@example.com'); return post(Object.assign({ a: 'reg', name: 'Ali Hassan', email, tok: o.noTok ? '' : ctx.tok_(email.toLowerCase()), kind: 'student', stage: '3', contact: '@ali_arch', lang: 'ar', country: 'IQ', uid: 'u' + Math.random() }, o.name ? { name: o.name } : {}, o.extra || {})); };
  const users = () => sheets.Users.rows;
  const col = n => ctx.UCOLS.indexOf(n);
  return { ctx, sent, logs, sheets, props, cache, fetched, st, post, reg, users, col };
}

let total = 0, failed = 0;
function t(name, ok, info) { total++; if (!ok) { failed++; console.log('FAIL: ' + name + (info ? '  ' + info : '')); } }

/* 1. a verified new registration gets the welcome, once, with the right content */
{
  const f = fresh(), r = f.reg({ name: '<b>Ali</b> & "Co" Hassan' });
  t('registration ok', r.ok === true, JSON.stringify(r));
  t('one mail sent', f.sent.length === 1, 'sent ' + f.sent.length);
  const m = f.sent[0] || {};
  t('goes to the registered address', m.to === 'ali.tester@example.com');
  t('arabic subject', m.subject === 'أهلاً بك في X Architecture', m.subject);
  const tx = m.body || '';
  ['https://xarch.site', 'https://xarch.site/#services', 'https://xarch.site/#courses', 'https://xarch.site/#works', 'https://xarch.site/#community', '@xstudio4arch', 'info@xarch.site', '• تصميم معماري', '• دورات في برامج العمارة', 'إكس للعمارة منصة معمارية تقدّم'].forEach(s => t('text has ' + s, tx.indexOf(s) >= 0));
  t('text greets by first name', tx.indexOf('أهلاً <b>Ali</b>،') === 0, tx.slice(0, 40));
  const h = m.htmlBody || '';
  t('html escapes the name', h.indexOf('&lt;b&gt;Ali&lt;/b&gt;') >= 0 && h.indexOf('<b><b>Ali') < 0 && h.indexOf('<b>Ali</b>') < 0);
  t('html is right to left', h.indexOf('dir="rtl"') >= 0);
  t('html links to the works', h.indexOf('href="https://xarch.site/#works"') >= 0);
  t('sent as no-reply from the studio', m.noReply === true && m.name === 'X Architecture');
  t('welcomed column filled', !!f.users()[1][f.col('welcomed')], JSON.stringify(f.users()[1]));
  /* 2. registering again (an update) does not send it twice */
  const r2 = f.reg({ name: 'Ali H', extra: { stage: '4' } });
  t('second registration ok', r2.ok === true);
  t('still one mail', f.sent.length === 1, 'sent ' + f.sent.length);
  t('still one person', f.users().length === 2);
}

/* 3. every language: its own subject and direction, no platform links */
{
  const subj = { ar: 'أهلاً بك في X Architecture', en: 'Welcome to X Architecture', tr: 'X Architecture’a hoş geldiniz', fr: 'Bienvenue chez X Architecture', ku: 'بەخێربێیت بۆ X Architecture' };
  const f = fresh();
  Object.keys(subj).forEach((l, i) => {
    const r = f.reg({ email: 'person' + i + '@example.com', extra: { lang: l } });
    const m = f.sent[f.sent.length - 1] || {};
    t(l + ' registers', r.ok === true);
    t(l + ' subject', m.subject === subj[l], m.subject);
    t(l + ' direction', (m.htmlBody || '').indexOf('dir="' + (l === 'ar' || l === 'ku' ? 'rtl' : 'ltr') + '"') >= 0);
    t(l + ' has its own about text', (m.body || '').indexOf(f.ctx.WELCOME[l].intro) >= 0);
    t(l + ' lists 5 services', (m.body.match(/^• /gm) || []).length === 5);
    t(l + ' has no platform links', !/t\.me|wa\.me|instagram\.com|telegram\.me/i.test(m.body + m.htmlBody));
  });
  const un = f.reg({ email: 'unknown@example.com', extra: { lang: '' } });
  t('no language falls back to arabic', un.ok && f.sent[f.sent.length - 1].subject === subj.ar);
}

/* 4. an unconfirmed address cannot register, so no mail goes anywhere */
{
  const f = fresh(), r = f.reg({ noTok: true });
  t('unconfirmed refused', r.ok === false && r.err === 'unverified', JSON.stringify(r));
  t('nothing sent', f.sent.length === 0);
}

/* 5. no mail left today: the registration still works, the welcome waits, and welcomeExisting sends it later */
{
  const f = fresh({ quota: 2 }), r = f.reg({});
  t('registration ok without mail room', r.ok === true);
  t('welcome waits', f.sent.length === 0 && !f.users()[1][f.col('welcomed')]);
  f.st.quota = 100; f.ctx.welcomeExisting();
  t('welcomeExisting sends it', f.sent.length === 1 && !!f.users()[1][f.col('welcomed')], f.logs.join(' | '));
  t('log tells the count', /welcome sent: 1/.test(f.logs.join(' ')), f.logs.join(' | '));
  f.ctx.welcomeExisting();
  t('and not twice', f.sent.length === 1);
}

/* 6. a mail failure never fails the registration */
{
  const f = fresh(); f.st.failSend = true;
  const r = f.reg({});
  t('registration ok when mail fails', r.ok === true && f.users().length === 2, JSON.stringify(r));
  t('not marked as welcomed', !f.users()[1][f.col('welcomed')]);
}

/* 7. welcomeExisting: skips the welcomed, bad addresses and (optionally) unconfirmed ones; respects the batch size */
{
  const f = fresh(), hdr = () => f.ctx.UCOLS.slice();
  const seed = (email, o) => { const row = hdr().map(() => ''); row[f.col('email')] = email; row[f.col('name')] = o.name || 'Test Person'; row[f.col('lang')] = o.lang || 'en'; if (o.verified) row[f.col('verified')] = '2026-01-01'; if (o.welcomed) row[f.col('welcomed')] = '2026-02-01'; f.users().push(row); };
  f.sheets.Users = new Sheet(); f.sheets.Users.rows.push(hdr());
  seed('done@example.com', { welcomed: true, verified: true });
  seed('old@example.com', {});
  seed('x@y', { verified: true });
  seed('good@example.com', { verified: true });
  f.ctx.welcomeExisting();
  const to = f.sent.map(m => m.to).sort();
  t('old unconfirmed + confirmed are welcomed, rest skipped', JSON.stringify(to) === JSON.stringify(['good@example.com', 'old@example.com']), JSON.stringify(to));
  t('the already welcomed keeps its date', f.users()[1][f.col('welcomed')] === '2026-02-01');
  t('bad address is not marked', !f.users()[3][f.col('welcomed')]);
  /* unconfirmed excluded when the switch is off */
  const g = fresh(); g.ctx.WELCOME_UNVERIFIED = false;
  g.sheets.Users = new Sheet(); g.sheets.Users.rows.push(g.ctx.UCOLS.slice());
  const row = g.ctx.UCOLS.map(() => ''); row[g.col('email')] = 'old@example.com'; row[g.col('name')] = 'Old'; g.users().push(row);
  g.ctx.welcomeExisting();
  t('switch off: unconfirmed skipped', g.sent.length === 0, g.logs.join(' | '));
  /* batch size */
  const b = fresh(); b.ctx.WELCOME_BATCH = 1;
  b.sheets.Users = new Sheet(); b.sheets.Users.rows.push(b.ctx.UCOLS.slice());
  for (let i = 0; i < 3; i++) { const rw = b.ctx.UCOLS.map(() => ''); rw[b.col('email')] = 'p' + i + '@example.com'; rw[b.col('name')] = 'P'; rw[b.col('verified')] = '2026-01-01'; b.users().push(rw); }
  b.ctx.welcomeExisting();
  t('batch of one', b.sent.length === 1 && /waiting for the next run: 2/.test(b.logs.join(' ')), b.logs.join(' | '));
}

/* 8. through Resend the daily counter is shared with the confirmation codes and stops the welcomes first */
{
  const f = fresh(); f.props.RESEND_API_KEY = 'key'; f.props.MAIL_FROM = 'no-reply@xarch.site';
  const r = f.reg({});
  t('resend: registration ok', r.ok === true);
  t('resend: welcome went through the API', f.fetched.length === 1 && /api\.resend\.com/.test(f.fetched[0].u) && /X Architecture/.test(f.fetched[0].o.payload), JSON.stringify(f.fetched.map(x => x.u)));
  const key = [...f.cache.keys()].find(k => /^vd:/.test(k));
  t('resend: counter went up', key && f.cache.get(key) === '1', String(key));
  const g = fresh(); g.props.RESEND_API_KEY = 'key'; g.props.MAIL_FROM = 'no-reply@xarch.site';
  g.cache.set('vd:' + new Date().toISOString().slice(0, 10).replace(/-/g, ''), String(g.ctx.VDAILY));
  const r2 = g.reg({});
  t('resend: at the daily limit the registration still works', r2.ok === true);
  t('resend: and no welcome is sent', g.fetched.length === 0 && !g.users()[1][g.col('welcomed')]);
}

/* 9. testWelcome sends one sample to the owner and touches nothing else */
{
  const f = fresh(); f.ctx.testWelcome();
  t('sample goes to the owner only', f.sent.length === 1 && f.sent[0].to === 'owner@example.com' && !f.sheets.Users, JSON.stringify(f.sent.map(m => m.to)));
  t('sample is the arabic welcome', f.sent[0].subject === 'أهلاً بك في X Architecture');
}

/* 10. the Telegram bot says the same welcome as the e-mail: backend/bot-worker/welcome.json must equal WELCOME in Code.gs */
{
  const f = fresh(), bot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'bot-worker', 'welcome.json'), 'utf8'));
  const gs = JSON.parse(JSON.stringify(vm.runInContext('WELCOME', f.ctx)));
  t('bot welcome.json is the same as WELCOME in Code.gs', JSON.stringify(bot) === JSON.stringify(gs));
  const w = fs.readFileSync(path.join(__dirname, '..', 'backend', 'bot-worker', 'worker.js'), 'utf8');
  t('worker.js carries the same welcome (run scripts/build_bot.py after editing welcome.json)', w.includes('const WELCOME = ' + JSON.stringify(bot) + ';'));
}

console.log('total ' + total + ' failed ' + failed);
process.exit(failed ? 1 : 0);
