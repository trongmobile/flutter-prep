// Thu thập số liệu cho agent marketing (báo cáo tuần, bài vinh danh bảng xếp hạng).
//   node scripts/mkt/stats.mjs                  mọi phần
//   node scripts/mkt/stats.mjs leaderboard      chỉ top 3 bảng xếp hạng tuần này
// In ra JSON. Phần nào lỗi (mất mạng, thiếu token) thì ghi { error } và chạy tiếp phần khác.
//   leaderboard  top 3 tuần này của mọi bảng (Supabase, key công khai trong js/config.js)
//   community    issue mới trên GitHub 7 ngày qua (API công khai; nên đặt GITHUB_TOKEN để khỏi hết lượt gọi)
//   traffic      lượt xem GoatCounter 7 ngày qua và 7 ngày trước đó (cần biến môi trường GOATCOUNTER_TOKEN)
//   coverage     số câu hỏi / quiz theo nền tảng × rank × chủ đề, kèm các ô ít câu nhất (gợi ý nội dung)
import { RANKS, loadAllTracks } from "../../data/index.js";
import { GITHUB_API, SITE_URL, SUPABASE_URL, SUPABASE_KEY } from "../../js/config.js";

const DAY = 24 * 60 * 60 * 1000;
const GOATCOUNTER = "https://interview.goatcounter.com/api/v0";
const BOARDS = [...RANKS.map((r) => ({ id: r.id, name: r.name })), { id: "all", name: "Tổng hợp" }];
const ymd = (t) => new Date(t).toISOString().slice(0, 10);

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

const safe = (fn) => fn().catch((err) => ({ error: String(err.message || err) }));
const all = await loadAllTracks();

async function leaderboard() {
  const headers = { "Content-Type": "application/json", apikey: SUPABASE_KEY };
  if (SUPABASE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const boards = [];
  for (const { track } of all) {
    for (const b of BOARDS) {
      const rows = await getJson(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/lb_board`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_track: track.id, p_rank: b.id, p_period: "week", p_player: null, p_limit: 3 }),
      });
      if (!rows.length) continue;
      boards.push({
        track: track.id,
        trackName: track.name,
        board: b.id,
        boardName: b.name,
        url: `${SITE_URL}#/${track.id}/leaderboard/${b.id}`,
        top: rows.map((r) => ({ pos: Number(r.pos), nickname: r.nickname, correct: r.correct, total: r.total, seconds: r.duration })),
      });
    }
  }
  // Tuần tính từ 0h thứ Hai giờ Việt Nam; bảng trống thì không liệt kê.
  return { note: "Chỉ liệt kê bảng có người thi tuần này", boards };
}

async function community() {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  // Không token thì giới hạn 60 request/giờ theo IP; máy cloud dùng chung IP nên hay hết lượt.
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "mobile-interview-mkt" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const issues = await getJson(`${GITHUB_API}/issues?state=all&since=${since}&per_page=100`, { headers });
  return issues
    .filter((i) => !i.pull_request && i.created_at >= since)
    .map((i) => ({ number: i.number, title: i.title, state: i.state, labels: i.labels.map((l) => l.name), url: i.html_url, created: i.created_at }));
}

async function traffic() {
  const token = process.env.GOATCOUNTER_TOKEN;
  if (!token) return { error: "Chưa có GOATCOUNTER_TOKEN nên bỏ qua lượt xem" };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const now = Date.now();
  const range = (from, to) => `start=${ymd(from)}&end=${ymd(to)}`;
  const thisWeek = range(now - 7 * DAY, now - DAY);
  const lastWeek = range(now - 14 * DAY, now - 8 * DAY);
  return {
    thisWeek: await getJson(`${GOATCOUNTER}/stats/total?${thisWeek}`, { headers }),
    lastWeek: await getJson(`${GOATCOUNTER}/stats/total?${lastWeek}`, { headers }),
    topPages: await getJson(`${GOATCOUNTER}/stats/hits?${thisWeek}&limit=10`, { headers }),
    topReferrers: await getJson(`${GOATCOUNTER}/stats/toprefs?${thisWeek}&limit=10`, { headers }),
  };
}

async function coverage() {
  const cells = [];
  for (const d of all) {
    for (const r of RANKS) {
      for (const [topic, topicName] of Object.entries(d.track.topics)) {
        cells.push({
          track: d.track.id,
          rank: r.id,
          topic,
          topicName,
          questions: d.questionsByRank[r.id].filter((q) => q.topic === topic).length,
          quiz: d.quizByRank[r.id].filter((q) => q.topic === topic).length,
        });
      }
    }
  }
  const totals = all.map((d) => ({ track: d.track.id, questions: d.allQuestions.length, quiz: d.allQuiz.length }));
  // Ô ít câu nhất: ứng viên để viết thêm câu hỏi và trang chủ đề cho SEO.
  const thinnest = [...cells].sort((a, b) => a.questions + a.quiz - (b.questions + b.quiz)).slice(0, 20);
  return { totals, thinnest };
}

const SECTIONS = { leaderboard, community, traffic, coverage };
const only = process.argv[2];
if (only && !SECTIONS[only]) {
  console.log(`Không có phần "${only}". Chọn: ${Object.keys(SECTIONS).join(", ")}`);
  process.exit(1);
}
const out = { generatedAt: new Date().toISOString() };
for (const [name, fn] of Object.entries(SECTIONS)) {
  if (!only || only === name) out[name] = await safe(fn);
}
console.log(JSON.stringify(out, null, 2));
