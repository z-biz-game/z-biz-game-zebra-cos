// fixtures · tools/scenarios.js 里那段 >>>FIXTURE 的**唯一生产者**
//
// 为什么单独一个文件，而不是把期望值写死在浏览器闸里：闸在 Chrome 里逐项对的那一串数
// （题面指纹、铅笔步数、提示前三步、答案面板的那组分配）必须由 **node 侧的同一批模块**算出来。
// node 与页面加载的是同一份 js/engine/*.js 与 js/ui/game.js（verify.sh 的预检按字节证明磁盘上的
// 那几份就是发出去的那几份），所以这里红了读作"页面与 node 不再是同一批盘"，不是"夹具过期了"。
//
//   node tools/fixtures.mjs            打印 FIXTURE 块（贴进 tools/scenarios.js）
//   node tools/fixtures.mjs --check    重算并与 scenarios.js 钉着的那一块逐行对账（漂移即红）
//
// 两块**负样本**是这道闸能说话的地方：
//   stall   —— 裁判证明唯一、但铅笔从空盘推不完的题面。出货路径不收它（generate 丢弃重抽），
//              所以浏览器里它必须走 #reject 那条路：canary 场景断言"拒绝动作真的发生了"。
//              找法用的是本仓自己有账的机制：把成品盘**已删的线索加回去**（DESIGN §9 量到
//              P5/P6 这类存在性规则会被撤销 ⇒ 台阶倒退），不是凭空编一张盘。
//   stopped —— 节点预算内数不完的题面 ⇒ outcome='stopped' ⇒ 唯一性未证明 ⇒ 同样不许当题面发出去。
//              掐的是 **nodeBudget**（跨引擎恒定），不是 msBudget；夹具同时钉住"这张题面在生产
//              预算下判得完"（production 字段）—— 它验的是页面对 stopped 读数的**处置**，不是
//              "出货盘会 stopped"（本仓生产路径实测 0 次击穿，见下）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { clueSignature, truthSignature } from '../js/engine/rules.js';
import { TIERS, generateOn, proveBoard } from '../js/engine/generate.js';
import { countSolutions } from '../js/engine/counter.js';
import { FULL_RULES, solve } from '../js/engine/pencil.js';
import { Game, assessBoard, boardIsProven } from '../js/ui/game.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// b0/b1/b7 是默认盘、换一局的第一格、以及"跳号盘"；b2 是「换一局」连按两下的落点 ——
// tools/scenarios.js 的 seed 那一段要拿 node 侧的指纹逐格对，所以这四个号都必须在这张表里。
const SEEDS = ['b0', 'b1', 'b2', 'b7'];

function referee(N, clues, budget) {
  return countSolutions(N, clues, {
    limitSolutions: 2, msBudget: budget.budgetMs, nodeBudget: budget.nodeBudget,
  });
}

// stall 那块负样本用的预算：宽到 node 与 Chrome 都必定判得完（本仓实测证一张唯一盘只要 1 个节点），
// 于是 outcome 是**跨引擎恒定**的读数；掐 stopped 那块靠的是 nodeBudget，见 findStopped。
const STALL_BUDGET = Object.freeze({ nodeBudget: 250_000, budgetMs: 5000 });

/** 一行夹具 = 一个 (档位, 盘号) 的全部期望读数，全部来自 node 侧的 shipped 模块。 */
function row(tier, seed) {
  const g = generateOn(tier, seed);
  if (!g.ok) throw new Error(`${tier.key} ${seed} 未出货：${JSON.stringify(g.failures)} —— 夹具不能钉一张没出货的盘`);
  const proof = proveBoard(tier, g.clues, g.truth, { draws: g.draws });
  const board = {
    tierKey: tier.key, N: tier.N, label: tier.label, seed, seedStr: g.seedStr,
    clues: g.clues, clueCount: g.clues.length, draws: g.draws,
  };
  const game = new Game(board);
  const hints = [];
  for (let k = 0; k < 3; k++) {
    const s = game.hintStep(k);
    if (!s) break;
    hints.push([
      s.rule, s.itemLabel, s.houses.join('+'), s.clueText || '-', s.cross.length, s.check.length,
      s.cross.concat(s.check).map((c) => `${c.p}/${c.row}/${c.col}`).join(','),
    ].join(' | '));
  }
  return {
    tier: tier.key, seed, N: tier.N, seedStr: g.seedStr,
    clueCount: g.clues.length, clueSig: clueSignature(g.clues, tier.N),
    truthSig: truthSignature(g.truth),
    truthList: Array.from(g.truth).join(','),
    draws: g.draws, outcome: proof.outcome, count: proof.count, stopped: proof.stopped,
    pencilSolved: proof.pencilSolved, penSteps: game.pencil.steps, penRounds: game.pencil.rounds,
    penFire: FULL_RULES.filter((r) => game.pencil.fire[r] > 0).map((r) => `${r}:${game.pencil.fire[r]}`).join(','),
    proven: boardIsProven(board, proof),
    question: game.question().text,
    pairs: game.nPairs, cells: game.cells,
    hints,
  };
}

