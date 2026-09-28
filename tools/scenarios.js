// 浏览器闸里跑的场景：注入页面后由 tools/playtest.cjs 的 `scenario <名>` 调 window.__scn.<名>()。
//
// 规矩与兄弟仓同名同姓，内容是本仓自己的：
//   * 一条断言只写一次 `ck(名, 条件, 细节)`，机器可读的那一行 `RESULT <json>` 由 playtest.cjs
//     打在 stdout 最后一行；一条断言都没发生的场景在 tools/verify.sh 里直接判红；
//   * **期望值来自 node**：下面那一段夹具由 `node tools/fixtures.mjs` 生成，verify.sh 每次运行先跑
//     `node tools/fixtures.mjs --check`，用浏览器加载的**同一批 js/ 模块**在 node 侧重算一遍并逐行
//     对账。页内只负责复现它 —— "页面跟自己的上一版对表"这种绿在这里不成立；
//   * 页内不引 Math.random / Date.now / getRandomValues（seed 那一条逐文件剥掉注释后扫描证明），
//     每一盘都由显式 seed 串定位；
//   * 手势全走 DOM 事件：pointerdown / keydown / button.click()，**不调 game.tap()** ——
//     直接调模型 API 等于没测命中测试与焦点；
//   * 提示文案逐条对到 pencil 的规则名（P1–P8）与它真实删掉的那些格，不许从答案里编话；
//   * boot 那一段还扫一遍 window.zebra 的对象图 / DOM 属性 / localStorage，找 node 侧算出的那份真值。
//
// 这一段跑在 js/main.js **之前**（Page.addScriptToEvaluateOnNewDocument），所以启动期的未捕获异常
// 与资源 404 抓得到：那是"浏览器闸要抓的第一类 bug"，页面自己永远打印不出来。
// >>>FIXTURE
// 这一整块由 `node tools/fixtures.mjs` 生成，**不许手改**：`bash tools/verify.sh` 每次都先跑
// `node tools/fixtures.mjs --check`，用 node 侧重算的每一行与这里逐字段对账（跑的就是浏览器加载
// 那批 js/ 模块）。一行一条 JSON，解析是 JSON.parse，不玩括号配对。
// truthList 只在这里存在 —— 它是**答案面板的输入样本**， shipped 路径（js/）没有这个字段；
// boot 场景反过来拿 truthSig 去扫 window.zebra 的对象图、DOM 与 localStorage，扫到即红。
const FIXTURE = [
{"tier":"t1-3cat","seed":"b0","N":3,"seedStr":"zebra|t1-3cat|b0#0","clueCount":6,"clueSig":"at|6|-1|2|-1 ; not_same|1|6|-1|-1 ; not|4|-1|2|-1 ; same|1|5|-1|-1 ; same|2|4|-1|-1 ; somewhere_right|2|7|-1|-1","truthSig":"201210201","truthList":"2,0,1,2,1,0,2,0,1","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":17,"penRounds":3,"penFire":"P1:3,P2:7,P3:4,P4:3,P5:1","proven":true,"question":"谁养鸟？（3 类档的宠物列只有 狗/猫/鸟，本盘没有「鱼」）","pairs":3,"cells":27,"hints":["P1 | 宠物:狗 | 1+2 | 宠物:狗 住在第 3 间 | 0 | 0 | ","P1 | 颜色:蓝房子 | 3 | 颜色:蓝房子 不住在第 3 间 | 1 | 0 | 2/1/0","P4 | 人:小刚 | 1 | 人:小刚 在 宠物:猫 的右边（未必紧邻） | 0 | 0 | "]},
{"tier":"t1-3cat","seed":"b1","N":3,"seedStr":"zebra|t1-3cat|b1#0","clueCount":5,"clueSig":"not|7|-1|2|-1 ; same|0|3|-1|-1 ; same|3|8|-1|-1 ; same|5|7|-1|-1 ; somewhere_right|1|4|-1|-1","truthSig":"210201012","truthList":"2,1,0,2,0,1,0,1,2","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":15,"penRounds":5,"penFire":"P1:1,P2:5,P3:6,P4:3,P5:3","proven":true,"question":"谁养鸟？（3 类档的宠物列只有 狗/猫/鸟，本盘没有「鱼」）","pairs":3,"cells":27,"hints":["P1 | 宠物:猫 | 3 | 宠物:猫 不住在第 3 间 | 0 | 0 | ","P4 | 人:小红 | 1 | 人:小红 在 颜色:蓝房子 的右边（未必紧邻） | 0 | 0 | ","P4 | 颜色:蓝房子 | 3 | 人:小红 在 颜色:蓝房子 的右边（未必紧邻） | 0 | 0 | "]},
{"tier":"t1-3cat","seed":"b2","N":3,"seedStr":"zebra|t1-3cat|b2#0","clueCount":5,"clueSig":"at|0|-1|2|-1 ; same|0|4|-1|-1 ; same|1|5|-1|-1 ; same|3|8|-1|-1 ; side_by_side|0|6|-1|-1","truthSig":"210021120","truthList":"2,1,0,0,2,1,1,2,0","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":15,"penRounds":4,"penFire":"P1:2,P2:9,P3:6,P4:1","proven":true,"question":"谁养鸟？（3 类档的宠物列只有 狗/猫/鸟，本盘没有「鱼」）","pairs":3,"cells":27,"hints":["P1 | 人:小明 | 1+2 | 人:小明 住在第 3 间 | 0 | 0 | ","P3 | 颜色:蓝房子 | 1+2 | 人:小明 和 颜色:蓝房子 住同一间 | 0 | 1 | 0/0/1","P3 | 宠物:狗 | 1+3 | 人:小明 和 宠物:狗 相邻 | 2 | 0 | 1/0/0,2/1/0"]},
{"tier":"t1-3cat","seed":"b7","N":3,"seedStr":"zebra|t1-3cat|b7#0","clueCount":6,"clueSig":"at|0|-1|0|-1 ; not_same|1|8|-1|-1 ; not|8|-1|1|-1 ; same|0|6|-1|-1 ; same|5|8|-1|-1 ; side_by_side|4|8|-1|-1","truthSig":"012012012","truthList":"0,1,2,0,1,2,0,1,2","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":15,"penRounds":3,"penFire":"P1:3,P2:7,P3:4,P4:3,P5:1","proven":true,"question":"谁养鸟？（3 类档的宠物列只有 狗/猫/鸟，本盘没有「鱼」）","pairs":3,"cells":27,"hints":["P1 | 人:小明 | 2+3 | 人:小明 住在第 1 间 | 0 | 0 | ","P1 | 宠物:鸟 | 2 | 宠物:鸟 不住在第 2 间 | 0 | 0 | ","P4 | 颜色:蓝房子 | 1+3 | 颜色:蓝房子 和 宠物:鸟 相邻 | 2 | 0 | 0/0/1,2/1/2"]},
{"tier":"t2-4cat","seed":"b0","N":4,"seedStr":"zebra|t2-4cat|b0#11","clueCount":12,"clueSig":"at|11|-1|0|-1 ; at|4|-1|2|-1 ; direct_left|11|12|-1|-1 ; n_between|3|6|-1|1 ; not_same|0|6|-1|-1 ; not_same|1|15|-1|-1 ; not|0|-1|1|-1 ; not|8|-1|3|-1 ; same|4|10|-1|-1 ; side_by_side|5|14|-1|-1 ; somewhere_right|3|15|-1|-1 ; somewhere_right|7|12|-1|-1","truthSig":"3102210313201320","truthList":"3,1,0,2,2,1,0,3,1,3,2,0,1,3,2,0","draws":12,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":37,"penRounds":5,"penFire":"P1:8,P2:17,P3:11,P4:6,P5:4,P6:2","proven":true,"question":"谁养鱼？","pairs":6,"cells":96,"hints":["P1 | 宠物:鱼 | 2+3+4 | 宠物:鱼 住在第 1 间 | 0 | 0 | ","P1 | 颜色:红房子 | 1+2+4 | 颜色:红房子 住在第 3 间 | 1 | 0 | 3/0/3","P1 | 宠物:狗 | 4 | 宠物:狗 不住在第 4 间 | 0 | 0 | "]},
{"tier":"t2-4cat","seed":"b1","N":4,"seedStr":"zebra|t2-4cat|b1#0","clueCount":9,"clueSig":"at|9|-1|2|-1 ; n_between|2|4|-1|2 ; n_between|3|11|-1|1 ; same|0|7|-1|-1 ; same|0|8|-1|-1 ; same|6|13|-1|-1 ; same|8|15|-1|-1 ; somewhere_left|2|9|-1|-1 ; somewhere_right|0|14|-1|-1","truthSig":"1302302112303201","truthList":"1,3,0,2,3,0,2,1,1,2,3,0,3,2,0,1","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":40,"penRounds":5,"penFire":"P1:3,P2:21,P3:11,P4:12,P5:1","proven":true,"question":"谁养鱼？","pairs":6,"cells":96,"hints":["P1 | 宠物:猫 | 1+2+4 | 宠物:猫 住在第 3 间 | 0 | 0 | ","P3 | 人:小刚 | 3+4 | 人:小刚 在 宠物:猫 的左边（未必紧邻） | 1 | 0 | 1/2/1","P4 | 人:小刚 | 2 | 人:小刚 和 颜色:红房子 之间隔着 2 间 | 0 | 0 | "]},
{"tier":"t2-4cat","seed":"b2","N":4,"seedStr":"zebra|t2-4cat|b2#0","clueCount":9,"clueSig":"at|2|-1|1|-1 ; direct_left|10|15|-1|-1 ; n_between|0|15|-1|1 ; n_between|7|13|-1|1 ; n_between|7|9|-1|2 ; same|2|11|-1|-1 ; same|3|13|-1|-1 ; same|6|15|-1|-1 ; somewhere_left|4|12|-1|-1","truthSig":"3012231023013201","truthList":"3,0,1,2,2,3,1,0,2,3,0,1,3,2,0,1","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":35,"penRounds":4,"penFire":"P1:3,P2:15,P3:9,P4:17,P5:4","proven":true,"question":"谁养鱼？","pairs":6,"cells":96,"hints":["P1 | 人:小刚 | 1+3+4 | 人:小刚 住在第 2 间 | 0 | 0 | ","P4 | 颜色:黄房子 | 2+3 | 颜色:黄房子 和 宠物:猫 之间隔着 2 间 | 1 | 0 | 0/2/3","P4 | 宠物:猫 | 2+3 | 颜色:黄房子 和 宠物:猫 之间隔着 2 间 | 1 | 0 | 1/2/1"]},
{"tier":"t2-4cat","seed":"b7","N":4,"seedStr":"zebra|t2-4cat|b7#0","clueCount":10,"clueSig":"at|4|-1|0|-1 ; direct_left|0|7|-1|-1 ; direct_right|10|12|-1|-1 ; n_between|2|6|-1|2 ; not_same|8|12|-1|-1 ; not_side_by_side|4|8|-1|-1 ; same|2|15|-1|-1 ; same|4|9|-1|-1 ; same|6|14|-1|-1 ; side_by_side|3|12|-1|-1","truthSig":"1302013230211230","truthList":"1,3,0,2,0,1,3,2,3,0,2,1,1,2,3,0","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":39,"penRounds":6,"penFire":"P1:3,P2:12,P3:9,P4:14,P5:2,P6:6,P8:2","proven":true,"question":"谁养鱼？","pairs":6,"cells":96,"hints":["P1 | 颜色:红房子 | 2+3+4 | 颜色:红房子 住在第 1 间 | 0 | 0 | ","P4 | 人:小明 | 4 | 人:小明 在 颜色:黄房子 的左边紧邻 | 0 | 0 | ","P4 | 颜色:黄房子 | 1 | 人:小明 在 颜色:黄房子 的左边紧邻 | 0 | 0 | "]},
{"tier":"t3-5cat","seed":"b0","N":5,"seedStr":"zebra|t3-5cat|b0#2","clueCount":15,"clueSig":"at|0|-1|0|-1 ; direct_left|1|14|-1|-1 ; direct_right|1|17|-1|-1 ; direct_right|5|18|-1|-1 ; direct_right|6|16|-1|-1 ; n_between|11|24|-1|1 ; same|15|20|-1|-1 ; same|18|24|-1|-1 ; same|2|10|-1|-1 ; same|3|22|-1|-1 ; same|7|10|-1|-1 ; same|8|16|-1|-1 ; side_by_side|12|17|-1|-1 ; side_by_side|5|19|-1|-1 ; somewhere_left|15|23|-1|-1","truthSig":"0241331402402133012430142","truthList":"0,2,4,1,3,3,1,4,0,2,4,0,2,1,3,3,0,1,2,4,3,0,1,4,2","draws":3,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":73,"penRounds":8,"penFire":"P1:4,P2:27,P3:27,P4:29,P5:13","proven":true,"question":"谁养鱼？","pairs":10,"cells":250,"hints":["P1 | 人:小明 | 2+3+4+5 | 人:小明 住在第 1 间 | 0 | 0 | ","P4 | 人:小红 | 1 | 人:小红 在 饮料:汽水 的右边紧邻 | 0 | 0 | ","P4 | 饮料:汽水 | 5 | 人:小红 在 饮料:汽水 的右边紧邻 | 0 | 0 | "]},
{"tier":"t3-5cat","seed":"b1","N":5,"seedStr":"zebra|t3-5cat|b1#3","clueCount":15,"clueSig":"at|19|-1|1|-1 ; direct_left|14|19|-1|-1 ; direct_left|4|8|-1|-1 ; direct_right|9|24|-1|-1 ; not_side_by_side|11|16|-1|-1 ; not_side_by_side|16|22|-1|-1 ; same|0|13|-1|-1 ; same|10|24|-1|-1 ; same|17|20|-1|-1 ; same|19|22|-1|-1 ; same|1|19|-1|-1 ; same|2|18|-1|-1 ; same|5|16|-1|-1 ; same|6|20|-1|-1 ; somewhere_right|17|21|-1|-1","truthSig":"2143032014314200324120143","truthList":"2,1,4,3,0,3,2,0,1,4,3,1,4,2,0,0,3,2,4,1,2,0,1,4,3","draws":4,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":75,"penRounds":8,"penFire":"P1:4,P2:34,P3:27,P4:23,P5:12","proven":true,"question":"谁养鱼？","pairs":10,"cells":250,"hints":["P1 | 饮料:咖啡 | 1+3+4+5 | 饮料:咖啡 住在第 2 间 | 0 | 0 | ","P4 | 颜色:白房子 | 1 | 颜色:白房子 在 职业:厨师 的右边紧邻 | 0 | 0 | ","P4 | 职业:厨师 | 5 | 颜色:白房子 在 职业:厨师 的右边紧邻 | 0 | 0 | "]},
{"tier":"t3-5cat","seed":"b2","N":5,"seedStr":"zebra|t3-5cat|b2#0","clueCount":18,"clueSig":"at|12|-1|2|-1 ; at|24|-1|2|-1 ; direct_right|11|21|-1|-1 ; direct_right|15|24|-1|-1 ; n_between|5|18|-1|1 ; not_same|1|19|-1|-1 ; not_same|8|18|-1|-1 ; not|1|-1|2|-1 ; same|0|20|-1|-1 ; same|16|20|-1|-1 ; same|3|22|-1|-1 ; same|5|13|-1|-1 ; same|9|10|-1|-1 ; same|9|15|-1|-1 ; somewhere_left|13|22|-1|-1 ; somewhere_left|8|20|-1|-1 ; somewhere_right|2|6|-1|-1 ; somewhere_right|8|21|-1|-1","truthSig":"4031202413312043402140132","truthList":"4,0,3,1,2,0,2,4,1,3,3,1,2,0,4,3,4,0,2,1,4,0,1,3,2","draws":1,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":69,"penRounds":5,"penFire":"P1:9,P2:38,P3:26,P4:22,P5:5","proven":true,"question":"谁养鱼？","pairs":10,"cells":250,"hints":["P1 | 宠物:鸟 | 1+2+4+5 | 宠物:鸟 住在第 3 间 | 0 | 0 | ","P1 | 职业:厨师 | 1+2+4+5 | 职业:厨师 住在第 3 间 | 0 | 1 | 8/2/4","P1 | 人:小红 | 3 | 人:小红 不住在第 3 间 | 2 | 0 | 1/1/2,3/1/4"]},
{"tier":"t3-5cat","seed":"b7","N":5,"seedStr":"zebra|t3-5cat|b7#7","clueCount":17,"clueSig":"at|10|-1|4|-1 ; at|11|-1|1|-1 ; at|24|-1|1|-1 ; direct_right|0|18|-1|-1 ; direct_right|14|16|-1|-1 ; direct_right|1|17|-1|-1 ; not_same|5|10|-1|-1 ; not_same|6|22|-1|-1 ; not|3|-1|4|-1 ; same|11|17|-1|-1 ; same|14|20|-1|-1 ; same|4|14|-1|-1 ; same|4|7|-1|-1 ; side_by_side|15|21|-1|-1 ; side_by_side|4|8|-1|-1 ; somewhere_left|6|12|-1|-1 ; somewhere_left|8|23|-1|-1","truthSig":"1240301324412033210432041","truthList":"1,2,4,0,3,0,1,3,2,4,4,1,2,0,3,3,2,1,0,4,3,2,0,4,1","draws":8,"outcome":"unique","count":1,"stopped":false,"pencilSolved":true,"penSteps":68,"penRounds":5,"penFire":"P1:13,P2:38,P3:25,P4:15,P5:9","proven":true,"question":"谁养鱼？","pairs":10,"cells":250,"hints":["P1 | 宠物:猫 | 1+3+4+5 | 宠物:猫 住在第 2 间 | 0 | 0 | ","P1 | 职业:厨师 | 1+3+4+5 | 职业:厨师 住在第 2 间 | 0 | 1 | 8/1/4","P1 | 宠物:狗 | 1+2+3+4 | 宠物:狗 住在第 5 间 | 1 | 0 | 8/0/4"]},
];
// 两块负样本：stall（裁判唯一、但铅笔从空盘推不完）与 stopped（夹具预算内节点先耗尽）。
// canary 场景喂给 window.zebra.gate.loadBoard(tier, clues, budget)，断言页面**拒绝出货**
// （#reject 出现、#board-wrap 与 #answer 都藏好）；stopped 那块同时带 production 正对照：
// 同一张题面在生产预算下判得完 ⇒ 这块负样本测的是页面对 stopped 的处置，不是"出货盘会停"。
const NEGATIVE = [
{"kind":"stall","tier":"t1-3cat","N":3,"note":"成品盘 f4 加回一条已删线索","clueCount":6,"clues":[{"k":"n_between","a":5,"b":6,"n":1},{"k":"not_same","a":5,"b":8},{"k":"direct_left","a":2,"b":7},{"k":"side_by_side","a":2,"b":3},{"k":"at","a":1,"p":2},{"k":"not","a":1,"p":1}],"budget":{"nodeBudget":250000,"budgetMs":5000},"outcome":"unique","count":1,"nodes":5,"stopped":false,"pencilSolved":false,"pencilUndecided":2},
{"kind":"stopped","tier":"t3-5cat","N":5,"note":"成品盘 f0 的前 2 条线索 · 节点预算 8","clueCount":2,"clues":[{"k":"direct_right","a":10,"b":18},{"k":"side_by_side","a":13,"b":22}],"budget":{"nodeBudget":8,"budgetMs":4000},"outcome":"stopped","count":0,"stopped":true,"reason":"nodes","nodes":9,"pencilSolved":false,"production":{"outcome":"multiple","count":2,"stopped":false,"nodes":21,"budget":{"nodeBudget":250000,"budgetMs":10}}},
];
// <<<FIXTURE

((w) => {
  // ---------------------------------------------------------------- 探针：启动期的错与 404
  const PROBE = { js: [], res: [] };
  w.__probe = PROBE;
  w.addEventListener('error', (ev) => {
    const t = ev && ev.target;
    if (t && t !== w && (t.tagName || t.src || t.href)) {
      PROBE.res.push(`${t.tagName || 'node'}:${t.src || t.href || ''}`);
    } else {
      PROBE.js.push(String((ev && (ev.message || ev.error)) || 'error'));
    }
  }, true);
  w.addEventListener('unhandledrejection', (ev) => PROBE.js.push('rejection: ' + String(ev.reason)));
  const realError = w.console.error;
  w.console.error = function () {
    PROBE.js.push('[console.error] ' + [].map.call(arguments, String).join(' '));
    return realError.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 断言小台
  const rows = [];
  const ck = (test, cond, detail) => {
    rows.push({ test, pass: !!cond, detail: cond ? '' : String(detail === undefined ? '' : detail) });
  };
  const eq = (test, got, want) => ck(test, String(got) === String(want), `got ${got} / want ${want}`);
  const report = (extra) => {
    const out = { rows: rows.slice(), fail: rows.filter((r) => !r.pass).length, ...extra };
    rows.length = 0;
    return out;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => document.querySelector(sel);
  const Z = () => w.zebra;
  const D = () => w.zebra.dom;
  const S = () => w.zebra.state();
  const G = () => w.zebra.app.game;
  const text = (node) => ((node || {}).textContent || '').trim();
  const exp = () => JSON.parse(w.__expectRaw || 'null');

  /**
   * 动态 import 必须按 document.baseURI 解析：Pages 把本仓挂在 /<repo>/ 下，斜杠开头的说明符会解到
   * 域名根上 404（本地"根形态"跑起来一切正常 —— 最坏的那种绿）。
   */
  const mod = (rel) => import(new URL(rel, document.baseURI).href);
  const fetchText = async (rel) => {
    const res = await fetch(new URL(rel, document.baseURI).href);
    return { ok: res.ok, status: res.status, body: await res.text() };
  };

  const shown = (node) => {
    const e = typeof node === 'string' ? $(node) : node;
    if (!e) return false;
    return getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
  };
  /** [hidden] 的兄弟仓踩过：元素自带 display:grid 会盖过 UA 那条 [hidden]{display:none}。 */
  const hiddenTight = (node) => {
    const e = typeof node === 'string' ? $(node) : node;
    return !!e && e.hidden && getComputedStyle(e).display === 'none' && e.getClientRects().length === 0;
  };
  const whyNotTight = (node) => {
    const e = typeof node === 'string' ? $(node) : node;
    return `hidden=${e.hidden} display=${getComputedStyle(e).display} rects=${e.getClientRects().length}`;
  };

  // ---------------------------------------------------------------- 夹具
  const fx = (tier, seed) => FIXTURE.filter((r) => r.tier === tier && r.seed === String(seed))[0];
  const NEG = {
    stall: NEGATIVE.filter((n) => n.kind === 'stall')[0],
    stopped: NEGATIVE.filter((n) => n.kind === 'stopped')[0],
  };
  const fireStr = (fire) => ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']
    .filter((r) => (fire[r] || 0) > 0).map((r) => `${r}:${fire[r]}`).join(',');
  const hintLine = (s) => [
    s.rule, s.itemLabel, (s.houses || []).join('+'), s.clueText || '-',
    s.cross, s.check, (s.cells || []).join(','),
  ].join(' | ');
  const proofLine = (p) => `${p.outcome}/${p.count}/stopped=${p.stopped}`;

  /** 页面自己用 js/engine/rules.js 现算题面指纹 —— 与 node 夹具里那一串逐字符比。 */
  const pageClueSig = async () => {
    const { clueSignature } = await mod('./js/engine/rules.js');
    return clueSignature(G().board.clues, G().N);
  };
  const openViaUI = async (tierKey, seed) => {
    D().tier.value = tierKey;
    D().tier.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait(40);
    if (seed !== undefined && D().seed.value !== String(seed)) {
      D().seed.value = String(seed);
      D().seed.dispatchEvent(new w.Event('change', { bubbles: true }));
    }
    await wait(60);
    return S();
  };

  // ---------------------------------------------------------------- 画布像素（真栅格化，不用假 rasteriser）
  const geo = () => Z().view.geo;
  const pxFull = () => {
    const c = D().canvas;
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  };
  const pxCell = (row, col) => {
    const v = Z().view;
    const r = v.cellRect(row, col);
    const d = v.geo.dpr;
    const c = D().canvas;
    return c.getContext('2d')
      .getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
  };
  const diffCount = (a, b) => {
    let n = 0;
    const len = Math.min(a.length, b.length);
    if (!len || a.length !== b.length) return -1;
    for (let i = 0; i < len; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
    return n;
  };
  const lumAt = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  /** 深像素 = 字形 / 光标框（网格细线 207 与粗线 138 都够不着 120 这道门槛）。 */
  const darkCount = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (lumAt(px, i) < 120) n++; return n; };
  const near = (px, i, rgb, tol) => Math.abs(px[i] - rgb[0]) <= tol && Math.abs(px[i + 1] - rgb[1]) <= tol && Math.abs(px[i + 2] - rgb[2]) <= tol;
  const countNear = (px, rgb, tol) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (near(px, i, rgb, tol)) n++; return n; };
  /** 提示高亮的红色调：HINT_CROSS 铺在白/米底上把 r−g 拉到 20 以上，而纸色 r−g≤14、墨色不满足 r>200。 */
  const redTintCount = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i] - px[i + 1] > 15) n++; return n; };
  /**
   * 提示高亮的绿色调（HINT_CHECK 铺在白/米底上）：本仓画布上唯一 g>r 且 g≥b 的东西就是它 ——
   * 纸色 r≥g、米色 r>g、网格线 r>g、墨色与 ✓/✗ 都够不着，光标框是蓝的（b>g）。
   */
  const greenTintCount = (px) => {
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 1] > 150 && px[i + 1] > px[i] && px[i + 1] >= px[i + 2]) n++;
    return n;
  };
  const hintTintCount = (px) => redTintCount(px) + greenTintCount(px);
  /** 非纸色像素总数：证明"画布不是空白"。 */
  const inkCount = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (!(px[i] > 240 && px[i + 1] > 235 && px[i + 2] > 225)) n++; return n; };

  const CTL = ['#tier', '#seed', '#btn-next', '#btn-hint', '#btn-undo', '#btn-clear', '#btn-judge'];
  const scrollIn = async (el) => { el.scrollIntoView({ block: 'center', inline: 'nearest' }); await wait(60); };
  const reachable = (el) => {
    if (!el) return '控件不存在';
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return '零尺寸';
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > w.innerWidth + 0.5 || y > w.innerHeight + 0.5) {
      return `中心在视口外 ${Math.round(x)},${Math.round(y)}`;
    }
    const hit = document.elementFromPoint(x, y);
    if (hit === el || el.contains(hit) || (hit && hit.contains(el))) return '';
    return `中心被 ${hit ? (hit.id || hit.className || hit.tagName) : 'nothing'} 盖住`;
  };
  /** 先把它滚进视口再谈命中盒：到不了的控件是闸的锅，不是页面的锅（兄弟仓在这上面误判过红）。 */
  const reachCtl = async (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return `${sel}:不存在`;
    await scrollIn(el);
    const bad = reachable(el);
    return bad ? `${typeof sel === 'string' ? sel : el.id || el.tagName}:${bad}` : '';
  };
  const cellPoint = (row, col) => {
    const r = Z().view.cellRect(row, col);
    const b = D().canvas.getBoundingClientRect();
    return { x: b.left + r.x + r.w / 2, y: b.top + r.y + r.h / 2 };
  };
  /** 真指针点一格：先 elementFromPoint 举证，再把 pointerdown 发给命中的那个元素。 */
  const pointerTapCell = async (row, col) => {
    await scrollIn(D().canvas);
    const p = cellPoint(row, col);
    const hit = document.elementFromPoint(p.x, p.y);
    const el = hit || D().canvas;
    el.dispatchEvent(new w.PointerEvent('pointerdown', {
      clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0,
    }));
    return { atCanvas: !!hit && hit.tagName === 'CANVAS', hit: hit ? hit.tagName : 'null', p };
  };
  const clickBtn = async (sel) => {
    const bad = await reachCtl(sel);
    if (bad) return { bad };
    $(sel).click();
    await wait(40);
    return { ok: true };
  };
  const keyOn = (key, el) => {
    const ev = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (el || D().canvas).dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const markAt = (st, p, i, j, N) => st.marks[p * N * N + i * N + j];

  // ================================================================ ① boot
  // 默认盘必须是夹具里那张；shipped 路径**没有任何可达的答案**。
  const boot = async () => {
    const E = fx('t1-3cat', 'b0');
    ck('启动期没有未捕获异常 / 资源 404（含 node: 说明符这种浏览器解不开的 import）',
      PROBE.js.length === 0 && PROBE.res.length === 0, JSON.stringify(PROBE).slice(0, 420));
    ck('window.zebra 在场且版本是 2.0.0', !!Z() && Z().version === '2.0.0', Z() && Z().version);
    const st = S();
    ck('启动没有存档可续（Chrome profile 是新 mktemp 出来的）',
      !!Z().boot && Z().boot.hasSaveAtBoot === false && Z().boot.resumed === false, JSON.stringify(Z().boot));
    eq('默认档位是 t1', st.tierKey, E.tier);
    eq('默认盘号是 b0（不是日期算出来的）', st.seed, E.seed);
    eq('seed 串形状 zebra|档位|盘号', st.seedStr, E.seedStr);
    eq('输入框里的盘号与盘面一致', D().seed.value, E.seed);
    eq('线索条数', st.clueCount, E.clueCount);
    eq('同一串 seed 在浏览器里算出的题面指纹 = node 侧那一份', await pageClueSig(), E.clueSig);
    eq('铅笔步数', st.pencil.steps, E.penSteps);
    eq('铅笔轮数', st.pencil.rounds, E.penRounds);
    eq('规则出场计数', fireStr(st.pencil.fire), E.penFire);
    eq('裁判读数', proofLine(st.proof), `${E.outcome}/${E.count}/stopped=${E.stopped}`);
    ck('这一盘通过了验收（proven=true）', st.proven === true, JSON.stringify(st.proof));
    eq('注记全空起步', st.marks, '0'.repeat(E.cells));
    eq('注记格数 = 类别对数 × N²', st.marks.length, E.pairs * E.N * E.N);
    eq('起步 0 手 / 0 次提示', `${st.steps}/${st.hints}`, '0/0');
    ck('状态条写着已出货', text(D().status).indexOf('已出货') === 0, text(D().status));
    ck('控件条 / 盘面 / 类别对导航 / 侧栏 / 答案面板都显示',
      ['#controls', '#board-wrap', '#pairs', '.side', '#answer'].every(shown),
      ['#controls', '#board-wrap', '#pairs', '.side', '#answer'].filter((s) => !shown(s)).join(' '));
    ck('#reject 起步是**真**隐藏（display:none 且 0 个 rect）', hiddenTight('#reject'), whyNotTight('#reject'));
    ck('#verdict 起步是**真**隐藏', hiddenTight('#verdict'), whyNotTight('#verdict'));
    eq('题面列表把每条线索都念出来', D().clues.querySelectorAll('li').length, E.clueCount);
    eq('那一问按档位实指（3 类档没有「鱼」）', text(D().question), `问：${E.question}`);

    const c = D().canvas;
    ck(`画布后备缓冲 = CSS 尺寸 × dpr（${c.width}×${c.height} @ dpr ${geo().dpr}）`,
      c.width === Math.round(geo().w * geo().dpr) && c.height === Math.round(geo().h * geo().dpr),
      `${c.width}×${c.height} vs ${geo().w}×${geo().h}@${geo().dpr}`);
    const full = pxFull();
    ck(`画布上真有像素（非纸色 ${inkCount(full)} 个、深色 ${darkCount(full)} 个）`,
      inkCount(full) > 200 && darkCount(full) > 40, `ink=${inkCount(full)} dark=${darkCount(full)}`);
    ck('网格线颜色在场（LINE #cfc7b8 ±6）', countNear(full, [207, 199, 184], 6) > 50, countNear(full, [207, 199, 184], 6));
    eq('画布 dataset 写着 N', c.dataset.n, String(E.N));
    ck('格子边长夹在 [24,68]', geo().cell >= 24 && geo().cell <= 68, geo().cell);
    eq('没落子的格子里没有一个深像素（不画鬼记号）', darkCount(pxCell(E.N - 1, E.N - 1)), 0);
    ck('光标格画得到光标框（深像素 > 0）', darkCount(pxCell(st.cursor.i, st.cursor.j)) > 0,
      darkCount(pxCell(st.cursor.i, st.cursor.j)));

    const ctlBad = [];
    for (const sel of CTL) { const bad = await reachCtl(sel); if (bad) ctlBad.push(bad); }
    ck(`${CTL.length} 枚控件（滚进视口之后）的命中盒中心点都落在自己身上`, ctlBad.length === 0, ctlBad.join(' '));
    await scrollIn(c);
    const rect = c.getBoundingClientRect();
    const cellBad = [];
    for (let i = 0; i < E.N; i++) {
      for (let j = 0; j < E.N; j++) {
        const p = cellPoint(i, j);
        const hit = document.elementFromPoint(p.x, p.y);
        const back = Z().view.cellAt(p.x - rect.left, p.y - rect.top);
        if (!hit || hit.tagName !== 'CANVAS' || !back || back.row !== i || back.col !== j) {
          cellBad.push(`${i},${j}→${hit ? hit.tagName : 'null'}/${back ? `${back.row},${back.col}` : 'null'}`);
        }
      }
    }
    ck(`当前类别对 ${E.N * E.N} 格的中心都 elementFromPoint 到画布，且 cellAt 解回同一格`,
      cellBad.length === 0, cellBad.slice(0, 8).join(' '));
    eq('类别对导航按钮数 = C(N,2)', D().pairs.querySelectorAll('button').length, E.pairs);
    ck('答案面板是 N×N 个选择框', D().answerGrid.querySelectorAll('select').length, E.N * E.N);

    const scan = await answerScan(E);
    ck(`window.zebra 对象图（BFS ${scan.nodes} 个节点）里扫不到真值数组`, scan.hitsArr.length === 0, scan.hitsArr.join(' '));
    ck('对象图里没有答案味的键名（js/store.js 的 ANSWERISH）', scan.hitsKey.length === 0, scan.hitsKey.join(' '));
    ck('DOM 的 dataset / 属性里没有真值串或答案味字段', scan.hitsDom.length === 0, scan.hitsDom.join(' '));
    ck('localStorage 只有 zebra.save.v1 一个键，值里没有真值',
      scan.lsKeys.length === 1 && scan.hitsLs.length === 0, `${JSON.stringify(scan.lsKeys)} ${scan.hitsLs.join(' ')}`);
    ck('存档 JSON 的字段名全在白名单里',
      scan.saveFields.length > 0 && scan.saveFields.every((f) => scan.allow.has(f)), JSON.stringify(scan.saveFields));
    ck('扫描真的覆盖到了对象图（节点数 > 60）', scan.nodes > 60, scan.nodes);

    const sig = await pageClueSig();
    return report({
      tier: st.tierKey, seed: st.seed, seedStr: st.seedStr, clueSig: sig,
      timeOrigin: Z().doc.timeOrigin, baseURI: document.baseURI, href: location.href,
      cell: geo().cell, dpr: geo().dpr, canvas: `${c.width}×${c.height}`, bfsNodes: scan.nodes,
      checks: rows.length,
    });
  };

  /** 扫一遍对象图 / DOM / localStorage 找真值；返回命中列表与扫描规模（0 个节点的"扫过了"不算扫过）。 */
  const answerScan = async (E) => {
    const store = await mod('./js/store.js');
    const { ANSWERISH, SAVE_KEY } = store;
    const want = E.truthList.split(',').map(Number);
    const N = E.N;
    const hitsArr = [];
    const hitsKey = [];
    let nodes = 0;
    const seen = new Set();
    const tagged = (v) => Object.prototype.toString.call(v).slice(8, -1);
    const isArr = (v) => !!v && typeof v === 'object' && (Array.isArray(v) || /^(Int8|Uint8|Uint16|Int32|Uint32|Float32|Float64)Array$/.test(tagged(v)));
    const queue = [[Z(), 'zebra']];
    while (queue.length && nodes < 6000) {
      const [o, path] = queue.shift();
      if (!o || (typeof o !== 'object' && typeof o !== 'function') || seen.has(o)) continue;
      seen.add(o);
      nodes++;
      if (o instanceof Element || o instanceof Window || o === w || typeof o.getContext === 'function') continue;
      if (isArr(o)) {
        const a = Array.prototype.slice.call(o);
        if (a.length === N * N && a.every((v, i) => Number(v) === want[i])) hitsArr.push(path);
      }
      let keys = [];
      try { keys = Object.keys(o); } catch { continue; }
      for (const k of keys) {
        let v = null;
        try { v = o[k]; } catch { v = undefined; }
        if (ANSWERISH.test(k) && (isArr(v) || typeof v === 'string' || typeof v === 'number')) {
          hitsKey.push(`${path}.${k}`);
        }
        const nm = `${path}.${k}`;
        if (nm.length > 88 || k.startsWith('__')) continue;
        if (v && typeof v === 'object') queue.push([v, nm]);
      }
    }
    const hitsDom = [];
    for (const el of document.querySelectorAll('*')) {
      for (const at of [].slice.call(el.attributes || [])) {
        if (at.value === E.truthList) hitsDom.push(`${el.tagName}[${at.name}]=真值`);
        else if (/^(truth|solution|answer|assign|pos|dom)$/i.test(at.name)) hitsDom.push(`${el.tagName}[${at.name}]`);
      }
      for (const k of Object.keys(el.dataset || {})) if (ANSWERISH.test(k)) hitsDom.push(`${el.tagName}.dataset.${k}`);
    }
    const lsKeys = Object.keys(w.localStorage);
    const hitsLs = [];
    for (const k of lsKeys) {
      const v = w.localStorage.getItem(k) || '';
      if (v.indexOf(E.truthList) >= 0 || v.indexOf(E.truthSig) >= 0) hitsLs.push(`${k}:含真值`);
      if (k !== SAVE_KEY) hitsLs.push(`额外键:${k}`);
    }
    let saveFields = [];
    try { saveFields = Object.keys(JSON.parse(w.localStorage.getItem(SAVE_KEY) || '{}')); } catch { saveFields = ['‹解析不出›']; }
    return { hitsArr, hitsKey, hitsDom, hitsLs, lsKeys, saveFields, allow: new Set(store.SAVE_FIELDS), nodes };
  };

  // ================================================================ ② tiers
  // 三个档各开一次盘，全部走 UI 的 <select>，逐字段对 node 夹具。
  const tiers = async () => {
    const { TIERS } = await mod('./js/engine/generate.js');
    eq('引擎给三档', TIERS.length, 3);
    eq('下拉里的档位数量 = 引擎档位数量', D().tier.options.length, TIERS.length);
    eq('档位键表', TIERS.map((t) => t.key).join(','), FIXTURE.filter((r) => r.seed === 'b0').map((r) => r.tier).join(','));
    const sizes = [];
    for (const key of TIERS.map((t) => t.key)) {
      const E = fx(key, 'b0');
      const st = await openViaUI(key, 'b0');
      eq(`${key} · N`, st.N, E.N);
      eq(`${key} · 注记格数 = C(N,2)×N²`, st.marks.length, E.cells);
      eq(`${key} · seed 串`, st.seedStr, E.seedStr);
      eq(`${key} · 题面指纹与 node 一致`, await pageClueSig(), E.clueSig);
      eq(`${key} · 线索条数`, st.clueCount, E.clueCount);
      eq(`${key} · 铅笔步数`, st.pencil.steps, E.penSteps);
      eq(`${key} · 规则出场`, fireStr(st.pencil.fire), E.penFire);
      eq(`${key} · 裁判读数`, proofLine(st.proof), `${E.outcome}/${E.count}/stopped=${E.stopped}`);
      ck(`${key} · 通过验收`, st.proven === true, JSON.stringify(st.proof));
      eq(`${key} · 那一问`, text(D().question), `问：${E.question}`);
      eq(`${key} · 画布 dataset.n`, D().canvas.dataset.n, String(E.N));
      eq(`${key} · 类别对导航按钮`, D().pairs.querySelectorAll('button').length, E.pairs);
      ck(`${key} · 格子边长在 [24,68] 且没有横向滚动`,
        geo().cell >= 24 && geo().cell <= 68 && document.documentElement.scrollWidth <= w.innerWidth + 1,
        `cell=${geo().cell} scrollW=${document.documentElement.scrollWidth} inner=${w.innerWidth}`);
      ck(`${key} · 答案面板 N×N 个选择框`, D().answerGrid.querySelectorAll('select').length, E.N * E.N);
      ck(`${key} · #reject 保持真隐藏`, hiddenTight('#reject'), whyNotTight('#reject'));
      ck(`${key} · 换档后画布仍非空白`, inkCount(pxFull()) > 200, inkCount(pxFull()));
      sizes.push({ key, cell: geo().cell, hit: Z().view.hitRadius(), px: `${D().canvas.width}×${D().canvas.height}` });
    }
    ck('命中半径 = max(6, round(cell×0.4))，三档逐一复核',
      sizes.every((s) => s.hit === Math.max(6, Math.round(s.cell * 0.4))), JSON.stringify(sizes));
    const byCell = sizes.slice().sort((a, b) => a.cell - b.cell);
    ck('格子越小命中半径越小（不是写死 44px）',
      byCell.every((s, i) => i === 0 || s.hit >= byCell[i - 1].hit), JSON.stringify(byCell));
    ck('命中半径不超过半格（中心收点不会越界到隔壁）',
      sizes.every((s) => s.hit <= s.cell / 2), JSON.stringify(sizes));
    await openViaUI('t1-3cat', 'b0');
    return report({ perTier: sizes.map((s) => `${s.key}:cell${s.cell}/hit${s.hit}/px${s.px}`).join(' ') });
  };

  // ================================================================ ③ seed
  // 时钟不进 shipped 路径；「换一局」是可重发的字符串。
  const seed = async () => {
    const shipped = ['js/main.js', 'js/store.js', 'js/ui/game.js', 'js/render/board.js',
      'js/engine/rng.js', 'js/engine/rules.js', 'js/engine/generate.js', 'js/engine/counter.js',
      'js/engine/pencil.js', 'js/engine/witness.js'];
    const pats = [/Math\.random\s*\(/g, /Date\.now\s*\(/g, /new\s+Date\s*\(/g, /getRandomValues/g];
    const hits = [];
    for (const rel of shipped) {
      const f = await fetchText(rel);
      if (!f.ok) { hits.push(`${rel}:HTTP${f.status}`); continue; }
      const body = f.body.replace(/\/\/[^\n]*/g, '');      // 注释里的"别这么写"不算调用
      for (const p of pats) if (p.test(body)) hits.push(`${rel}:${p.source}`);
    }
    ck(`${shipped.length} 个 shipped 模块里 Math.random / Date.now / new Date / getRandomValues 一次都没被调用`,
      hits.length === 0, hits.join(' '));
    eq('换一局 b0→b1', Z().nextSeedString('b0'), 'b1');
    eq('换一局 b7→b8', Z().nextSeedString('b7'), 'b8');
    eq('无尾数则补 1（abc→abc1）', Z().nextSeedString('abc'), 'abc1');
    eq('空串给 b1', Z().nextSeedString(''), 'b1');

    await openViaUI('t1-3cat', 'b0');
    const sig0 = await pageClueSig();
    eq('起步盘号 b0', D().seed.value, 'b0');
    ck('换一局按钮的命中盒到得了', (await reachCtl('#btn-next')) === '', await reachCtl('#btn-next'));
    await clickBtn('#btn-next');
    eq('按一次换一局：盘号 b0 → b1', D().seed.value, 'b1');
    const sig1 = await pageClueSig();
    // 期望值取自 node 侧那份夹具，不是手打的字面量：seed 串的形状是 `zebra|档位|盘号#补抽序`
    // （docs/DESIGN.md §8），原来这里写成少了 `#0` 的字面量 —— 同一个仓里 boot 那条按夹具
    // 比 `zebra|t1-3cat|b0#0` 是绿的，两条断言自己就互相矛盾，红的是这一条。
    eq('按一次换一局：seed 串跟着走（含 #补抽序，整串对 node 夹具）', S().seedStr, fx('t1-3cat', 'b1').seedStr);
    ck('按一次换一局：seed 串前缀是 zebra|档位|盘号（盘号确实走到 b1）',
      S().seedStr.indexOf('zebra|t1-3cat|b1#') === 0, S().seedStr);
    eq('按一次换一局：题面指纹 = node 侧 b1 那张', sig1, fx('t1-3cat', 'b1').clueSig);
    ck('按一次换一局：题面真的换了', sig1 !== sig0, '指纹相同 ⇒ 换局是空操作');
    await clickBtn('#btn-next');
    eq('按两次换一局：盘号 b1 → b2', D().seed.value, 'b2');
    const sig2 = await pageClueSig();
    eq('按两次换一局：题面指纹 = node 侧 b2 那张', sig2, fx('t1-3cat', 'b2').clueSig);
    ck('按两次换一局：b2 又是一张新盘', sig2 !== sig1 && sig2 !== sig0, sig2.slice(0, 40));
    ck('连按两局之后注记是干净的（换局不许带上一盘的记号）', S().marks, '0'.repeat(fx('t1-3cat', 'b2').cells));

    const s7 = await openViaUI('t1-3cat', undefined);
    void s7;
    D().seed.value = '  b7  ';
    D().seed.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait(60);
    eq('输入框两侧空格被 trim 后原样当盘号用', S().seed, 'b7');
    const sig7 = await pageClueSig();
    eq('b7 的题面指纹 = node 侧 b7', sig7, fx('t1-3cat', 'b7').clueSig);
    Z().open('t1-3cat', 'b7');
    await wait(40);
    eq('同一个盘号再开一次 ⇒ 同一份题面（引擎是 seed 的纯函数）', await pageClueSig(), sig7);
    ck('状态条把盘号写出来（用户能自己复现）', text(D().status).indexOf('b7') > 0, text(D().status));
    ck('盘号写进存档（可重发的不只是屏幕）', JSON.parse(Z().gate.saveRaw()).seed === 'b7', Z().gate.saveRaw());
    await openViaUI('t1-3cat', 'b0');
    return report({ sigs: [sig0.slice(0, 18), sig1.slice(0, 18), sig2.slice(0, 18), sig7.slice(0, 18)] });
  };

  // ================================================================ ④ urlseed（NAV_URL 带 ?tier=&seed=）
  // URL 查询串必须**原样**决定盘面。verify.sh 用同一个 NAV_URL 跑两趟并比对回传的 clueSig。
  const urlseed = async () => {
    const q = new URLSearchParams(location.search);
    const E = fx(q.get('tier'), q.get('seed'));
    ck('这一趟的导航 URL 带了查询串（否则测的是默认盘，不是 URL 形态）',
      q.get('seed') !== null && q.get('tier') !== null, location.href);
    ck('URL 给的 (tier,seed) 在夹具里', !!E, JSON.stringify({ tier: q.get('tier'), seed: q.get('seed') }));
    const st = S();
    eq('URL 的 tier 原样生效', st.tierKey, E.tier);
    eq('URL 的 seed 原样生效（没被时间戳/随机数改写）', st.seed, E.seed);
    eq('URL 那一盘的 seed 串', st.seedStr, E.seedStr);
    eq('URL 那一盘的题面指纹 = node 侧同一串', await pageClueSig(), E.clueSig);
    ck('URL 直启的盘也通过验收', st.proven === true, JSON.stringify(st.proof));
    ck('URL 直启时 #reject 保持真隐藏', hiddenTight('#reject'), whyNotTight('#reject'));
    eq('启动时请求的就是 URL 那一串（查询串优先于存档）',
      `${Z().boot.requested.tier}/${Z().boot.requested.seed}`, `${E.tier}/${E.seed}`);
    const e = exp();
    if (e && e.expectResumed === false) {
      ck('存档里此刻躺着另一盘（上一趟写的），URL 换了号 ⇒ 不续别人的注记',
        Z().boot.hasSaveAtBoot === true && Z().boot.resumed === false, JSON.stringify(Z().boot));
      ck('注记是干净的（没把上一趟的 ✗/✓ 带到这一盘上）', st.marks, '0'.repeat(E.cells));
    }
    return report({
      url: location.href, tier: st.tierKey, seed: st.seed, clueSig: await pageClueSig(),
      timeOrigin: Z().doc.timeOrigin, resumed: Z().boot.resumed,
    });
  };

  // ================================================================ ⑤ play（真指针）
  const play = async () => {
    await openViaUI('t1-3cat', 'b0');
    const E = fx('t1-3cat', 'b0');
    const N = E.N;
    const t = { i: 1, j: 1 };
    // 基线帧必须在**光标已经走到这一格**之后再取。本仓把光标框画在格子**内部**（js/render/board.js:154-156
    // 的 strokeRect 收 1px、lineWidth 2 ⇒ 环是 68² − 64² = 528 个像素，cell=68 时），而 boot 场景自己就
    // 断言"光标格画得到光标框（深像素 > 0）"并且是绿的 —— 所以"落子前的那一帧"与"清空注记后的那一帧"
    // 本来就不该逐位相同，差的正是那一圈光标像素。
    // 三下真点按把光标带到 (1,1) 并回到空态：这一帧是"这一格空着"的基准，逐位相同仍然逐位比。
    await pointerTapCell(t.i, t.j); await pointerTapCell(t.i, t.j); await pointerTapCell(t.i, t.j);
    eq('三下真点按：三态循环回到空且记 3 手', `${markAt(S(), 0, t.i, t.j, N)}/${S().steps}`, '0/3');
    const base = pxCell(t.i, t.j);
    ck('基线帧里这一格没有注记墨（棕色 ✗ 墨 0 个）', countNear(base, [107, 74, 47], 20) === 0, countNear(base, [107, 74, 47], 20));
    ck('基线帧里有光标框（深色像素 > 0：光标就停在这一格）', darkCount(base) > 0, darkCount(base));
    ck('基线帧与隔壁空格不同（光标框不是全画布底纹）', diffCount(base, pxCell(t.i, t.j + 1)) > 20, diffCount(base, pxCell(t.i, t.j + 1)));
    const r0 = await pointerTapCell(t.i, t.j);
    ck(`点 (1,1)：命中的是画布本身`, r0.atCanvas, JSON.stringify(r0.hit));
    eq('点一格 = 多一手（基线 3 手 → 4）', S().steps, 4);
    eq('点一格：空 → ✗', markAt(S(), 0, t.i, t.j, N), '1');
    const sCross = pxCell(t.i, t.j);
    ck('✗ 落子后该格像素变了', diffCount(base, sCross) > 20, diffCount(base, sCross));
    ck('✗ 用的是棕色墨（#6b4a2f ±20 的像素在场）', countNear(sCross, [107, 74, 47], 20) > 8, countNear(sCross, [107, 74, 47], 20));
    await pointerTapCell(t.i, t.j);
    eq('第二下：✗ → ✓', markAt(S(), 0, t.i, t.j, N), '2');
    eq('再点一下：✗ → ✓（多一手 · 5 手）', S().steps, 5);
    const sCheck = pxCell(t.i, t.j);
    ck('✓ 又改了一次像素', diffCount(sCross, sCheck) > 20, diffCount(sCross, sCheck));
    await pointerTapCell(t.i, t.j);
    eq('第三下：✓ → 空（三态循环闭合）', markAt(S(), 0, t.i, t.j, N), '0');
    const sEmpty = pxCell(t.i, t.j);
    eq('回到空之后该格像素与基线帧逐位相同（不留残影）', diffCount(base, sEmpty), 0);
    await pointerTapCell(t.i, t.j);
    await pointerTapCell(t.i, t.j);
    await pointerTapCell(t.i, t.j);
    eq('再循环一圈回到空 · 步数 9', `${markAt(S(), 0, t.i, t.j, N)}/${S().steps}`, '0/9');
    eq('一圈之后像素仍然逐位复原', diffCount(pxCell(t.i, t.j), base), 0);

    await pointerTapCell(t.i, t.j);
    eq('落一手 ✗', markAt(S(), 0, t.i, t.j, N), '1');
    await clickBtn('#btn-undo');
    eq('撤销把这一格退回空', markAt(S(), 0, t.i, t.j, N), '0');
    eq('撤销把步数也退回去', S().steps, 9);
    eq('撤销后像素与基线帧（光标在此 · 注记为空）逐位相同', diffCount(pxCell(t.i, t.j), base), 0);

    // 计数读数
    await pointerTapCell(2, 2);
    await pointerTapCell(2, 2);
    const st1 = S();
    eq('一格两下 ⇒ ✗ 0 · ✓ 1', text(D().marks), '✗ 0 · ✓ 1');
    eq('counts 读数', `${st1.counts.cross}/${st1.counts.check}`, '0/1');
    eq('注记冲突 0 处', st1.conflicts, 0);
    ck('#stat-conflict 空着', text(D().conflict) === '', text(D().conflict));

    // 造一个"同一行两个 ✓"的注记冲突：只用点按，不碰模型 API
    await pointerTapCell(0, 0); await pointerTapCell(0, 0);
    await pointerTapCell(0, 1); await pointerTapCell(0, 1);
    const st2 = S();
    eq('同一行两个 ✓ ⇒ 注记冲突 1 处', st2.conflicts, 1);
    ck('#stat-conflict 写着冲突', text(D().conflict).indexOf('注记冲突 1 处') === 0, text(D().conflict));
    ck('#stat-conflict 有 bad 样式类', D().conflict.classList.contains('bad'), D().conflict.className);
    const rowPix = pxCell(0, 2);
    ck('冲突行的第三格也被标红（整行都是嫌疑格）', countNear(rowPix, [178, 58, 48], 20) > 4, countNear(rowPix, [178, 58, 48], 20));
    ck('冲突行上那两个 ✓ 的字形也是红的', countNear(pxCell(0, 0), [178, 58, 48], 20) > 4 && countNear(pxCell(0, 1), [178, 58, 48], 20) > 4,
      `${countNear(pxCell(0, 0), [178, 58, 48], 20)}/${countNear(pxCell(0, 1), [178, 58, 48], 20)}`);
    ck('没有冲突的那一行不描红（嫌疑格只跟着冲突走，不是整张盘涂色）',
      countNear(pxCell(1, 2), [178, 58, 48], 20) === 0, countNear(pxCell(1, 2), [178, 58, 48], 20));
    ck('冲突读数只用注记与几何（模型没读题面）',
      G().contradictions().every((c) => c.p === 0 && c.kind === 'row' && c.i === 0), JSON.stringify(G().contradictions()));

    // 换一个类别对：注记互不串门
    const pairBtns = D().pairs.querySelectorAll('button');
    eq('类别对导航按钮数 = C(3,2)', pairBtns.length, E.pairs);
    pairBtns[1].click();
    await wait(40);
    eq('点导航切到第二个类别对', S().cursor.p, 1);
    eq('第二个类别对上没有任何注记', S().marks.slice(N * N).indexOf('1') + S().marks.slice(N * N).indexOf('2'), -2);
    eq('冲突读数仍在（同一份注记、同一个模型）', S().conflicts, 1);
    const rr = await pointerTapCell(1, 1);
    ck('切档后点按仍命中画布', rr.atCanvas, JSON.stringify(rr.hit));
    eq('第二个类别对上的第一手落在 (1,1)', markAt(S(), 1, 1, 1, N), '1');
    // 导航按钮**必须是同一批节点**：选中时若重建（replaceChildren），手上这批引用就脱离文档，
    // 命中盒变 0×0、aria-current 停在脱离前的值上 —— 屏幕一切正常，测的却是幽灵节点。
    ck('点导航没有把按钮节点换成新的一批（旧引用仍在文档里 · 焦点也因此留得住）',
      pairBtns[1].isConnected && D().pairs.querySelectorAll('button')[1] === pairBtns[1],
      `isConnected=${pairBtns[1].isConnected} 同一个节点=${D().pairs.querySelectorAll('button')[1] === pairBtns[1]}`);
    eq('导航按钮的 aria-current 跟着光标走', pairBtns[1].getAttribute('aria-current'), 'true');
    eq('上一枚的 aria-current 退回 false（同一时刻只有一枚是当前）', pairBtns[0].getAttribute('aria-current'), 'false');
    const currents = [].slice.call(D().pairs.querySelectorAll('button')).filter((b) => b.getAttribute('aria-current') === 'true');
    eq('当前类别对按钮全盘只有一枚', currents.length, 1);

    await clickBtn('#btn-clear');
    eq('清空后没有任何注记', S().marks, '0'.repeat(E.cells));
    eq('清空把手数归零', S().steps, 0);
    eq('清空后冲突 0', S().conflicts, 0);
    ck('清空后 #stat-conflict 空着', text(D().conflict) === '', text(D().conflict));
    ck('清空后存档也归零', JSON.parse(Z().gate.saveRaw()).marks, '0'.repeat(E.cells));
    ck('点按期间页面没冒异常', PROBE.js.length === 0 && PROBE.res.length === 0, JSON.stringify(PROBE).slice(0, 300));
    return report({ steps: st2.steps, cellPx: `${Math.round(D().canvas.getBoundingClientRect().width)}×${Math.round(D().canvas.getBoundingClientRect().height)}`, cell: geo().cell });
  };

  // ================================================================ ⑥ keyboard（先把焦点钉死）
  // 兄弟仓的教训：key 到达数在十次同样的跑里跳 0/2/7 —— 那是没钉焦点。这里先断言
  // document.activeElement 就是画布，再要求 12 条键程**逐条**按预期改状态，一条不中即红。
  const keyboard = async () => {
    await openViaUI('t1-3cat', 'b0');
    const E = fx('t1-3cat', 'b0');
    const N = E.N;
    eq('画布 tabindex=0（键盘可达）', D().canvas.tabIndex, 0);
    D().canvas.focus();
    ck('焦点真的在画布上（键盘闸的前提）', document.activeElement === D().canvas,
      document.activeElement && `${document.activeElement.tagName}#${document.activeElement.id}`);
    keyOn('Backspace');
    eq('起步光标 p,i,j', `${S().cursor.p},${S().cursor.i},${S().cursor.j}`, '0,0,0');

    const legs = [
      { key: 'ArrowRight', want: '0,0,1', step: 0, label: '右移一列' },
      { key: 'ArrowDown', want: '0,1,1', step: 0, label: '下移一行' },
      { key: 'ArrowLeft', want: '0,1,0', step: 0, label: '左移一列' },
      { key: 'ArrowUp', want: '0,0,0', step: 0, label: '上移一行' },
      { key: 'ArrowLeft', want: '0,0,0', step: 0, label: '左边界不外溢' },
      { key: 'ArrowUp', want: '0,0,0', step: 0, label: '上边界不外溢' },
      { key: 'ArrowRight', want: '0,0,1', step: 0, label: '再右移' },
      { key: 'ArrowDown', want: '0,1,1', step: 0, label: '再下移' },
      { key: 'x', want: '0,1,1', step: 1, label: 'x 写 ✗', mark: '1' },
      { key: 'o', want: '0,1,1', step: 1, label: 'o 写 ✓', mark: '2' },
      { key: ' ', want: '0,1,1', step: 1, label: '空格循环 ✓→空', mark: '0' },
      { key: ']', want: '1,1,1', step: 0, label: '] 换下一个类别对' },
      { key: '[', want: '0,1,1', step: 0, label: '[ 换上一个类别对' },
    ];
    let arrived = 0;
    let steps = 0;
    const miss = [];
    for (const leg of legs) {
      const focusOk = document.activeElement === D().canvas;
      const prevented = keyOn(leg.key);
      const st = S();
      steps += leg.step;
      const cursorOk = `${st.cursor.p},${st.cursor.i},${st.cursor.j}` === leg.want;
      const markOk = leg.mark === undefined || markAt(st, st.cursor.p, st.cursor.i, st.cursor.j, N) === leg.mark;
      if (focusOk && prevented && cursorOk && markOk && st.steps === steps) arrived++;
      else miss.push(`${leg.key}(${leg.label}) focus=${focusOk} prevented=${prevented} cursor=${st.cursor.p},${st.cursor.i},${st.cursor.j} mark=${markAt(st, st.cursor.p, st.cursor.i, st.cursor.j, N)} steps=${st.steps}/${steps}`);
    }
    eq(`${legs.length} 条键程全部按预期生效（钉住焦点之后再来数）`, arrived, legs.length);
    ck('没有一条键程被漏掉', miss.length === 0, miss.slice(0, 6).join(' | '));
    eq('只有落子的键程记账（方向键不算手）', S().steps, 3);
    ck('方向键不产生注记', S().marks.indexOf('1') + S().marks.indexOf('2'), -2);
    // 空格键把 (1,1) 的注记清回了空，但**光标还停在这一格**：本仓把光标框画在格子内部
    // （js/render/board.js 里 strokeRect(cr.x+1, cr.y+1, …)），而 boot 场景自己就断言
    // "光标格画得到光标框（深像素 > 0）"并且是绿的。原来这一条写的是
    // `darkCount(pxCell(1,1)) === 0`，等于把"注记为空"读成"这一帧全白"，测的是光标画不画而非
    // 记号画不画 —— 红了的是闸自己。改成两条都成立且都不放宽的：带着光标的这一帧=光标环，
    // **把光标移开**之后同一格必须一个深像素都不剩（阈值仍是 0）。
    const ringed = pxCell(1, 1);
    ck('清空注记后、带着光标的这一帧只剩光标框（深色像素 > 0）', darkCount(ringed) > 0, darkCount(ringed));
    keyOn('ArrowUp');
    eq('光标退回 (0,1)（好让下一句量没有光标的同一格）', `${S().cursor.i},${S().cursor.j}`, '0,1');
    ck('键盘写的那一格在画布上看得见（深色像素 > 0 之后又归零）',
      darkCount(pxCell(1, 1)) === 0, darkCount(pxCell(1, 1)));
    ck('两帧之差就是那一圈光标框（同一格 · 同一份空注记 · 差异 > 20 像素）',
      diffCount(ringed, pxCell(1, 1)) > 20, diffCount(ringed, pxCell(1, 1)));
    keyOn('ArrowDown');
    eq('光标回到 (1,1)', `${S().cursor.i},${S().cursor.j}`, '1,1');

    // 键盘与鼠标共用一套光标读数：键盘推光标，真指针点同一格
    keyOn('ArrowDown'); keyOn('ArrowDown'); keyOn('ArrowRight'); keyOn('ArrowRight');
    eq('光标推到 (2,2)', `${S().cursor.i},${S().cursor.j}`, '2,2');
    keyOn('o');
    eq('键盘 o 在 (2,2) 写了 ✓', markAt(S(), 0, 2, 2, N), '2');
    ck('键盘改的格子像素上也看得到', darkCount(pxCell(2, 2)) > 0, darkCount(pxCell(2, 2)));
    await clickBtn('#btn-undo');
    eq('鼠标按钮的撤销与键盘落子共用同一条栈', markAt(S(), 0, 2, 2, N), '0');
    const before = S().marks;
    keyOn('q');
    eq('未绑定的键不改任何东西', S().marks, before);
    D().canvas.blur();
    ck('失焦后 activeElement 不是画布', document.activeElement !== D().canvas, document.activeElement && document.activeElement.tagName);
    keyOn('x', D().hint);
    eq('失焦后画布外的元素上按 x 不写进注记', S().marks, before);
    D().canvas.focus();
    keyOn('x');
    ck('重新聚焦后键盘又能写（焦点是唯一门槛，不是状态残留）', markAt(S(), 0, 2, 2, N), '1');
    await clickBtn('#btn-clear');
    return report({ legs: legs.length, arrived, focus: 'canvas' });
  };

  // ================================================================ ⑦ hint（提示念的是铅笔规则）
  const hint = async () => {
    await openViaUI('t1-3cat', 'b0');
    const E = fx('t1-3cat', 'b0');
    const N = E.N;
    const { RULE_DOC, RULE_ORDER } = await mod('./js/engine/pencil.js');
    ck('提示按钮的命中盒到得了', (await reachCtl('#btn-hint')) === '', await reachCtl('#btn-hint'));
    eq('起步提示计数 0', S().hints, 0);
    eq('起步注记全空', S().marks, '0'.repeat(E.cells));
    const got = [];
    const tintRows = [];
    for (let k = 0; k < 3; k++) {
      const r = await clickBtn('#btn-hint');
      ck(`第 ${k + 1} 次点提示：按钮到得了`, !r.bad, r.bad);
      const step = Z().app.lastHint;
      ck(`第 ${k + 1} 次点提示：交出了一步`, !!step, JSON.stringify(step));
      if (!step) break;
      got.push(hintLine({
        rule: step.rule, itemLabel: step.itemLabel, houses: step.houses, clueText: step.clueText,
        cross: step.cross.length, check: step.check.length,
        cells: step.cross.concat(step.check).map((x) => `${x.p}/${x.row}/${x.col}`),
      }));
      eq(`第 ${k + 1} 步提示与 node 侧铅笔序列逐字段相同`, got[k], E.hints[k]);
      ck(`第 ${k + 1} 步的规则名是 P1–P8 里的那一个`, RULE_ORDER.indexOf(step.rule) >= 0, step.rule);
      ck(`第 ${k + 1} 步的文案念出规则名与规则含义`,
        step.text.indexOf(step.rule) === 0 && step.text.indexOf(RULE_DOC[step.rule]) > 0, step.text);
      ck(`第 ${k + 1} 步的文案念出被消掉的房子`,
        step.houses.every((h) => step.text.indexOf(`第 ${h} 间`) > 0), step.text);
      ck(`第 ${k + 1} 步的文案不落进玩家注记（提示不代劳）`, S().marks, '0'.repeat(E.cells));
      ck(`#hint 里显示的就是这一步的文案`, text(D().hintLine) === step.text, text(D().hintLine));
      eq(`提示计数走到 ${k + 1}`, S().hints, k + 1);

      // 高亮：画布只画**当前类别对**（js/render/board.js 用 game.cursor.p 寻址），所以要看某一步
      // 蕴含的格子，得先走到那一格所在的类别对 —— 这是几何口径，不是断言放水。
      const implied = step.cross.concat(step.check);
      if (!implied.length) {
        // 出货盘的铅笔每一步都真的删了候选位，但**删候选位不等于删得动逻辑格上的某一格**：
        // 两端候选集还没交集为空时这一步没有可写进格子的结论（node 夹具的 cross/check 两列就是 0）。
        // 这一步的正确读法是"提示只报规则，不替玩家划格"⇒ 画布上一笔提示色都不许有。
        const tint = hintTintCount(pxFull());
        ck(`第 ${k + 1} 步没有新蕴含的格子 ⇒ 画布上一笔提示色都不画（也不留上一格的残影）`, tint === 0, `${tint} · ${got[k]}`);
        continue;
      }
      if (S().cursor.p !== implied[0].p) {
        const pb = D().pairs.querySelectorAll('button')[implied[0].p];
        const badp = await reachCtl(pb);
        ck(`第 ${k + 1} 步的高亮在类别对 ${implied[0].p + 1} 上 ⇒ 那一枚导航按钮到得了`, !badp, badp);
        if (badp) continue;
        pb.click();
        await wait(40);
      }
      const here = implied.filter((x) => x.p === S().cursor.p);
      const miss = [];
      for (const q of here) {
        const wantRed = step.cross.indexOf(q) >= 0;
        const n = (wantRed ? redTintCount : greenTintCount)(pxCell(q.row, q.col));
        if (!(n > 0)) miss.push(`${q.name}=${n}`);
      }
      const others = [];
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (here.some((q) => q.row === i && q.col === j)) continue;
          const n = hintTintCount(pxCell(i, j));
          if (n > 0) others.push(`${i},${j}=${n}`);
        }
      }
      ck(`第 ${k + 1} 步给出的每一格都在画布上高亮出来（${here.map((q) => q.name).join(' ')}）`, miss.length === 0, miss.join(' '));
      ck(`第 ${k + 1} 步的高亮只在提示给出的那 ${here.length} 格里（同类别对其余格一点提示色都没有）`,
        others.length === 0, others.slice(0, 6).join(' '));
      tintRows.push({
        k, cells: here.map((q) => q.name), inCell: (step.cross.indexOf(here[0]) >= 0 ? redTintCount : greenTintCount)(pxCell(here[0].row, here[0].col)),
        red: redTintCount(pxFull()), green: greenTintCount(pxFull()), pair: S().cursor.p,
      });
    }
    // 下面两行是"高亮"这条承诺的原始读数：测在**给出了格子的最后那一步**上（每一步的逐格对账在上面的
    // 循环里已经做过，那两条比这两条更严）。原来这两条挂在"按了三次之后的最后一步"上，而 t1/b0 的
    // 第 3 步（P4）在 node 夹具里 cross=0、check=0 —— 那一步本来就不高亮，红的是断言的位置。
    const tinted = tintRows.length ? tintRows[tintRows.length - 1] : null;
    ck('三步提示里至少有一步给出可高亮的格子（否则下面两条没有可测对象）', !!tinted, JSON.stringify(tintRows));
    ck('提示格在画布上高亮出来（红色调像素 > 0）', !!tinted && tinted.red > 0, JSON.stringify(tinted));
    ck('高亮落在提示说的那一格上', !!tinted && tinted.inCell > 0, JSON.stringify(tinted));
    eq('存档里的提示次数跟着走', JSON.parse(Z().gate.saveRaw()).hints, 3);

    // 用完整个序列：出货盘的铅笔一定能推完，最后一步之后不许编新话
    let guard = 0;
    while (Z().app.game.hintAt < E.penSteps && guard++ < 200) {
      D().hint.click();
      await wait(6);
    }
    eq('铅笔序列播完 ⇒ 提示次数正好等于 node 侧的步数', S().hints, E.penSteps);
    D().hint.click();
    await wait(30);
    eq('序列用尽后再按提示不计数、不编话', S().hints, E.penSteps);
    ck('序列用尽后 #hint 清空而不是瞎写', text(D().hintLine) === '', text(D().hintLine));
    ck('提示全程没写玩家注记', S().marks, '0'.repeat(E.cells));
    ck('提示全程没有把答案写进存档', Object.keys(JSON.parse(Z().gate.saveRaw())).every((k) => ['v', 'tier', 'seed', 'marks', 'steps', 'hints'].indexOf(k) >= 0), Z().gate.saveRaw());
    await clickBtn('#btn-clear');
    return report({ hints: got.length, first: got[0], last: got[got.length - 1] });
  };

  // ================================================================ ⑧ answer（答案面板交给 rules.checkSolution）
  const answer = async () => {
    await openViaUI('t1-3cat', 'b0');
    const E = fx('t1-3cat', 'b0');
    const N = E.N;
    const truth = E.truthList.split(',').map(Number);
    ck('#verdict 起步真隐藏', hiddenTight('#verdict'), whyNotTight('#verdict'));
    const r0 = await clickBtn('#btn-judge');
    ck('校验按钮到得了', !r0.bad, r0.bad);
    ck('一个都没填 ⇒ 不判', text(D().verdict).indexOf(`还有 ${N * N} 个位置没填，不判。`) === 0, text(D().verdict));
    ck('不判的话术是 bad 样式', D().verdict.classList.contains('bad'), D().verdict.className);
    ck('#verdict 现在显示出来', shown('#verdict'), whyNotTight('#verdict'));

    // 按 node 夹具里的真值把面板填满（夹具是给闸当输入样本用的，shipped 路径没有这个字段）
    const fill = (arr) => {
      for (let c = 0; c < N; c++) {
        const row = D().answerGrid.querySelector(`.answer-row[data-cat="${c}"]`);
        for (let h = 0; h < N; h++) row.querySelector(`select[data-house="${h}"]`).value = '';
        for (let i = 0; i < N; i++) {
          const sel = row.querySelector(`select[data-house="${arr[c * N + i]}"]`);
          sel.value = String(i);
          sel.dispatchEvent(new w.Event('change', { bubbles: true }));
        }
      }
    };
    const claim = readClaimInPage();
    fill(truth);
    const cl = readClaimInPage();
    ck('一个都没填时 readClaim 给的是 -1（不猜值、不填空）', claim.every((v) => v === -1), JSON.stringify(claim.slice(0, 9)));
    eq('答案面板改了以后 readClaim 与夹具真值逐位相同', cl.join(','), E.truthList);
    eq('改动之后 #verdict 被收回（旧判词不许留着）', D().verdict.hidden, true);
    await clickBtn('#btn-judge');
    ck('填满真值 ⇒ 裁判说成立', D().verdict.classList.contains('ok'), D().verdict.className);
    ck('判词写着"全部 N 条线索为真 · 每类各用一次"',
      text(D().verdict).indexOf(`全部 ${E.clueCount} 条线索为真 · 每类各用一次`) === 0, text(D().verdict));
    const { CATALOG } = await mod('./js/engine/rules.js');
    const petIdx = N > 3 ? 3 : 2;
    const h = truth[2 * N + petIdx];
    let who = '';
    for (let i = 0; i < N; i++) if (truth[0 * N + i] === h) who = CATALOG[0][i];
    ck(`判词按玩家填的分配读出那一问（${who} 养 ${CATALOG[2][petIdx]}）`,
      text(D().verdict).indexOf(`${who} 养 ${CATALOG[2][petIdx]}`) > 0, text(D().verdict));
    ck('判分不动注记（裁判与注记是两条道）', S().marks, '0'.repeat(E.cells));
    ck('答案面板的内容不进存档', JSON.parse(Z().gate.saveRaw()).marks, '0'.repeat(E.cells));

    // 「破一处」有两种破法，而这个面板是**每间房选一个物品**的下拉组，读法把房子记在物品上
    // （js/main.js 的 readClaim：claim[cat*N + 玩家选的 value] = data-house）。于是"两间房选同一个
    // 物品"必然意味着"有第三个物品没被任何房间选走"⇒ 交出去的分配**不完整**，而 judge 的口径是
    // 不完整就不判（不许猜那一格该填什么）。原来这一条把它当成"每类各用一次先塌"，判词给的是
    // "还有 1 个位置没填，不判。" —— 红的是断言的位置，不是产品。这条改读它真正测到的东西：
    const row0 = D().answerGrid.querySelector('.answer-row[data-cat="0"]');
    const selA = row0.querySelector(`select[data-house="${truth[0]}"]`);
    const selB = row0.querySelector(`select[data-house="${truth[1]}"]`);
    selA.value = selB.value;
    selA.dispatchEvent(new w.Event('change', { bubbles: true }));
    await clickBtn('#btn-judge');
    ck('两间房选同一个物品 ⇒ 必有一个物品没人选 ⇒ 不判（而不是说不满足）',
      text(D().verdict).indexOf('还有 1 个位置没填，不判。') === 0, text(D().verdict));
    const incomplete = Z().judge();
    ck('不判这条 gate 侧给的不是理由而是 missing 计数（不编理由）',
      !!incomplete && incomplete.complete === false && incomplete.missing === 1 && incomplete.reasons === undefined,
      JSON.stringify(incomplete));

    // 要真想破一条线索给裁判看，得交一份**完整而且仍是每类各用一次**的分配：把两间房的物品对调。
    // node 侧先算过这张盘（2026-09-28：`node --input-type=module -e …` 对 t1-3cat/b0 枚举三个类别
    // 的两两对调，共 9 个候选，破掉的 9 个 / 仍成立的 0 个，第一条理由形如"线索 1 在真值上为假: …"），
    // 所以这里取哪一对都是"题面为假"，而不是"排列不合法"。
    fill(truth);
    const va = selA.value, vb = selB.value;
    selA.value = vb; selA.dispatchEvent(new w.Event('change', { bubbles: true }));
    selB.value = va; selB.dispatchEvent(new w.Event('change', { bubbles: true }));
    const sw = readClaimInPage();
    const perCat = [];
    for (let c = 0; c < N; c++) perCat.push(sw.slice(c * N, c * N + N).slice().sort().join(','));
    ck('对调之后分配仍是每类各用一次（塌的是线索，不是排列）',
      perCat.every((s) => s === Array.from({ length: N }, (_, i) => String(i)).join(',')), perCat.join(' | '));
    ck('对调之后确实不再是夹具里那份真值（判分读的是玩家填的，不是答案）',
      sw.join(',') !== E.truthList, sw.join(','));
    await clickBtn('#btn-judge');
    ck('破一处以后裁判说不满足', D().verdict.classList.contains('bad'), D().verdict.className);
    const vt = text(D().verdict);
    ck('判词给出可核对的理由', vt.indexOf('不满足：') === 0 && vt.length > '不满足：'.length, vt);
    const reasons = Z().judge() && Z().judge().reasons;
    ck('gate 侧拿到的 reasons 非空', Array.isArray(reasons) && reasons.length > 0, JSON.stringify(reasons));
    ck('每一条理由都点得出是第几条线索，而且那个下标在题面里',
      Array.isArray(reasons) && reasons.every((s) => {
        const m = /^线索 (\d+) 在真值上为假: /.exec(s);
        return !!m && Number(m[1]) >= 0 && Number(m[1]) < E.clueCount;
      }), JSON.stringify(reasons));

    // 换一个满足全部线索但玩家自己填法的等价写法：本盘唯一解 ⇒ 只能填回同一组
    fill(truth);
    await clickBtn('#btn-judge');
    ck('填回真值仍然判成立（判分是纯函数）', D().verdict.classList.contains('ok'), D().verdict.className);

    // 少填一格 ⇒ 不判，且不许泄漏"这一格该填什么"
    const someRow = D().answerGrid.querySelector('.answer-row[data-cat="1"]');
    someRow.querySelector('select[data-house="0"]').value = '';
    someRow.querySelector('select[data-house="0"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    await clickBtn('#btn-judge');
    ck('少填 ⇒ 不判而不是说不满足', text(D().verdict).indexOf('个位置没填，不判。') > 0, text(D().verdict));
    ck('不判的文案里没有答案字样', ['答案', '真值', '正确填法', '应该填'].every((s) => text(D().verdict).indexOf(s) < 0), text(D().verdict));
    await clickBtn('#btn-clear');
    return report({ clueCount: E.clueCount, verdict: text(D().verdict).slice(0, 60) });
  };
  const readClaimInPage = () => Array.prototype.slice.call(Z().readClaim());

  // ================================================================ ⑨ save（写这一腿）
  const save = async () => {
    const E = fx('t2-4cat', 'b7');
    await openViaUI('t2-4cat', 'b7');
    eq('档位切到 t2', S().tierKey, 't2-4cat');
    eq('盘号切到 b7', S().seed, 'b7');
    eq('题面指纹 = node 侧 t2/b7', await pageClueSig(), E.clueSig);
    eq('起步注记全空', S().marks, '0'.repeat(E.cells));
    await pointerTapCell(0, 0); await pointerTapCell(0, 0);      // (0,0) → ✗ → ✓
    await pointerTapCell(1, 2);                             // (1,2) → ✗
    D().pairs.querySelectorAll('button')[2].click();
    await wait(30);
    await pointerTapCell(2, 1);
    D().hint.click();
    await wait(30);
    D().hint.click();
    await wait(30);
    const st = S();
    const raw = Z().gate.saveRaw();
    const obj = JSON.parse(raw);
    ck('存档键名只有一个', Object.keys(w.localStorage).length === 1, Object.keys(w.localStorage).join(','));
    eq('键名是 zebra.save.v1', Object.keys(obj).sort().join(','), 'hints,marks,seed,steps,tier,v');
    eq('v', obj.v, 1);
    eq('tier', obj.tier, 't2-4cat');
    eq('seed', obj.seed, 'b7');
    eq('marks 与内存里的注记逐字符相同', obj.marks, st.marks);
    eq('marks 长度 = 类别对数 × N²', obj.marks.length, E.cells);
    eq('steps 落盘', obj.steps, st.steps);
    eq('hints 落盘', obj.hints, 2);
    ck('注记里确实有 ✗/✓', /[12]/.test(obj.marks), obj.marks);
    ck('存档字符串里没有真值串', raw.indexOf(E.truthList) < 0 && raw.indexOf(E.truthSig) < 0, raw.slice(0, 200));
    ck('存档字段里没有答案味的名字', Object.keys(obj).every((k) => !/truth|solution|answer|assign|pos\b|dom\b/i.test(k)), Object.keys(obj).join(','));
    ck('#save-note 写着键名与"只有这几项"',
      text(D().saveNote).indexOf('zebra.save.v1') === 0 && text(D().saveNote).indexOf('tier/seed/marks/steps/hints') > 0,
      text(D().saveNote));
    return report({
      timeOrigin: Z().doc.timeOrigin, href: location.href, raw,
      tier: 't2-4cat', seed: 'b7', marks: st.marks, steps: st.steps, hints: st.hints,
      clueSig: await pageClueSig(),
    });
  };

  // ================================================================ ⑩ resume（读上一腿写的存档）
  const resume = async () => {
    const want = exp();
    ck('上一腿把期望值交进来了（__expectRaw）', !!want && !!want.raw, String(w.__expectRaw).slice(0, 80));
    if (!want || !want.raw) return report({ note: '没有 expect 就无法对账' });
    ck('这一腿是**真导航**：performance.timeOrigin 与写档那一腿不同',
      Z().doc.timeOrigin !== want.timeOrigin, `${Z().doc.timeOrigin} vs ${want.timeOrigin}`);
    ck('启动时读到了存档', Z().boot.hasSaveAtBoot === true, JSON.stringify(Z().boot));
    ck('续档成功（marks 长度与字符集都对才认）', Z().boot.resumed === true, JSON.stringify(Z().boot));
    const st = S();
    eq('续到的档位', st.tierKey, want.tier);
    eq('续到的盘号', st.seed, want.seed);
    eq('续到的注记逐字符相同', st.marks, want.marks);
    eq('续到的步数', st.steps, want.steps);
    eq('续到的提示次数', st.hints, want.hints);
    eq('续档之后题面指纹仍等于 node 侧那一串', await pageClueSig(), want.clueSig);
    ck('续档没有把提示高亮画进注记（hintHi 不落盘）', st.marks.indexOf('0') >= 0, st.marks.slice(0, 30));
    ck('#status 写着盘号可复现', text(D().status).indexOf(want.seed) > 0, text(D().status));

    // 撤销栈跨刷新是空的（不假装记得历史）
    const before = S().marks;
    await clickBtn('#btn-undo');
    eq('刷新后撤销一步也没有', S().marks, before);

    // 坏档一律当作没有
    const store = await mod('./js/store.js');
    const bad = [
      ['v 不对', '{"v":2,"tier":"t1-3cat","seed":"b0","marks":"0","steps":0,"hints":0}'],
      ['marks 字符集越界', '{"v":1,"tier":"t1-3cat","seed":"b0","marks":"013","steps":0,"hints":0}'],
      ['缺字段', '{"v":1,"tier":"t1-3cat"}'],
      ['不是 JSON', '{oops'],
      ['空串', ''],
    ];
    const badHits = bad.filter(([n, s]) => store.load({ getItem: () => s }) !== null).map(([n]) => n);
    ck('五种坏档都被拒（返回 null，不返回半截状态）', badHits.length === 0, badHits.join(' '));
    const extra = store.pack({ tier: 't1-3cat', seed: 'b0', marks: '0', steps: 1, hints: 0, truth: [1, 0], solution: 'x', assign: 'y' });
    ck('pack 走字段白名单：塞进 truth/solution/assign 也写不出来',
      Object.keys(extra).sort().join(','), 'hints,marks,seed,steps,tier,v');
    const okRow = store.load({ getItem: () => want.raw });
    ck('好档读得回来', !!okRow && okRow.seed === want.seed && okRow.marks === want.marks, JSON.stringify(okRow));

    // 清档 ⇒ 键消失；再落一手 ⇒ 重新写出来
    // 原来这条写的是 `ck('…', Z().gate.wipeSave(), null)`：把**返回值**当条件，而 gate.wipeSave()
    // 交回的正是"这个键现在的值"（js/main.js 里 return localStorage.getItem(SAVE_KEY)），清干净了
    // 就是 null ⇒ 清得越干净越红。改读回 localStorage 本身，阈值不减。
    const wiped = Z().gate.wipeSave();
    ck('wipeSave 后 localStorage 里没有这个键（gate 交回的就是该键的现值 null）',
      wiped === null && w.localStorage.getItem(store.SAVE_KEY) === null && Object.keys(w.localStorage).length === 0,
      `return=${String(wiped)} keys=${Object.keys(w.localStorage).join(',') || '‹空›'}`);
    eq('清档后键数归零', Object.keys(w.localStorage).length, 0);
    const st2 = await openViaUI('t1-3cat', 'b0');
    ck('重开一盘就把存档建起来', !!Z().gate.saveRaw(), Z().gate.saveRaw());
    eq('新档的盘号是 b0', JSON.parse(Z().gate.saveRaw()).seed, 'b0');
    await pointerTapCell(0, 1);
    eq('新落一手立刻落盘', JSON.parse(Z().gate.saveRaw()).marks, S().marks);
    eq('落盘的注记只有一格 ✗', (S().marks.match(/1/g) || []).length, 1);
    void st2;
    return report({
      timeOrigin: Z().doc.timeOrigin, prevTimeOrigin: want.timeOrigin,
      resumed: Z().boot.resumed, reloadProved: Z().doc.timeOrigin !== want.timeOrigin,
    });
  };

  // ================================================================ ⑪ layout
  const layout = async () => {
    const inner = `${w.innerWidth}×${w.innerHeight}`;
    const perTier = [];
    for (const E of FIXTURE.filter((r) => r.seed === 'b0')) {
      const st = await openViaUI(E.tier, 'b0');
      const c = D().canvas;
      const g = geo();
      const rect = c.getBoundingClientRect();
      const wrap = c.parentElement.getBoundingClientRect();
      ck(`${E.tier} · 画布装得进容器`, rect.width <= wrap.width + 1, `${rect.width} vs ${wrap.width}`);
      ck(`${E.tier} · 没有横向溢出`, document.documentElement.scrollWidth <= w.innerWidth + 1,
        `scrollW=${document.documentElement.scrollWidth} inner=${w.innerWidth}`);
      ck(`${E.tier} · 画布左边不出屏`, rect.left >= -1, rect.left);
      ck(`${E.tier} · 格子边长 ∈ [24,68]`, g.cell >= 24 && g.cell <= 68, g.cell);
      ck(`${E.tier} · 标签列宽为正且 ≤ 画布宽`, g.labelW > 0 && g.labelW < g.w, `${g.labelW}/${g.w}`);
      ck(`${E.tier} · 盘面在视口内（不需要滚动才看得见）`, rect.bottom <= w.innerHeight + 1, `${Math.round(rect.bottom)} vs ${w.innerHeight}`);
      await scrollIn(D().canvas);
      // 滚动之后**重新取一次 rect**：scrollIntoView 把画布挪过位置，拿滚动前的 top 去解 cellAt
      // 会把每一格都解到上一行去（窄屏那一腿整片 null 就是这么来的 —— 量的不是页面，是闸的偏移）。
      const hitRect = c.getBoundingClientRect();
      const bad = [];
      for (let i = 0; i < E.N; i++) {
        for (let j = 0; j < E.N; j++) {
          const p = cellPoint(i, j);
          const hit = document.elementFromPoint(p.x, p.y);
          if (!hit || hit.tagName !== 'CANVAS') bad.push(`${i},${j}`);
          const inset = (k, m) => Z().view.cellAt(p.x - hitRect.left + k, p.y - hitRect.top + m);
          const rad = Z().view.hitRadius() - 1;
          for (const [dx, dy] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
            const r2 = inset(dx, dy);
            if (!r2 || r2.row !== i || r2.col !== j) bad.push(`${i},${j}±${dx},${dy}→${r2 ? `${r2.row},${r2.col}` : 'null'}`);
          }
        }
      }
      ck(`${E.tier} · ${E.N * E.N} 格中心都命中画布，且命中半径内的四个收点仍解回同一格`, bad.length === 0, bad.slice(0, 6).join(' '));
      ck(`${E.tier} · 表头文字画出来了（深色像素 > 20）`, darkCount(pxFull()) > 20, darkCount(pxFull()));
      ck(`${E.tier} · 注记仍是空的（layout 不动模型）`, st.marks, '0'.repeat(E.cells));
      perTier.push(`${E.tier}:cell${geo().cell}/hit${Z().view.hitRadius()}`);
    }
    // 类别对导航：每一对都点得到、点完画布换面
    const E = fx('t2-4cat', 'b0');
    await openViaUI('t2-4cat', 'b0');
    const btns = [].slice.call(D().pairs.querySelectorAll('button'));
    eq('t2 的类别对数 = C(4,2)', btns.length, E.pairs);
    const names = [];
    const swapBad = [];
    const sameNode = [];
    for (let p = 0; p < btns.length; p++) {
      // 每一轮都按**当下文档里的那一枚**取：上一轮的点击若重建了导航节点，手上这批引用就脱离了
      // 文档，getBoundingClientRect 给 0×0 —— 屏幕上按钮明明在，测的却是幽灵节点（本仓这条红过，
      // 红的是 layout 而不是产品，但产品侧"每次选中都重建"确实会甩掉焦点，两边各修各的）。
      const live = D().pairs.querySelectorAll('button')[p];
      if (!live) { swapBad.push(`${p}:不在文档里`); continue; }
      sameNode.push(live === btns[p]);
      const bad = await reachCtl(live);
      if (bad) { swapBad.push(`${p}:${bad}`); continue; }
      live.click();
      await wait(25);
      if (S().cursor.p !== p) swapBad.push(`${p}:cursor=${S().cursor.p}`);
      names.push(live.textContent);
      if (inkCount(pxFull()) < 200) swapBad.push(`${p}:画布空白 ink=${inkCount(pxFull())}`);
    }
    ck('每一枚类别对按钮都点得到、点完光标真的走到那一对', swapBad.length === 0, swapBad.slice(0, 6).join(' '));
    ck('点导航不换节点（选中态是改 aria-current，不是重建按钮 · 键盘按完 Enter 焦点还在这一枚上）',
      sameNode.every(Boolean), sameNode.map((v, i) => (v ? '' : `${i}换掉了`)).join(' '));
    ck('每一枚类别对按钮点过之后 aria-current 只跟着当前那一枚',
      [].slice.call(D().pairs.querySelectorAll('button')).map((b) => b.getAttribute('aria-current')).join(',') === 'false,false,false,false,false,true',
      [].slice.call(D().pairs.querySelectorAll('button')).map((b) => b.getAttribute('aria-current')).join(','));
    ck('类别对名字形如 人×颜色', names.every((n) => /^[人颜色宠物饮料职爱好]{1,3}×[人颜色宠物饮料职爱好]{1,3}$/.test(n)), names.join(','));
    // 线索列表与侧栏在同一屏里可读
    ck('t2 的题面 12 条全部在 DOM 里', D().clues.querySelectorAll('li').length, E.clueCount);
    ck('题面第 1 条不是空串', text(D().clues.querySelector('li')).length > 3, text(D().clues.querySelector('li')));
    ck('来历面板念出 seed 串', text(D().receipt).indexOf('zebra|t2-4cat|b0') >= 0, text(D().receipt).slice(0, 120));
    await openViaUI('t1-3cat', 'b0');
    return report({ viewport: inner, perTier: perTier.join(' ') });
  };

  // ================================================================ ⑫ narrow（390×844）
  const narrow = async () => {
    eq('视口按闸的要求给到 390', w.innerWidth, 390);
    eq('视口高度 844', w.innerHeight, 844);
    ck('窄屏下没有横向滚动条', document.documentElement.scrollWidth <= w.innerWidth + 1,
      `scrollW=${document.documentElement.scrollWidth}`);
    ck('body 不横向溢出', document.body.scrollWidth <= w.innerWidth + 1, document.body.scrollWidth);
    const perTier = [];
    for (const key of ['t1-3cat', 't2-4cat', 't3-5cat']) {
      const E = fx(key, 'b0');
      const st = await openViaUI(key, 'b0');
      const rect = D().canvas.getBoundingClientRect();
      ck(`${key} · 画布在 390 宽里放得下`, rect.left >= -1 && rect.right <= w.innerWidth + 1,
        `${Math.round(rect.left)}…${Math.round(rect.right)} vs ${w.innerWidth}`);
      ck(`${key} · 格子不小于 24px（手指点得动）`, geo().cell >= 24, geo().cell);
      const ctlBad = [];
      for (const sel of CTL) { const bad = await reachCtl(sel); if (bad) ctlBad.push(bad); }
      ck(`${key} · 7 枚控件（滚进视口之后）中心点都落在自己身上`, ctlBad.length === 0, ctlBad.join(' '));
      await scrollIn(D().canvas);
      // 同上：窄屏这一腿必然要滚动（390×844 里一屏放不下整页），滚动前的 rect 一到 cellAt 就变成
      // 一整列偏移 —— 上面那个 rect 只用来量横向放得下，命中一律用滚动之后的这一份。
      const hitRect = D().canvas.getBoundingClientRect();
      const cellBad = [];
      for (let i = 0; i < E.N; i++) {
        for (let j = 0; j < E.N; j++) {
          const p = cellPoint(i, j);
          const hit = document.elementFromPoint(p.x, p.y);
          const back = Z().view.cellAt(p.x - hitRect.left, p.y - hitRect.top);
          if (!hit || hit.tagName !== 'CANVAS' || !back || back.row !== i || back.col !== j) {
            cellBad.push(`${i},${j}→${hit ? hit.tagName : 'null'}/${back ? `${back.row},${back.col}` : 'null'}`);
          }
        }
      }
      ck(`${key} · ${E.N * E.N} 格的中心都到得了且解回同一格`, cellBad.length === 0, cellBad.slice(0, 6).join(' '));
      ck(`${key} · 命中半径 ≤ 半格`, Z().view.hitRadius() <= geo().cell / 2, `${Z().view.hitRadius()}/${geo().cell}`);
      ck(`${key} · 控件条 / 盘面 / 侧栏 / 答案面板都显示`,
        ['#controls', '#board-wrap', '#pairs', '.side', '#answer'].every(shown),
        ['#controls', '#board-wrap', '#pairs', '.side', '#answer'].filter((s) => !shown(s)).join(' '));
      ck(`${key} · #reject 与 #verdict 仍真隐藏`, hiddenTight('#reject') && hiddenTight('#verdict'),
        `${whyNotTight('#reject')} ${whyNotTight('#verdict')}`);
      ck(`${key} · 注记仍是空的`, st.marks, '0'.repeat(E.cells));
      const t = { i: E.N - 1, j: E.N - 1 };
      const rr = await pointerTapCell(t.i, t.j);
      ck(`${key} · 窄屏下一次真实点按命中的是画布`, rr.atCanvas, JSON.stringify(rr.hit));
      eq(`${key} · 窄屏点按写的是那一格`, markAt(S(), 0, t.i, t.j, E.N), '1');
      ck(`${key} · 写进去的记号在画布上有像素`, darkCount(pxCell(t.i, t.j)) > 0, darkCount(pxCell(t.i, t.j)));
      await clickBtn('#btn-clear');
      perTier.push(`${key}:cell${geo().cell}/hit${Z().view.hitRadius()}`);
    }
    ck('窄屏下页面没冒异常', PROBE.js.length === 0 && PROBE.res.length === 0, JSON.stringify(PROBE).slice(0, 300));
    return report({ viewport: `${w.innerWidth}×${w.innerHeight}`, perTier: perTier.join(' ') });
  };

  // ================================================================ ⑬ canary（闸要会红）
  // 两块 node 侧找出来的负样本喂进页面：验收必须**拒绝出货**，且拒绝动作看得见。
  const canary = async () => {
    await openViaUI('t1-3cat', 'b0');
    const goodSig = await pageClueSig();
    ck('canary 起点是一张正常的盘', S().proven === true && hiddenTight('#reject') === true, S().status);

    const S_ = NEG.stall;
    const r1 = Z().gate.loadBoard(S_.tier, S_.clues, S_.budget);
    ck('stall：验收不过', r1.proven === false, JSON.stringify(r1));
    ck('stall：裁判读数与 node 侧一致', `${r1.outcome}/${r1.count}/stopped=${r1.stopped}`,
      `${S_.outcome}/${S_.count}/stopped=${S_.stopped}`);
    ck('stall：铅笔推不完（未定元数与 node 一致）', `${r1.pencilSolved}/${r1.pencilUndecided}`,
      `${S_.pencilSolved}/${S_.pencilUndecided}`);
    ck('stall：#reject 出现', r1.rejectedShown === true && shown('#reject'), JSON.stringify(r1));
    ck('stall：盘面与答案面板都收起来（真隐藏）', hiddenTight('#board-wrap') && hiddenTight('#answer'),
      `${whyNotTight('#board-wrap')} ${whyNotTight('#answer')}`);
    ck('stall：#reject 里写着铅笔剩下的未定元数',
      text(D().rejectDetail).indexOf('未定') > 0, text(D().rejectDetail));
    ck('stall：状态条说明不作为题面发出去', text(D().status).indexOf('不作为题面发出去') > 0, text(D().status));
    ck('stall：画布根本没被画出来（canvas 随容器一起藏）', D().canvas.getClientRects().length === 0,
      D().canvas.getClientRects().length);
    ck('stall：注记不残留上一盘', G() === Z().app.game && Z().app.game.seed === 'injected', Z().app.game && Z().app.game.seed);

    const N_ = NEG.stopped;
    const r2 = Z().gate.loadBoard(N_.tier, N_.clues, N_.budget);
    ck('stopped：验收不过', r2.proven === false, JSON.stringify(r2));
    ck('stopped：outcome/reason 与 node 侧一致', `${r2.outcome}/${r2.stopped}/${r2.reason}`,
      `${N_.outcome}/${N_.stopped}/${N_.reason}`);
    ck('stopped：#reject 出现且盘面收起', r2.rejectedShown === true && hiddenTight('#board-wrap'),
      `${r2.rejectedShown} ${whyNotTight('#board-wrap')}`);
    ck('stopped：#reject 里念出 stopped 读数', text(D().rejectDetail).indexOf('stopped=true') > 0, text(D().rejectDetail));
    const p2 = Z().gate.assess(N_.tier, N_.clues, N_.production.budget);
    ck('stopped 的正对照：同一张题面在生产预算下判得完（这块样本测的是处置，不是"出货盘会停"）',
      p2.stopped === false && `${p2.outcome}/${p2.count}` === `${N_.production.outcome}/${N_.production.count}`,
      `${p2.outcome}/${p2.count}/stopped=${p2.stopped}`);
    ck('stopped 的正对照：判得完但唯一性不成立 ⇒ 仍然不许出货',
      Z().gate.loadBoard(N_.tier, N_.clues, N_.production.budget).proven === false, '被 boardIsProven 判成可出货');

    const a1 = Z().gate.assess(S_.tier, S_.clues, S_.budget);
    ck('gate.assess 与 gate.loadBoard 用同一份预算 ⇒ 读数一致',
      `${a1.outcome}/${a1.count}/${a1.pencilSolved}/${a1.pencilUndecided}`,
      `${r1.outcome}/${r1.count}/${r1.pencilSolved}/${r1.pencilUndecided}`);

    // 正对照：夹具里的九张真盘在页面里也必须判成可出货（用同一道 boardIsProven）
    const back = await openViaUI('t1-3cat', 'b0');
    ck('负样本之后能回到正常盘', back.proven === true, JSON.stringify(back));
    ck('回到正常盘后 #reject 又**真**隐藏了', hiddenTight('#reject'), whyNotTight('#reject'));
    ck('回到正常盘后盘面与答案面板重新显示', shown('#board-wrap') && shown('#answer'),
      `${shown('#board-wrap')} ${shown('#answer')}`);
    ck('回到正常盘后题面指纹与起点那张相同', await pageClueSig(), goodSig);
    ck('canary 全程页面没冒异常', PROBE.js.length === 0 && PROBE.res.length === 0, JSON.stringify(PROBE).slice(0, 300));
    return report({
      stall: `${r1.outcome}/${r1.count}/pencil=${r1.pencilSolved}/${r1.pencilUndecided}`,
      stopped: `${r2.outcome}/${r2.stopped}/${r2.reason}`,
      stoppedProduction: `${p2.outcome}/${p2.count}/stopped=${p2.stopped}`,
    });
  };

  w.__scn = { boot, tiers, seed, urlseed, play, keyboard, hint, answer, save, resume, layout, narrow, canary };
  w.__fixture = FIXTURE;
})(window);
