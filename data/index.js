// Gom toàn bộ dữ liệu: câu hỏi phỏng vấn (lộ trình + bổ sung) và câu quiz theo rank.
import { RANKS, TOPICS, getRank } from "./meta.js";
import { WEEKS, DAYS } from "./roadmap.js";

import fresherQuestions from "./questions/fresher.js";
import juniorQuestions from "./questions/junior.js";
import middleQuestions from "./questions/middle.js";
import seniorQuestions from "./questions/senior.js";

import fresherQuiz from "./quiz/fresher.js";
import juniorQuiz from "./quiz/junior.js";
import middleQuiz from "./quiz/middle.js";
import seniorQuiz from "./quiz/senior.js";

const EXTRA_QUESTIONS = {
  fresher: fresherQuestions,
  junior: juniorQuestions,
  middle: middleQuestions,
  senior: seniorQuestions,
};

const QUIZ = {
  fresher: fresherQuiz,
  junior: juniorQuiz,
  middle: middleQuiz,
  senior: seniorQuiz,
};

const roadmapQuestions = DAYS.flatMap((d) =>
  d.questions.map((q) => ({ ...q, day: d.day })),
);

const questionsByRank = {};
const quizByRank = {};
for (const r of RANKS) {
  questionsByRank[r.id] = [
    ...EXTRA_QUESTIONS[r.id].map((q) => ({ ...q, rank: r.id })),
    ...roadmapQuestions.filter((q) => q.rank === r.id),
  ];
  quizByRank[r.id] = QUIZ[r.id].map((q) => ({ ...q, rank: r.id }));
}

export { RANKS, TOPICS, WEEKS, DAYS, getRank };

export function questionsFor(rankId) {
  return questionsByRank[rankId] || [];
}

export function quizFor(rankId) {
  if (rankId === "all") return RANKS.flatMap((r) => quizByRank[r.id]);
  return quizByRank[rankId] || [];
}

export const ALL_QUESTIONS = RANKS.flatMap((r) => questionsByRank[r.id]);
export const ALL_QUIZ = RANKS.flatMap((r) => quizByRank[r.id]);

const byId = new Map([...ALL_QUESTIONS, ...ALL_QUIZ].map((q) => [q.id, q]));
const quizIds = new Set(ALL_QUIZ.map((q) => q.id));

// Tìm câu hỏi phỏng vấn hoặc câu quiz theo id. kind: "question" | "quiz".
export function findItem(id) {
  const item = byId.get(id);
  return item ? { item, kind: quizIds.has(id) ? "quiz" : "question" } : null;
}

// Người đóng góp (trường `by` trong dữ liệu), nhiều câu nhất đứng trước.
export function contributors() {
  const count = new Map();
  for (const q of [...ALL_QUESTIONS, ...ALL_QUIZ]) if (q.by) count.set(q.by, (count.get(q.by) || 0) + 1);
  return [...count].map(([login, n]) => ({ login, count: n })).sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}
