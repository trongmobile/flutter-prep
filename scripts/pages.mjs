// Trang tĩnh cho Google và mạng xã hội. Site chính dùng #hash nên Google chỉ thấy trang chủ,
// còn Facebook/Zalo không chạy JavaScript; các trang dưới đây có sẵn nội dung trong HTML:
//   s/<id>.html                          từng câu hỏi / câu quiz (cũng là link chia sẻ)
//   phong-van/                           mọi nền tảng
//   phong-van/<track>/                   một nền tảng: các rank, các chủ đề
//   phong-van/<track>/<rank>/            toàn bộ câu hỏi của một rank kèm đáp án
//   phong-van/<track>/chu-de/<topic>/    câu hỏi theo chủ đề
//   quyen-rieng-tu/                      chính sách quyền riêng tư
//   sitemap.xml                          danh sách trang gửi cho Google Search Console
// Đáp án nằm trong <details> (bấm để xem) để người đọc tự trả lời trước; Google vẫn đọc được.
import { RANKS, TRACKS, getRank, getTrack, loadAllTracks } from "../data/index.js";
import { GITHUB_URL, SITE_URL } from "../js/config.js";
import { escapeHtml as esc, fmt, codeOf, docHtml } from "../js/utils.js";

const plain = (s) => String(s).replace(/`/g, "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const LETTERS = ["A", "B", "C", "D"];

// Đường dẫn trong site (vd. "phong-van/flutter/") -> URL đầy đủ.
const urlOf = (path) => SITE_URL + path.replace(/index\.html$/, "");
const itemPath = (id) => `s/${encodeURIComponent(id)}.html`;
const trackPath = (t) => `phong-van/${t}/`;
const rankPath = (t, r) => `phong-van/${t}/${r}/`;
const topicPath = (t, topic) => `phong-van/${t}/chu-de/${topic}/`;

const BRAND_SVG = `<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path class="brand-mark-bubble" d="M7 3h10a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5h-7l-4.2 3.4a.6.6 0 0 1-1-.47V17.6A5 5 0 0 1 2 13V8a5 5 0 0 1 5-5z"/><path class="brand-mark-prompt" d="M7.5 8l3 2.5-3 2.5M12.5 13h4"/></svg>`;
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 3h10a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5h-7l-4.2 3.4a.6.6 0 0 1-1-.47V17.6A5 5 0 0 1 2 13V8a5 5 0 0 1 5-5z' fill='%233fb8d6'/%3E%3Cpath d='M7.5 8l3 2.5-3 2.5M12.5 13h4' fill='none' stroke='%230b1220' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

// path: vị trí file trong site. crumbs: [{ name, path }], mục cuối là trang hiện tại.
function layout(path, { title, description, ogTitle, ogDescription, ogImage, ogType = "website", track, crumbs, body }) {
  const base = "../".repeat(path.split("/").length - 1);
  const canonical = urlOf(path);
  crumbs = [{ name: "Trang chủ", path: "" }, ...crumbs];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: urlOf(c.path) })),
  };
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0b1220">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Mobile Interview">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDescription || description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_URL}assets/${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}css/styles.css">
<script>try{var p=JSON.parse(localStorage.getItem("fip.prefs.v1")||"{}");if(p.theme==="light"||p.theme==="dark")document.documentElement.dataset.theme=p.theme}catch(e){}</script>
<script data-goatcounter="https://interview.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c")}</script>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="${base}">${BRAND_SVG}Interview</a>
    <nav class="nav" aria-label="Câu hỏi phỏng vấn theo nền tảng">
      ${TRACKS.map((t) => `<a href="${base}${trackPath(t.id)}"${t.id === track ? ' class="active" aria-current="page"' : ""}>${esc(t.name)}</a>`).join("\n      ")}
    </nav>
    <div class="topbar-actions"><a class="btn btn-primary static-cta" href="${base}#/${track || ""}">Mở app ôn luyện</a></div>
  </div>
</header>
<main class="page static-page">
<nav class="crumbs" aria-label="Breadcrumb">
  ${crumbs
    .map((c, i) => (i === crumbs.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${base}${c.path}">${esc(c.name)}</a>`))
    .join(' <span class="crumb-sep">›</span> ')}
