// 铅笔求解器 · 只用人能命名的局部推理，**不允许分支**
//
// 和裁判的分工：裁判准猜（挑一个物品试一个房子，错了回溯），人不准。人只准对着已经写下的
// 结论说"这一格**必须**是谁 / 不可能是谁"，并且每一步都讲得出名字。所以本文件里没有 DFS、
// 没有回溯、没有"先假设一个填上再看"。唯一的例外是 P8，它是**支撑检验**而不是承诺：
// 假设只在函数内部活一瞬，用完即弃，绝不写回盘面（pencil-test 有一节专门钉这条）。
//
// 三条义务（不是装饰）：
//   1. 出货的盘必须能被本通道从空盘推完 —— 那才是"零猜测"在产品里的实际含义。
//      这是**选取**而不是愿景：generate.js 推不完的盘直接丢回去重抽。
//   2. 本通道比裁判**弱**是设计目标。强弱差就是难度分数：选型屏在不可约唯一盘上实测
//      3 类 128/200、4 类 47/200、5 类 10/200（2026-09-28 重跑），也就是说这一族规则
//      在这道题上是**有选择性**的闸，而不是走个形式。
//   3. 每一步结论必须**为真**。规则写错的方向只准是"弱"，不准是"错"：
//      任何一条铅笔结论和真值冲突，pencil-test 直接红（auditAgainst 就是给它用的）。
//
// ── 规则清单（先写全再实现）────────────────────────────────────────────
// 状态：dom[item] = 该物品还能住哪几间（掩码）。全集 = 盘上所有房子。
// P1 点名消元     at(a,p) ⇒ dom(a):={p}；not(a,p) ⇒ dom(a) 去掉 p。
// P2 同类互斥     某物品定在 p ⇒ p 从**同类别**其余物品手里收走（题面"每类各用一次"）。
// P3 锚定转移     二元线索有一端已定 ⇒ 另一端按该关系的像收窄。
//                 same ⇒ 同点；direct_left/right ⇒ 移一格；side_by_side ⇒ 只剩两侧；
//                 somewhere_* ⇒ 严格不等；n_between ⇒ 只剩距离 n+1 的那（两）点。
// P4 关系弧一致   两端都没定时，一个房子留着当且仅当对侧还有房子能和它凑成该关系。
//                 这条覆盖"相邻对不能贴边""序关系不能占满"这类一眼排除。
// P5 房位容量     类别 C 的第 p 间若只剩一个物品还够得着 ⇒ 就是它（横向的 hidden single）。
//                 注意这是**存在性**规则而不是支撑规则：加一条线索可能把那个唯一够得着的物品
//                 也划掉，从而**撤销**整条连锁。选型屏因此在 4×4、5×5 各测到 1/360 次
//                 "线索更多反而推不完"的台阶倒退（2026-09-28 重跑），
//                 所以难度档不按原始线索数排 —— 见 tools/balance.mjs 的台阶一节。
// P6 显性数组     类别 C 里 k 个物品（2<=k<=N-1）的候选房子并集恰好 k 间 ⇒ 这 k 间被这批物品
//                 承包，同类其余物品全部退出。（naked pair / naked triple 的统称。）
// P7 隐性数组     类别 C 里 k 间房子（2<=k<=N-1）只够得着 k 个物品 ⇒ 这 k 个物品只准留在这
//                 k 间。（hidden pair / hidden triple。P6、P7 都是 all-different 的 Hall 定理
//                 特例，人脑里就是"这几间必须是这几个，别想"。）
// P8 跨类占位检验 假设物品 A 住第 h 间（只在函数内部），按 P2/P3 把与 A 有线索的物品收窄，
//                 再逐类别检查"这类物品能不能一一对上不同的房子"（Hall/SDR）。
//                 对不上 ⇒ h 根本不是 A 的解 ⇒ 划掉。这是**跨类别**规则：单看一条线索谁都推不出，
//                 人靠的是"若老师住 2 号，颜色类就没人能住 3 号，可 3 号必须有颜色"这种话。
//                 它是支撑检验而不是猜测：假设从不写回 dom，推出的结论只是"某值无支撑"，
//                 与 P4 同性质，所以仍然满足"每一步都讲得出理由"。
//
// 档位：BASIC = P1..P5（休闲玩家的配置），FULL = P1..P8（出货口径）。
// 每次删除只记到**一条**规则名下，于是"这张盘是靠哪条规则推完的"是一个读数而不是感觉。
// ────────────────────────────────────────────────────────────────────────

import { POP, UNARY_KINDS, bitsOf, catLists, catOf, fullMask, relKey, supports } from './rules.js';

