import { RANKS, currentTrack } from "../../data/index.js";
import { prefs } from "../store.js";
import { escapeHtml, formatDuration, formatDate, percent, link } from "../utils.js";
import { RANKED_COUNT, BOARD_LIMIT, NICK_MAX, leaderboardEnabled, currentPlayer, fetchBoard, setNickname } from "../leaderboard.js";

// Mỗi nền tảng có 5 bảng: 4 rank + Tổng hợp (đề lấy từ mọi rank).
const BOARDS = [...RANKS, { id: "all", name: "Tổng hợp", color: "mixed" }];
const PERIODS = [
  { id: "week", name: "Tuần này" },
  { id: "all", name: "Mọi thời đại" },
];
const AVATAR_COLORS = ["blue", "green", "amber", "purple", "red"];

const TROPHY = `
  <svg class="lb-trophy" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="lb-gold" x1="0" y1="0" x2="0" y2="1">
        <stop class="lb-gold-hi" offset="0" /><stop class="lb-gold-lo" offset="1" />
      </linearGradient>
    </defs>
    <path class="lb-trophy-handles" d="M17 15H9v5a9 9 0 0 0 9.5 9M47 15h8v5a9 9 0 0 1-9.5 9" />
    <path class="lb-trophy-cup" d="M15 8h34v15a17 17 0 0 1-34 0z" />
    <path class="lb-trophy-cup" d="M28 39h8v8h-8z" />
    <rect class="lb-trophy-cup" x="19" y="47" width="26" height="9" rx="2.5" />
    <path class="lb-trophy-star" d="M32 14.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
    <path class="lb-trophy-shine" d="M21 13v9a11 11 0 0 0 4 8.5" />
  </svg>`;
const CROWN = `<svg class="lb-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 15h20l-1.7-11-5.3 4.6L12 1 9 8.6 3.7 4z" /></svg>`;

export function boardName(rankId) {
  const b = BOARDS.find((x) => x.id === rankId);
  return b ? b.name : rankId;
}

export function boardHref(rankId, period = "week") {
  return link(`leaderboard/${rankId}${period === "all" ? "?period=all" : ""}`);
}

// Form đặt biệt danh, dùng chung với màn kết quả quiz.
export function nickForm({ value = "", error = "", busy = false, submitLabel = "Lưu", cancel = false } = {}) {
  return `
    <form class="nick-form" data-form="nick" novalidate>
      <label class="sr-only" for="lb-nick">Biệt danh</label>
      <input id="lb-nick" class="input" name="nick" maxlength="${NICK_MAX}" autocomplete="nickname" spellcheck="false"
        placeholder="Biệt danh của bạn" value="${escapeHtml(value)}" ${busy ? "disabled" : ""} />
      <button type="submit" class="btn btn-primary" ${busy ? "disabled" : ""}>${busy ? "Đang lưu..." : escapeHtml(submitLabel)}</button>
      ${cancel ? `<button type="button" class="btn btn-ghost" data-action="nick-cancel" ${busy ? "disabled" : ""}>Huỷ</button>` : ""}
      <p class="form-error" role="alert">${escapeHtml(error)}</p>
    </form>`;
}

