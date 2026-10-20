// Trang Việc làm: lối tắt sang các trang tuyển dụng + tin do cộng đồng đăng.
// Tin cộng đồng là GitHub Issue có label "type: job" (template 6-job.yml), tải chung với trang Cộng đồng.
import { TRACKS } from "../data/index.js";

// Khu vực lọc sẵn trên link tìm việc. "all" = toàn quốc, không lọc.
export const JOB_LOCATIONS = [
  { id: "all", name: "Toàn quốc" },
  { id: "hn", name: "Hà Nội" },
  { id: "hcm", name: "TP.HCM" },
  { id: "dn", name: "Đà Nẵng" },
];

// Mỗi trang tuyển dụng đặt khu vực vào URL một kiểu riêng (slug, mã số hoặc tên) nên khai báo theo từng trang.
// Mã dưới đây lấy từ chính danh sách khu vực của từng trang, không phải số chung:
// Hà Nội là 1 (TopCV) / 4 (CareerViet) / 24 (VietnamWorks) / 01 (TopDev), HCM là 2 / 8 / 29 / 79, Đà Nẵng là 8 / 511 / 17 / 48.
// Lưu ý: ITviec trả 404 "Search term not found" khi tổ hợp kỹ năng + khu vực không có tin nào (hay gặp ở Đà Nẵng).
const at = (map, loc) => map[loc] || "";

// Trang tìm kiếm đã lọc sẵn theo nền tảng. slug = track.id, q = track.name (vd. "react-native" / "React Native").
export const JOB_SITES = [
  {
    id: "itviec",
    name: "ITviec",
    url: (t, loc) => `https://itviec.com/it-jobs/${t.id}${at({ hn: "/ha-noi", hcm: "/ho-chi-minh-hcm", dn: "/da-nang" }, loc)}`,
  },
  {
    id: "topdev",
    name: "TopDev",
    // Đà Nẵng là 48: menu của TopDev ghi 048 nhưng bộ lọc bỏ qua giá trị đó.
    url: (t, loc) => `https://topdev.vn/jobs/search?keyword=${encodeURIComponent(t.name)}${at({ hn: "&region_ids=01", hcm: "&region_ids=79", dn: "&region_ids=48" }, loc)}`,
  },
  {
    id: "topcv",
    name: "TopCV",
    url: (t, loc) => `https://www.topcv.vn/tim-viec-lam-${t.id}${at({ hn: "-tai-ha-noi-kl1", hcm: "-tai-ho-chi-minh-kl2", dn: "-tai-da-nang-kl8" }, loc)}`,
  },
  {
    id: "vietnamworks",
    name: "VietnamWorks",
    url: (t, loc) => `https://www.vietnamworks.com/viec-lam?q=${encodeURIComponent(t.id)}${at({ hn: "&l=24", hcm: "&l=29", dn: "&l=17" }, loc)}`,
  },
  {
    id: "careerviet",
    name: "CareerViet",
    url: (t, loc) => `https://careerviet.vn/viec-lam/${t.id}-k${at({ hn: "l4", hcm: "l8", dn: "l511" }, loc)}-vi.html`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    // "Ho Chi Minh City" thường bị LinkedIn hiểu thành một quận, nên dùng tên vùng đô thị.
    url: (t, loc) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(t.name)}&location=${encodeURIComponent(
        at({ hn: "Hanoi", hcm: "Ho Chi Minh City Metropolitan Area", dn: "Da Nang" }, loc) || "Vietnam",
      )}`,
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
