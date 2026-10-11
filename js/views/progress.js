import { RANKS, TOPICS, DAYS, ALL_QUESTIONS, ALL_QUIZ, getRank, questionsFor } from "../../data/index.js";
import { study, quiz, roadmap, activity, srs, interview, SRS_INTERVALS, exportAll, importAll, resetAll, todayKey } from "../store.js";
import { escapeHtml, percent, stackedBar, formatDate, formatDuration, confirmClick } from "../utils.js";

const HEATMAP_WEEKS = 15;

export function mount(el) {
  function render() {
    const marks = study.all();
    const { history, stats } = quiz.data();
    const quizById = new Map(ALL_QUIZ.map((q) => [q.id, q]));
    const known = ALL_QUESTIONS.filter((q) => marks[q.id] === "known").length;

    let attempts = 0;
    let correct = 0;
    const byTopic = {};
    for (const [id, s] of Object.entries(stats)) {
      const q = quizById.get(id);
      if (!q) continue;
      attempts += s.c + s.w;
      correct += s.c;
      const t = (byTopic[q.topic] = byTopic[q.topic] || { c: 0, n: 0 });
      t.c += s.c;
      t.n += s.c + s.w;
    }
    const weakTopics = Object.entries(byTopic)
      .filter(([, v]) => v.n >= 3)
      .sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n)
      .slice(0, 6);

    const rankRows = RANKS.map((r) => {
      const qs = questionsFor(r.id);
      const k = qs.filter((q) => marks[q.id] === "known").length;
      const rv = qs.filter((q) => marks[q.id] === "review").length;
      const best = quiz.best(r.id);
      return `
        <div class="rank-row rank-${r.color}">
          <a class="rank-row-name" href="#/study/${r.id}">${escapeHtml(r.name)}</a>
          <div class="rank-row-bar">
            ${stackedBar(
              [
                { value: k, cls: "seg-known" },
                { value: rv, cls: "seg-review" },
              ],
              qs.length || 1,
              `${k} đã thuộc, ${rv} cần ôn lại`,
            )}
            <div class="bar-label"><span>${k} thuộc · ${rv} cần ôn · ${qs.length - k - rv} chưa ôn</span><span>${percent(k, qs.length)}%</span></div>
          </div>
          <div class="rank-row-best"><span class="muted">Quiz tốt nhất</span><strong>${best === null ? "—" : Math.round(best * 100) + "%"}</strong></div>
        </div>`;
    }).join("");

    const recent = history.slice(-15).reverse();
    const doneDays = roadmap.completed(DAYS.length).size;

    el.innerHTML = `
      <header class="view-head">
        <div class="eyebrow">tiến độ</div>
        <h1>Tiến độ của bạn</h1>
        <p class="subtitle">Dữ liệu chỉ lưu trên trình duyệt này. Dùng "Sao lưu" để chuyển sang máy khác.</p>
      </header>

      <div class="tile-grid">
        <div class="tile"><span class="tile-value">${activity.streak()}</span><span class="tile-label">ngày học liên tiếp</span></div>
        <div class="tile"><span class="tile-value">${known}<small>/${ALL_QUESTIONS.length}</small></span><span class="tile-label">câu hỏi đã thuộc</span></div>
        <div class="tile"><span class="tile-value">${history.length}</span><span class="tile-label">lượt quiz</span></div>
        <div class="tile"><span class="tile-value">${attempts ? percent(correct, attempts) + "%" : "—"}</span><span class="tile-label">độ chính xác quiz</span></div>
        <div class="tile"><span class="tile-value">${doneDays}<small>/${DAYS.length}</small></span><span class="tile-label">ngày lộ trình</span></div>
      </div>

      <section>
        <div class="section-head"><h2>Hoạt động ${HEATMAP_WEEKS} tuần gần đây</h2></div>
        <div class="card">${heatmap()}</div>
      </section>

      <section>
        <div class="section-head"><h2>Theo rank</h2></div>
        <div class="card rank-rows">${rankRows}</div>
      </section>

      <section>
        <div class="section-head"><h2>Lịch ôn tập</h2><a class="link-btn" href="#/review">Ôn hôm nay →</a></div>
        ${srsHtml()}
      </section>

      <section>
        <div class="section-head"><h2>Phỏng vấn thử</h2><a class="link-btn" href="#/interview">Phỏng vấn ngay →</a></div>
        ${interviewHtml()}
      </section>

      <section>
        <div class="section-head">
          <h2>Chủ đề cần cải thiện</h2>
          <span class="section-sub">Dựa trên toàn bộ câu quiz đã làm (chủ đề có ≥ 3 lượt trả lời)</span>
        </div>
        ${
          weakTopics.length
            ? `<div class="card topic-breakdown">${weakTopics
                .map(([t, v]) => {
                  const p = percent(v.c, v.n);
                  return `
                  <div class="topic-row">
                    <span class="topic-name">${escapeHtml(TOPICS[t])}</span>
                    <div class="progress-track slim"><div class="progress-fill ${p < 50 ? "low" : ""}" style="width:${p}%"></div></div>
                    <span class="topic-score">${p}%</span>
                    <a class="link-btn" href="#/quiz?topic=${t}">Luyện</a>
                  </div>`;
                })
                .join("")}</div>`
            : `<div class="empty"><p>Làm vài bài quiz để xem chủ đề nào bạn còn yếu.</p><a class="btn btn-primary" href="#/quiz">Làm quiz</a></div>`
        }
      </section>

      <section>
        <div class="section-head"><h2>Lịch sử quiz</h2></div>
        ${
          recent.length
            ? `<div class="table-wrap"><table class="history">
                <thead><tr><th>Thời gian</th><th>Rank</th><th>Chế độ</th><th>Điểm</th><th>Thời lượng</th></tr></thead>
                <tbody>${recent
                  .map((h) => {
                    const p = percent(h.correct, h.total);
                    const rank = h.rank === "all" ? "Tổng hợp" : h.rank === "mixed" ? "Câu sai" : getRank(h.rank)?.name || h.rank;
                    return `<tr>
                      <td>${formatDate(h.ts)}</td>
                      <td>${escapeHtml(rank)}</td>
                      <td>${h.kind === "retry" ? "Làm lại" : h.mode === "exam" ? "Thi thử" : "Luyện tập"}</td>
                      <td><span class="score-pill ${p >= 70 ? "good" : p >= 50 ? "mid" : "low"}">${h.correct}/${h.total} · ${p}%</span></td>
                      <td>${formatDuration(h.duration)}</td>
                    </tr>`;
                  })
                  .join("")}</tbody>
              </table></div>`
            : `<div class="empty"><p>Chưa có lượt quiz nào.</p></div>`
        }
      </section>

      <section>
        <div class="section-head"><h2>Dữ liệu</h2></div>
        <div class="card data-actions">
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-action="export">Sao lưu (tải file JSON)</button>
            <label class="btn btn-ghost file-btn">Khôi phục từ file<input type="file" accept="application/json,.json" data-action="import" /></label>
          </div>
          <p class="muted small" data-slot="data-msg" role="status"></p>
          <div class="btn-row danger-row">
            <button type="button" class="btn btn-danger" data-action="reset-study">Xoá đánh dấu ôn luyện</button>
            <button type="button" class="btn btn-danger" data-action="reset-quiz">Xoá lịch sử quiz</button>
            <button type="button" class="btn btn-danger" data-action="reset-interview">Xoá lịch sử phỏng vấn thử</button>
            <button type="button" class="btn btn-danger" data-action="reset-all">Xoá toàn bộ tiến độ</button>
          </div>
        </div>
      </section>
    `;
  }

  function srsHtml() {
    const cards = Object.values(srs.cards());
    if (!cards.length) {
      return `<div class="empty"><p>Chưa có câu nào trong lịch ôn. Đánh dấu câu hỏi hoặc bắt đầu <a href="#/review">Ôn hôm nay</a>.</p></div>`;
    }
    const due = srs.dueIds(todayKey()).length;
    const week = srs.forecast(7).reduce((sum, f) => sum + f.count, 0);
    const longTerm = cards.filter((c) => c.box >= 4).length;
    return `
      <div class="card srs-summary">
        <div class="srs-stats">
          <span><strong>${cards.length}</strong> câu trong lịch ôn</span>
          <span><strong>${due}</strong> đến hạn hôm nay</span>
          <span><strong>${week}</strong> trong 7 ngày tới</span>
          <span><strong>${longTerm}</strong> đã nhớ dài hạn (hộp 4+)</span>
        </div>
        <div class="box-grid compact">
          ${SRS_INTERVALS.map((d, i) => {
            const n = cards.filter((c) => c.box === i + 1).length;
            return `<div class="box-cell"><span class="box-name">Hộp ${i + 1}</span><span class="box-count">${n}</span><span class="box-days">${d} ngày</span></div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function interviewHtml() {
    const list = interview.history().slice(-10).reverse();
    if (!list.length) return `<div class="empty"><p>Chưa có buổi phỏng vấn thử nào.</p><a class="btn btn-primary" href="#/interview">Phỏng vấn thử</a></div>`;
    return `<div class="table-wrap"><table class="history">
      <thead><tr><th>Thời gian</th><th>Rank</th><th>Số câu</th><th>Điểm tự chấm</th><th>Thời lượng</th></tr></thead>
      <tbody>${list
        .map((h) => {
          const p = percent(h.score, h.max);
          return `<tr><td>${formatDate(h.ts)}</td><td>${escapeHtml(getRank(h.rank)?.name || h.rank)}</td><td>${h.total}</td>
            <td><span class="score-pill ${p >= 70 ? "good" : p >= 50 ? "mid" : "low"}">${h.score}/${h.max} · ${p}%</span></td><td>${formatDuration(h.duration)}</td></tr>`;
        })
        .join("")}</tbody>
    </table></div>`;
  }

  function heatmap() {
    const days = new Set(activity.days());
    const end = new Date();
    // Cột cuối là tuần hiện tại; hàng = thứ (T2 → CN).
    const dow = (end.getDay() + 6) % 7;
    const start = new Date(end);
    start.setDate(end.getDate() - dow - (HEATMAP_WEEKS - 1) * 7);
    const today = todayKey(end);
    const cells = [];
    const d = new Date(start);
    for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
      const key = todayKey(d);
      const future = d > end && key !== today;
      cells.push(
        `<span class="hm-cell${days.has(key) ? " on" : ""}${key === today ? " today" : ""}${future ? " future" : ""}" title="${key}${days.has(key) ? " · có học" : ""}"></span>`,
      );
      d.setDate(d.getDate() + 1);
    }
    return `<div class="heatmap" style="--weeks:${HEATMAP_WEEKS}" role="img" aria-label="${days.size} ngày có hoạt động">${cells.join("")}</div>
      <div class="hm-legend"><span class="hm-cell"></span> không học <span class="hm-cell on"></span> có học</div>`;
  }

  function message(text) {
    const m = el.querySelector("[data-slot=data-msg]");
    if (m) m.textContent = text;
  }

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    switch (t.dataset.action) {
      case "export": {
        const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `interview-backup-${todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        message("Đã tải file sao lưu.");
        break;
      }
      case "reset-study":
        confirmClick(t, "Xoá đánh dấu ôn luyện", () => {
          study.reset();
          srs.reset();
          render();
        });
        break;
      case "reset-interview":
        confirmClick(t, "Xoá lịch sử phỏng vấn thử", () => {
          interview.reset();
          render();
        });
        break;
      case "reset-quiz":
        confirmClick(t, "Xoá lịch sử quiz", () => {
          quiz.reset();
          render();
        });
        break;
      case "reset-all":
        confirmClick(t, "Xoá toàn bộ tiến độ", () => {
          resetAll();
          render();
        });
        break;
    }
  });

  el.addEventListener("change", async (e) => {
    const input = e.target.closest("input[type=file]");
    if (!input || !input.files[0]) return;
    try {
      importAll(JSON.parse(await input.files[0].text()));
      render();
      message("Đã khôi phục tiến độ từ file.");
    } catch (err) {
      message("Không đọc được file: " + err.message);
    }
  });

  render();
}
