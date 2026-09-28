// 出题器 · 一张"人写得出来、且铅笔推得完"的谁养鱼
//
// 一条盘的流水线，四步，每步都留账：
//   1) 抽真值：每个类别独立抽一个房子排列（truth[item] = house）。
//   2) 建**候选线索池**：按每个类别的权重表 MIX 加权抽样，桶里没有存货就少抽一条并记账。
//      —— 这一步是对选型屏那处偏差的正面修正：屏上 5×5 出货盘平均带 4.0 条 somewhere_left +
//         3.4 条 side_by_side + 0.9 条 at（_tmp-zebra-screen.mjs 2026-09-28 重跑），那是
//         "生成器能生成什么就有什么"的产物，不是人写的题。真人题面以 same / at / 否定式为主，
//         所以这里把配额写成显式权重，且**每一对物品最多出一句话**（作者不会既写"A 在 B 左边"
//         又写"A 和 B 相邻"——那是两条等价线索，删减时删一条还剩一条，会假装成"不可约"）。
//      —— 同时池子里**不再**是 N² 条 at 全量锚点。屏上那 200/200"不可约唯一"之所以是白送的，
//         正因为它的种子池永远含全部锚点。这里 at 只有 atQuota 条，池子能不能撑起唯一解
//         变成一个测出来的数（fail='pool-not-unique'），而不是被结构保证掉。
//   3) 贪心删线索：随机序逐条试删，删完仍被裁判**证明**唯一才真删。停下来的集合是逐条不可约的。
//   4) 铅笔验收：从空盘跑 pencil(FULL)。**推不完就整张丢弃重抽**（selection，不是 aspiration）。
//
// 一张盘吃完的随机数（复现性口径，全部由 seed 串决定）：
//   zebra|<tier>|<seed>          真值 + 线索池抽样 + 池内所有其它抽样
//   zebra|<tier>|<seed>|shrink   贪心删线索的次序
//   比较器一律不吃随机数（见 rng.js），所以换机器、换 sort 实现都是同一张盘。
//
// 成本口径：裁判调用次数与墙钟都记账在 receipt 里。选型屏量到出货路径 ~646 次裁判调用、
// ~8 ms/盘（2026-09-28 重跑），贵的一半在生成而不是验证 —— 所以第 3 步的池子规模是
// 一个需要按实测压小的旋钮（poolTarget），不是一个"越全越好"的默认值。

import { performance } from 'node:perf_hooks';
import { makeRng, seedOf } from './rng.js';
import { CLUE_KINDS, catOf, checkSolution, itemIds } from './rules.js';
import { countSolutions, provesUnique } from './counter.js';
import { countWitness } from './witness.js';
import { FULL_RULES, solve } from './pencil.js';

// ── 档位表 ──────────────────────────────────────────────────────────────────
// band = 每出一张盘平均要抽多少次（draws/盘）的**实测**区间，budgetMs = 单次裁判调用的毫秒预算。
// 两个数都由 tools/balance.mjs 的分位表回填，且必须取尾巴（p95），不许用中位×2：
// 出题墙钟是双峰的，中位×2 在本组织曾经盖住过一根 4 倍尾巴。
//
// 回填那次跑的读数（本机 2026-09-28，node v26.8.1，`SAMPLES=60 node tools/balance.mjs`，
// 三档各 60 张盘全部出货）：
//   t1 draws/盘 中位 1 p95 2 max 4    · 生产路径裁判 p95 0.012 ms / max 0.330 ms · 预算击穿 0
//   t2 draws/盘 中位 2 p95 6 max 12   · 生产路径裁判 p95 0.008 ms / max 0.095 ms · 预算击穿 0
//   t3 draws/盘 中位 3 p95 9 max 12   · 生产路径裁判 p95 0.012 ms / max 0.046 ms · 预算击穿 0
// budgetMs 一律取 max(10, ceil(p95×4 → 10 ms 档)) = 10 ms —— 实测 max 与预算之间还有 30 倍余量，
// 这一条余量就是"同一 seed 串在不同机器上画出同一张盘"的保障：只要生产路径上一次都不击穿，
// 时间预算就参与不到判定里，出货序列就是 seed 的纯函数（生产路径击穿一次 ⇒ balance 的 R4d 直接红）。
// tries 是"抽不出货就认输"的上限，实测最差 12 次 ⇒ 留 3 倍以上余量。
export const TIERS = Object.freeze([
  {
    key: 't1-3cat', label: '入门 · 3 类 × 3 户', N: 3,
    atQuota: 2, poolTarget: 14,
    mix: { same: 30, not: 10, not_same: 14, direct: 8, side_by_side: 8, somewhere: 12, not_side_by_side: 6, n_between: 4 },
    band: [1, 4], budgetMs: 10, tries: 40,
  },
  {
    key: 't2-4cat', label: '进阶 · 4 类 × 4 户', N: 4,
    atQuota: 3, poolTarget: 26,
    mix: { same: 28, not: 10, not_same: 16, direct: 8, side_by_side: 10, somewhere: 12, not_side_by_side: 8, n_between: 6 },
    band: [2, 10], budgetMs: 10, tries: 120,
  },
  {
    key: 't3-5cat', label: '经典 · 5 类 × 5 户（谁养鱼原题规模）', N: 5,
    atQuota: 4, poolTarget: 42,
    mix: { same: 26, not: 10, not_same: 18, direct: 8, side_by_side: 10, somewhere: 12, not_side_by_side: 8, n_between: 6 },
    band: [2, 15], budgetMs: 10, tries: 400,
  },
]);
export const tierOf = (key) => TIERS.find((t) => t.key === key) || null;
/** `n_between` 只在 |Δ|>=2 时存在，所以候选桶可能为空（3 户盘上 |Δ| 只能取 0/1/2）。 */
export const MIX_KINDS = Object.freeze(['same', 'not', 'not_same', 'direct', 'side_by_side', 'somewhere', 'not_side_by_side', 'n_between']);

