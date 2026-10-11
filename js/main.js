// Router dạng hash (#/study/junior) để chạy được trên GitHub Pages mà không cần cấu hình server.
import * as home from "./views/home.js";
import * as study from "./views/study.js";
import * as quiz from "./views/quiz.js";
import * as roadmap from "./views/roadmap.js";
import * as progress from "./views/progress.js";
import * as community from "./views/community.js";
import { prefs } from "./store.js";
import { trackPageview } from "./analytics.js";

const VIEWS = { home, study, quiz, roadmap, progress, community };
const TITLES = {
  home: "Flutter Interview — Ôn phỏng vấn & Quiz theo rank",
  study: "Ôn luyện — Flutter Interview",
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
  for (const a of document.querySelectorAll("[data-nav]")) {
    a.classList.toggle("active", a.dataset.nav === name);
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
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

window.addEventListener("hashchange", route);
route();
