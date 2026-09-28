// 复现性测试：同一串 seed 必须在**同进程内两次**与**另一个进程**里给出同一张盘。
//
// 这条性质是整个难度承诺的地基：balance.mjs 的分位表、TIERS[].band/budgetMs、README 里的
// 每个数字都是某一次跑的读数。只要出题路径吃到任何进程相关的随机数（Math.random、地址、
// Array#sort 的未定义次序），或者时间预算真的参与了判定，下面这三段里就会有一段红。

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { clueSignature, truthSignature } from '../js/engine/rules.js';
import { TIERS, drawOnce, generate } from '../js/engine/generate.js';
import { seedOf } from '../js/engine/rng.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const fingerprint = (g) => `${g.clues.length}|${clueSignature(g.clues, g.tier ? g.tier.N : 3)}|${truthSignature(g.truth)}`;

test('seed 串形状钉死为 zebra|<tier>|<seed>，档位写进串里', () => {
  assert.equal(seedOf('t1-3cat', '7'), 'zebra|t1-3cat|7');
  assert.equal(seedOf('t3-5cat', 12), 'zebra|t3-5cat|12');
  assert.throws(() => seedOf('T1 X', '7'), /不合规范/);
});

test('同进程两次：三档各抽一张，指纹逐字节相同', () => {
  for (const tier of TIERS) {
    const a = generate(tier.key, 'again');
    const b = generate(tier.key, 'again');
    assert.equal(a.ok, true, `${tier.key} 出货失败：${JSON.stringify(a.failures)}`);
    assert.equal(b.ok, true);
    assert.equal(fingerprint(a), fingerprint(b), `${tier.key} 两次跑给出不同的盘`);
    assert.equal(a.draws, b.draws, '补抽次数也是 seed 的函数');
    assert.ok(a.seedStr.startsWith(`zebra|${tier.key}|again#`), `seed 串形状不对：${a.seedStr}`);
  }
});

test('换个 seed 就是另一张盘（否则"复现"是假的）', () => {
  const a = generate('t3-5cat', 'x1');
  const b = generate('t3-5cat', 'x2');
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test('一次抽取也是纯函数：drawOnce 同 seed 同结果', () => {
  const tier = TIERS[1];
  const a = drawOnce(tier, 'pure#0');
  const b = drawOnce(tier, 'pure#0');
  assert.equal(JSON.stringify({ fail: a.fail || null, clue: a.clues ? clueSignature(a.clues, tier.N) : null, dropped: a.dropped ? a.dropped.length : 0 }),
    JSON.stringify({ fail: b.fail || null, clue: b.clues ? clueSignature(b.clues, tier.N) : null, dropped: b.dropped ? b.dropped.length : 0 }));
});

test('跨进程复现：新起一个 node 进程跑同一个 seed，指纹必须一致', () => {
  const code = `
    const { clueSignature, truthSignature } = await import(${JSON.stringify(pathToFileURL(join(root, 'js/engine/rules.js')).href)});
    const { generate } = await import(${JSON.stringify(pathToFileURL(join(root, 'js/engine/generate.js')).href)});
    const out = [];
    for (const key of ${JSON.stringify(TIERS.map((t) => t.key))}) {
      const g = generate(key, 'xproc');
      out.push([key, g.clues.length, clueSignature(g.clues, g.tier.N), truthSignature(g.truth)].join('~'));
    }
    process.stdout.write(out.join('\\n'));
  `;
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', cwd: root });
  const lines = raw.trim().split('\n');
  assert.equal(lines.length, TIERS.length);
  for (const line of lines) {
    const [key, count, sig, tr] = line.split('~');
    const here = generate(key, 'xproc');
    assert.equal(here.clues.length, Number(count), `${key} 线索数跨进程不同`);
    assert.equal(clueSignature(here.clues, here.tier.N), sig, `${key} 题面跨进程不同`);
    assert.equal(truthSignature(here.truth), tr, `${key} 真值跨进程不同`);
  }
});

test('复现的前提写在源码里：判定路径上没有任何进程相关的随机数', () => {
  for (const rel of ['rules.js', 'rng.js', 'counter.js', 'witness.js', 'pencil.js', 'generate.js']) {
    const src = readFileSync(join(root, 'js/engine', rel), 'utf8');
    assert.ok(!src.includes('Math.random('), `${rel} 出现了 Math.random(`);
    assert.ok(!src.includes('Date.now('), `${rel} 出现了 Date.now(`);
    // 比较器吃随机数 = 换一台机器换一批盘（V8 的 sort 实现与长度有关）。
    // keyed() 的写法是"预抽键再按 (键, 编号) 排"，比较器本身只看数据。
    for (const line of src.split('\n')) {
      if (!line.includes('.sort(')) continue;
      assert.ok(!/next\(|rnd\.|Math\.random/.test(line), `${rel} 的 sort 比较器吃了随机数：${line.trim().slice(0, 90)}`);
    }
  }
});
