// 计数器测试台 · 裁判（传播引导）与见证（无传播）对账，外加 stopped 语义的专门证人
//
// 为什么不能只测"裁判自己给的数自不自洽"：裁判是本仓唯一性的**最终裁判**，它若哪天把某个
// 约束删漏了，它会稳定地、可复现地给出一个错答案 —— 自洽查不出来。所以这里三种独立压力：
//
//   A) 两条实现逐盘对答案：裁判 vs 见证（witness.js 不复用任何传播代码），在随机 CSP 上
//      比穷举解数。这批 CSP 故意**不保证唯一**（0 个、1 个、成百个解混着来），因为唯一盘上
//      两边都给 1，测不出漏约束。
//   B) 完整性证人：只由"反射不变"的线索（same / not_same / side_by_side / not_side_by_side /
//      n_between）组成的题面，若有解则必有 ≥2 个解 —— 把每一间镜像到第 N-1-间仍是解，而
//      N>=2 时没有解能等于自己的镜像。裁判若在 such 题面上报 unique，就是**漏约束**的确定证据。
//      这条来自选型屏（它的 reflection-automorphism audit 在 600 张盘上 0 命中，2026-09-28 重跑），
//      在这里被固化成一个能主动构造反例形状的门，而不是"顺带看了一眼"。
//   C) 单调性证人：删线索只能让解变多。裁判与见证都必须满足；违反说明其中一条通道在
//      某个约束上"提前收工"。
//   D) stopped 语义：预算击穿必须报 stopped=true 且 provesUnique=false。
//      半路上 count=1 的盘**不许**被读成"唯一"。这条单独设节，因为它就是"bake 超预算 = 承诺破口"
//      那一类事故的形状。
//
// 跑法： node tools/counter-test.mjs

import { performance } from 'node:perf_hooks';
import { CLUE_KINDS, UNARY_KINDS, catOf, evalClue, itemIds } from '../js/engine/rules.js';
import { countSolutions, outcomeText, provesUnique } from '../js/engine/counter.js';
import { countWitness } from '../js/engine/witness.js';
import { makeRng } from '../js/engine/rng.js';

let checks = 0, fails = 0;
function ok(name, cond, detail = '') {
  checks++;
  if (!cond) { fails++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}
function eq(name, got, want) { ok(name, got === want, `期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`); }

/** 随机 CSP：只挑形状合法的线索（跨类别、房子在盘内），真值不管 —— 就是要有 0 解的盘。 */
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

console.log('== A) 裁判 vs 见证：随机 CSP 的穷举解数必须逐盘相同 ==');
{
  let mism = 0, compared = 0, capped = 0, zero = 0, one = 0, many = 0;
  const msR = [], msW = [];
  for (const N of [3, 4]) {
    for (let d = 0; d < 60; d++) {
      const rnd = makeRng(`counter-selftest|${N}|${d}`);
      const clues = randomCsp(N, rnd, 1 + rnd.int(4 * N));
      const t0 = performance.now();
      const ref = countSolutions(N, clues, { limitSolutions: 0, nodeBudget: 3_000_000, msBudget: 4_000 });
      const refMs = performance.now() - t0;
      const t1 = performance.now();
      const wit = countWitness(N, clues, { limitSolutions: 0, nodeBudget: 3_000_000, msBudget: 4_000 });
      const witMs = performance.now() - t1;
      msR.push(refMs); msW.push(witMs);
      if (ref.stopped || wit.stopped) { capped++; continue; }
      compared++;
      if (ref.count === 0) zero++; else if (ref.count === 1) one++; else many++;
      ok(`N=${N} #${d} 两通道解数相同（裁判 ${ref.count} / 见证 ${wit.count}）`, ref.count === wit.count);
      if (ref.count !== wit.count) mism++;
      eq(`N=${N} #${d} 裁判 leafInvalid=0`, ref.leafInvalid, 0);
    }
  }
  const srt = (xs) => xs.slice().sort((a, b) => a - b);
  const q = (xs, p) => srt(xs)[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)];
  console.log(`  可比 ${compared} / 掐断 ${capped} · 解数分布 0 解 ${zero} · 1 解 ${one} · 多解 ${many}`);
  console.log(`  墙钟中位：裁判 ${q(msR, .5).toFixed(2)} ms · 见证 ${q(msW, .5).toFixed(2)} ms（见证是朴素枚举，慢是设计使然）`);
  eq('两通道 mismatch 数', mism, 0);
  ok('随机 CSP 里三种结局都出现过（0/1/多解）', zero > 0 && one > 0 && many > 0, `${zero}/${one}/${many}`);
}

