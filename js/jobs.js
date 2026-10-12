// Trang Việc làm: lối tắt sang các trang tuyển dụng + tin do cộng đồng đăng.
// Tin cộng đồng là GitHub Issue có label "type: job" (template 6-job.yml), tải chung với trang Cộng đồng.
import { TRACKS } from "../data/index.js";

// Trang tìm kiếm đã lọc sẵn theo nền tảng. slug = track.id, q = track.name (vd. "react-native" / "React Native").
export const JOB_SITES = [
  { id: "itviec", name: "ITviec", url: (t) => `https://itviec.com/it-jobs/${t.id}` },
  { id: "topcv", name: "TopCV", url: (t) => `https://www.topcv.vn/tim-viec-lam-${t.id}` },
  { id: "vietnamworks", name: "VietnamWorks", url: (t) => `https://www.vietnamworks.com/viec-lam?q=${encodeURIComponent(t.id)}` },
  { id: "careerviet", name: "CareerViet", url: (t) => `https://careerviet.vn/viec-lam/${t.id}-k-vi.html` },
  {
    id: "linkedin",
    name: "LinkedIn",
    url: (t) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(t.name)}&location=Vietnam`,
  },
];

// Tin mở quá số ngày này được coi là hết hạn và không hiển thị.
export const JOB_TTL_DAYS = 60;

const TRACK_PATTERNS = {
  flutter: /flutter|dart/i,
  android: /android|kotlin/i,
  ios: /\bios\b|swift/i,
  "react-native": /react[\s-]*native|\brn\b/i,
};

// "Flutter, React Native" -> ["flutter", "react-native"]. Chỉ ghi "Mobile" -> mọi nền tảng.
export function tracksOf(text) {
  const ids = TRACKS.map((t) => t.id).filter((id) => TRACK_PATTERNS[id] && TRACK_PATTERNS[id].test(text || ""));
  if (!ids.length && /mobile|cross[\s-]*platform/i.test(text || "")) return TRACKS.map((t) => t.id);
  return ids;
}

// Nhãn trường trong 6-job.yml -> khoá dùng trong code.
const FIELD_LABELS = {
  track: "Nền tảng",
  company: "Công ty",
  rank: "Cấp độ",
  location: "Địa điểm",
  mode: "Hình thức",
  salary: "Mức lương",
  apply: "Link ứng tuyển hoặc email",
};

const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 160);

function applyHref(text) {
  const url = (text.match(/https?:\/\/[^\s<>()"']+/i) || [])[0];
  if (url) return url.replace(/[.,;]+$/, "");
  const email = (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0];
  return email ? `mailto:${email}` : "";
}

// Issue đã chuẩn hoá (community.js) -> thông tin tin tuyển dụng.
export function jobOf(item) {
  // So khớp tên trường sau khi chuẩn hoá Unicode (dấu tiếng Việt có thể ở dạng tổ hợp).
  const f = Object.fromEntries(Object.entries(item.fields || {}).map(([k, v]) => [k.normalize("NFC"), v]));
  const info = {};
  for (const [key, label] of Object.entries(FIELD_LABELS)) info[key] = oneLine(f[label.normalize("NFC")]);
  const ageDays = (Date.now() - new Date(item.created).getTime()) / 86400000;
  return {
    ...info,
    number: item.number,
    title: item.title,
    url: item.url,
    author: item.author,
    created: item.created,
    tracks: tracksOf(info.track),
    applyUrl: applyHref(String(f[FIELD_LABELS.apply] || "")),
    open: item.status !== "done" && item.status !== "declined",
    expired: ageDays > JOB_TTL_DAYS,
  };
}

// Tin đang hiển thị cho một nền tảng, mới nhất trước.
export function activeJobs(items, trackId) {
  return items
    .filter((i) => i.type === "job")
    .map(jobOf)
    .filter((j) => j.open && !j.expired && j.tracks.includes(trackId))
    .sort((a, b) => b.created.localeCompare(a.created));
}
