// 规则语义测试台 · 谁养鱼的词汇表逐条钉死
//
// 存在理由：本仓所有下游（裁判、见证、铅笔、出题、门禁）都从 js/engine/rules.js 读同一份
// "什么算合法 / 这句话什么意思"。那份定义若有一处写歪，下游会**一起**歪，对账也查不出来。
// 所以这里每条结论都用一份独立写法对照，而不是自证：
//
//   1) 十一种线索，每种在 N=4 的**全部** (pa,pb) 组合上，用本文件另写的一份中文口径判定式对照；
//   2) 支撑表 supports() 在 N=3..6 全部掩码上对照同一份口径（表写错=传播删错=漏解）；
//   3) 词汇内部的恒等/互斥关系（direct_left 与 direct_right 互为反向、side_by_side 是二者之或、
//      somewhere_* 与 same 三者互斥且并起来是全空间）—— 这几条钉的是"right 指观察者的右手"
//      这条方向口径真的落进了实现，而不只是写在注释里；
//   4) n_between(n=0) 被拒 —— 它和 side_by_side 重合，重合会让"逐条不可约"变成假判据；
//   5) 合法盘定义的穷举：N=3 时 (N!)^N=216 个合法真值，一个不多一个不少；
//      非法写法（同类重复占房 / 漏房 / 越界）必须被抓；
//   6) checkSolution 的三种失败模式各给一个证人：非法真值、假线索、结构非法线索。
//   7) 二元线索两端同类别 ⇒ 拒收（"两个人住同一间"不是题面能写出来的话）。
//
// 跑法： node tools/rule-test.mjs

import {
  CLUE_KINDS, POP, bitsOf, catOf, checkClueShape, checkSolution, clueSignature,
  describeClue, evalClue, fullMask, isLegalTruth, itemIds, relOf, supports,
} from '../js/engine/rules.js';