console.log('== B) 反射不变题面：有解就不许报 unique（漏约束的探测器） ==');
{
  const INVARIANT = ['same', 'not_same', 'side_by_side', 'not_side_by_side'];
  let hit = 0, tried = 0, falseUnique = 0;
  for (const N of [3, 4]) {
    for (let d = 0; d < 40; d++) {
      const rnd = makeRng(`counter-reflect|${N}|${d}`);
      const clues = [];
      for (let i = 0; i < 3 * N; i++) {
        const k = INVARIANT[Math.floor(rnd.next() * INVARIANT.length)];
        const a = rnd.int(N * N);
        let b = rnd.int(N * N), guard = 0;
        while (catOf(b, N) === catOf(a, N) && guard++ < 200) b = rnd.int(N * N);
        if (catOf(b, N) === catOf(a, N)) continue;
        clues.push({ k, a, b });
      }
      tried++;
      const ref = countSolutions(N, clues, { limitSolutions: 2, nodeBudget: 2_000_000, msBudget: 4_000 });
      if (ref.stopped) continue;
      if (ref.outcome === 'none') continue;
      hit++;
      if (provesUnique(ref)) { falseUnique++; console.log(`  !! 反射不变题面被报成唯一：N=${N} #${d}`); }
      // 镜像复核：把任一解整盘左右翻转，仍应是解（这是 evalClue 的独立性检查，不靠裁判）
      if (ref.firstSolution) {
        const flip = new Int8Array(N * N);
        for (let i = 0; i < N * N; i++) flip[i] = (N - 1) - ref.firstSolution[i];
        ok(`N=${N} #${d} 镜像仍是解`, clues.every((c) => evalClue(c, flip)));
      }
    }
  }
  console.log(`  ${tried} 张反射不变题面，其中 ${hit} 张有解 —— 有解的全部被裁判判为"至少 2 解"`);
  eq('裁判在反射不变题面上误报 unique 的次数', falseUnique, 0);
  ok('这一节真的有非平凡样本（不能 0 命中混过去）', hit >= 20, `hit=${hit}`);
}

console.log('== C) 单调性：删线索只能让解变多（两条通道都要满足） ==');
{
  let viol = 0, steps = 0;
  for (const N of [3, 4]) {
    for (let d = 0; d < 12; d++) {
      const rnd = makeRng(`counter-mono|${N}|${d}`);
      let clues = randomCsp(N, rnd, 2 + rnd.int(3 * N));
      let prevR = -1, prevW = -1;
      for (let cut = 0; cut < clues.length; cut++) {
        const ref = countSolutions(N, clues, { limitSolutions: 0, nodeBudget: 2_000_000, msBudget: 4_000 });
        const wit = countWitness(N, clues, { limitSolutions: 0, nodeBudget: 2_000_000, msBudget: 4_000 });
        if (ref.stopped || wit.stopped) break;
        steps++;
        if (prevR >= 0 && ref.count < prevR) { viol++; console.log(`  !! 裁判：删一条线索后解数反而从 ${prevR} 降到 ${ref.count}`); }
        if (prevW >= 0 && wit.count < prevW) { viol++; console.log(`  !! 见证：删一条线索后解数从 ${prevW} 降到 ${wit.count}`); }
        prevR = ref.count; prevW = wit.count;
        clues = clues.slice(1);
      }
    }
  }
  eq(`${steps} 次删线索，解数单调不减的违反次数`, viol, 0);
}

