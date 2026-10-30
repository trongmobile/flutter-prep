import { getRank, getTrack, currentTrack, topicName } from "../data/index.js";

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

const words = (str) => new Set(str.trim().split(/\s+/));
const KEYWORDS = {
  dart: words(`
    abstract as assert async await base break case catch class const continue covariant default
    deferred do dynamic else enum export extends extension external factory false final finally for
    Function get hide if implements import in interface is late library mixin new null on operator part
    required rethrow return sealed set show static super switch sync this throw true try typedef var void
    when while with yield`),
  kotlin: words(`
    abstract actual annotation as break by catch class companion const constructor continue crossinline
    data do else enum expect external false final finally for fun get if import in infix init inline inner
    interface internal is lateinit noinline null object open operator out override package private protected
    public reified return sealed set super suspend tailrec this throw true try typealias val value var vararg
    when where while`),
  java: words(`
    abstract assert boolean break byte case catch char class const continue default do double else enum
    extends false final finally float for if implements import instanceof int interface long native new
    null package permits private protected public record return sealed short static super switch
    synchronized this throw throws transient true try var void volatile while yield`),
  swift: words(`
    actor any associatedtype async await borrowing break case catch class consuming continue default defer
    deinit didSet do else enum extension fallthrough false fileprivate final for func get guard if import in
    indirect init inout internal is isolated lazy let mutating nil nonisolated open operator override private
    protocol public repeat required rethrows return self sending set some static struct subscript super switch
    throw throws true try typealias unowned var weak where while willSet`),
  ts: words(`
    abstract any as async await boolean break case catch class const constructor continue declare default
    delete do else enum export extends false finally for from function get if implements import in infer
    instanceof interface keyof let namespace never new null number of private protected public readonly
    return satisfies set static string super switch this throw true try type typeof undefined unknown var
    void while yield`),
};
const LANG_LABELS = { dart: "Dart", kotlin: "Kotlin", java: "Java", swift: "Swift", ts: "TypeScript", xml: "XML" };

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('''[\s\S]*?'''|"""[\s\S]*?"""|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(@\w+)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
const XML_RE = /(<!--[\s\S]*?-->)|("[^"]*")|(<\/?[\w:.-]+|\/?>)|([\w:.-]+)(?==)/g;

const span = (cls, text) => `<span class="${cls}">${escapeHtml(text)}</span>`;

function highlightXml(code) {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(XML_RE)) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) out += span("tk-com", m[0]);
    else if (m[2]) out += span("tk-str", m[0]);
    else if (m[3]) out += span("tk-kw", m[0]);
    else out += span("tk-type", m[0]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}

// Tô màu cú pháp tối giản: comment, chuỗi, annotation, số, keyword, tên kiểu (viết hoa).
export function highlightCode(code, lang = "dart") {
  if (lang === "xml") return highlightXml(code);
  const keywords = KEYWORDS[lang] || KEYWORDS.dart;
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN_RE)) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) out += span("tk-com", m[0]);
    else if (m[2]) out += span("tk-str", m[0]);
    else if (m[3]) out += span("tk-ann", m[0]);
    else if (m[4]) out += span("tk-num", m[0]);
    else if (keywords.has(m[5])) out += span("tk-kw", m[0]);
    else if (/^[A-Z]/.test(m[5])) out += span("tk-type", m[0]);
    else out += escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}

// label = true: hiện tên ngôn ngữ phía trên khối code (vd. "Java" trong track Android).
export function codeBlock(code, lang = "dart", label = false) {
  if (!code) return "";
  const attr = label ? ` data-lang="${escapeHtml(LANG_LABELS[lang] || lang)}"` : "";
  return `<pre class="code-block"${attr}><code>${highlightCode(code, lang)}</code></pre>`;
}

// Khối code của một câu hỏi: ngôn ngữ mặc định theo track; câu có `lang` riêng thì hiện nhãn.
export function codeOf(item) {
  if (!item || !item.code) return "";
  const track = getTrack(item.track) || currentTrack();
  return codeBlock(item.code, item.lang || track.lang, Boolean(item.lang && item.lang !== track.lang));
}

// Link trong track đang chọn: link("study/junior") -> "#/android/study/junior".
export function link(path = "") {
  return `#/${currentTrack().id}${path ? "/" + path : ""}`;
}

export function topicTag(topic) {
  return `<span class="tag">${escapeHtml(topicName(topic))}</span>`;
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

// Link chia sẻ trỏ tới trang tĩnh s/<id>.html (thẻ preview riêng cho từng câu, Google đọc được),
// trang đó có nút mở câu trong app (#/q/<id>).
export function shareUrl(id) {
  return new URL(`s/${encodeURIComponent(id)}.html`, location.href.split("#")[0]).href;
}

export async function shareItem(item) {
  const url = shareUrl(item.id);
  const text = String(item.q).replace(/`/g, "");
  const track = getTrack(item.track) || currentTrack();
  const data = { title: `Câu hỏi phỏng vấn ${track.name}`, text: text.length > 140 ? text.slice(0, 140) + "…" : text, url };
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

// "Đọc thêm trong tài liệu · docs.flutter.dev ↗" cho câu có link tài liệu chính thức (trường doc).
export function docHtml(item) {
  if (!item || !item.doc) return "";
  const host = new URL(item.doc).hostname.replace(/^www\./, "");
  return `<p class="doc-link"><a href="${escapeHtml(item.doc)}" target="_blank" rel="noopener">Đọc thêm trong tài liệu · ${escapeHtml(host)} ↗</a></p>`;
}

// Phạm vi một buổi phỏng vấn thử trong lịch sử: "Senior", "Mọi rank · 3 chủ đề".
export function interviewScope(h) {
  const rank = h.rank === "all" ? "Mọi rank" : getRank(h.rank)?.name || h.rank;
  return Array.isArray(h.topics) && h.topics.length ? `${rank} · ${h.topics.length} chủ đề` : rank;
}

// "Đóng góp bởi @user · #12" cho câu hỏi đến từ cộng đồng (trường by / issue).
export function creditHtml(item) {
  if (!item || !item.by) return "";
  const login = escapeHtml(item.by);
  const issue = Number.isInteger(item.issue) ? ` · <a href="#/community/${item.issue}">#${item.issue}</a>` : "";
  return `<p class="credit">Đóng góp bởi <a href="https://github.com/${login}" target="_blank" rel="noopener">@${login}</a>${issue}</p>`;
}
