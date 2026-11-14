// Sinh thêm câu hỏi phỏng vấn và câu quiz bằng Gemini API (free tier), ghi vào data/<track>/{questions,quiz}/<rank>.js.
// Workflow .github/workflows/generate-questions.yml chạy script này mỗi thứ Bảy rồi mở pull request để duyệt.
// Mỗi lô (một track × một rank) gọi API 2 lượt: viết câu mới, rồi thẩm định độc lập (tự giải quiz khi không
// thấy đáp án, soát lỗi kỹ thuật trong đáp án mẫu). Câu không qua thẩm định bị loại, không ghi vào file.
// Chạy: GEMINI_API_KEY=... node scripts/generate.mjs        mọi track, rank xoay vòng theo tuần, 3 câu hỏi + 3 quiz mỗi track
//       node scripts/generate.mjs --track android --rank senior --questions 5 --quiz 5
//       node scripts/generate.mjs --rank all                 cả 4 rank (32 request, dễ vượt quota ngày của free tier)
//       node scripts/generate.mjs --dry-run                  chỉ in prompt, không gọi API, không ghi file
// Xong thì chạy: node scripts/build-pages.mjs && node scripts/validate.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { RANKS, TRACKS, LANGS, getRank, getTrack, loadTrack } from "../data/index.js";
import { PREFIX, CROSS_REF, norm } from "./schema.mjs";