</nav>
${body(base)}
</main>
<footer class="footer">
  <p>Flutter · Android · iOS · React Native — câu hỏi phỏng vấn, flashcard, quiz &amp; phỏng vấn thử theo rank</p>
  <p><a href="${base}phong-van/">Câu hỏi phỏng vấn</a> · <a href="${base}#/">Ôn luyện miễn phí</a> · <a href="${base}#/community">Cộng đồng &amp; góp ý</a> · <a href="${base}quyen-rieng-tu/">Quyền riêng tư</a></p>
</footer>
</body>
</html>
`;
}

const rankTag = (r) => `<span class="rank-tag rank-${getRank(r).color}">${esc(getRank(r).name)}</span>`;

function credit(item, base) {
  if (!item.by) return "";
  const login = esc(item.by);
  const issue = Number.isInteger(item.issue) ? ` · <a href="${base}#/community/${item.issue}">#${item.issue}</a>` : "";
  return `<p class="credit">Đóng góp bởi <a href="https://github.com/${login}" rel="noopener">@${login}</a>${issue}</p>`;
}

// Đáp án (câu hỏi) hoặc 4 phương án + đáp án đúng (quiz), dùng chung cho trang câu và trang rank.
function answerBlock(item, kind, base) {
  if (kind === "quiz") {
    return `${codeOf(item)}
    <ol class="options static-options">
      ${item.options.map((o, i) => `<li class="opt"><span class="opt-key">${LETTERS[i]}</span><span class="opt-text">${fmt(o)}</span></li>`).join("\n      ")}
    </ol>
    <details class="reveal">
      <summary>Xem đáp án</summary>
      <div class="explain ok"><strong>Đáp án đúng: ${LETTERS[item.answer]}</strong><div>${fmt(item.explain)}</div></div>
      ${docHtml(item)}${credit(item, base)}
    </details>`;
  }
  return `<details class="reveal">
      <summary>Xem đáp án mẫu</summary>
      <div class="model-answer">
        <div class="answer-text">${fmt(item.a)}</div>
        ${codeOf(item)}
        ${docHtml(item)}${credit(item, base)}
      </div>
    </details>`;
}

function linkList(items, base, { showRank = false } = {}) {
  return `<ul class="link-list">
    ${items
      .map(
        ({ item, kind }) =>
          `<li><a href="${base}${itemPath(item.id)}">${esc(plain(item.q))}</a>${showRank ? " " + rankTag(item.rank) : ""}${kind === "quiz" ? ' <span class="tag">Quiz</span>' : ""}</li>`,
      )
      .join("\n    ")}
  </ul>`;
}

