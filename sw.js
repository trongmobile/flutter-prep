// Service worker: cho phép cài app và học offline.
// - File của site: network-first (có mạng luôn lấy bản mới nhất), mất mạng thì dùng cache.
// - Google Fonts: cache-first.
// - GitHub API, GoatCounter...: để trình duyệt tự xử lý (không cache ở đây).
// Danh sách PRECACHE được scripts/validate.mjs kiểm tra khớp với file thật.
const CACHE = "interview-v3";
const FONT_CACHE = "interview-fonts-v1";
const NETWORK_TIMEOUT = 4000;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "js/analytics.js",
  "js/community.js",
  "js/config.js",
  "js/jobs.js",
  "js/leaderboard.js",
  "js/main.js",
  "js/pwa.js",
  "js/store.js",
  "js/utils.js",
  "js/views/community.js",
  "js/views/home.js",
  "js/views/interview.js",
  "js/views/jobs.js",
  "js/views/leaderboard.js",
  "js/views/progress.js",
  "js/views/question.js",
  "js/views/quiz.js",
  "js/views/review.js",
  "js/views/roadmap.js",
  "js/views/study.js",
  "data/index.js",
  "data/meta.js",
  "data/tracks.js",
  "data/flutter/index.js",
  "data/flutter/roadmap.js",
  "data/flutter/questions/fresher.js",
  "data/flutter/questions/junior.js",
  "data/flutter/questions/middle.js",
  "data/flutter/questions/senior.js",
  "data/flutter/quiz/fresher.js",
  "data/flutter/quiz/junior.js",
  "data/flutter/quiz/middle.js",
  "data/flutter/quiz/senior.js",
  "data/android/index.js",
  "data/android/questions/fresher.js",
  "data/android/questions/junior.js",
  "data/android/questions/middle.js",
  "data/android/questions/senior.js",
  "data/android/quiz/fresher.js",
  "data/android/quiz/junior.js",
  "data/android/quiz/middle.js",
  "data/android/quiz/senior.js",
  "data/ios/index.js",
  "data/ios/questions/fresher.js",
  "data/ios/questions/junior.js",
  "data/ios/questions/middle.js",
  "data/ios/questions/senior.js",
  "data/ios/quiz/fresher.js",
  "data/ios/quiz/junior.js",
  "data/ios/quiz/middle.js",
  "data/ios/quiz/senior.js",
  "data/react-native/index.js",
  "data/react-native/questions/fresher.js",
  "data/react-native/questions/junior.js",
  "data/react-native/questions/middle.js",
  "data/react-native/questions/senior.js",
  "data/react-native/quiz/fresher.js",
  "data/react-native/quiz/junior.js",
  "data/react-native/quiz/middle.js",
  "data/react-native/quiz/senior.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes("/s/")) return; // trang chia sẻ: luôn lấy từ mạng
    event.respondWith(networkFirst(req));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req));
  }
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(NETWORK_TIMEOUT)]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = (await cache.match("index.html")) || (await cache.match("./"));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
