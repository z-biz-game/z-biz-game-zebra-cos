// 游戏模型 · 谁养鱼（UI 层唯一的状态机）
//
// 三条硬口径，都写在代码里而不是文案里：
//   1. **本文件从头到尾没有拿到过答案**。出题走 js/engine/generate.js，返回对象里的 `truth`
//      只在 makeBoard() 的局部活一瞬（交给 proveBoard 复核后立即丢），交出去的 board 只有
//      {tierKey,N,seedStr,clues,…}。所以提示、判分、存档、画布都只能是"对着题面算"，
//      不可能"对着答案抄"。tools/scenarios.js 的 answer-path 那条断言就是量这个的。
//   2. **注记是玩家的手，铅笔的账是铅笔的**。玩家在三态格子里写 ✗/✓；提示来自
//      pencil.solve(…, {trace:true}) 的真实删除序列（哪条规则、删了哪个物品哪间房的候选），
//      再把这次删除**新蕴含**的逻辑格格子换算成"这一格可以划掉 / 可以打勾"。
//      蕴含关系只用 dom 的交并算，不用答案算（见 hintAt 的注释）。
//   3. **判分只问"你说的这组分配满足全部线索吗"**：checkSolution(N, 玩家的分配, clues)。
//      出货盘的线索集合被裁判**证明**过唯一解（proof.count===1 且 !proof.stopped），
//      所以"满足全部线索的合法分配"必然就是那一盘 —— 这句话在 UI 里以 proof 的读数出现，
//      不是以"我对了一下答案"出现。
//
// 三态：0 空 · 1 ✗ · 2 ✓（与 js/store.js 的 marks 串同一套编码）。

import { CAT_SHORT, CATALOG, POP, catOf, checkSolution, describeClue, fullMask, labelOf } from '../engine/rules.js';
import { TIERS, generateOn, proveBoard, tierOf } from '../engine/generate.js';
import { countSolutions } from '../engine/counter.js';
import { FULL_RULES, RULE_DOC, solve } from '../engine/pencil.js';

export const EMPTY = 0, CROSS = 1, CHECK = 2;
export const MARK_CYCLE = [EMPTY, CROSS, CHECK];        // 纸笔习惯：先划掉，再打勾，再清空

/** 类别对表：c1<c2，行=类别 c1 的物品，列=类别 c2 的物品。顺序稳定 ⇒ marks 串可跨会话对账。 */
export function pairList(N) {
  const out = [];
  for (let c1 = 0; c1 < N; c1++) for (let c2 = c1 + 1; c2 < N; c2++) out.push([c1, c2]);
  return out;
}
export const pairCount = (N) => (N * (N - 1)) / 2;

/**
 * 出一张盘，并把它**压缩成不含答案的形状**。
 * @returns {ok:true, board, proof} | {ok:false, fail, failures, draws}
 */
export function makeBoard(tierKey, seed) {
  const tier = tierOf(tierKey);
  if (!tier) throw new Error(`未知档位 ${tierKey}`);
  const g = generateOn(tier, seed);
  if (!g.ok) return { ok: false, fail: 'no-board', failures: g.failures, draws: g.draws, tier };
  const proof = proveBoard(tier, g.clues, g.truth, { draws: g.draws });
  // truth 到这里已经没有用了：下面交出去的每个字段都是从 clues / tier / proof 读的。
  // 引擎回执里那句 `truthReasons` 是"生成器自记的答案满不满分题面"的**理由文本**，
  // 它是给验收面板用的一次性读数，不该长期挂在页面对象图上（阶段一的闸按名字扫对象图，
  // 带 truth 字样的数组就是那条答案路径的入口）⇒ 在这里折成一句文案，数组本身不外传。
  const uiProof = { ...proof };
  const truthNote = proof.truthOk ? null : (proof.truthReasons || []).join(' / ');
  delete uiProof.truthReasons;
  uiProof.truthNote = truthNote;
  const board = {
    tierKey: tier.key, N: tier.N, label: tier.label, seed: String(seed),
    seedStr: g.seedStr, clues: g.clues, clueCount: g.clues.length, draws: g.draws,
  };
  return { ok: true, board, proof: uiProof };
}

/**
 * 一张盘能不能出货给玩家：**三条都认，缺一条就是未通过验收**。闸与 UI 读同一个函数。
 * proof 有两种来源：makeBoard() 的 proveBoard 回执（带 truthOk），与 assessBoard() 的现算回执
 * （注入盘没有真值可自洽，truthOk 是 undefined ⇒ 不参与否决，其余三条照旧全认）。
 */
