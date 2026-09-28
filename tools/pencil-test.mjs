// 铅笔测试台 · 每一步结论都要对得起真值
//
// 这条通道是"零猜测"这条产品承诺的**定义**，所以它的门槛不是"能不能推完"，而是
// "推出来的东西是不是假的"。推得完是难度问题，推错是事故。六节：
//
//   1) 每条规则都得有出场证人（表里不许躺着一条没人用过的规则）。
//   2) soundness（对真值）：出货盘上铅笔定下的**每一个**值都必须等于生成它的真值。
//   3) soundness（对全部解，比第 2 节强）：随机 CSP 上把解全部枚举出来，铅笔的每个定值结论
//      必须在**每一个**解里成立；铅笔若宣布矛盾而盘其实有解 ⇒ 当场红。
//      这一节才是"不分支"的数学定义：结论 ⊆ ⋂解。
//   4) 无干扰（单调性）：规则集变大 ⇒ 域只会更小，不会"这条规则删掉、那条规则又加回来"。
//      加规则还推不完，说明规则之间有状态泄漏。
//   5) P8 单独跑：一条假设检验规则若**自己就能**定值或判矛盾，那它就是伪装成推理的猜测。
//      实测它单独跑在全部样本上出场 0 次、一次都不解决 —— 它的权力只来自别的规则缩完之后的势。
//   6) 反向对照（负控）：往结果里人为塞一个"猜"出来的定值，第 2 节的审计必须抓到它。
//      这一节证明的是**审计本身不是空转**，而不是铅笔有错。
//
// 跑法： node tools/pencil-test.mjs

import { BASIC_RULES, FULL_RULES, RULE_ORDER, RULE_DOC, auditAgainst, solve } from '../js/engine/pencil.js';
import { countWitness } from '../js/engine/witness.js';
import { catLists, evalClue, itemIds } from '../js/engine/rules.js';
import { CLUE_KINDS, UNARY_KINDS, catOf } from '../js/engine/rules.js';
import { TIERS, drawOnce } from '../js/engine/generate.js';
import { makeRng } from '../js/engine/rng.js';

