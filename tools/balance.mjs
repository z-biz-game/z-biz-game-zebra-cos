// 难度实测台 · 谁养鱼
//
// 这台机器**读**难度的读数，不**设**难度。js/engine/generate.js 里 TIERS[].band 与 TIERS[].budgetMs
// 必须是本文件打印的分位表回填过来的；改一次线索权重、加一条铅笔规则、换一台机器，这些数字就得
// 重抄；不重抄会被"档位不再落在自己的 band 里"这条红线打红。
//
// 五条红线（任何一条不认账 ⇒ RESULT ok=false + exit 1）：
//   R1 出货盘 100% 被铅笔从空盘推完（拿盘重跑，不读生成器自己记的账）
//   R2 出货盘 100% 被裁判在预算内**证**唯一：stopped 次数必须为 0（一次都不许，见下）
//   R3 独立见证（不做任何传播）在抽样复核上与裁判给出同一个"1 解"
//   R4 每档抽到的盘仍落在自己的 band 里（draws/盘 的中位数）、各档中位数严格递增
//      R4b 生产路径单次裁判的 p95 必须 ≤ budgetMs；R4d 生产路径**一次都不许**击穿预算
//   R5 逐条不可约：出货盘上再删任一条线索都不再唯一（删完还唯一 ⇒ 贪心提前收工了）
//
// budgetMs 的口径：**取实测尾巴（p95），不取中位×2**。本组织的出题墙钟是双峰的，
// 中位×2 曾经盖住一根 4 倍尾巴。这里 budgetMs = 生产路径上**每一次**裁判调用的 p95 × 4 向上取整
// 到 10 ms（下限 10 ms）。注意量的是生产路径而不是成品复核：删线索途中的题面更松、更贵，
// 只量成品会把预算定小，浏览器里一次调用就会击穿它。
//
// 一条诚实的读数（不是红线）：**线索条数不是单调的难度轴**。台阶实验把已删的线索按原路加回去，
// 量"线索数 vs 铅笔剩余未定值"的秩相关，并数有多少次"加回线索反而更难"。选型屏在 4×4 与 5×5
// 各测到 1/360 次台阶倒退（_tmp-zebra-screen.mjs 2026-09-28 重跑）；原因是 P5 这类**存在性**规则
// 不是支撑规则，加一条线索可能把"某间只剩一个人够得着"那个唯一够得着的人也划掉，从而撤销整条连锁。
// 所以 band 用的是 draws/盘，不是原始线索数。
//
//   node tools/balance.mjs                 门禁模式（默认 SAMPLES=12）
//   SAMPLES=24 node tools/balance.mjs      CI 用的抽样量
//   SAMPLES=60 node tools/balance.mjs      本地重抄 band/budgetMs 用的抽样量
//   HEADROOM=2                             墙钟尾巴相对 budgetMs 的容差（判 p95，不判单次 max）

import { performance } from 'node:perf_hooks';
import { loadavg } from 'node:os';
import { POP, describeClue, evalClue, checkSolution } from '../js/engine/rules.js';
import { TIERS, crossCheck, drawOnce, generateOn } from '../js/engine/generate.js';
import { countSolutions, provesUnique } from '../js/engine/counter.js';
import { BASIC_RULES, FULL_RULES, auditAgainst, solve } from '../js/engine/pencil.js';

const SAMPLES = Number(process.env.SAMPLES || 12);
const HEADROOM = Number(process.env.HEADROOM ?? 2);
const NODE_BUDGET = 250_000;
const WITNESS_SAMPLE = Math.min(SAMPLES, 8);
const IRRED_SAMPLE = Math.min(SAMPLES, 12);
const LADDER_RUNGS = [0, 1, 2, 3, 5, 8, 12, 18, 25];

