// 存档 · 谁养鱼（唯一的一个 localStorage 键）
//
// 口径钉死：这个键里只准有 **seed + 玩家的注记 + 步数**，绝不许有答案字段。
// 理由不是洁癖：本仓的盘是 seed 的纯函数，存档里带答案等于把答案发进浏览器存储，
// 而阶段二的浏览器闸要断言"存档里没有答案"（tools/scenarios.js 的 resume 那一对）。
// 写盘的时候按字段白名单挑，不按"删掉不该有的"—— 白名单不会把未来的答案字段顺手带出去。
//
// 键形状：`zebra.save.v1`，值：{"v":1,"tier":"t1-3cat","seed":"b0","marks":"012…","steps":7,"hints":2}
// marks 是三态串的逐格拼接（0 空 / 1 ✗ / 2 ✓），长度 = 类别对数 × N²，与档位一起决定几何。

export const SAVE_KEY = 'zebra.save.v1';
export const SAVE_FIELDS = Object.freeze(['v', 'tier', 'seed', 'marks', 'steps', 'hints']);

/** 只从白名单里取字段；取不到就是没有存档（不猜、不补默认值）。 */
export function pack(state) {
  const out = { v: 1, tier: String(state.tier), seed: String(state.seed), marks: String(state.marks) };
  out.steps = Number.isFinite(state.steps) ? state.steps : 0;
  out.hints = Number.isFinite(state.hints) ? state.hints : 0;
  return out;
}

export function save(store, state) {
  try {
    const text = JSON.stringify(pack(state));
    // 生产里传进来的就是存储全局量本身（见 js/main.js）；注入了替身时走替身。
    if (store === globalThis.localStorage) globalThis.localStorage.setItem(SAVE_KEY, text);
    else store.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;                       // 无痕模式 / 配额爆：静默继续玩，但不假装存住了
  }
}

/** 读档：结构不对就当作没有，绝不返回半截状态（半截 marks 会画出一张鬼盘）。 */
export function load(store) {
  let raw = null;
  try {
    raw = store === globalThis.localStorage ? globalThis.localStorage.getItem(SAVE_KEY) : store.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || obj.v !== 1) return null;
  if (typeof obj.tier !== 'string' || typeof obj.seed !== 'string' || typeof obj.marks !== 'string') return null;
  if (!/^[012]*$/.test(obj.marks)) return null;
  if (!Number.isFinite(obj.steps) || !Number.isFinite(obj.hints)) return null;
  return { v: 1, tier: obj.tier, seed: obj.seed, marks: obj.marks, steps: obj.steps, hints: obj.hints };
}

export function clear(store) {
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 存档里出现答案字段的名字 ⇒ 闸红。这里给闸一个单点定义，不散在正则里。 */
export const ANSWERISH = /(truth|solution|answer|pos\b|assign|dom\b)/i;
