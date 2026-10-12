import { RANKS, getRank, quizFor, allQuiz, topics, currentTrack } from "../../data/index.js";
import { quiz as quizStore, prefs } from "../store.js";
import { escapeHtml, fmt, codeOf, topicTag, rankTag, shuffle, percent, formatDuration, creditHtml, shareItem } from "../utils.js";

const COUNTS = [10, 20, 30, 0]; // 0 = tất cả
const SECONDS_PER_QUESTION = 45;
const LETTERS = ["A", "B", "C", "D"];

export function mount(el, _params, query) {
  const validRank = (r) => r === "all" || !!getRank(r);
  const setup = {
    rank: validRank(query.rank) ? query.rank : validRank(prefs.get("quizRank")) ? prefs.get("quizRank") : "all",
    topics: new Set(query.topic && topics()[query.topic] ? [query.topic] : []),
    count: Number(prefs.get("quizCount", 10)),
    mode: prefs.get("quizMode") === "exam" ? "exam" : "practice",
  };
  if (!COUNTS.includes(setup.count)) setup.count = 10;

  let session = null; // phiên làm bài hiện tại
  let result = null; // kết quả sau khi nộp
  let reviewFilter = "all";
  let timer = null;

  // ---------- Màn hình thiết lập ----------
  function pool() {
    const base = quizFor(setup.rank);
    return setup.topics.size ? base.filter((q) => setup.topics.has(q.topic)) : base;
  }
  function wrongPool() {
    const ids = new Set(quizStore.wrongIds());
    return allQuiz().filter((q) => ids.has(q.id));
  }

  function renderSetup() {
    const base = quizFor(setup.rank);
    const topicsAvailable = Object.keys(topics()).filter((t) => base.some((q) => q.topic === t));
    for (const t of [...setup.topics]) if (!topicsAvailable.includes(t)) setup.topics.delete(t);
    const available = pool().length;
    const wrong = wrongPool().length;
    const take = setup.count ? Math.min(setup.count, available) : available;

    el.innerHTML = `
      <header class="view-head">
        <div class="eyebrow">quiz · trắc nghiệm</div>
        <h1>Làm quiz ${escapeHtml(currentTrack().name)}</h1>
        <p class="subtitle">Chọn rank, chủ đề và số câu. Thứ tự câu hỏi và đáp án được xáo trộn mỗi lần làm.</p>
      </header>

      <div class="card setup">
        <div class="setup-row">
          <div class="setup-label">Rank</div>
          <div class="chips">
            <button type="button" class="chip${setup.rank === "all" ? " active" : ""}" data-rank="all" aria-pressed="${setup.rank === "all"}">Tổng hợp <span class="count">${allQuiz().length}</span></button>
            ${RANKS.map(
              (r) =>
                `<button type="button" class="chip rank-${r.color}${setup.rank === r.id ? " active" : ""}" data-rank="${r.id}" aria-pressed="${setup.rank === r.id}">${escapeHtml(r.name)} <span class="count">${quizFor(r.id).length}</span></button>`,
            ).join("")}
          </div>
        </div>

        <div class="setup-row">
          <div class="setup-label">Chủ đề <span class="muted">(bỏ trống = tất cả)</span></div>
          <div class="chips">
            ${topicsAvailable
              .map((t) => {
                const n = base.filter((q) => q.topic === t).length;
                const on = setup.topics.has(t);
                return `<button type="button" class="chip${on ? " active" : ""}" data-topic="${t}" aria-pressed="${on}">${escapeHtml(topics()[t])} <span class="count">${n}</span></button>`;
              })
              .join("")}
          </div>
        </div>

        <div class="setup-row">
          <div class="setup-label">Số câu</div>
          <div class="seg" role="group" aria-label="Số câu">
            ${COUNTS.map(
              (n) =>
                `<button type="button" data-count="${n}" class="${setup.count === n ? "active" : ""}" aria-pressed="${setup.count === n}">${n || "Tất cả"}</button>`,
            ).join("")}
          </div>
        </div>

        <div class="setup-row">
          <div class="setup-label">Chế độ</div>
          <div class="mode-grid">
            <button type="button" class="mode-card${setup.mode === "practice" ? " active" : ""}" data-mode="practice" aria-pressed="${setup.mode === "practice"}">
              <strong>Luyện tập</strong><span>Hiện đúng/sai và giải thích ngay sau mỗi câu.</span>
            </button>
            <button type="button" class="mode-card${setup.mode === "exam" ? " active" : ""}" data-mode="exam" aria-pressed="${setup.mode === "exam"}">
              <strong>Thi thử</strong><span>Đếm ngược ${SECONDS_PER_QUESTION}s/câu, chỉ chấm điểm khi nộp bài.</span>
            </button>
          </div>
        </div>

        <div class="setup-foot">
          <span class="muted">${available ? `Sẽ làm <strong>${take}</strong> / ${available} câu phù hợp` : "Không có câu nào phù hợp bộ lọc"}${
            setup.mode === "exam" && take ? ` · thời gian ${formatDuration(take * SECONDS_PER_QUESTION)}` : ""
          }</span>
          <button type="button" class="btn btn-primary" data-action="start" ${available ? "" : "disabled"}>Bắt đầu →</button>
        </div>
      </div>

      ${
        wrong
          ? `<div class="card wrong-card">
              <div><strong>${wrong} câu bạn trả lời sai ở lần gần nhất</strong>
              <p class="muted">Làm lại để xoá khỏi danh sách cần ôn.</p></div>
              <button type="button" class="btn btn-ghost" data-action="start-wrong">Làm lại câu sai</button>
            </div>`
          : ""
      }
    `;
  }

  // ---------- Làm bài ----------
  function prepare(q) {
    // Xáo trộn đáp án nhưng nhớ đáp án đúng.
    const order = shuffle([0, 1, 2, 3]);
    return { ...q, opts: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.answer) };
  }

  function start(questions, kind) {
    if (!questions.length) return;
    session = {
      kind, // "normal" | "retry"
      rank: kind === "retry" ? "mixed" : setup.rank,
      mode: kind === "retry" ? "practice" : setup.mode,
      questions: questions.map(prepare),
      answers: new Array(questions.length).fill(null),
      locked: new Array(questions.length).fill(false),
      index: 0,
      startedAt: Date.now(),
      deadline: null,
    };
    if (session.mode === "exam") {
      session.deadline = Date.now() + questions.length * SECONDS_PER_QUESTION * 1000;
      timer = setInterval(tick, 500);
    }
    result = null;
    renderPlay();
  }

  function startFromSetup() {
    const list = shuffle(pool());
    start(setup.count ? list.slice(0, setup.count) : list, "normal");
  }

  function tick() {
    if (!session || !session.deadline) return;
    const left = (session.deadline - Date.now()) / 1000;
    const t = el.querySelector("[data-slot=timer]");
    if (t) {
      t.textContent = formatDuration(left);
      t.classList.toggle("urgent", left <= 30);
    }
    if (left <= 0) finish();
  }

  function renderPlay() {
    const s = session;
    const q = s.questions[s.index];
    const chosen = s.answers[s.index];
    const revealed = s.mode === "practice" && s.locked[s.index];
    const isLast = s.index === s.questions.length - 1;
    const correctSoFar = s.questions.filter((x, i) => s.locked[i] && s.answers[i] === x.correctIndex).length;

    const options = q.opts
      .map((text, i) => {
        let cls = "opt";
        if (chosen === i) cls += " selected";
        if (revealed && i === q.correctIndex) cls += " correct";
        if (revealed && chosen === i && i !== q.correctIndex) cls += " wrong";
        return `<button type="button" class="${cls}" data-opt="${i}" ${revealed ? "disabled" : ""}>
          <span class="opt-key">${LETTERS[i]}</span><span class="opt-text">${fmt(text)}</span>
        </button>`;
      })
      .join("");

    const ok = chosen === q.correctIndex;
    el.innerHTML = `
      <div class="quiz-top">
        <button type="button" class="link-btn" data-action="quit">✕ Thoát</button>
        <div class="quiz-progress">
          <div class="progress-track slim"><div class="progress-fill" style="width:${((s.index + 1) / s.questions.length) * 100}%"></div></div>
          <span class="muted">Câu ${s.index + 1}/${s.questions.length}</span>
        </div>
        ${
          s.mode === "exam"
            ? `<span class="quiz-timer" data-slot="timer">${formatDuration((s.deadline - Date.now()) / 1000)}</span>`
            : `<span class="quiz-score">✓ ${correctSoFar}</span>`
        }
      </div>

      <article class="quiz-card">
        <div class="quiz-tags">${rankTag(q.rank)}${topicTag(q.topic)}</div>
        <h2 class="quiz-q">${fmt(q.q)}</h2>
        ${codeOf(q)}
        <div class="options" role="group" aria-label="Các đáp án">${options}</div>
        ${
          revealed
            ? `<div class="explain ${ok ? "ok" : "bad"}" role="status">
                <strong>${ok ? "Chính xác!" : `Chưa đúng — đáp án là ${LETTERS[q.correctIndex]}.`}</strong>
                <div>${fmt(q.explain)}</div>
              </div>`
            : ""
        }
        <div class="quiz-actions">
          ${
            s.mode === "practice" && !revealed
              ? `<button type="button" class="btn btn-primary" data-action="check" ${chosen === null ? "disabled" : ""}>Kiểm tra</button>`
              : `<button type="button" class="btn btn-primary" data-action="next" ${chosen === null ? "disabled" : ""}>${isLast ? "Nộp bài & xem kết quả" : "Câu tiếp theo →"}</button>`
          }
        </div>
      </article>
      <p class="kbd-hint">Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> hoặc <kbd>A</kbd>–<kbd>D</kbd> để chọn · <kbd>Enter</kbd> để ${s.mode === "practice" ? "kiểm tra / tiếp tục" : "sang câu tiếp"}</p>
    `;
  }

  function choose(i) {
    const s = session;
    if (!s || (s.mode === "practice" && s.locked[s.index])) return;
    s.answers[s.index] = i;
    renderPlay();
  }

  function check() {
    const s = session;
    if (s.answers[s.index] === null) return;
    s.locked[s.index] = true;
    renderPlay();
  }

  function next() {
    const s = session;
    if (s.answers[s.index] === null) return;
    s.locked[s.index] = true;
    if (s.index < s.questions.length - 1) {
      s.index++;
      renderPlay();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      finish();
    }
  }

  function finish() {
    clearInterval(timer);
    timer = null;
    const s = session;
    const items = s.questions.map((q, i) => ({ q, chosen: s.answers[i], correct: s.answers[i] === q.correctIndex }));
    const correct = items.filter((x) => x.correct).length;
    const duration = Math.round((Date.now() - s.startedAt) / 1000);
    result = { ...s, items, correct, duration };
    quizStore.record(
      { ts: Date.now(), track: currentTrack().id, rank: s.rank, mode: s.mode, kind: s.kind, total: items.length, correct, duration },
      items.map((x) => ({ id: x.q.id, correct: x.correct })),
    );
    session = null;
    reviewFilter = "all";
    renderResult();
    window.scrollTo(0, 0);
  }

  // ---------- Kết quả ----------
  function verdict(p) {
    if (p >= 90) return "Xuất sắc — kiến thức rất chắc, sẵn sàng phỏng vấn!";
    if (p >= 70) return "Tốt — ôn thêm vài chủ đề còn sai là ổn.";
    if (p >= 50) return "Tạm ổn — nên đọc lại lý thuyết các câu sai.";
    return "Cần ôn thêm — xem lại phần Ôn luyện trước khi làm tiếp.";
  }

  function renderResult() {
    const r = result;
    const p = percent(r.correct, r.items.length);
    const wrongItems = r.items.filter((x) => !x.correct);
    const byTopic = {};
    for (const x of r.items) {
      const t = (byTopic[x.q.topic] = byTopic[x.q.topic] || { c: 0, n: 0 });
      t.n++;
      if (x.correct) t.c++;
    }
    const rankLabel = r.rank === "all" ? "Tổng hợp" : r.rank === "mixed" ? "Làm lại câu sai" : getRank(r.rank).name;
    const studyRank = r.rank === "all" || r.rank === "mixed" ? prefs.get("lastRank", "fresher") : r.rank;
    const shown = reviewFilter === "wrong" ? wrongItems : r.items;

    el.innerHTML = `
      <section class="card result-hero">
        <div class="score-ring" style="--p:${p}">
          <span class="score-num">${r.correct}/${r.items.length}</span>
          <span class="score-pct">${p}%</span>
        </div>
        <div class="result-info">
          <div class="eyebrow">kết quả · ${escapeHtml(rankLabel)} · ${r.mode === "exam" ? "thi thử" : "luyện tập"} · ${formatDuration(r.duration)}</div>
          <h1>${verdict(p)}</h1>
          <div class="btn-row">
            ${wrongItems.length ? `<button type="button" class="btn btn-primary" data-action="retry">Làm lại ${wrongItems.length} câu sai</button>` : ""}
            <button type="button" class="btn ${wrongItems.length ? "btn-ghost" : "btn-primary"}" data-action="again">Quiz mới</button>
            <a class="btn btn-ghost" href="#/study/${studyRank}">Ôn lý thuyết</a>
          </div>
        </div>
      </section>

      <section>
        <div class="section-head"><h2>Theo chủ đề</h2></div>
        <div class="card topic-breakdown">
          ${Object.entries(byTopic)
            .sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n)
            .map(
              ([t, v]) => `
              <div class="topic-row">
                <span class="topic-name">${escapeHtml(topics()[t])}</span>
                <div class="progress-track slim"><div class="progress-fill ${v.c / v.n < 0.5 ? "low" : ""}" style="width:${percent(v.c, v.n)}%"></div></div>
                <span class="topic-score">${v.c}/${v.n}</span>
              </div>`,
            )
            .join("")}
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>Xem lại bài làm</h2>
          <div class="seg" role="group" aria-label="Lọc câu">
            <button type="button" data-review="all" class="${reviewFilter === "all" ? "active" : ""}">Tất cả <span class="count">${r.items.length}</span></button>
            <button type="button" data-review="wrong" class="${reviewFilter === "wrong" ? "active" : ""}">Câu sai <span class="count">${wrongItems.length}</span></button>
          </div>
        </div>
        ${
          shown.length
            ? shown
                .map(({ q, chosen, correct }) => {
                  const num = r.items.findIndex((x) => x.q.id === q.id) + 1;
                  return `
                  <article class="review-card ${correct ? "ok" : "bad"}">
                    <div class="review-head">
                      <span class="review-num">Câu ${num}</span>
                      ${topicTag(q.topic)}
                      <span class="review-verdict">${correct ? "✓ Đúng" : chosen === null ? "— Bỏ trống" : "✕ Sai"}</span>
                      <button type="button" class="feedback-link share-link" data-share="${escapeHtml(q.id)}">↗ Chia sẻ</button>
                      <a class="feedback-link" href="#/community/new?type=content&ref=${encodeURIComponent(q.id)}" target="_blank" rel="noopener">Báo sai / góp ý ↗</a>
                    </div>
                    <div class="quiz-q small">${fmt(q.q)}</div>
                    ${codeOf(q)}
                    <ul class="review-opts">
                      ${q.opts
                        .map((text, i) => {
                          let cls = "";
                          if (i === q.correctIndex) cls = "correct";
                          else if (i === chosen) cls = "wrong";
                          return `<li class="${cls}"><span class="opt-key">${LETTERS[i]}</span><span>${fmt(text)}</span>${
                            i === chosen ? '<span class="you">bạn chọn</span>' : ""
                          }</li>`;
                        })
                        .join("")}
                    </ul>
                    <div class="explain neutral">${fmt(q.explain)}</div>
                    ${creditHtml(q)}
                  </article>`;
                })
                .join("")
            : `<div class="empty"><p>Không có câu sai nào. Tuyệt vời!</p></div>`
        }
      </section>
    `;
  }

  // ---------- Sự kiện ----------
  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.opt !== undefined) return choose(Number(t.dataset.opt));
    if (t.dataset.rank) {
      setup.rank = t.dataset.rank;
      prefs.set("quizRank", setup.rank);
      return renderSetup();
    }
    if (t.dataset.topic) {
      if (setup.topics.has(t.dataset.topic)) setup.topics.delete(t.dataset.topic);
      else setup.topics.add(t.dataset.topic);
      return renderSetup();
    }
    if (t.dataset.count !== undefined) {
      setup.count = Number(t.dataset.count);
      prefs.set("quizCount", setup.count);
      return renderSetup();
    }
    if (t.dataset.mode) {
      setup.mode = t.dataset.mode;
      prefs.set("quizMode", setup.mode);
      return renderSetup();
    }
    if (t.dataset.review) {
      reviewFilter = t.dataset.review;
      return renderResult();
    }
    if (t.dataset.share) {
      const item = result && result.items.find((x) => x.q.id === t.dataset.share);
      return item && shareItem(item.q);
    }
    switch (t.dataset.action) {
      case "start":
        return startFromSetup();
      case "start-wrong":
        return start(shuffle(wrongPool()), "retry");
      case "check":
        return check();
      case "next":
        return next();
      case "quit":
        if (confirmQuit()) {
          clearInterval(timer);
          session = null;
          renderSetup();
        }
        return;
      case "retry":
        return start(shuffle(result.items.filter((x) => !x.correct).map((x) => x.q)), "retry");
      case "again":
        result = null;
        return renderSetup();
    }
  });

  function confirmQuit() {
    if (!session) return true;
    const answered = session.answers.filter((a) => a !== null).length;
    return answered === 0 || window.confirm("Thoát bài quiz đang làm? Kết quả sẽ không được lưu.");
  }

  function onKey(e) {
    if (!session || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea")) return;
    const k = e.key.toLowerCase();
    const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : ["a", "b", "c", "d"].indexOf(k);
    if (idx >= 0) {
      e.preventDefault();
      choose(idx);
    } else if (k === "enter") {
      if (e.target.closest("button")) return; // để nút đang focus tự xử lý
      e.preventDefault();
      const revealed = session.mode === "practice" && session.locked[session.index];
      if (session.mode === "practice" && !revealed) check();
      else next();
    }
  }
  document.addEventListener("keydown", onKey);

  // Link "start=1" (vd. từ trang chủ) bắt đầu ngay.
  if (query.wrong === "1" && wrongPool().length) start(shuffle(wrongPool()), "retry");
  else if (query.start === "1" && pool().length) {
    setup.count = 10;
    startFromSetup();
  } else renderSetup();

  return {
    canLeave: confirmQuit,
    destroy() {
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
    },
  };
}
