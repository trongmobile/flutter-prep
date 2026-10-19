// Chọn "câu của ngày" để agent marketing đăng lên mạng xã hội.
//   node scripts/mkt/pick.mjs                 câu của hôm nay (giờ Việt Nam)
//   node scripts/mkt/pick.mjs 2026-12-24      câu của một ngày cụ thể
//   node scripts/mkt/pick.mjs --next 7        7 câu tiếp theo (xem trước lịch đăng)
//   thêm --video                              lịch riêng cho video Reels/TikTok, khác câu đăng X/Threads cùng ngày
// Thứ tự cố định theo hash của id nên không cần lưu trạng thái: mỗi ngày một câu khác,
// hết vòng mới lặp lại. Thêm câu mới chỉ chèn vào giữa, phần lớn thứ tự cũ giữ nguyên.
import { createHash } from "node:crypto";
import { getRank, loadAllTracks } from "../../data/index.js";
import { SITE_URL } from "../../js/config.js";

const START = Date.UTC(2026, 9, 19); // ngày đầu tiên agent đăng bài
const DAY = 24 * 60 * 60 * 1000;
const LETTERS = ["A", "B", "C", "D"];

// Ngày hiện tại theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD.
const todayVN = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const args = process.argv.slice(2);
const video = args.includes("--video");
// Video dùng thứ tự riêng (thêm tiền tố vào hash) để không trùng câu với bài viết cùng ngày.
const hash = (id) => createHash("sha1").update((video ? "video:" : "") + id).digest("hex");

const all = await loadAllTracks();
const items = all
  .flatMap((d) => [
    ...d.allQuestions.map((q) => ({ ...q, kind: "question", trackData: d })),
    ...d.allQuiz.map((q) => ({ ...q, kind: "quiz", trackData: d })),
  ])
  .sort((a, b) => (hash(a.id) < hash(b.id) ? -1 : 1));

function itemFor(date) {
  const n = Math.floor((Date.parse(date + "T00:00:00Z") - START) / DAY);
  const q = items[((n % items.length) + items.length) % items.length];
  const { track } = q.trackData;
  const out = {
    date,
    id: q.id,
    kind: q.kind,
    track: track.id,
    trackName: track.name,
    rank: q.rank,
    rankName: getRank(q.rank).name,
    topic: q.topic,
    topicName: track.topics[q.topic] || q.topic,
    question: q.q,
    code: q.code || null,
    url: `${SITE_URL}s/${encodeURIComponent(q.id)}.html`,
    leaderboardUrl: `${SITE_URL}#/${track.id}/leaderboard/${q.rank}`,
  };
  if (q.kind === "question") out.answer = q.a;
  else {
    out.options = q.options.map((o, i) => `${LETTERS[i]}. ${o}`);
    out.correct = LETTERS[q.answer];
    out.explain = q.explain;
  }
  if (q.by) out.contributor = q.by;
  return out;
}

const rest = args.filter((a) => a !== "--video");
if (rest[0] === "--next") {
  const count = Number(rest[1]) || 7;
  const base = Date.parse(todayVN() + "T00:00:00Z");
  const list = Array.from({ length: count }, (_, i) => itemFor(new Date(base + i * DAY).toISOString().slice(0, 10)));
  console.log(JSON.stringify(list.map(({ date, id, kind, trackName, rankName, topicName, question }) => ({ date, id, kind, trackName, rankName, topicName, question })), null, 2));
} else {
  console.log(JSON.stringify({ total: items.length, ...itemFor(rest[0] || todayVN()) }, null, 2));
}