/** 成品盘 + 一条已删线索加回去 ⇒ 找"唯一但铅笔推不完"的那一张。 */
function findStall() {
  for (const tier of TIERS) {
    for (let i = 0; i < 40; i++) {
      const g = generateOn(tier, `f${i}`);
      if (!g.ok) continue;
      for (const extra of g.dropped) {
        const set = g.clues.concat([extra]);
        const ref = referee(tier.N, set, STALL_BUDGET);
        if (ref.stopped || ref.outcome !== 'unique') continue;
        const pen = solve(tier.N, set);
        if (pen.dead || pen.solved) continue;
        return {
          kind: 'stall', tier: tier.key, N: tier.N, note: `成品盘 f${i} 加回一条已删线索`,
          clueCount: set.length, clues: set, budget: STALL_BUDGET,
          outcome: ref.outcome, count: ref.count, nodes: ref.nodes,
          stopped: ref.stopped, pencilSolved: pen.solved, pencilUndecided: pen.undecided,
        };
      }
    }
  }
  return null;
}

/**
 * 只留前几条线索 + 把**节点预算**压到几个 ⇒ 裁判在数完之前掐断 ⇒ outcome='stopped'。
 *
 * 为什么压 nodeBudget 而不是 msBudget：节点预算是**跨引擎恒定**的读数，毫秒预算不是 ——
 * 一台被兄弟 agent 压满的 runner 上，1 ms 那一条腿在 node 里 stopped、在 Chrome 里可能数完了，
 * 于是 canary 自己变成抖动源。本仓生产路径上实测 0 次击穿（`SAMPLES=24 node tools/balance.mjs`
 * 的红线 R4d 就是钉这个的），所以这张负样本**不是**"出货盘会 stopped"的证据，它验的是
 * "页面拿到 stopped 读数时的处置"：同一份题面在生产预算下必须是**判得完**的，这一条也钉在夹具里
 * （production 字段），两侧都对上才算这块负样本有效。
 */
function findStopped() {
  for (const tier of [TIERS[2], TIERS[1], TIERS[0]]) {
    for (let i = 0; i < 60; i++) {
      const g = generateOn(tier, `f${i}`);
      if (!g.ok) continue;
      for (let keep = 2; keep <= g.clues.length; keep++) {
        const set = g.clues.slice(0, keep);
        const production = referee(tier.N, set, { nodeBudget: 250_000, budgetMs: tier.budgetMs });
        if (production.stopped) continue;                    // 生产预算下判得完，才许当这块负样本
        for (const cap of [8, 16, 32, 64, 128]) {
          const budget = { nodeBudget: cap, budgetMs: 4000 };
          const r = referee(tier.N, set, budget);
          if (!r.stopped || r.reason !== 'nodes') continue;
          return {
            kind: 'stopped', tier: tier.key, N: tier.N, note: `成品盘 f${i} 的前 ${keep} 条线索 · 节点预算 ${cap}`,
            clueCount: set.length, clues: set, budget,
            outcome: r.outcome, count: r.count, stopped: r.stopped, reason: r.reason, nodes: r.nodes,
            pencilSolved: solve(tier.N, set).solved,
            production: { outcome: production.outcome, count: production.count, stopped: production.stopped, nodes: production.nodes, budget: { nodeBudget: 250_000, budgetMs: tier.budgetMs } },
          };
        }
      }
    }
  }
  return null;
}

function derive() {
  const rows = [];
  for (const tier of TIERS) for (const seed of SEEDS) rows.push(row(tier, seed));
  const neg = [findStall(), findStopped()];
  if (!neg[0]) throw new Error('找不到"唯一但铅笔推不完"的题面：canary 的负样本没了，闸的拒绝能力就没人验过');
  if (!neg[1]) throw new Error('找不到生产预算内 stopped 的题面：canary 的第二条负样本没了');
  for (const n of neg) {
    // 页面 gate.loadBoard(tier, clues, budget) 拿到的就是这组预算 ⇒ 两侧必须同一读数
    const proof = assessBoard(n.N, n.clues, n.budget);
    if (boardIsProven({ N: n.N }, proof)) throw new Error(`${n.kind} 负样本被 boardIsProven 判成可出货 —— 判据失效，闸的拒绝是假的`);
    if (n.kind === 'stall') {
      if (proof.stopped || proof.outcome !== n.outcome || proof.count !== n.count) {
        throw new Error(`stall 负样本的裁判读数不重现：钉着 ${n.outcome}/${n.count}/stopped=${n.stopped} · 重算 ${proof.outcome}/${proof.count}/stopped=${proof.stopped}`);
      }
      if (proof.pencilSolved) throw new Error('stall 负样本其实是一张好盘：铅笔从空盘推得完');
      if (proof.pencilUndecided !== n.pencilUndecided) throw new Error(`stall 的未定元数不重现：${n.pencilUndecided} → ${proof.pencilUndecided}`);
    } else {
      if (!proof.stopped || proof.reason !== 'nodes') {
        throw new Error(`stopped 负样本在夹具预算 ${JSON.stringify(n.budget)} 下没被节点预算掐断 —— canary 就成了抖动源`);
      }
      const prod = assessBoard(n.N, n.clues, n.production.budget);
      if (prod.stopped) throw new Error('stopped 负样本在生产预算下也 stopped：这块样本会变成"出货盘会 stopped"的错误主张');
      if (n.production.stopped || n.production.outcome !== prod.outcome || n.production.count !== prod.count) {
        throw new Error(`stopped 的 production 正对照不重现：钉着 ${n.production.outcome}/${n.production.count} · 重算 ${prod.outcome}/${prod.count}`);
      }
    }
  }
  return { rows, neg };
}

