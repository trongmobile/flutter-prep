import { RANKS, TOPICS, getRank, questionsFor } from "../../data/index.js";
import { study, prefs } from "../store.js";
import { escapeHtml, fmt, codeBlock, topicTag, shuffle, percent, stackedBar, creditHtml, shareItem } from "../utils.js";

const STATUS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "new", label: "Chưa ôn" },
  { id: "review", label: "Cần ôn lại" },
  { id: "known", label: "Đã thuộc" },
];

// Bộ lọc giữ nguyên khi đổi rank / quay lại trang.
const ui = { topic: "all", status: "all", search: "", mode: "list" };

export function mount(el, params) {
  const lastRank = getRank(prefs.get("lastRank")) ? prefs.get("lastRank") : "fresher";
  const rankId = params[0] && getRank(params[0]) ? params[0] : lastRank;
  if (params[0] !== rankId) {
    location.replace(`#/study/${rankId}`);
    return;
  }
  prefs.set("lastRank", rankId);
  const rank = getRank(rankId);
  const all = questionsFor(rankId);
  const indexOf = new Map(all.map((q, i) => [q.id, i + 1]));
  if (ui.topic !== "all" && !all.some((q) => q.topic === ui.topic)) ui.topic = "all";

  const opened = new Set();
  const deck = { order: null, index: 0, flipped: false };

  el.innerHTML = `
    <nav class="rank-tabs" aria-label="Chọn rank">
      ${RANKS.map(
        (r) =>
          `<a class="rank-tab rank-${r.color}${r.id === rankId ? " active" : ""}" href="#/study/${r.id}">${escapeHtml(r.name)}</a>`,
      ).join("")}
    </nav>
    <header class="view-head rank-${rank.color}">
      <div class="eyebrow">ôn luyện · ${escapeHtml(rank.years)}</div>
      <h1>Câu hỏi phỏng vấn ${escapeHtml(rank.name)}</h1>
      <p class="subtitle">${escapeHtml(rank.desc)}</p>
      <div data-slot="mastery"></div>
    </header>
    <div class="toolbar">
      <input type="search" class="search" placeholder="Tìm trong câu hỏi và đáp án..." aria-label="Tìm câu hỏi" value="${escapeHtml(ui.search)}" />
      <div class="seg" role="group" aria-label="Chế độ xem">
        <button type="button" data-mode="list">Danh sách</button>
        <button type="button" data-mode="cards">Flashcard</button>
      </div>
    </div>
    <div data-slot="filters"></div>
    <div data-slot="body"></div>
  `;

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const marks = () => study.all();

  function matchesSearch(q) {
    if (!ui.search) return true;
    const needle = ui.search.toLowerCase();
    return (q.q + " " + q.a).toLowerCase().includes(needle);
  }
  function matchesStatus(q, m) {
    if (ui.status === "all") return true;
    if (ui.status === "new") return !m[q.id];
    return m[q.id] === ui.status;
  }
  function filtered() {
    const m = marks();
    return all.filter(
      (q) => (ui.topic === "all" || q.topic === ui.topic) && matchesStatus(q, m) && matchesSearch(q),
    );
  }

  function renderMastery() {
    const m = marks();
    const known = all.filter((q) => m[q.id] === "known").length;
    const review = all.filter((q) => m[q.id] === "review").length;
    slot("mastery").innerHTML = `
      ${stackedBar(
        [
          { value: known, cls: "seg-known" },
          { value: review, cls: "seg-review" },
        ],
        all.length || 1,
        `${known} đã thuộc, ${review} cần ôn lại`,
      )}
      <div class="bar-label">
        <span><i class="dot dot-known"></i>${known} đã thuộc · <i class="dot dot-review"></i>${review} cần ôn lại · ${all.length - known - review} chưa ôn</span>
        <span>${percent(known, all.length)}%</span>
      </div>`;
  }

  function renderFilters() {
    const m = marks();
    const pool = all.filter((q) => matchesSearch(q));
    const inTopic = pool.filter((q) => ui.topic === "all" || q.topic === ui.topic);
    const statusCount = (id) => inTopic.filter((q) => (id === "all" ? true : id === "new" ? !m[q.id] : m[q.id] === id)).length;
    const topicCounts = {};
    for (const q of pool.filter((q) => matchesStatus(q, m))) topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
    const topicTotal = Object.values(topicCounts).reduce((a, b) => a + b, 0);
    const topicsInRank = Object.keys(TOPICS).filter((t) => all.some((q) => q.topic === t));

    slot("filters").innerHTML = `
      <div class="seg seg-wrap" role="group" aria-label="Lọc theo trạng thái">
        ${STATUS_FILTERS.map(
          (s) =>
            `<button type="button" data-status="${s.id}" class="${ui.status === s.id ? "active" : ""}" aria-pressed="${ui.status === s.id}">${s.label} <span class="count">${statusCount(s.id)}</span></button>`,
        ).join("")}
      </div>
      <div class="chips" role="group" aria-label="Lọc theo chủ đề">
        <button type="button" class="chip${ui.topic === "all" ? " active" : ""}" data-topic="all" aria-pressed="${ui.topic === "all"}">Tất cả chủ đề <span class="count">${topicTotal}</span></button>
        ${topicsInRank
          .map(
            (t) =>
              `<button type="button" class="chip${ui.topic === t ? " active" : ""}" data-topic="${t}" aria-pressed="${ui.topic === t}">${escapeHtml(TOPICS[t])} <span class="count">${topicCounts[t] || 0}</span></button>`,
          )
          .join("")}
      </div>`;
    for (const b of el.querySelectorAll("[data-mode]")) {
      b.classList.toggle("active", b.dataset.mode === ui.mode);
      b.setAttribute("aria-pressed", String(b.dataset.mode === ui.mode));
    }
  }

  // ---------- Chế độ danh sách ----------
  function cardHtml(q, m) {
    const status = m[q.id] || "";
    const open = opened.has(q.id);
    return `
      <article class="q-card${open ? " open" : ""}${status ? " is-" + status : ""}" data-id="${q.id}">
        <button type="button" class="q-head" data-action="toggle" aria-expanded="${open}">
          <span class="q-index">#${indexOf.get(q.id)}</span>
          <span class="q-text">${fmt(q.q)}</span>
          <span class="q-side">
            ${topicTag(q.topic)}
            <span class="q-status" aria-label="${status === "known" ? "Đã thuộc" : status === "review" ? "Cần ôn lại" : "Chưa ôn"}"></span>
          </span>
        </button>
        <div class="q-answer"><div class="q-answer-clip"><div class="q-answer-inner">
          <div class="answer-text">${fmt(q.a)}</div>
          ${codeBlock(q.code)}
          ${creditHtml(q)}
          ${q.day ? `<a class="q-source" href="#/roadmap/${q.day}">Trong lộ trình: ngày ${q.day}</a>` : ""}
          <div class="mark-row">
            <button type="button" class="mark-btn mark-known${status === "known" ? " active" : ""}" data-action="mark" data-value="known">✓ Đã thuộc</button>
            <button type="button" class="mark-btn mark-review${status === "review" ? " active" : ""}" data-action="mark" data-value="review">↻ Cần ôn lại</button>
            <button type="button" class="feedback-link share-link" data-action="share">↗ Chia sẻ</button>
            <a class="feedback-link" href="#/community/new?type=content&ref=${encodeURIComponent(q.id)}">Góp ý câu này</a>
          </div>
        </div></div></div>
      </article>`;
  }

  function renderList() {
    const list = filtered();
    const m = marks();
    if (!list.length) {
      slot("body").innerHTML = emptyHtml();
      return;
    }
    const allOpen = list.every((q) => opened.has(q.id));
    slot("body").innerHTML = `
      <div class="list-head">
        <span class="muted">${list.length} câu hỏi</span>
        <button type="button" class="link-btn" data-action="toggle-all">${allOpen ? "Thu gọn tất cả" : "Mở tất cả đáp án"}</button>
      </div>
      <div class="q-list">${list.map((q) => cardHtml(q, m)).join("")}</div>`;
  }

  function emptyHtml() {
    return `<div class="empty">
      <p>Không có câu hỏi nào khớp bộ lọc.</p>
      <button type="button" class="btn btn-ghost" data-action="clear-filters">Xoá bộ lọc</button>
    </div>`;
  }

  function updateCard(id) {
    const card = el.querySelector(`.q-card[data-id="${id}"]`);
    if (!card) return;
    const m = marks();
    card.outerHTML = cardHtml(all.find((q) => q.id === id), m);
  }

  // ---------- Chế độ flashcard ----------
  function deckList() {
    const list = filtered();
    if (!deck.order) return list;
    const byId = new Map(list.map((q) => [q.id, q]));
    return deck.order.filter((id) => byId.has(id)).map((id) => byId.get(id));
  }

  function renderCards() {
    const list = deckList();
    if (!list.length) {
      slot("body").innerHTML = emptyHtml();
      return;
    }
    if (deck.index >= list.length) {
      const m = marks();
      const known = list.filter((q) => m[q.id] === "known").length;
      slot("body").innerHTML = `
        <div class="flash-done card">
          <h2>Hết bộ thẻ 🎉</h2>
          <p class="muted">${list.length} thẻ · ${known} đã thuộc · ${list.length - known} chưa thuộc</p>
          <div class="btn-row center">
            <button type="button" class="btn btn-primary" data-action="restart">Ôn lại từ đầu</button>
            <button type="button" class="btn btn-ghost" data-action="only-review">Chỉ ôn câu "Cần ôn lại"</button>
          </div>
        </div>`;
      return;
    }
    const q = list[deck.index];
    const status = marks()[q.id] || "";
    slot("body").innerHTML = `
      <div class="flash">
        <div class="flash-top">
          <span class="muted">Thẻ ${deck.index + 1}/${list.length}</span>
          <div class="progress-track slim"><div class="progress-fill" style="width:${((deck.index + 1) / list.length) * 100}%"></div></div>
          <button type="button" class="link-btn" data-action="shuffle">${deck.order ? "Bỏ xáo trộn" : "Xáo trộn"}</button>
        </div>
        <div class="flash-card${deck.flipped ? " flipped" : ""}${status ? " is-" + status : ""}" data-action="flip" role="button" tabindex="0" aria-expanded="${deck.flipped}">
          <div class="flash-meta">${topicTag(q.topic)}<span class="q-index">#${indexOf.get(q.id)}</span></div>
          <div class="flash-q">${fmt(q.q)}</div>
          ${
            deck.flipped
              ? `<div class="flash-a"><div class="answer-text">${fmt(q.a)}</div>${codeBlock(q.code)}${creditHtml(q)}</div>`
              : `<div class="flash-hint">Tự trả lời trong đầu, rồi bấm để lật thẻ</div>`
          }
        </div>
        <div class="flash-actions">
          <button type="button" class="btn btn-ghost icon" data-action="prev" aria-label="Thẻ trước" ${deck.index === 0 ? "disabled" : ""}>←</button>
          <button type="button" class="btn mark-review${status === "review" ? " active" : ""}" data-action="flash-mark" data-value="review">↻ Cần ôn lại</button>
          <button type="button" class="btn mark-known${status === "known" ? " active" : ""}" data-action="flash-mark" data-value="known">✓ Đã thuộc</button>
          <button type="button" class="btn btn-ghost icon" data-action="next" aria-label="Thẻ tiếp">→</button>
        </div>
        <p class="kbd-hint">Phím tắt: <kbd>Space</kbd> lật thẻ · <kbd>←</kbd> <kbd>→</kbd> chuyển thẻ · <kbd>K</kbd> đã thuộc · <kbd>R</kbd> cần ôn lại</p>
      </div>`;
  }

  function renderBody() {
    if (ui.mode === "cards") renderCards();
    else renderList();
  }
  function renderAll() {
    renderMastery();
    renderFilters();
    renderBody();
  }
  function resetDeck() {
    deck.index = 0;
    deck.flipped = false;
  }

  function flashMark(value) {
    const list = deckList();
    const q = list[deck.index];
    if (!q) return;
    study.set(q.id, value);
    // Cố định thứ tự để thẻ vừa đánh dấu không bị lọc mất khỏi bộ thẻ đang ôn.
    if (!deck.order) deck.order = list.map((x) => x.id);
    deck.index++;
    deck.flipped = false;
    renderMastery();
    renderCards();
  }

  // ---------- Sự kiện ----------
  el.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-action]");
    if (!t || !el.contains(t)) return;

    if (t.dataset.mode) {
      ui.mode = t.dataset.mode;
      deck.order = null;
      resetDeck();
      renderFilters();
      renderBody();
      return;
    }
    if (t.dataset.status) {
      ui.status = t.dataset.status;
      deck.order = null;
      resetDeck();
      renderFilters();
      renderBody();
      return;
    }
    if (t.dataset.topic) {
      ui.topic = t.dataset.topic;
      deck.order = null;
      resetDeck();
      renderFilters();
      renderBody();
      return;
    }

    const card = t.closest(".q-card");
    switch (t.dataset.action) {
      case "share":
        shareItem(all.find((q) => q.id === card.dataset.id));
        break;
      case "toggle": {
        const id = card.dataset.id;
        if (opened.has(id)) opened.delete(id);
        else opened.add(id);
        card.classList.toggle("open");
        t.setAttribute("aria-expanded", String(opened.has(id)));
        break;
      }
      case "toggle-all": {
        const list = filtered();
        const allOpen = list.every((q) => opened.has(q.id));
        list.forEach((q) => (allOpen ? opened.delete(q.id) : opened.add(q.id)));
        renderList();
        break;
      }
      case "mark": {
        const id = card.dataset.id;
        const value = t.dataset.value;
        study.set(id, study.get(id) === value ? null : value);
        updateCard(id);
        renderMastery();
        renderFilters();
        break;
      }
      case "clear-filters":
        ui.topic = "all";
        ui.status = "all";
        ui.search = "";
        el.querySelector(".search").value = "";
        deck.order = null;
        resetDeck();
        renderFilters();
        renderBody();
        break;
      case "flip":
        deck.flipped = !deck.flipped;
        renderCards();
        el.querySelector(".flash-card")?.focus();
        break;
      case "prev":
        if (deck.index > 0) deck.index--;
        deck.flipped = false;
        renderCards();
        break;
      case "next":
        deck.index++;
        deck.flipped = false;
        renderCards();
        break;
      case "flash-mark":
        flashMark(t.dataset.value);
        break;
      case "shuffle":
        deck.order = deck.order ? null : shuffle(filtered()).map((q) => q.id);
        resetDeck();
        renderCards();
        break;
      case "restart":
        deck.order = null;
        resetDeck();
        renderFilters();
        renderCards();
        break;
      case "only-review":
        ui.status = "review";
        deck.order = null;
        resetDeck();
        renderFilters();
        renderCards();
        break;
    }
  });

  let searchTimer = null;
  el.querySelector(".search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      ui.search = e.target.value.trim();
      deck.order = null;
      resetDeck();
      renderFilters();
      renderBody();
    }, 150);
  });

  function onKey(e) {
    if (ui.mode !== "cards" || e.target.closest("input, textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === " " || key === "enter") {
      if (e.target.closest("button")) return; // để nút tự xử lý
      e.preventDefault();
      deck.flipped = !deck.flipped;
      renderCards();
    } else if (key === "arrowright") {
      if (deck.index < deckList().length) {
        deck.index++;
        deck.flipped = false;
        renderCards();
      }
    } else if (key === "arrowleft") {
      if (deck.index > 0) {
        deck.index--;
        deck.flipped = false;
        renderCards();
      }
    } else if (key === "k") flashMark("known");
    else if (key === "r") flashMark("review");
  }
  document.addEventListener("keydown", onKey);

  renderAll();

  return {
    destroy() {
      document.removeEventListener("keydown", onKey);
      clearTimeout(searchTimer);
    },
  };
}