// ---------- Trang một câu ----------
function itemPage(entry, ctx) {
  const { item, kind } = entry;
  const track = getTrack(item.track);
  const rank = getRank(item.rank);
  const topicName = track.topics[item.topic] || item.topic;
  const text = plain(item.q);
  const title = cut(`${kind === "quiz" ? "Quiz" : "Câu hỏi phỏng vấn"} ${track.name} ${rank.name}: ${text}`, 110);
  const path = itemPath(item.id);
  const { prev, next, related } = ctx;
  return layout(path, {
    title,
    description: cut(plain(kind === "quiz" ? item.explain : item.a), 158),
    // Ảnh/tiêu đề khi chia sẻ: không lộ đáp án trên Facebook.
    ogDescription:
      kind === "quiz"
        ? "Câu trắc nghiệm 4 đáp án — bạn chọn đúng không? Làm thử và xem giải thích chi tiết."
        : `Bạn trả lời được câu này không? Tự trả lời rồi xem đáp án mẫu, ôn thêm câu hỏi phỏng vấn ${track.name} theo rank.`,
    ogImage: `og-${track.id}.png`,
    ogType: "article",
    track: track.id,
    crumbs: [
      { name: "Câu hỏi phỏng vấn", path: "phong-van/" },
      { name: track.name, path: trackPath(track.id) },
      { name: rank.name, path: rankPath(track.id, rank.id) },
      { name: cut(text, 48), path },
    ],
    body: (base) => `
<article class="card question-page rank-${rank.color}">
  <div class="quiz-tags"><span class="tag">${esc(track.name)}</span>${rankTag(rank.id)}<a class="tag" href="${base}${topicPath(track.id, item.topic)}">${esc(topicName)}</a><span class="tag">${kind === "quiz" ? "Quiz trắc nghiệm" : "Câu hỏi phỏng vấn"}</span></div>
  <h1 class="question-title">${fmt(item.q)}</h1>
  ${kind === "quiz" ? "" : `<p class="muted">Tự trả lời thành tiếng trước, rồi mới xem đáp án mẫu nhé.</p>`}
  ${answerBlock(item, kind, base)}
  <div class="btn-row"><a class="btn btn-primary" href="${base}#/q/${encodeURIComponent(item.id)}">Luyện câu này trong app</a></div>
</article>
<nav class="pager" aria-label="Câu trước, câu sau">
  ${prev ? `<a href="${base}${itemPath(prev.item.id)}"><span class="muted small">← Câu trước</span><span>${esc(cut(plain(prev.item.q), 80))}</span></a>` : "<span></span>"}
  ${next ? `<a class="pager-next" href="${base}${itemPath(next.item.id)}"><span class="muted small">Câu sau →</span><span>${esc(cut(plain(next.item.q), 80))}</span></a>` : ""}
</nav>
<section class="card next-steps">
  <h2>Ôn tiếp ${esc(track.name)} ${esc(rank.name)}</h2>
  <div class="btn-row">
    <a class="btn btn-rank rank-${rank.color}" href="${base}${rankPath(track.id, rank.id)}">Tất cả câu hỏi ${esc(track.name)} ${esc(rank.name)}</a>
    <a class="btn btn-ghost" href="${base}#/${track.id}/quiz?rank=${rank.id}&amp;start=1">Quiz ${esc(rank.name)} 10 câu</a>
    <a class="btn btn-ghost" href="${base}#/${track.id}/interview">Phỏng vấn thử</a>
  </div>
</section>
${
  related.length
    ? `<section>
  <div class="section-head"><h2>Cùng chủ đề ${esc(topicName)}</h2><a class="section-sub" href="${base}${topicPath(track.id, item.topic)}">Xem tất cả →</a></div>
  ${linkList(related, base, { showRank: true })}
</section>`
    : ""
}`,
  });
}

// ---------- Trang một rank ----------
function rankPage(data, rank) {
  const track = data.track;
  const r = getRank(rank);
  const questions = data.questionsByRank[rank];
  const quiz = data.quizByRank[rank];
  const path = rankPath(track.id, rank) + "index.html";
  const topics = Object.keys(track.topics).filter((t) => questions.some((q) => q.topic === t));
  return layout(path, {
    title: `Câu hỏi phỏng vấn ${track.name} ${r.name} (${questions.length} câu có đáp án) — Mobile Interview`,
    description: cut(`${questions.length} câu hỏi phỏng vấn ${track.name} ${r.name} kèm đáp án mẫu và ${quiz.length} câu quiz trắc nghiệm: ${track.ranks[rank]}`, 158),
    ogImage: `og-${track.id}.png`,
    track: track.id,
    crumbs: [
      { name: "Câu hỏi phỏng vấn", path: "phong-van/" },
      { name: track.name, path: trackPath(track.id) },
      { name: r.name, path: rankPath(track.id, rank) },
    ],
    body: (base) => `
<header class="view-head rank-${r.color}">
  <div class="eyebrow">phỏng vấn · ${esc(track.name.toLowerCase())} · ${esc(r.name.toLowerCase())} (${esc(r.years)})</div>
  <h1>Câu hỏi phỏng vấn ${esc(track.name)} ${esc(r.name)}</h1>
  <p class="subtitle">${esc(track.ranks[rank])} Gồm ${questions.length} câu hỏi kèm đáp án mẫu và ${quiz.length} câu quiz trắc nghiệm.</p>
  <div class="btn-row">
    <a class="btn btn-rank rank-${r.color}" href="${base}#/${track.id}/study/${rank}">Ôn bằng flashcard</a>
    <a class="btn btn-ghost" href="${base}#/${track.id}/quiz?rank=${rank}&amp;start=1">Làm quiz ${esc(r.name)}</a>
  </div>
</header>
<nav class="chips" aria-label="Rank khác">
  ${RANKS.map((x) => `<a class="chip${x.id === rank ? " active" : ""}" href="${base}${rankPath(track.id, x.id)}"${x.id === rank ? ' aria-current="page"' : ""}>${esc(x.name)}</a>`).join("\n  ")}
</nav>
<nav class="toc" aria-label="Mục lục">
  <h2 class="side-title">Mục lục</h2>
  <ul>
    ${topics.map((t) => `<li><a href="#${t}">${esc(track.topics[t])}</a> <span class="count">${questions.filter((q) => q.topic === t).length}</span></li>`).join("\n    ")}
    ${quiz.length ? `<li><a href="#quiz">Quiz trắc nghiệm</a> <span class="count">${quiz.length}</span></li>` : ""}
  </ul>
</nav>
${topics
  .map(
    (t) => `<section id="${t}">
  <div class="section-head"><h2>${esc(track.topics[t])}</h2><a class="section-sub" href="${base}${topicPath(track.id, t)}">Mọi rank →</a></div>
  <ol class="qa-list">
    ${questions
      .filter((q) => q.topic === t)
      .map(
        (q) => `<li class="qa-item">
      <h3 class="qa-q"><a href="${base}${itemPath(q.id)}">${fmt(q.q)}</a></h3>
      ${answerBlock(q, "question", base)}
    </li>`,
      )
      .join("\n    ")}
  </ol>
</section>`,
  )
  .join("\n")}
${
  quiz.length
    ? `<section id="quiz">
  <div class="section-head"><h2>Quiz trắc nghiệm ${esc(track.name)} ${esc(r.name)}</h2><a class="section-sub" href="${base}#/${track.id}/quiz?rank=${rank}&amp;start=1">Làm quiz trong app →</a></div>
  ${linkList(quiz.map((item) => ({ item, kind: "quiz" })), base)}
</section>`
    : ""
}`,
  });
}