export function boardIsProven(board, proof) {
  if (!board || !proof) return false;
  if (proof.stopped) return false;                       // 预算击穿 ⇒ 唯一性未证明
  if (proof.outcome !== 'unique' || proof.count !== 1) return false;
  if (!proof.pencilSolved) return false;                 // 空盘推不完 ⇒ 不是给人做的题
  if (proof.truthOk === false) return false;             // 出题器连自己的答案都不满足题面
  return true;
}

/**
 * 现算一份验收回执（**不需要真值**）：裁判数一遍 + 铅笔从空盘推一遍。
 * 给"注入一张盘"的路径用（tools/scenarios.js 的 canary 就是拿它量推不完的盘与 stopped 的盘）。
 */
export function assessBoard(N, clues, opts = {}) {
  const ref = countSolutions(N, clues, {
    limitSolutions: 2,
    nodeBudget: opts.nodeBudget ?? 250_000,
    msBudget: opts.budgetMs ?? 10,
  });
  const pen = solve(N, clues, { rules: FULL_RULES, trace: !!opts.trace });
  return {
    count: ref.count, stopped: ref.stopped, outcome: ref.outcome, nodes: ref.nodes, ms: ref.ms,
    reason: ref.reason ?? null, leafInvalid: ref.leafInvalid,
    pencilSolved: pen.solved, pencilUndecided: pen.undecided, pencilFire: pen.fire,
    pencilRounds: pen.rounds, truthOk: undefined, draws: null, clueCount: clues.length,
    trace: pen.trace,
  };
}

export class Game {
  /** @param board makeBoard() 交出的那个对象（没有 truth） */
  constructor(board) {
    this.board = board;
    const N = this.N = board.N;
    this.tierKey = board.tierKey;
    this.seed = board.seed;
    this.seedStr = board.seedStr;
    this.clues = board.clues;
    this.pairs = pairList(N);
    this.nPairs = this.pairs.length;
    this.cells = this.nPairs * N * N;
    this.marks = new Uint8Array(this.cells);
    this.undoStack = [];
    this.steps = 0;
    this.hints = 0;
    this.cursor = { p: 0, i: 0, j: 0 };
    this.solved = false;
    // 铅笔读数只留"这一步存在吗、用了几轮、每条规则删了几位"这种**计数**：
    // 整条 trace（每步的 to 掩码）**不留存** —— 存下来就等于把一盘题的完整解题序列挂在对象图上，
    // 而 tools/scenarios.js 的 answer-path 断言要扫的就是对象图。按提示时现算（solve 是纯函数、
    // 毫秒级），交出去的只有当前那一步。
    const res = solve(N, board.clues, { rules: FULL_RULES, trace: true });
    this.pencil = {
      solved: res.solved, dead: res.dead, undecided: res.undecided, rounds: res.rounds,
      fire: res.fire, used: res.used, steps: (res.trace || []).length,
    };
    this.hintAt = 0;                     // 下一次按提示要看的那一步（0 起）
    this.hintHi = new Uint8Array(this.cells);
  }

  // ── 格子寻址 ───────────────────────────────────────────────────────────────
  idx(p, i, j) { return p * this.N * this.N + i * this.N + j; }
  at(p, i, j) { return this.marks[this.idx(p, i, j)]; }
  cellName(p, i, j) {
    const [c1, c2] = this.pairs[p];
    return `${labelOf(c1 * this.N + i, this.N)} × ${labelOf(c2 * this.N + j, this.N)}`;
  }
  pairName(p) {
    const [c1, c2] = this.pairs[p];
    return `${CAT_SHORT[c1]}×${CAT_SHORT[c2]}`;
  }

  // ── 落子 ───────────────────────────────────────────────────────────────────
  setCell(idx, val) {
    if (idx < 0 || idx >= this.cells) return false;
    const prev = this.marks[idx];
    if (prev === val) return false;
    this.marks[idx] = val;
    this.undoStack.push({ idx, prev });
    this.steps++;
    this.hintHi[idx] = 0;
    return true;
  }
  /** 点一下：空 → ✗ → ✓ → 空。 */
  tap(p, i, j) {
    const idx = this.idx(p, i, j);
    const next = MARK_CYCLE[(MARK_CYCLE.indexOf(this.marks[idx]) + 1) % MARK_CYCLE.length];
    return this.setCell(idx, next);
  }
  /** 直接给一个值（键盘 x/o/⌫ 走这条；与 tap 共用 undo，所以撤销不需要知道来源）。 */
  press(p, i, j, val) { return this.setCell(this.idx(p, i, j), val); }
  undo() {
    const last = this.undoStack.pop();
    if (!last) return false;
    if (this.marks[last.idx] === last.prev) return true;  // 撤销不产生新落子，但也不许丢记账
    this.marks[last.idx] = last.prev;
    this.steps = Math.max(0, this.steps - 1);
    return true;
  }
  clearMarks() {
    this.marks.fill(EMPTY);
    this.hintHi.fill(0);
    this.undoStack.length = 0;
  }

