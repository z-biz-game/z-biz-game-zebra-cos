// 入口 · 谁养鱼（阶段二：真交互，也是 tools/verify.sh 的被测对象）
//
// 三条口径写在这里，不写在文案里：
//   1. **seed 永远不是日期算出来的**。取值优先级：URL 查询串（?seed=&tier=）→ localStorage 存档
//      → 默认 `b0`。「换一局」把 seed 串尾部的整数 +1（`b7`→`b8`；无尾数则补 1，`abc`→`abc1`），
//      所以每一次点击得到的都是**一个可打印、可原样重发的串**，不是"这一秒的第几张盘"。
//      本组织在 suguru / battleship 上修过两次 date-derived seed：那种"换一局"复现不出来，
//      而且 CI 隔天换一批盘，门禁读数与商品盘对不上。tools/scenarios.js 的 seed 那条断言
//      既扫 shipped 路径里的 Date/时钟痕迹，也要求同一 URL 开两次拿到同一份题面指纹。
//   2. **页面上没有答案字段**。makeBoard() 在函数内部就把生成器的 truth 丢掉，交回来的 board 只有
//      {tierKey,N,seedStr,clues,…}；判分把**玩家填的**分配交给 rules.checkSolution，提示把
//      pencil 的真实删除序列换算成逻辑格格子（只用候选集合的交并，不用答案）。
//      闸按 node 侧算出的真值指纹扫 window.zebra 与 DOM 与 localStorage，扫到就是红。
//   3. **渲染不做判定**：任何"这盘是不是货"的话都来自引擎读数（assessBoard / proveBoard）；
//      验收不过 ⇒ 摊开 #reject 面板并把盘面收起，UI 不许把未证明唯一的盘当题发出去。

import { CAT_SHORT, CATALOG, describeClue } from './engine/rules.js';
import { TIERS } from './engine/generate.js';
import { CHECK, CROSS, EMPTY, Game, assessBoard, boardIsProven, makeBoard } from './ui/game.js';
import { COLORS, GridView } from './render/board.js';
import { SAVE_KEY, clear as clearSave, load, save } from './store.js';

const $ = (id) => document.getElementById(id);
const dom = {
  tier: $('tier'), seed: $('seed'), next: $('btn-next'), hint: $('btn-hint'),
  undo: $('btn-undo'), clear: $('btn-clear'), judge: $('btn-judge'),
  status: $('status'), steps: $('stat-steps'), marks: $('stat-marks'), conflict: $('stat-conflict'),
  pairs: $('pairs'), canvas: $('grid'), hintLine: $('hint'), clues: $('cluelist'),
  question: $('question'), receipt: $('receipt'), answer: $('answer'), answerGrid: $('answer-grid'),
  verdict: $('verdict'), reject: $('reject'), rejectDetail: $('reject-detail'),
  saveNote: $('save-note'), boardWrap: $('board-wrap'),
};

const app = { game: null, proof: null, view: new GridView(dom.canvas), proven: false, saveOk: true, rejected: null, lastHint: null };

const DEFAULT_TIER = TIERS[0].key;
const DEFAULT_SEED = 'b0';
const params = new URLSearchParams(location.search);

/** 盘号的下一步：尾部整数 +1。纯字符串运算 ⇒ 同一台机器、同一天、同一秒按两次也给两个不同的号。 */
function nextSeedString(cur) {
  const s = String(cur || '');
  const m = /^(.*?)(\d+)$/.exec(s);
  if (!m) return `${s || 'b'}1`;
  return `${m[1]}${Number(m[2]) + 1}`;
}

function requestedBoard(saved) {
  const tier = params.get('tier') || (saved && saved.tier) || DEFAULT_TIER;
  const seed = params.get('seed') || (saved && saved.seed) || DEFAULT_SEED;
  const okTier = TIERS.some((t) => t.key === tier) ? tier : DEFAULT_TIER;
  return { tier: okTier, seed: String(seed).slice(0, 24) || DEFAULT_SEED };
}

