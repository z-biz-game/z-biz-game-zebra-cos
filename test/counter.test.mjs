// 裁判（允许搜索的那条通道）的行为测试：三态出口、stopped 语义、limitSolutions 口径、
// 以及和独立见证（不做传播）在同一批盘上的对账。
//
// 这一套的存在理由：**stopped 绝不能被读成 unique**。选型屏上 600 张盘 0 次击穿
// （_tmp-zebra-screen.mjs，2026-09-28 重跑），所以击穿不是预期事件 —— 一旦引擎改成
// "预算掐断也返回 count=1"，本文件立刻红。

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSolution, evalClue, truthSignature } from '../js/engine/rules.js';
import { countSolutions, outcomeText, provesUnique } from '../js/engine/counter.js';
import { countWitness } from '../js/engine/witness.js';

const N = 3;
const TRUTH = Int8Array.from([0, 1, 2, 1, 2, 0, 2, 0, 1]);
const ALL_AT = [];
for (let it = 0; it < N * N; it++) ALL_AT.push({ k: 'at', a: it, p: TRUTH[it] });

test('全锚点盘：unique、零分支、firstSolution 就是真值', () => {
  const r = countSolutions(N, ALL_AT, { limitSolutions: 2, nodeBudget: 250_000, msBudget: 200 });
  assert.equal(r.outcome, 'unique');
  assert.equal(r.count, 1);
  assert.equal(r.stopped, false);
  assert.equal(r.exhausted, true);
  assert.equal(r.branchNodes, 0);
  assert.equal(r.leafInvalid, 0);
  assert.equal(provesUnique(r), true);
  assert.equal(truthSignature(r.firstSolution), truthSignature(TRUTH));
  assert.match(outcomeText(r), /唯一/);
});

test('只有一条锚点：数到第 2 个解就收工 ⇒ multiple，不许被读成唯一', () => {
  const r = countSolutions(N, [{ k: 'at', a: 0, p: 0 }], { limitSolutions: 2 });
  assert.equal(r.outcome, 'multiple');
  assert.equal(r.count, 2);
  assert.equal(r.exhausted, true);
  assert.equal(provesUnique(r), false);
});

test('自相矛盾的题面：none（出题器 bug 才会走到这里）', () => {
  const r = countSolutions(N, [{ k: 'at', a: 0, p: 0 }, { k: 'at', a: 1, p: 0 }]);
  assert.equal(r.outcome, 'none');
  assert.equal(r.count, 0);
  assert.equal(r.stopped, false, '树是自己走完的，不是被掐断的');
  assert.equal(provesUnique(r), false);
  assert.match(outcomeText(r), /无解/);
});

test('空线索集：恰好 216 个解？不 —— limitSolutions=2 只数到 2，口径要写清楚', () => {
  const capped = countSolutions(N, [], { limitSolutions: 2 });
  assert.equal(capped.count, 2);
  assert.equal(capped.outcome, 'multiple');
  const wide = countSolutions(N, [], { limitSolutions: 300 });
  assert.equal(wide.count, 216, '(3!)^3 = 216，数得完 ⇒ 与手算对得上');
  assert.equal(wide.outcome, 'multiple');
});

test('stopped 语义：节点预算与时间预算各掐断一次，provesUnique 一律为假', () => {
  const byNodes = countSolutions(N, [{ k: 'same', a: 0, b: 3 }], { nodeBudget: 3, limitSolutions: 2 });
  assert.equal(byNodes.stopped, true);
  assert.equal(byNodes.reason, 'nodes');
  assert.equal(byNodes.outcome, 'stopped');
  assert.equal(byNodes.exhausted, false);
  assert.equal(provesUnique(byNodes), false);
  assert.match(outcomeText(byNodes), /未证完/);

  // 时间预算：检查每 32 个节点做一次（热循环里不逐节点读时钟），所以要给一棵足够深的树。
  // limitSolutions=0 = 不设解数上限 ⇒ 它不会"数够两个就收工"，只能被时钟掐断。
  const byTime = countSolutions(N, [], { limitSolutions: 0, msBudget: -1 });
  assert.equal(byTime.stopped, true);
  assert.equal(byTime.reason, 'time');
  assert.ok(byTime.nodes >= 32, '节点不到 32 就返回的话，这条测的就不是时间预算');
  assert.equal(provesUnique(byTime), false);
});

test('最危险的写法"stopped 但 count=1"：扫一遍预算，count=1 也照样不许算证明', () => {
  let sawStoppedWithOne = 0;
  for (let budget = 1; budget <= 400; budget++) {
    const r = countSolutions(N, [{ k: 'not', a: 0, p: 0 }, { k: 'somewhere_left', a: 1, b: 4 }], { nodeBudget: budget, limitSolutions: 2 });
    if (!r.stopped) continue;
    assert.equal(provesUnique(r), false, `budget=${budget} 时 stopped 被读成了唯一`);
    assert.equal(r.outcome, 'stopped');
    if (r.count === 1) sawStoppedWithOne++;
  }
  assert.ok(sawStoppedWithOne > 0, '没有一个样本是"掐断在第一个解之后"，这个测试就退化了');
});

test('单调性：加线索不会把解集变大（同一批线索的所有前缀）', () => {
  const clues = [
    { k: 'at', a: 0, p: 0 },
    { k: 'same', a: 0, b: 3 },
    { k: 'not', a: 2, p: 1 },
    { k: 'somewhere_left', a: 4, b: 7 },
    { k: 'side_by_side', a: 1, b: 6 },
  ];
  let prev = null;
  for (let i = 1; i <= clues.length; i++) {
    const r = countSolutions(N, clues.slice(0, i), { limitSolutions: 300 });
    assert.equal(r.stopped, false);
    assert.equal(r.leafInvalid, 0);
    if (prev !== null) assert.ok(r.count <= prev, `前缀 ${i} 的解数 ${r.count} > 前缀 ${i - 1} 的 ${prev}`);
    prev = r.count;
  }
});

test('裁判与独立见证在同一批盘上对账（一个有传播、一个纯枚举）', () => {
  const boards = [
    ALL_AT,
    [{ k: 'at', a: 0, p: 0 }],
    [{ k: 'same', a: 0, b: 3 }, { k: 'direct_left', a: 1, b: 4 }, { k: 'not', a: 8, p: 2 }],
    ALL_AT.slice(0, 6),
  ];
  for (const clues of boards) {
    const ref = countSolutions(N, clues, { limitSolutions: 2 });
    const wit = countWitness(N, clues, { limitSolutions: 2 });
    assert.equal(ref.count, wit.count, JSON.stringify(clues));
    assert.equal(ref.stopped, wit.stopped);
    if (!ref.stopped) assert.equal(ref.exhausted, wit.exhausted);
  }
});

test('见证收集到的解必须满足题面（裁判若删漏了约束，这里会露出来）', () => {
  const clues = [{ k: 'same', a: 0, b: 3 }, { k: 'side_by_side', a: 1, b: 6 }];
  const wit = countWitness(N, clues, { limitSolutions: 0, collect: 50 });
  assert.ok(wit.solutions.length > 0);
  for (const s of wit.solutions) {
    assert.equal(checkSolution(N, s, clues).ok, true);
    for (const c of clues) assert.equal(evalClue(c, s), true);
  }
  assert.equal(wit.count, wit.solutions.length, 'collect >= count ⇒ 数到的与收集的一致');
});
