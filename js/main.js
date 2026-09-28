// 阶段一占位 UI · 谁养鱼
//
// 这个文件只做三件事：出题、把题面画出来、把引擎的回执念一遍。它**不是**游戏：
// 没有格子注记、没有提示、没有判分交互 —— 那些是阶段二的活（连同 tools/verify.sh 与
// CI 的浏览器 job 一起落地，端口已为它预留：web 5321 / CDP 9321）。
// 之所以现在就占一个 canvas：门禁要检查"入口文件真的把引擎接上了"，而接上的最好证据
// 是浏览器里真能拿到一张被证明过唯一的盘。
//
// 渲染不做任何判定：所有关于"这盘合法吗 / 唯一吗 / 推得完吗"的话都来自引擎的读数。

import { CATALOG, CAT_SHORT, describeClue } from './engine/rules.js';
import { TIERS, generate, proveBoard } from './engine/generate.js';

const tierSel = document.getElementById('tier');
const seedInput = document.getElementById('seed');
const statusEl = document.getElementById('status');
const clueList = document.getElementById('cluelist');
const receiptEl = document.getElementById('receipt');
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

for (const t of TIERS) {
  const opt = document.createElement('option');
  opt.value = t.key;
  opt.textContent = t.label;
  tierSel.appendChild(opt);
}
tierSel.value = 't1-3cat';

const CELL = 34;

function drawBoard(tier, truth) {
  const { N } = tier;
  const houseW = 92;
  canvas.width = 40 + N * houseW + 8;
  canvas.height = 30 + N * (CELL + 2) + 8;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '13px ui-sans-serif, system-ui, "PingFang SC", sans-serif';
  ctx.textBaseline = 'middle';

  // 房子：观察者左手到右手，编号 1..N（"right" 是观察者的右手，题面口径）
  for (let h = 0; h < N; h++) {
    ctx.fillStyle = h % 2 ? '#f2ede4' : '#fbf8f2';
    ctx.fillRect(40 + h * houseW, 30, houseW - 6, N * (CELL + 2));
    ctx.fillStyle = '#3a3733';
    ctx.fillText(`第 ${h + 1} 间`, 40 + h * houseW + 8, 18);
  }
  // 逻辑格：行 = 类别，列 = 房子；已定值打在格子里（占位阶段只显示，不可点）
  for (let c = 0; c < N; c++) {
    const y = 30 + c * (CELL + 2);
    ctx.fillStyle = '#3a3733';
    ctx.fillText(CAT_SHORT[c], 6, y + CELL / 2);
    for (let h = 0; h < N; h++) {
      ctx.strokeStyle = '#cfc7b8';
      ctx.strokeRect(40 + h * houseW, y, houseW - 6, CELL);
    }
    for (let i = 0; i < N; i++) {
      const h = truth[c * N + i];
      if (h < 0) continue;
      ctx.fillStyle = '#1b1a18';
      ctx.fillText(CATALOG[c][i], 40 + h * houseW + 8, y + CELL / 2);
    }
  }
}

function render() {
  const tier = TIERS.find((t) => t.key === tierSel.value);
  const seed = seedInput.value.trim() || '0';
  statusEl.textContent = '出题中…';
  const g = generate(tier.key, seed);
  if (!g.ok) {
    // 出货失败是**引擎的事实**，不是 UI 的错误：把拒收账原样念出来。
    drawBoard(tier, new Int8Array(tier.N * tier.N).fill(-1));
    clueList.replaceChildren();
    receiptEl.textContent = `抽满 ${g.draws} 次仍无货：${JSON.stringify(g.failures)}`;
    statusEl.textContent = '本盘号未出货';
    return;
  }
  const proof = proveBoard(tier, g.clues, g.truth);
  drawBoard(tier, g.truth);
  clueList.replaceChildren(...g.clues.map((clue) => {
    const li = document.createElement('li');
    li.textContent = describeClue(clue, tier.N);
    return li;
  }));
  receiptEl.textContent = [
    `seed            ${g.seedStr}`,
    `线索            ${g.clues.length} 条 · 抽取 ${g.draws} 次 · 裁判调用 ${g.receipt.refereeCalls} 次`,
    `唯一性          ${proof.outcome}（${proof.nodes} 节点 / ${proof.ms.toFixed(3)} ms · stopped=${proof.stopped}）`,
    `铅笔            ${proof.pencilSolved ? '空盘推完' : `剩 ${proof.pencilUndecided} 未定`} · 规则 ${g.receipt.pencilRules}`,
    `规则出场        ${JSON.stringify(proof.pencilFire)}`,
    `真值自洽        ${proof.truthOk ? 'ok' : proof.truthReasons.join(' / ')}`,
    '问              谁养鱼？（把宠物列的「鱼」对齐到人列 —— 答案不在这一页上显示）',
  ].join('\n');
  statusEl.textContent = `已出货 · ${tier.label} · 第 ${seed} 盘`;
}

tierSel.addEventListener('change', render);
seedInput.addEventListener('change', render);
document.getElementById('next').addEventListener('click', () => {
  const n = Number(seedInput.value);
  seedInput.value = Number.isFinite(n) ? String(n + 1) : `${seedInput.value}+`;
  render();
});
render();