  /**
   * 玩家自己写出来的 ✓ 是否**互相打架**：同一个 pair 里一行出现两个 ✓，或一列出现两个 ✓，
   * 就是说"同一个物品的房子等于两个不同的物品"，这在合法盘上不可能。
   * 这条读数只用注记与几何，不碰题面、更不碰答案 —— 它是"这盘做歪了"的第一个信号。
   */
  contradictions() {
    const out = [];
    const N = this.N;
    for (let p = 0; p < this.nPairs; p++) {
      for (let i = 0; i < N; i++) {
        let seen = 0, first = -1;
        for (let j = 0; j < N; j++) if (this.at(p, i, j) === CHECK) { if (first < 0) first = j; seen |= 1 << j; }
        if (POP[seen] > 1) out.push({ p, kind: 'row', i, cols: POP[seen], text: `${this.cellName(p, i, first)} 与 ${this.pairs[p][1]} 行的另外 ${POP[seen] - 1} 个 ✓ 冲突` });
      }
      for (let j = 0; j < N; j++) {
        let seen = 0, first = -1;
        for (let i = 0; i < N; i++) if (this.at(p, i, j) === CHECK) { if (first < 0) first = i; seen |= 1 << i; }
        if (POP[seen] > 1) out.push({ p, kind: 'col', j, rows: POP[seen], text: `${this.cellName(p, first, j)} 所在列上有 ${POP[seen]} 个 ✓` });
      }
    }
    return out;
  }

  counts() {
    let cross = 0, check = 0;
    for (let k = 0; k < this.cells; k++) {
      if (this.marks[k] === CROSS) cross++;
      else if (this.marks[k] === CHECK) check++;
    }
    return { cross, check, marked: cross + check, empty: this.cells - cross - check };
  }

  // ── 提示：铅笔的第 k 步，以及这一步新蕴含的格子 ─────────────────────────────
  /** 把 trace 的前 k 步重放成 dom（trace 是唯一的改写来源，所以重放与 solve 的 dom 逐位同）。 */
  static replay(N, trace, k) {
    const dom = new Uint32Array(N * N).fill(fullMask(N));
    for (let t = 0; t < k && t < trace.length; t++) dom[trace[t].item] = trace[t].to;
    return dom;
  }
  /**
   * 第 k 步提示。**现算现丢**：跑一次带 trace 的 pencil，取出这一步，返回的对象里没有任何
   * 完整 dom 数组（before/after 只在函数体内用来算交集）。
   * 新蕴含的格子只由 dom 的交算：
   *   ✗：这一步之前 (v,b) 还有共同候选房子，之后交集为空 ⇒ 这一格可以划掉。
   *   ✓：之后两边都是同一个单点 ⇒ 这一格可以打勾。
   * 这两个判据都是"候选集合"的性质，不是答案的性质。
   */
  hintStep(k) {
    const N = this.N;
    const trace = solve(N, this.clues, { rules: FULL_RULES, trace: true }).trace;
    if (!trace || k >= trace.length) return null;
    const step = trace[k];
    const before = Game.replay(N, trace, k);
    const after = Game.replay(N, trace, k + 1);
    const v = step.item, cv = catOf(v, N), iv = v % N;
    const cross = [], check = [];
    for (let p = 0; p < this.nPairs; p++) {
      const [c1, c2] = this.pairs[p];
      if (c1 !== cv && c2 !== cv) continue;
      const other = c1 === cv ? c2 : c1;
      for (let j = 0; j < N; j++) {
        const b = other * N + j;
        const row = c1 === cv ? iv : j, col = c1 === cv ? j : iv;
        const wasLive = (before[v] & before[b]) !== 0;
        const isLive = (after[v] & after[b]) !== 0;
        const idx = this.idx(p, row, col);
        if (!isLive && wasLive) cross.push({ idx, p, row, col, name: this.cellName(p, row, col) });
        else if (isLive && POP[after[v]] === 1 && after[v] === after[b] && !(POP[before[v]] === 1 && before[v] === before[b])) {
          check.push({ idx, p, row, col, name: this.cellName(p, row, col) });
        }
      }
    }
    const clue = step.why && Number.isInteger(step.why.clue) ? this.clues[step.why.clue] : null;
    const houses = [];
    for (let h = 0; h < N; h++) if (step.removed & (1 << h)) houses.push(h + 1);
    return {
      k, rule: step.rule, doc: RULE_DOC[step.rule], item: v, itemLabel: labelOf(v, N),
      clueIdx: clue ? this.clues.indexOf(clue) : null, clueText: clue ? describeClue(clue, N) : null,
      cat: step.why && Number.isInteger(step.why.cat) ? step.why.cat : cv,
      probe: step.why ? step.why.probe : null,
      houses, from: step.from, to: step.to, cross, check,
      text: this.hintText(step.rule, labelOf(v, N), houses, clue ? describeClue(clue, N) : null, cross, check),
      total: trace.length,
    };
  }
  hintText(rule, itemLabel, houses, clueText, cross, check) {
    const bits = [];
    if (clueText) bits.push(`线索「${clueText}」`);
    bits.push(`${itemLabel} 不再住 ${houses.map((h) => `第 ${h} 间`).join('、')}`);
    if (cross.length) bits.push(`划掉 ${cross.length} 格`);
    if (check.length) bits.push(`打勾 ${check.length} 格`);
    return `${rule} ${RULE_DOC[rule]} · ${bits.join(' · ')}`;
  }
  /** 按一下"提示"：交出下一步，并把这一步蕴含的格子标在画布上（不落进玩家的注记）。 */
  hint() {
    const step = this.hintStep(this.hintAt);
    if (!step) return null;
    this.hintAt += 1;
    this.hints++;
    this.hintHi.fill(0);
    for (const c of step.cross) this.hintHi[c.idx] = CROSS;
    for (const c of step.check) this.hintHi[c.idx] = CHECK;
    return step;
  }
  clearHint() { this.hintHi.fill(0); }

