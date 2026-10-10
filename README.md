# 谁养鱼 ZEBRA

纸笔逻辑格（logic grid）：街上排着 N 间房子，每间在 N 个类别上各取一个值，每个类别的值**恰好各用一次**；
题面给若干句话，问"谁养鱼"。

**本仓现状：阶段二 —— 引擎、四道度量闸、第五道浏览器闸，外加真的纸笔逻辑格 UI。**UI 不再是占位页：三态注记（空/✗/✓）、
类别对导航、键盘与真指针两条通道、来自铅笔 trace 的提示、答案面板交给 `rules.checkSolution` 判分、
`zebra.save.v1` 一个键的存档。下面每个数字都来自本机跑过的一条命令，命令就写在数字旁边。

```
node --test test/*.test.mjs           tests 30 · pass 30 · fail 0        （2026-10-08，node v26.8.1）
node test/docs.test.mjs               RESULT docs-test ok=true checks=15 fails=0
node tools/rule-test.mjs             RESULT rule-test ok=true checks=1353 fails=0
node tools/counter-test.mjs          RESULT counter-test ok=true checks=285 fails=0
node tools/pencil-test.mjs           RESULT pencil-test ok=true checks=31 fails=0
SAMPLES=24 node tools/balance.mjs    RESULT balance ok=true tiers=3 boards=72 reds=0
bash tools/verify.sh                 shape=root    15/15 段 · 413 checks · 0 failed · 15 s
                                     shape=prefix  15/15 段 · 413 checks · 0 failed · 14 s
                                     === ALL GREEN（这一跑实际覆盖的 URL 形态：root prefix）===
                                     （2026-09-28 本机：Chrome 154.0.8037.57 · node v26.8.1 ·
                                      `sysctl -n vm.loadavg` 起 { 9.60 7.91 5.84 } / 终 { 11.14 8.44 6.09 }，
                                      本机同时坐着别的 agent ⇒ 墙钟那两行只当**上界**读；
                                      端口读数 `root web 5322 (want 5321)` —— 5321 被非本仓进程占着，
                                      闸按 `first_free` 挪号并打印谁在听，绝不借别人的 socket）
```

`tools/verify.sh` 每次先跑 `node tools/fixtures.mjs --check`：浏览器里那 14 条夹具（12 盘的题面指纹 +
提示前三步 + 2 块负样本）必须在 node 侧原样重算出来（本机 `14/14 条夹具仍由 node 原样重算出来`），
否则"页内与 node 逐字段相同"那条绿就读作"页面在跟自己的上一版对表"。
端口 5321 在本机被别的进程占着（pid 35244），闸按 `first_free` 挪到 5322 并打印谁在听这一口 —— 它绝不
借别人已经绑上的 socket，因为借来的端口会发**另一个应用**的 index.html。

## 浏览器闸量的是哪六件事

1. **题面来自 seed，不来自时钟**：10 个 shipped 模块剥掉注释后扫 `Math.random(` / `Date.now(` /
   `new Date(` / `getRandomValues`，一次都不许有；同一个 URL 两趟题面指纹相同而 `timeOrigin` 不同
   （片段导航不算重载），换 seed 那一趟必须换盘且不续上一趟的注记。
2. **页面里没有答案路径**：boot 拿 node 算出的真值去扫 `window.zebra` 的对象图（BFS，且断言要求
   "扫过的节点数 > 60"才认这条绿 —— 0 个节点的"扫过了"不算扫过）、
   全部 DOM 属性与 `dataset`、`localStorage`，扫到即红；存档字段走 `js/store.js:12` 的 `SAVE_FIELDS` 白名单。
