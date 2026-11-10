#!/usr/bin/env python3
"""Build backend/bot-worker/worker.js: one file you paste into a Cloudflare Worker.

It joins these things, so the website's X Assistant and the Telegram/WhatsApp bot always say the same thing:
  assistant-core.js   the matching engine
  assistant-kb.json   the answers (edit this file to change what the assistant says)
  backend/bot-worker/digest.json   the weekly digest texts (headings and the rotating reminders, 5 languages)
  backend/bot-worker/welcome.json   the welcome message (the same texts as WELCOME in backend/Code.gs; scripts/test-welcome.js checks they match)
  backend/bot-worker/glue.js   the Telegram / WhatsApp code

Run it after changing any of them:   python3 scripts/build_bot.py
"""
import json, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()

core = rd('assistant-core.js').strip()
kb = json.loads(rd('assistant-kb.json'))
glue = rd('backend/bot-worker/glue.js').strip()
welcome = json.loads(rd('backend/bot-worker/welcome.json'))
digest = json.loads(rd('backend/bot-worker/digest.json'))

out = (
    '/* GENERATED FILE: do not edit. Built by scripts/build_bot.py from assistant-core.js + assistant-kb.json (%s) + backend/bot-worker/welcome.json + backend/bot-worker/digest.json + backend/bot-worker/glue.js */\n'
    'const XASCORE = (function () {\n'
    '  var module = { exports: {} };\n'
    '%s\n'
    '  return module.exports;\n'
    '})();\n'
    'const KB = XASCORE.prepare(%s);\n'
    'const WELCOME = %s;\n'
    'const DIGEST = %s;\n\n'
    '%s\n'
) % (kb.get('updated', ''), core, json.dumps(kb, ensure_ascii=False, separators=(',', ':')), json.dumps(welcome, ensure_ascii=False, separators=(',', ':')), json.dumps(digest, ensure_ascii=False, separators=(',', ':')), glue)

dst = os.path.join(root, 'backend/bot-worker/worker.js')
open(dst, 'w', encoding='utf-8').write(out)
print('wrote', os.path.relpath(dst, root), len(out) // 1024, 'KB')
