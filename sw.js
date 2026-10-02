// 谁养鱼 ZEBRA 的服务工作者：network-first + 缓存兜底。
//
// 为什么先网络：在线时每次请求都优先回源，行为等价于"没有 SW"，不会把旧代码/旧盘喂给浏览器
// 或门禁（本仓的 seed 口径经不起一份被缓存住的旧 main.js）。只有真正断网时才退回缓存。
// 版本写死为常量：不掺时间戳、不用 random —— shipped 路径的确定性口径在这里同样成立。
const VERSION = 'zebra-cos-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      const cache = await caches.open(VERSION);
      if (net && net.ok && net.type === 'basic') cache.put(req, net.clone());
      return net;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw new Error('offline-miss');   // 只有真断网且缓存里也没有才走到这里
    }
  })());
});
