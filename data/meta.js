// Rank dùng chung cho mọi track. Mô tả từng rank và danh sách chủ đề nằm trong tracks.js.

export const RANKS = [
  { id: "fresher", name: "Fresher", years: "0–1 năm", color: "green" },
  { id: "junior", name: "Junior", years: "1–2 năm", color: "blue" },
  { id: "middle", name: "Middle", years: "2–4 năm", color: "amber" },
  { id: "senior", name: "Senior", years: "4+ năm", color: "purple" },
];

export function getRank(id) {
  return RANKS.find((r) => r.id === id) || null;
}