// ── 几何与重画 ───────────────────────────────────────────────────────────────
function boardSize() {
  const wrap = dom.canvas.parentElement;
  const availW = Math.max(220, Math.min(wrap.clientWidth || 360, 880));
  const availH = Math.max(200, Math.min(window.innerHeight * 0.44, 430));
  return { availW, availH };
}
function paint() {
  const g = app.game;
  if (!g) return;
  const { availW, availH } = boardSize();
  app.view.layout(g, availW, availH);
  app.view.draw(g, { conflictIdx: conflictSet() });
}
/** 冲突行的所有格子都算冲突格（画布用红字写它们）：只用注记与几何，不碰题面。 */
function conflictSet() {
  const g = app.game;
  const set = new Set();
  if (!g) return set;
  const N = g.N;
  for (const c of g.contradictions()) {
    if (c.kind === 'row') for (let j = 0; j < N; j++) set.add(g.idx(c.p, c.i, j));
    else for (let i = 0; i < N; i++) set.add(g.idx(c.p, i, c.j));
  }
  return set;
}

// ── 读数与文案 ───────────────────────────────────────────────────────────────
function renderReadouts() {
  const g = app.game;
  if (!g) return;
  const c = g.counts();
  dom.steps.textContent = `${g.steps} 手`;
  dom.marks.textContent = `✗ ${c.cross} · ✓ ${c.check}`;
  const bad = g.contradictions();
  dom.conflict.textContent = bad.length ? `注记冲突 ${bad.length} 处` : '';
  dom.conflict.classList.toggle('bad', bad.length > 0);
  dom.hintLine.textContent = app.lastHint ? app.lastHint.text : (g.pencil.steps ? '' : '本题面没有可播的铅笔序列（不该发生在出货盘上）');
  // 键名写在**最前面**：闸（tools/scenarios.js 的 save 场景）按"这一句以键名开头"读它，
  // 用户Ctrl-F 搜 zebra.save.v1 也在句首命中；把它放在第二个词里是一次没有理由的措辞赌局。
  dom.saveNote.textContent = app.saveOk
    ? `${SAVE_KEY} 存档 · 盘号 ${g.seed} · ${g.steps} 手 · ${g.hints} 次提示 · 键里只有 tier/seed/marks/steps/hints`
    : `${SAVE_KEY} 写不进去（无痕或配额满）：这一局只活在内存里`;
}
/**
 * 类别对导航：节点**只在类别对集合变化时**重建（换档），换对只改 aria-current。
 * 原来每次选中都 replaceChildren 一遍，代价是两件事：
 *   ① 键盘用户在那一枚按钮上按 Enter 之后焦点被甩回 body（下一句 [ ] 就得先 Tab 回来）；
 *   ② 闸拿的是同一批按钮节点（tools/scenarios.js 的 layout/play），重建后旧节点脱离文档 ⇒
 *      命中盒变成 0×0，控件明明在屏幕上却测不出形状。
 * 名字只由档位决定（CAT_SHORT 的固定次序），所以 sig 就是档位键的代理。
 */