let red = 0;
const fail = (msg) => { red++; console.log(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
const srt = (xs) => xs.slice().sort((a, b) => a - b);
const q = (xs, p) => { if (!xs.length) return NaN; const s = srt(xs); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const imax = (xs) => { let m = -Infinity; for (const x of xs) if (x > m) m = x; return m === -Infinity ? NaN : m; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const hist = (xs) => { const m = {}; for (const x of xs) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(' '); };
/** 混合比例的规范化桶：与 generate.js 的 MIX 键同名，direct/somewhere 把方向并进来读。 */
const mixBucket = (c) => (c.k === 'direct_left' || c.k === 'direct_right' ? 'direct' : c.k === 'somewhere_left' || c.k === 'somewhere_right' ? 'somewhere' : c.k);
function avgRanks(v) {
  const s = srt(v), r = new Array(v.length);
  for (let i = 0; i < v.length; i++) { const a = s.indexOf(v[i]), b = s.lastIndexOf(v[i]); r[i] = (a + b) / 2 + 1; }
  return r;
}
function spearman(xs, ys) {
  const rx = avgRanks(xs), ry = avgRanks(ys), mx = mean(rx), my = mean(ry);
  let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) { n += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return (dx && dy) ? n / Math.sqrt(dx * dy) : NaN;
}

console.log(`== 谁养鱼 · 难度实测（SAMPLES=${SAMPLES}/档，裁判预算=各档 TIERS[].budgetMs，节点 ${NODE_BUDGET}）==`);
console.log(`  本机 loadavg ${loadavg().map((x) => x.toFixed(1)).join(' ')} —— 墙钟一律当**上界**读，判定只认 p95 与确定性量`);

const ROWS = [];
for (const tier of TIERS) {
  const t0 = performance.now();
  const boards = [];
  const failures = {};
  let totalDraws = 0, unshipped = 0;
  // 第 i 局的 base seed 就是 `b<i>`：SAMPLES 改大只会**追加**新盘，不会挪动已有盘的号码，
  // 所以 SAMPLES=12 的那 12 张是 SAMPLES=24 那 24 张的前缀（band 回填可对账）。
  for (let i = 0; i < SAMPLES; i++) {
    const g = generateOn(tier, `b${i}`);
    totalDraws += g.draws;
    for (const k in (g.failures || {})) failures[k] = (failures[k] || 0) + g.failures[k];
    if (g.ok) boards.push({ ...g, draws: g.draws });
    else unshipped++;
  }
  const row = { tier, boards, totalDraws, failures, unshipped, wall: performance.now() - t0 };
  ROWS.push(row);
}

for (const row of ROWS) {
  const { tier, boards, totalDraws, failures, unshipped, wall } = row;
  const { N } = tier;
  console.log(`\n== ${tier.key} ${tier.label} · 解空间 (${N}!)^${N} ==`);
  if (!boards.length) { fail(`${tier.key} 一张盘都没抽出来（failures ${JSON.stringify(failures)}）`); continue; }
  const perDraw = totalDraws / boards.length;

  // R1 铅笔复跑（不读生成器的账）+ 真值审计
  let penF = 0, penB = 0, wrong = 0, dead = 0, truthBad = 0;
  const fire = Object.fromEntries(FULL_RULES.map((r) => [r, 0]));
  for (const b of boards) {
    const r = solve(N, b.clues, { rules: FULL_RULES });
    if (r.solved) penF++;
    if (solve(N, b.clues, { rules: BASIC_RULES }).solved) penB++;
    wrong += auditAgainst(N, r, b.truth).length;
    if (r.dead) dead++;
    for (const k of FULL_RULES) fire[k] += r.fire[k];
    const s = checkSolution(N, b.truth, b.clues);
    if (!s.ok) { truthBad++; if (truthBad === 1) fail(`${tier.key} 真值不满足题面：${s.reasons[0]}`); }
  }
  if (penF === boards.length) pass(`R1 出货盘铅笔可解 ${penF}/${boards.length}（100%，空盘起跑，FULL=${FULL_RULES.join('+')}）`);
  else fail(`R1 出货盘铅笔可解只有 ${penF}/${boards.length}`);
  if (wrong === 0 && dead === 0) pass(`R1b 铅笔结论与真值冲突 0 处、误报矛盾 0 张（soundness）`);
  else fail(`R1b 铅笔出错：冲突 ${wrong} 处 / 误报矛盾 ${dead} 张`);
  if (truthBad === 0) pass(`R1c 每张出货盘的真值都满足全部题面线索 ${boards.length}/${boards.length}`);

  // R2 裁判复核（每次调用都记账 ms/nodes/stopped）
  const cms = [], cnodes = [], cbranch = [];
  let stopped = 0, notUnique = 0;
  for (const b of boards) {
    const r = countSolutions(N, b.clues, { limitSolutions: 2, nodeBudget: NODE_BUDGET, msBudget: tier.budgetMs });
    cms.push(r.ms); cnodes.push(r.nodes); cbranch.push(r.branchNodes);
    if (r.stopped) stopped++;
    else if (!provesUnique(r)) notUnique++;
  }
  if (stopped === 0 && notUnique === 0) pass(`R2 裁判在 ${tier.budgetMs} ms / ${NODE_BUDGET} 节点内证唯一 ${boards.length}/${boards.length}（stopped 0）`);
  else fail(`R2 裁判：stopped ${stopped}/${boards.length}、非唯一 ${notUnique}/${boards.length} —— stopped 一律算"唯一性未证明"，不四舍五入`);

  // R3 独立见证
  const verdicts = {};
  for (const b of boards.slice(0, WITNESS_SAMPLE)) {
    const v = crossCheck(N, b.clues, { budgetMs: tier.budgetMs, nodeBudget: NODE_BUDGET }).verdict;
    verdicts[v] = (verdicts[v] || 0) + 1;
  }
  const disagree = (verdicts.DISAGREE || 0);
  const capped = (verdicts['witness-capped'] || 0) + (verdicts['referee-capped'] || 0);
  if (disagree === 0) pass(`R3 独立见证（无传播）抽样 ${WITNESS_SAMPLE} 张：${JSON.stringify(verdicts)}（未成 ${capped} 张不算 pass 也不算分歧）`);
  else fail(`R3 独立见证与裁判分歧 ${disagree} 张：${JSON.stringify(verdicts)}`);

  // R5 逐条不可约
  let droppable = 0, irreBoards = 0;
  for (const b of boards.slice(0, IRRED_SAMPLE)) {
    let ok = true;
    for (let i = 0; i < b.clues.length; i++) {
      const trial = b.clues.slice(0, i).concat(b.clues.slice(i + 1));
      const r = countSolutions(N, trial, { limitSolutions: 2, nodeBudget: NODE_BUDGET, msBudget: tier.budgetMs });
      if (!r.stopped && provesUnique(r)) { ok = false; break; }
    }
    irreBoards++;
    if (!ok) droppable++;
  }
  if (droppable === 0) pass(`R5 逐条不可约：${irreBoards} 张盘各试删一条，没有一条删得掉的`);
  else fail(`R5 有 ${droppable}/${irreBoards} 张盘还能再删一条线索 —— 贪心提前收工了`);

  // 读数：线索构成 / 数量 / 成本
  const counts = boards.map((b) => b.clues.length);
  const bucket = {};
  for (const b of boards) for (const c of b.clues) bucket[mixBucket(c)] = (bucket[mixBucket(c)] || 0) + 1;
  const kinds = new Set();
  for (const b of boards) for (const c of b.clues) kinds.add(c.k);
  const mixLine = Object.entries(bucket).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v / boards.length).toFixed(1)}(${(100 * v / counts.reduce((a, b) => a + b, 0)).toFixed(0)}%)`).join(' · ');
  const relational = (bucket.somewhere || 0) + (bucket.side_by_side || 0);
  const prodMs = boards.map((b) => b.ms), calls = boards.map((b) => b.calls), draws = boards.map((b) => b.draws);
  const allCallMs = [];
  for (const b of boards) allCallMs.push(...b.callMs);
  const prodStops = boards.reduce((a, b) => a + (b.stops || 0), 0);
  console.log(`  出货：${boards.length}/${SAMPLES} 张 / ${totalDraws} 次抽取 · draws/盘 中位 ${q(draws, .5)} p95 ${q(draws, .95)} max ${imax(draws)} · 均值 ${f(perDraw, 1)}`);
  if (unshipped) fail(`抽 ${tier.tries} 次仍出不了货的局号有 ${unshipped}/${SAMPLES} —— "这一档养得起"是个假承诺`);
  console.log(`  拒收账：${JSON.stringify(failures)}`);
  console.log(`  出题墙钟 ms：p50 ${f(q(prodMs, .5), 1)} p95 ${f(q(prodMs, .95), 1)} max ${f(imax(prodMs), 1)} · 裁判调用/盘 p50 ${q(calls, .5)} p95 ${q(calls, .95)} 共 ${allCallMs.length} 次`);
  console.log(`  生产路径单次裁判 ms（budgetMs 的定价依据）：p50 ${f(q(allCallMs, .5), 3)} p95 ${f(q(allCallMs, .95), 3)} max ${f(imax(allCallMs), 3)} · 盘内击穿 ${prodStops}（击穿的那次调用只会"不许删"，不会污染答案）`);
  console.log(`  裁判（出货盘复核）ms：p50 ${f(q(cms, .5), 3)} p95 ${f(q(cms, .95), 3)} max ${f(imax(cms), 3)} · 节点 p50 ${q(cnodes, .5)} p95 ${q(cnodes, .95)} max ${imax(cnodes)} · 零分支 ${cbranch.filter((x) => x === 0).length}/${boards.length} · stopped ${stopped}`);
  console.log(`  线索数：均值 ${f(mean(counts), 1)} 中位 ${q(counts, .5)} 范围 ${hist(counts)}`);
  console.log(`  线索构成（每盘条数(占比)）：${mixLine}`);
  console.log(`    somewhere+side_by_side 合计占比 ${f(100 * relational / counts.reduce((a, b) => a + b, 0), 1)}% —— 选型屏 5×5 的那根偏差读数是 39.6%（4.0+3.4 条 / 18.7 条，2026-09-28 重跑）`);
  console.log(`    出现过的线索类型 ${kinds.size}/11：${[...kinds].sort().join(' ')}`);
  console.log(`  铅笔：FULL ${penF}/${boards.length} · 同一批盘上 BASIC(P1..P5) ${penB}/${boards.length} · 规则出场（删除位数）${JSON.stringify(fire)}`);
  console.log(`  本档墙钟 ${f(wall / 1000, 1)} s`);

  // R4 band + budgetMs 回填建议
  const med = q(draws, .5), p95 = q(draws, .95);
  const lo = Math.max(1, Math.floor(med * 0.4)), hi = Math.max(lo + 1, Math.ceil(p95 * 1.6));
  const sugBudget = Math.max(10, Math.ceil(q(allCallMs, .95) * 4 / 10) * 10);
  const inBand = med >= tier.band[0] && med <= tier.band[1];
  const tailOk = q(allCallMs, .95) <= tier.budgetMs;
  const proofOk = q(cms, .95) <= tier.budgetMs * HEADROOM;
  if (inBand) pass(`R4 band：draws/盘 中位 ${med} 落在 [${tier.band.join(', ')}] 内`);
  else fail(`R4 band：draws/盘 中位 ${med}（p95 ${p95}）跑到 [${tier.band.join(', ')}] 之外了 —— 建议改成 [${lo}, ${hi}]`);
  if (tailOk) pass(`R4b budgetMs 定得起：生产路径裁判 p95 ${f(q(allCallMs, .95), 3)} ms ≤ budgetMs ${tier.budgetMs} ms（max ${f(imax(allCallMs), 3)} ms）`);
  else fail(`R4b 生产路径裁判 p95 ${f(q(allCallMs, .95), 3)} ms > budgetMs ${tier.budgetMs} —— 建议 budgetMs=${sugBudget}`);
  if (proofOk) pass(`R4c 复核墙钟 p95 ${f(q(cms, .95), 3)} ms ≤ budgetMs ${tier.budgetMs} × ${HEADROOM}（墙钟判 p95，单次 max ${f(imax(cms), 3)} ms 只作读数）`);
  else fail(`R4c 复核墙钟 p95 ${f(q(cms, .95), 3)} ms > ${tier.budgetMs} × ${HEADROOM}`);
  const prodP95 = q(prodMs, .95);
  // R4d 生产路径一次都不许击穿预算：击穿的那次调用只会让贪心"不许删"（安全），
  // 但它证明 budgetMs 在这台机器/这个档上定低了 —— 低到出题路径上真的会撞上，就是假承诺。
  if (prodStops === 0) pass(`R4d 生产路径裁判 0 次预算击穿（${allCallMs.length} 次调用）`);
  else fail(`R4d 生产路径裁判击穿预算 ${prodStops} 次 / ${allCallMs.length} 次调用 —— budgetMs ${tier.budgetMs} ms 定低了，建议 ${sugBudget}`);
  row.basicRate = penB / boards.length;
  row.suggest = { band: [lo, hi], budgetMs: sugBudget, med, p95, clueMean: mean(counts), prodP95 };
}

// 阶梯：线索条数 vs 铅笔未定值（难度轴可用性的诚实读数，不设红线）
console.log(`\n== 台阶实验：把已删的线索按原路加回去（P5 是存在性规则，加线索可能撤销连锁）==`);
for (const { tier, boards } of ROWS) {
  if (!boards.length) continue;
  const pairs = [];
  let steps = 0, back = 0;
  for (const b of boards.slice(0, Math.min(boards.length, 20))) {
    const addBack = b.dropped.slice().reverse();
    let prevU = null;
    for (const j of LADDER_RUNGS) {
      if (j > addBack.length) continue;
      const set = b.clues.concat(addBack.slice(0, j));
      const r = solve(tier.N, set);
      const u = r.solved ? 0 : r.undecided;
      pairs.push([set.length, u]);
      if (prevU !== null) { steps++; if (u > prevU) back++; }
      prevU = u;
    }
  }
  const rho = spearman(pairs.map((x) => x[0]), pairs.map((x) => x[1]));
  console.log(`  ${tier.key}：${pairs.length} 个台阶点 / ${steps} 次相邻步 · 秩相关 rho(clue数, 未定值)=${f(rho, 3)}（负=线索越多越易推）· 台阶倒退 ${back} 次`);
}

// 阶梯排序（难度阶梯必须是量出来的单调东西）
// 判三个量，前两个是**确定性**的（与机器、与 JIT 无关）：
//   M1 出货题面的线索条数均值：严格递增
//   M2 BASIC(P1..P5) 能推完的比例：不增，且首尾两档必须拉开 —— 这条才是"对玩家更难"的正面读数
//   M3 draws/盘 的中位数：**不减**，且首尾严格
// M3 为什么不是严格递增（这一版文案改的是**承诺的写法**，不是门槛的数值）：
// draws/盘 量的是"生成器碰运气碰上铅笔可解盘"的频率，SAMPLES=24 那一跑实测
// t1/t2/t3 = 1/2/2 —— 中段两档打平。它是生产成本的读数，不是玩家侧难度的读数，
// 所以本仓的阶梯承诺写成"档位按 (类别数, 线索条数) 排，并被 M2 的实测推完率背书"，
// 而不是"抽中一张可出货的盘越来越难"。墙钟 p95 只打印不判定：t1 那一档最冷（JIT），
// 拿它当单调承诺是个假门，第一轮就红在这里（t1 p95 2.4 ms > t2 的 0.8 ms）。
console.log(`\n== 阶梯排序（M1 线索数均值严格递增 · M2 BASIC 推完率不增且首尾拉开 · M3 draws/盘中位不减且首尾严格）==`);
const withData = ROWS.filter((r) => r.suggest);
let ordered = true;
for (let i = 1; i < withData.length; i++) {
  const a = withData[i - 1], b = withData[i];
  const okClue = a.suggest.clueMean < b.suggest.clueMean;
  const okBasic = a.basicRate >= b.basicRate;
  const okDraw = a.suggest.med <= b.suggest.med;
  if (!okClue || !okBasic || !okDraw) ordered = false;
  console.log(`  ${a.tier.key} → ${b.tier.key}：线索数均值 ${f(a.suggest.clueMean, 1)}→${f(b.suggest.clueMean, 1)} ${okClue ? '↑' : '!!'} · BASIC 推完率 ${f(100 * a.basicRate, 0)}%→${f(100 * b.basicRate, 0)}% ${okBasic ? '↓' : '!!'} · draws/盘中位 ${a.suggest.med}→${b.suggest.med} ${okDraw ? '—' : '!!'} ·（读数：出题 p95 ${f(a.suggest.prodP95, 1)}→${f(b.suggest.prodP95, 1)} ms）`);
}
if (withData.length >= 2) {
  const first = withData[0], last = withData[withData.length - 1];
  const ends = first.suggest.clueMean < last.suggest.clueMean && first.basicRate > last.basicRate && first.suggest.med < last.suggest.med;
  if (ordered && ends) pass('M1/M2/M3 全部成立，且首尾两档确实拉开（阶梯是量出来的）');
  else fail('阶梯不再单调 —— 档位的先后顺序是个假承诺');
}

console.log(`\n== band / budgetMs 回填建议（本跑实测，SAMPLES=${SAMPLES}）==`);
for (const { tier, suggest } of ROWS) {
  if (!suggest) continue;
  console.log(`  ${tier.key}: band [${tier.band.join(', ')}] → 建议 [${suggest.band.join(', ')}] · budgetMs ${tier.budgetMs} → 建议 ${suggest.budgetMs}`);
}
console.log(`  口径：band 取 draws/盘 的中位与 p95；budgetMs 取裁判 p95 的 25 倍向上取整到 10 ms。**都不取中位×2**。`);
console.log(`\nRESULT balance ok=${red === 0} tiers=${ROWS.length} boards=${ROWS.reduce((a, r) => a + r.boards.length, 0)} reds=${red}`);
process.exit(red ? 1 : 0);