// ---------- Trang một chủ đề ----------
function topicPage(data, topic) {
  const track = data.track;
  const name = track.topics[topic];
  const questions = data.allQuestions.filter((q) => q.topic === topic);
  const quiz = data.allQuiz.filter((q) => q.topic === topic);
  const path = topicPath(track.id, topic) + "index.html";
  return layout(path, {
    title: `Câu hỏi phỏng vấn ${track.name}: ${name} — Mobile Interview`,
    description: cut(`${questions.length} câu hỏi phỏng vấn ${track.name} về ${name} từ Fresher đến Senior, có đáp án mẫu${quiz.length ? ` và ${quiz.length} câu quiz trắc nghiệm` : ""}.`, 158),
    ogImage: `og-${track.id}.png`,
    track: track.id,
    crumbs: [
      { name: "Câu hỏi phỏng vấn", path: "phong-van/" },
      { name: track.name, path: trackPath(track.id) },
      { name, path: topicPath(track.id, topic) },
    ],
    body: (base) => `
<header class="view-head">
  <div class="eyebrow">phỏng vấn · ${esc(track.name.toLowerCase())} · chủ đề</div>
  <h1>Câu hỏi phỏng vấn ${esc(track.name)}: ${esc(name)}</h1>
  <p class="subtitle">${questions.length} câu hỏi kèm đáp án mẫu${quiz.length ? ` và ${quiz.length} câu quiz` : ""} về ${esc(name)}, xếp theo rank từ Fresher đến Senior.</p>
</header>
${RANKS.map((r) => {
  const items = [
    ...questions.filter((q) => q.rank === r.id).map((item) => ({ item, kind: "question" })),
    ...quiz.filter((q) => q.rank === r.id).map((item) => ({ item, kind: "quiz" })),
  ];
  if (!items.length) return "";
  return `<section>
  <div class="section-head"><h2>${rankTag(r.id)} ${esc(track.name)} ${esc(r.name)}</h2><a class="section-sub" href="${base}${rankPath(track.id, r.id)}">Mọi chủ đề ${esc(r.name)} →</a></div>
  ${linkList(items, base)}
</section>`;
})
  .filter(Boolean)
  .join("\n")}
<section>
  <div class="section-head"><h2>Chủ đề khác</h2></div>
  <div class="chips">
    ${Object.entries(track.topics)
      .filter(([t]) => t !== topic && data.allQuestions.some((q) => q.topic === t))
      .map(([t, n]) => `<a class="chip" href="${base}${topicPath(track.id, t)}">${esc(n)}</a>`)
      .join("\n    ")}
  </div>
</section>`,
  });
}