// ── 1) 真值 ─────────────────────────────────────────────────────────────────
export function randomTruth(N, rnd) {
  const truth = new Int8Array(N * N).fill(-1);
  for (let c = 0; c < N; c++) {
    const perm = rnd.shuffle(Array.from({ length: N }, (_, i) => i));
    for (let i = 0; i < N; i++) truth[c * N + i] = perm[i];
  }
  return truth;
}

// ── 2) 候选池：一个 kind 一个桶 ───────────────────────────────────────────────
/**
 * 真值决定了每一对物品之间**哪些**句子是真话。按句子类型分桶，桶内顺序由 rng 的 keyed 洗牌定。
 * at / not 走配额（atQuota / not 权重），二元句子每对物品最多进一条（见文件头的口径）。
 */
function buildPool(N, truth, rnd, tier) {
  const buckets = Object.fromEntries(MIX_KINDS.map((k) => [k, []]));
  // 同一对物品只能被点名一次：先给所有跨类别对子抽一个随机序，再按序尝试装进它**能**进的那个桶。
  const pairs = [];
  for (let a = 0; a < N * N; a++) for (let b = a + 1; b < N * N; b++) {
    if (catOf(a, N) === catOf(b, N)) continue;
    pairs.push([a, b]);
  }
  const order = rnd.keyed(pairs);
  for (const [a, b] of order) {
    const d = truth[b] - truth[a], ad = Math.abs(d);
    if (ad === 0) buckets.same.push({ k: 'same', a, b });
    else if (ad === 1) {
      const dir = d > 0 ? { k: 'direct_left', a, b } : { k: 'direct_right', a, b };
      // 相邻这一对：四选一（紧邻带向 / 相邻不带向 / 序关系 / 不同址）。权重取自本档 MIX。
      // not_same 在这里也是真话，所以它必须出现在候选里 —— 漏一条真话等于悄悄改小词表。
      const kind = weightedPick(['direct', 'side_by_side', 'somewhere', 'not_same'], tier.mix, rnd);
      if (kind === 'direct') buckets.direct.push(dir);
      else if (kind === 'side_by_side') buckets.side_by_side.push({ k: 'side_by_side', a, b });
      else if (kind === 'not_same') buckets.not_same.push({ k: 'not_same', a, b });
      else buckets.somewhere.push(d > 0 ? { k: 'somewhere_left', a, b } : { k: 'somewhere_right', a, b });
    } else {
      // 分开至少两间：not_same / 序关系 / 不相邻 / 隔 n 间 四种真话可选
      const kind = weightedPick(['not_same', 'somewhere', 'not_side_by_side', 'n_between'], tier.mix, rnd);
      if (kind === 'not_same') buckets.not_same.push({ k: 'not_same', a, b });
      else if (kind === 'somewhere') buckets.somewhere.push(d > 0 ? { k: 'somewhere_left', a, b } : { k: 'somewhere_right', a, b });
      else if (kind === 'not_side_by_side') buckets.not_side_by_side.push({ k: 'not_side_by_side', a, b });
      else buckets.n_between.push({ k: 'n_between', a, b, n: ad - 1 });
    }
  }
  for (const k of MIX_KINDS) buckets[k] = rnd.shuffle(buckets[k]);
  // at 桶：锚点数量是显式配额，**不是** N² 全量。
  const anchors = rnd.shuffle(itemIds(N)).slice(0, tier.atQuota).map((it) => ({ k: 'at', a: it, p: truth[it] }));
  // not 桶：随机挑若干物品，各给一间它不住的房子。
  const notBucket = [];
  for (const it of rnd.shuffle(itemIds(N))) {
    if (notBucket.length >= Math.max(2, Math.round(N * 0.8))) break;
    const wrong = [];
    for (let p = 0; p < N; p++) if (p !== truth[it]) wrong.push(p);
    if (wrong.length) notBucket.push({ k: 'not', a: it, p: rnd.pick(wrong) });
  }
  const short = {};
  const pool = [];
  // 加权抽 poolTarget 条：桶空了就少抽一条并记账（这是"这套词表在这张真值上撑不出更多话"的
  // 唯一诚实信号，吞掉它会让 poolTarget 变成一个假承诺）。
  for (let i = 0; i < tier.poolTarget; i++) {
    const open = MIX_KINDS.filter((k) => buckets[k].length);
    if (!open.length) break;
    const kind = weightedPick(open, tier.mix, rnd);
    const clues = buckets[kind];
    pool.push(clues.shift());
  }
  for (const k of MIX_KINDS) short[k] = buckets[k].length;
  return { pool, anchors, notBucket, short };
}