// Avatar chữ cái đầu, màu cố định theo biệt danh.
function initials(name) {
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const s = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || name).slice(0, 2);
  return s.toLocaleUpperCase("vi");
}
function avatar(name, size = "") {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `<span class="lb-avatar av-${AVATAR_COLORS[h % AVATAR_COLORS.length]} ${size}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}
const emptyAvatar = (size = "") => `<span class="lb-avatar av-empty ${size}" aria-hidden="true">?</span>`;

const scoreClass = (r) => {
  const p = percent(r.correct, r.total);
  return p >= 70 ? "s-good" : p >= 50 ? "s-mid" : "s-low";
};
const youTag = (r) => (r.me ? '<span class="lb-you">bạn</span>' : "");

// Top 3 trên bục: thứ tự DOM 1-2-3 (cho trình đọc màn hình), CSS xếp lại thành 2-1-3.
function podiumHtml(rows) {
  const steps = [1, 2, 3].map((pos) => {
    const r = rows.find((x) => x.pos === pos);
    if (!r) {
      return `
        <li class="lb-step p${pos} vacant">
          <div class="lb-step-who">${emptyAvatar("lg")}<span class="lb-step-name">Còn trống</span></div>
          <div class="lb-step-block"><span class="sr-only">Hạng </span>${pos}</div>
        </li>`;
    }
    return `
      <li class="lb-step p${pos}${r.me ? " me" : ""}" title="Nộp lúc ${formatDate(r.played_at)}">
        <div class="lb-step-who">
          ${pos === 1 ? CROWN : ""}
          ${avatar(r.nickname, "lg")}
          <span class="lb-step-name">${escapeHtml(r.nickname)}</span>
          ${youTag(r)}
          <span class="lb-step-score"><strong>${r.correct}</strong>/${r.total}</span>
          <span class="lb-step-time">${formatDuration(r.duration)}</span>
        </div>
        <div class="lb-step-block"><span class="sr-only">Hạng </span>${pos}</div>
      </li>`;
  });
  return `<ol class="lb-podium" aria-label="Top 3">${steps.join("")}</ol>`;
}

// Hạng 4 trở đi; dòng của mình nằm ngoài top thì có dấu ⋯ ngăn cách.
function listHtml(rows) {
  const rest = rows.filter((r) => r.pos > 3);
  if (!rest.length) return "";
  let prev = 3;
  const items = rest.map((r, i) => {
    const gap = r.pos > prev + 1 ? `<li class="lb-gap" aria-hidden="true">⋯</li>` : "";
    prev = r.pos;
    return `${gap}
      <li class="lb-row ${scoreClass(r)}${r.me ? " me" : ""}" style="--i:${Math.min(i, 14)}" title="Nộp lúc ${formatDate(r.played_at)}">
        <span class="lb-row-pos"><span class="sr-only">Hạng </span>${r.pos}</span>
        <span class="lb-row-who">${avatar(r.nickname)}<span class="lb-row-name">${escapeHtml(r.nickname)}</span>${youTag(r)}</span>
        <span class="lb-row-bar" aria-hidden="true"><span style="width:${percent(r.correct, r.total)}%"></span></span>
        <span class="lb-row-score">${r.correct}/${r.total}</span>
        <span class="lb-row-time">${formatDuration(r.duration)}</span>
      </li>`;
  });
  return `
    <div class="lb-list-head" aria-hidden="true"><span>Hạng</span><span>Người thi</span><span class="score">Điểm</span><span class="time">Thời gian</span></div>
    <ol class="lb-list">${items.join("")}</ol>`;
}

// Khoảng cách tới người xếp ngay trên: biến bảng xếp hạng thành mục tiêu cụ thể.
function gapText(me, rows) {
  if (me.pos === 1) return "Bạn đang dẫn đầu bảng. Giữ vững nhé!";
  const above = rows.find((r) => r.pos === me.pos - 1) || [...rows].reverse().find((r) => r.pos < me.pos);
  if (!above) return "";
  const who = `<strong>${escapeHtml(above.nickname)}</strong> (#${above.pos})`;
  if (above.correct > me.correct) return `Đúng thêm ${above.correct - me.correct} câu để bắt kịp ${who}.`;
  const faster = me.duration - above.duration + 1;
  return `Bằng điểm ${who}, làm nhanh hơn ${faster < 60 ? `${faster} giây` : formatDuration(faster)} là vượt lên.`;
}

export function mount(el, params, query) {
  const track = currentTrack();
  const isBoard = (id) => BOARDS.some((b) => b.id === id);
  const fallback = [prefs.get("lbRank"), prefs.get("quizRank")].find(isBoard) || "all";
  const rankId = isBoard(params[0]) ? params[0] : fallback;
  const period = query.period === "all" ? "all" : "week";
  if (params[0] !== rankId) {
    location.replace(boardHref(rankId, period));
    return;
  }
  prefs.set("lbRank", rankId);
  const board = BOARDS.find((b) => b.id === rankId);
  const startHref = link(`quiz?rank=${rankId}&ranked=1`);

  if (!leaderboardEnabled()) {
    el.innerHTML = `
      <div class="empty">
        <p><strong>Bảng xếp hạng chưa được bật.</strong><br />Chủ site cần điền SUPABASE_URL và SUPABASE_KEY trong <code>js/config.js</code> (xem README).</p>
        <a class="btn btn-ghost" href="${link("quiz")}">Làm quiz</a>
      </div>`;
    return;
  }

  let rows = null; // null = đang tải
  let editing = false;
  let draft = "";
  let nickError = "";
  let busy = false;

  el.innerHTML = `
    <div class="lb">
      <nav class="rank-tabs" aria-label="Chọn bảng xếp hạng">
        ${BOARDS.map(
          (b) =>
            `<a class="rank-tab rank-${b.color}${b.id === rankId ? " active" : ""}" href="${boardHref(b.id, period)}"${
              b.id === rankId ? ' aria-current="page"' : ""
            }>${escapeHtml(b.name)}</a>`,
        ).join("")}
      </nav>

      <header class="lb-hero rank-${board.color}">
        <div class="lb-hero-text">
          <div class="eyebrow">bảng xếp hạng · ${escapeHtml(track.name)} · đề chuẩn ${RANKED_COUNT} câu</div>
          <h1>Bảng xếp hạng ${escapeHtml(track.name)} <span class="lb-board-name">${escapeHtml(board.name)}</span></h1>
          <p class="subtitle">Thi thử ${RANKED_COUNT} câu, không lọc chủ đề. Nhiều câu đúng hơn thì xếp trên, bằng điểm thì ai nhanh hơn. Mỗi người tính bài tốt nhất.</p>
          <div class="lb-hero-actions">
            <a class="btn btn-primary" href="${startHref}">Thi ngay ${RANKED_COUNT} câu →</a>
            <div class="seg" role="group" aria-label="Khoảng thời gian">
              ${PERIODS.map(
                (p) =>
                  `<button type="button" data-period="${p.id}" class="${p.id === period ? "active" : ""}" aria-pressed="${p.id === period}">${p.name}</button>`,
              ).join("")}
            </div>
          </div>
          <div class="lb-live" data-slot="live" hidden></div>
        </div>
        ${TROPHY}
      </header>

      <div data-slot="me"></div>
      <div data-slot="board"></div>
    </div>
  `;

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);

  function renderMe() {
    const p = currentPlayer();
    const nick = p && p.nick;
    const mine = rows && rows.find((r) => r.me);
    if (editing) {
      slot("me").innerHTML = `
        <div class="lb-me-card">
          ${draft.trim() ? avatar(draft.trim()) : emptyAvatar()}
          ${nickForm({ value: draft, error: nickError, busy, cancel: true })}
        </div>`;
      const input = slot("me").querySelector("input");
      if (input && !busy) input.focus();
      return;
    }
    if (!nick) {
      slot("me").innerHTML = `
        <div class="lb-me-card">
          ${emptyAvatar()}
          <div class="lb-me-text">
            <div class="lb-me-title">Bạn chưa có biệt danh</div>
            <div class="lb-me-hint">Đặt biệt danh rồi thi đề chuẩn để có tên trên bảng.</div>
          </div>
          <button type="button" class="btn btn-ghost" data-action="nick-edit">Đặt biệt danh</button>
        </div>`;
      return;
    }
    const rename = `<button type="button" class="link-btn" data-action="nick-edit">Đổi tên</button>`;
    if (!mine) {
      slot("me").innerHTML = `
        <div class="lb-me-card">
          ${avatar(nick)}
          <div class="lb-me-text">
            <div class="lb-me-title">${escapeHtml(nick)} ${rename}</div>
            <div class="lb-me-hint">${rows ? "Bạn chưa có điểm trên bảng này. Thi đề chuẩn để giành một chỗ!" : "Đang tải hạng của bạn..."}</div>
          </div>
        </div>`;
      return;
    }
    slot("me").innerHTML = `
      <div class="lb-me-card ranked">
        ${avatar(nick)}
        <div class="lb-me-text">
          <div class="lb-me-title">${escapeHtml(nick)} ${rename}</div>
          <div class="lb-me-hint">${gapText(mine, rows)}</div>
        </div>
        <div class="lb-me-stats">
          <div class="lb-me-stat"><strong>#${mine.pos}</strong><span>hạng</span></div>
          <div class="lb-me-stat"><strong>${mine.correct}/${mine.total}</strong><span>điểm</span></div>
          <div class="lb-me-stat"><strong>${formatDuration(mine.duration)}</strong><span>thời gian</span></div>
        </div>
      </div>`;
  }

  function renderLive() {
    const live = slot("live");
    const n = rows ? rows.filter((r) => r.pos <= BOARD_LIMIT).length : 0;
    live.hidden = !n;
    if (n) live.textContent = `${n}${n >= BOARD_LIMIT ? "+" : ""} người ${period === "week" ? "đã thi tuần này" : "trên bảng"}`;
  }

  function renderBoard() {
    if (!rows) {
      slot("board").innerHTML = `
        <div class="lb-skel" aria-hidden="true">
          <div class="skeleton lb-skel-podium"></div>
          ${'<div class="skeleton lb-skel-row"></div>'.repeat(3)}
        </div>`;
      return;
    }
    slot("board").innerHTML = `
      ${podiumHtml(rows)}
      ${
        rows.length
          ? listHtml(rows)
          : `<div class="lb-empty-cta">
              <p><strong>Chưa có ai trên bảng${period === "week" ? " tuần này" : ""}.</strong> Làm bài đầu tiên để đứng hạng 1!</p>
              <a class="btn btn-primary" href="${startHref}">Thi ngay ${RANKED_COUNT} câu →</a>
            </div>`
      }
      ${rows.length ? `<div class="center-row"><button type="button" class="link-btn subtle" data-action="refresh">Làm mới</button></div>` : ""}`;
  }

  async function load(force) {
    try {
      const next = await fetchBoard(track.id, rankId, period, { force });
      if (!el.isConnected) return;
      rows = next;
      renderBoard();
      renderLive();
      if (!editing) renderMe();
    } catch (err) {
      if (!el.isConnected) return;
      slot("board").innerHTML = `
        <div class="empty">
          <p>${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-ghost" data-action="refresh">Thử lại</button>
        </div>`;
    }
  }

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.period) {
      location.hash = boardHref(rankId, t.dataset.period);
      return;
    }
    switch (t.dataset.action) {
      case "refresh":
        rows = null;
        renderBoard();
        return load(true);
      case "nick-edit":
        editing = true;
        draft = (currentPlayer() || {}).nick || "";
        nickError = "";
        return renderMe();
      case "nick-cancel":
        editing = false;
        return renderMe();
    }
  });

  el.addEventListener("submit", async (e) => {
    const form = e.target.closest('[data-form="nick"]');
    if (!form) return;
    e.preventDefault();
    draft = form.elements.nick.value;
    busy = true;
    nickError = "";
    renderMe();
    try {
      await setNickname(draft);
      editing = false;
    } catch (err) {
      nickError = err.message;
    }
    busy = false;
    if (!el.isConnected) return;
    renderMe();
    if (!editing) load(true);
  });

  renderBoard();
  renderMe();
  load(false);
}
