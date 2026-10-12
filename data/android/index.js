// Dữ liệu track android: câu hỏi phỏng vấn và quiz theo rank.
import fresherQuestions from "./questions/fresher.js";
import juniorQuestions from "./questions/junior.js";
import middleQuestions from "./questions/middle.js";
import seniorQuestions from "./questions/senior.js";
import fresherQuiz from "./quiz/fresher.js";
import juniorQuiz from "./quiz/junior.js";
import middleQuiz from "./quiz/middle.js";
import seniorQuiz from "./quiz/senior.js";

export const questions = { fresher: fresherQuestions, junior: juniorQuestions, middle: middleQuestions, senior: seniorQuestions };
export const quiz = { fresher: fresherQuiz, junior: juniorQuiz, middle: middleQuiz, senior: seniorQuiz };
