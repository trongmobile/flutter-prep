import { RANKS, DAYS, ALL_QUESTIONS, ALL_QUIZ, questionsFor, quizFor } from "../../data/index.js";
import { study, quiz, roadmap, activity } from "../store.js";
import { escapeHtml, percent, stackedBar } from "../utils.js";

export function mount(el) {
  const marks = study.all();
  const quizIds = new Set(ALL_QUIZ.map((q) => q.id));
  const wrongCount = quiz.wrongIds().filter((id) => quizIds.has(id)).length;
  const knownTotal = ALL_QUESTIONS.filter((q) => marks[q.id] === "known").length;
  const quizCount = quiz.data().history.length;
  const streak = activity.streak();
  const doneDays = roadmap.completed(DAYS.length);
  const nextDay = DAYS.find((d) => !doneDays.has(d.day));

  const rankCards = RANKS.map((r) => {
    const qs = questionsFor(r.id);
    const known = qs.filter((q) => marks[q.id] === "known").length;
    const review = qs.filter((q) => marks[q.id] === "review").length;
    const best = quiz.best(r.id);
    return `
      <article class="rank-card rank-${r.color}">
        <div class="rank-card-head">
          <span class="rank-name">${escapeHtml(r.name)}</span>
          <span class="rank-years">${escapeHtml(r.years)}</span>
        </div>
        <p class="rank-desc">${escapeHtml(r.desc)}</p>
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
      <div class="eyebrow">~/interview</div>
      <h1>Ôn phỏng vấn Flutter theo rank</h1>
      <p class="subtitle">
        ${ALL_QUESTIONS.length} câu hỏi phỏng vấn có đáp án mẫu · ${ALL_QUIZ.length} câu quiz trắc nghiệm ·
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
      </div>
    </header>

    <section>
      <div class="section-head">
        <h2>Chọn rank để ôn</h2>
        <span class="section-sub">Mỗi rank có câu hỏi phỏng vấn + bộ quiz riêng</span>
      </div>
      <div class="rank-grid">${rankCards}</div>
    </section>

    <section class="card roadmap-teaser">
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
        <div class="progress-track"><div class="progress-fill" style="width:${percent(doneDays.size, DAYS.length)}%"></div></div>
        <div class="bar-label"><span>${doneDays.size}/${DAYS.length} ngày</span><span>${percent(doneDays.size, DAYS.length)}%</span></div>
      </div>
      <a class="btn btn-primary" href="#/roadmap">${doneDays.size ? "Tiếp tục lộ trình" : "Bắt đầu lộ trình"}</a>
    </section>

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
        <li><strong>Flashcard:</strong> chuyển sang chế độ thẻ để ôn nhanh những câu còn "Cần ôn lại".</li>
        <li><strong>Quiz:</strong> chế độ <em>Luyện tập</em> hiện giải thích ngay; chế độ <em>Thi thử</em> có đếm giờ và chấm điểm cuối bài.</li>
        <li><strong>Tiến độ:</strong> xem chủ đề nào bạn hay sai để tập trung ôn, sao lưu tiến độ sang máy khác.</li>
      </ol>
    </section>
  `;
}
