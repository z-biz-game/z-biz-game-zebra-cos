#!/usr/bin/env bash
# 第五道闸（浏览器闸）：真 headless Chrome、真 DOM、真画布像素、真 localStorage、真指针与真焦点
# —— 两种 URL 形态各跑一遍：
#
#   ① root    http://127.0.0.1:5321/                              (server.cjs：仓库自己就是文档根)
#   ② prefix  http://127.0.0.1:5421/z-biz-game-zebra-cos/         (GitHub Pages 的形状，对应
#                                                                  https://z-biz-game.github.io/z-biz-game-zebra-cos/)
#
#   bash tools/verify.sh                       # 两种形态、全部场景
#   SHAPES=root bash tools/verify.sh           # 改东西时先只跑一种
#   SCENARIOS="boot canary" bash tools/verify.sh
#   WEB_PORT=5321 CDP_PORT=9321 bash tools/verify.sh
#   BASE_URL=https://z-biz-game.github.io/z-biz-game-zebra-cos/ bash tools/verify.sh
#                                              # 部署件：只跑这一种形态，本脚本不起任何服务
#
# 为什么前缀形态必须单跑一遍而不是写进脚注：根形态是唯一一种能被本地服务器"蒙对"的形态。
# 页面级 `/js/...` 说明符在仓库=文档根时解得开，挂在 /<repo>/ 下就 404；而抛出来的 dynamic import
# 会把整段注入脚本一起带沉，于是部署站点静默地只跑了一小部分断言。
# tools/scenarios.js 里那个 mod() 特意按 document.baseURI 解析（import(new URL(rel, baseURI)))，
# 就是因为这个 —— 只有前缀那一跑能看见它到底解没解错。
#
# 端口是本仓的，不是家族的公共汽车：web 5321 / CDP 9321（前缀形态 5421）。
# 被占了就往后挪并打印"谁在听这一口"，绝不借别人已经绑上的 socket —— 借来的端口会发出**另一个应用**
# 的 index.html，而"页面加载成功了"分不清这件事，所以预检按字节比对磁盘上的模块。
#
# 每一条 URL 形态都用**自己新 mktemp 出来的 Chrome profile**：profile 里带着上一个形态的
# localStorage，跨形态复用会把"跨刷新续档"这一对断言变成自己读自己刚写的内存。
# 也不用 `mktemp -d -t <前缀>`：macOS 的 -t 把模板当成**前缀**并往后追加时间戳，两条腿拿到的是
# 不同的目录名却同样的语义，Linux 上 -t 干脆不是那个意思 —— 直接把模板写全。
#
# Do NOT add --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader: software
# rasterisation saturates every core and, with no CDP client attached, Chrome will not exit
# on its own. Canvas pixels are half the point of this file — a fake rasteriser makes them lie.
set -u
HERE=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(basename "$HERE")                     # the Pages path segment, same as the repo slug
FEATURE=谁养鱼                                # this app's own word: proof the bytes are ours
CDP_WANT=${CDP_PORT:-9321}
WEB_WANT=${WEB_PORT:-5321}
PREF_WANT=${PREFIX_PORT:-5421}
CHROME=${CHROME_BIN:-}
# tools/scenarios.js 末尾 w.__scn 里已注册的场景。顺序有讲究：
#   save→resume 是一对**跨刷新**的戏 —— playtest.cjs 每个场景都重新注入并 navigate 一次，
#   后一段读的是磁盘上的存档而不是内存里的残骸，并且它拿上一段交回的 timeOrigin 举证"这真的是
#   一次导航之后的新文档"（片段导航不算重载），所以这两段之间不许插别的场景；
#   narrow 那一段逐字断言视口，必须拿自己的 VIEWPORT 跑；
#   urlseed 不在这里 —— 它要带查询串的 NAV_URL，见下面 run_url_legs。
SCENARIOS_DONE="boot tiers seed play keyboard hint answer save resume layout narrow canary"
VP_DEFAULT=${VIEWPORT_DEFAULT:-1280x1024}
VP_NARROW=${VIEWPORT_NARROW:-390x844}
URL_TIER=t2-4cat
URL_SEED=b7
URL_SEED_ALT=b1
if [ -z "$CHROME" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then CHROME=$c; break; fi
  done
fi
command -v python3 >/dev/null 2>&1 || { echo "需要 python3（前缀形态的静态服务器 + 结果解析）" >&2; exit 2; }
{ command -v "$CHROME" >/dev/null 2>&1 || [ -x "$CHROME" ]; } || {
  echo "no Chrome found — 试过的路径：" >&2
  echo "  /Applications/Google Chrome.app/Contents/MacOS/Google Chrome" >&2
  echo "  CHROME_BIN=/path/to/chrome bash tools/verify.sh" >&2
  exit 2; }

# 日志与夹具落点：不写 /tmp 根 —— 这一台机器上有别的 agent 同时在跑 Chrome。
# 默认落在 $TMPDIR（macOS 是每用户私有的 /var/folders/...，Linux runner 上退到 /tmp）。
LOGDIR=${VERIFY_LOG_DIR:-"${TMPDIR:-/tmp}/zebra-verify"}
mkdir -p "$LOGDIR" || { echo "日志目录 $LOGDIR 建不起来" >&2; exit 2; }
rm -f "$LOGDIR"/*.tally "$LOGDIR"/*.extra.json 2>/dev/null

# ---- ports ---------------------------------------------------------------------------------------
occupied() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }
squatters() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' '; }
first_free() {
  local base=$1 p
  for p in "$base" $((base + 1)) $((base + 100)) $((base + 200)); do
    if occupied "$p"; then
      echo "  端口 $p 已被别的进程听着（pid: $(squatters "$p")）——不借它的 socket，换下一个" >&2
    else
      echo "$p"; return 0
    fi
  done
  return 1
}

CUSTOM=0
[ -n "${BASE_URL:-}" ] && CUSTOM=1
if [ "$CUSTOM" = 0 ]; then
  CDP=$(first_free "$CDP_WANT") || { echo "no free devtools port near $CDP_WANT" >&2; exit 2; }
  WEB=$(first_free "$WEB_WANT") || { echo "no free http port near $WEB_WANT" >&2; exit 2; }
  PREF=$(first_free "$PREF_WANT") || { echo "no free http port near $PREF_WANT" >&2; exit 2; }
  echo "ports: CDP $CDP (want $CDP_WANT) · root web $WEB (want $WEB_WANT) · prefix web $PREF (want $PREF_WANT)"
  echo "  两种形态各用一个 HTTP 端口：origin 不同 ⇒ localStorage 各一套；CDP 一条腿一个新 profile 一次重启"
else
  CDP=${CDP_PORT:-$CDP_WANT}
  echo "BASE_URL given → 只跑部署件这一种形态，本脚本不起任何服务（CDP ${CDP}）"
fi
echo "logs: $LOGDIR"
echo "loadavg（跑之前的读数，本机可能同时坐着别的 agent）：$(sysctl -n vm.loadavg 2>/dev/null || cat /proc/loadavg)"

FAILED=0
# 该交回几段结果是注册表决定的，不是"跑完了就算"。urlseed 那三条腿是固定加跑的（同一 URL 两趟 +
# 换 seed 一趟），所以注册表的数目要 +3 —— 少一趟就是悄悄少跑。
WANT_N=$(( $(echo ${SCENARIOS:-$SCENARIOS_DONE} | wc -w | tr -d ' ') + 3 ))

# ---- node 侧先把夹具重算一遍 ---------------------------------------------------------------------
# tools/scenarios.js 里那一段夹具是**从 node 出货的**：题面指纹、铅笔步数、提示前三步、答案面板的
# 输入样本、两块负样本。浏览器逐字段复现它们；但如果 node 这一侧已经不再产出同样的读数，那份
# "逐字段一致"就是在跟自己的上一版对表。所以每次运行都先跑 fixtures.mjs --check（它 import 的
# 就是浏览器加载的那批 js/ 模块），红了读作"页面与 node 不再是同一批盘"。
echo "=== node re-derives the fixture pinned in tools/scenarios.js ==="
node tools/fixtures.mjs --check || FAILED=1

# ---- machine-readable RESULT line ----------------------------------------------------------------
# playtest.cjs 把 RESULT 打在 stdout 最后一行、console 噪音留在 stderr。这里不数行数就不叫跑过：
# 一条断言都没发生的场景（页面启动失败、import 404、场景被改名）会以"0 failed"的样子绿过去，
# 所以空 rows / 解析不出来 / 拿不到 RESULT 一律 exit 1，并把条数写进 tally 让上面那层核对
# "该报 12 段是不是只报了 11 段"。extra 落到 .extra.json：save→resume 那一对照它传话。
PARSE=$(cat <<'PARSER'
import sys, json
shape, scn, tally, extra_path = sys.argv[1:5]
raw = sys.stdin.read().strip()
if raw.startswith('RESULT '):
    raw = raw[len('RESULT '):]
if not raw:
    print('  NO RESULT —— playtest.cjs 什么都没回（见同目录的 .console.log）'); sys.exit(1)
try:
    d = json.loads(raw)
except Exception:
    print('  UNPARSED:', raw[:300]); sys.exit(1)
rows = d.get('rows')
if rows is None:
    print('  NO RESULT FIELD —— 回的东西不是闸的口径:', str(d)[:300]); sys.exit(1)
if not rows:
    print('  NO CHECKS RUN —— 一条都不断言的场景没有资格是绿的'); sys.exit(1)
for r in rows:
    if not r['pass']:
        print('  FAIL %-58s %s' % (r['test'], r['detail']))
fail = int(d.get('fail', 0))
extra = {k: v for k, v in d.items() if k not in ('rows', 'fail')}
with open(tally, 'w') as f:
    f.write('%d %d\n' % (len(rows), fail))
with open(extra_path, 'w') as f:
    json.dump(extra, f)
print('  %d checks, %d failed  %s' % (len(rows), fail, json.dumps(extra, ensure_ascii=False)[:220]))
sys.exit(1 if fail else 0)
PARSER
)

# ---- pre-flight: 即将被检的那几字节就是本仓 ---------------------------------------------------------
# 端口上坐着*别的*东西是这个闸存在的意义；"页面加载了"不够 —— SPA fallback、目录列表、孤儿 checkout
# 都能让场景跑起来，只是对着更少的文件跑。所以每个模块路径都要求 200 **且**字节数与磁盘一致。
PREFLIGHT_RELS="js/main.js js/store.js js/ui/game.js js/render/board.js js/engine/rules.js js/engine/generate.js js/engine/pencil.js js/engine/counter.js js/engine/witness.js css/game.css"
preflight() {
  local base=$1 rel want got f served
  served=$(curl -fsS -m 8 "$base" 2>/dev/null) || { echo "  首页取不到：$base" >&2; return 1; }
  case "$served" in *js/main.js*) ;; *) echo "  $base 上发的不是本仓的首页（正文里找不到 js/main.js）" >&2; return 1 ;; esac
  case "$served" in *"$FEATURE"*) ;; *) echo "  $base 在发别的应用：首页正文里找不到「${FEATURE}」" >&2; return 1 ;; esac
  for rel in $PREFLIGHT_RELS; do
    want=$(wc -c < "$HERE/$rel" | tr -d ' ')
    [ -n "$want" ] || { echo "  $rel 在磁盘上读不到，闸没有可对的基准" >&2; return 1; }
    f="$LOGDIR/preflight-$(echo "$rel" | tr '/' '_')"
    got=$(curl -sS -m 8 -o "$f" -w '%{http_code} %{size_download}' "$base$rel" 2>/dev/null) || {
      echo "  $rel 取不回来：$base$rel" >&2; return 1; }
    case "$got" in "200 $want") ;; *)
      echo "  $rel 不对味：$base$rel 回 ${got}，磁盘上的这份是 200 $want 字节" >&2
      echo "  前两行到手内容：$(head -c 160 "$f" | tr '\n' ' ')" >&2
      return 1 ;; esac
  done
  echo "  预检：首页含「${FEATURE}」与 js/main.js · $(echo $PREFLIGHT_RELS | wc -w | tr -d ' ') 条真实模块路径按字节对上磁盘"
  return 0
}

start_chrome() {                  # 每一条腿一个新 profile、一个新 Chrome
  local tag=$1
  UDD=$(mktemp -d "${TMPDIR:-/tmp}/zebra.${tag}.XXXXXXXX") || { echo "profile 建不起来" >&2; return 1; }
  "$CHROME" --headless=new --remote-debugging-port=$CDP --user-data-dir="$UDD" \
    --window-size=1280,1024 --no-first-run --no-default-browser-check about:blank \
    >"$LOGDIR/chrome-$tag.log" 2>&1 &
  CPID=$!
  for i in $(seq 1 120); do
    curl -fsS -m 1 "http://127.0.0.1:$CDP/json/version" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  echo "devtools never bound on :$CDP (see $LOGDIR/chrome-$tag.log)" >&2
  return 3
}
stop_chrome() {
  [ -n "${CPID:-}" ] && kill -9 "$CPID" 2>/dev/null
  [ -n "${UDD:-}" ] && rm -rf "$UDD"
  CPID=""; UDD=""
  return 0
}

run_one() {                       # run_one <shape> <scenario> [expect-json] [nav-url]
  local shape=$1 s=$2 expect=${3:-''} nav=${4:-''}
  local vp=$VP_DEFAULT tally extra clog n m
  [ "$s" = narrow ] && vp=$VP_NARROW
  tally="$LOGDIR/$shape-$s.tally"; extra="$LOGDIR/$shape-$s.extra.json"; clog="$LOGDIR/$shape-$s.console.log"
  rm -f "$tally" "$extra"
  echo "=== [$shape] $s (viewport $vp${nav:+, nav $nav}) ==="
  VIEWPORT=$vp NAV_URL=$nav node tools/playtest.cjs scenario "$s" "$expect" 2>"$clog" | tail -1 \
    | python3 -c "$PARSE" "$shape" "$s" "$tally" "$extra" || RUNBAD=1
  if [ -s "$tally" ]; then
    read -r n m < "$tally"
    REPORTED=$((REPORTED + 1)); CHECKS=$((CHECKS + n)); FAILS=$((FAILS + m))
  else
    RUNBAD=1
    echo "  没有 tally：$s 这一跑连条数都没交出来，不能算跑过"
  fi
  if [ -s "$clog" ]; then
    echo "  --- console (tail 8) ---"
    sed 's/^/  /' "$clog" | tail -8
  fi
  return 0
}

# 同一串 URL 跑两趟 ⇒ 必须是同一张盘（浏览器侧的自复现），且两趟必须是**两个文档**
# （timeOrigin 不同：片段导航不算重载，这是本组织付过学费的口径）。
# 第三趟换 URL 里的 seed：此刻 origin 的存档里躺着第一、二趟写的 b7，换号那一趟必须
# ①按新号开盘、②不续旧档（resumed=false）、③注记清零 —— 这是"URL 优先于存档"的正面证据。
run_url_legs() {
  local shape=$1 base=$2
  local nav="$base?tier=$URL_TIER&seed=$URL_SEED"
  local navc="$base?tier=$URL_TIER&seed=$URL_SEED_ALT"
  echo "=== [$shape] urlseed 两趟：$nav ==="
  run_one "$shape" urlseed '' "$nav"
  cp "$LOGDIR/$shape-urlseed.extra.json" "$LOGDIR/$shape-urlseed-a.json" 2>/dev/null
  echo "=== [$shape] urlseed 第二趟（同一个 URL，重开一次真导航） ==="
  run_one "$shape" urlseed '' "$nav"
  cp "$LOGDIR/$shape-urlseed.extra.json" "$LOGDIR/$shape-urlseed-b.json" 2>/dev/null
  echo "=== [$shape] urlseed 第三趟（换 seed：${navc}，存档里是上一趟的 ${URL_SEED}） ==="
  run_one "$shape" urlseed '{"expectResumed":false}' "$navc"
  cp "$LOGDIR/$shape-urlseed.extra.json" "$LOGDIR/$shape-urlseed-c.json" 2>/dev/null
  node -e '
    const fs = require("node:fs");
    const read = (p) => {
      if (!fs.existsSync(p)) { console.log(`  FAIL 拿不到 ${p}：那一腿没交回 extra，两趟对照无从成立`); process.exit(1); }
      return JSON.parse(fs.readFileSync(p, "utf8"));
    };
    const [a, b, c] = process.argv.slice(1).map(read);
    const bad = [];
    if (a.clueSig !== b.clueSig) bad.push(`同一串 URL 两趟算出两份题面：${a.clueSig.slice(0, 40)} vs ${b.clueSig.slice(0, 40)}`);
    if (a.seed !== b.seed || a.tier !== b.tier) bad.push(`URL 的 tier/seed 没被原样用：${a.tier}/${a.seed} vs ${b.tier}/${b.seed}`);
    if (a.timeOrigin === b.timeOrigin) bad.push(`两趟的 timeOrigin 相同（${a.timeOrigin}）⇒ 第二趟根本不是一次真导航`);
    if (c.seed === a.seed) bad.push(`第三趟的 seed 跟前两趟一样（${c.seed}）⇒ 换号那趟没换号`);
    if (c.clueSig === a.clueSig) bad.push(`第三趟题面指纹跟第一趟相同 ⇒ 换 seed 没换盘`);
    if (c.timeOrigin === b.timeOrigin) bad.push(`第三趟的 timeOrigin 与第二趟相同 ⇒ 不是一次真导航`);
    if (bad.length) { console.log("  FAIL " + bad.join("\n  FAIL ")); process.exit(1); }
    console.log(`  同一 URL 两趟：题面指纹相同、seed 原样、timeOrigin 不同（${a.timeOrigin} → ${b.timeOrigin}）`);
    console.log(`  换 seed 第三趟：${a.seed} → ${c.seed} 题面指纹随之改变、timeOrigin ${b.timeOrigin} → ${c.timeOrigin}`);
  ' "$LOGDIR/$shape-urlseed-a.json" "$LOGDIR/$shape-urlseed-b.json" "$LOGDIR/$shape-urlseed-c.json" || RUNBAD=1
}

# ---- one shape -----------------------------------------------------------------------------------
run_shape() {
  local shape=$1 base s
  local t0 t1
  t0=$SECONDS
  REPORTED=0; CHECKS=0; FAILS=0; RUNBAD=0
  SPID=0; PSPID=0; PROOT=""
  if [ "$CUSTOM" = 1 ]; then
    base=$BASE_URL
  elif [ "$shape" = root ]; then
    base="http://127.0.0.1:$WEB/"
    node "$HERE/server.cjs" "$WEB" >"$LOGDIR/$shape-server.log" 2>&1 &
    SPID=$!
  else
    # Pages 形状：仓库挂在**一个路径段**下，服务器根目录里只放一个指向仓库的软链。
    # 不拷贝、不改写 —— 这正是重点：写死的 `/js/...` 在这个形状里没有地方藏。
    base="http://127.0.0.1:$PREF/$REPO/"
    PROOT=$(mktemp -d "${TMPDIR:-/tmp}/zebra.root.XXXXXXXX") || { echo "根目录建不起来" >&2; return 1; }
    ln -s "$HERE" "$PROOT/$REPO" || { echo "软链 $PROOT/$REPO 建不起来" >&2; return 1; }
    python3 -m http.server "$PREF" --bind 127.0.0.1 --directory "$PROOT" >"$LOGDIR/$shape-server.log" 2>&1 &
    PSPID=$!
  fi
  BASE=$base
  export CDP_PORT=$CDP
  export BASE_URL=$BASE
  # 每一条形态一个新 Chrome profile：这一形态的 localStorage 不许是上一形态写的
  start_chrome "$shape" || return 5
  if [ "$CUSTOM" = 0 ]; then
    for i in $(seq 1 40); do curl -fsS -m 1 "$BASE" >/dev/null 2>&1 && break; sleep 0.25; done
  fi
  echo
  echo "################ shape=$shape  base=$BASE  (CDP :$CDP, profile $UDD)"
  preflight "$BASE" || return 2

  # 先在一个**本 origin 的 404 路径**上把 tab 拉起来：origin 对得上 ⇒ 后面的场景腿复用这个 tab，
  # 而应用页一次都没跑过 ⇒ zebra.save.v1 还是空的，boot 那一段"新 profile 上无档可续"才是真的。
  # （直接 open 首页就会把当前盘写进存档，那段断言就变成在验自己刚写的档。）
  VIEWPORT=$VP_DEFAULT node tools/playtest.cjs open "${BASE}zebra-probe-404" | head -2
  echo "boot 读数由 boot 场景交回（version / timeOrigin / 题面指纹都在它的 extra 里）"

  for s in ${SCENARIOS:-$SCENARIOS_DONE}; do
    local expect=''
    if [ "$s" = resume ]; then
      if [ ! -s "$LOGDIR/$shape-save.extra.json" ]; then
        echo "  resume 这一段要的是 save 那一腿交回的 extra，文件不在 ⇒ 前面的腿没跑成" >&2
        RUNBAD=1
      else
        expect=$(cat "$LOGDIR/$shape-save.extra.json")
      fi
    fi
    run_one "$shape" "$s" "$expect"
  done
  run_url_legs "$shape" "$BASE"

  t1=$((SECONDS - t0))
  echo "---- shape=$shape 汇总: $REPORTED/$WANT_N scenarios reported · $CHECKS checks · $FAILS failed · ${t1}s ----"
  if [ "$REPORTED" != "$WANT_N" ]; then
    echo "  少了一段场景交回结果：注册表要 $WANT_N 段，只收到 $REPORTED 段 —— 悄悄少跑不能算绿" >&2
    RUNBAD=1
  fi
  [ "$RUNBAD" = 0 ] || FAILED=1
  stop_chrome
  [ "$SPID" != 0 ] && kill $SPID 2>/dev/null
  [ "$PSPID" != 0 ] && kill $PSPID 2>/dev/null
  [ -n "$PROOT" ] && rm -rf "$PROOT"
  SPID=0; PSPID=0; PROOT=""
  return $RUNBAD
}

cleanup() {
  # 只杀自己起的那几个 pid；别的 agent 的 Chrome / 服务器一律不动。
  [ "${SPID:-0}" != 0 ] && kill $SPID 2>/dev/null
  [ "${PSPID:-0}" != 0 ] && kill $PSPID 2>/dev/null
  stop_chrome
  return 0
}
trap cleanup EXIT
# The watchdog redirects its fds: a background subshell inherits this script's stdout, and
# inside a pipeline it would hold the write end open long after the tests finished.
( sleep ${WD_TIMEOUT:-900}; echo "watchdog 到点：闸还没跑完" >&2; cleanup; exit 4 ) </dev/null >/dev/null 2>&1 &
WD=$!

cd "$HERE"
SHAPE_LIST="root prefix"
[ "$CUSTOM" = 1 ] && SHAPE_LIST=custom
RAN=""
for shape in ${SHAPES:-$SHAPE_LIST}; do
  RAN="$RAN $shape"
  run_shape "$shape" || FAILED=1
done

kill $WD 2>/dev/null
echo "loadavg（这一跑结束时）：$(sysctl -n vm.loadavg 2>/dev/null || cat /proc/loadavg)"
echo "chrome: $("$CHROME" --version 2>/dev/null) · node: $(node --version)"
# 只报这一跑真的跑过的形态：SHAPES=root / BASE_URL= 那种单形态跑，旧文案照样打印"两种 URL 形态"。
[ $FAILED -eq 0 ] && echo "=== ALL GREEN（这一跑实际覆盖的 URL 形态：${RAN# }）===" || echo "=== FAILURES ABOVE ==="
exit $FAILED