3. **提示只念铅笔真的删过的那些格**：`js/engine/pencil.js:100` 的 `trace`（`solve(…, {trace:true})` 交回的
   `{rule,item,from,to,removed,why}` 序列）是唯一来源，`js/ui/game.js:217` 的 `hintStep` 用 dom 的交并把它
   换算成"这一格可以划掉/打勾"。文案逐条对到 P1–P8 的规则名与 node 侧那三步的 cross/check 计数；
   某一步删不动任何格子时，画布上必须**一笔提示色都不画**（提示不代劳）。
   `trace` 不改引擎任何一个读数：12 张夹具盘逐个比对 trace 开与关的 `dom/fire/rounds/solved/undecided/used`
   完全一致（12/12），且不开时返回对象里根本没有 `trace` 这个键（12/12）；开 trace 一共交回 498 步真实删除
   （P2 210 · P4 130 · P3 95 · P5 31 · P1 22 · P6 8 · P8 2）。
   命令 `node --input-type=module -e …`（2026-09-28 实跑，输出即上面这串数）。
4. **指针与键盘都到得了**：控件与格子的命中盒都按 `elementFromPoint`（自身中心）举证，命中半径
   `max(6, round(cell×0.4))` 随格子尺寸走而不是写死；390×844 那一腿逐格要求"点得到的那一格 = `cellAt`
   解回的那一格"，1280×1024 与窄屏各跑一遍三个档位。
5. **像素是真的**：`getImageData` 数 ✗ 的棕色墨 `#6b4a2f`、冲突行的红 `#b23a30`、提示高亮的红/绿调，
   并要求撤销与三态循环回到空时**逐位相同**（基线帧 = 光标停在这一格、注记为空的那一帧 —— 光标框画在格子
   内部，所以"落子前"与"清空后"本来就不该逐位相同，差的是那 528 个光标像素，`play` 场景把这句话钉成了
   一条断言）。冲突那一段量的是**整行**：没落子的第三格也被描红，而没有任何冲突的那一行一格红都没有。
6. **闸自己会红**：`canary` 喂两块 node 侧找出的负样本（铅笔推不完 / 节点预算先耗尽），页面必须
   **拒绝出货**——摊开 `#reject` 并把盘面与答案面板收成 `display:none` 且 0 个 rect；`stopped` 那块
   还带正对照（同一张题面在生产预算下判得完），测的是处置而不是"出货盘会停"。

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
| t1 | 3 类 × 3 户 | 5 · 5.0 | 1 · 2 | 0.013 ms | 10 ms |
| t2 | 4 类 × 4 户 | 10 · 10.2 | 2 · 6 | 0.009 ms | 10 ms |
| t3 | 5 类 × 5 户（原题规模） | 17 · 16.8 | 3 · 9 | 0.015 ms | 10 ms |

表头那三列出自 `SAMPLES=60 node tools/balance.mjs`（三档各 60 张盘、180/180 出货、reds=0，本机 2026-09-28，
loadavg 6.4/5.1/3.4 ⇒ 墙钟那三列只当上界读；判定用的 p95 与前两列在中位/p95 上是逐位稳定的）。

## 不做什么（以及为什么）

- **不做关卡包**。没有 `levels.json`、没有手工盘。所有盘由 seed 现算：`zebra|<档位>|<盘号>`。
  手工盘会绕过全部五道闸（四道度量闸 + 浏览器闸），那本仓的证明就只覆盖一部分商品 —— 不如宣称零覆盖。
- **提示不抄答案，也不代劳**。阶段一写过"不做注记 UI"，那句已经过期：注记 UI 现在是真的
  （`js/ui/game.js` + `js/render/board.js`），但口径没换——推理口径仍然只住在 `js/engine/pencil.js` 里，
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

## 跑起来