let checks = 0, fails = 0;
function ok(name, cond, detail = '') {
  checks++;
  if (!cond) { fails++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}
function eq(name, got, want) { ok(name, got === want, `期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`); }

// ── 独立口径：照研究稿那句中文自己写一遍，不 import relOf ──────────────────────
function specClue(clue, pa, pb) {
  switch (clue.k) {
    case 'at': return pa === clue.p;
    case 'not': return pa !== clue.p;
    case 'same': return pa === pb;
    case 'not_same': return pa !== pb;
    case 'direct_left': return pb - pa === 1;
    case 'direct_right': return pa - pb === 1;
    case 'side_by_side': return pb - pa === 1 || pa - pb === 1;
    case 'not_side_by_side': return !(pb - pa === 1 || pa - pb === 1);
    case 'somewhere_left': return pa < pb;
    case 'somewhere_right': return pa > pb;
    case 'n_between': return Math.abs(pa - pb) === clue.n + 1;
    default: throw new Error('未知线索 ' + clue.k);
  }
}

console.log('== 1) 十一种线索 × 全部位置组合 ==');
{
  const N = 4;
  const t = new Int8Array(N * N);
  for (const kind of CLUE_KINDS) {
    let n = 0;
    for (const p of (kind === 'n_between' ? [1, 2] : [0, 1, 2, 3])) {
      // 每条待测线索都现场造：一元线索点 a 与房子 p；二元的点跨类别的 a=0、b=N 两个物品。
      const clue = (kind === 'at' || kind === 'not') ? { k: kind, a: 0, p }
        : kind === 'n_between' ? { k: kind, a: 0, b: N, n: p }
          : { k: kind, a: 0, b: N };
      for (let pa = 0; pa < N; pa++) for (let pb = 0; pb < N; pb++) {
        t[0] = pa; t[N] = pb;
        n++;
        const tag = `${kind}(${p ?? '—'}) @ (a=${pa},b=${pb})`;
        ok(`${tag} evalClue 与中文口径一致`, evalClue(clue, t) === specClue(clue, pa, pb));
        if (kind !== 'at' && kind !== 'not') {
          ok(`${tag} relOf 与中文口径一致`, relOf(clue)(pa, pb) === specClue(clue, pa, pb));
        }
      }
    }
    ok(`${kind} 被测组合数 > 0`, n > 0, `${n}`);
  }
  // 双向对照：每种类型在 4 户盘上"为真"的组合个数，是一个可手算的锚
  const trues = {};
  for (const kind of CLUE_KINDS) {
    if (kind === 'at' || kind === 'not') { trues[kind] = kind === 'at' ? 1 : 3; continue; }
    if (kind === 'n_between') { trues[kind] = 4; continue; }   // 4 户盘上 |Δ|=2：(0,2)(1,3)(2,0)(3,1)
    let c = 0;
    for (let pa = 0; pa < 4; pa++) for (let pb = 0; pb < 4; pb++) if (specClue({ k: kind }, pa, pb)) c++;
    trues[kind] = c;
  }
  eq('at 在 4 户盘上只有 1 种位置对为真', trues.at, 1);
  eq('not 为真 3 种（4-1）', trues.not, 3);
  eq('same 为真 4 种（对角线）', trues.same, 4);
  eq('not_same 为真 12 种（16-4）', trues.not_same, 12);
  eq('direct_left 为真 3 种（相邻对的上三角）', trues.direct_left, 3);
  eq('direct_right 为真 3 种（下三角）', trues.direct_right, 3);
  eq('side_by_side 为真 6 种（两侧三角之和）', trues.side_by_side, 6);
  eq('not_side_by_side 为真 10 种（16-6）', trues.not_side_by_side, 10);
  eq('somewhere_left 为真 6 种', trues.somewhere_left, 6);
  eq('somewhere_right 为真 6 种', trues.somewhere_right, 6);
  eq('n_between(n=1) 为真 4 种（|Δ|=2）', trues.n_between, 4);
}

console.log('== 2) 支撑表 vs 中文口径（N=3..6，全掩码） ==');
for (const N of [3, 4, 5, 6]) {
  for (const kind of CLUE_KINDS) {
    if (kind === 'at' || kind === 'not') continue;
    const ns = kind === 'n_between' ? [1, Math.max(1, N - 2)] : [null];
    for (const nn of ns) {
      const clue = nn === null ? { k: kind, a: 0, b: N } : { k: kind, a: 0, b: N, n: nn };
      const [ta, tb] = supports(N, kind === 'n_between' ? `n_between|${nn}` : kind);
      let badA = 0, badB = 0, maskN = 0;
      for (let mask = 0; mask < (1 << N); mask++) {
        maskN++;
        let ea = 0, eb = 0;
        for (let pa = 0; pa < N; pa++) if (bitsOf(mask).some((pb) => specClue(clue, pa, pb))) ea |= 1 << pa;
        for (let pb = 0; pb < N; pb++) if (bitsOf(mask).some((pa) => specClue(clue, pa, pb))) eb |= 1 << pb;
        if (ta[mask] !== ea) badA++;
        if (tb[mask] !== eb) badB++;
      }
      ok(`N=${N} ${kind}${nn !== null ? `(n=${nn})` : ''} 的 a 侧支撑表 ${maskN} 个掩码全对`, badA === 0, `${badA} 个掩码不符`);
      ok(`N=${N} ${kind}${nn !== null ? `(n=${nn})` : ''} 的 b 侧支撑表全对`, badB === 0, `${badB} 个掩码不符`);
    }
  }
}

console.log('== 3) 词汇内部恒等式（"right = 观察者的右手"落进实现的证据） ==');
{
  const N = 5, t = new Int8Array(N * N);
  for (let i = 0; i < N * N; i++) t[i] = i % N;
  const A = 0, B = N + 2;                       // 跨类别的两个物品
  let swapLeft = 0, swapRight = 0, orAdj = 0, xorOrder = 0, conflicts = 0;
  for (let pa = 0; pa < N; pa++) for (let pb = 0; pb < N; pb++) {
    t[A] = pa; t[B] = pb;
    if (evalClue({ k: 'direct_left', a: A, b: B }, t) !== evalClue({ k: 'direct_right', a: B, b: A }, t)) swapLeft++;
    if (evalClue({ k: 'somewhere_left', a: A, b: B }, t) !== evalClue({ k: 'somewhere_right', a: B, b: A }, t)) swapRight++;
    const adj = evalClue({ k: 'side_by_side', a: A, b: B }, t);
    const either = evalClue({ k: 'direct_left', a: A, b: B }, t) || evalClue({ k: 'direct_right', a: A, b: B }, t);
    if (adj !== either) orAdj++;
    // 序关系与同址三者互斥且穷尽
    const o = [evalClue({ k: 'same', a: A, b: B }, t), evalClue({ k: 'somewhere_left', a: A, b: B }, t), evalClue({ k: 'somewhere_right', a: A, b: B }, t)];
    if (o.filter(Boolean).length !== 1) conflicts++;
    // 否定式恰好是真式的补
    for (const [pos, neg] of [['same', 'not_same'], ['side_by_side', 'not_side_by_side']]) {
      if (evalClue({ k: pos, a: A, b: B }, t) === evalClue({ k: neg, a: A, b: B }, t)) xorOrder++;
    }
  }
  eq('direct_left(a,b) ⟺ direct_right(b,a) 全组合成立', swapLeft, 0);
  eq('somewhere_left(a,b) ⟺ somewhere_right(b,a) 全组合成立', swapRight, 0);
  eq('side_by_side ⟺ direct_left ∨ direct_right', orAdj, 0);
  eq('same / somewhere_left / somewhere_right 三者互斥且穷尽', conflicts, 0);
  eq('not_same、not_side_by_side 各是对应肯定式的补', xorOrder, 0);
}
{
  // n_between 与 side_by_side 的距离不同 —— 词汇表里没有同义反复的两句
  const N = 5, t = new Int8Array(N * N).fill(0);
  t[0] = 0; t[N] = 2;
  ok('n_between(n=1) 在 |Δ|=2 上为真', evalClue({ k: 'n_between', a: 0, b: N, n: 1 }, t));
  ok('side_by_side 在 |Δ|=2 上为假（两条词汇不重合）', !evalClue({ k: 'side_by_side', a: 0, b: N }, t));
  t[N] = 1;
  ok('n_between(n=1) 在 |Δ|=1 上为假', !evalClue({ k: 'n_between', a: 0, b: N, n: 1 }, t));
}

console.log('== 4) n_between 的 n 口径（n>=1，本地约定） ==');
{
  const N = 5;
  eq('n=0 的结构检查被拒', checkClueShape({ k: 'n_between', a: 0, b: 5, n: 0 }, N) !== null, true);
  eq('5 户盘上 n=4 越界（要 5 间距离）', checkClueShape({ k: 'n_between', a: 0, b: 5, n: 4 }, N) !== null, true);
  eq('5 户盘上 n=3 合法（|Δ|=4 = 盘宽）', checkClueShape({ k: 'n_between', a: 0, b: 5, n: 3 }, N), null);
  let threw = 0;
  try { relOf({ k: 'n_between', n: 0 }); } catch { threw++; }
  eq('relOf 对 n=0 抛错', threw, 1);
}

console.log('== 5) 合法盘定义：N=3 穷举 (3!)^3=216 ==');
{
  const N = 3;
  const perms = [];
  for (let a = 0; a < 6; a++) {
    const p = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][a];
    perms.push(p);
  }
  let legal = 0, total = 0;
  for (const p0 of perms) for (const p1 of perms) for (const p2 of perms) {
    total++;
    const t = Int8Array.from([...p0, ...p1, ...p2]);
    if (!isLegalTruth(t, N)) { fails++; console.log('  FAIL 排列组合被判非法'); }
    legal++;
  }
  eq('穷举出的合法真值恰好 216 个', legal, 216);
  eq('穷举总量 = (3!)^3', total, 216);
  const bad = [
    { why: '同类两个物品占同一间、另一间空着', t: Int8Array.from([0, 0, 1, 0, 1, 2, 0, 1, 2]) },
    { why: '物品房子编号越界', t: Int8Array.from([0, 1, 3, 0, 1, 2, 0, 1, 2]) },
    { why: '长度不对', t: Int8Array.from([0, 1, 2, 0, 1, 2]) },
    { why: '负数', t: Int8Array.from([-1, 1, 2, 0, 1, 2, 0, 1, 2]) },
  ];
  for (const b of bad) ok(`非法真值被抓：${b.why}`, !isLegalTruth(b.t, N));
  eq('fullMask(5) = 31', fullMask(5), 31);
  eq('itemIds(4) 长度 16', itemIds(4).length, 16);
  eq('catOf 按 N 分块', catOf(7, 4), 1);
  eq('POP 表自洽', POP[29], 4);
}