console.log('== D) stopped 语义：击穿 ≠ 唯一，也 ≠ 无解 ==');
{
  const N = 4, rnd = makeRng('counter-stop|1');
  const clues = randomCsp(N, rnd, 6);
  const full = countSolutions(N, clues, { limitSolutions: 0, nodeBudget: Infinity, msBudget: 5_000 });
  const tight = countSolutions(N, clues, { limitSolutions: 0, nodeBudget: 3, msBudget: 5_000 });
  eq('节点预算=3 时一定击穿', tight.stopped, true);
  eq('击穿的原因', tight.reason, 'nodes');
  eq('击穿 ⇒ provesUnique=false（不看 count）', provesUnique(tight), false);
  eq('击穿 ⇒ outcome=stopped', tight.outcome, 'stopped');
  eq('击穿 ⇒ 文案写"未证完"', /^未证完/.test(outcomeText(tight)), true);
  const zeroTime = countSolutions(N, clues, { limitSolutions: 0, nodeBudget: Infinity, msBudget: -1 });
  eq('毫秒预算也会击穿', zeroTime.stopped, true);
  eq('原因是 time', zeroTime.reason, 'time');
  console.log(`  同一张盘：不掐断数到 ${full.count} 个解（${full.nodes} 节点）/ 掐断停在 count=${tight.count}（${tight.nodes} 节点）—— 半路的 1 不是"唯一"`);
  // 见证的同一口径
  const wTight = countWitness(N, clues, { nodeBudget: 5 });
  eq('见证也被节点预算掐断', wTight.stopped, true);
  eq('掐断的见证是"未成"而不是 disagreement', wTight.exhausted, false);
}

console.log('== E) limitSolutions:2 的语义：数到 2 就收工 ==');
{
  const N = 3;
  const truth = Int8Array.from([0, 1, 2, 2, 1, 0, 1, 2, 0]);
  // 一条线索 ⇒ 大量解；全量 at ⇒ 恰好 1 解；两者之间用 cap=2 断"至少 2"
  const loose = countSolutions(N, [{ k: 'same', a: 0, b: 3 }], { limitSolutions: 2, nodeBudget: 250_000, msBudget: 200 });
  eq('一条弱线索 ⇒ count 停在 2', loose.count, 2);
  eq('一条弱线索 ⇒ outcome=multiple', loose.outcome, 'multiple');
  eq('multiple ⇒ provesUnique=false', provesUnique(loose), false);
  const fullAt = itemIds(N).map((it) => ({ k: 'at', a: it, p: truth[it] }));
  const uniq = countSolutions(N, fullAt, { limitSolutions: 2, nodeBudget: 250_000, msBudget: 200 });
  eq('全部 at 锚点 ⇒ 唯一', uniq.outcome, 'unique');
  eq('全部 at ⇒ provesUnique=true', provesUnique(uniq), true);
  eq('全部 at 的解就是真值', Array.from(uniq.firstSolution).join(''), Array.from(truth).join(''));
  const contra = countSolutions(N, [{ k: 'at', a: 0, p: 0 }, { k: 'at', a: 0, p: 1 }], { limitSolutions: 2 });
  eq('互相矛盾的题面 ⇒ none', contra.outcome, 'none');
  eq('矛盾的题面 count=0', contra.count, 0);
  const emptySet = countSolutions(N, [], { limitSolutions: 0, nodeBudget: 2_000_000, msBudget: 4_000 });
  eq('空题面的解数 = (3!)^3 = 216', emptySet.count, 216);
  eq('空题面也要数得完', emptySet.stopped, false);
  const wit0 = countWitness(N, [], { nodeBudget: 2_000_000 });
  eq('见证数空题面得到同一个 216', wit0.count, 216);
}

console.log(`\nRESULT counter-test ok=${fails === 0} checks=${checks} fails=${fails}`);
process.exit(fails ? 1 : 0);
