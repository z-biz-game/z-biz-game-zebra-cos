// 画布渲染 · 逻辑格（三态：空 / ✗ / ✓）+ 几何 + 命中
//
// 这里**不做任何判定**：盘该不该出货、提示该说什么、答案对不对，全部是 js/ui/game.js 与
// js/engine/ 的事。渲染层只交出两样东西 —— 画出来的像素，和"这一点落在哪一格"的几何。
// 浏览器闸读的就是这两样：像素用 getImageData 数（真栅格化，SwiftShader 会把它变成假读数），
// 几何用 cellRect()/cellAt() 算命中盒，并要求**命中半径跟着格子尺寸走**（小屏上格子缩到 24px
// 时还按 44px 的半径收点，会点到隔壁格 —— 兄弟仓的指针闸就是红在这里过）。
//
// 尺寸口径：格子边长 = 可用宽度与可用高度共同决定，clamp 在 [24, 68]；标签列宽随字号走。
// 换档位（N=3/4/5）与换视口（390×844 起）都必须画得下且不出现横向滚动条 —— layout 场景逐条断。

import { CATALOG, CAT_SHORT } from '../engine/rules.js';
import { CHECK, CROSS, EMPTY } from '../ui/game.js';

const INK = '#1b1a18';
const INK_SOFT = '#5c564d';
const LINE = '#cfc7b8';
const LINE_BOLD = '#8a8378';
const PAPER = '#ffffff';
const PAPER_ALT = '#f2ede4';
const HINT_CROSS = 'rgba(190,60,50,.20)';
const HINT_CHECK = 'rgba(40,120,70,.22)';
// 嫌疑格底纹：注记冲突那一行/那一列上**还空着**的格子。BAD 的稀薄版本，够看见又不像落子。
const SUSPECT = 'rgba(178,58,48,.09)';
const ACCENT = '#8a5a2b';
const CURSOR = '#2b6cb0';
const BAD = '#b23a30';

export const COLORS = Object.freeze({ ink: INK, line: LINE, accent: ACCENT, hintCross: HINT_CROSS, hintCheck: HINT_CHECK, cursor: CURSOR, bad: BAD, paper: PAPER });

