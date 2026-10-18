// Đăng bài lên X (Twitter) và Threads cho agent marketing.
//   node scripts/mkt/post.mjs --x x.txt --threads threads.txt            đăng thật
//   node scripts/mkt/post.mjs --x x.txt --threads threads.txt --dry-run  chỉ kiểm tra độ dài
// Mỗi file là nội dung một bài. Kênh nào thiếu token thì bỏ qua, không làm hỏng kênh còn lại.
// Biến môi trường:
//   X:       X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (app có quyền Read and Write)
//   Threads: THREADS_ACCESS_TOKEN (long-lived token, hết hạn sau 60 ngày)
// Bài quá dài thì dừng với mã lỗi 2 và báo độ dài, để agent rút gọn rồi chạy lại.
import fs from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

const X_MAX = 280;
const THREADS_MAX = 500;
const URL_RE = /https?:\/\/\S+/g;

// Độ dài theo cách X đếm (twitter-text v3): link tính 23, ký tự Latin cơ bản tính 1,
// còn lại tính 2 — gồm chữ tiếng Việt dựng sẵn như "ế", "ộ" (U+1E00–U+1EFF) và emoji.
export function xLength(text) {
  const t = text.normalize("NFC");
  let n = (t.match(URL_RE) || []).length * 23;
  const rest = t.replace(URL_RE, "");
  for (const { segment } of new Intl.Segmenter().segment(rest)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) {
      n += 2;
      continue;
    }
    for (const ch of segment) {
      const c = ch.codePointAt(0);
      const light = c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
      n += light ? 1 : 2;
    }
  }
  return n;
}

const threadsLength = (text) => [...text.normalize("NFC")].length;

// Percent-encode theo RFC 3986, dùng cho chữ ký OAuth 1.0a.
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

async function postX(text) {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return { skipped: "Thiếu token X" };
  const url = "https://api.x.com/2/tweets";
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  // Body JSON không tham gia chữ ký, chỉ các tham số oauth_*.
  const params = Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join("&");
  const base = ["POST", enc(url), enc(params)].join("&");
  oauth.oauth_signature = createHmac("sha1", `${enc(X_API_SECRET)}&${enc(X_ACCESS_SECRET)}`).update(base).digest("base64");
  const header = "OAuth " + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`X ${res.status}: ${JSON.stringify(data)}`);
  return { id: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` };
}

async function threadsCall(path, params, method = "POST") {
  const qs = new URLSearchParams({ ...params, access_token: process.env.THREADS_ACCESS_TOKEN });
  const res = await fetch(`https://graph.threads.net/v1.0/${path}?${qs}`, { method });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Threads ${res.status} ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function postThreads(text) {
  if (!process.env.THREADS_ACCESS_TOKEN) return { skipped: "Thiếu THREADS_ACCESS_TOKEN" };
  const me = await threadsCall("me", { fields: "id" }, "GET");
  // Đăng Threads gồm 2 bước: tạo container rồi publish container đó.
  const container = await threadsCall(`${me.id}/threads`, { media_type: "TEXT", text });
  const post = await threadsCall(`${me.id}/threads_publish`, { creation_id: container.id });
  const info = await threadsCall(post.id, { fields: "permalink" }, "GET").catch(() => ({}));
  return { id: post.id, url: info.permalink || null };
}

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const dryRun = args.includes("--dry-run");
const jobs = [
  { channel: "x", file: opt("--x"), max: X_MAX, length: xLength, post: postX },
  { channel: "threads", file: opt("--threads"), max: THREADS_MAX, length: threadsLength, post: postThreads },
].filter((j) => j.file);

if (!jobs.length) {
  console.log("Cách dùng: node scripts/mkt/post.mjs [--x file] [--threads file] [--dry-run]");
  process.exit(1);
}

// Kiểm tra độ dài mọi kênh trước, để không có cảnh đăng được kênh này rồi kênh kia báo quá dài.
let tooLong = false;
for (const j of jobs) {
  j.text = fs.readFileSync(j.file, "utf8").trim();
  j.len = j.length(j.text);
  console.log(`${j.channel}: ${j.len}/${j.max} ký tự`);
  if (!j.text || j.len > j.max) tooLong = true;
}
if (tooLong) {
  console.log("Có bài trống hoặc quá dài, chưa đăng gì cả.");
  process.exit(2);
}
if (dryRun) process.exit(0);

let failed = false;
for (const j of jobs) {
  try {
    console.log(j.channel, JSON.stringify(await j.post(j.text)));
  } catch (err) {
    failed = true;
    console.log(j.channel, "LỖI", err.message);
  }
}
process.exit(failed ? 1 : 0);
