import { TOPICS, getRank } from "../data/index.js";

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Văn bản thường: escape HTML, `x` -> <code>x</code>, xuống dòng -> <br>.
export function fmt(str) {
  return escapeHtml(str)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

const DART_KEYWORDS = new Set(
  (
    "abstract as assert async await base break case catch class const continue covariant default " +
    "deferred do dynamic else enum export extends extension external factory false final finally for " +
    "Function get hide if implements import in interface is late library mixin new null on operator part " +
    "required rethrow return sealed set show static super switch sync this throw true try typedef var void " +
    "when while with yield"
  ).split(" "),
);

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(@\w+)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;

// Tô màu cú pháp Dart tối giản cho khối code.
export function highlightDart(code) {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN_RE)) {
    out += escapeHtml(code.slice(last, m.index));
    const text = escapeHtml(m[0]);
    if (m[1]) out += `<span class="tk-com">${text}</span>`;
    else if (m[2]) out += `<span class="tk-str">${text}</span>`;
    else if (m[3]) out += `<span class="tk-ann">${text}</span>`;
    else if (m[4]) out += `<span class="tk-num">${text}</span>`;
    else if (DART_KEYWORDS.has(m[5])) out += `<span class="tk-kw">${text}</span>`;
    else if (/^[A-Z]/.test(m[5])) out += `<span class="tk-type">${text}</span>`;
    else out += text;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}

export function codeBlock(code) {
  if (!code) return "";
  return `<pre class="code-block"><code>${highlightDart(code)}</code></pre>`;
}

export function topicTag(topic) {
  return `<span class="tag">${escapeHtml(TOPICS[topic] || topic)}</span>`;
}

export function rankTag(rankId) {
  const r = getRank(rankId);
  if (!r) return "";
  return `<span class="rank-tag rank-${r.color}">${escapeHtml(r.name)}</span>`;
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

// Thanh tiến độ nhiều đoạn: segments = [{ value, cls }]
export function stackedBar(segments, total, label = "") {
  const parts = segments
    .filter((s) => s.value > 0)
    .map((s) => `<span class="${s.cls}" style="width:${(s.value / total) * 100}%"></span>`)
    .join("");
  return `<div class="stack-bar" role="img" aria-label="${escapeHtml(label)}">${parts}</div>`;
}

// Nút xác nhận 2 lần bấm (thay cho confirm() gây khó chịu).
export function confirmClick(button, label, onConfirm, confirmLabel = "Bấm lần nữa để xác nhận") {
  if (button.dataset.confirm === "1") {
    button.dataset.confirm = "0";
    button.textContent = label;
    onConfirm();
    return;
  }
  button.dataset.confirm = "1";
  button.textContent = confirmLabel;
  setTimeout(() => {
    if (button.isConnected && button.dataset.confirm === "1") {
      button.dataset.confirm = "0";
      button.textContent = label;
    }
  }, 3000);
}

// Thông báo ngắn ở cuối màn hình.
export function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

// Link chia sẻ trỏ tới trang s/<id>.html (có thẻ preview riêng cho từng câu),
// trang đó tự chuyển về #/q/<id>.
export function shareUrl(id) {
  return new URL(`s/${encodeURIComponent(id)}.html`, location.href.split("#")[0]).href;
}

export async function shareItem(item) {
  const url = shareUrl(item.id);
  const text = String(item.q).replace(/`/g, "");
  const data = { title: "Câu hỏi phỏng vấn Flutter", text: text.length > 140 ? text.slice(0, 140) + "…" : text, url };
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // người dùng đóng bảng chia sẻ
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Đã copy link câu hỏi");
  } catch (err) {
    window.prompt("Copy link câu hỏi:", url);
  }
}

// "Đóng góp bởi @user · #12" cho câu hỏi đến từ cộng đồng (trường by / issue).
export function creditHtml(item) {
  if (!item || !item.by) return "";
  const login = escapeHtml(item.by);
  const issue = Number.isInteger(item.issue) ? ` · <a href="#/community/${item.issue}">#${item.issue}</a>` : "";
  return `<p class="credit">Đóng góp bởi <a href="https://github.com/${login}" target="_blank" rel="noopener">@${login}</a>${issue}</p>`;
}