```
node server.cjs               # http://127.0.0.1:5321/  （端口预留：web 5321 / CDP 9321 / Pages 前缀形态 5421）
node --test test/*.test.mjs   # 单元测试
node tools/balance.mjs        # 难度实测台（默认 SAMPLES=12；重抄 band 用 SAMPLES=60）
bash tools/verify.sh          # 第五道闸：两种 URL 形态 × 12 段场景 + urlseed 三趟
SHAPES=root bash tools/verify.sh          # 改东西时先只跑一种形态（本机 root 一跑 ~15 s）
SCENARIOS="boot canary" bash tools/verify.sh
BASE_URL=https://z-biz-game.github.io/z-biz-game-zebra-cos/ bash tools/verify.sh   # 部署件，不起服务
```

单测那条为什么写文件列表而不是目录：`node --test test/` 里「`test/` 展开成哪些文件」是 test runner
按 node 版本各自的规则决定的，本仓的 `check` job 在 node 20、`browser` job 在 node 22、开发机是 v26.8.1，
同一句话在三个地方可能圈出不同的集合。写成 `test/*.test.mjs` 后由 shell 展开，三个 node 拿到的是同一份
五个文件的列表。本轮两种写法在本机实测都是 `tests 30 / pass 30 / fail 0`（不是改前坏了，是把「赌目录规则」
这件事从闸里拿掉）。CI 的那一步与 `npm test` 的第一条现在字节相同。

零运行时依赖、零构建步骤、`js/` 全是 ES module、没有图片与音频文件。浏览器闸的驱动是
`tools/playtest.cjs`（裸 CDP，用 node 全局 `WebSocket`/`fetch` ⇒ 需要 node ≥ 22），它不需要窗口管理器：
窄屏视口用 `Emulation.setDeviceMetricsOverride` 在第一次导航之前钉住。
CI（`.github/workflows/ci.yml`）**不跑 npm install**，两个 job：`check`（node 20：语法检查、
`js/ 不许 import tools/` 的分层 grep 闸、`node --test` 单元测试、四道度量闸 —— 其中 balance 用
`SAMPLES: "24"`）与 `browser`（node 22、`WD_TIMEOUT: 900`、`bash tools/verify.sh`）。
`browser` 用 22 而不是 20 的理由写在那个 job 的注释里：node 20 上没有全局 `WebSocket`，
第一条 CDP attach 就死在第一条断言之前。

### 文档里的行号也在账上（`test/docs.test.mjs`）

README 与 `docs/DESIGN.md` 里每个反引号包住的 `path:NN` 都被读回真文件对账：文件要在盘上、行号要落在
真实行数内、被指的那几行不许整段是空行，而贴着引用的那个名字必须作为**完整标识符**出现在被指的行里
（整词，不是子串 —— 短名字坐在长标识符那一行上也会"出现"）。跨仓引用只数不判。输入集当场从
`git ls-files` 推，且**不限仓根**：本仓的 DESIGN 就住在 `docs/` 下，只挑仓根那一份会把样本从 2 份
悄悄缩成 1 份，而读数照样绿。

这一腿一到就点了两处名：DESIGN 有两条引用只写 basename 就接上行号（`balance.mjs` 那一支），在本仓的
跟踪清单里解析不出路径，而它们说的其实是 `tools/` 下那一份；README 一条引用都没有（D2 红 —— 某份文档
被跳过时这里红，而不是条数悄悄变少）。补与改的每条都读回真文件那一行再落笔。

跑法：`npm test` 那条 `node --test test/*.test.mjs`；CI 的 `check` job 跑的是与它字节相同的同一条命令
—— 那是接线，跑没跑到由那一次 run 的读数说。这条腿自己的破坏台账是五刀，跑在带 `.git` 的定稿树副本上
（刀全是同行内联替换，不改行数——改了行数，被引用的那些行号自己就漂，红的是不相干的那一边）：D3 两记
（行号越界、行号落在被引文件的一处真空行上）、D4 一记（把带指认的引用搬到同一文件里不含那个名字的行）、
D6 一记（把一条完整引用改成只有冒号加数字、且前面借不到路径的形状）、再加 D1 一记（把输入集的推导缩回
"只挑仓根那一份"）。

