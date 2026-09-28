# 谁养鱼 ZEBRA

纸笔逻辑格（logic grid）：街上排着 N 间房子，每间在 N 个类别上各取一个值，每个类别的值**恰好各用一次**；
题面给若干句话，问"谁养鱼"。

**本仓现状：阶段一 —— 引擎与度量闸。**UI 是一个占位页（只出题、只画题面、只念回执），
交互、注记、提示都在阶段二。下面每个数字都来自本机跑过的一条命令，命令就写在数字旁边。

```
node --test test/                    tests 29 · pass 29 · fail 0        （2026-09-28，node v26.8.1）
node tools/rule-test.mjs             RESULT rule-test ok=true checks=1353 fails=0
node tools/counter-test.mjs          RESULT counter-test ok=true checks=285 fails=0
node tools/pencil-test.mjs           RESULT pencil-test ok=true checks=31 fails=0
SAMPLES=24 node tools/balance.mjs    RESULT balance ok=true tiers=3 boards=72 reds=0
```

## 我们承诺什么

出货的每一盘同时被**两条互不复用的通道**判过：

1. **铅笔**（`js/engine/pencil.js`）：8 条具名规则 P1–P8，不回溯、不猜，从空盘推到底。
   推不完 ⇒ 整张丢弃重抽。这是"人能不能真做出来"的判据。
2. **裁判**（`js/engine/counter.js`）：传播引导的穷举，`limitSolutions:2`。数完全树且只数到 1 个解
   ⇒ 唯一性被**证明**。解空间是 (N!)^N = 216 / 331,776 / 24,883,200,000（3/4/5 类），
   靠枚举全部填法证唯一是不可能的，只能靠线索剪树。
   另有一个**不做任何传播**的独立见证（`js/engine/witness.js`）抽样对账，防的是"裁判自洽地给出一个错的唯一"。

难度不是标签，是量出来的：`js/engine/generate.js` 里 `TIERS[].band`（每出一盘要抽几次）和 `TIERS[].budgetMs`
都由 `SAMPLES=60 node tools/balance.mjs` 的分位表**回填**，且取 p95 尾巴，不取中位×2。改权重、加规则、
换机器 ⇒ 数字重抄；不重抄会被红线打红。

| 档 | 规模 | 线索数（中位·均值） | draws/盘 中位·p95 | 生产裁判 p95 | budgetMs |
|---|---|---|---|---|---|
| t1 | 3 类 × 3 户 | 5 · 5.0 | 1 · 2 | 0.012 ms | 10 ms |
| t2 | 4 类 × 4 户 | 10 · 10.2 | 2 · 6 | 0.008 ms | 10 ms |
| t3 | 5 类 × 5 户（原题规模） | 17 · 16.8 | 3 · 9 | 0.012 ms | 10 ms |

表头那三列出自 `SAMPLES=60 node tools/balance.mjs`（三档各 60 张盘、180/180 出货、reds=0，本机 2026-09-28）。

## 不做什么（以及为什么）

- **不做关卡包**。没有 `levels.json`、没有手工盘。所有盘由 seed 现算：`zebra|<档位>|<盘号>`。
  手工盘会绕过全部四道闸，那本仓的证明就只覆盖一部分商品 —— 不如宣称零覆盖。
- **不做做注 UI**（阶段一）。逻辑格题的"打勾打叉"是 UI 层的糖，推理口径在铅笔里已经钉死；
  先把"这盘推得完"变成可证的事，再画那个格子。
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

## 跑起来

```
node server.cjs               # http://127.0.0.1:5321/  （端口预留：web 5321 / CDP 9321）
node --test test/             # 单元测试
node tools/balance.mjs        # 难度实测台（默认 SAMPLES=12；重抄 band 用 SAMPLES=60）
```

零运行时依赖、零构建步骤、`js/` 全是 ES module。CI（`.github/workflows/ci.yml`）**不跑 npm install**：
只做语法检查、分层 grep 闸、四道闸与 `SAMPLES: "24"` 的 balance。

## 线索词汇表

ZebraLogic（arXiv 2502.01100）那 11 条句子类型，不多不少（定义只写在 `js/engine/rules.js` 一处）：
`at` / `not` / `same` / `not_same` / `direct_left` / `direct_right` / `side_by_side` / `not_side_by_side` /
`somewhere_left` / `somewhere_right` / `n_between`（本地约定 n≥1，n=0 与 `side_by_side` 重合会污染
"逐条不可约"这个判据）。方向口径按题面钉死：**"右"是观察者的右手**，所以 `direct_left` 与
`direct_right` 是两条不同的线索。

## 目录

```
js/engine/rules.js      词汇表 + 合法盘定义（唯一一份）
js/engine/rng.js        splitmix32：全仓唯一随机数入口，比较器不吃随机数
js/engine/counter.js    传播引导的裁判（允许搜索）
js/engine/witness.js    不做传播的独立见证（抽样对账）
js/engine/pencil.js     P1–P8 具名规则铅笔（不允许搜索）
js/engine/generate.js   出题流水线 + TIERS 表
js/main.js              阶段一占位页
tools/rule-test.mjs     词汇表/语义/支撑表闸（1353 项）
tools/counter-test.mjs  裁判 vs 见证、stopped 语义、单调性闸（285 项）
tools/pencil-test.mjs   铅笔 soundness/完备性/能力上界/负对照闸（31 项）
tools/balance.mjs       难度实测台：出货、唯一、不可约、成本、阶梯、红线
test/                   node --test 单元测试（29 项）
docs/DESIGN.md          设计说明与被否决的写法
```

出处核对日期：2026-09-28（Life International 1962-12-17 题面经 Wikipedia "Zebra puzzle" 词条核对；
NP-完全性经 Quasigroup Completion，Sempolinski 2009）。