function pairSig(g) { return g.pairs.map((pr) => `${pr[0]}-${pr[1]}`).join(','); }
function renderPairs() {
  const g = app.game;
  const sig = pairSig(g);
  if (dom.pairs.dataset.sig !== sig) {
    dom.pairs.replaceChildren(...g.pairs.map((pr, p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = g.pairName(p);
      b.dataset.p = String(p);
      b.addEventListener('click', () => selectPair(p));
      return b;
    }));
    dom.pairs.dataset.sig = sig;
  }
  const btns = dom.pairs.querySelectorAll('button');
  for (let p = 0; p < btns.length; p++) btns[p].setAttribute('aria-current', String(p === g.cursor.p));
}
function selectPair(p) {
  const g = app.game;
  g.cursor.p = Math.max(0, Math.min(g.nPairs - 1, p));
  g.cursor.i = Math.min(g.cursor.i, g.N - 1);
  g.cursor.j = Math.min(g.cursor.j, g.N - 1);
  renderPairs();
  paint();
  renderReadouts();
}
function renderClues() {
  const g = app.game;
  dom.clues.replaceChildren(...g.board.clues.map((c) => {
    const li = document.createElement('li');
    li.textContent = describeClue(c, g.N);
    return li;
  }));
  dom.question.textContent = `问：${g.question().text}`;
}
function renderReceipt() {
  const g = app.game;
  const p = app.proof || {};
  dom.receipt.textContent = [
    `seed 串        ${g.seedStr}`,
    `盘号（可重发）  ${g.seed} · 档位 ${g.tierKey}（${g.N} 类 × ${g.N} 户）`,
    `线索           ${g.board.clueCount} 条 · 抽取 ${g.board.draws} 次`,
    `唯一性          ${p.outcome}（count=${p.count} · stopped=${p.stopped} · ${p.nodes} 节点 / ${(p.ms ?? 0).toFixed(3)} ms）`,
    `铅笔            ${g.pencil.solved ? '空盘推完' : `剩 ${g.pencil.undecided} 未定`} · ${g.pencil.rounds} 轮 · ${g.pencil.steps} 步 · 规则 ${g.pencil.used}`,
    `规则出场        ${Object.entries(g.pencil.fire).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ') || '无'}`,
    `真值自洽        ${p.truthOk === undefined ? '未测（注入盘）' : (p.truthOk ? 'ok' : p.truthNote)}`,
    `验收            ${app.proven ? '通过 · 可以出货' : '未通过 ⇒ 不作为题面发出去'}`,
  ].join('\n');
}

// ── 答案面板 ─────────────────────────────────────────────────────────────────
function labelSpan(text) {
  const s = document.createElement('span');
  s.textContent = text;
  return s;
}
function buildAnswerGrid() {
  const N = app.game.N;
  const out = [];
  const head = document.createElement('div');
  head.className = 'answer-head';
  head.append(labelSpan('间'));
  for (let h = 0; h < N; h++) head.append(labelSpan(`第 ${h + 1} 间`));
  out.push(head);
  for (let c = 0; c < N; c++) {
    const row = document.createElement('div');
    row.className = 'answer-row';
    row.dataset.cat = String(c);
    row.append(labelSpan(CAT_SHORT[c]));
    for (let h = 0; h < N; h++) {
      const sel = document.createElement('select');
      sel.dataset.house = String(h);
      sel.setAttribute('aria-label', `第 ${h + 1} 间的${CAT_SHORT[c]}`);
      sel.append(new Option('—', ''));
      for (let i = 0; i < N; i++) sel.append(new Option(CATALOG[c][i], String(i)));
      row.append(sel);
    }
    out.push(row);
  }
  dom.answerGrid.replaceChildren(...out);
  dom.answerGrid.style.setProperty('--house-cols', String(N));
  for (const s of dom.answerGrid.querySelectorAll('select')) {
    s.addEventListener('change', () => { dom.verdict.hidden = true; });
  }
}
/** 读答案面板 → claim[cat*N+item] = 房子编号（没选的位置留 -1）。 */
function readClaim() {
  const N = app.game.N;
  const claim = new Int8Array(N * N).fill(-1);
  for (const row of dom.answerGrid.querySelectorAll('.answer-row')) {
    const c = Number(row.dataset.cat);
    for (const sel of row.querySelectorAll('select')) {
      if (sel.value === '') continue;
      claim[c * N + Number(sel.value)] = Number(sel.dataset.house);
    }
  }
  return claim;
}
function judgeAnswer() {
  const g = app.game;
  const out = g.judge(readClaim());
  dom.verdict.hidden = false;
  dom.verdict.classList.remove('ok', 'bad');
  if (!out.complete) {
    dom.verdict.textContent = `还有 ${out.missing} 个位置没填，不判。`;
    dom.verdict.classList.add('bad');
    return { complete: false, missing: out.missing, ok: false, text: dom.verdict.textContent };
  }
  if (!out.res.ok) {
    dom.verdict.textContent = `不满足：${out.res.reasons.slice(0, 3).join(' / ')}`;
    dom.verdict.classList.add('bad');
    return { complete: true, ok: false, reasons: out.res.reasons, text: dom.verdict.textContent };
  }
  const owner = g.petOwner(out.claim);
  g.solved = true;
  dom.verdict.textContent = `全部 ${g.board.clueCount} 条线索为真 · 每类各用一次 —— 按你填的：${owner ? `${owner.who} 养 ${owner.item}（第 ${owner.house} 间）` : '这一问读不出来，但分配本身成立'}`;
  dom.verdict.classList.add('ok');
  return { complete: true, ok: true, owner, text: dom.verdict.textContent };
}

