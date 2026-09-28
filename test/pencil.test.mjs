// 铅笔求解器（不允许搜索的那条通道）的行为测试。
//
// 铅笔是"人怎么推"的模型：只有具名规则 P1..P8，没有猜。它的两个性质必须钉住：
//   soundness —— 推出的每个定值都必须是真的（错一次就是"题目无解"假警报）；
//   completeness 只在锚点盘上要求（全部 at ⇒ 必须推完）。
// 覆盖范围的完整审计（每条规则的真值表、⋂解集、能力上界、负对照）在 tools/pencil-test.mjs，
// 这里是改动时最想立刻看见的四件事。

import test from 'node:test';
import assert from 'node:assert/strict';
import { bitsOf, POP } from '../js/engine/rules.js';
import { countSolutions } from '../js/engine/counter.js';
import {
  BASIC_RULES, FULL_RULES, RULE_DOC, RULE_ORDER, auditAgainst, nextForced, solve,
} from '../js/engine/pencil.js';
import { generate, tierOf } from '../js/engine/generate.js';

const N = 3;
const TRUTH = Int8Array.from([0, 1, 2, 1, 2, 0, 2, 0, 1]);
const ALL_AT = [];
for (let it = 0; it < N * N; it++) ALL_AT.push({ k: 'at', a: it, p: TRUTH[it] });

test('规则表自解释：8 条具名规则都有中文说明，BASIC 是 FULL 的前缀', () => {
  assert.deepEqual([...RULE_ORDER], ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  for (const r of RULE_ORDER) assert.ok(RULE_DOC[r] && RULE_DOC[r].length > 8, `${r} 缺文档`);
  assert.deepEqual(BASIC_RULES, RULE_ORDER.slice(0, 5));
  assert.deepEqual(FULL_RULES, RULE_ORDER);
});

test('锚点盘（全部 at）：必须从空盘推完，一条不剩', () => {
  const res = solve(N, ALL_AT);
  assert.equal(res.solved, true);
  assert.equal(res.dead, false);
  assert.equal(res.undecided, 0);
  assert.deepEqual(auditAgainst(N, res, TRUTH), []);
  assert.ok(res.fire.P1 > 0, 'at 就是 P1 的活');
  for (const f of nextForced(N, ALL_AT)) {
    assert.equal(POP[f.p], 1);
    assert.equal(bitsOf(f.p)[0], TRUTH[f.item]);
  }
});

test('矛盾盘必须报 dead，而不是"还剩几个没推出来"', () => {
  const res = solve(N, [{ k: 'at', a: 0, p: 0 }, { k: 'at', a: 1, p: 0 }]);
  assert.equal(res.dead, true);
  assert.equal(res.solved, false);
});

test('推不完就老实说推不完：一条线索的盘不许假装 solved', () => {
  const res = solve(N, [{ k: 'at', a: 0, p: 0 }]);
  assert.equal(res.solved, false);
  assert.equal(res.dead, false);
  assert.ok(res.undecided > 0);
  // 但推出的那一点必须是真的 —— 弱不是错。
  assert.deepEqual(auditAgainst(N, res, TRUTH), []);
});

test('出货盘：FULL 从空盘推完，且结论与真值零冲突', () => {
  for (const tier of [tierOf('t1-3cat'), tierOf('t2-4cat'), tierOf('t3-5cat')]) {
    const g = generate(tier.key, 'unit');
    assert.equal(g.ok, true, `${tier.key} 抽 ${tier.tries} 次没出货`);
    assert.equal(g.receipt.pencilSolved, true);
    const res = solve(tier.N, g.clues);
    assert.equal(res.solved, true, `${tier.key} 成品重跑推不完`);
    assert.deepEqual(auditAgainst(tier.N, res, g.truth), [], `${tier.key} 铅笔结论与真值冲突`);
    const ref = countSolutions(tier.N, g.clues, { limitSolutions: 2, nodeBudget: 250_000, msBudget: tier.budgetMs });
    assert.equal(ref.stopped, false);
    assert.equal(ref.outcome, 'unique');
  }
});

test('关掉某条规则 ⇒ 那一格的删除数必须归零（规则出场可归因）', () => {
  const g = generate('t3-5cat', 'attr');
  assert.equal(g.ok, true);
  const full = solve(5, g.clues);
  for (const r of ['P1', 'P2', 'P3', 'P4', 'P8']) {
    const minus = solve(5, g.clues, { rules: FULL_RULES.filter((x) => x !== r) });
    assert.equal(minus.fire[r] || 0, 0, `${r} 被关掉了却还有出场记录`);
  }
  assert.ok(full.fire.P2 > 0 && full.fire.P4 > 0, '同址删除与弧一致性是主力，没出场说明盘不对');
});