// Model phải có free tier (bảng giá: https://ai.google.dev/gemini-api/docs/pricing). Giới hạn request của project
// xem tại https://aistudio.google.com/rate-limit; nếu model này không đủ quota thì đổi bằng biến GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_ATTEMPTS = 5; // số lần gọi tối đa cho một request khi gặp 429/5xx
const MAX_PER_BATCH = 10; // nhiều hơn thì câu dễ trùng ý nhau và khó duyệt
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { values: opt } = parseArgs({
  options: {
    track: { type: "string", default: "all" },
    rank: { type: "string", default: "auto" },
    questions: { type: "string", default: "3" },
    quiz: { type: "string", default: "3" },
    summary: { type: "string" }, // file markdown tóm tắt (workflow dùng làm nội dung pull request)
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

const tracks = opt.track === "all" ? TRACKS : [getTrack(opt.track)];
if (!tracks[0]) fail(`Không có track "${opt.track}". Track: all, ${TRACKS.map((t) => t.id).join(", ")}`);
// "auto": mỗi tuần một rank, lần lượt fresher → junior → middle → senior.
const ranks = opt.rank === "auto" ? [RANKS[Math.floor(Date.now() / 6048e5) % RANKS.length]] : opt.rank === "all" ? RANKS : [getRank(opt.rank)];
if (!ranks[0]) fail(`Không có rank "${opt.rank}". Rank: auto, all, ${RANKS.map((r) => r.id).join(", ")}`);
const want = { questions: Number(opt.questions), quiz: Number(opt.quiz) };
for (const [kind, n] of Object.entries(want)) {
  if (!Number.isInteger(n) || n < 0 || n > MAX_PER_BATCH) fail(`--${kind} phải là số nguyên từ 0 đến ${MAX_PER_BATCH}`);
}
if (!want.questions && !want.quiz) fail("Cần ít nhất một trong --questions, --quiz lớn hơn 0");
if (!opt["dry-run"] && !process.env.GEMINI_API_KEY) fail("Thiếu biến môi trường GEMINI_API_KEY. Tạo key miễn phí tại https://aistudio.google.com/apikey");

// ---- Prompt ----

const WRITER = `Bạn biên soạn nội dung cho "Mobile Interview", trang ôn phỏng vấn lập trình mobile bằng tiếng Việt (Flutter, Android, iOS, React Native; rank Fresher → Senior). Mỗi tuần bạn viết thêm vài câu hỏi phỏng vấn và câu quiz trắc nghiệm cho ngân hàng câu hỏi.

Nội dung được đăng công khai làm đáp án mẫu cho người đi phỏng vấn, nên độ chính xác kỹ thuật quan trọng hơn sự mới lạ. Chỉ viết điều bạn chắc chắn đúng với phiên bản hiện hành của nền tảng. Nếu chưa chắc về một chi tiết (tên API, con số, hành vi theo phiên bản) thì bỏ chi tiết đó hoặc chọn đề tài khác.

Câu hỏi phỏng vấn (\`questions\`):
- \`q\`: câu mà người phỏng vấn thật sẽ hỏi ở rank đó. Tình huống cụ thể, "vì sao", so sánh đánh đổi thường tốt hơn hỏi định nghĩa.
- \`a\`: đáp án mẫu viết thành một đoạn văn liền mạch như ứng viên giỏi trả lời, không gạch đầu dòng, không markdown. Độ dài và độ sâu tương đương các ví dụ của rank.
- \`code\`: đoạn code ngắn minh hoạ cho đáp án khi nó giúp dễ hiểu hơn; chuỗi rỗng nếu không cần.

Câu quiz (\`quiz\`):
- \`options\`: đúng 4 đáp án, chỉ một đáp án đúng và không gây tranh cãi. Ba đáp án sai là những nhầm lẫn thường gặp, nghe hợp lý với người chưa nắm chắc.
- Bốn đáp án dài tương đương nhau; đáp án đúng không được lộ ra vì dài hơn hay chi tiết hơn.
- App xáo trộn thứ tự đáp án khi hiển thị, nên đáp án và lời giải thích không được nhắc tới vị trí hay chữ cái của đáp án khác ("Cả A và B", "Tất cả các đáp án trên", "đáp án đầu tiên").
- \`answer\`: index (0-3) của đáp án đúng trong \`options\`.
- \`explain\`: vì sao đáp án đó đúng và vì sao các đáp án dễ nhầm lại sai.
- \`code\`: đoạn code mà câu hỏi nhắc tới (dạng "đoạn code này in ra gì", "lỗi nằm ở đâu"); chuỗi rỗng nếu không cần.

Chung cho cả hai loại:
- Tiếng Việt tự nhiên, thuật ngữ kỹ thuật giữ tiếng Anh như trong các ví dụ. Dùng \`backtick\` cho code inline.
- \`topic\`: key chủ đề của nền tảng, đúng với nội dung chính của câu.
- \`lang\`: chỉ điền khi \`code\` viết bằng ngôn ngữ khác ngôn ngữ mặc định của nền tảng; còn lại để chuỗi rỗng.
- \`doc\`: link https tới trang tài liệu chính thức nói đúng nội dung của câu, chỉ điền khi bạn chắc chắn URL đó tồn tại; không chắc thì để chuỗi rỗng.
- Đúng độ khó của rank được yêu cầu, không dễ hơn cũng không khó hơn.
- Không trùng ý với câu đã có trong ngân hàng (kể cả khi diễn đạt khác), và các câu trong cùng một lô không trùng ý nhau.`;

const REVIEWER = `Bạn là người thẩm định kỹ thuật độc lập cho ngân hàng câu hỏi của "Mobile Interview", trang ôn phỏng vấn lập trình mobile bằng tiếng Việt. Các câu dưới đây do người khác soạn và sẽ được đăng công khai làm tài liệu ôn tập. Một câu sai kỹ thuật gây hại nhiều hơn việc thiếu một câu, nên khi còn nghi ngờ thì loại.

Với mỗi câu quiz, bạn chỉ thấy câu hỏi và 4 đáp án, không thấy đáp án đúng. Hãy tự giải và trả về \`answer\` là index (0-3) của đáp án đúng duy nhất. Trả về -1 nếu không đáp án nào đúng hoàn toàn, nếu có hơn một đáp án chấp nhận được, hoặc nếu câu hỏi mơ hồ (ví dụ kết quả phụ thuộc phiên bản mà đề không nói rõ).

Với mỗi câu hỏi phỏng vấn, bạn thấy cả đáp án mẫu. Đặt \`ok\` là false khi đáp án có lỗi kỹ thuật: khẳng định sai, API hoặc tham số không tồn tại, code không biên dịch được hoặc không chạy như mô tả, thông tin đã lỗi thời. Văn phong, hay việc đáp án có thể viết chi tiết hơn, không phải lý do để loại.

\`reason\`: một câu ngắn nêu lý do khi loại; chuỗi rỗng khi câu đạt. Trả về đủ một kết quả cho mỗi \`index\` trong đầu vào.`;

const oneLine = (s) => s.replace(/\s+/g, " ").trim();
// Câu trong ngân hàng -> đúng dạng model phải trả về (trường không có là chuỗi rỗng).
const asOutput = (x, kind) => ({
  topic: x.topic,
  q: x.q,
  ...(kind === "questions" ? { a: x.a } : {}),
  code: x.code || "",
  lang: x.lang || "",
  ...(kind === "quiz" ? { options: x.options, answer: x.answer, explain: x.explain } : {}),
  doc: x.doc || "",
});

function writerPrompt(track, rank, data) {
  const questions = data.questionsByRank[rank.id];
  const quiz = data.quizByRank[rank.id];
  const count = {};
  for (const x of [...questions, ...quiz]) count[x.topic] = (count[x.topic] || 0) + 1;
  const examples = {
    questions: questions.filter((x) => !x.day).slice(-2).map((x) => asOutput(x, "questions")),
    quiz: quiz.slice(-2).map((x) => asOutput(x, "quiz")),
  };
  const existing = RANKS.map((r) =>
    [
      `## ${r.name}`,
      ...data.questionsByRank[r.id].map((x) => `- [câu hỏi] ${oneLine(x.q)}`),
      ...data.quizByRank[r.id].map((x) => `- [quiz] ${oneLine(x.q)}`),
    ].join("\n"),
  ).join("\n\n");
  const ask = [want.questions && `${want.questions} câu hỏi phỏng vấn`, want.quiz && `${want.quiz} câu quiz`].filter(Boolean).join(" và ");

  return `Nền tảng: ${track.name} (ngôn ngữ code mặc định: ${track.lang}; giá trị \`lang\` khác được phép: ${LANGS.filter((l) => l !== track.lang).join(", ")})
Rank cần viết: ${rank.name} (${rank.years} kinh nghiệm)

Phạm vi kiến thức từng rank của nền tảng này, để căn độ khó:
${RANKS.map((r) => `- ${r.name} (${r.years}): ${track.ranks[r.id]}`).join("\n")}

Chủ đề (key: tên, số câu rank ${rank.name} đang có):
${Object.entries(track.topics).map(([key, name]) => `- ${key}: ${name}, ${count[key] || 0} câu`).join("\n")}
Chọn chủ đề hợp với rank ${rank.name}. Trong các chủ đề hợp, ưu tiên chủ đề đang ít câu và đừng dồn cả lô vào một chủ đề.

Hãy viết ${ask} mới cho rank ${rank.name}.${want.questions ? "" : " Trả về mảng `questions` rỗng."}${want.quiz ? "" : " Trả về mảng `quiz` rỗng."}

Ví dụ lấy từ ngân hàng của rank này, cho thấy giọng văn, độ dài và độ sâu cần có:
<examples>
${JSON.stringify(examples, null, 2)}
</examples>

Toàn bộ câu đã có của ${track.name}. Câu mới không được trùng ý với bất kỳ câu nào dưới đây, kể cả câu của rank khác:
<existing>
${existing}
</existing>`;
}

function reviewerPrompt(track, rank, cand) {
  const input = {
    questions: cand.questions.map((x, index) => ({ index, q: x.q, a: x.a, code: x.code || "" })),
    quiz: cand.quiz.map((x, index) => ({ index, q: x.q, code: x.code || "", options: x.options })),
  };
  return `Nền tảng: ${track.name} (ngôn ngữ code mặc định: ${track.lang})
Rank: ${rank.name} (${rank.years} kinh nghiệm)

<items>
${JSON.stringify(input, null, 2)}
</items>`;
}

// ---- Schema của kết quả (structured output). Những ràng buộc schema không diễn đạt được thì clean() và problem() kiểm tra lại. ----

const str = { type: "string" };
const int = { type: "integer" };
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const list = (properties) => ({ type: "array", items: obj(properties) });

function writerSchema(track) {
  const head = { topic: { type: "string", enum: Object.keys(track.topics) }, q: str };
  return obj({
    questions: list({ ...head, a: str, code: str, lang: str, doc: str }),
    quiz: list({ ...head, code: str, lang: str, options: { type: "array", items: str }, answer: int, explain: str, doc: str }),
  });
}

const REVIEW_SCHEMA = obj({
  questions: list({ index: int, ok: { type: "boolean" }, reason: str }),
  quiz: list({ index: int, answer: int, reason: str }),
});

// ---- Gemini API ----

// fatal: lô nào cũng sẽ hỏng theo (key sai, request sai, hết quota ngày) nên dừng cả lần chạy thay vì sang lô kế tiếp.
class GeminiError extends Error {
  constructor(message, fatal = false) {
    super(message);
    this.fatal = fatal;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const usage = { input: 0, output: 0 };

// Gọi generateContent với kết quả ép theo JSON schema. 429 (vượt giới hạn mỗi phút) và 5xx thì chờ rồi gọi lại.
async function askGemini(system, prompt, schema) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
  });
  for (let attempt = 1; ; attempt++) {
    let res = null;
    let error;
    let wait = 2 ** attempt * 1000 + Math.random() * 1000; // 2s, 4s, 8s, 16s
    try {
      res = await fetch(`${API}/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
        body,
      });
    } catch (e) {
      error = new GeminiError(`không kết nối được Gemini API: ${e.cause?.message || e.message}`);
    }
    if (res?.ok) return readReply(await res.json());
    if (res) {
      const { error: err = {} } = await res.json().catch(() => ({}));
      const details = Array.isArray(err.details) ? err.details : [];
      // Hết quota theo ngày thì chờ vài giây cũng không được: dừng hẳn. Quota reset lúc nửa đêm giờ Pacific.
      const daily = details.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId || "")));
      const retryable = (res.status === 429 && !daily) || res.status === 408 || res.status >= 500;
      error = new GeminiError(`Gemini API lỗi ${res.status}${err.status ? ` ${err.status}` : ""}: ${err.message || res.statusText}${daily ? " (hết quota ngày của free tier)" : ""}`, !retryable);
      if (!retryable) throw error;
      const retryDelay = parseFloat(details.find((d) => d.retryDelay)?.retryDelay); // API gợi ý thời gian chờ, dạng "34s"
      if (retryDelay) wait = Math.min(retryDelay * 1000 + 1000, 120000);
    }
    if (attempt === MAX_ATTEMPTS) throw error;
    console.log(`  ${cut(error.message, 200).replace(/\.$/, "")}. Thử lại sau ${Math.round(wait / 1000)}s…`);
    await sleep(wait);
  }
}

function readReply(data) {
  const meta = data.usageMetadata || {};
  usage.input += meta.promptTokenCount || 0;
  usage.output += (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0);
  if (data.promptFeedback?.blockReason) throw new GeminiError(`Gemini chặn prompt (${data.promptFeedback.blockReason})`);
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw new GeminiError(`Gemini dừng với finishReason "${candidate?.finishReason || "không có kết quả"}"`);
  const text = (candidate.content?.parts || []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new GeminiError("Gemini trả về JSON không hợp lệ");
  }
}

// ---- Kiểm tra và ghi file ----

const text = (v) => (typeof v === "string" ? v.trim() : "");

// Kết quả của model -> đúng dạng lưu trong data/ (bỏ trường rỗng, giữ thứ tự key như các câu có sẵn).
function clean(raw, kind, track) {
  const code = text(raw.code) ? raw.code.replace(/\s+$/, "") : null;
  const lang = LANGS.includes(raw.lang) && raw.lang !== track.lang ? raw.lang : null;
  return {
    topic: raw.topic,
    q: text(raw.q),
    ...(kind === "questions" ? { a: text(raw.a) } : {}),
    ...(code ? { code } : {}),
    ...(code && lang ? { lang } : {}),
    ...(kind === "quiz" ? { options: Array.isArray(raw.options) ? raw.options.map(text) : [], answer: raw.answer, explain: text(raw.explain) } : {}),
    ...(text(raw.doc) ? { doc: text(raw.doc) } : {}),
  };
}

// Lý do loại theo các luật của scripts/validate.mjs; null nếu câu hợp lệ. seen: câu hỏi đã có của track (đã chuẩn hoá).
function problem(item, kind, track, seen) {
  if (!(item.topic in track.topics)) return `chủ đề "${item.topic}" không có trong track`;
  if (!item.q) return "thiếu câu hỏi";
  if (seen.has(norm(item.q))) return "trùng câu đã có";
  if (kind === "questions") return item.a ? null : "thiếu đáp án";
  if (item.options.length !== 4 || item.options.some((o) => !o)) return "không đủ 4 đáp án";
  if (new Set(item.options.map(norm)).size !== 4) return "có đáp án trùng nhau";
  if (item.options.some((o) => CROSS_REF.test(o))) return "đáp án nhắc tới đáp án khác (hỏng khi xáo trộn)";
  if (![0, 1, 2, 3].includes(item.answer)) return "answer phải là 0-3";
  if (!item.explain) return "thiếu giải thích";
  return null;
}

// Link tài liệu phải mở được; không thì bỏ link, vẫn giữ câu.
async function docWorks(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; link-check)" }, signal: AbortSignal.timeout(15000) });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

// Đưa đáp án đúng về vị trí đang ít được dùng nhất để phân bố index đáp án trong file luôn đều.
function balanceAnswer(item, dist) {
  const target = dist.indexOf(Math.min(...dist));
  const correct = item.options[item.answer];
  const options = item.options.filter((_, i) => i !== item.answer);
  options.splice(target, 0, correct);
  dist[target]++;
  return { ...item, options, answer: target };
}

function serialize(item) {
  const lines = Object.entries(item).flatMap(([key, value]) =>
    Array.isArray(value) ? [`    ${key}: [`, ...value.map((v) => `      ${JSON.stringify(v)},`), "    ],"] : [`    ${key}: ${JSON.stringify(value)},`],
  );
  return `  {\n${lines.join("\n")}\n  },\n`;
}

function appendTo(file, items) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  const end = src.lastIndexOf("];");
  if (end === -1 || src.slice(end + 2).trim()) throw new Error(`${file}: không tìm thấy "];" ở cuối file`);
  fs.writeFileSync(path.join(root, file), src.slice(0, end) + items.map(serialize).join("") + "];\n");
}

// Hàm tạo id kế tiếp: "and-sen-q51", "and-sen-q52"…
function idMaker(items, prefix, kind) {
  const re = new RegExp(`^${prefix}-${kind}(\\d+)$`);
  let last = Math.max(0, ...items.map((x) => Number(re.exec(x.id)?.[1] || 0)));
  return () => `${prefix}-${kind}${String(++last).padStart(2, "0")}`;
}

// Sinh, thẩm định và ghi một lô. Trả về { added: { questions, quiz }, dropped: [{ kind, q, reason }] }.
async function generateBatch(track, rank, data, seen) {
  const bank = { questions: data.questionsByRank[rank.id], quiz: data.quizByRank[rank.id] };
  const dropped = [];
  const drop = (kind, item, reason) => dropped.push({ kind, q: item.q || "(không có câu hỏi)", reason });

  const draft = await askGemini(WRITER, writerPrompt(track, rank, data), writerSchema(track));
  const cand = { questions: [], quiz: [] };
  const batchSeen = new Set(seen);
  for (const kind of ["questions", "quiz"]) {
    const drafted = Array.isArray(draft?.[kind]) ? draft[kind] : [];
    for (const raw of drafted.slice(0, want[kind])) {
      const item = clean(raw || {}, kind, track);
      const reason = problem(item, kind, track, batchSeen);
      if (reason) drop(kind, item, reason);
      else {
        cand[kind].push(item);
        batchSeen.add(norm(item.q));
      }
    }
  }

  const kept = { questions: [], quiz: [] };
  if (cand.questions.length || cand.quiz.length) {
    const verdict = await askGemini(REVIEWER, reviewerPrompt(track, rank, cand), REVIEW_SCHEMA);
    const verdictOf = (kind, i) => (Array.isArray(verdict?.[kind]) ? verdict[kind] : []).find((v) => v?.index === i);
    cand.questions.forEach((item, i) => {
      const v = verdictOf("questions", i);
      if (v?.ok === true) kept.questions.push(item);
      else drop("questions", item, `thẩm định: ${text(v?.reason) || "không có kết quả thẩm định"}`);
    });
    cand.quiz.forEach((item, i) => {
      const v = verdictOf("quiz", i);
      if (v?.answer === item.answer) kept.quiz.push(item);
      else drop("quiz", item, `thẩm định: ${text(v?.reason) || (v ? `tự giải ra đáp án khác (${item.options[v.answer] ?? "không có đáp án đúng duy nhất"})` : "không có kết quả thẩm định")}`);
    });
  }

  for (const item of [...kept.questions, ...kept.quiz]) {
    if (item.doc && !(await docWorks(item.doc))) delete item.doc;
  }

  const prefix = (track.idPrefix ? track.idPrefix + "-" : "") + PREFIX[rank.id];
  const dist = [0, 1, 2, 3].map((i) => bank.quiz.filter((x) => x.answer === i).length);
  const nextQ = idMaker(bank.questions, prefix, "q");
  const nextM = idMaker(bank.quiz, prefix, "m");
  const added = {
    questions: kept.questions.map((item) => ({ id: nextQ(), ...item })),
    quiz: kept.quiz.map((item) => ({ id: nextM(), ...balanceAnswer(item, dist) })),
  };
  for (const kind of ["questions", "quiz"]) {
    if (!added[kind].length) continue;
    appendTo(`data/${track.id}/${kind}/${rank.id}.js`, added[kind]);
    bank[kind].push(...added[kind]); // lô sau (--rank all) thấy câu vừa thêm
    for (const item of added[kind]) seen.add(norm(item.q));
  }
  return { added, dropped };
}

// ---- Chạy ----

function cut(s, n = 160) {
  const line = oneLine(s);
  return line.length > n ? line.slice(0, n - 1) + "…" : line;
}
const KIND = { questions: "câu hỏi", quiz: "quiz" };
const total = { questions: 0, quiz: 0 };
const sections = [];
const failures = [];

async function main() {
  run: for (const track of tracks) {
    const data = await loadTrack(track.id);
    const seen = new Set([...data.allQuestions, ...data.allQuiz].map((x) => norm(x.q)));
    for (const rank of ranks) {
      const label = `${track.name} · ${rank.name}`;
      if (opt["dry-run"]) {
        console.log(`\n===== ${label} =====\n${writerPrompt(track, rank, data)}`);
        continue;
      }
      console.log(`${label}: đang sinh…`);
      try {
        const { added, dropped } = await generateBatch(track, rank, data, seen);
        total.questions += added.questions.length;
        total.quiz += added.quiz.length;
        console.log(`${label}: +${added.questions.length} câu hỏi, +${added.quiz.length} quiz${dropped.length ? `, loại ${dropped.length}` : ""}`);
        sections.push(
          [
            `## ${label}`,
            ...[...added.questions, ...added.quiz].map((x) => `- \`${x.id}\` (${x.topic}) ${cut(x.q)}`),
            ...(dropped.length ? ["", "Đã loại:", ...dropped.map((d) => `- ${KIND[d.kind]} "${cut(d.q, 100)}": ${cut(d.reason, 300)}`)] : []),
          ].join("\n"),
        );
      } catch (e) {
        console.error(`${label}: ${e instanceof GeminiError ? e.message : e.stack}`);
        failures.push(`- ${label}: ${cut(e.message, 300)}`);
        if (e.fatal) break run; // key sai, request sai, hết quota ngày: các lô sau cũng hỏng
      }
    }
  }
  if (opt["dry-run"]) {
    console.log(`\n===== System prompt =====\n${WRITER}`);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const summary = [
    `# Câu hỏi mới ${date}`,
    `**+${total.questions} câu hỏi, +${total.quiz} quiz** · rank ${ranks.map((r) => r.name).join(", ")} · sinh và thẩm định bằng \`${MODEL}\`.`,
    "Nội dung do AI viết: đọc lại đáp án trước khi merge.",
    ...sections,
    ...(failures.length ? ["## Lô bị lỗi", failures.join("\n")] : []),
  ].join("\n\n");
  console.log(`\n${summary}\n\nToken: ${usage.input} vào, ${usage.output} ra.`);
  if (opt.summary) fs.writeFileSync(opt.summary, summary + "\n");
  // Có lô lỗi mà không thêm được câu nào: báo thất bại để workflow hiện đỏ.
  if (failures.length && !total.questions && !total.quiz) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