function showReject(detail) {
  app.rejected = detail;
  app.proven = false;
  dom.reject.hidden = false;
  dom.rejectDetail.textContent = detail;
  dom.status.textContent = '本盘未通过验收 · 不作为题面发出去';
  dom.boardWrap.hidden = true;
  dom.answer.hidden = true;
}
function hideReject() {
  dom.reject.hidden = true;
  dom.boardWrap.hidden = false;
  dom.answer.hidden = false;
  app.rejected = null;
}

// ── 开一局 ───────────────────────────────────────────────────────────────────
function openBoard(tierKey, seed, restore) {
  const made = makeBoard(tierKey, seed);
  if (!made.ok) {
    // 生成器抽满 tries 仍无货是**引擎的事实**：把拒收账原样念出来，不画一张假盘。
    app.game = null;
    showReject(`盘号 ${seed} 在档位 ${tierKey} 抽满 ${made.draws} 次仍无货：${JSON.stringify(made.failures)}`);
    dom.seed.value = seed;
    dom.tier.value = tierKey;
    return { ok: false, made };
  }
  hideReject();
  const game = new Game(made.board);
  let resumed = false;
  if (restore && restore.tier === tierKey && restore.seed === game.seed) {
    resumed = game.decode(restore.marks);
    if (resumed) {
      game.steps = Math.max(0, Number(restore.steps) || 0);
      game.hints = Math.max(0, Number(restore.hints) || 0);
    }
  }
  app.game = game;
  app.proof = made.proof;
  app.proven = boardIsProven(made.board, made.proof);
  app.lastHint = null;
  dom.tier.value = tierKey;
  dom.seed.value = game.seed;
  dom.status.textContent = app.proven ? `已出货 · ${game.board.label} · 盘号 ${game.seed}` : '未通过验收';
  renderPairs();
  renderClues();
  buildAnswerGrid();
  renderReceipt();
  paint();
  renderReadouts();
  persist();
  if (!app.proven) {
    showReject([
      `裁判：outcome=${made.proof.outcome} count=${made.proof.count} stopped=${made.proof.stopped}`,
      `铅笔：${made.proof.pencilSolved ? '推完' : `剩 ${made.proof.pencilUndecided} 未定`}`,
      `真值自洽：${made.proof.truthOk}`,
      '这三条有一条不认，本盘就不是货 —— UI 不把未证明唯一的盘当题面发出去。',
    ].join('\n'));
  }
  return { ok: true, game, proof: made.proof, resumed };
}

function persist() {
  if (!app.game) return;
  const g = app.game;
  app.saveOk = save(localStorage, { tier: g.tierKey, seed: g.seed, marks: g.encode(), steps: g.steps, hints: g.hints });
  renderReadouts();
}

