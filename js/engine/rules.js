// 规则模型 · 谁养鱼 / ZEBRA（logic-grid，N 户 × M 类别的约束满足题）
//
// 题面（Life International 1962-12-17，经 Wikipedia "Zebra puzzle" 词条核对，访问日期 2026-09-28）：
//   街上排着 N 间房子，编号 1..N；每间房子在 M 个类别上各取一个值（人名/颜色/宠物/饮料/职业），
//   每个类别的 M 个值**恰好各用一次**；问"谁养鱼"。方向口径由题面钉死：
//   "right" 指**观察者**的右手边，不是住户的右手边 —— 所以 direct_left/`direct_right` 是两条
//   不同的线索，而不是同一条线索的两种读法。
//
// 本文件是"什么算一张合法盘"的**唯一定义**：计数器、独立见证计数器、铅笔求解器、出题器、
// 四套门禁全部从这里读规则。任何一处另写一份 `pos(a) === pos(b)` 都是未来的分歧源。
//
// 数据表示：
//   物品 id = cat * N + idx，cat∈[0,M) idx∈[0,M)；房子编号 house∈[0,N)（打印时 +1）。
//   一个"真值"就是一个 Int8Array：truth[item] = 该物品所在的房子。
//   合法 ⇔ 每个类别单独看都是 [0,N) 的一个排列（同类别不重复占房、也不漏房）。
//   跨类别之间**没有**"一户只能住一个物品"的约束：一户本来就要在每個类别上各取一值。
//   这条区分很重要：它是本盘和拉丁方的分界，也是 P2/P5 只在类别内成立的理由。
//
// 线索词汇表 = ZebraLogic（arXiv 2502.01100）那一套，不多不少：
//   at              FoundAt      pos(a) == p            "茶住在第 3 间"
//   not             NotAt        pos(a) != p
//   same            SameHouse    pos(a) == pos(b)       跨类别同位置
//   not_same                   pos(a) != pos(b)
//   direct_left                pos(b) == pos(a) + 1     紧邻且带向
//   direct_right               pos(b) == pos(a) - 1
//   side_by_side               |pos(a) - pos(b)| == 1   相邻不带向
//   not_side_by_side           |pos(a) - pos(b)| != 1   （恰是肯定式的补：同址也算"不相邻"）
//   somewhere_left             pos(a) <  pos(b)
//   somewhere_right            pos(a) >  pos(b)
//   n_between                  |pos(a) - pos(b)| == n+1 A、B 之间隔 n 间（n>=1，见下）
//
// n_between 只收 n>=1：n=0 就是 side_by_side，两条词汇重合会让"同一句话两种写法"变成
// 出题器里的重复线索，而重复线索在贪心删减里是免费的（删一条还剩一条），会污染" irreducible"
// 这个判据。这条口径是本地约定，不是 ZebraLogic 的原文。

/** 词汇表全集。rule-test 逐条真/假对照就是照这张表写的。 */
export const CLUE_KINDS = Object.freeze([
  'at', 'not', 'same', 'not_same',
  'direct_left', 'direct_right', 'side_by_side', 'not_side_by_side',
  'somewhere_left', 'somewhere_right', 'n_between',
]);
/** 一元线索（只点名一个物品 + 一个房子编号） */
export const UNARY_KINDS = new Set(['at', 'not']);
/** 否定式线索：出货盘里这类线索的占比是"像不像人写的题"的第一个读数 */
export const NEGATED_KINDS = new Set(['not', 'not_same', 'not_side_by_side']);

const BASE_REL = {
  same: (x, y) => x === y,
  not_same: (x, y) => x !== y,
  direct_left: (x, y) => y === x + 1,
  direct_right: (x, y) => y === x - 1,
  side_by_side: (x, y) => Math.abs(x - y) === 1,
  // 注意是 **!== 1** 而不是 > 1：否定式必须恰好是肯定式的补。
  // 选型屏写的是 `|Δ| > 1`（_tmp-zebra-screen.mjs 的 notnext），那在"两人住同一间"上取假，
  // 于是"A 和 B 不相邻"这句话在同址时反而不成立 —— rule-test 第 3 节（补集恒等式）就是抓它的。
  not_side_by_side: (x, y) => Math.abs(x - y) !== 1,
  somewhere_left: (x, y) => x < y,
  somewhere_right: (x, y) => x > y,
};