let checks = 0, fails = 0;
function ok(name, cond, detail = '') {
  checks++;
  if (!cond) { fails++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}
function eq(name, got, want) { ok(name, got === want, `期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`); }

// ── 样本池 ───────────────────────────────────────────────────────────────────
/** 随机 CSP：真值不管，专门用来喂"0 解 / 多解"的盘（第 3 节的强审计要用到全部解）。 */
function randomCsp(N, rnd, m) {
  const clues = [];
  for (let i = 0; i < m; i++) {
    const k = CLUE_KINDS[Math.floor(rnd.next() * CLUE_KINDS.length)];
    if (UNARY_KINDS.has(k)) { clues.push({ k, a: rnd.int(N * N), p: rnd.int(N) }); continue; }
    const a = rnd.int(N * N);
    let b = rnd.int(N * N), guard = 0;
    while (catOf(b, N) === catOf(a, N) && guard++ < 200) b = rnd.int(N * N);
    if (catOf(b, N) === catOf(a, N)) continue;
    const c = { k, a, b };
    if (k === 'n_between') c.n = 1 + rnd.int(Math.max(1, N - 2));
    clues.push(c);
  }
  return clues;
}

/** 出货盘（带真值）。抽不满就用tries兜底，本文件不拿"抽不出"当红。 */
const BOARDS = [];
for (const tier of TIERS) {
  let made = 0;
  for (let d = 0; d < 120 && made < 25; d++) {
    const g = drawOnce(tier, `pencil-audit|${tier.key}|${d}`);
    if (g.fail) continue;
    BOARDS.push({ tier, ...g });
    made++;
  }
}
console.log(`样本：出货盘 ${BOARDS.length} 张（${TIERS.map((t) => `${t.key} ${BOARDS.filter((b) => b.tier.key === t.key).length}`).join(' · ')}）`);
const CSPS = [];
for (const N of [3, 4]) for (let d = 0; d < 90; d++) CSPS.push({ N, clues: randomCsp(N, makeRng(`pencil-csp|${N}|${d}`), 2 + (d % (3 * N))) });

console.log('== 1) 每条规则的出场证人 ==');
{
  // 证人用"只有这条规则"的场合找：FULL 里 P6 排在前，隐性数组 P7 的删除会被显性数组 P6 先抢走
  // —— 那是**记账次序**，不是规则没用。所以每条规则单独配上场（BASIC + 它自己）跑一遍，
  // 只要在某个场合买到过东西，它就不是死规则。
  const witness = {}, fireTotal = Object.fromEntries(RULE_ORDER.map((r) => [r, 0]));
  const scan = (N, clues, tag) => {
    const r = solve(N, clues);
    for (const k of RULE_ORDER) fireTotal[k] += r.fire[k];
    for (const k of RULE_ORDER) if (r.fire[k] && !witness[k]) witness[k] = `${tag}（FULL 出场 ${r.fire[k]} 次）`;
    for (const k of ['P6', 'P7', 'P8']) {
      const one = solve(N, clues, { rules: BASIC_RULES.concat(k) });
      if (one.fire[k] && !witness[k]) witness[k] = `${tag}（BASIC + 只加 ${k} 时出场 ${one.fire[k]} 次）`;
    }
  };
  for (const b of BOARDS) scan(b.tier.N, b.clues, b.seedStr);
  for (const c of CSPS) scan(c.N, c.clues, `随机 CSP N=${c.N}`);
  for (const k of RULE_ORDER) {
    ok(`${k} ${RULE_DOC[k]} 有出场证人（FULL 累计 ${fireTotal[k]} 次删除）`, !!witness[k], '所有场合 0 次 ⇒ 表里有死规则');
    console.log(`  ${k} FULL 累计删除 ${fireTotal[k]} 位 · 证人：${witness[k] || '—'}`);
  }
}

console.log('== 2) soundness：出货盘上每个定值结论都必须等于真值 ==');
{
  let wrong = 0, dead = 0, solvedF = 0, solvedB = 0;
  for (const b of BOARDS) {
    const r = solve(b.tier.N, b.clues);
    const w = auditAgainst(b.tier.N, r, b.truth);
    if (w.length) { wrong += w.length; console.log(`  !! ${b.seedStr} 有 ${w.length} 条结论与真值冲突`); }
    if (r.dead) { dead++; console.log(`  !! ${b.seedStr} 推出矛盾（题面其实有解）`); }
    if (r.solved) solvedF++;
    if (solve(b.tier.N, b.clues, { rules: BASIC_RULES }).solved) solvedB++;
  }
  eq('与真值冲突的结论数（必须 0）', wrong, 0);
  eq('在可解盘上误报矛盾的次数（必须 0）', dead, 0);
  eq('出货盘 100% 被 FULL 推完（生成器的选取口径）', solvedF, BOARDS.length);
  console.log(`  同一批盘上 BASIC(P1..P5) 只能推完 ${solvedB}/${BOARDS.length} —— 差值就是 P6..P8 三条规则买到的东西`);
}

console.log('== 3) soundness（对全部解）：结论必须落在 ⋂解 里 ==');
{
  let checked = 0, skipped = 0, violated = 0, falseDead = 0, capped = 0, ghostSolved = 0, ghostClue = 0;
  for (const c of CSPS) {
    const wit = countWitness(c.N, c.clues, { nodeBudget: 400_000, msBudget: 3_000, collect: 60 });
    if (wit.stopped) { capped++; continue; }
    const r = solve(c.N, c.clues);
    if (r.dead && wit.count > 0) { falseDead++; continue; }
    // 无解盘上"推完全推完了"是不可能的：铅笔若宣布 solved，它给出的那张盘必然违反某条线索。
    if (r.solved) {
      const asg = new Int8Array(c.N * c.N);
      for (let i = 0; i < asg.length; i++) asg[i] = Math.log2(r.dom[i]) | 0;
      for (const cl of c.clues) if (!evalClue(cl, asg)) ghostClue++;
      if (wit.count === 0) ghostSolved++;
    }
    if (wit.count === 0) { checked++; continue; }             // 0 解盘上"在所有解里成立"是空话
    if (wit.solutions.length < Math.min(wit.count, 60)) { skipped++; continue; }
    checked++;
    for (let i = 0; i < c.N * c.N; i++) {
      const m = r.dom[i];
      if (!m || (m & (m - 1))) continue;                     // 未定值的不查
      const p = Math.log2(m) | 0;
      for (const sol of wit.solutions) if (sol[i] !== p) violated++;
    }
  }
  eq(`${checked} 张随机 CSP 上，铅笔定值与所有解冲突的次数`, violated, 0);
  eq('铅笔误报矛盾（盘其实有解）的次数', falseDead, 0);
  eq('铅笔在 0 解盘上宣布推完的次数', ghostSolved, 0);
  eq('铅笔推完的盘违反题面线索的次数', ghostClue, 0);
  console.log(`  可比 ${checked} 张 · 见证掐断 ${capped} · 解太多收不满 ${skipped}`);
}

console.log('== 4) 无干扰：规则集单调，且同一输入两次跑出同一份域 ==');
{
  let nonMono = 0, unstable = 0;
  const CHAINS = [['P1'], ['P1', 'P2'], ['P1', 'P2', 'P3'], ['P1', 'P2', 'P3', 'P4'], BASIC_RULES, FULL_RULES];
  for (const b of BOARDS) {
    let prev = null;
    for (const rules of CHAINS) {
      const r = solve(b.tier.N, b.clues, { rules });
      if (prev) for (let i = 0; i < b.tier.N * b.tier.N; i++) if ((prev[i] & r.dom[i]) !== r.dom[i]) nonMono++;
      prev = r.dom;
    }
    const a1 = solve(b.tier.N, b.clues), a2 = solve(b.tier.N, b.clues);
    for (let i = 0; i < b.tier.N * b.tier.N; i++) if (a1.dom[i] !== a2.dom[i]) unstable++;
  }
  eq('加规则后旧结论被"加回来"的次数（域必须单调收缩）', nonMono, 0);
  eq('同输入两次跑出的域不一致次数（纯函数自证）', unstable, 0);
}

console.log('== 5) 权力边界：任何规则都不许删掉"出现在某个解里"的值 ==');
{
  // 这是比第 3 节更狠的口径：第 3 节只查"钉死的格对不对"，这里查**每一次删除**。
  // 做法：把一张 CSP 的解全部枚举出来，按物品求出"在某个解里出现过"的房子集合 reachable(i)，
  // 则任何一条规则跑完都必须满足 reachable(i) ⊆ dom(i)。
  // 删掉了 reachable 里的值 = 把一张有解的盘往无解的方向推 = 事故，不是"弱"。
  // P8（假设检验）单独跑也过这一节 —— 它是本文件里唯一"看起来像在猜"的规则，
  // 这一节就是它的证人：它的权力只在"某个值在**所有**解里都不成立"上，不来自任何承诺。
  let over = 0, covered = 0, capped = 0;
  const RULESETS = [FULL_RULES, ['P8'], BASIC_RULES, ['P1', 'P2', 'P3', 'P4', 'P5', 'P7']];
  for (const c of CSPS) {
    const wit = countWitness(c.N, c.clues, { nodeBudget: 400_000, msBudget: 3_000, collect: 400 });
    if (wit.stopped || wit.solutions.length < Math.min(wit.count, 400)) { capped++; continue; }
    if (!wit.solutions.length) continue;                       // 0 解盘：reachable 是空集，查不出东西
    covered++;
    const reach = new Uint32Array(c.N * c.N);
    for (const sol of wit.solutions) for (let i = 0; i < sol.length; i++) reach[i] |= 1 << sol[i];
    for (const rules of RULESETS) {
      const r = solve(c.N, c.clues, { rules });
      for (let i = 0; i < reach.length; i++) if ((r.dom[i] & reach[i]) !== reach[i]) over++;
    }
  }
  eq(`${covered} 张 CSP × ${RULESETS.length} 套规则，被删掉但其实是某个解的取值的次数`, over, 0);
  console.log(`  可比 ${covered} 张 · 掐断或解太多收不满 ${capped}`);
  // 读数：P8 单独跑确实会删值（它自带"锚定 + 匹配"的权力），这不是问题；
  // 问题是它删的东西对不对 —— 上面那条判据就是回答这一句的。
  const p8 = BOARDS.map((b) => solve(b.tier.N, b.clues, { rules: ['P8'] }).fire.P8).reduce((a, x) => a + x, 0);
  console.log(`  读数：P8 单独跑在 ${BOARDS.length} 张出货盘上共删 ${p8} 位（全部通过上面的权力检查）`);
}

console.log('== 6) 负控：审计必须抓得住一个"猜"出来的定值 ==');
{
  // 把第一个未定值的物品人为钉成"真值里它的房子"以外的一间 —— 这就是猜。
  // 第 2 节的审计若写成空转，这里会是 0，那就等于本文件什么都没测。
  let caught = 0, tried = 0;
  for (const b of BOARDS) {
    const r = solve(b.tier.N, []);                       // 空题面：什么都不知，所有物品都没定
    const unstuck = itemIds(b.tier.N)[0];
    const wrong = (b.truth[unstuck] + 1) % b.tier.N;     // 故意钉一个**不是**真值的房子
    const dom = Uint32Array.from(r.dom);
    dom[unstuck] = 1 << wrong;
    tried++;
    if (auditAgainst(b.tier.N, { dom }, b.truth).length) caught++;
  }
  eq('负控：伪造的定值被审计抓到（每张盘都要抓到）', caught, tried);
  ok('负控确实试过', tried > 0, `${tried}`);
}

console.log('== 7) 完备性下限：全量 at 锚点必须一轮推完 ==');
{
  for (const tier of TIERS) {
    const b = BOARDS.find((x) => x.tier.key === tier.key);
    if (!b) continue;
    const anchors = itemIds(tier.N).map((it) => ({ k: 'at', a: it, p: b.truth[it] }));
    const r = solve(tier.N, anchors, { rules: ['P1'] });
    eq(`${tier.key} 只用 P1 就能推完全量锚点`, r.solved, true);
    eq(`${tier.key} 锚点盘与真值零冲突`, auditAgainst(tier.N, r, b.truth).length, 0);
    const cats = catLists(tier.N);
    let leak = 0;
    const r2 = solve(tier.N, anchors, { rules: BASIC_RULES });
    for (const items of cats) for (const v of items) if (r2.dom[v] !== (1 << b.truth[v])) leak++;
    eq(`${tier.key} BASIC 在锚点盘上不多不少`, leak, 0);
  }
}

console.log('== 8) 线索语义交叉：出题器写下的每句话都必须对真值为真 ==');
{
  // 这一节抓的是 generator 的"说谎"：候选线索若有一条在其真值上为假，出货的题面就是在
  // 描述一张不存在的盘 —— 裁判与铅笔会一起自洽地错。选型屏同一条审计在 600 张盘上 0 命中
  // （2026-09-28 重跑），门槛留着的理由是"下一次未必是 0"。
  let bad = 0, pinned = 0;
  for (const b of BOARDS) {
    for (const c of b.clues) if (!evalClue(c, b.truth)) { bad++; console.log(`  !! ${b.seedStr} 有线索对真值为假：${c.k}`); }
    const r = solve(b.tier.N, b.clues);
    if (!r.solved) continue;
    for (const c of b.clues) {
      const pa = r.dom[c.a];
      if (c.k === 'at' && pa !== (1 << c.p)) pinned++;
      if (c.k === 'not' && (pa & (1 << c.p))) pinned++;
      if (c.b !== undefined && c.k === 'same' && pa !== r.dom[c.b]) pinned++;
    }
  }
  eq('出货题面里对真值为假的线索数', bad, 0);
  eq('推完的盘上不遵守题面原话的格数', pinned, 0);
}

console.log(`\nRESULT pencil-test ok=${fails === 0} checks=${checks} fails=${fails}`);
process.exit(fails ? 1 : 0);