本轮读数（2026-10-08，本机 node v26.8.1 一次 `node test/docs.test.mjs`）：2 份文档 · 21 条引用 ·
6 条带指认 · 0 条续引 · 0 条跨仓 · 文档行号对账 15 条判据，`rows: 15 fail: 0`。这六个数不再是修辞：这条腿
逐处对账，文档里凡印着这些标签的地方都必须等于本轮实数，**一处都没印同样要红**（D10 抄写台账；三把只动文档、
代码一行不碰的刀在带 `.git` 的副本上各红一次并点名对应标签，跑完树复原）。

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
js/engine/pencil.js     P1–P8 具名规则铅笔（不允许搜索；{trace:true} 才交回删除序列）
js/engine/generate.js   出题流水线 + TIERS 表
js/ui/game.js           玩家的注记模型：三态、撤销栈、冲突读数、hintStep()（**没有答案字段**）
js/render/board.js      画布几何 + 命中（cellRect/cellAt/hitRadius）与栅格化，不做任何判定
js/store.js             zebra.save.v1 一个键：字段白名单、坏档一律当没有、ANSWERISH 单点定义
js/main.js              入口：开盘、渲染、真指针与键盘、答案面板判分、验收不过就摊开 #reject
server.cjs              只给闸用的静态服务器（仓库=文档根）
tools/rule-test.mjs     词汇表/语义/支撑表闸（1353 项）
tools/counter-test.mjs  裁判 vs 见证、stopped 语义、单调性闸（285 项）
tools/pencil-test.mjs   铅笔 soundness/完备性/能力上界/负对照闸（31 项）
tools/balance.mjs       难度实测台：出货、唯一、不可约、成本、阶梯、红线
tools/fixtures.mjs      生成/重算浏览器里那 14 条夹具（verify.sh 每次先跑 --check）
tools/scenarios.js      13 段注册的断言本体（12 段固定 + urlseed 带查询串跑三趟；含夹具表）
tools/playtest.cjs      裸 CDP 驱动（node ≥ 22）
tools/verify.sh         第五道闸：两种 URL 形态、每腿一个新 Chrome profile、端口占用会打印谁在听
test/                   node --test 单元测试（30 项，含文档行号对账）
docs/DESIGN.md          设计说明与被否决的写法
```

出处核对日期：2026-09-28（Life International 1962-12-17 题面经 Wikipedia "Zebra puzzle" 词条核对；
tools/assemble-site.sh  部署产物的唯一清单（pages.yml 与本地闸调同一支）
tools/deploy-set.mjs  部署集闸：检查即将上传的那份产物
tools/deploy-set-selftest.mjs  部署集闸的阴性自证（每一类断言当场打红一次）
NP-完全性经 Quasigroup Completion，Sempolinski 2009）。

## 上线的到底是哪一批文件

这个仓没有打包器：站点=一次文件拷贝。以前「拷哪些」写在 `pages.yml` 的 `run:` 里（手抄的几行
`cp`）。本地 `index.html` 直读仓库根，永远自洽；线上却按那份清单拷，于是页面后来引用的
`manifest.webmanifest`、`sw.js`、`icons/*` 可能一个都没上去——线上 404，而仓里的引擎测试与
真浏览器闸全绿，因为它们跑的都是仓库根，没有任何一步在「按清单拷」的那个环境下加载过页面。

现在清单只有一份，住在 `tools/assemble-site.sh`：CI 调它拷 `_site`，本地闸调它拷临时目录，
然后**对拷出来的产物**提要求（`tools/deploy-set.mjs`）：

- **W 清单与页面同源**：`pages.yml` 里必须真有 `run: bash tools/assemble-site.sh <dir>` 这一行，
  `ci.yml` 里必须真有 `run: node tools/deploy-set.mjs`。认的是调用那一行，不是文件里出现过这个
  路径——注释里本来就会写它，只 grep 字符串会被一句散文喂绿。
- **R 引用可达**：引用不靠手打名单。从 `index.html` 的 `href/src` 出发，凡解析出来是 `.js`/`.css`
  的就把那一站也扫一遍（CSS 的 `url()`、JS 去掉注释后的 `'./…'` 字面量、`new URL(x, base)` 的两种
  基、`navigator.serviceWorker.register`、`scope`），`manifest` 的 icons/screenshots/shortcuts 各自
  的 `src` 也算引用。取径上读不到的那一站本身就是红（读不到＝这一站根本没扫）。每条引用都必须在
  产物里且非 0 字节；绝对路径单列一条红，因为 Pages 挂在 `/<repo>/` 前缀下会跳出去。
- **P 位图不许说谎**：`manifest` 声明的 `sizes` 必须等于 PNG IHDR 的真实宽高——文件图标读文件头，
  内联成 base64 的图标先解码再读同一段。后一条不是可选项：图标可能住在清单里而不是盘上的 `.png`
  （有的仓另有一条"零二进制文件"的承诺，那条只约束"有没有 .png 这个文件"）；如果 P 段只筛文件名，
  声明写 512 而真图 192 就一路放行。
- **钉住两个数**：R 段实际检查的路径条数（`31`）与这一次跑的断言条数（`49`），两个数
  都钉在 `tools/deploy-set.mjs` 顶部的那对常量里。没改页面却掉了，说明解析断了；删掉一张图标会同时
  少一条 R10 与那张的 P1/P2，所以两个数一起钉，断言条数能漂就是闸在缩水的信号。这一节故意只写数值、
  不写那对常量的名字，也不写别仓文档闸的编号：有的仓的文档闸会拿"文档里出现过的同名标识号"回数它
  自己的条数，还有的会把文档里点到的每个组编号逐个核对"这一轮真的发过"——两道闸共用一个名字，
  或者在本仓的文档里出现一个本仓没有的组编号，打红的都是不相干的那一边。

`tools/deploy-set-selftest.mjs` 是这两颗钉的阳性证明：它把仓库复制到临时目录，照着每一类断言
各下一刀（X1 清单不收位图目录 / X2 模块边改名 / X3 CSS 写绝对路径 / X4 `start_url` 绝对 /
X5 删光 >=512 图标 / X6 少一个必填字段 / X7 声明尺寸与真图不符 / X8 workflow 不调脚本 /
X9 CI 不跑闸 / X10 是阴性对照——往入口 JS 追加一行只写在注释里的假路径，闸必须仍然绿、条数仍然
`31`、断言仍然 `49`；X11 og:image 退回相对路径 / X12 og:image 的前缀指向别的 slug /
X13 内联位图谎报尺寸——只在有靶子时下：X11/X12 要页面上那句 og:image，X13 要清单里真有一段 base64
图标，没有就打印 SKIP；反过来 X1 没有位图目录可砍时改砍 css，P 段一位都不核时台架直接报靶子不够），
要求每一刀都让闸**点名**变红。靶子从 `DEPLOY_SET_DUMP=1`
的出处表现挑（取径真的会读的那支 JS / 那一张 CSS，不写死某一个仓的入口名），所以页面改了、仓与仓
不同，台架跟着走。

`node tools/deploy-set.mjs` 与 `node tools/deploy-set-selftest.mjs` 就是 CI 跑的那两条命令本身
（package.json 里的 `deploy-set` / `deploy-set:selftest` 只是同一支脚本的 npm 入口）；本仓的整闸在 `tools/verify.sh` 的 `=== deploy-set ===` 那一段也各跑一次。它们红的时候并进本仓那条出口的退出码——这一条是这么证的：
把 ci.yml 里那行 `run: node tools/deploy-set.mjs` 砍掉，本仓整闸必须点名红且退出码非 0。
所以「本地全绿、线上 404 自己的 manifest / sw.js / 图标」这一类坏法在本地就会红。

