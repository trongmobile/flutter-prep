// Trang tĩnh cho Google và mạng xã hội. Site chính dùng #hash nên Google chỉ thấy trang chủ,
// còn Facebook/Zalo không chạy JavaScript; các trang dưới đây có sẵn nội dung trong HTML:
//   s/<id>.html                          từng câu hỏi / câu quiz (cũng là link chia sẻ)
//   phong-van/                           mọi nền tảng
//   phong-van/<track>/                   một nền tảng: các rank, các chủ đề
//   phong-van/<track>/<rank>/            toàn bộ câu hỏi của một rank kèm đáp án
//   phong-van/<track>/chu-de/<topic>/    câu hỏi theo chủ đề
//   sitemap.xml                          danh sách trang gửi cho Google Search Console
// Đáp án nằm trong <details> (bấm để xem) để người đọc tự trả lời trước; Google vẫn đọc được.
import { RANKS, TRACKS, getRank, getTrack, loadAllTracks } from "../data/index.js";
import { SITE_URL } from "../js/config.js";
import { escapeHtml as esc, fmt, codeOf } from "../js/utils.js";

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
  <p><a href="${base}phong-van/">Câu hỏi phỏng vấn</a> · <a href="${base}#/">Ôn luyện miễn phí</a> · <a href="${base}#/community">Cộng đồng &amp; góp ý</a></p>
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
      ${credit(item, base)}
    </details>`;
  }
  return `<details class="reveal">
      <summary>Xem đáp án mẫu</summary>
      <div class="model-answer">
        <div class="answer-text">${fmt(item.a)}</div>
        ${codeOf(item)}
        ${credit(item, base)}
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
  // Hub trước, câu lẻ sau: Google ưu tiên các URL đầu sitemap khi mới index.
  const order = (p) => (p.startsWith("phong-van/") ? 0 : 1);
  const listed = ["", ...pages.map((p) => p.path).sort((a, b) => order(a) - order(b))];
  pages.push({ path: "sitemap.xml", content: sitemap(listed) });
  return pages;
}

// Thư mục chỉ chứa trang sinh tự động: file .html không có trong allPages() sẽ bị xoá.
export const GENERATED_DIRS = ["s", "phong-van"];