// ---------- Trang một nền tảng ----------
function trackPage(data) {
  const track = data.track;
  const path = trackPath(track.id) + "index.html";
  const nQ = data.allQuestions.length;
  const nQuiz = data.allQuiz.length;
  return layout(path, {
    title: `Câu hỏi phỏng vấn ${track.name} từ Fresher đến Senior — Mobile Interview`,
    description: cut(`Tổng hợp ${nQ} câu hỏi phỏng vấn ${track.name} kèm đáp án mẫu và ${nQuiz} câu quiz, chia theo Fresher, Junior, Middle, Senior: ${track.tagline}.`, 158),
    ogImage: `og-${track.id}.png`,
    track: track.id,
    crumbs: [
      { name: "Câu hỏi phỏng vấn", path: "phong-van/" },
      { name: track.name, path: trackPath(track.id) },
    ],
    body: (base) => `
<header class="view-head">
  <div class="eyebrow">phỏng vấn · ${esc(track.name.toLowerCase())}</div>
  <h1>Câu hỏi phỏng vấn ${esc(track.name)}</h1>
  <p class="subtitle">${esc(track.tagline)}. ${nQ} câu hỏi kèm đáp án mẫu và ${nQuiz} câu quiz trắc nghiệm, chia theo 4 rank.</p>
  <div class="btn-row">
    <a class="btn btn-primary" href="${base}#/${track.id}">Ôn ${esc(track.name)} trong app</a>
    ${track.hasRoadmap ? `<a class="btn btn-ghost" href="${base}#/${track.id}/roadmap">Lộ trình 35 ngày</a>` : ""}
    <a class="btn btn-ghost" href="${base}#/${track.id}/interview">Phỏng vấn thử</a>
    <a class="btn btn-ghost" href="${esc(track.docs)}" target="_blank" rel="noopener">Document ${esc(track.name)} ↗</a>
  </div>
</header>
<section>
  <div class="section-head"><h2>Theo rank</h2></div>
  <div class="hub-grid">
    ${RANKS.map(
      (r) => `<a class="hub-card rank-${r.color}" href="${base}${rankPath(track.id, r.id)}">
      <strong>${esc(track.name)} ${esc(r.name)} <span class="muted small">${esc(r.years)}</span></strong>
      <span>${esc(track.ranks[r.id])}</span>
      <span class="hub-count">${data.questionsByRank[r.id].length} câu hỏi · ${data.quizByRank[r.id].length} quiz</span>
    </a>`,
    ).join("\n    ")}
  </div>
</section>
<section>
  <div class="section-head"><h2>Theo chủ đề</h2></div>
  <div class="chips">
    ${Object.entries(track.topics)
      .map(([t, n]) => [t, n, data.allQuestions.filter((q) => q.topic === t).length + data.allQuiz.filter((q) => q.topic === t).length])
      .filter(([t]) => data.allQuestions.some((q) => q.topic === t))
      .map(([t, n, c]) => `<a class="chip" href="${base}${topicPath(track.id, t)}">${esc(n)} <span class="count">${c}</span></a>`)
      .join("\n    ")}
  </div>
</section>`,
  });
}

// ---------- Trang tổng hợp ----------
function hubPage(all) {
  const path = "phong-van/index.html";
  return layout(path, {
    title: "Câu hỏi phỏng vấn Flutter, Android, iOS, React Native có đáp án — Mobile Interview",
    description:
      "Ngân hàng câu hỏi phỏng vấn lập trình mobile có đáp án mẫu: Flutter, Android (Kotlin/Java), iOS (Swift), React Native, chia theo Fresher, Junior, Middle, Senior.",
    ogImage: "og.png",
    crumbs: [{ name: "Câu hỏi phỏng vấn", path: "phong-van/" }],
    body: (base) => `
<header class="view-head">
  <div class="eyebrow">phỏng vấn · mobile</div>
  <h1>Câu hỏi phỏng vấn lập trình mobile</h1>
  <p class="subtitle">${all.reduce((n, d) => n + d.allQuestions.length, 0)} câu hỏi kèm đáp án mẫu và ${all.reduce((n, d) => n + d.allQuiz.length, 0)} câu quiz trắc nghiệm cho Flutter, Android, iOS và React Native, chia theo rank từ Fresher đến Senior. Miễn phí, không cần đăng ký.</p>
  <div class="btn-row"><a class="btn btn-primary" href="${base}#/">Ôn luyện trong app</a></div>
</header>
<div class="hub-grid">
  ${all
    .map(
      (d) => `<div class="hub-card">
    <a class="hub-title" href="${base}${trackPath(d.track.id)}">Câu hỏi phỏng vấn ${esc(d.track.name)}</a>
    <span>${esc(d.track.tagline)}</span>
    <span class="hub-count">${d.allQuestions.length} câu hỏi · ${d.allQuiz.length} quiz</span>
    <span class="hub-ranks">${RANKS.map((r) => `<a class="rank-tag rank-${r.color}" href="${base}${rankPath(d.track.id, r.id)}">${esc(r.name)}</a>`).join(" ")}</span>
  </div>`,
    )
    .join("\n  ")}
</div>`,
  });
}