export class GridView {
  /** @param canvas 目标 canvas；容器宽度决定可用宽度 */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.geo = null;
  }

  /** 重算几何：先按容器宽度定格子边长，再倒推整张画布的尺寸。 */
  layout(game, availW, availH) {
    const canvas = this.canvas;          // 浏览器闸第一次跑就在这一行抓到 ReferenceError：
                                         // 上面 constructor 里把元素存成 this.canvas，这里曾经直接
                                         // 写裸名 canvas —— node 侧的测试碰不到 DOM，只有真浏览器会红。
    const N = game.N;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const font = N <= 3 ? 13 : N <= 4 ? 12 : 11;
    const labelW = Math.round(font * 3.6) + 10;                 // 三名汉字 + 内边距
    const labelH = Math.round(font * 1.6) + 8;
    const gap = 34;                                             // 房子编号说明占的那一行
    const byW = Math.floor((availW - labelW - 12) / N);
    const byH = Math.floor((availH - labelH - gap - 12) / N);
    const cell = Math.max(24, Math.min(68, Math.min(byW, byH)));
    const gridW = cell * N, gridH = cell * N;
    const w = labelW + gridW + 12;
    const h = labelH + gridH + gap + 8;
    const x = labelW + 6, y = labelH + 2;
    this.geo = { N, dpr, font, cell, labelW, labelH, gridW, gridH, w, h, x, y, gap, availW, availH };
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.dataset.n = String(N);
    canvas.dataset.cell = String(cell);
    return this.geo;
  }

  /** 一格的 CSS 像素矩形（相对画布左上角）；闸用它算命中点。 */
  cellRect(row, col) {
    const g = this.geo;
    return { x: g.x + col * g.cell, y: g.y + row * g.cell, w: g.cell, h: g.cell };
  }
  /** 命中半径：**跟着格子边长走**，不是写死 44px。 */
  hitRadius() { return Math.max(6, Math.round(this.geo.cell * 0.4)); }
  /** 画布内坐标（不含 rect 偏移）→ 格子；越界返回 null。 */
  cellAt(cx, cy) {
    const g = this.geo;
    if (!g) return null;
    if (cx < g.x || cy < g.y || cx >= g.x + g.gridW || cy >= g.y + g.gridH) return null;
    return { row: Math.floor((cy - g.y) / g.cell), col: Math.floor((cx - g.x) / g.cell) };
  }

  /**
   * 全量重画。
   * @param game  模型
   * @param opts  {conflictIdx:Set<number>}
   *   conflictIdx 是"嫌疑格"全集（冲突行/冲突列上的每一格，含还空着的）—— 由 js/main.js 的
   *   conflictSet() 从 game.contradictions() 折出来，渲染层只认这个集合，不自己判冲突。
   *   不传或传空集合 ⇒ 全画布没有任何红。
   */
  draw(game, opts = {}) {
    const g = this.geo;
    if (!g) return;
    const ctx = this.ctx;
    const [c1, c2] = game.pairs[game.cursor.p];
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, g.w, g.h);
    ctx.textBaseline = 'middle';

    // 表头：行 = 类别 c1 的物品，列 = 类别 c2 的物品
    ctx.font = `600 ${g.font}px ui-sans-serif, system-ui, "PingFang SC", sans-serif`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(`${CAT_SHORT[c1]} \\ ${CAT_SHORT[c2]}`, 4, g.y - g.labelH / 2 + 2);
    for (let j = 0; j < g.N; j++) {
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'center';
      ctx.fillText(shorten(CATALOG[c2][j], g.N), g.x + j * g.cell + g.cell / 2, g.y - g.labelH / 2);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i < g.N; i++) {
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(shorten(CATALOG[c1][i], g.N), g.x - 6, g.y + i * g.cell + g.cell / 2);
    }
    ctx.textAlign = 'left';

    // 底纹 + 提示高亮 + 注记
    const marks = game.marks, hi = game.hintHi, cell = g.cell;
    for (let i = 0; i < g.N; i++) {
      for (let j = 0; j < g.N; j++) {
        const r = this.cellRect(i, j);
        const idx = game.idx(game.cursor.p, i, j);
        const m = marks[idx];
        const bad = !!(opts.conflictIdx && opts.conflictIdx.has(idx));
        ctx.fillStyle = (i + j) % 2 ? PAPER_ALT : PAPER;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (hi[idx]) {
          ctx.fillStyle = hi[idx] === CROSS ? HINT_CROSS : HINT_CHECK;
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        if (bad && m === EMPTY) { ctx.fillStyle = SUSPECT; ctx.fillRect(r.x, r.y, r.w, r.h); }
        if (m === CROSS || m === CHECK) {
          ctx.fillStyle = bad ? BAD : (m === CHECK ? INK : '#6b4a2f');
          ctx.font = `${Math.round(cell * 0.56)}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(m === CHECK ? '✓' : '✗', r.x + r.w / 2, r.y + r.h / 2 + 1);
          ctx.textAlign = 'left';
        }
        // 冲突行/列上的**每一**格都描红边（含还空着的那些）：纸笔口径是"整行都是嫌疑格"，
        // 只给已经落子的那两格变色等于让玩家自己去猜第三格算不算嫌疑。
        ctx.strokeStyle = bad ? BAD : LINE;
        ctx.lineWidth = bad ? 2 : 1;
        ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
      }
    }
    // 粗线：类别块边界（N 是奇数时每 N 格一条，纸笔惯例只是外框 + 中缝）
    ctx.strokeStyle = LINE_BOLD;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(g.x - .5, g.y - .5, g.gridW + 1, g.gridH + 1);

    // 光标：只有画布拿到焦点才画实心框，键盘与鼠标走同一套读数
    const cur = game.cursor;
    const cr = this.cellRect(cur.i, cur.j);
    ctx.strokeStyle = CURSOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(cr.x + 1, cr.y + 1, cr.w - 2, cr.h - 2);
    ctx.font = `${g.font}px ui-sans-serif, system-ui, "PingFang SC", sans-serif`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(`${game.pairName(cur.p)} · ${CAT_SHORT[c1]}行 ${CAT_SHORT[c2]}列 · 第 ${cur.i + 1} 行 第 ${cur.j + 1} 列`, g.x, g.y + g.gridH + g.gap / 2 - 4);
  }
}

/** 列宽有限：颜色名去掉"房子"后缀（红房子→红），其余类别原样。 */
export function shorten(name, N) {
  void N;
  const m = /^(红|蓝|绿|黄|白|紫)房子$/.exec(name);
  return m ? m[1] : name;
}
