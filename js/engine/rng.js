// 随机数 · 本仓唯一入口
//
// 全仓只有这一个 PRNG，只吃字符串。任何"看上去更随机"的写法（Math.random / Date.now / loadavg /
// Object 遍历序）一律不许出现在判定路径上：门禁要在三台机器上得到同一批盘，浏览器和 node 也要
// 给同一张，否则 balance.mjs 打印的分位表就是一张不能对账的读数。
//
// seed 串的形状钉死为 `zebra|<tier>|<seed>`：档位写在串里，所以换档不会把另一档的盘重新洗牌，
// 补抽（同一档的第二个 seed）也不会挪动已出货盘的号码。generate() 拿到的就是这个串，
// 一张盘吃几个串见 generate.js 顶部的「一张盘吃完的随机数」一节。
//
// splitmix32：32 位状态、一步一个数，周期 2^32。选型屏用的就是它
// （_tmp-zebra-screen.mjs，2026-09-28 重跑逐字节对上一 digest），换算法等于换一批盘，
// 所以这里连 FNV-1a 的偏移量都保持原样。
//
// 洗牌必须一次性把随机数抽完，比较器里一个都不许抽：node 与 Chrome 的 Array#sort 对
// 相等元素的次序不同（V8 长数组走 TimSort、短的用插入排序），比较器吃随机数会让两边挑出
// 不同的盘 —— 本组织在这个坑上摔过，所以 keyed() 把随机键预抽成数据，排序本身是纯函数。

/** 32 位 FNV-1a：把任意长度的 seed 串压成一个 32 位起点。 */
export function hash32(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** seed 串形状闸：不合规的串直接抛，不静默接受 —— 拼错档名的盘会悄悄跑到别的流上去。 */
export function seedOf(tier, seed) {
  if (!/^[a-z0-9-]+$/.test(String(tier))) throw new Error(`tier 标识不合规范：${tier}`);
  return `zebra|${tier}|${seed}`;
}

export function makeRng(seedStr) {
  let s = hash32(String(seedStr)) >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  return {
    seed: String(seedStr),
    next,
    int: (n) => Math.floor(next() * n) % n,
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    /** Fisher–Yates：随机数在这里一次抽完，比较器不吃随机数。 */
    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
    /**
     * 需要"随机序 + 稳定断键"的场合用这个：预抽随机键，再按 (键 asc, 编号 asc) 排。
     * 换机器、换 sort 实现都得到同一个序 —— 贪心删线索的次序就靠它钉住。
     */
    keyed: (list) => list
      .map((v, i) => ({ v, i, k: next() }))
      .sort((a, b) => (a.k - b.k) || (a.i - b.i))
      .map((x) => x.v),
  };
}