// ---------- Chính sách quyền riêng tư ----------
// Nội dung phải khớp với những gì site thật sự làm (js/store.js, js/leaderboard.js, js/analytics.js,
// js/community.js, js/views/interview.js). Đổi cách thu thập dữ liệu hoặc thêm dịch vụ bên thứ ba thì sửa ở đây.
const PRIVACY_UPDATED = "3/11/2026";

function privacyPage() {
  const path = "quyen-rieng-tu/index.html";
  const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  return layout(path, {
    title: "Chính sách quyền riêng tư — Mobile Interview",
    description:
      "Mobile Interview lưu và gửi dữ liệu gì: tiến độ học nằm trên trình duyệt của bạn, bảng xếp hạng chỉ nhận biệt danh và điểm, thống kê lượt xem không dùng cookie.",
    ogImage: "og.png",
    crumbs: [{ name: "Quyền riêng tư", path: "quyen-rieng-tu/" }],
    body: (base) => `
<div class="prose">
<header class="view-head">
  <h1>Chính sách quyền riêng tư</h1>
  <p class="subtitle">Cập nhật lần cuối: ${PRIVACY_UPDATED}. Trang này nói rõ site lưu và gửi đi dữ liệu nào, để ở đâu, và bạn xoá được bằng cách nào.</p>
</header>
<section>
  <h2>Tóm tắt</h2>
  <ul>
    <li>Không cần đăng ký. Site không hỏi email, số điện thoại hay tên thật của bạn.</li>
    <li>Tiến độ học (câu đã thuộc, lịch ôn, lịch sử quiz) lưu ngay trên trình duyệt của bạn và không gửi lên máy chủ nào.</li>
    <li>Chỉ khi bạn tự đặt biệt danh và nộp bài <em>Thi thử</em> đề chuẩn, biệt danh và điểm mới được gửi lên bảng xếp hạng công khai.</li>
    <li>Ghi âm khi <em>Phỏng vấn thử</em> chỉ nằm trong trình duyệt của bạn, không được tải lên.</li>
    <li>Site không đặt cookie và không bán dữ liệu cá nhân.</li>
  </ul>
</section>

<section>
  <h2>Dữ liệu lưu trên thiết bị của bạn</h2>
  <p>Site lưu các thông tin sau trong bộ nhớ của trình duyệt (<code>localStorage</code>). Chủ site không truy cập được chúng.</p>
  <ul>
    <li>Câu hỏi bạn đánh dấu <em>Đã thuộc</em> / <em>Cần ôn lại</em> và lịch ôn tập ngắt quãng.</li>
    <li>Lịch sử quiz và phỏng vấn thử, các ngày bạn đã học (để tính chuỗi ngày), các ngày đã hoàn thành trong lộ trình.</li>
    <li>Tuỳ chọn giao diện (sáng/tối, nền tảng đang chọn).</li>
    <li>Mã người chơi (chuỗi ngẫu nhiên do trình duyệt tự sinh) và biệt danh, nếu bạn từng đặt biệt danh cho bảng xếp hạng.</li>
    <li>Bản lưu tạm dữ liệu trang Cộng đồng và Việc làm đọc từ GitHub, để tải nhanh hơn.</li>
  </ul>
  <p>Site cũng lưu bản sao các file của trang (và font chữ) trong bộ nhớ đệm của trình duyệt để bạn cài như app và học được khi offline.</p>
  <p>Nút <em>Sao lưu</em> ở mục Tiến độ tạo một file JSON ngay trên máy bạn. File này không đi đâu cả, bạn tự giữ.</p>
</section>

<section>
  <h2>Bảng xếp hạng</h2>
  <p>Khi bạn đặt biệt danh hoặc nộp bài <em>Thi thử</em> đề chuẩn, trình duyệt gửi tới máy chủ ${ext("https://supabase.com", "Supabase")}:</p>
  <ul>
    <li>mã người chơi và biệt danh;</li>
    <li>nền tảng, rank, số câu đúng, tổng số câu, thời gian làm bài và thời điểm nộp.</li>
  </ul>
  <p>Biệt danh, điểm và thời gian làm bài hiện công khai trên bảng xếp hạng, ai cũng xem được. Hãy dùng biệt danh không liên quan tới tên thật và đừng đưa thông tin nhạy cảm vào đó. Mã người chơi không hiển thị công khai.</p>
  <p>Site không lưu địa chỉ IP trong dữ liệu của bảng xếp hạng. Như mọi máy chủ web, nhà cung cấp hạ tầng có thể ghi nhật ký kỹ thuật theo chính sách của họ (${ext("https://supabase.com/privacy", "Supabase")}). Nếu bạn không đặt biệt danh và không nộp bài thi, không có gì được gửi đi.</p>
</section>

<section>
  <h2>Phỏng vấn thử và micro</h2>
  <p>Trình duyệt chỉ hỏi quyền dùng micro khi bạn bật ghi âm. Bản ghi nằm trong bộ nhớ của tab để bạn nghe lại và tự chấm. Nó không được tải lên máy chủ, không lưu vào <code>localStorage</code> và mất khi bạn đóng hoặc tải lại trang. Nếu muốn giữ, bạn bấm <em>Tải bản ghi</em> để lưu file về máy. Bạn có thể thu hồi quyền micro bất cứ lúc nào trong cài đặt trình duyệt.</p>
</section>

<section>
  <h2>Dịch vụ bên thứ ba</h2>
  <ul>
    <li><strong>GoatCounter</strong> đếm lượt xem trang (${ext("https://interview.goatcounter.com", "thống kê công khai")}). Dịch vụ này không đặt cookie và không lưu địa chỉ IP của bạn. Nó ghi các thông tin kỹ thuật cơ bản như trang đã xem, trang giới thiệu, loại trình duyệt, hệ điều hành, kích thước màn hình và quốc gia. Xem ${ext("https://www.goatcounter.com/privacy", "chính sách của GoatCounter")}.</li>
    <li><strong>Google Fonts</strong> cung cấp font chữ. Khi tải font, Google nhận địa chỉ IP và thông tin trình duyệt của bạn. Xem ${ext("https://policies.google.com/privacy", "chính sách của Google")}.</li>
    <li><strong>GitHub</strong> lưu trữ site (GitHub Pages) và cung cấp dữ liệu cho trang Cộng đồng, Việc làm. Trình duyệt của bạn gọi thẳng tới <code>api.github.com</code>, nên GitHub nhận địa chỉ IP của bạn. Khi bạn gửi đóng góp, bạn dùng tài khoản GitHub của mình và nội dung đó công khai trên GitHub; câu hỏi được duyệt hiển thị tên GitHub của người đóng góp. Xem ${ext("https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement", "chính sách của GitHub")}.</li>
    <li><strong>Supabase</strong> lưu dữ liệu bảng xếp hạng, như ở mục trên.</li>
    <li>Các liên kết ra ngoài (ITviec, TopCV, VietnamWorks, LinkedIn, tài liệu chính thức...) dẫn tới trang của bên khác, họ có chính sách riêng.</li>
  </ul>
</section>

<section>
  <h2>Cookie</h2>
  <p>Mobile Interview không tự đặt cookie. Các dịch vụ bên thứ ba ở trên hoạt động theo chính sách của họ.</p>
</section>

<section>
  <h2>Quyền của bạn và cách xoá dữ liệu</h2>
  <ul>
    <li><strong>Dữ liệu trên máy:</strong> vào mục Tiến độ, bấm <em>Xoá toàn bộ tiến độ</em>. Nút này giữ lại mã người chơi và biệt danh. Muốn xoá hết, hãy xoá dữ liệu trang (site data) của site này trong cài đặt trình duyệt.</li>
    <li><strong>Biệt danh và điểm trên bảng xếp hạng:</strong> gửi yêu cầu qua ${ext(`${GITHUB_URL}/issues/new/choose`, "GitHub Issues")} kèm biệt danh của bạn, mình sẽ xoá biệt danh và toàn bộ điểm đi kèm.</li>
    <li><strong>Bộ nhớ đệm offline:</strong> xoá cùng dữ liệu trang trong trình duyệt.</li>
    <li>Bạn cũng có các quyền theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, như yêu cầu truy cập, chỉnh sửa hoặc xoá dữ liệu của mình. Gửi yêu cầu qua cùng kênh trên.</li>
  </ul>
</section>

<section>
  <h2>Bảo mật</h2>
  <p>Site chạy qua HTTPS. Bảng dữ liệu của bảng xếp hạng bật khoá truy cập theo hàng (RLS) và trình duyệt chỉ gọi được vài hàm đã mở sẵn, không đọc hay ghi trực tiếp vào bảng. Không hệ thống nào an toàn tuyệt đối, vì vậy hãy tránh đưa thông tin nhạy cảm vào biệt danh.</p>
</section>

<section>
  <h2>Trẻ em</h2>
  <p>Site dành cho người học lập trình và đi phỏng vấn. Site không chủ ý thu thập thông tin của trẻ em dưới 16 tuổi.</p>
</section>

<section>
  <h2>Thay đổi chính sách</h2>
  <p>Khi site đổi cách thu thập dữ liệu hoặc thêm dịch vụ bên thứ ba, trang này sẽ được cập nhật và ngày ở đầu trang đổi theo. Lịch sử thay đổi xem trong ${ext(`${GITHUB_URL}/commits/main/scripts/pages.mjs`, "kho mã nguồn")}.</p>
</section>

<section>
  <h2>Liên hệ</h2>
  <p>Câu hỏi, góp ý hoặc yêu cầu về dữ liệu: ${ext(`${GITHUB_URL}/issues/new/choose`, "mở một issue trên GitHub")} hoặc dùng mục <a href="${base}#/community">Cộng đồng</a> của site.</p>
</section>
</div>`,
  });
}