/** 一条线索在 (pa,pb) 上是否为真。n_between 的 relation 依赖 n，所以现场取。 */
export function relOf(clue) {
  if (clue.k === 'n_between') {
    if (!(Number.isInteger(clue.n) && clue.n >= 1)) throw new Error(`n_between 的 n 必须是 >=1 的整数，实得 ${clue.n}`);
    const gap = clue.n + 1;
    return (x, y) => Math.abs(x - y) === gap;
  }
  const f = BASE_REL[clue.k];
  if (!f) throw new Error(`未知线索类型 ${clue.k}`);
  return f;
}

/** 支撑表的键：n_between 按 n 分桶，别的按类型。同一张表被所有同键线索共用。 */
export function relKey(clue) {
  return clue.k === 'n_between' ? `n_between|${clue.n}` : clue.k;
}

// ── 支撑表：TA[key][maskB] = 在 maskB 里有支撑的 a 侧房子集合（TB 对称）────────────
// 为什么要预先摊成表而不是每次现算：P4/计数器每轮传播都要对每条二元线索做一次"求支撑"，
// 房子数 <=6，掩码只有 64 个，一次建表终身复用 —— 选型屏实测每张盘要跑 ~646 次裁判调用
// （_tmp-zebra-screen.mjs，2026-09-28 重跑），传播是这里面最热的循环。
const TABLES = new Map();
function buildTable(N, key) {
  const f = key.startsWith('n_between|') ? relOf({ k: 'n_between', n: Number(key.split('|')[1]) }) : relOf({ k: key });
  const size = 1 << N, ta = new Uint32Array(size), tb = new Uint32Array(size);
  for (let mask = 0; mask < size; mask++) {
    let a = 0, b = 0;
    for (let pa = 0; pa < N; pa++) for (let pb = 0; pb < N; pb++) {
      if (!f(pa, pb)) continue;
      if (mask & (1 << pb)) a |= 1 << pa;
      if (mask & (1 << pa)) b |= 1 << pb;
    }
    ta[mask] = a; tb[mask] = b;
  }
  return [ta, tb];
}
export function supports(N, key) {
  const id = `${N}|${key}`;
  let t = TABLES.get(id);
  if (!t) { t = buildTable(N, key); TABLES.set(id, t); }
  return t;
}

export const POP = new Uint8Array(64);
for (let m = 0; m < 64; m++) POP[m] = (m & 1) + POP[m >> 1];
export const bitsOf = (m) => { const o = []; for (let p = 0; p < 6; p++) if (m & (1 << p)) o.push(p); return o; };
export const fullMask = (N) => (1 << N) - 1;

/** 一条线索在给定真值下是否为真。所有实现（出题、裁判、见证、测试）都走这一个函数。 */
export function evalClue(clue, truth) {
  switch (clue.k) {
    case 'at': return truth[clue.a] === clue.p;
    case 'not': return truth[clue.a] !== clue.p;
    default: break;
  }
  if (UNARY_KINDS.has(clue.k)) throw new Error(`一元线索类型未处理：${clue.k}`);
  return relOf(clue)(truth[clue.a], truth[clue.b]);
}

// ── 盘面合法性 ────────────────────────────────────────────────────────────────
export const catOf = (item, N) => (item / N) | 0;
export const itemIds = (N) => Array.from({ length: N * N }, (_, i) => i);
export function catItems(c, N) { const a = []; for (let i = 0; i < N; i++) a.push(c * N + i); return a; }
export function catLists(N) { const cats = []; for (let c = 0; c < N; c++) cats.push(catItems(c, N)); return cats; }

/** 真值本身是否是一张合法盘：每个类别恰好是房子编号的一个排列。 */
export function isLegalTruth(truth, N) {
  if (!truth || truth.length !== N * N) return false;
  for (let c = 0; c < N; c++) {
    let seen = 0;
    for (let i = 0; i < N; i++) {
      const p = truth[c * N + i];
      if (!(p >= 0 && p < N)) return false;
      const bit = 1 << p;
      if (seen & bit) return false;      // 两个同类物品占同一间 ⇒ 非法
      seen |= bit;
    }
    if (seen !== fullMask(N)) return false; // 有房子空着 ⇒ 非法
  }
  return true;
}

