// Gom dữ liệu theo track. Mỗi track được tải riêng (dynamic import) khi cần để trang
// không phải tải ngân hàng câu hỏi của mọi nền tảng ngay từ đầu.
// Router gọi loadTrack() + setActiveTrack() trước khi mở view; các hàm đồng bộ bên dưới
// (questionsFor, quizFor…) đọc dữ liệu của track đang chọn.
import { RANKS, getRank } from "./meta.js";
import { TRACKS, DEFAULT_TRACK, LANGS, getTrack, trackOfId } from "./tracks.js";

export { RANKS, getRank, TRACKS, DEFAULT_TRACK, LANGS, getTrack, trackOfId };

const loaded = new Map(); // trackId -> dữ liệu đã dựng
const pending = new Map(); // trackId -> Promise đang tải
let active = null;

function build(track, mod) {
  const roadmapQuestions = mod.DAYS ? mod.DAYS.flatMap((d) => d.questions.map((q) => ({ ...q, day: d.day }))) : [];
  const questionsByRank = {};
  const quizByRank = {};
  for (const r of RANKS) {
    questionsByRank[r.id] = [
      ...mod.questions[r.id].map((q) => ({ ...q, rank: r.id, track: track.id })),
      ...roadmapQuestions.filter((q) => q.rank === r.id).map((q) => ({ ...q, track: track.id })),
    ];
    quizByRank[r.id] = mod.quiz[r.id].map((q) => ({ ...q, rank: r.id, track: track.id }));
  }
  const allQuestions = RANKS.flatMap((r) => questionsByRank[r.id]);
  const allQuiz = RANKS.flatMap((r) => quizByRank[r.id]);
  return {
    track,
    questionsByRank,
    quizByRank,
    allQuestions,
    allQuiz,
    quizIds: new Set(allQuiz.map((q) => q.id)),
    byId: new Map([...allQuestions, ...allQuiz].map((q) => [q.id, q])),
    roadmap: mod.DAYS ? { WEEKS: mod.WEEKS, DAYS: mod.DAYS } : null,
  };
}

export function loadTrack(id) {
  const track = getTrack(id) || getTrack(DEFAULT_TRACK);
  if (loaded.has(track.id)) return Promise.resolve(loaded.get(track.id));
  if (!pending.has(track.id)) {
    pending.set(
      track.id,
      import(`./${track.id}/index.js`).then((mod) => {
        const data = build(track, mod);
        loaded.set(track.id, data);
        pending.delete(track.id);
        return data;
      }),
    );
  }
  return pending.get(track.id);
}

export function loadAllTracks() {
  return Promise.all(TRACKS.map((t) => loadTrack(t.id)));
}

export function setActiveTrack(id) {
  active = loaded.get(id) || null;
}

// Track đang chọn (object trong TRACKS).
export function currentTrack() {
  return active ? active.track : getTrack(DEFAULT_TRACK);
}

export function questionsFor(rankId) {
  return (active && active.questionsByRank[rankId]) || [];
}

export function quizFor(rankId) {
  if (!active) return [];
  if (rankId === "all") return active.allQuiz;
  return active.quizByRank[rankId] || [];
}

export function allQuestions() {
  return active ? active.allQuestions : [];
}

export function allQuiz() {
  return active ? active.allQuiz : [];
}

// Lộ trình { WEEKS, DAYS } của track đang chọn, null nếu track chưa có lộ trình.
export function roadmap() {
  return active ? active.roadmap : null;
}

export function topics() {
  return currentTrack().topics;
}

export function topicName(topic, trackId) {
  const track = trackId ? getTrack(trackId) : currentTrack();
  return (track && track.topics[topic]) || topic;
}

// Mô tả rank theo track: "Cú pháp Kotlin, OOP với Java…".
export function rankDesc(rankId, trackId) {
  const track = trackId ? getTrack(trackId) : currentTrack();
  return (track && track.ranks[rankId]) || "";
}

// Tìm câu hỏi phỏng vấn hoặc câu quiz theo id trong các track đã tải. kind: "question" | "quiz".
export function findItem(id) {
  const data = loaded.get(trackOfId(id).id);
  const item = data && data.byId.get(id);
  return item ? { item, kind: data.quizIds.has(id) ? "quiz" : "question" } : null;
}

// Người đóng góp (trường `by` trong dữ liệu) của các track đã tải, nhiều câu nhất đứng trước.
export function contributors() {
  const count = new Map();
  for (const data of loaded.values()) {
    for (const q of [...data.allQuestions, ...data.allQuiz]) if (q.by) count.set(q.by, (count.get(q.by) || 0) + 1);
  }
  return [...count].map(([login, n]) => ({ login, count: n })).sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}
