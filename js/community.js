// Dữ liệu trang Cộng đồng: mỗi đóng góp là một GitHub Issue của repo.
// - Loại đóng góp  = label "type: ..." (gắn tự động bởi issue template)
// - Trạng thái     = label "status: ..." do maintainer gắn, hoặc trạng thái đóng của issue
// - Bình chọn      = số reaction 👍 trên issue
import { GITHUB_API, GITHUB_URL } from "./config.js";

export const TYPES = [
  {
    id: "question",
    label: "type: question",
    name: "Câu hỏi phỏng vấn",
    short: "Câu hỏi",
    desc: "Đóng góp câu hỏi phỏng vấn hoặc câu quiz mới cho ngân hàng câu hỏi.",
    template: "1-question.yml",
  },
  {
    id: "feature",
    label: "type: feature",
    name: "Đề xuất tính năng",
    short: "Tính năng",
    desc: "Ý tưởng tính năng mới hoặc cải tiến cho website.",
    template: "2-feature.yml",
  },
  {
    id: "content",
    label: "type: content",
    name: "Góp ý nội dung",
    short: "Nội dung",
    desc: "Báo đáp án sai, câu hỏi lỗi thời hoặc gợi ý viết lại cho rõ hơn.",
    template: "3-content.yml",
  },
  {
    id: "bug",
    label: "type: bug",
    name: "Báo lỗi",
    short: "Lỗi",
    desc: "Website hiển thị sai, không bấm được, mất tiến độ...",
    template: "4-bug.yml",
  },
  {
    id: "discussion",
    label: "type: discussion",
    name: "Hỏi đáp & thảo luận",
    short: "Hỏi đáp",
    desc: "Hỏi kinh nghiệm phỏng vấn, chia sẻ đề phỏng vấn thực tế.",
    template: "5-discussion.yml",
  },
  {
    id: "job",
    label: "type: job",
    name: "Tin tuyển dụng",
    short: "Tuyển dụng",
    desc: "Đăng tin tuyển Flutter, Android, iOS, React Native — hiển thị ở trang Việc làm.",
    template: "6-job.yml",
  },
];
const OTHER_TYPE = { id: "other", name: "Khác", short: "Khác" };

// Thứ tự = luồng xử lý. "new" là issue đang mở chưa có label trạng thái.
export const STATUSES = [
  { id: "new", name: "Mới", color: "gray" },
  { id: "reviewing", name: "Đang xem xét", color: "amber", label: "status: reviewing" },
  { id: "planned", name: "Đã lên kế hoạch", color: "blue", label: "status: planned" },
  { id: "in-progress", name: "Đang thực hiện", color: "purple", label: "status: in progress" },
  { id: "done", name: "Đã hoàn thành", color: "green" },
  { id: "declined", name: "Không thực hiện", color: "red" },
];
export const STATUS_FLOW = ["new", "reviewing", "planned", "in-progress", "done"];

export function getType(id) {
  return TYPES.find((t) => t.id === id) || OTHER_TYPE;
}
export function getStatus(id) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}

export function newIssueUrl(typeId, fields = {}) {
  const type = getType(typeId);
  const params = new URLSearchParams({ template: type.template || "" });
  for (const [k, v] of Object.entries(fields)) if (v) params.set(k, v);
  return `${GITHUB_URL}/issues/new?${params}`;
}

// ---------- Chuẩn hoá issue ----------
function statusOf(issue, labels) {
  if (issue.state === "closed") {
    return issue.state_reason === "completed" ? "done" : "declined";
  }
  // Lấy trạng thái "xa" nhất nếu lỡ gắn nhiều label.
  for (const id of ["in-progress", "planned", "reviewing"]) {
    if (labels.includes(getStatus(id).label)) return id;
  }
  return "new";
}

// Issue form tạo body dạng "### Tiêu đề trường\n\nGiá trị" -> tách thành các mục.
export function parseSections(body) {
  const sections = [];
  const parts = String(body || "").split(/^###\s+(.+)$/m);
  if (parts[0].trim()) sections.push({ title: "", text: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const text = (parts[i + 1] || "").trim();
    if (text && text !== "_No response_") sections.push({ title: parts[i].trim(), text });
  }
  return sections;
}

function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_>#~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const META_FIELDS = new Set(["Rank", "Chủ đề", "Loại", "Thiết bị / trình duyệt", "Vị trí nội dung"]);

function normalize(issue) {
  const labels = issue.labels.map((l) => (typeof l === "string" ? l : l.name));
  const type = TYPES.find((t) => labels.includes(t.label));
  const sections = parseSections(issue.body);
  const main = sections.filter((s) => !META_FIELDS.has(s.title)).sort((a, b) => b.text.length - a.text.length)[0];
  const meta = sections.filter((s) => META_FIELDS.has(s.title) && s.text.length < 60).map((s) => `${s.title}: ${plainText(s.text)}`);
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    type: type ? type.id : "other",
    status: statusOf(issue, labels),
    author: issue.user ? issue.user.login : "ghost",
    avatar: issue.user ? issue.user.avatar_url : "",
    staff: ["OWNER", "MEMBER", "COLLABORATOR"].includes(issue.author_association),
    created: issue.created_at,
    updated: issue.updated_at,
    comments: issue.comments,
    votes: (issue.reactions && issue.reactions["+1"]) || 0,
    excerpt: plainText(main ? main.text : "").slice(0, 280),
    meta,
    bodyHtml: issue.body_html || "",
    // Tin tuyển dụng cần từng trường (công ty, địa điểm...) để hiển thị ở trang Việc làm.
    fields: type && type.id === "job" ? Object.fromEntries(sections.map((s) => [s.title, s.text])) : undefined,
  };
}

// ---------- Gọi API có cache ----------
// GitHub cho phép 60 request/giờ/IP khi không đăng nhập. Request có ETag mà dữ liệu
// không đổi trả về 304 và không bị tính vào giới hạn, nên lưu ETag theo từng trang.
const CACHE_KEY = "fip.community.v2";
const FRESH_MS = 60 * 1000;
const MAX_PAGES = 5;

try {
  localStorage.removeItem("fip.community.v1"); // cache cũ chưa có trường tin tuyển dụng
} catch (e) {
  /* bị chặn: bỏ qua */
}

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && Array.isArray(c.pages) ? c : null;
  } catch (e) {
    return null;
  }
}
function writeCache(c) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch (e) {
    /* hết dung lượng hoặc bị chặn: vẫn chạy được, chỉ không cache */
  }
}

