import { WEEKS, DAYS } from "../../data/index.js";
import { roadmap } from "../store.js";
import { escapeHtml, fmt, codeBlock, rankTag, percent, formatDuration, confirmClick } from "../utils.js";

const DAY_SECONDS = 300;

export function mount(el, params) {
  const total = DAYS.length;
  const getDay = (n) => DAYS.find((d) => d.day === n);
  const getWeek = (id) => WEEKS.find((w) => w.id === id);

  let completed = roadmap.completed(total);
  const nextIncomplete = () => DAYS.find((d) => !completed.has(d.day))?.day ?? null;
  const requested = Number(params[0]);
  let selected = getDay(requested) ? requested : nextIncomplete() || total;

  let timerSeconds = DAY_SECONDS;
  let timerInterval = null;

  el.innerHTML = `
    <header class="hero">
      <div class="eyebrow">~/flutter-prep/roadmap</div>
      <h1>Lộ trình 35 ngày lên Senior</h1>
      <p class="subtitle" data-slot="subtitle"></p>
      <div class="stats-row">
        <div class="progress-wrap">
          <div class="progress-track"><div class="progress-fill" data-slot="fill"></div></div>
          <div class="bar-label"><span data-slot="count"></span><span data-slot="pct"></span></div>
        </div>
        <div class="badge" data-slot="streak"></div>
      </div>
      <div class="hint">Bấm vào một ngày để mở bộ câu hỏi · bấm câu hỏi để xem đáp án · mỗi bộ ~5 phút</div>
    </header>
    <div data-slot="timeline"></div>
    <section class="detail" data-slot="detail" id="roadmap-detail"></section>
    <div class="center-row">
      <button class="link-btn subtle" type="button" data-action="reset">Xoá tiến độ lộ trình</button>
    </div>
  `;
  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);

  function streak() {
    let n = 0;
    for (let i = 1; i <= total && completed.has(i); i++) n++;
    return n;
  }

  function renderHeader() {
    const done = completed.size;
    const pct = percent(done, total);
    let subtitle;
    if (done === 0) subtitle = "Sẵn sàng bắt đầu commit đầu tiên.";
    else if (done >= total) subtitle = `Toàn bộ ${total} commit đã merge. Sẵn sàng ship vào vòng phỏng vấn.`;
    else {
      const nd = getDay(nextIncomplete());
      subtitle = `Tiếp theo: Ngày ${nd.day} — ${nd.title} (${getWeek(nd.week).tag})`;
    }
    slot("subtitle").textContent = subtitle;
    slot("fill").style.width = pct + "%";
    slot("count").textContent = `${done}/${total} commit đã merge`;
    slot("pct").textContent = pct + "%";
    slot("streak").innerHTML = `Hoàn thành liên tiếp: <strong>${streak()} ngày</strong>`;
  }

  function renderTimeline() {
    const nid = nextIncomplete();
    slot("timeline").innerHTML = WEEKS.map((w) => {
      const days = DAYS.filter((d) => d.week === w.id);
      const doneInWeek = days.filter((d) => completed.has(d.day)).length;
      const nodes = days
        .map((d) => {
          const isDone = completed.has(d.day);
          let cls = "day-node";
          if (isDone) cls += " done";
          if (!isDone && d.day === nid) cls += " current";
          if (d.day === selected) cls += " selected";
          return `<button type="button" class="${cls}" data-day="${d.day}" title="${escapeHtml(`Ngày ${d.day}: ${d.title}`)}" aria-label="Ngày ${d.day}: ${escapeHtml(d.title)}${isDone ? " (đã xong)" : ""}">${isDone ? "&#10003;" : d.day}</button>`;
        })
        .join("");
      return `
        <div class="week-block">
          <div class="week-head">
            <span class="week-tag">${fmt(w.tag)}</span>
            <span class="week-title">${fmt(w.title)}</span>
            <span class="week-sub">${doneInWeek}/${days.length}</span>
          </div>
          <div class="day-line">${nodes}</div>
        </div>`;
    }).join("");
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function renderDetail() {
    const d = getDay(selected);
    const w = getWeek(d.week);
    const isDone = completed.has(d.day);
    stopTimer();
    timerSeconds = DAY_SECONDS;

    const questions = d.questions
      .map(
        (item, i) => `
        <article class="q-card" data-id="${item.id}">
          <button type="button" class="q-head" data-action="toggle" aria-expanded="false">
            <span class="q-index">Q${i + 1}</span>
            <span class="q-text">${fmt(item.q)}</span>
            <span class="q-side">${rankTag(item.rank)}<span class="q-toggle">xem đáp án</span></span>
          </button>
          <div class="q-answer"><div class="q-answer-clip"><div class="q-answer-inner">
            <div class="answer-text">${fmt(item.a)}</div>
            ${codeBlock(item.code)}
          </div></div></div>
        </article>`,
      )
      .join("");

    slot("detail").innerHTML = `
      <div class="detail-head">
        <div>
          <div class="detail-eyebrow">${fmt(w.tag)} · Ngày ${d.day}/${total}</div>
          <h2 class="detail-title">${fmt(d.title)}</h2>
          <div class="detail-meta">+${d.questions.length} câu hỏi${isDone ? " · đã merge ✓" : " · ~5 phút"}</div>
        </div>
        <div class="timer">
          <span data-slot="timer">${formatDuration(timerSeconds)}</span>
          <button type="button" data-action="timer">Bắt đầu</button>
        </div>
      </div>
      <div class="q-list">${questions}</div>
      <button type="button" class="complete-btn${isDone ? " is-done" : ""}" data-action="complete" ${isDone ? "disabled" : ""}>
        ${isDone ? `✓ Đã hoàn thành ngày ${d.day}` : `Đánh dấu hoàn thành ngày ${d.day}`}
      </button>
    `;
  }

  function renderAll() {
    renderHeader();
    renderTimeline();
    renderDetail();
  }

  function toggleTimer(btn) {
    if (timerInterval) {
      stopTimer();
      btn.textContent = "Tiếp tục";
      return;
    }
    if (timerSeconds === 0) timerSeconds = DAY_SECONDS;
    btn.textContent = "Tạm dừng";
    timerInterval = setInterval(() => {
      timerSeconds = Math.max(0, timerSeconds - 1);
      const disp = slot("timer");
      if (disp) disp.textContent = formatDuration(timerSeconds);
      if (timerSeconds === 0) {
        stopTimer();
        btn.textContent = "Hết giờ";
      }
    }, 1000);
  }

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.day) {
      selected = Number(t.dataset.day);
      history.replaceState(null, "", `#/roadmap/${selected}`);
      renderTimeline();
      renderDetail();
      slot("detail").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    switch (t.dataset.action) {
      case "toggle": {
        const card = t.closest(".q-card");
        card.classList.toggle("open");
        const open = card.classList.contains("open");
        t.setAttribute("aria-expanded", String(open));
        t.querySelector(".q-toggle").textContent = open ? "ẩn đáp án" : "xem đáp án";
        break;
      }
      case "timer":
        toggleTimer(t);
        break;
      case "complete":
        roadmap.complete(selected, total);
        completed = roadmap.completed(total);
        selected = nextIncomplete() || selected;
        history.replaceState(null, "", `#/roadmap/${selected}`);
        renderAll();
        break;
      case "reset":
        confirmClick(t, "Xoá tiến độ lộ trình", () => {
          roadmap.reset();
          completed = roadmap.completed(total);
          selected = 1;
          renderAll();
        });
        break;
    }
  });

  renderAll();
  if (getDay(requested)) {
    requestAnimationFrame(() => slot("detail").scrollIntoView({ block: "start" }));
  }

  return { destroy: stopTimer };
}
