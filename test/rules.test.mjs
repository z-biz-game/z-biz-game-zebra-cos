// 规则模型的单位测试：每种线索类型的**真/假对照** + 盘面合法性 + 词汇恒等式。
//
// 与 tools/rule-test.mjs 的分工：那边是**门禁**（对着独立手写的 specClue 全量对表，
// 6 户所有掩码的支撑表都在内），这里是 `node --test` 的**最小可钉样例**，
// 让改引擎的人在不跑门禁的情况下也能立刻看见"哪句话的语义漂了"。
// 两边的 fixture 都是手搭的，不是生成器给的 —— 否则就是把出题器的 Bug 当标准答案。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUE_KINDS, NEGATED_KINDS, UNARY_KINDS,
  bitsOf, catOf, checkClueShape, checkSolution, describeClue, evalClue,
  fullMask, isLegalTruth, supports, truthSignature,
} from '../js/engine/rules.js';

// 手搭真值（N=3）：9 个物品，id = cat*3 + idx，truth[item] = 房子编号。
//   人：小明→0 小红→1 小刚→2      （物品 0,1,2）
//   颜色：红→1 蓝→2 绿→0          （物品 3,4,5）
//   宠物：狗→2 猫→0 鸟→1          （物品 6,7,8）
const N = 3;
const TRUTH = Int8Array.from([0, 1, 2, 1, 2, 0, 2, 0, 1]);

/** 把"两个物品住在 x/y 间"这件事搭成一个真值，用来单独看一条二元线索。 */
function pairTruth(x, y) {
  const t = new Int8Array(2);
  t[0] = x; t[1] = y;
  return t;
}

test('词汇表不多不少：11 条，且 at/not 是唯一的一元式', () => {
  assert.equal(CLUE_KINDS.length, 11);
  const sorted = (xs) => xs.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(sorted([...UNARY_KINDS]), sorted(['at', 'not']));
  assert.deepEqual(sorted([...NEGATED_KINDS]), sorted(['not', 'not_same', 'not_side_by_side']));
});

test('模型：真值合法 ⇔ 每个类别都是房子的一个排列', () => {
  assert.equal(isLegalTruth(TRUTH, N), true);
  assert.equal(isLegalTruth(Int8Array.from([0, 0, 2, 1, 2, 0, 2, 0, 1]), N), false, '同类别两物品占同一间');
  assert.equal(isLegalTruth(Int8Array.from([0, 1, 1, 1, 2, 0, 2, 0, 1]), N), false, '有房子没人');
  assert.equal(isLegalTruth(Int8Array.from([0, 1, 3, 1, 2, 0, 2, 0, 1]), N), false, '房子编号越界');
  assert.equal(fullMask(N), 0b111);
  assert.deepEqual(bitsOf(0b101), [0, 2]);
});

test('逐条线索类型的真/假对照（fixture 手搭，两端取自不同类别）', () => {
  const cases = [
    // [线索, 期望, 这一格在盯什么]
    [{ k: 'at', a: 0, p: 0 }, true, '小明住房 1'],
    [{ k: 'at', a: 0, p: 1 }, false, '同一条线索挪一间就假'],
    [{ k: 'not', a: 0, p: 1 }, true, '小明不住房 2'],
    [{ k: 'not', a: 0, p: 0 }, false, '不住自己那间 ⇒ 假'],
    [{ k: 'same', a: 0, b: 5 }, true, '小明与绿房子同房（都是 0）'],
    [{ k: 'same', a: 0, b: 3 }, false, '0 与 1 同房是假'],
    [{ k: 'not_same', a: 0, b: 3 }, true, '不同址'],
    [{ k: 'not_same', a: 0, b: 5 }, false, '同址时 not_same 必须假'],
    [{ k: 'direct_left', a: 0, b: 3 }, true, 'pos(b)==pos(a)+1：0→1'],
    [{ k: 'direct_left', a: 3, b: 0 }, false, '方向反过来 ⇒ 假（题面用观察者右手）'],
    [{ k: 'direct_right', a: 3, b: 0 }, true, 'pos(b)==pos(a)-1：1→0'],
    [{ k: 'direct_right', a: 0, b: 3 }, false, '反向 ⇒ 假'],
    [{ k: 'side_by_side', a: 0, b: 3 }, true, '|Δ|=1'],
    [{ k: 'side_by_side', a: 0, b: 7 }, false, '同址不是相邻'],
    [{ k: 'not_side_by_side', a: 0, b: 7 }, true, '选型屏的 |Δ|>1 在这一格写假：同址应当为真'],
    [{ k: 'not_side_by_side', a: 1, b: 3 }, true, '|Δ|=|1-1|=0 ⇒ 真'],
    [{ k: 'not_side_by_side', a: 0, b: 3 }, false, '相邻时否定式必须假'],
    [{ k: 'somewhere_left', a: 0, b: 6 }, true, '0 < 2'],
    [{ k: 'somewhere_left', a: 6, b: 0 }, false, '2 > 0'],
    [{ k: 'somewhere_right', a: 6, b: 0 }, true, 'pos(a) > pos(b)'],
    [{ k: 'somewhere_right', a: 0, b: 6 }, false, '反向'],
    [{ k: 'n_between', a: 0, b: 6, n: 1 }, true, '隔 1 间 ⇒ |Δ|=2'],
    [{ k: 'n_between', a: 0, b: 3, n: 1 }, false, '|Δ|=1 不是隔 1 间'],
    [{ k: 'n_between', a: 0, b: 3, n: 0 }, false, 'n=0 在 relOf 里会抛 ⇒ 用 try 分支另测'],
  ];
  for (const [clue, want, why] of cases) {
    if (clue.k === 'n_between' && clue.n === 0) {
      // 本地口径：n_between 只收 n>=1，n=0 是 side_by_side，不许两种写法同时存在。
      assert.throws(() => evalClue(clue, TRUTH), /n 必须是 >=1/, why);
      assert.ok(checkClueShape(clue, N), why);
      continue;
    }
    assert.equal(evalClue(clue, TRUTH), want, `${describeClue(clue, N)} —— ${why}`);
  }
});

