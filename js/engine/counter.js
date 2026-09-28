// 唯一解裁判 · 传播引导的穷举计数器（允许搜索的那条通道）
//
// 本盘解空间是 (N!)^N：3 类 216、4 类 331,776、5 类 24,883,200,000（选型屏
// _tmp-zebra-screen.mjs 2026-09-28 重跑打印的就是这三个数）。所以"证明唯一"绝不可能靠
// 枚举全部填法，只能靠线索把树剪掉。剪法是：
//   1) 一元线索直接压成掩码（at 收窄到一点、not 挖掉一点）；
//   2) 二元线索做弧一致性 —— 一个房子留着，当且仅当对侧还有房子能与之满足该关系；
//      关系支撑表在 rules.js 里按 (N, 关系) 预摊，热循环不现算；
//   3) 类别内 all-different：定值传播（naked single）+ 位置容量（某个房子在该类别里
//      只剩一个可能的物品 ⇒ 就是它，hidden single）。
//   推不动了就 MRV 分支（候选最少的物品先试）。
//
// 三态出口，**这一个字段就是本仓最要紧的口径**：
//   outcome='unique'    数完，恰好 1 个解  —— 唯一性被证明
//   outcome='multiple'  数到第 2 个就收工 —— 盘不唯一，确定事实
//   outcome='none'      数完，0 个解      —— 题面自相矛盾（出题器 bug 才会走到这里）
//   outcome='stopped'   预算击穿          —— **唯一性未证明**，调用方必须当失败处理
// 半路的 count 也可能是 1，但"还没数完"和"数出来是 1"是两件事。选型屏在 200 ms / 25 万节点
// 的预算下 600 张盘 0 次击穿（2026-09-28 重跑），所以击穿在这里不是预期事件；正因如此，
// 一旦击穿必须是红的，而不是被四舍五入成"唯一"。provesUnique() 是本文件唯一的读法，
// 它检查 stopped —— 让"把 stopped 当 unique 用"这种写法在类型上就走不通。

import { POP, bitsOf, catLists, evalClue, fullMask, relKey, supports } from './rules.js';

/**
 * @param N   类别数 = 每类物品数 = 房子数
 * @param clues 线索数组（rules.js 的 AST）
 * @param opts {limitSolutions=2, nodeBudget, msBudget}
 *   limitSolutions=2 是"证明唯一"的正确用法：跑到第 2 个解就停，1 个解 + 树已穷尽 = 唯一。
 * @returns {outcome,count,nodes,ms,stopped,reason,exhausted,branchNodes,leafInvalid,firstSolution}
 */
export function countSolutions(N, clues, opts = {}) {
  const limit = opts.limitSolutions === undefined ? 2 : opts.limitSolutions;
  const nodeBudget = opts.nodeBudget === undefined ? Infinity : opts.nodeBudget;
  const msBudget = opts.msBudget === undefined ? Infinity : opts.msBudget;
  const FULL = fullMask(N), n = N * N;
  const cats = catLists(N);
  const bin = [];
  for (const c of clues) {
    if (c.k === 'at' || c.k === 'not') continue;
    bin.push({ k: relKey(c), a: c.a, b: c.b, t: supports(N, relKey(c)) });
  }
  const dom0 = new Uint32Array(n).fill(FULL);
  for (const c of clues) {
    if (c.k === 'at') dom0[c.a] &= (1 << c.p);
    else if (c.k === 'not') dom0[c.a] &= ~((1 << c.p)) & FULL;
  }

  const t0 = performance.now();
  const pos = new Int8Array(n).fill(-1);
  let nodes = 0, count = 0, stopped = false, reason = null, branchNodes = 0, leafInvalid = 0;
  let first = null;

  // 传播：只删值，且删掉的是"在任何解里都不可能成立"的值 ⇒ 永不删掉解（soundness）。
  // 返回 false 表示某个域被删空 = 该分支无解，可以安全回溯。
  function propagate(dom) {
    for (;;) {
      let changed = false;
      for (const e of bin) {
        const [ta, tb] = e.t;
        const na = dom[e.a] & ta[dom[e.b]];
        if (na !== dom[e.a]) { if (!na) return false; dom[e.a] = na; changed = true; }
        const nb = dom[e.b] & tb[dom[e.a]];
        if (nb !== dom[e.b]) { if (!nb) return false; dom[e.b] = nb; changed = true; }
      }
      for (const items of cats) {
        for (;;) {
          let local = false, used = 0;
          for (const v of items) if (POP[dom[v]] === 1) used |= dom[v];
          for (const v of items) {
            if (POP[dom[v]] === 1) continue;
            const nd = dom[v] & ~used;
            if (nd !== dom[v]) { if (!nd) return false; dom[v] = nd; local = true; changed = true; }
          }
          for (let p = 0; p < N; p++) {           // 位置容量
            const bit = 1 << p;
            let holder = -1, k = 0;
            for (const v of items) if (dom[v] & bit) { holder = v; k++; if (k > 1) break; }
            if (k === 0) return false;
            if (k === 1 && POP[dom[holder]] > 1) { dom[holder] = bit; local = true; changed = true; }
          }
          if (!local) break;
        }
      }
      if (!changed) return true;
    }
  }

  function dfs(dom) {
    if (stopped) return;
    nodes++;
    if (nodes > nodeBudget) { stopped = true; reason = 'nodes'; return; }
    if ((nodes & 31) === 0 && performance.now() - t0 > msBudget) { stopped = true; reason = 'time'; return; }
    if (!propagate(dom)) return;
    let v = -1, best = 99;
    for (let i = 0; i < n; i++) { const pc = POP[dom[i]]; if (pc > 1 && pc < best) { best = pc; v = i; } }
    if (v < 0) {
      for (let i = 0; i < n; i++) pos[i] = bitsOf(dom[i])[0];
      // 叶子复核：传播若写错（删漏了某个约束），这里会给出一个不满足题面的"解"。
      // 这是裁判的自检位，leafInvalid 必须恒为 0 —— 见 counter-test 的证人节。
      for (const c of clues) if (!evalClue(c, pos)) { leafInvalid++; return; }
      count++;
      if (!first) first = Int8Array.from(pos);
      return;
    }
    branchNodes++;
    for (const p of bitsOf(dom[v])) {
      const d2 = dom.slice(); d2[v] = 1 << p;
      dfs(d2);
      if (stopped || (limit > 0 && count >= limit)) return;
    }
  }

  dfs(dom0);
  const ms = performance.now() - t0;
  const outcome = stopped ? 'stopped' : (count === 0 ? 'none' : (count === 1 ? 'unique' : 'multiple'));
  return { outcome, count, nodes, ms, stopped, reason, exhausted: !stopped, branchNodes, leafInvalid, firstSolution: first };
}

/** 唯一性证明的唯一合法读法：stopped 一律为假，不看 count。 */
export function provesUnique(res) {
  return !res.stopped && res.exhausted && res.outcome === 'unique';
}

/** 裁判结论的人话版，门禁打印与 README 引用同一份文案。 */
export function outcomeText(res) {
  if (res.stopped) return `未证完（预算击穿：${res.reason}，${res.nodes} 节点 / ${res.ms.toFixed(3)} ms）`;
  if (res.outcome === 'none') return `无解（题面自相矛盾，${res.nodes} 节点）`;
  if (res.outcome === 'unique') return `唯一（${res.nodes} 节点 / ${res.ms.toFixed(3)} ms，分支节点 ${res.branchNodes}）`;
  return `至少 ${res.count} 个解（${res.nodes} 节点 / ${res.ms.toFixed(3)} ms）`;
}