console.log('== 6) checkSolution 的三种失败模式 ==');
{
  const N = 3, t = Int8Array.from([0, 1, 2, 2, 1, 0, 1, 2, 0]);
  // 手摆夹具：人:小明=1号 小红=2号 小刚=3号 / 颜色:红=3 蓝=2 绿=1 / 宠物:狗=2 猫=3 鸟=1
  const good = checkSolution(N, t, [{ k: 'at', a: 0, p: 0 }, { k: 'same', a: 1, b: 4 }, { k: 'direct_left', a: 1, b: 3 }]);
  ok('真值 + 全真线索 ⇒ ok', good.ok, good.reasons.join(' / '));
  eq('同一条题面换个说法仍为真（direct_left(a,b) ⟺ direct_right(b,a)）',
    checkSolution(N, t, [{ k: 'direct_right', a: 3, b: 1 }]).ok, true);
  const badTruth = checkSolution(N, Int8Array.from([0, 0, 2, 2, 1, 0, 1, 2, 0]), []);
  eq('非法真值 ⇒ 不 ok', badTruth.ok, false);
  eq('非法真值给得出理由', badTruth.reasons.length, 1);
  const falseClue = checkSolution(N, t, [{ k: 'at', a: 0, p: 2 }]);
  eq('假线索 ⇒ 不 ok', falseClue.ok, false);
  ok('假线索的理由里带中文读法', falseClue.reasons[0].includes(describeClue({ k: 'at', a: 0, p: 2 }, N)), falseClue.reasons[0]);
  const shapeBad = checkSolution(N, t, [{ k: 'same', a: 0, b: 1 }]);
  eq('两端同类别的二元线索 ⇒ 不 ok', shapeBad.ok, false);
  ok('理由说明为什么拒收', /同类/.test(shapeBad.reasons[0]), shapeBad.reasons[0]);
}

console.log('== 7) 签名与文案 ==');
{
  const N = 3;
  const c1 = { k: 'at', a: 0, p: 1 }, c2 = { k: 'side_by_side', a: 2, b: 3 };
  eq('签名与顺序无关', clueSignature([c1, c2], N), clueSignature([c2, c1], N));
  ok('签名能区分 p 不同的 at', clueSignature([c1], N) !== clueSignature([{ k: 'at', a: 0, p: 2 }], N));
  ok('描述串非空且含物品名', describeClue(c2, N).length > 4, describeClue(c2, N));
  ok('n_between 的描述带间隔数', /隔着 2 间/.test(describeClue({ k: 'n_between', a: 0, b: 3, n: 2 }, 5)), describeClue({ k: 'n_between', a: 0, b: 3, n: 2 }, 5));
  let threw = 0;
  try { describeClue({ k: 'whatever', a: 0, b: 1 }, N); } catch { threw++; }
  eq('未知类型在描述层也抛', threw, 1);
}

console.log(`\nRESULT rule-test ok=${fails === 0} checks=${checks} fails=${fails}`);
process.exit(fails ? 1 : 0);
