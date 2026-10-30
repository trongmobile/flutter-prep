import { RANKS, allQuestions, getRank, findItem, currentTrack } from "../../data/index.js";
import { srs, study, prefs, todayKey, srsSchedule, SRS_INTERVALS } from "../store.js";
import { escapeHtml, fmt, codeOf, topicTag, rankTag, docHtml, creditHtml } from "../utils.js";

const NEW_PER_DAY = [0, 5, 10, 20];
const GRADE_LABELS = { again: "Quên", hard: "Khó", good: "Nhớ" };
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function reviewRanks() {
  const saved = prefs.get("reviewRanks", null);
  const valid = Array.isArray(saved) ? saved.filter((r) => getRank(r)) : [];
  if (valid.length) return valid;
  const last = prefs.get("lastRank", "fresher");
  return [getRank(last) ? last : "fresher"];
}
function newPerDay() {
  const n = Number(prefs.get("newPerDay", 10));
  return NEW_PER_DAY.includes(n) ? n : 10;
}

// Id câu hỏi của track đang chọn: lịch ôn, câu mới mỗi ngày… tính riêng từng track.
function trackIds() {
  return new Set(allQuestions().map((q) => q.id));
}

// Hàng đợi hôm nay của track đang chọn: thẻ đến hạn + câu mới (giới hạn mỗi ngày). Dùng cả cho badge trên menu.
export function reviewQueue() {
  srs.migrate();
  const ids = trackIds();
  const due = srs.dueIds(todayKey(), ids);
  const remaining = Math.max(0, newPerDay() - srs.newToday(ids).length);
  const ranks = reviewRanks();
  const cards = srs.cards();
  const marks = study.all();
  const fresh = remaining
    ? allQuestions().filter((q) => ranks.includes(q.rank) && !cards[q.id] && !marks[q.id])
        .slice(0, remaining)
        .map((q) => q.id)
    : [];
  return { due, fresh };
}

function daysLabel(days) {
  if (days >= 60) return `${Math.round(days / 30)} tháng`;
  if (days >= 30) return "1 tháng";
  return `${days} ngày`;
}

