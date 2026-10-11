// Kiểm tra schema của toàn bộ dữ liệu câu hỏi/quiz.
// Chạy: node scripts/validate.mjs            (tất cả rank)
//       node scripts/validate.mjs junior     (chỉ một rank)
import { RANKS, TOPICS } from "../data/meta.js";
import { DAYS } from "../data/roadmap.js";

const PREFIX = { fresher: "fre", junior: "jun", middle: "mid", senior: "sen" };
const QUESTION_KEYS = new Set(["id", "topic", "q", "a", "code"]);
const QUIZ_KEYS = new Set(["id", "topic", "q", "code", "options", "answer", "explain"]);
// Đáp án tham chiếu đáp án khác sẽ sai nghĩa khi app xáo trộn thứ tự.
const CROSS_REF = /(tất cả (các )?(đáp án|phương án|ý) trên|cả [A-D] và [A-D]|\b[A-D] và [A-D]\b|không (có )?(đáp án|phương án) nào|all of the above|none of the above|cả hai (đáp án|phương án))/i;

const only = process.argv[2];
const errors = [];
const warnings = [];
const seenIds = new Set();

const norm = (s) => s.toLowerCase().replace(/[`'"?.,:;!()\-–—]/g, "").replace(/\s+/g, " ").trim();
const seenText = new Map();
for (const d of DAYS) {
  for (const q of d.questions) {
    seenIds.add(q.id);
    seenText.set(norm(q.q), `roadmap ${q.id}`);
  }
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

function checkCommon(item, where, keys, prefix) {
  for (const k of Object.keys(item)) {
    if (!keys.has(k)) errors.push(`${where}: unknown key "${k}"`);
  }
  if (!isStr(item.id)) errors.push(`${where}: missing id`);
  else {
    if (seenIds.has(item.id)) errors.push(`${where}: duplicate id ${item.id}`);
    seenIds.add(item.id);
    if (!item.id.startsWith(prefix + "-")) errors.push(`${where}: id must start with "${prefix}-"`);
  }
  if (!(item.topic in TOPICS)) errors.push(`${where}: invalid topic "${item.topic}"`);
  if (!isStr(item.q)) errors.push(`${where}: missing q`);
  if (item.code !== undefined && !isStr(item.code)) errors.push(`${where}: code must be a non-empty string`);
  if (isStr(item.q)) {
    const t = norm(item.q);
    if (seenText.has(t)) warnings.push(`${where}: question duplicates ${seenText.get(t)}`);
    seenText.set(t, where);
  }
}

for (const rank of RANKS) {
  if (only && only !== rank.id) continue;
  const prefix = PREFIX[rank.id];

  const questions = (await import(`../data/questions/${rank.id}.js`)).default;
  if (!Array.isArray(questions)) {
    errors.push(`questions/${rank.id}.js: default export must be an array`);
  } else {
    questions.forEach((item, i) => {
      const where = `questions/${rank.id}.js[${i}]${item && item.id ? " " + item.id : ""}`;
      checkCommon(item, where, QUESTION_KEYS, prefix);
      if (!isStr(item.a)) errors.push(`${where}: missing a`);
    });
  }

  const quiz = (await import(`../data/quiz/${rank.id}.js`)).default;
  if (!Array.isArray(quiz)) {
    errors.push(`quiz/${rank.id}.js: default export must be an array`);
    continue;
  }
  const answerDist = [0, 0, 0, 0];
  let longestIsCorrect = 0;
  quiz.forEach((item, i) => {
    const where = `quiz/${rank.id}.js[${i}]${item && item.id ? " " + item.id : ""}`;
    checkCommon(item, where, QUIZ_KEYS, prefix);
    if (!Array.isArray(item.options) || item.options.length !== 4 || !item.options.every(isStr)) {
      errors.push(`${where}: options must be 4 non-empty strings`);
      return;
    }
    if (new Set(item.options.map(norm)).size !== 4) errors.push(`${where}: duplicate options`);
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) {
      errors.push(`${where}: answer must be an integer 0-3`);
      return;
    }
    if (!isStr(item.explain)) errors.push(`${where}: missing explain`);
    item.options.forEach((o) => {
      if (CROSS_REF.test(o)) errors.push(`${where}: option references other options (breaks shuffling): "${o}"`);
    });
    answerDist[item.answer]++;
    const lens = item.options.map((o) => o.length);
    if (lens[item.answer] === Math.max(...lens) && lens.filter((l) => l === lens[item.answer]).length === 1) {
      longestIsCorrect++;
    }
  });

  const topicCount = {};
  [...questions, ...quiz].forEach((x) => (topicCount[x.topic] = (topicCount[x.topic] || 0) + 1));
  const roadmapCount = DAYS.flatMap((d) => d.questions).filter((q) => q.rank === rank.id).length;
  console.log(
    `${rank.name.padEnd(8)} questions: ${questions.length} (+${roadmapCount} từ lộ trình) · quiz: ${quiz.length}` +
      ` · answer index dist: ${answerDist.join("/")}` +
      ` · longest option is correct: ${quiz.length ? Math.round((longestIsCorrect / quiz.length) * 100) : 0}%`,
  );
  console.log(`         topics: ${Object.entries(topicCount).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  if (quiz.length >= 10 && longestIsCorrect / quiz.length > 0.4) {
    warnings.push(`quiz/${rank.id}.js: correct answer is the longest option in ${longestIsCorrect}/${quiz.length} questions (aim < 40%)`);
  }
}

for (const w of warnings) console.log("WARN  " + w);
for (const e of errors) console.log("ERROR " + e);
if (errors.length) {
  console.log(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nOK${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