// ── 真指针与键盘 ─────────────────────────────────────────────────────────────
function onCanvasPointer(ev) {
  const g = app.game;
  if (!g) return;
  const r = dom.canvas.getBoundingClientRect();
  const cell = app.view.cellAt(ev.clientX - r.left, ev.clientY - r.top);
  if (!cell) return;
  ev.preventDefault();
  g.cursor.i = cell.row;
  g.cursor.j = cell.col;
  g.tap(g.cursor.p, cell.row, cell.col);
  app.lastHint = null;
  g.clearHint();
  paint();
  persist();
}
function onKey(ev) {
  const g = app.game;
  if (!g) return;
  const N = g.N;
  const c = g.cursor;
  const k = ev.key;
  const move = k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';
  let handled = true;
  if (k === 'ArrowLeft') c.j = Math.max(0, c.j - 1);
  else if (k === 'ArrowRight') c.j = Math.min(N - 1, c.j + 1);
  else if (k === 'ArrowUp') c.i = Math.max(0, c.i - 1);
  else if (k === 'ArrowDown') c.i = Math.min(N - 1, c.i + 1);
  else if (k === 'x' || k === 'X') g.press(c.p, c.i, c.j, CROSS);
  else if (k === 'o' || k === 'O') g.press(c.p, c.i, c.j, CHECK);
  else if (k === ' ') g.tap(c.p, c.i, c.j);
  else if (k === 'Backspace' || k === 'Delete') g.press(c.p, c.i, c.j, EMPTY);
  else if (k === '[') selectPair((c.p + g.nPairs - 1) % g.nPairs);
  else if (k === ']') selectPair((c.p + 1) % g.nPairs);
  else handled = false;
  if (!handled) return;
  ev.preventDefault();
  if (!move) {
    app.lastHint = null;
    g.clearHint();
    persist();
  }
  renderReadouts();
  paint();
}

dom.canvas.addEventListener('pointerdown', onCanvasPointer);
dom.canvas.addEventListener('keydown', onKey);
dom.tier.addEventListener('change', () => openBoard(dom.tier.value, dom.seed.value.trim() || DEFAULT_SEED));
dom.seed.addEventListener('change', () => openBoard(dom.tier.value, dom.seed.value.trim() || DEFAULT_SEED));
dom.next.addEventListener('click', () => openBoard(dom.tier.value, nextSeedString(dom.seed.value.trim())));
dom.hint.addEventListener('click', () => {
  const g = app.game;
  if (!g) return;
  app.lastHint = g.hint();
  paint();
  persist();
});
dom.undo.addEventListener('click', () => {
  const g = app.game;
  if (!g) return;
  g.undo();
  paint();
  persist();
});
dom.clear.addEventListener('click', () => {
  const g = app.game;
  if (!g) return;
  g.clearMarks();
  g.steps = 0;
  app.lastHint = null;
  paint();
  persist();
});
dom.judge.addEventListener('click', () => judgeAnswer());
window.addEventListener('resize', paint);

for (const t of TIERS) {
  const opt = document.createElement('option');
  opt.value = t.key;
  opt.textContent = t.label;
  dom.tier.appendChild(opt);
}