function sitemap(paths) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${esc(urlOf(p))}</loc></url>`).join("\n")}
</urlset>
`;
}

// Câu cùng chủ đề: ưu tiên cùng rank, rồi các rank khác; tối đa 6 câu.
function relatedOf(entry, entries) {
  const same = entries.filter((e) => e.item.id !== entry.item.id && e.item.topic === entry.item.topic);
  return [...same.filter((e) => e.item.rank === entry.item.rank), ...same.filter((e) => e.item.rank !== entry.item.rank)].slice(0, 6);
}

// Mọi file cần sinh: [{ path, content }]. path tính từ thư mục gốc của site.
export async function allPages() {
  const all = await loadAllTracks();
  const pages = [];
  for (const data of all) {
    const entries = [...data.allQuestions.map((item) => ({ item, kind: "question" })), ...data.allQuiz.map((item) => ({ item, kind: "quiz" }))];
    for (const kind of ["question", "quiz"]) {
      for (const r of RANKS) {
        const list = entries.filter((e) => e.kind === kind && e.item.rank === r.id);
        list.forEach((e, i) => {
          pages.push({ path: itemPath(e.item.id), content: itemPage(e, { prev: list[i - 1], next: list[i + 1], related: relatedOf(e, entries) }) });
        });
      }
    }
    pages.push({ path: trackPath(data.track.id) + "index.html", content: trackPage(data) });
    for (const r of RANKS) pages.push({ path: rankPath(data.track.id, r.id) + "index.html", content: rankPage(data, r.id) });
    for (const t of Object.keys(data.track.topics)) {
      if (data.allQuestions.some((q) => q.topic === t)) pages.push({ path: topicPath(data.track.id, t) + "index.html", content: topicPage(data, t) });
    }
  }
  pages.push({ path: "phong-van/index.html", content: hubPage(all) });
  pages.push({ path: "quyen-rieng-tu/index.html", content: privacyPage() });
  // Hub trước, câu lẻ sau: Google ưu tiên các URL đầu sitemap khi mới index.
  const order = (p) => (p.startsWith("phong-van/") ? 0 : 1);
  const listed = ["", ...pages.map((p) => p.path).sort((a, b) => order(a) - order(b))];
  pages.push({ path: "sitemap.xml", content: sitemap(listed) });
  return pages;
}

// Thư mục chỉ chứa trang sinh tự động: file .html không có trong allPages() sẽ bị xoá.
export const GENERATED_DIRS = ["s", "phong-van", "quyen-rieng-tu"];