/** 单条线索的结构合法性：跨类别（same 家族不许同类别）、房子编号在盘内。 */
export function checkClueShape(clue, N) {
  if (!CLUE_KINDS.includes(clue.k)) return `未知线索类型 ${clue.k}`;
  if (!(clue.a >= 0 && clue.a < N * N)) return `线索物品 a=${clue.a} 越界`;
  if (UNARY_KINDS.has(clue.k)) {
    if (!(clue.p >= 0 && clue.p < N)) return `线索房子 p=${clue.p} 越界`;
    return null;
  }
  if (!(clue.b >= 0 && clue.b < N * N)) return `线索物品 b=${clue.b} 越界`;
  if (catOf(clue.a, N) === catOf(clue.b, N)) return `二元线索两端同属类别 ${catOf(clue.a, N)}（同类别的位置关系由规则本身决定，题面不会这样写）`;
  if (clue.k === 'n_between' && !(Number.isInteger(clue.n) && clue.n >= 1 && clue.n <= N - 2)) return `n_between 的 n=${clue.n} 在 ${N} 户盘上无意义`;
  return null;
}

/**
 * "这组线索的唯一解是不是它" 的**最低门槛**：真值合法 + 每条线索为真。
 * 唯一性不在这里，那是 counter.js 的活；本函数抓的是"出货的盘连自己的答案都不满足题面"
 * 这种 generator bug —— 选型屏用同一条检查在 600 张盘上抓到 0 次（2026-09-28 重跑），
 * 门槛留着的理由正是"下一次未必是 0"。
 */
export function checkSolution(N, truth, clues) {
  const reasons = [];
  if (!isLegalTruth(truth, N)) reasons.push('真值不是合法盘（类别内出现重复或漏房）');
  for (let i = 0; i < clues.length; i++) {
    const bad = checkClueShape(clues[i], N);
    if (bad) { reasons.push(`线索 ${i}: ${bad}`); continue; }
    if (!evalClue(clues[i], truth)) reasons.push(`线索 ${i} 在真值上为假: ${describeClue(clues[i], N)}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// ── 题面文案（M 个类别的物品名，谁养鱼的标准五类）──────────────────────────────
export const CATALOG = Object.freeze([
  ['小明', '小红', '小刚', '小美', '小强', '小林'],
  ['红房子', '蓝房子', '绿房子', '黄房子', '白房子', '紫房子'],
  ['狗', '猫', '鸟', '鱼', '兔', '龟'],
  ['茶', '牛奶', '汽水', '果汁', '咖啡', '豆浆'],
  ['教师', '医生', '律师', '司机', '厨师', '画家'],
  ['钢琴', '围棋', '书法', '篮球', '摄影', '园艺'],
]);
/** 类别短名：线索文案里用 "宠物:鱼"，用不了整行中文长句的场合（网格表头）用它。 */
export const CAT_SHORT = ['人', '颜色', '宠物', '饮料', '职业', '爱好'];

export const labelOf = (item, N) => `${CAT_SHORT[catOf(item, N)]}:${CATALOG[catOf(item, N)][item % N]}`;

/** 线索的中文读法。rule-test 的每条断言都带这个串，红了能直接看懂是哪句话。 */
export function describeClue(clue, N) {
  const A = labelOf(clue.a, N);
  if (clue.k === 'at') return `${A} 住在第 ${clue.p + 1} 间`;
  if (clue.k === 'not') return `${A} 不住在第 ${clue.p + 1} 间`;
  const B = labelOf(clue.b, N);
  switch (clue.k) {
    case 'same': return `${A} 和 ${B} 住同一间`;
    case 'not_same': return `${A} 和 ${B} 不住同一间`;
    case 'direct_left': return `${A} 在 ${B} 的左边紧邻`;
    case 'direct_right': return `${A} 在 ${B} 的右边紧邻`;
    case 'side_by_side': return `${A} 和 ${B} 相邻`;
    case 'not_side_by_side': return `${A} 和 ${B} 不相邻`;
    case 'somewhere_left': return `${A} 在 ${B} 的左边（未必紧邻）`;
    case 'somewhere_right': return `${A} 在 ${B} 的右边（未必紧邻）`;
    case 'n_between': return `${A} 和 ${B} 之间隔着 ${clue.n} 间`;
    default: throw new Error(`未知线索类型 ${clue.k}`);
  }
}

/** 线索集合的稳定签名（与插入顺序无关），用于断言"两条路径给出同一份题面"。 */
export function clueSignature(clues, N) {
  return clues.map((c) => `${c.k}|${c.a}|${c.b ?? -1}|${c.p ?? -1}|${c.n ?? -1}`).sort().join(' ; ');
}

/** 真值的稳定签名，用于跨进程复现断言。 */
export function truthSignature(truth) {
  return Array.from(truth, (x) => x.toString(16)).join('');
}