export const RULE_ORDER = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
export const RULE_DOC = Object.freeze({
  P1: '点名消元（at / not）',
  P2: '同类互斥（类别内 all-different 定值传播）',
  P3: '锚定转移（二元线索的一端已定）',
  P4: '关系弧一致（两端未定的支撑过滤）',
  P5: '房位容量（某类别某房只剩一个够得着的物品）',
  P6: '显性数组（k 个物品只占 k 间 ⇒ 承包）',
  P7: '隐性数组（k 间只有 k 个物品够得着 ⇒ 锁死）',
  P8: '跨类占位检验（假设 + 逐类别匹配支撑，假设不落盘）',
});
export const BASIC_RULES = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5']);
export const FULL_RULES = RULE_ORDER;

/** 类别内的二分图匹配（物品 → 房子），N<=6，DFS 增广就够，不引外部实现。 */
function hasSDR(items, dom) {
  const matchedTo = new Map();          // house -> item
  const take = (v, seen) => {
    for (const p of bitsOf(dom[v])) {
      if (seen & (1 << p)) continue;
      const nextSeen = seen | (1 << p);
      const other = matchedTo.get(p);
      if (other === undefined || take(other, nextSeen)) { matchedTo.set(p, v); return true; }
    }
    return false;
  };
  for (const v of items) if (!take(v, 0)) return false;
  return true;
}

/**
 * 铅笔求解。
 * @param N 类别数/房子数
 * @param clues 题面
 * @param opts {rules=BASIC..FULL 的子集}
 * @returns {dom, solved, dead, undecided, fire, rounds, used}
 *   dead=true 表示推出矛盾（题面本身无解）—— 对唯一盘不可能出现，出现即 generator bug。
 */
