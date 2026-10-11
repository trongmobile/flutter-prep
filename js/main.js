// Router dạng hash (#/study/junior) để chạy được trên GitHub Pages mà không cần cấu hình server.
import * as home from "./views/home.js";
import * as study from "./views/study.js";
import * as quiz from "./views/quiz.js";
import * as roadmap from "./views/roadmap.js";
import * as progress from "./views/progress.js";
import * as community from "./views/community.js";
import * as review from "./views/review.js";
import * as interview from "./views/interview.js";
import * as question from "./views/question.js";
import { prefs } from "./store.js";
import { trackPageview } from "./analytics.js";
import { initPwa } from "./pwa.js";

const VIEWS = { home, study, review, quiz, interview, roadmap, progress, community, q: question };
const TITLES = {
  home: "Flutter Interview — Ôn phỏng vấn & Quiz theo rank",
  study: "Ôn luyện — Flutter Interview",
  review: "Ôn hôm nay — Flutter Interview",
  interview: "Phỏng vấn thử — Flutter Interview",
  q: "Câu hỏi — Flutter Interview",
  quiz: "Quiz — Flutter Interview",
  roadmap: "Lộ trình 35 ngày — Flutter Interview",
  progress: "Tiến độ — Flutter Interview",
  community: "Cộng đồng — Flutter Interview",
};

const app = document.getElementById("app");
let current = null; // { destroy?, canLeave? } do view trả về
let currentHash = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { name: segments[0] || "home", params: segments.slice(1), query: Object.fromEntries(new URLSearchParams(qs)) };
}

function route() {
  const { name, params, query } = parseHash();
  const view = VIEWS[name];
  if (!view) {
    location.replace("#/");
    return;
  }
  if (current && current.canLeave && !current.canLeave()) {
    // Người dùng huỷ rời trang (vd. đang làm quiz): khôi phục URL cũ.
    if (currentHash !== null && location.hash !== currentHash) {
      history.replaceState(null, "", currentHash || "#/");
    }
    return;
  }
  if (current && current.destroy) current.destroy();

  const hashAtStart = location.hash;
  const el = document.createElement("div");
  el.className = "view";
  app.replaceChildren(el);
  current = view.mount(el, params, query) || null;
  currentHash = location.hash;

  document.title = TITLES[name];
  const nav = document.getElementById("nav");
  for (const a of nav.querySelectorAll("[data-nav]")) {
    const active = a.dataset.nav === name;
    a.classList.toggle("active", active);
    if (active) {
      a.setAttribute("aria-current", "page");
      // Menu cuộn ngang trên mobile: đưa mục đang mở vào giữa.
      if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    } else a.removeAttribute("aria-current");
  }
  updateReviewBadge();
  window.scrollTo(0, 0);
  // View có thể chuyển hướng ngay khi mount (vd. #/study -> #/study/fresher): chỉ đếm trang đích.
  if (location.hash === hashAtStart) trackPageview(document.title);
}

// Bấm lại link của trang hiện tại -> mở lại trang từ đầu (vd. về màn chọn quiz).
document.getElementById("nav").addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (a && a.getAttribute("href") === location.hash) {
    e.preventDefault();
    route();
  }
});

// ---- Giao diện sáng / tối ----
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  prefs.set("theme", next);
});

// ---- Số câu cần ôn hôm nay trên menu ----
function updateReviewBadge() {
  const badge = document.getElementById("review-badge");
  if (!badge) return;
  const { due, fresh } = review.reviewQueue();
  const n = due.length + fresh.length;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.hidden = n === 0;
}
window.addEventListener("srs-change", updateReviewBadge);

// ---- Báo khi mất mạng (site vẫn chạy offline nhờ service worker) ----
function updateOnline() {
  document.body.classList.toggle("is-offline", !navigator.onLine);
}
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
updateOnline();

window.addEventListener("hashchange", route);
route();
initPwa();