  // ── 答案面板：把玩家说的话折成 truth 形状，交给 rules.checkSolution ──────────
  /**
   * @param claim 长度 N*N 的数组，claim[cat*N + item] = 该物品的房子编号 0..N-1（-1 = 没说）
   * @returns {complete, claim, res} res = checkSolution 的读数（不完整时不判）
   */
  judge(claim) {
    const N = this.N;
    let missing = 0;
    for (let k = 0; k < N * N; k++) if (!(claim[k] >= 0 && claim[k] < N)) missing++;
    if (missing) return { complete: false, missing };
    const filled = Int8Array.from(claim);
    const res = checkSolution(N, filled, this.clues);
    return { complete: true, missing: 0, claim: filled, res };
  }
  /**
   * 本档"那一问"问的是哪个物品。**3 类档没有「鱼」**：CATALOG 的宠物列是
   * ['狗','猫','鸟','鱼','兔','龟']，档位只取前 N 个 ⇒ N=3 时盘上的宠物是 狗/猫/鸟。
   * 所以问题按档位实指：N>=4 问「谁养鱼」，N=3 问「谁养鸟」，并且把"这一档没有鱼"写在文案里。
   * 占位页那句"把宠物列的「鱼」对齐到人列"在 t1 上是一句问不存在的东西的话，阶段二改掉。
   */
  question() {
    const N = this.N;
    const petCat = 2, personCat = 0;
    const hasFish = N > 3;
    const petIdx = hasFish ? 3 : 2;
    return {
      petCat, personCat, petIdx, item: CATALOG[petCat][petIdx],
      label: labelOf(petCat * N + petIdx, N),
      text: hasFish ? '谁养鱼？' : '谁养鸟？（3 类档的宠物列只有 狗/猫/鸟，本盘没有「鱼」）',
    };
  }
  /** "谁养 X"用**玩家自己填的**分配读出来：X 所在的那间房里住的是谁。引擎的答案一个都不读。 */
  petOwner(claim) {
    const N = this.N;
    const q = this.question();
    if (!(claim && claim.length === N * N)) return null;
    const h = claim[q.petCat * N + q.petIdx];
    if (!(h >= 0 && h < N)) return null;
    for (let i = 0; i < N; i++) if (claim[q.personCat * N + i] === h) return { house: h + 1, who: CATALOG[q.personCat][i], item: q.item };
    return null;
  }

  // ── 存档 ───────────────────────────────────────────────────────────────────
  encode() {
    let s = '';
    for (let k = 0; k < this.cells; k++) s += this.marks[k].toString();
    return s;
  }
  /** 长度与字符集都不对 ⇒ false：宁可丢档也不画一张错盘。 */
  decode(str) {
    if (typeof str !== 'string' || str.length !== this.cells || !/^[012]*$/.test(str)) return false;
    for (let k = 0; k < this.cells; k++) this.marks[k] = str.charCodeAt(k) - 48;
    this.undoStack.length = 0;
    this.hintHi.fill(0);
    return true;
  }
}

export { TIERS };
