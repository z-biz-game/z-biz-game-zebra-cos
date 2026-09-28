// 独立见证计数器 · 不做任何传播的穷举
//
// 它存在的唯一理由：裁判（counter.js）如果哪天把某个约束删漏了，它会**自洽地**给出一个错的
// "唯一"。对账不能靠同一个实现自己再跑一遍，所以本文件故意不复用 counter.js 的任何东西 ——
// 没有掩码域、没有支撑表、没有弧一致性、没有 MRV、没有类别内的定值传播，连"哪些线索该在什么
// 时刻检查"都另写一份。两条通道只共享 rules.js 里那一份 evalClue。
//
// 做法朴素到不可能被误读：按物品编号 0,1,2,… 顺序给每个物品挑房子，同类别里已被占的房子跳过
// （这是题面规则本身，不是剪枝），一条线索要等它点到的两端都放好才检查。
// 于是本文件的搜索树是 (N!)^N 的朴素子集，慢裁判一到两个数量级 —— 所以它只用于
// **抽样复核**（balance.mjs 每档抽若干张盘），不进出货路径。
//
// 预算口径与裁判一致：击穿 ⇒ stopped=true，"还没数完"不等于"数出来是 1"。
// 见证被击穿时 balance 打的是"复核未成"（inconclusive），不当作 pass，也不当作 disagreement。

import { UNARY_KINDS, catOf, evalClue } from './rules.js';

/**
 * @param N 类别数
 * @param clues 题面
 * @param opts {limitSolutions=Infinity, nodeBudget, msBudget, collect=0}
 *   collect>0 时把前 collect 个解**原样带回来**：pencil-test 要靠"每一条铅笔结论都必须在
 *   所有解里成立"来测 soundness，那需要解的集合本身，而不是它的个数。
 * @returns {count,nodes,ms,stopped,exhausted,solutions}
 */
export function countWitness(N, clues, opts = {}) {
  const limit = opts.limitSolutions === undefined ? Infinity : opts.limitSolutions;
  const nodeBudget = opts.nodeBudget === undefined ? Infinity : opts.nodeBudget;
  const msBudget = opts.msBudget === undefined ? Infinity : opts.msBudget;
  const collect = opts.collect === undefined ? 0 : opts.collect;
  const n = N * N;
  const truth = new Int8Array(n).fill(-1);

  // 每个物品挂上"它参与的线索"，检查时只看已放好的那部分。两端都放好前不判二元线索，
  // 这是本文件唯一的推迟，且它推迟的是**检查时机**而不是候选集 ⇒ 不会删掉任何解。
  const byItem = Array.from({ length: n }, () => []);
  clues.forEach((c, idx) => {
    byItem[c.a].push(idx);
    if (!UNARY_KINDS.has(c.k)) byItem[c.b].push(idx);
  });

  const t0 = performance.now();
  let count = 0, nodes = 0, stopped = false, reason = null;
  const solutions = [];

  function okSoFar(i) {
    for (const idx of byItem[i]) {
      const c = clues[idx];
      if (UNARY_KINDS.has(c.k)) { if (!evalClue(c, truth)) return false; continue; }
      if (truth[c.a] < 0 || truth[c.b] < 0) continue;
      if (!evalClue(c, truth)) return false;
    }
    return true;
  }

  function rec(i) {
    if (stopped) return;
    nodes++;
    if (nodes > nodeBudget) { stopped = true; reason = 'nodes'; return; }
    if ((nodes & 4095) === 0 && performance.now() - t0 > msBudget) { stopped = true; reason = 'time'; return; }
    if (i === n) {
      count++;
      if (solutions.length < collect) solutions.push(Int8Array.from(truth));
      return;
    }
    const c = catOf(i, N);
    let used = 0;
    for (let j = 0; j < N; j++) { const p = truth[c * N + j]; if (p >= 0) used |= 1 << p; }
    for (let p = 0; p < N; p++) {
      if (used & (1 << p)) continue;
      truth[i] = p;
      if (okSoFar(i)) rec(i + 1);
      truth[i] = -1;
      if (stopped || (limit > 0 && count >= limit)) return;
    }
  }

  rec(0);
  return { count, nodes, ms: performance.now() - t0, stopped, reason, exhausted: !stopped, solutions };
}