export function solve(N, clues, opts = {}) {
  const rules = opts.rules || FULL_RULES;
  const on = (r) => rules.includes(r);
  const FULL = fullMask(N), n = N * N;
  const cats = catLists(N);
  const dom = new Uint32Array(n).fill(FULL);
  const fire = Object.fromEntries(RULE_ORDER.map((r) => [r, 0]));
  let dead = false;

  // 一次删除：记在规则名下。删空 ⇒ 矛盾。
  function cut(v, nd, rule) {
    nd &= FULL;
    if (dead || nd === dom[v]) return;
    if (!nd) { dead = true; fire[rule] += POP[dom[v]]; return; }
    fire[rule] += POP[dom[v] & ~nd];
    dom[v] = nd;
  }

  // P1：一元线索开局就吃完（它不需要任何推理，是题面直接给的）
  if (on('P1')) for (const c of clues) {
    if (c.k === 'at') cut(c.a, 1 << c.p, 'P1');
    else if (c.k === 'not') cut(c.a, ~(1 << c.p), 'P1');
  }

  const bin = [];
  for (const c of clues) {
    if (UNARY_KINDS.has(c.k)) continue;
    bin.push({ c, key: relKey(c), t: supports(N, relKey(c)) });
  }

  let rounds = 0;
  while (!dead) {
    if (++rounds > 200) break;            // 防御：每轮至少删一位，最多删 N*N 次，200 是保险丝
    const before = dom.slice();

    // P3 / P4：一条线索两端各看一次，另一端已定 ⇒ P3，否则 P4
    for (const { c, key, t } of bin) {
      const [ta, tb] = t;
      const aPinned = POP[dom[c.a]] === 1, bPinned = POP[dom[c.b]] === 1;
      if (bPinned && !on('P3')) continue;
      if (!bPinned && !on('P4')) continue;
      cut(c.a, dom[c.a] & ta[dom[c.b]], bPinned ? 'P3' : 'P4');
      if (dead) break;
      const nowPinned = POP[dom[c.a]] === 1;
      if (nowPinned && !on('P3')) continue;
      if (!nowPinned && !on('P4')) continue;
      cut(c.b, dom[c.b] & tb[dom[c.a]], nowPinned ? 'P3' : 'P4');
      if (dead) break;
    }
    if (dead) break;

    // P2 / P5：类别内定值传播 + 房位容量
    for (const items of cats) {
      for (;;) {
        let local = false, used = 0;
        for (const v of items) if (POP[dom[v]] === 1) used |= dom[v];
        if (on('P2')) for (const v of items) {
          if (POP[dom[v]] === 1) continue;
          cut(v, dom[v] & ~used, 'P2');
          if (dead) break;
        }
        if (dead) break;
        if (on('P5')) for (let p = 0; p < N; p++) {
          const bit = 1 << p;
          let holder = -1, k = 0;
          for (const v of items) if (dom[v] & bit) { holder = v; k++; if (k > 1) break; }
          if (k === 0) { dead = true; break; }
          if (k === 1 && POP[dom[holder]] > 1) { cut(holder, bit, 'P5'); local = true; }
        }
        if (dead || !local) break;
      }
      if (dead) break;
    }
    if (dead) break;

    // P6 / P7：类别内的 Hall 组（显性/隐性数组）
    if (on('P6') || on('P7')) {
      for (const items of cats) {
        const top = 1 << items.length;
        for (let m = 1; m < top; m++) {
          const cnt = POP[m];
          if (cnt < 2 || cnt > N - 1) continue;
          let union = 0, any = false;
          for (let j = 0; j < items.length; j++) if (m & (1 << j)) { union |= dom[items[j]]; any = true; }
          if (on('P6') && any && POP[union] === cnt) {
            for (let j = 0; j < items.length; j++) if (!(m & (1 << j))) cut(items[j], dom[items[j]] & ~union, 'P6');
            if (dead) break;
          }
        }
        if (dead) break;
        const htop = 1 << N;
        for (let u = 1; u < htop; u++) {
          const cnt = POP[u];
          if (cnt < 2 || cnt > N - 1) continue;
          const holders = items.filter((v) => dom[v] & u);
          if (holders.length === cnt && on('P7')) {
            for (const v of holders) cut(v, dom[v] & u, 'P7');
            if (dead) break;
          }
        }
        if (dead) break;
      }
    }
    if (dead) break;

    // P8：跨类占位检验。**只在弱规则已经推不动的那一轮**跑（代价最高的规则最后上）：
    // 域只会越缩越小、支撑只会越来越少，所以推迟到 P1..P7 的不动点之后再跑不比每轮都跑弱，
    // 而"这张盘非得上到 P8 才推得完"因此成为一个干净的读数而不是噪声。
    let stalled = true;
    for (let i = 0; i < n; i++) if (dom[i] !== before[i]) { stalled = false; break; }
    if (on('P8') && stalled) {
      outer: for (let v = 0; v < n; v++) {
        if (POP[dom[v]] <= 1) continue;
        for (const h of bitsOf(dom[v])) {
          const probe = dom.slice();
          probe[v] = 1 << h;
          let bad = false;
          // 假设"A 住第 h 间"只收得掉 **A 自己类别** 里别的物品对 h 的申请：
          // 一户本来就要在每个类别上各取一值，别的类别照样可以有人住 h。
          // 写成"收掉所有类别的 h"是这里第一版踩到的坑（pencil-test 第 3 节当场抓到 102 次
          // 误报矛盾），它会把有解的盘判成无解 —— 方向正是最危险的那种错（不是弱，是错）。
          for (const x of cats[catOf(v, N)]) if (x !== v && (probe[x] & (1 << h))) probe[x] &= ~(1 << h);
          for (const { c, t } of bin) {
            if (c.a !== v && c.b !== v) continue;
            const [ta, tb] = t;
            const other = c.a === v ? c.b : c.a;
            const img = c.a === v ? tb[1 << h] : ta[1 << h];
            probe[other] &= img;
          }
          for (const items of cats) {
            for (const x of items) if (!probe[x]) { bad = true; break; }
            if (bad) break;
            if (!hasSDR(items, probe)) { bad = true; break; }
          }
          if (bad) { cut(v, dom[v] & ~(1 << h), 'P8'); if (dead) break outer; }
        }
      }
    }
    if (dead) break;

    let changed = false;
    for (let i = 0; i < n; i++) if (dom[i] !== before[i]) { changed = true; break; }
    if (!changed) break;
  }

  let undecided = 0;
  for (let i = 0; i < n; i++) if (POP[dom[i]] !== 1) undecided++;
  return { dom, solved: !dead && undecided === 0, dead, undecided, fire, rounds, used: rules.join('+') };
}

/**
 * 真值审计：铅笔推出的**每一个**定值结论都必须等于真值。
 * 这是 soundness 的落点。返回冲突列表（必须为空数组）。
 * 注意它不检查"没推出来的东西"——弱不是错，错才是红。
 */
export function auditAgainst(N, res, truth) {
  const wrong = [];
  for (let i = 0; i < N * N; i++) {
    if (POP[res.dom[i]] === 1) {
      const p = bitsOf(res.dom[i])[0];
      if (p !== truth[i]) wrong.push({ item: i, pencil: p, truth: truth[i] });
    }
  }
  return wrong;
}

/** 下一步棋的人话版：铅笔在已推结论上给出的"下一个可定值"，供提示系统用（阶段二）。 */
export function nextForced(N, clues) {
  const res = solve(N, clues);
  const out = [];
  for (let i = 0; i < N * N; i++) if (POP[res.dom[i]] === 1) out.push({ item: i, p: res.dom[i] });
  return out;
}
