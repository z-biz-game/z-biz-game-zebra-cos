// 秒表：本仓唯一吃每帧 dt 的地方，也是关卡内「帧率对拍」的靶子。
//
// 不变式：读数只由累计的**真实秒数**决定，与刷新率无关。把同一段墙上时间用 30 / 60 / 120Hz
// 三种时间戳序列喂进 tick()，seconds 必须一致——因为每步加的是真正的 elapsed（dt）。
// 阴性对照：把 `sw.accum += dt` 改成 `sw.accum += 1 / 60`（按帧计秒，写死 60Hz），
// 于是 30Hz 走得慢一半、120Hz 走快一倍，对拍立刻在 30/120 上分叉、报红。
// 这个 mutation 恰好落在这条唯一消费 frame dt 的行上，所以它对拍能抓到；纸笔推理本身没有
// 别的吃 dt 的行（画布只在交互时重绘，不进 rAF），不存在第二处可被同样的变异命中。

/** 一只新表：running=是否在走，accum=不足一秒的残量，last=上一帧时间戳（0=还没对齐）。 */
export function makeStopwatch() {
  return { running: true, accum: 0, last: 0, seconds: 0 };
}

/**
 * 推进一秒表。now 是 requestAnimationFrame 回调给的毫秒时间戳（performance.now 时基）。
 * dt 用相邻两帧的差现算：刷新率换成 30 还是 120，累计出的 dt 总和都等于真实流逝秒数。
 */
export function tick(sw, now) {
  const dt = sw.last ? (now - sw.last) / 1000 : 0;
  sw.last = now;
  if (!sw.running) return sw;                 // 暂停：冻结累计，但不清读数
  sw.accum += dt;                              // ← 帧率无关的累计；阴性对照就把这条改成 += 1/60
  while (sw.accum >= 1) { sw.accum -= 1; sw.seconds += 1; }
  return sw;
}

/** 暂停 / 继续。恢复时把 last、accum 归零：不补上暂停期间流逝的那段（停表语义，不是清表）。 */
export function togglePause(sw) {
  if (sw.running) {
    sw.running = false;
  } else {
    sw.running = true;
    sw.last = 0;
    sw.accum = 0;
  }
  return sw.running;
}
