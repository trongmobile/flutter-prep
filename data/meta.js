// Định nghĩa rank và chủ đề dùng chung cho toàn bộ ngân hàng câu hỏi.

export const RANKS = [
  {
    id: "fresher",
    name: "Fresher",
    years: "0–1 năm",
    color: "green",
    desc: "Cú pháp Dart, widget cơ bản, layout, setState, điều hướng đơn giản.",
  },
  {
    id: "junior",
    name: "Junior",
    years: "1–2 năm",
    color: "blue",
    desc: "Null safety, Future/Stream, lifecycle, Provider, gọi API, lưu trữ local.",
  },
  {
    id: "middle",
    name: "Middle",
    years: "2–4 năm",
    color: "amber",
    desc: "3 cây widget, Key, Riverpod/Bloc, Clean Architecture, Isolate, testing.",
  },
  {
    id: "senior",
    name: "Senior",
    years: "4+ năm",
    color: "purple",
    desc: "Rendering, native/FFI, performance, kiến trúc lớn, system design, leadership.",
  },
];

export const TOPICS = {
  dart: "Dart",
  async: "Async & Isolate",
  widget: "Widget & Lifecycle",
  layout: "Layout & Rendering",
  state: "State Management",
  navigation: "Navigation",
  arch: "Kiến trúc & DI",
  data: "Networking & Storage",
  native: "Native & Platform",
  perf: "Performance",
  testing: "Testing & CI/CD",
  security: "Security",
  design: "System Design",
  soft: "Behavioral",
};

export function getRank(id) {
  return RANKS.find((r) => r.id === id) || null;
}
