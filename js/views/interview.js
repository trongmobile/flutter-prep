import { RANKS, getRank, questionsFor, allQuestions, topics, topicName, currentTrack } from "../../data/index.js";
import { srs, interview as interviewStore, prefs } from "../store.js";
import { escapeHtml, fmt, codeOf, topicTag, rankTag, shuffle, formatDuration, formatDate, docHtml, creditHtml, percent, interviewScope } from "../utils.js";
import { detectTopics } from "../jd.js";

const COUNTS = [5, 8, 10];
const TIMES = [60, 120, 180];
const MAX_JD_TOPICS = 8; // nhận diện từ JD chỉ giữ chủ đề được nhắc nhiều nhất
const RATINGS = [
  { value: 0, label: "Chưa trả lời được", short: "Chưa được", grade: "again" },
  { value: 1, label: "Trả lời được một phần", short: "Một phần", grade: "hard" },
  { value: 2, label: "Trả lời tốt", short: "Tốt", grade: "good" },
];

function canRecord() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

// Bốc câu từ pool, xen kẽ các chủ đề để giống một buổi phỏng vấn thật.
function pickQuestions(pool, n) {
  const groups = {};
  for (const q of shuffle(pool)) (groups[q.topic] ||= []).push(q);
  const lists = shuffle(Object.values(groups));
  const out = [];
  while (out.length < n && lists.some((l) => l.length)) {
    for (const l of lists) if (l.length && out.length < n) out.push(l.shift());
  }
  return out;
}