export class RateLimitError extends Error {
  constructor(resetAt) {
    super("GitHub đang giới hạn số lượt truy cập.");
    this.resetAt = resetAt;
  }
}

async function getJson(url, etag) {
  const headers = { Accept: "application/vnd.github.full+json" };
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(url, { headers });
  if (res.status === 304) return { notModified: true };
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("X-RateLimit-Reset"));
    throw new RateLimitError(reset ? reset * 1000 : null);
  }
  if (!res.ok) throw new Error(`GitHub trả về lỗi ${res.status}.`);
  return { data: await res.json(), etag: res.headers.get("ETag") };
}

function itemsFrom(cache) {
  return cache.pages.flatMap((p) => p.items);
}

// Trả về { items, stale, error, fetchedAt }. force = bỏ qua thời gian "còn mới".
export async function loadIssues({ force = false } = {}) {
  const cache = readCache();
  if (cache && !force && Date.now() - cache.ts < FRESH_MS) {
    return { items: itemsFrom(cache), fetchedAt: cache.ts };
  }
  try {
    const pages = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const prev = cache && cache.pages[page - 1];
      const url = `${GITHUB_API}/issues?state=all&per_page=100&sort=created&direction=desc&page=${page}`;
      const res = await getJson(url, prev && prev.etag);
      const current = res.notModified
        ? prev
        : { etag: res.etag, items: res.data.filter((i) => !i.pull_request).map(normalize), count: res.data.length };
      pages.push(current);
      if (current.count < 100) break;
    }
    const next = { ts: Date.now(), pages };
    writeCache(next);
    return { items: itemsFrom(next), fetchedAt: next.ts };
  } catch (error) {
    if (cache) return { items: itemsFrom(cache), fetchedAt: cache.ts, stale: true, error };
    throw error;
  }
}

// Một issue cụ thể: lấy từ danh sách đã cache, nếu không có thì gọi API.
export async function loadIssue(number) {
  const cache = readCache();
  const found = cache && itemsFrom(cache).find((i) => i.number === number);
  if (found) return found;
  const res = await getJson(`${GITHUB_API}/issues/${number}`);
  if (res.data.pull_request) throw new Error("Không tìm thấy đóng góp này.");
  return normalize(res.data);
}

const commentCache = new Map();
export async function loadComments(number) {
  if (commentCache.has(number)) return commentCache.get(number);
  const res = await getJson(`${GITHUB_API}/issues/${number}/comments?per_page=100`);
  const list = res.data.map((c) => ({
    author: c.user ? c.user.login : "ghost",
    avatar: c.user ? c.user.avatar_url : "",
    staff: ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association),
    created: c.created_at,
    bodyHtml: c.body_html || "",
    votes: (c.reactions && c.reactions["+1"]) || 0,
  }));
  commentCache.set(number, list);
  return list;
}

// ---------- Làm sạch HTML do GitHub render ----------
// GitHub đã sanitize body_html, nhưng vẫn lọc lại theo allowlist trước khi chèn vào trang.
const ALLOWED_TAGS = new Set(
  (
    "a p br hr h1 h2 h3 h4 h5 h6 strong em b i del s code pre blockquote ul ol li " +
    "table thead tbody tr th td img span div details summary sup sub kbd input"
  ).split(" "),
);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "form", "textarea", "select", "button", "svg", "math", "template", "noscript", "video", "audio"]);

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild;
  const walk = (node) => {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!ALLOWED_TAGS.has(tag) || (tag === "input" && child.getAttribute("type") !== "checkbox")) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const keep =
          (tag === "a" && name === "href" && /^(https?:|mailto:)/i.test(attr.value)) ||
          (tag === "img" && name === "src" && /^https:/i.test(attr.value)) ||
          (tag === "img" && name === "alt") ||
          ((tag === "th" || tag === "td") && name === "align") ||
          (tag === "input" && (name === "type" || name === "checked")) ||
          (tag === "details" && name === "open");
        if (!keep) child.removeAttribute(attr.name);
      }
      if (tag === "a") {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer nofollow ugc");
      }
      if (tag === "img") child.setAttribute("loading", "lazy");
      if (tag === "input") child.setAttribute("disabled", "");
    }
  };
  walk(root);
  return root.innerHTML;
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