test('二元线索两端不许同属一个类别（同类别的位置关系是规则本身，不是题面）', () => {
  assert.match(checkClueShape({ k: 'same', a: 0, b: 2 }, N), /同类别/);
  assert.equal(checkClueShape({ k: 'same', a: 0, b: 3 }, N), null);
  assert.match(checkClueShape({ k: 'at', a: 0, p: 9 }, N), /越界/);
  assert.match(checkClueShape({ k: 'n_between', a: 0, b: 6, n: 2 }, N), /无意义/, '3 户盘上最多隔 1 间');
});

test('词汇恒等式：direct 家族互逆、side_by_side 是两者之并、否定式恰是补', () => {
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    const t = pairTruth(x, y);
    const dl = evalClue({ k: 'direct_left', a: 0, b: 1 }, t);
    const dr = evalClue({ k: 'direct_right', a: 0, b: 1 }, t);
    const sb = evalClue({ k: 'side_by_side', a: 0, b: 1 }, t);
    assert.equal(dl, evalClue({ k: 'direct_right', a: 1, b: 0 }, t), 'direct_left(a,b) ⟺ direct_right(b,a)');
    assert.equal(sb, dl || dr, 'side_by_side ⟺ left ∨ right');
    assert.ok(!(dl && dr), '紧邻带向不可能同时左右');
    assert.equal(evalClue({ k: 'not_side_by_side', a: 0, b: 1 }, t), !sb, '否定式必须恰好是补');
    assert.equal(evalClue({ k: 'not_same', a: 0, b: 1 }, t), !evalClue({ k: 'same', a: 0, b: 1 }, t));
    const sl = evalClue({ k: 'somewhere_left', a: 0, b: 1 }, t);
    const sr = evalClue({ k: 'somewhere_right', a: 0, b: 1 }, t);
    assert.equal(sl !== sr, x !== y, '序关系：不同址恰有一真，同址两边都假');
    assert.ok(!(sl && sr), '不可能既左又右');
  }
});

test('支撑表：TA/TB 与 evalClue 在 N=3..6 全掩码上一致', () => {
  for (const n of [3, 4, 5, 6]) {
    const full = fullMask(n);
    for (let mask = 0; mask <= full; mask++) {
      const [ta, tb] = supports(n, 'side_by_side');
      for (let pa = 0; pa < n; pa++) {
        const has = (ta[mask] >> pa & 1) === 1;
        const real = bitsOf(mask).some((pb) => Math.abs(pa - pb) === 1);
        assert.equal(has, real, `N=${n} mask=${mask} pa=${pa}`);
        assert.equal((tb[mask] >> pa & 1) === 1, real, 'TB 与 TA 对称');
      }
    }
    // n_between 分桶：键不同 ⇒ 表不同
    assert.notDeepEqual(Array.from(supports(n, 'n_between|1')[0]), Array.from(supports(n, 'n_between|2')[0]));
  }
});

test('checkSolution：三种失败模式分别可辨', () => {
  const good = [{ k: 'at', a: 0, p: 0 }, { k: 'same', a: 0, b: 5 }];
  assert.equal(checkSolution(N, TRUTH, good).ok, true);

  const badTruth = checkSolution(N, Int8Array.from([0, 0, 2, 1, 2, 0, 2, 0, 1]), good);
  assert.equal(badTruth.ok, false);
  assert.match(badTruth.reasons[0], /真值不是合法盘/);

  const badClue = checkSolution(N, TRUTH, [{ k: 'at', a: 0, p: 2 }]);
  assert.equal(badClue.ok, false);
  assert.match(badClue.reasons[0], /为假/);

  const badShape = checkSolution(N, TRUTH, [{ k: 'same', a: 0, b: 2 }]);
  assert.equal(badShape.ok, false);
  assert.match(badShape.reasons[0], /同类别/);
});

test('文案与签名：同一句话在任意顺序下签名相同，换个物品就不同', () => {
  assert.equal(describeClue({ k: 'at', a: 6, p: 2 }, N), '宠物:狗 住在第 3 间');
  assert.equal(describeClue({ k: 'direct_left', a: 0, b: 3 }, N), '人:小明 在 颜色:红房子 的左边紧邻');
  assert.equal(catOf(7, N), 2);
  const A = [{ k: 'same', a: 0, b: 5 }, { k: 'at', a: 6, p: 2 }];
  const B = [{ k: 'at', a: 6, p: 2 }, { k: 'same', a: 0, b: 5 }];
  const sig = (clues) => clues.map((c) => `${c.k}|${c.a}|${c.b ?? -1}|${c.p ?? -1}`).sort().join(' ; ');
  assert.equal(sig(A), sig(B));
  assert.equal(truthSignature(TRUTH), truthSignature(Int8Array.from(TRUTH)));
  assert.notEqual(truthSignature(TRUTH), truthSignature(Int8Array.from([1, 0, 2, 1, 2, 0, 2, 0, 1])));
});
