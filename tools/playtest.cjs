// Minimal CDP driver for headless playtesting (needs Node 22+: global WebSocket/fetch).
//
// env: CDP_PORT  devtools port, default 9321 (this repo's pair: web 5321 / CDP 9321)
//      BASE_URL  page origin,   default http://127.0.0.1:5321/
//      NAV_URL   optional full navigation URL for `scenario` (same origin, query string allowed);
//                defaults to BASE_URL. verify.sh uses it for the ?tier=&seed= leg.
//      VIEWPORT  optional "WxH"; when set, device metrics are overridden *before* the first
//                navigation, so one page and one profile can be measured at 1280×1024 and at
//                390×844 without a window manager.
//
//   node tools/playtest.cjs open <url>              fresh tab at <url>, prints boot console logs
//   node tools/playtest.cjs eval '<expr>' [nonav]   evaluate (await promises), print result
//   node tools/playtest.cjs scenario <name> [json]  inject tools/scenarios.js, run __scn.<name>()
//   node tools/playtest.cjs shot <file.png>
//   node tools/playtest.cjs logs
//
// 抄 z-biz-game-tatamibari-cos / z-biz-game-slither-cos 的同名文件（只读模板），本仓专属端口
// 5321 / 9321（tools/verify.sh 头上那段是端口表的唯一说明）。
//
// 两条本组织付过学费的口径，写在这个文件的行为里：
//   · **scenario 每次都重新 navigate**，所以"跨刷新"的 resume 对拿到的是一次真导航之后的新文档；
//     期望值走 argv（第二个参数）→ window.__expectRaw（**原样字符串**，场景里自己 JSON.parse），
//     **不走 URL 的 #expect=**：同一个文档里只换 fragment 不是导航，window.zebra 还在、存档根本没
//     被读过。check 侧仍然自己举证：场景断言 performance.timeOrigin 与上一场不同。
//   · 选哪个页面 attach 由 BASE_URL 的 origin 决定，不写死端口：一个悄悄落在 about:blank 上的
//     eval 读起来像"部署坏了"，实际是门禁连错了对象。
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.CDP_PORT || 9321);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5321/';
const ORIGIN = new URL(BASE).origin;
const VIEWPORT = /^(\d+)x(\d+)$/.exec(process.env.VIEWPORT || '');
const cmd = process.argv[2];
const arg = process.argv[3];
const rest = process.argv[4];
const isOurs = (u) => typeof u === 'string' && u.startsWith(ORIGIN);

const logs = [];

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) this.consume(msg);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  consume(m) {
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails;
      logs.push(`[EXCEPTION] ${e.exception?.description || e.text}\n  at ${e.url}:${e.lineNumber}`);
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (e.level === 'error') logs.push(`[log:error] ${e.text} ${e.url || ''}`);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools(timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return res.json();
    } catch {
      /* not bound yet */
    }
    if (Date.now() > deadline) throw new Error(`devtools never bound on :${PORT}`);
    await sleep(250);
  }
}

async function main() {
  const info = await waitForDevTools();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const cdp = new CDP(ws);

  let list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  if (cmd === 'open') {
    for (const t of list) {
      if (t.type === 'page' && isOurs(t.url)) {
        try {
          await cdp.send('Target.closeTarget', { targetId: t.id || t.targetId });
        } catch { /* already gone */ }
      }
    }
    await sleep(300);
    list = [];
  }
  const existing = cmd === 'open' ? null : list.find((t) => t.type === 'page' && isOurs(t.url));
  let sessionId;
  if (existing) {
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId: existing.id || existing.targetId, flatten: true }));
  } else {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  }

  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  if (VIEWPORT) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: Number(VIEWPORT[1]),
      height: Number(VIEWPORT[2]),
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);
  }

  const evaluate = async (expression) => {
    const r = await cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true, timeout: 900000 },
      sessionId
    );
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  const navigate = async (url) => {
    await cdp.send('Page.navigate', { url }, sessionId);
    for (let i = 0; i < 120; i++) {
      const ready = await evaluate('document.readyState').catch(() => 'loading');
      if (ready === 'complete') break;
      await sleep(100);
    }
  };

  if (cmd === 'open') {
    await navigate(arg || BASE);
    await sleep(400);
    console.log('opened ' + (arg || BASE) + '\n' + (logs.join('\n') || '(no console output)'));
  } else if (cmd === 'eval') {
    if (rest !== 'nonav') await navigate(BASE);
    const out = await evaluate(arg);
    console.log(typeof out === 'string' ? out : JSON.stringify(out));
  } else if (cmd === 'scenario') {
    const src = fs.readFileSync(path.join(__dirname, 'scenarios.js'), 'utf8');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: src }, sessionId);
    // NAV_URL 让 verify.sh 用同一个 origin 换一条腿的**导航 URL**（?tier=&seed= 那一形态）。
    // 它必须是一次真导航：片段跳转不算，所以这里走 Page.navigate 而不是改 location.hash。
    await navigate(process.env.NAV_URL || BASE);
    // Headless reports the page as hidden and the render loop may skip frames while hidden; a
    // scenario that waits on a repaint would then time out against a pretending background tab.
    await evaluate(`Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});
      Object.defineProperty(document,'visibilityState',{get:()=>'visible',configurable:true});
      window.__expectRaw = ${JSON.stringify(rest || 'null')}; 'ok'`);
    const out = await evaluate(`(async()=>{
      if (!window.__scn) throw new Error('scenarios.js never installed');
      const fn = window.__scn[${JSON.stringify(arg)}];
      if (typeof fn !== 'function') {
        throw new Error('没有这个场景：' + ${JSON.stringify(arg)} + '（已注册：' + Object.keys(window.__scn).join(',') + '）');
      }
      const r = await fn();
      return JSON.stringify(r);
    })()`);
    // Console noise first, machine-readable line last: verify.sh parses the final RESULT line,
    // so a stray '{' in a log cannot hijack the report.
    if (logs.length) console.error(logs.slice(-40).join('\n'));
    console.log('RESULT ' + out);
  } else if (cmd === 'shot') {
    await cdp.send('Page.bringToFront', {}, sessionId);
    await sleep(250);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.mkdirSync(path.dirname(arg), { recursive: true });
    fs.writeFileSync(arg, Buffer.from(data, 'base64'));
    console.log('wrote ' + arg);
  } else if (cmd === 'logs') {
    console.log(logs.join('\n') || '(clean)');
  } else {
    console.error('unknown command: ' + cmd);
    process.exit(64);
  }
  ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR ' + (err.message || err));
  if (logs.length) console.error(logs.slice(-12).join('\n'));
  process.exit(1);
});