/** 一行一条 JSON：--check 的解析就是按行 JSON.parse，不做括号配对那种聪明事。 */
function block() {
  const { rows, neg } = derive();
  const line = (o) => JSON.stringify(o);
  return [
    '// >>>FIXTURE',
    '// 这一整块由 `node tools/fixtures.mjs` 生成，**不许手改**：`bash tools/verify.sh` 每次都先跑',
    '// `node tools/fixtures.mjs --check`，用 node 侧重算的每一行与这里逐字段对账（跑的就是浏览器加载',
    '// 那批 js/ 模块）。一行一条 JSON，解析是 JSON.parse，不玩括号配对。',
    '// truthList 只在这里存在 —— 它是**答案面板的输入样本**， shipped 路径（js/）没有这个字段；',
    '// boot 场景反过来拿 truthSig 去扫 window.zebra 的对象图、DOM 与 localStorage，扫到即红。',
    'const FIXTURE = [',
    ...rows.map((r) => `${line(r)},`),
    '];',
    '// 两块负样本：stall（裁判唯一、但铅笔从空盘推不完）与 stopped（夹具预算内节点先耗尽）。',
    '// canary 场景喂给 window.zebra.gate.loadBoard(tier, clues, budget)，断言页面**拒绝出货**',
    '// （#reject 出现、#board-wrap 与 #answer 都藏好）；stopped 那块同时带 production 正对照：',
    '// 同一张题面在生产预算下判得完 ⇒ 这块负样本测的是页面对 stopped 的处置，不是"出货盘会停"。',
    'const NEGATIVE = [',
    ...neg.map((r) => `${line(r)},`),
    '];',
    '// <<<FIXTURE',
  ].join('\n');
}

function parsePinned() {
  const src = readFileSync(join(ROOT, 'tools/scenarios.js'), 'utf8');
  const at = src.indexOf('// >>>FIXTURE');
  const end = src.indexOf('// <<<FIXTURE', at);
  if (at < 0 || end < 0) throw new Error('scenarios.js 里没有 >>>FIXTURE … <<<FIXTURE 这一段');
  const body = src.slice(at, end);
  const lines = (name) => {
    const head = body.split(`const ${name} = [`)[1];
    if (!head) return null;
    const seg = head.split('\n];')[0];
    return seg.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => JSON.parse(l.replace(/,\s*$/, '')));
  };
  return { rows: lines('FIXTURE'), neg: lines('NEGATIVE') };
}

if (process.argv.includes('--check')) {
  const { rows, neg } = derive();
  let pinned;
  try {
    pinned = parsePinned();
  } catch (e) {
    console.log(`  FAIL ${e.message}`);
    process.exit(1);
  }
  let bad = 0;
  const cmp = (label, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      bad++;
      console.log(`  FAIL ${label}\n     钉着=${JSON.stringify(a).slice(0, 260)}\n     重算=${JSON.stringify(b).slice(0, 260)}`);
    }
  };
  if (!Array.isArray(pinned.rows) || !pinned.rows.length || !Array.isArray(pinned.neg) || pinned.neg.length !== 2) {
    console.log(`  FIXTURE/NEGATIVE 解析出来是空的（rows=${pinned.rows && pinned.rows.length} neg=${pinned.neg && pinned.neg.length}）：0 行的夹具钉不住任何东西`);
    process.exit(1);
  }
  if (pinned.rows.length !== rows.length) { bad++; console.log(`  FAIL 夹具行数 ${pinned.rows.length} → ${rows.length}`); }
  for (let i = 0; i < Math.min(pinned.rows.length, rows.length); i++) cmp(`FIXTURE[${i}] ${rows[i].tier}/${rows[i].seed}`, pinned.rows[i], rows[i]);
  for (let i = 0; i < Math.min(pinned.neg.length, neg.length); i++) cmp(`NEGATIVE[${i}] ${neg[i].kind}`, pinned.neg[i], neg[i]);
  console.log(`  ${rows.length - bad >= 0 ? rows.length + neg.length - bad : 0}/${rows.length + neg.length} 条夹具仍由 node 原样重算出来（${rows.length} 盘指纹+提示前三步 · ${neg.length} 块负样本）`);
  process.exit(bad ? 1 : 0);
} else {
  console.log(block());
}
