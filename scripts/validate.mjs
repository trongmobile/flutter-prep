// Kiểm tra schema của toàn bộ dữ liệu câu hỏi/quiz.
// Chạy: node scripts/validate.mjs                  (mọi track + kiểm tra toàn site)
//       node scripts/validate.mjs android          (một track)
//       node scripts/validate.mjs android junior   (một rank của một track)
//       node scripts/validate.mjs junior           (một rank của Flutter)
import { RANKS } from "../data/meta.js";
import { TRACKS, LANGS, COMMON_KEYWORDS, getTrack } from "../data/tracks.js";

const PREFIX = { fresher: "fre", junior: "jun", middle: "mid", senior: "sen" };
const QUESTION_KEYS = new Set(["id", "topic", "q", "a", "code", "lang", "doc", "by", "issue"]);
const QUIZ_KEYS = new Set(["id", "topic", "q", "code", "lang", "options", "answer", "explain", "doc", "by", "issue"]);
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
// Đáp án tham chiếu đáp án khác sẽ sai nghĩa khi app xáo trộn thứ tự.
const CROSS_REF = /(tất cả (các )?(đáp án|phương án|ý) trên|cả [A-D] và [A-D]|\b[A-D] và [A-D]\b|không (có )?(đáp án|phương án) nào|all of the above|none of the above|cả hai (đáp án|phương án))/i;