function weightedPick(kinds, mix, rnd) {
  let total = 0;
  for (const k of kinds) total += (mix[k] || 0);
  if (!(total > 0)) return kinds[0];
  let x = rnd.next() * total;
  for (const k of kinds) { x -= (mix[k] || 0); if (x < 0) return k; }
  return kinds[kinds.length - 1];
}

/**
 * 一次抽取 = 真值 + 池 + 贪心删 + 铅笔验收。
 * @param tier TIERS 里的一条
 * @param seed 盘号（串或整数）；实际 seed 串是 `zebra|<tier>|<seed>`
 * @param opts {budgetMs, nodeBudget, rules}
 */
export function drawOnce(tier, seed, opts = {}) {
  const { N } = tier;
  const budgetMs = opts.budgetMs ?? tier.budgetMs;
  const nodeBudget = opts.nodeBudget ?? 250_000;
  const rules = opts.rules ?? FULL_RULES;
  const sMain = seedOf(tier.key, seed);
  const t0 = performance.now();
  const rnd = makeRng(sMain);
  const truth = randomTruth(N, rnd);
  const { pool, anchors, notBucket, short } = buildPool(N, truth, rnd, tier);
  // 池 = 二元/一元抽样 + at 锚点 + not 排除。at/not 不参与"每对最多一条"的限制（它们点的是一端）。
  let set = pool.concat(anchors, notBucket);
  // callMs / stops 记的是**生产路径上每一次裁判调用**的成本。budgetMs 只能由这条分布的尾巴回填，
  // 不能由"出货盘复核"那一次调用的成本回填 —— 删线索过程中的题面比成品**更松**，因而贵得多，
  // 只量成品会把预算定小了。
  const dense = countSolutions(N, set, { limitSolutions: 2, nodeBudget, msBudget: budgetMs });
  let calls = 1, stops = dense.stopped ? 1 : 0;
  const callMs = [dense.ms];
  if (dense.stopped) return { fail: 'pool-over-budget', calls, stops, callMs, poolSize: set.length, ms: performance.now() - t0 };
  if (!provesUnique(dense)) {
    return { fail: dense.outcome === 'none' ? 'pool-unsatisfiable' : 'pool-not-unique', calls, stops, callMs, poolSize: set.length, ms: performance.now() - t0 };
  }
  // 贪心删：随机序，逐条试删，删完仍**被证明**唯一才删。
  const order = makeRng(sMain + '|shrink').keyed(set);
  const dropped = [];
  for (const clue of order) {
    const idx = set.indexOf(clue);
    if (idx < 0) continue;
    const trial = set.slice(0, idx).concat(set.slice(idx + 1));
    const r = countSolutions(N, trial, { limitSolutions: 2, nodeBudget, msBudget: budgetMs });
    calls++; callMs.push(r.ms);
    if (r.stopped) { stops++; continue; }    // 预算击穿 ⇒ 不许删（宁可不删也不把 stopped 读成唯一）
    if (provesUnique(r)) { set = trial; dropped.push(clue); }
  }
  // 铅笔验收：从空盘推，推不完 ⇒ 丢弃
  const pen = solve(N, set, { rules });
  const ms = performance.now() - t0;
  if (pen.dead) return { fail: 'pencil-contradiction', calls, stops, callMs, poolSize: pool.length, ms };
  if (!pen.solved) return { fail: 'pencil-stall', calls, stops, callMs, poolSize: set.length, undecided: pen.undecided, ms };
  return {
    truth, clues: set, seedStr: sMain, pool, anchors, dropped, calls, stops, callMs, ms,
    receipt: {
      count: 1, stopped: false, pencilSolved: true, pencilRules: pen.used,
      pencilFire: pen.fire, draws: 1, refereeCalls: calls, budgetStops: stops, prodMs: ms, callMs,
      poolSize: pool.length + anchors.length + notBucket.length, keptSize: set.length,
      poolShort: short, witness: null,
    },
  };
}

