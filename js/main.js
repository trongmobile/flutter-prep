// Router dạng hash để chạy được trên GitHub Pages mà không cần cấu hình server.
// URL theo track: #/android/study/junior. Link không có track (#/study/junior, link cũ)
// được chuyển sang track đang chọn; #/q/<id> lấy track từ id câu hỏi.
import * as home from "./views/home.js";
import * as study from "./views/study.js";
import * as quiz from "./views/quiz.js";
import * as roadmap from "./views/roadmap.js";
import * as progress from "./views/progress.js";
import * as community from "./views/community.js";
import * as jobs from "./views/jobs.js";
import * as review from "./views/review.js";
import * as interview from "./views/interview.js";
import * as question from "./views/question.js";
import { prefs } from "./store.js";
import { TRACKS, DEFAULT_TRACK, getTrack, trackOfId, loadTrack, setActiveTrack } from "../data/index.js";
import { trackPageview } from "./analytics.js";
import { initPwa } from "./pwa.js";

const VIEWS = { home, study, review, quiz, interview, roadmap, progress, jobs, community, q: question };
const TITLES = {
  home: "Trang chủ",
  study: "Ôn luyện",
  review: "Ôn hôm nay",
  interview: "Phỏng vấn thử",
  q: "Câu hỏi",
  quiz: "Quiz",
  roadmap: "Lộ trình 35 ngày",
  progress: "Tiến độ",
  jobs: "Việc làm",
  community: "Cộng đồng",
};
// View gắn với một track (URL có tiền tố track); các view còn lại dùng chung.
const TRACK_VIEWS = new Set(["home", "study", "review", "quiz", "interview", "roadmap", "progress", "jobs"]);

const app = document.getElementById("app");
let current = null; // { destroy?, canLeave? } do view trả về
let currentHash = null;

function savedTrack() {
  const id = prefs.get("track", DEFAULT_TRACK);
  return getTrack(id) ? id : DEFAULT_TRACK;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  const track = getTrack(segments[0]) ? segments.shift() : null;
  return { raw, track, name: segments[0] || "home", params: segments.slice(1), query: Object.fromEntries(new URLSearchParams(qs)) };
}

let routeToken = 0;

async function route() {
  const { raw, track: urlTrack, name, params, query } = parseHash();
  const view = VIEWS[name];
  if (!view) {
    location.replace("#/");
    return;
  }
  // Link không có track -> thêm track đang chọn (giữ nguyên phần còn lại của URL).
  if (TRACK_VIEWS.has(name) && !urlTrack && name !== "home") {
    location.replace(`#/${savedTrack()}/${raw}`);
    return;
  }
  const trackId = name === "q" ? trackOfId(params[0] || "").id : urlTrack || savedTrack();
  const track = getTrack(trackId);
  if (name === "roadmap" && !track.hasRoadmap) {
    location.replace(`#/${trackId}`);
    return;
  }
  if (current && current.canLeave && !current.canLeave()) {
    // Người dùng huỷ rời trang (vd. đang làm quiz): khôi phục URL cũ.
    if (currentHash !== null && location.hash !== currentHash) {
      history.replaceState(null, "", currentHash || "#/");
    }
    return;
  }

  const token = ++routeToken;
  const hashAtStart = location.hash;
  try {
    await loadTrack(trackId);
  } catch (err) {
    app.innerHTML = `<div class="empty"><p>Không tải được dữ liệu. Kiểm tra kết nối mạng rồi tải lại trang.</p></div>`;
    return;
  }
  if (token !== routeToken) return; // đã chuyển sang trang khác trong lúc tải
  setActiveTrack(trackId);
  if (trackId !== savedTrack()) prefs.set("track", trackId);

  if (current && current.destroy) current.destroy();
  const el = document.createElement("div");
  el.className = "view";
  app.replaceChildren(el);
  current = view.mount(el, params, query) || null;
  currentHash = location.hash;

  document.title = name === "home" ? `Mobile Interview — Ôn phỏng vấn ${track.name} theo rank` : `${TITLES[name]} — ${track.name} Interview`;
  updateNav(name, track);
  updateReviewBadge();
  window.scrollTo(0, 0);
  // View có thể chuyển hướng ngay khi mount (vd. #/study -> #/study/fresher): chỉ đếm trang đích.
  if (location.hash === hashAtStart) trackPageview(document.title);
}

// Menu và ô chọn track luôn trỏ tới track đang chọn.
function updateNav(name, track) {
  const nav = document.getElementById("nav");
  for (const a of nav.querySelectorAll("[data-nav]")) {
    const view = a.dataset.nav;
    if (TRACK_VIEWS.has(view)) a.setAttribute("href", view === "home" ? `#/${track.id}` : `#/${track.id}/${view}`);
    if (view === "roadmap") a.hidden = !track.hasRoadmap;
    const active = view === name;
    a.classList.toggle("active", active);
    if (active) {
      a.setAttribute("aria-current", "page");
      // Menu cuộn ngang trên mobile: đưa mục đang mở vào giữa.
      if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    } else a.removeAttribute("aria-current");
  }
  const select = document.getElementById("track-select");
  select.value = track.id;
  document.documentElement.dataset.track = track.id;
}

// ---- Chọn track: giữ nguyên trang đang xem nếu track mới cũng có trang đó ----
const trackSelect = document.getElementById("track-select");
trackSelect.innerHTML = TRACKS.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
trackSelect.addEventListener("change", () => {
  const next = getTrack(trackSelect.value);
  const { name, params } = parseHash();
  let target = `#/${next.id}`;
  if (name === "study" || name === "quiz") target += `/${name}${name === "study" && params[0] ? "/" + params[0] : ""}`;
  else if (["review", "interview", "progress", "jobs"].includes(name) || (name === "roadmap" && next.hasRoadmap)) target += `/${name}`;
  else if (name === "community") {
    prefs.set("track", next.id);
    return route();
  }
  location.hash = target;
});

// Bấm lại link của trang hiện tại -> mở lại trang từ đầu (vd. về màn chọn quiz).
document.getElementById("nav").addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (a && a.getAttribute("href") === location.hash && !e.metaKey && !e.ctrlKey) {
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