export function mount(el) {
  let phase = "overview";
  let session = null;

  function renderOverview() {
    const { due, fresh } = reviewQueue();
    const total = due.length + fresh.length;
    const ids = trackIds();
    const forecast = srs.forecast(7, ids);
    const maxF = Math.max(1, ...forecast.map((f) => f.count));
    const cards = Object.values(srs.cards(ids));
    const boxes = SRS_INTERVALS.map((d, i) => ({ box: i + 1, days: d, count: cards.filter((c) => c.box === i + 1).length }));
    const ranks = reviewRanks();
    const next = forecast.slice(1).find((f) => f.count > 0);

    el.innerHTML = `
      <header class="view-head">
        <div class="eyebrow">ôn tập ngắt quãng · ${escapeHtml(currentTrack().name)}</div>
        <h1>Ôn hôm nay</h1>
        <p class="subtitle">Câu sắp quên sẽ được nhắc lại đúng lúc: nhớ tốt thì giãn dần 1 → 3 → 7 → 14 → 30 → 60 ngày, quên thì ôn lại từ đầu.</p>
      </header>

      <div class="tile-grid">
        <div class="tile"><span class="tile-value">${due.length}</span><span class="tile-label">câu đến hạn</span></div>
        <div class="tile"><span class="tile-value">${fresh.length}</span><span class="tile-label">câu mới hôm nay</span></div>
        <div class="tile"><span class="tile-value">${srs.reviewedToday(ids)}</span><span class="tile-label">đã ôn hôm nay</span></div>
      </div>

      <section class="card review-start">
        ${
          total
            ? `<div>
                <h2>Hôm nay có ${total} câu cần ôn</h2>
                <p class="muted">Khoảng ${Math.max(1, Math.round(total * 0.5))} phút · ${due.length} câu đến hạn, ${fresh.length} câu mới</p>
              </div>
              <button type="button" class="btn btn-primary" data-action="start">Bắt đầu ôn →</button>`
            : `<div>
                <h2>Bạn đã ôn xong hôm nay 🎉</h2>
                <p class="muted">${next ? `Lần ôn tiếp theo: ${dayName(next.day)}, ${next.count} câu.` : "Chưa có câu nào trong lịch ôn. Tăng số câu mới mỗi ngày hoặc đánh dấu câu trong phần Ôn luyện."}</p>
              </div>
              <a class="btn btn-ghost" href="#/interview">Phỏng vấn thử</a>`
        }
      </section>

      <section>
        <div class="section-head"><h2>Thiết lập</h2></div>
        <div class="card setup">
          <div class="setup-row">
            <div class="setup-label">Câu mới mỗi ngày</div>
            <div class="seg" role="group" aria-label="Câu mới mỗi ngày">
              ${NEW_PER_DAY.map((n) => `<button type="button" data-new="${n}" class="${newPerDay() === n ? "active" : ""}" aria-pressed="${newPerDay() === n}">${n}</button>`).join("")}
            </div>
          </div>
          <div class="setup-row">
            <div class="setup-label">Lấy câu mới từ rank</div>
            <div class="chips">
              ${RANKS.map((r) => {
                const on = ranks.includes(r.id);
                return `<button type="button" class="chip rank-${r.color}${on ? " active" : ""}" data-rank="${r.id}" aria-pressed="${on}">${escapeHtml(r.name)}</button>`;
              }).join("")}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="section-head"><h2>Lịch ôn 7 ngày tới</h2></div>
        <div class="card forecast" role="img" aria-label="Số câu đến hạn mỗi ngày trong 7 ngày tới">
          ${forecast
            .map(
              (f, i) => `
            <div class="fc-col">
              <span class="fc-count">${f.count}</span>
              <span class="fc-bar"><span style="height:${(f.count / maxF) * 100}%"></span></span>
              <span class="fc-day${i === 0 ? " today" : ""}">${dayName(f.day, true)}</span>
            </div>`,
            )
            .join("")}
        </div>
      </section>

      <section>
        <div class="section-head"><h2>Hộp ghi nhớ</h2><span class="section-sub">Câu càng nhớ lâu thì nằm ở hộp càng cao</span></div>
        <div class="box-grid">
          ${boxes
            .map(
              (b) => `
            <div class="box-cell">
              <span class="box-name">Hộp ${b.box}</span>
              <span class="box-count">${b.count}</span>
              <span class="box-days">ôn sau ${daysLabel(b.days)}</span>
            </div>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function dayName(key, short = false) {
    if (key === todayKey()) return short ? "Nay" : "Hôm nay";
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (key === todayKey(tomorrow)) return short ? "Mai" : "ngày mai";
    return short ? WEEKDAYS[date.getDay()] : `${WEEKDAYS[date.getDay()]} ${d}/${m}`;
  }

  // ---------- Phiên ôn ----------
  function start() {
    const { due, fresh } = reviewQueue();
    const items = [...due.map((id) => ({ id, isNew: false })), ...fresh.map((id) => ({ id, isNew: true }))]
      .map((x) => ({ ...x, q: findItem(x.id)?.item }))
      .filter((x) => x.q);
    if (!items.length) return;
    session = { items, index: 0, revealed: false, tally: { again: 0, hard: 0, good: 0 } };
    phase = "session";
    renderSession();
  }

  function renderSession() {
    const s = session;
    const cur = s.items[s.index];
    const q = cur.q;
    const card = srs.card(q.id);
    const box = card ? card.box : 0;
    el.innerHTML = `
      <div class="flash review-session">
        <div class="flash-top">
          <span class="muted">Câu ${s.index + 1}/${s.items.length}</span>
          <div class="progress-track slim"><div class="progress-fill" style="width:${(s.index / s.items.length) * 100}%"></div></div>
          <button type="button" class="link-btn" data-action="stop">Dừng</button>
        </div>
        <div class="flash-card${s.revealed ? " flipped" : ""}" data-action="reveal" role="button" tabindex="0" aria-expanded="${s.revealed}">
          <div class="flash-meta"><span class="tag-row">${rankTag(q.rank)}${topicTag(q.topic)}${cur.isNew ? '<span class="new-badge">Mới</span>' : ""}</span></div>
          <div class="flash-q">${fmt(q.q)}</div>
          ${
            s.revealed
              ? `<div class="flash-a"><div class="answer-text">${fmt(q.a)}</div>${codeOf(q)}${docHtml(q)}${creditHtml(q)}</div>`
              : `<div class="flash-hint">Nhớ lại câu trả lời trong đầu, rồi bấm để xem đáp án</div>`
          }
        </div>
        ${
          s.revealed
            ? `<div class="grade-row" role="group" aria-label="Tự chấm">
                ${["again", "hard", "good"]
                  .map(
                    (g, i) => `
                  <button type="button" class="btn grade-btn grade-${g}" data-grade="${g}">
                    <strong>${GRADE_LABELS[g]}</strong><span>ôn lại sau ${daysLabel(srsSchedule(box, g).days)}</span><kbd>${i + 1}</kbd>
                  </button>`,
                  )
                  .join("")}
              </div>`
            : `<button type="button" class="btn btn-primary reveal-btn" data-action="reveal">Hiện đáp án</button>`
        }
        <p class="kbd-hint">Phím tắt: <kbd>Space</kbd> hiện đáp án · <kbd>1</kbd> quên · <kbd>2</kbd> khó · <kbd>3</kbd> nhớ</p>
      </div>`;
  }

  function grade(g) {
    const s = session;
    if (!s || !s.revealed) return;
    const cur = s.items[s.index];
    if (cur.isNew) srs.noteNew(cur.id); // ghi nhận trước để badge tính đúng số câu mới còn lại
    srs.grade(cur.id, g);
    s.tally[g]++;
    s.index++;
    s.revealed = false;
    if (s.index >= s.items.length) {
      phase = "done";
      renderDone();
    } else renderSession();
  }

  function renderDone() {
    const s = session;
    const tomorrow = srs.forecast(2, trackIds())[1].count;
    el.innerHTML = `
      <section class="card review-done">
        <h1>Xong buổi ôn hôm nay 🎉</h1>
        <p class="muted">Bạn đã ôn ${s.index} câu: ${s.tally.good} nhớ · ${s.tally.hard} khó · ${s.tally.again} quên.</p>
        <p>Ngày mai cần ôn: <strong>${tomorrow} câu</strong>${s.tally.again ? ` (gồm ${s.tally.again} câu bạn vừa quên)` : ""}.</p>
        <div class="btn-row center">
          <a class="btn btn-primary" href="#/interview">Phỏng vấn thử</a>
          <a class="btn btn-ghost" href="#/quiz">Làm quiz</a>
          <button type="button" class="btn btn-ghost" data-action="overview">Xem lịch ôn</button>
        </div>
      </section>`;
  }

  function render() {
    if (phase === "session") renderSession();
    else if (phase === "done") renderDone();
    else renderOverview();
  }

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-action]");
    if (!t || !el.contains(t)) return;
    if (t.dataset.grade) return grade(t.dataset.grade);
    if (t.dataset.new !== undefined) {
      prefs.set("newPerDay", Number(t.dataset.new));
      window.dispatchEvent(new Event("srs-change"));
      return renderOverview();
    }
    if (t.dataset.rank) {
      const ranks = reviewRanks();
      const next = ranks.includes(t.dataset.rank) ? ranks.filter((r) => r !== t.dataset.rank) : [...ranks, t.dataset.rank];
      if (!next.length) return; // luôn giữ ít nhất 1 rank
      prefs.set("reviewRanks", next);
      window.dispatchEvent(new Event("srs-change"));
      return renderOverview();
    }
    switch (t.dataset.action) {
      case "start":
        return start();
      case "reveal":
        if (session && !session.revealed) {
          session.revealed = true;
          renderSession();
        }
        return;
      case "stop":
      case "overview":
        phase = "overview";
        session = null;
        return renderOverview();
    }
  });

  function onKey(e) {
    if (phase !== "session" || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if ((k === " " || k === "Enter") && !session.revealed) {
      if (e.target.closest("button") && !e.target.closest(".flash-card")) return;
      e.preventDefault();
      session.revealed = true;
      renderSession();
    } else if (session.revealed && ["1", "2", "3"].includes(k)) {
      e.preventDefault();
      grade(["again", "hard", "good"][Number(k) - 1]);
    }
  }
  document.addEventListener("keydown", onKey);

  render();
  return { destroy: () => document.removeEventListener("keydown", onKey) };
}
