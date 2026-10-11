// Trang chia sẻ tĩnh cho từng câu hỏi: s/<id>.html.
// Facebook/Zalo không chạy JavaScript và bỏ qua phần #hash, nên mỗi câu cần một file
// HTML riêng chứa thẻ og:* (tiêu đề = nội dung câu hỏi). Người dùng mở link sẽ được
// chuyển ngay về #/q/<id>. Đáp án không nằm trong trang này.
import { ALL_QUESTIONS, ALL_QUIZ, getRank } from "../data/index.js";
import { SITE_URL } from "../js/config.js";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (s) => String(s).replace(/`/g, "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function sharePage(item, kind) {
  const rank = getRank(item.rank).name;
  const text = plain(item.q);
  const title = cut(`${kind === "quiz" ? "Quiz" : "Câu hỏi phỏng vấn"} Flutter ${rank}: ${text}`, 110);
  const desc =
    kind === "quiz"
      ? "Câu trắc nghiệm 4 đáp án — bạn chọn đúng không? Làm thử và xem giải thích chi tiết."
      : "Bạn trả lời được câu này không? Tự trả lời rồi xem đáp án mẫu, ôn thêm câu hỏi phỏng vấn Flutter theo rank.";
  const target = `../#/q/${encodeURIComponent(item.id)}`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Flutter Interview">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE_URL}s/${encodeURIComponent(item.id)}.html">
<meta property="og:image" content="${SITE_URL}assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px">
<p>${esc(text)}</p>
<p><a href="${esc(target)}">Mở câu hỏi trên Flutter Interview →</a></p>
</body>
</html>
`;
}

export function allSharePages() {
  return [
    ...ALL_QUESTIONS.map((q) => ({ id: q.id, html: sharePage(q, "question") })),
    ...ALL_QUIZ.map((q) => ({ id: q.id, html: sharePage(q, "quiz") })),
  ];
}
