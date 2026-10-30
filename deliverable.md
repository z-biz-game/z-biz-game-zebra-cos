# 谁养鱼 ZEBRA · 交付卡

> 本文件由 `003_辅助能力/audit/script/gen_deliverable.py` 从本仓 README、package.json 与 `git ls-files` 生成，**不要手改**；改源后重跑，`--check` 必须逐字节一致。
> 读数取自本仓 `git ls-files` 与 package.json，均不含本文件自身；这里不写提交号，所以 `--check` 比的是内容，不是时间。

## 一句话

纸笔逻辑格（logic grid）：街上排着 N 间房子，每间在 N 个类别上各取一个值，每个类别的值恰好各用一次；

- 仓名：`z-biz-game-zebra-cos`　组别：E · 生成艺术与交互视觉
- 技术栈：Electron + Canvas

## 怎么跑

```sh
npm start    # node server.cjs
```

## 怎么验

| 层 | 命令 |
| --- | --- |
| 整仓门禁 | `bash tools/verify.sh` |
| 单元/规则测试 | `npm test` |

## 规模

| 指标 | 读数 |
| --- | ---: |
| 跟踪文件 | 56 |
| 应用代码 | 3,078 行（JS 2,705 / CSS 278 / HTML 95） |
| 测试/工具文件 | 16 个 |
| 依赖 | `dependencies` 0 / `devDependencies` 0 |
| 位图资产（不含 shots） | 11 个 / 478 KB |

## 目录

```
.github .gitignore LICENSE README.md assets css docs icons index.html js manifest.json manifest.webmanifest package.json server.cjs sw.js test tools
```

## 已知边界

- **不做关卡包**。没有 `levels.json`、没有手工盘。所有盘由 seed 现算：`zebra|<档位>|<盘号>`。
  手工盘会绕过全部五道闸（四道度量闸 + 浏览器闸），那本仓的证明就只覆盖一部分商品 —— 不如宣称零覆盖。
- **提示不抄答案，也不代劳**。阶段一写过"不做注记 UI"，那句已经过期：注记 UI 现在是真的
  （`js/ui/game.js:151` + `js/render/board.js:118`），但口径没换——推理口径仍然只住在 `js/engine/pencil.js` 里，
  UI 只是把铅笔真的删过的那些格换算成"可以划掉/可以打勾"。这一步删不动任何格子时，提示仍然念规则，
  画布上不多涂一笔（`hint` 场景两种情形都断）。
- **不说"线索越少越难"**。线索数是**可用但不服从**的难度轴：台阶实验（把已删的线索按原路加回去，
  量剩余未定值）在 t1/t2/t3 各测到 **1 次台阶倒退**（120 / 140 / 160 次相邻步，
  秩相关 rho = −0.138 / 0.012 / 0.054，命令 `SAMPLES=60 node tools/balance.mjs`）。
  原因是 P5（房位容量）这类**存在性**规则不是支撑规则，加一条线索可能撤销整条连锁。
  所以 `band` 用的是 draws/盘，不是原始线索数。**这也是本 README 里没有"难度=线索条数"这句话的理由。**
- **不说"某条线索把经典题变成非唯一"**。Karttunen 的核对是有出处的另一回事：原题面的 15 条形语言约束
  留下 **5 个解**，要再补一条题面**背景预设**才塌缩成 1 个解 —— 所以本仓把"唯一"交给裁判数，
  不交给题面传统。至于"挪威人住第一间 vs 蓝房子相邻那条导致不唯一"，是**网络讹传**，
  本轮溯源 NOT FOUND，本仓不写。
- **不把 `stopped` 四舍五成"唯一"**。裁判被预算掐断时 `outcome='stopped'`，`provesUnique()` 返回 false，
  门禁直接红。唯一性是一个**预算内的穷举计数**，不是一个感觉。

## 证据

- 重跑：在 lead 仓根执行 `python3 003_辅助能力/audit/script/gen_deliverable.py ../z-biz-game-zebra-cos --check`，应与本文件逐字节一致。
- 漂了就重跑并复核读数变化：新增文件、改 README 的边界小节、加/删闸都会让它变，这些变化本身就是要看的内容。
