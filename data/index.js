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