const args = process.argv.slice(2);
const onlyTrack = getTrack(args[0]) ? args[0] : RANKS.some((r) => r.id === args[0]) ? "flutter" : null;
const onlyRank = getTrack(args[0]) ? args[1] : args[0];
if (args[0] && !onlyTrack) {
  console.log(`Không có track/rank "${args[0]}". Track: ${TRACKS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}
const errors = [];
const warnings = [];
const seenIds = new Set();

const norm = (s) => s.toLowerCase().replace(/[`'"?.,:;!()\-–—]/g, "").replace(/\s+/g, " ").trim();
let seenText = new Map();

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

function checkCommon(item, where, keys, prefix, track, kind) {
  for (const k of Object.keys(item)) {
    if (!keys.has(k)) errors.push(`${where}: unknown key "${k}"`);
  }
  if (!isStr(item.id)) errors.push(`${where}: missing id`);
  else {
    if (seenIds.has(item.id)) errors.push(`${where}: duplicate id ${item.id}`);
    seenIds.add(item.id);
    if (!item.id.startsWith(prefix + "-")) errors.push(`${where}: id must start with "${prefix}-"`);
    else if (track.idPrefix && !new RegExp(`^${prefix}-${kind}\\d{2}$`).test(item.id)) errors.push(`${where}: id must look like "${prefix}-${kind}01"`);
  }
  if (!(item.topic in track.topics)) errors.push(`${where}: invalid topic "${item.topic}" (track ${track.id}: ${Object.keys(track.topics).join(", ")})`);
  if (item.lang !== undefined && !LANGS.includes(item.lang)) errors.push(`${where}: lang must be one of ${LANGS.join(", ")}`);
  if (item.lang !== undefined && item.code === undefined) errors.push(`${where}: lang without code`);
  if (item.lang === track.lang) warnings.push(`${where}: lang "${item.lang}" is the track default, remove it`);
  if (!isStr(item.q)) errors.push(`${where}: missing q`);
  if (item.code !== undefined && !isStr(item.code)) errors.push(`${where}: code must be a non-empty string`);
  if (item.doc !== undefined) {
    let url = null;
    try {
      url = new URL(item.doc);
    } catch (e) {
      /* để báo lỗi bên dưới */
    }
    if (!url || url.protocol !== "https:") errors.push(`${where}: doc must be an https URL`);
  }
  if (item.by !== undefined && !(typeof item.by === "string" && GITHUB_LOGIN.test(item.by))) errors.push(`${where}: by must be a GitHub username`);
  if (item.issue !== undefined && !(Number.isInteger(item.issue) && item.issue > 0)) errors.push(`${where}: issue must be a positive integer`);
  if (item.issue !== undefined && item.by === undefined) errors.push(`${where}: issue requires by`);
  if (isStr(item.q)) {
    const t = norm(item.q);
    if (seenText.has(t)) warnings.push(`${where}: question duplicates ${seenText.get(t)}`);
    seenText.set(t, where);
  }
}

for (const track of TRACKS) {
  if (onlyTrack && onlyTrack !== track.id) continue;
  console.log(`== ${track.name}`);
  // Từ khoá nhận diện chủ đề trong JD (js/jd.js): key phải là topic của track hoặc của COMMON_KEYWORDS.
  for (const [topic, list] of Object.entries(track.keywords || {})) {
    if (!(topic in track.topics) && !(topic in COMMON_KEYWORDS)) errors.push(`data/tracks.js: ${track.id} keywords has unknown topic "${topic}"`);
    if (!Array.isArray(list) || !list.every(isStr)) errors.push(`data/tracks.js: ${track.id} keywords.${topic} must be an array of non-empty strings`);
  }
  for (const topic of Object.keys(track.topics)) {
    if (!(track.keywords && track.keywords[topic] && track.keywords[topic].length)) warnings.push(`data/tracks.js: ${track.id} topic "${topic}" has no JD keywords`);
  }
  seenText = new Map();
  const roadmapDays = track.id === "flutter" ? (await import("../data/flutter/roadmap.js")).DAYS : [];
  for (const d of roadmapDays) {
    for (const q of d.questions) {
      seenIds.add(q.id);
      seenText.set(norm(q.q), `roadmap ${q.id}`);
    }
  }
  for (const rank of RANKS) {
    if (onlyRank && onlyRank !== rank.id) continue;
    const prefix = (track.idPrefix ? track.idPrefix + "-" : "") + PREFIX[rank.id];
    const dir = `data/${track.id}`;

    const questions = (await import(`../${dir}/questions/${rank.id}.js`)).default;
    if (!Array.isArray(questions)) {
      errors.push(`${dir}/questions/${rank.id}.js: default export must be an array`);
    } else {
      questions.forEach((item, i) => {
        const where = `${dir}/questions/${rank.id}.js[${i}]${item && item.id ? " " + item.id : ""}`;
        checkCommon(item, where, QUESTION_KEYS, prefix, track, "q");
        if (!isStr(item.a)) errors.push(`${where}: missing a`);
      });
    }

    const quiz = (await import(`../${dir}/quiz/${rank.id}.js`)).default;
    if (!Array.isArray(quiz)) {
      errors.push(`${dir}/quiz/${rank.id}.js: default export must be an array`);
      continue;
    }
    const answerDist = [0, 0, 0, 0];
    let longestIsCorrect = 0;
    quiz.forEach((item, i) => {
      const where = `${dir}/quiz/${rank.id}.js[${i}]${item && item.id ? " " + item.id : ""}`;
      checkCommon(item, where, QUIZ_KEYS, prefix, track, "m");
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
    const roadmapCount = roadmapDays.flatMap((d) => d.questions).filter((q) => q.rank === rank.id).length;
    console.log(
      `${rank.name.padEnd(8)} questions: ${questions.length}${roadmapCount ? ` (+${roadmapCount} từ lộ trình)` : ""} · quiz: ${quiz.length}` +
        ` · answer index dist: ${answerDist.join("/")}` +
        ` · longest option is correct: ${quiz.length ? Math.round((longestIsCorrect / quiz.length) * 100) : 0}%`,
    );
    console.log(`         topics: ${Object.entries(topicCount).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    if (quiz.length >= 10 && longestIsCorrect / quiz.length > 0.4) {
      warnings.push(`${dir}/quiz/${rank.id}.js: correct answer is the longest option in ${longestIsCorrect}/${quiz.length} questions (aim < 40%)`);
    }
    if (quiz.length >= 8 && Math.max(...answerDist) - Math.min(...answerDist) > 2) {
      warnings.push(`${dir}/quiz/${rank.id}.js: answer index distribution ${answerDist.join("/")} is uneven (aim for equal counts)`);
    }
  }
}

// ---- Toàn site (bỏ qua khi chỉ kiểm tra một rank) ----
if (!args.length) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const walk = (dir) =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );

  // sw.js phải precache đủ code + dữ liệu để học offline, và mọi file trong danh sách phải tồn tại.
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const precache = JSON.parse(
    sw
      .match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]
      .replace(/,\s*\]/, "]"),
  );
  const needed = [...walk("js"), ...walk("data"), "css/styles.css", "index.html", "manifest.webmanifest"].filter((f) => /\.(js|css|html|webmanifest)$/.test(f));
  for (const f of needed) if (!precache.includes(f)) errors.push(`sw.js: PRECACHE is missing "${f}" (offline would break)`);
  for (const f of precache) if (f !== "./" && !fs.existsSync(path.join(root, f))) errors.push(`sw.js: PRECACHE lists missing file "${f}"`);

  // Trang tĩnh (s/, phong-van/, sitemap.xml) phải khớp dữ liệu hiện tại.
  const { allPages, GENERATED_DIRS } = await import("./pages.mjs");
  const pages = await allPages();
  const wanted = new Set(pages.map((p) => p.path));
  let stale = 0;
  for (const p of pages) {
    const file = path.join(root, p.path);
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== p.content) stale++;
  }
  const extra = GENERATED_DIRS.flatMap((d) => (fs.existsSync(path.join(root, d)) ? walk(d) : [])).filter((f) => f.endsWith(".html") && !wanted.has(f)).length;
  for (const t of TRACKS) {
    if (!fs.existsSync(path.join(root, "assets", `og-${t.id}.png`))) errors.push(`assets/og-${t.id}.png: thiếu ảnh preview cho trang chia sẻ của track ${t.name}`);
  }
  if (stale || extra) errors.push(`Trang tĩnh: ${stale} trang cũ/thiếu, ${extra} trang thừa — chạy: node scripts/build-pages.mjs`);
  else console.log(`Static pages: ${pages.length} OK · sw.js precache: ${precache.length} files OK`);
}

for (const w of warnings) console.log("WARN  " + w);
for (const e of errors) console.log("ERROR " + e);
if (errors.length) {
  console.log(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nOK${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