/**
 * 出货：按 seed 递增抽取，直到一张通过全部验收。
 * @returns 通过 ⇒ {ok:true, ...drawOnce 的结果, draws}；用完 tries ⇒ {ok:false, failures, draws}
 */
export function generateOn(tier, baseSeed, opts = {}) {
  const tries = opts.tries ?? tier.tries;
  const failures = {};
  let last;
  for (let d = 0; d < tries; d++) {
    const r = drawOnce(tier, `${baseSeed}#${d}`, opts);
    if (!r.fail) {
      r.draws = d + 1;
      r.receipt.draws = d + 1;
      r.receipt.failures = failures;
      r.failures = failures;
      r.ok = true;
      return r;
    }
    last = r;
    failures[r.fail] = (failures[r.fail] || 0) + 1;
  }
  return { ok: false, failures, draws: tries, last };
}

/** 面向调用方的入口：seed 省略时按档位名取一个可打印的默认串。 */
export function generate(tierKey, seed = '0', opts = {}) {
  const tier = tierOf(tierKey);
  if (!tier) throw new Error(`未知档位 ${tierKey}`);
  return { tier, ...generateOn(tier, seed, opts) };
}

// ── 独立复核 ─────────────────────────────────────────────────────────────────
/**
 * 两条通道对账：裁判（传播引导）说唯一，见证（不做任何传播，见 witness.js）也必须数到 1。
 * 见证被预算掐断时 verdict='witness-capped' —— 那是**未成**的复核，不是 pass，
 * 也不是 disagreement。balance 每档抽若干张盘跑它，抽样而非全量：它是朴素枚举，全量能跑一天。
 */
export function crossCheck(N, clues, opts = {}) {
  const ref = countSolutions(N, clues, { limitSolutions: 2, nodeBudget: opts.nodeBudget ?? 250_000, msBudget: opts.budgetMs ?? 200 });
  const wit = countWitness(N, clues, { limitSolutions: 2, nodeBudget: opts.witnessNodes ?? 4_000_000, msBudget: opts.witnessMs ?? 3_000 });
  let verdict;
  if (ref.stopped) verdict = 'referee-capped';
  else if (wit.stopped) verdict = 'witness-capped';
  else if (ref.count === 1 && wit.count === 1) verdict = 'agree-unique';
  else if (ref.count === wit.count) verdict = `agree-${ref.count}`;
  else verdict = 'DISAGREE';
  return { verdict, ref, wit };
}

/** 出货盘的完整证明回执：唯一性（裁判）+ 铅笔可解 + 真值自洽。UI 与门禁读同一个对象。 */
export function proveBoard(tier, clues, truth, opts = {}) {
  const ref = countSolutions(tier.N, clues, { limitSolutions: 2, nodeBudget: opts.nodeBudget ?? 250_000, msBudget: opts.budgetMs ?? tier.budgetMs });
  const pen = solve(tier.N, clues, { rules: opts.rules ?? FULL_RULES });
  const sol = checkSolution(tier.N, truth, clues);
  return {
    count: ref.count, stopped: ref.stopped, outcome: ref.outcome, nodes: ref.nodes, ms: ref.ms,
    pencilSolved: pen.solved, pencilFire: pen.fire, pencilUndecided: pen.undecided,
    draws: opts.draws ?? null, clueCount: clues.length,
    truthOk: sol.ok, truthReasons: sol.reasons,
  };
}

export { CLUE_KINDS };