export function mount(el) {
  const lastRank = prefs.get("interviewRank", prefs.get("lastRank", "junior"));
  const setup = {
    rank: getRank(lastRank) || lastRank === "all" ? lastRank : "junior", // "all": mọi rank
    topics: new Set(), // rỗng = mọi chủ đề
    jd: "",
    jdNote: "",
    count: COUNTS.includes(Number(prefs.get("interviewCount"))) ? Number(prefs.get("interviewCount")) : 5,
    time: TIMES.includes(Number(prefs.get("interviewTime"))) ? Number(prefs.get("interviewTime")) : 120,
    record: canRecord() && prefs.get("interviewRecord", true) !== false,
  };

  let s = null; // buổi phỏng vấn đang diễn ra
  let stream = null;
  let recorder = null;
  let ticker = null;

  // ---------- Thiết lập ----------
  const rankName = (id) => (id === "all" ? "Mọi rank" : getRank(id).name);
  const rankPool = () => (setup.rank === "all" ? allQuestions() : questionsFor(setup.rank));
  // Câu hỏi đủ điều kiện: theo rank đã chọn và (nếu có chọn) theo chủ đề.
  const pool = () => (setup.topics.size ? rankPool().filter((q) => setup.topics.has(q.topic)) : rankPool());
  function topicCounts() {
    const counts = {};
    for (const q of rankPool()) counts[q.topic] = (counts[q.topic] || 0) + 1;
    return counts;
  }

  function renderSetup(note = "") {
    const history = interviewStore.history(currentTrack().id).slice(-5).reverse();
    const counts = topicCounts();
    const available = pool().length;
    const shown = Math.min(setup.count, available);
    const minutes = Math.round((shown * (setup.time + 45)) / 60);
    el.innerHTML = `
      <header class="view-head">
        <div class="eyebrow">phỏng vấn thử · ${escapeHtml(currentTrack().name)}</div>
        <h1>Phỏng vấn thử ${escapeHtml(currentTrack().name)}</h1>
        <p class="subtitle">Câu hỏi được bốc ngẫu nhiên theo rank, hoặc theo chủ đề và mô tả công việc (JD) bạn nhắm tới. Bạn trả lời thành tiếng trong thời gian giới hạn, rồi so với đáp án mẫu và tự chấm điểm.</p>
      </header>
      ${note ? `<div class="notice">${escapeHtml(note)}</div>` : ""}
      <div class="card setup">
        <div class="setup-row">
          <div class="setup-label">Rank phỏng vấn</div>
          <div class="chips">
            ${RANKS.map(
              (r) =>
                `<button type="button" class="chip rank-${r.color}${setup.rank === r.id ? " active" : ""}" data-rank="${r.id}" aria-pressed="${setup.rank === r.id}">${escapeHtml(r.name)}</button>`,
            ).join("")}
            <button type="button" class="chip${setup.rank === "all" ? " active" : ""}" data-rank="all" aria-pressed="${setup.rank === "all"}">Mọi rank</button>
          </div>
        </div>
        <div class="setup-row">
          <div class="setup-label">Chủ đề <span class="muted">— không chọn là bốc từ mọi chủ đề</span></div>
          <div class="chips">
            ${Object.entries(topics())
              .map(([id, name]) => {
                const n = counts[id] || 0;
                const on = setup.topics.has(id);
                return `<button type="button" class="chip${on ? " active" : ""}" data-topic="${id}" aria-pressed="${on}"${n ? "" : " disabled"}>${escapeHtml(name)} <span class="count">${n}</span></button>`;
              })
              .join("")}
            ${setup.topics.size ? `<button type="button" class="link-btn" data-action="clear-topics">Bỏ chọn</button>` : ""}
          </div>
        </div>
        <div class="setup-row">
          <label class="setup-label" for="jd-input">Hoặc dán mô tả công việc (JD) <span class="muted">— tự chọn chủ đề phù hợp</span></label>
          <textarea class="input jd-input" id="jd-input" rows="4" data-control="jd" placeholder="Dán phần yêu cầu kỹ thuật của JD vào đây, ví dụ: thành thạo Riverpod/Bloc, REST API, unit test, CI/CD…">${escapeHtml(setup.jd)}</textarea>
          <div class="jd-actions">
            <button type="button" class="btn btn-ghost" data-action="detect">Chọn chủ đề theo JD</button>
            ${setup.jdNote ? `<span class="muted small" role="status">${escapeHtml(setup.jdNote)}</span>` : ""}
          </div>
        </div>
        <div class="setup-row">
          <div class="setup-label">Số câu hỏi</div>
          <div class="seg" role="group" aria-label="Số câu hỏi">
            ${COUNTS.map((n) => `<button type="button" data-count="${n}" class="${setup.count === n ? "active" : ""}" aria-pressed="${setup.count === n}">${n} câu</button>`).join("")}
          </div>
        </div>
        <div class="setup-row">
          <div class="setup-label">Thời gian trả lời mỗi câu</div>
          <div class="seg" role="group" aria-label="Thời gian mỗi câu">
            ${TIMES.map((t) => `<button type="button" data-time="${t}" class="${setup.time === t ? "active" : ""}" aria-pressed="${setup.time === t}">${t / 60} phút</button>`).join("")}
          </div>
        </div>
        <div class="setup-row">
          <label class="switch${canRecord() ? "" : " disabled"}">
            <input type="checkbox" data-control="record" ${setup.record ? "checked" : ""} ${canRecord() ? "" : "disabled"} />
            <span class="switch-track" aria-hidden="true"></span>
            <span><strong>Ghi âm câu trả lời để nghe lại</strong><br /><span class="muted small">${
              canRecord() ? "Bản ghi chỉ nằm trên trình duyệt của bạn, không gửi đi đâu và mất khi rời trang." : "Trình duyệt này không hỗ trợ ghi âm."
            }</span></span>
          </label>
        </div>
        <div class="setup-foot">
          <span class="muted">Khoảng <strong>${minutes} phút</strong> · ${shown} câu ${escapeHtml(rankName(setup.rank))}${
            setup.topics.size ? ` · ${setup.topics.size} chủ đề` : ""
          }${shown < setup.count ? ` <span class="small">(chỉ có ${available} câu phù hợp)</span>` : ""}</span>
          <button type="button" class="btn btn-primary" data-action="start"${available ? "" : " disabled"}>Bắt đầu phỏng vấn →</button>
        </div>
      </div>

      <section class="card tips">
        <h2>Mẹo trả lời</h2>
        <ul>
          <li>Nói thành tiếng như đang ngồi trước người phỏng vấn — đừng chỉ nghĩ trong đầu.</li>
          <li>Câu kỹ thuật: nêu ý chính trước, sau đó ví dụ thực tế và trade-off.</li>
          <li>Câu behavioral: trả lời theo STAR — Situation, Task, Action, Result.</li>
        </ul>
      </section>

      ${
        history.length
          ? `<section>
              <div class="section-head"><h2>Các buổi gần đây</h2><a class="link-btn" href="#/progress">Xem tiến độ</a></div>
              <div class="table-wrap"><table class="history">
                <thead><tr><th>Thời gian</th><th>Rank</th><th>Điểm</th><th>Thời lượng</th></tr></thead>
                <tbody>${history
                  .map((h) => {
                    const p = percent(h.score, h.max);
                    return `<tr><td>${formatDate(h.ts)}</td><td>${escapeHtml(interviewScope(h))}</td>
                      <td><span class="score-pill ${p >= 70 ? "good" : p >= 50 ? "mid" : "low"}">${p}%</span></td><td>${formatDuration(h.duration)}</td></tr>`;
                  })
                  .join("")}</tbody>
              </table></div>
            </section>`
          : ""
      }`;
  }

  // ---------- Buổi phỏng vấn ----------
  async function start() {
    cleanupMedia();
    const questions = pickQuestions(pool(), setup.count);
    if (!questions.length) return renderSetup("Chưa có câu hỏi phù hợp với lựa chọn này. Hãy đổi rank hoặc bỏ bớt chủ đề.");
    let note = "";
    if (setup.record) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        stream = null;
        note = "Không truy cập được micro nên buổi này sẽ không ghi âm. Bạn vẫn có thể trả lời thành tiếng.";
      }
    }
    if (!el.isConnected) return cleanupMedia();
    s = {
      questions,
      answers: questions.map(() => ({ rating: null, audio: null, seconds: 0 })),
      index: 0,
      phase: "ready",
      startedAt: Date.now(),
      note,
    };
    renderQuestion();
  }

  function renderQuestion() {
    const q = s.questions[s.index];
    const a = s.answers[s.index];
    const head = `
      <div class="quiz-top">
        <button type="button" class="link-btn" data-action="quit">✕ Kết thúc</button>
        <div class="quiz-progress">
          <div class="progress-track slim"><div class="progress-fill" style="width:${((s.index + (s.phase === "review" ? 1 : 0)) / s.questions.length) * 100}%"></div></div>
          <span class="muted">Câu ${s.index + 1}/${s.questions.length}</span>
        </div>
        ${s.phase === "answering" ? `<span class="quiz-timer" data-slot="timer">${formatDuration(setup.time)}</span>` : ""}
      </div>
      ${s.note && s.index === 0 && s.phase === "ready" ? `<div class="notice">${escapeHtml(s.note)}</div>` : ""}`;

    let body = "";
    if (s.phase === "ready") {
      body = `
        <p class="muted center-text">Đọc câu hỏi, chuẩn bị vài giây rồi bấm bắt đầu và trả lời thành tiếng.</p>
        <div class="btn-row center">
          <button type="button" class="btn btn-primary btn-lg" data-action="answer">${stream ? "🎙 Bắt đầu trả lời" : "Bắt đầu trả lời"}</button>
          <button type="button" class="btn btn-ghost" data-action="skip">Bỏ qua câu này</button>
        </div>`;
    } else if (s.phase === "answering") {
      body = `
        <div class="answer-live">
          <div class="time-bar"><span data-slot="timebar" style="width:100%"></span></div>
          ${stream ? `<p class="rec-indicator"><span class="rec-dot"></span> Đang ghi âm</p>` : `<p class="muted center-text">Đang tính giờ — hãy trả lời thành tiếng.</p>`}
          <div class="btn-row center">
            <button type="button" class="btn btn-primary btn-lg" data-action="done">Trả lời xong</button>
          </div>
        </div>`;
    } else {
      body = `
        <div class="answer-review">
          ${
            a.audio
              ? `<div class="your-answer">
                  <div class="setup-label">Câu trả lời của bạn · ${formatDuration(a.seconds)}</div>
                  <audio controls src="${a.audio.url}"></audio>
                  <a class="link-btn" href="${a.audio.url}" download="phong-van-cau-${s.index + 1}.${a.audio.ext}">Tải bản ghi</a>
                </div>`
              : stream
                ? `<p class="muted">Đang xử lý bản ghi…</p>`
                : `<p class="muted">Bạn đã trả lời trong ${formatDuration(a.seconds)}.</p>`
          }
          <div class="model-answer">
            <div class="setup-label">Đáp án mẫu</div>
            <div class="answer-text">${fmt(q.a)}</div>
            ${codeOf(q)}
            ${docHtml(q)}
            ${creditHtml(q)}
          </div>
          <div class="setup-label">Bạn tự chấm câu trả lời của mình</div>
          <div class="grade-row" role="group" aria-label="Tự chấm">
            ${RATINGS.map(
              (r, i) => `<button type="button" class="btn grade-btn grade-${r.grade}" data-rate="${r.value}"><strong>${r.label}</strong><kbd>${i + 1}</kbd></button>`,
            ).join("")}
          </div>
        </div>`;
    }

    el.innerHTML = `
      ${head}
      <article class="quiz-card interview-card">
        <div class="quiz-tags">${rankTag(q.rank)}${topicTag(q.topic)}</div>
        <h2 class="interview-q">${fmt(q.q)}</h2>
        ${body}
      </article>
      <p class="kbd-hint">Phím tắt: <kbd>Enter</kbd> bắt đầu / trả lời xong · <kbd>1</kbd>–<kbd>3</kbd> tự chấm</p>`;
  }

  function beginAnswer() {
    s.phase = "answering";
    s.qStartedAt = Date.now();
    const deadline = s.qStartedAt + setup.time * 1000;
    if (stream) {
      const chunks = [];
      try {
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
        const index = s.index;
        const session = s;
        recorder.onstop = () => {
          const type = recorder && recorder.mimeType ? recorder.mimeType : chunks[0]?.type || "audio/webm";
          const blob = new Blob(chunks, { type });
          const ext = /mp4|m4a|aac/.test(type) ? "m4a" : /ogg/.test(type) ? "ogg" : "webm";
          session.answers[index].audio = { url: URL.createObjectURL(blob), ext };
          if (s === session && s.index === index && s.phase === "review" && el.isConnected) renderQuestion();
        };
        recorder.start();
      } catch (err) {
        recorder = null;
      }
    }
    renderQuestion();
    ticker = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      const t = el.querySelector("[data-slot=timer]");
      const bar = el.querySelector("[data-slot=timebar]");
      if (t) {
        t.textContent = formatDuration(left);
        t.classList.toggle("urgent", left <= 15);
      }
      if (bar) bar.style.width = `${Math.max(0, (left / setup.time) * 100)}%`;
      if (left <= 0) finishAnswer();
    }, 250);
  }

  function finishAnswer() {
    clearInterval(ticker);
    ticker = null;
    s.answers[s.index].seconds = Math.min(setup.time, Math.round((Date.now() - s.qStartedAt) / 1000));
    s.phase = "review";
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder = null;
    renderQuestion();
  }

  function rate(value) {
    const q = s.questions[s.index];
    s.answers[s.index].rating = value;
    srs.grade(q.id, RATINGS[value].grade);
    next();
  }

  function next() {
    if (s.index < s.questions.length - 1) {
      s.index++;
      s.phase = "ready";
      renderQuestion();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else finish();
  }

  function finish() {
    const score = s.answers.reduce((sum, a) => sum + (a.rating || 0), 0);
    const max = s.questions.length * 2;
    const duration = Math.round((Date.now() - s.startedAt) / 1000);
    interviewStore.record({
      ts: Date.now(),
      track: currentTrack().id,
      rank: setup.rank,
      ...(setup.topics.size ? { topics: [...setup.topics] } : {}),
      total: s.questions.length,
      score,
      max,
      duration,
    });
    s.phase = "summary";
    s.result = { score, max, duration };
    stopStream();
    renderSummary();
    window.scrollTo(0, 0);
  }

  function verdict(p) {
    if (p >= 80) return "Rất tốt — bạn sẵn sàng cho vòng phỏng vấn thật!";
    if (p >= 50) return "Khá ổn — ôn thêm các câu chưa tốt rồi thử lại nhé.";
    return "Cần luyện thêm — xem lại đáp án mẫu và ôn hằng ngày.";
  }

  function renderSummary() {
    const { score, max, duration } = s.result;
    const p = percent(score, max);
    const weak = s.answers.filter((a) => a.rating !== null && a.rating < 2).length;
    el.innerHTML = `
      <section class="card result-hero">
        <div class="score-ring" style="--p:${p}">
          <span class="score-num">${score}/${max}</span>
          <span class="score-pct">${p}%</span>
        </div>
        <div class="result-info">
          <div class="eyebrow">phỏng vấn thử · ${escapeHtml(rankName(setup.rank))} · ${formatDuration(duration)}</div>
          <h1>${verdict(p)}</h1>
          ${weak ? `<p class="muted">${weak} câu chưa tốt đã được thêm vào <a href="#/review">Ôn hôm nay</a>.</p>` : ""}
          <div class="btn-row">
            <button type="button" class="btn btn-primary" data-action="again">Phỏng vấn lại</button>
            <button type="button" class="btn btn-ghost" data-action="setup">Đổi thiết lập</button>
            <a class="btn btn-ghost" href="#/review">Ôn hôm nay</a>
          </div>
        </div>
      </section>
      <section>
        <div class="section-head"><h2>Xem lại từng câu</h2></div>
        ${s.questions
          .map((q, i) => {
            const a = s.answers[i];
            const r = a.rating === null ? null : RATINGS[a.rating];
            return `
            <article class="review-card ${r ? (r.value === 2 ? "ok" : r.value === 1 ? "mid" : "bad") : "skip"}">
              <div class="review-head">
                <span class="review-num">Câu ${i + 1}</span>${topicTag(q.topic)}
                <span class="review-verdict">${r ? r.short : "Bỏ qua"}</span>
              </div>
              <a class="quiz-q small q-link" href="#/q/${encodeURIComponent(q.id)}">${fmt(q.q)}</a>
              ${a.audio ? `<audio controls src="${a.audio.url}"></audio>` : ""}
            </article>`;
          })
          .join("")}
      </section>`;
  }

  // Chọn chủ đề theo JD: giữ vài chủ đề được nhắc nhiều nhất mà rank đang chọn có câu hỏi.
  function detectFromJd() {
    setup.jd = el.querySelector("[data-control=jd]").value;
    if (!setup.jd.trim()) {
      setup.jdNote = "Hãy dán nội dung JD vào ô trên trước.";
      return renderSetup();
    }
    const counts = topicCounts();
    const found = detectTopics(setup.jd, currentTrack());
    const usable = found.filter((f) => counts[f.topic]).slice(0, MAX_JD_TOPICS);
    setup.topics = new Set(usable.map((f) => f.topic));
    setup.jdNote = usable.length
      ? `Nhận ra ${usable.length} chủ đề: ${usable.map((f) => topicName(f.topic)).join(", ")}. Bạn vẫn có thể bỏ hoặc thêm chủ đề ở trên.`
      : found.length
        ? "JD có nhắc chủ đề nhưng rank đang chọn chưa có câu hỏi về chúng — thử chọn Mọi rank."
        : "Không nhận ra chủ đề kỹ thuật nào trong JD. Hãy dán phần yêu cầu kỹ thuật, hoặc chọn chủ đề thủ công.";
    renderSetup();
  }

  // ---------- Dọn dẹp ----------
  function stopStream() {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (e) {
        /* ignore */
      }
    }
    recorder = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  function cleanupMedia() {
    clearInterval(ticker);
    ticker = null;
    stopStream();
    if (s) s.answers.forEach((a) => a.audio && URL.revokeObjectURL(a.audio.url));
  }
  function inProgress() {
    return s && s.phase !== "summary" && (s.index > 0 || s.phase !== "ready");
  }
  function confirmQuit() {
    return !inProgress() || window.confirm("Kết thúc buổi phỏng vấn thử? Kết quả sẽ không được lưu.");
  }

  // ---------- Sự kiện ----------
  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.rank) {
      setup.rank = t.dataset.rank;
      prefs.set("interviewRank", setup.rank);
      const counts = topicCounts();
      setup.topics = new Set([...setup.topics].filter((topic) => counts[topic])); // bỏ chủ đề rank mới chưa có câu
      return renderSetup();
    }
    if (t.dataset.topic) {
      if (!setup.topics.delete(t.dataset.topic)) setup.topics.add(t.dataset.topic);
      setup.jdNote = "";
      return renderSetup();
    }
    if (t.dataset.count) {
      setup.count = Number(t.dataset.count);
      prefs.set("interviewCount", setup.count);
      return renderSetup();
    }
    if (t.dataset.time) {
      setup.time = Number(t.dataset.time);
      prefs.set("interviewTime", setup.time);
      return renderSetup();
    }
    if (t.dataset.rate !== undefined) return rate(Number(t.dataset.rate));
    switch (t.dataset.action) {
      case "start":
      case "again":
        return start();
      case "clear-topics":
        setup.topics.clear();
        setup.jdNote = "";
        return renderSetup();
      case "detect":
        return detectFromJd();
      case "answer":
        return beginAnswer();
      case "done":
        return finishAnswer();
      case "skip":
        return next();
      case "setup":
        cleanupMedia();
        s = null;
        return renderSetup();
      case "quit":
        if (confirmQuit()) {
          cleanupMedia();
          s = null;
          renderSetup();
        }
        return;
    }
  });
  el.addEventListener("input", (e) => {
    if (e.target.dataset.control === "jd") setup.jd = e.target.value;
  });
  el.addEventListener("change", (e) => {
    if (e.target.dataset.control === "record") {
      setup.record = e.target.checked;
      prefs.set("interviewRecord", setup.record);
    }
  });

  function onKey(e) {
    if (!s || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea, audio")) return;
    if (e.key === "Enter" && !e.target.closest("button")) {
      if (s.phase === "ready") {
        e.preventDefault();
        beginAnswer();
      } else if (s.phase === "answering") {
        e.preventDefault();
        finishAnswer();
      }
    } else if (s.phase === "review" && ["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      rate(Number(e.key) - 1);
    }
  }
  document.addEventListener("keydown", onKey);

  renderSetup();
  return {
    canLeave: confirmQuit,
    destroy() {
      document.removeEventListener("keydown", onKey);
      cleanupMedia();
    },
  };
}
