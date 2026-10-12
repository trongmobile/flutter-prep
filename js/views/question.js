import { findItem, getRank, getTrack } from "../../data/index.js";
import { study } from "../store.js";
import { escapeHtml, fmt, codeOf, topicTag, rankTag, shuffle, creditHtml, shareItem, link } from "../utils.js";

const LETTERS = ["A", "B", "C", "D"];

// Trang một câu hỏi (#/q/<id>): đích của link chia sẻ.
export function mount(el, params) {
  const found = findItem(params[0] || "");
  if (!found) {
    el.innerHTML = `
      <div class="empty">
        <p>Không tìm thấy câu hỏi này. Có thể câu hỏi đã được đổi mã hoặc gỡ bỏ.</p>
        <div class="btn-row center"><a class="btn btn-primary" href="#/study">Xem ngân hàng câu hỏi</a></div>
      </div>`;
    return;
  }
  const { item: q, kind } = found;
  const rank = getRank(q.rank);
  const track = getTrack(q.track);
  const state = { revealed: false, chosen: null, opts: null };
  if (kind === "quiz") {
    const order = shuffle([0, 1, 2, 3]);
    state.opts = order.map((i) => q.options[i]);
    state.correct = order.indexOf(q.answer);
  }
  const plain = q.q.replace(/`/g, "");
  requestAnimationFrame(() => (document.title = `${plain.length > 70 ? plain.slice(0, 70) + "…" : plain} — ${track.name} Interview`));

  function render() {
    const mark = study.get(q.id) || "";
    let body;
    if (kind === "quiz") {
      const answered = state.chosen !== null;
      body = `
        ${codeOf(q)}
        <div class="options" role="group" aria-label="Các đáp án">
          ${state.opts
            .map((text, i) => {
              let cls = "opt";
              if (answered && i === state.correct) cls += " correct";
              if (answered && i === state.chosen && i !== state.correct) cls += " wrong";
              return `<button type="button" class="${cls}" data-opt="${i}" ${answered ? "disabled" : ""}><span class="opt-key">${LETTERS[i]}</span><span class="opt-text">${fmt(text)}</span></button>`;
            })
            .join("")}
        </div>
        ${
          answered
            ? `<div class="explain ${state.chosen === state.correct ? "ok" : "bad"}" role="status">
                <strong>${state.chosen === state.correct ? "Chính xác!" : `Chưa đúng — đáp án là ${LETTERS[state.correct]}.`}</strong>
                <div>${fmt(q.explain)}</div>
              </div>${creditHtml(q)}`
            : `<p class="muted small">Chọn một đáp án để xem giải thích.</p>`
        }`;
    } else {
      body = state.revealed
        ? `<div class="model-answer">
            <div class="setup-label">Đáp án mẫu</div>
            <div class="answer-text">${fmt(q.a)}</div>
            ${codeOf(q)}
            ${creditHtml(q)}
          </div>
          <div class="mark-row">
            <button type="button" class="mark-btn mark-known${mark === "known" ? " active" : ""}" data-mark="known">✓ Đã thuộc</button>
            <button type="button" class="mark-btn mark-review${mark === "review" ? " active" : ""}" data-mark="review">↻ Cần ôn lại</button>
          </div>`
        : `<p class="muted">Tự trả lời thành tiếng trước, rồi mới xem đáp án mẫu nhé.</p>
          <button type="button" class="btn btn-primary" data-action="reveal">Xem đáp án mẫu</button>`;
    }

    el.innerHTML = `
      <a class="back-link" href="${link(`study/${q.rank}`)}">← Câu hỏi ${escapeHtml(track.name)} ${escapeHtml(rank.name)}</a>
      <article class="card question-page rank-${rank.color}">
        <div class="quiz-tags"><span class="tag">${escapeHtml(track.name)}</span>${rankTag(q.rank)}${topicTag(q.topic)}<span class="tag">${kind === "quiz" ? "Quiz trắc nghiệm" : "Câu hỏi phỏng vấn"}</span></div>
        <h1 class="question-title">${fmt(q.q)}</h1>
        ${body}
        <div class="btn-row question-actions">
          <button type="button" class="btn btn-ghost" data-action="share">↗ Chia sẻ</button>
          <a class="btn btn-ghost" href="#/community/new?type=content&ref=${encodeURIComponent(q.id)}">Góp ý câu này</a>
        </div>
      </article>
      <section class="card next-steps">
        <h2>Ôn tiếp</h2>
        <div class="btn-row">
          <a class="btn btn-rank rank-${rank.color}" href="${link(`study/${q.rank}`)}">Câu hỏi ${escapeHtml(track.name)} ${escapeHtml(rank.name)}</a>
          <a class="btn btn-ghost" href="${link(`quiz?rank=${q.rank}&start=1`)}">Quiz ${escapeHtml(rank.name)} 10 câu</a>
          <a class="btn btn-ghost" href="${link("interview")}">Phỏng vấn thử</a>
        </div>
      </section>`;
  }

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.opt !== undefined && state.chosen === null) {
      state.chosen = Number(t.dataset.opt);
      return render();
    }
    if (t.dataset.mark) {
      study.set(q.id, study.get(q.id) === t.dataset.mark ? null : t.dataset.mark);
      return render();
    }
    if (t.dataset.action === "reveal") {
      state.revealed = true;
      return render();
    }
    if (t.dataset.action === "share") shareItem(q);
  });

  render();
}
