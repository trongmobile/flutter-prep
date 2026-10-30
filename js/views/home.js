import { RANKS, TRACKS, allQuestions, allQuiz, questionsFor, quizFor, roadmap as roadmapData, currentTrack, rankDesc } from "../../data/index.js";
import { study, quiz, roadmap, activity, prefs } from "../store.js";
import { escapeHtml, percent, stackedBar } from "../utils.js";
import { reviewQueue } from "./review.js";
import { isStandalone, isIos, canPromptInstall, promptInstall } from "../pwa.js";

export function mount(el) {
  const track = currentTrack();
  const { due, fresh } = reviewQueue();
  const todayTotal = due.length + fresh.length;
  const marks = study.all();
  const quizIds = new Set(allQuiz().map((q) => q.id));
  const wrongCount = quiz.wrongIds().filter((id) => quizIds.has(id)).length;
  const knownTotal = allQuestions().filter((q) => marks[q.id] === "known").length;
  const quizCount = quiz.data(track.id).history.length;
  const streak = activity.streak();
  const plan = roadmapData();
  const doneDays = plan ? roadmap.completed(plan.DAYS.length) : new Set();
  const nextDay = plan && plan.DAYS.find((d) => !doneDays.has(d.day));

  const rankCards = RANKS.map((r) => {
    const qs = questionsFor(r.id);
    const known = qs.filter((q) => marks[q.id] === "known").length;
    const review = qs.filter((q) => marks[q.id] === "review").length;
    const best = quiz.best(r.id, track.id);
    return `
      <article class="rank-card rank-${r.color}">
        <div class="rank-card-head">
          <span class="rank-name">${escapeHtml(r.name)}</span>
          <span class="rank-years">${escapeHtml(r.years)}</span>
        </div>
        <p class="rank-desc">${escapeHtml(rankDesc(r.id))}</p>
        <div class="rank-stats">
          <span><strong>${qs.length}</strong> câu phỏng vấn</span>
          <span><strong>${quizFor(r.id).length}</strong> câu quiz</span>
          <span>Quiz tốt nhất: <strong>${best === null ? "—" : Math.round(best * 100) + "%"}</strong></span>
        </div>
        ${stackedBar(
          [
            { value: known, cls: "seg-known" },
            { value: review, cls: "seg-review" },
          ],
          qs.length || 1,
          `${known} đã thuộc, ${review} cần ôn lại trên ${qs.length} câu`,
        )}
        <div class="bar-label"><span>${known}/${qs.length} đã thuộc</span><span>${percent(known, qs.length)}%</span></div>
        <div class="btn-row">
          <a class="btn btn-rank" href="#/study/${r.id}">Ôn luyện</a>
          <a class="btn btn-ghost" href="#/quiz?rank=${r.id}&start=1">Làm quiz 10 câu</a>
        </div>
      </article>`;
  }).join("");

  el.innerHTML = `
    <header class="hero">
      <nav class="track-tabs" aria-label="Chọn nền tảng">
        ${TRACKS.map(
          (t) =>
            `<a href="#/${t.id}" class="track-tab${t.id === track.id ? " active" : ""}"${t.id === track.id ? ' aria-current="page"' : ""}>
              <strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.tagline)}</span>
            </a>`,
        ).join("")}
      </nav>
      <div class="eyebrow">~/interview/${track.id}</div>
      <h1>Ôn phỏng vấn ${escapeHtml(track.name)} theo rank</h1>
      <p class="subtitle">
        ${allQuestions().length} câu hỏi phỏng vấn có đáp án mẫu · ${allQuiz().length} câu quiz trắc nghiệm ·
        từ Fresher đến Senior. Tiến độ được lưu ngay trên trình duyệt của bạn.
      </p>
      <div class="stat-row">
        <div class="stat"><span class="stat-value">${streak}</span><span class="stat-label">ngày học liên tiếp</span></div>
        <div class="stat"><span class="stat-value">${knownTotal}</span><span class="stat-label">câu đã thuộc</span></div>
        <div class="stat"><span class="stat-value">${quizCount}</span><span class="stat-label">lượt quiz</span></div>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="#/quiz?rank=all&start=1">Quiz nhanh 10 câu (tổng hợp)</a>
        ${
          wrongCount
            ? `<a class="btn btn-ghost" href="#/quiz?wrong=1&start=1">Làm lại ${wrongCount} câu sai</a>`
            : ""
        }
        <a class="btn btn-ghost" href="${escapeHtml(track.docs)}" target="_blank" rel="noopener">Document ${escapeHtml(track.name)} ↗</a>
      </div>
    </header>

    <section class="today-grid">
      <a class="card today-card${todayTotal ? " has-due" : ""}" href="#/review">
        <span class="eyebrow">mỗi ngày · ~${Math.max(1, Math.round(todayTotal * 0.5))} phút</span>
        <span class="today-title">Ôn hôm nay</span>
        <span class="today-count">${
          todayTotal ? `<strong>${todayTotal}</strong> câu cần ôn · ${due.length} đến hạn, ${fresh.length} mới` : "Bạn đã ôn xong hôm nay 🎉"
        }</span>
        <span class="today-cta">${todayTotal ? "Bắt đầu ôn →" : "Xem lịch ôn →"}</span>
      </a>
      <a class="card today-card" href="#/interview">
        <span class="eyebrow">luyện nói · ghi âm</span>
        <span class="today-title">Phỏng vấn thử</span>
        <span class="today-count">Câu hỏi ngẫu nhiên theo rank, đếm giờ, ghi âm câu trả lời rồi tự chấm.</span>
        <span class="today-cta">Bắt đầu phỏng vấn →</span>
      </a>
    </section>

    <div data-slot="install"></div>

    <section>
      <div class="section-head">
        <h2>Chọn rank để ôn</h2>
        <span class="section-sub">Mỗi rank có câu hỏi phỏng vấn + bộ quiz riêng</span>
      </div>
      <div class="rank-grid">${rankCards}</div>
    </section>

    ${
      plan
        ? `<section class="card roadmap-teaser">
      <div>
        <div class="eyebrow">roadmap · ~5 phút/ngày</div>
        <h2>Lộ trình 35 ngày lên Senior</h2>
        <p class="muted">
          ${
            nextDay
              ? `Tiếp theo: Ngày ${nextDay.day} — ${escapeHtml(nextDay.title)}`
              : "Bạn đã hoàn thành toàn bộ 35 ngày. Sẵn sàng phỏng vấn!"
          }
        </p>
        <div class="progress-track"><div class="progress-fill" style="width:${percent(doneDays.size, plan.DAYS.length)}%"></div></div>
        <div class="bar-label"><span>${doneDays.size}/${plan.DAYS.length} ngày</span><span>${percent(doneDays.size, plan.DAYS.length)}%</span></div>
      </div>
      <a class="btn btn-primary" href="#/roadmap">${doneDays.size ? "Tiếp tục lộ trình" : "Bắt đầu lộ trình"}</a>
    </section>`
        : ""
    }

    <section class="card roadmap-teaser community-teaser">
      <div>
        <div class="eyebrow">cộng đồng · đóng góp</div>
        <h2>Cùng xây ngân hàng câu hỏi</h2>
        <p class="muted">Đóng góp câu hỏi phỏng vấn bạn từng gặp, đề xuất tính năng, báo đáp án sai — và theo dõi trạng thái xử lý trên Roadmap.</p>
      </div>
      <div class="btn-row">
        <a class="btn btn-ghost" href="#/community">Xem cộng đồng</a>
        <a class="btn btn-primary" href="#/community/new">+ Tạo đóng góp</a>
      </div>
    </section>

    <section class="how">
      <div class="section-head"><h2>Cách dùng hiệu quả</h2></div>
      <ol class="how-list">
        <li><strong>Ôn luyện:</strong> đọc câu hỏi, tự trả lời thành tiếng rồi mới mở đáp án. Đánh dấu <em>Đã thuộc</em> hoặc <em>Cần ôn lại</em>.</li>
        <li><strong>Ôn hôm nay:</strong> mỗi ngày vài phút; câu sắp quên được nhắc lại đúng lúc (1 → 3 → 7 → 14 → 30 → 60 ngày).</li>
        <li><strong>Phỏng vấn thử:</strong> trả lời thành tiếng trong thời gian giới hạn, nghe lại bản ghi và tự chấm.</li>
        <li><strong>Quiz:</strong> chế độ <em>Luyện tập</em> hiện giải thích ngay; chế độ <em>Thi thử</em> có đếm giờ và chấm điểm cuối bài.</li>
        <li><strong>Tiến độ:</strong> xem chủ đề nào bạn hay sai để tập trung ôn, sao lưu tiến độ sang máy khác.</li>
      </ol>
    </section>
  `;

  // ---- Thẻ "Cài app" (PWA) ----
  function renderInstall() {
    const slot = el.querySelector('[data-slot="install"]');
    if (!slot) return;
    if (isStandalone() || prefs.get("installDismissed", false)) {
      slot.innerHTML = "";
      return;
    }
    const canPrompt = canPromptInstall();
    const ios = isIos();
    if (!canPrompt && !ios) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML = `
      <section class="card install-card">
        <div>
          <strong>📲 Cài Mobile Interview lên điện thoại</strong>
          <p class="muted small">${
            canPrompt
              ? "Mở nhanh từ màn hình chính và ôn được cả khi không có mạng."
              : "Trên iPhone/iPad: bấm nút <strong>Chia sẻ</strong> của Safari → <strong>Thêm vào MH chính</strong>. Học được cả khi không có mạng."
          }</p>
        </div>
        <div class="btn-row">
          ${canPrompt ? '<button type="button" class="btn btn-primary" data-action="install">Cài app</button>' : ""}
          <button type="button" class="link-btn subtle" data-action="dismiss-install">Để sau</button>
        </div>
      </section>`;
  }
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.action === "install") {
      await promptInstall();
      renderInstall();
    } else if (t.dataset.action === "dismiss-install") {
      prefs.set("installDismissed", true);
      renderInstall();
    }
  });
  window.addEventListener("pwa-installable", renderInstall);
  renderInstall();
  return { destroy: () => window.removeEventListener("pwa-installable", renderInstall) };
}