// ── 对外形状：闸读这个对象；里面不该有任何答案字段 ─────────────────────────────
window.zebra = {
  version: '2.0.0',
  app,
  game: null,
  view: app.view,
  dom,
  tiers: TIERS,
  COLORS,
  doc: { timeOrigin: String(performance.timeOrigin), href: location.href },
  nextSeedString,
  open(tierKey, seed, restore) {
    const r = openBoard(tierKey || DEFAULT_TIER, seed, restore);
    window.zebra.game = app.game;
    return r.ok ? summary(r.game) : { ok: false, failures: r.made.failures };
  },
  playSeed(seed, tierKey) { return window.zebra.open(tierKey, String(seed)); },
  state() {
    const g = app.game;
    if (!g) return null;
    return {
      ...summary(g),
      marks: g.encode(), counts: g.counts(), conflicts: g.contradictions().length,
      pencil: { solved: g.pencil.solved, rounds: g.pencil.rounds, steps: g.pencil.steps, used: g.pencil.used, fire: { ...g.pencil.fire } },
      proof: app.proof ? { outcome: app.proof.outcome, count: app.proof.count, stopped: app.proof.stopped, nodes: app.proof.nodes, truthOk: app.proof.truthOk } : null,
      saveKey: SAVE_KEY, saveOk: app.saveOk,
    };
  },
  hint() {
    const g = app.game;
    if (!g) return null;
    const step = g.hint();
    app.lastHint = step;
    paint();
    persist();
    if (!step) return null;
    return { k: step.k, rule: step.rule, doc: step.doc, text: step.text, clueText: step.clueText, itemLabel: step.itemLabel, houses: step.houses, cross: step.cross.length, check: step.check.length, cells: step.cross.concat(step.check).map((x) => `${x.p}/${x.row}/${x.col}`), total: step.total };
  },
  judge: judgeAnswer,
  readClaim,
  gate: {
    /**
     * 注入一张外部给的盘（闸的 canary 用它喂"推不完"与"stopped"的盘）：现算验收，不过就摊开。
     * budget 只给闸用：stopped 那块负样本靠**节点预算**掐断（node 与 Chrome 同一个读数），
     * 省略时走生产预算 tier.budgetMs ——  shipped 路径永远不传 budget。
     */
    loadBoard(tierKey, clues, budget) {
      const tier = TIERS.find((t) => t.key === tierKey);
      if (!tier) throw new Error(`未知档位 ${tierKey}`);
      const proof = assessBoard(tier.N, clues, assessOpts(tier, budget));
      const game = new Game({ N: tier.N, tierKey: tier.key, label: tier.label, seed: 'injected', seedStr: `injected|${tier.key}`, clues, clueCount: clues.length, draws: 0 });
      hideReject();
      app.game = game;
      app.proof = proof;
      app.proven = boardIsProven({ N: tier.N }, proof);
      window.zebra.game = game;
      dom.tier.value = tier.key;
      renderPairs();
      renderClues();
      buildAnswerGrid();
      renderReceipt();
      paint();
      renderReadouts();
      if (!app.proven) {
        showReject(`注入盘验收未过：outcome=${proof.outcome} count=${proof.count} stopped=${proof.stopped} · 铅笔 ${proof.pencilSolved ? '推完' : `剩 ${proof.pencilUndecided} 未定`}`);
      }
      return {
        proven: app.proven, outcome: proof.outcome, count: proof.count, stopped: proof.stopped,
        reason: proof.reason, nodes: proof.nodes, pencilSolved: proof.pencilSolved,
        pencilUndecided: proof.pencilUndecided, rejectedShown: !dom.reject.hidden,
        budget: assessOpts(tier, budget),
      };
    },
    assess(tierKey, clues, budget) {
      const tier = TIERS.find((t) => t.key === tierKey);
      return assessBoard(tier.N, clues, assessOpts(tier, budget));
    },
    wipeSave() { clearSave(localStorage); return localStorage.getItem(SAVE_KEY); },
    saveRaw() { return localStorage.getItem(SAVE_KEY); },
  },
};

/** 验收用的预算：默认 = 生产档位预算；闸传 budget 时用它钉着的那组数（负样本靠节点预算掐断）。 */
function assessOpts(tier, budget) {
  return {
    budgetMs: budget?.msBudget ?? tier.budgetMs,
    nodeBudget: budget?.nodeBudget ?? 250_000,
  };
}

function summary(g) {
  return { tierKey: g.tierKey, seed: g.seed, seedStr: g.seedStr, N: g.N, clueCount: g.board.clueCount, steps: g.steps, hints: g.hints, cursor: { ...g.cursor }, proven: app.proven, status: dom.status.textContent };
}

// 启动：URL → 存档 → 默认，一步都不涉及时钟。
const saved = load(localStorage);
const bootReq = requestedBoard(saved);
dom.tier.value = bootReq.tier;
dom.seed.value = bootReq.seed;
const boot = openBoard(bootReq.tier, bootReq.seed, saved);
window.zebra.game = app.game;
window.zebra.boot = { requested: bootReq, resumed: !!(boot.ok && boot.resumed), hasSaveAtBoot: !!saved };
