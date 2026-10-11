// Lưu tiến độ trong localStorage. Mọi thao tác đều bọc try/catch để trang vẫn
// chạy được khi trình duyệt chặn storage (chế độ ẩn danh, iframe...).

export const KEYS = {
  roadmap: "flutter-senior-completed-days", // giữ key cũ để không mất tiến độ đã có
  study: "fip.study.v1",
  quiz: "fip.quiz.v1",
  activity: "fip.activity.v1",
  srs: "fip.srs.v1",
  interview: "fip.interview.v1",
  prefs: "fip.prefs.v1",
};

const cache = {};

function read(key, fallback) {
  if (key in cache) return cache[key];
  let value = fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) value = JSON.parse(raw);
  } catch (e) {
    value = fallback;
  }
  cache[key] = value;
  return value;
}

function write(key, value) {
  cache[key] = value;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function remove(key) {
  delete cache[key];
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* ignore */
  }
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Báo cho giao diện (badge "Ôn hôm nay") khi lịch ôn hoặc đánh dấu thay đổi.
function notifySrs() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("srs-change"));
}

export function addDays(n, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

// ---- Hoạt động hằng ngày (tính chuỗi ngày học) ----
export const activity = {
  days() {
    const list = read(KEYS.activity, []);
    return Array.isArray(list) ? list : [];
  },
  touch() {
    const today = todayKey();
    const days = activity.days();
    if (!days.includes(today)) {
      write(KEYS.activity, [...days, today].slice(-400));
    }
  },
  streak() {
    const set = new Set(activity.days());
    const d = new Date();
    // Chưa học hôm nay thì chuỗi vẫn tính đến hôm qua.
    if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(todayKey(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  },
};

// ---- Ôn luyện: trạng thái từng câu hỏi ("known" | "review") ----
// Đánh dấu cũng cập nhật lịch ôn ngắt quãng (srs) để hai bên luôn khớp nhau.
export const study = {
  all() {
    const map = read(KEYS.study, {});
    return map && typeof map === "object" ? map : {};
  },
  get(id) {
    return study.all()[id];
  },
  set(id, status) {
    writeMark(id, status);
    if (status === "known") srs.markKnown(id);
    else if (status === "review") srs.markReview(id);
    else srs.remove(id);
    activity.touch();
    notifySrs();
  },
  reset() {
    remove(KEYS.study);
  },
};

function writeMark(id, status) {
  const map = { ...study.all() };
  if (status) map[id] = status;
  else delete map[id];
  write(KEYS.study, map);
}

// ---- Ôn tập ngắt quãng (hộp Leitner) ----
// cards[id] = { box: 1..6, due: "YYYY-MM-DD", last: "YYYY-MM-DD", reps, lapses }
// Nhớ tốt thì lên hộp cao hơn, khoảng cách ôn dài hơn; quên thì về hộp 1.
export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60]; // số ngày theo hộp 1..6
export const GRADES = ["again", "hard", "good"];

function srsData() {
  const d = read(KEYS.srs, null);
  return {
    cards: d && d.cards && typeof d.cards === "object" ? d.cards : {},
    newLog: d && d.newLog ? d.newLog : { date: "", ids: [] },
    migrated: !!(d && d.migrated),
  };
}
function srsWrite(next) {
  write(KEYS.srs, next);
}

// Kết quả nếu chấm `grade` cho thẻ đang ở hộp `box` (0 = thẻ mới).
export function srsSchedule(box, grade) {
  if (grade === "again") return { box: 1, days: 1 };
  if (grade === "hard") {
    const b = Math.max(1, box);
    return { box: b, days: Math.max(1, Math.ceil(SRS_INTERVALS[b - 1] / 2)) };
  }
  const b = Math.min(SRS_INTERVALS.length, box + 1);
  return { box: b, days: SRS_INTERVALS[b - 1] };
}

// Rải đều ngày đến hạn khi chuyển dữ liệu cũ để không dồn vào một ngày.
function spread(id, max) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % max) + 1;
}

export const srs = {
  cards() {
    return srsData().cards;
  },
  card(id) {
    return srsData().cards[id] || null;
  },
  // Chấm điểm sau khi ôn (Ôn hôm nay, Phỏng vấn thử).
  grade(id, grade) {
    const data = srsData();
    const prev = data.cards[id] || { box: 0, reps: 0, lapses: 0 };
    const { box, days } = srsSchedule(prev.box, grade);
    data.cards = {
      ...data.cards,
      [id]: {
        box,
        due: addDays(days),
        last: todayKey(),
        reps: (prev.reps || 0) + 1,
        lapses: (prev.lapses || 0) + (grade === "again" ? 1 : 0),
      },
    };
    srsWrite(data);
    writeMark(id, grade === "good" ? "known" : "review");
    activity.touch();
    notifySrs();
  },
  // Bấm "Đã thuộc" trong danh sách: coi như đã nhớ, ôn lại sau ít nhất 7 ngày.
  markKnown(id) {
    const data = srsData();
    const prev = data.cards[id];
    const box = Math.max(3, prev ? prev.box : 0);
    data.cards = { ...data.cards, [id]: { ...(prev || { reps: 0, lapses: 0 }), box, due: addDays(SRS_INTERVALS[box - 1]), last: todayKey() } };
    srsWrite(data);
  },
  // Bấm "Cần ôn lại": đưa vào hàng đợi ôn ngay hôm nay.
  markReview(id) {
    const data = srsData();
    const prev = data.cards[id];
    data.cards = { ...data.cards, [id]: { ...(prev || { reps: 0, lapses: 0 }), box: 1, due: todayKey(), last: todayKey() } };
    srsWrite(data);
  },
  remove(id) {
    const data = srsData();
    if (!data.cards[id]) return;
    const cards = { ...data.cards };
    delete cards[id];
    srsWrite({ ...data, cards });
  },
  dueIds(day = todayKey()) {
    const cards = srsData().cards;
    return Object.keys(cards)
      .filter((id) => cards[id].due <= day)
      .sort((a, b) => cards[a].due.localeCompare(cards[b].due) || cards[a].box - cards[b].box);
  },
  // Số thẻ đến hạn trong `days` ngày tới (ngày 0 gồm cả thẻ quá hạn).
  forecast(days = 7) {
    const cards = Object.values(srsData().cards);
    const keys = Array.from({ length: days }, (_, i) => addDays(i));
    return keys.map((k, i) => ({ day: k, count: cards.filter((c) => (i === 0 ? c.due <= k : c.due === k)).length }));
  },
  reviewedToday() {
    const today = todayKey();
    return Object.values(srsData().cards).filter((c) => c.last === today && c.reps > 0).length;
  },
  // Câu mới đã đưa vào ôn hôm nay (giới hạn số câu mới mỗi ngày).
  newToday() {
    const log = srsData().newLog;
    return log.date === todayKey() ? log.ids : [];
  },
  noteNew(id) {
    const data = srsData();
    const ids = data.newLog.date === todayKey() ? data.newLog.ids : [];
    if (!ids.includes(id)) srsWrite({ ...data, newLog: { date: todayKey(), ids: [...ids, id] } });
  },
  // Chạy một lần: chuyển đánh dấu cũ sang lịch ôn.
  migrate() {
    const data = srsData();
    if (data.migrated) return;
    const cards = { ...data.cards };
    for (const [id, status] of Object.entries(study.all())) {
      if (cards[id]) continue;
      if (status === "known") cards[id] = { box: 3, due: addDays(spread(id, 7)), last: "", reps: 0, lapses: 0 };
      else if (status === "review") cards[id] = { box: 1, due: todayKey(), last: "", reps: 0, lapses: 0 };
    }
    srsWrite({ ...data, cards, migrated: true });
  },
  reset() {
    write(KEYS.srs, { cards: {}, newLog: { date: "", ids: [] }, migrated: true });
    notifySrs();
  },
};

// ---- Phỏng vấn thử: lịch sử các buổi ----
export const interview = {
  history() {
    const list = read(KEYS.interview, []);
    return Array.isArray(list) ? list : [];
  },
  record(entry) {
    write(KEYS.interview, [...interview.history(), entry].slice(-100));
    activity.touch();
  },
  reset() {
    remove(KEYS.interview);
  },
};

// ---- Lộ trình 35 ngày: danh sách ngày đã hoàn thành ----
export const roadmap = {
  completed(max) {
    const list = read(KEYS.roadmap, []);
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((n) => Number.isInteger(n) && n >= 1 && n <= max));
  },
  complete(day, max) {
    const set = roadmap.completed(max);
    set.add(day);
    write(KEYS.roadmap, Array.from(set).sort((a, b) => a - b));
    activity.touch();
  },
  reset() {
    remove(KEYS.roadmap);
  },
};

// ---- Quiz: lịch sử làm bài + thống kê đúng/sai từng câu ----
// stats[id] = { c: số lần đúng, w: số lần sai, last: 1 nếu lần gần nhất đúng }
export const quiz = {
  data() {
    const d = read(KEYS.quiz, null);
    return {
      history: Array.isArray(d && d.history) ? d.history : [],
      stats: d && d.stats && typeof d.stats === "object" ? d.stats : {},
    };
  },
  record(entry, answers) {
    const { history, stats } = quiz.data();
    const nextStats = { ...stats };
    for (const { id, correct } of answers) {
      const s = nextStats[id] || { c: 0, w: 0, last: 0 };
      nextStats[id] = {
        c: s.c + (correct ? 1 : 0),
        w: s.w + (correct ? 0 : 1),
        last: correct ? 1 : 0,
      };
    }
    write(KEYS.quiz, { history: [...history, entry].slice(-200), stats: nextStats });
    activity.touch();
  },
  // Câu trả lời sai ở lần gần nhất -> cần ôn lại.
  wrongIds() {
    const { stats } = quiz.data();
    return Object.keys(stats).filter((id) => stats[id].last === 0);
  },
  best(rank) {
    const scores = quiz
      .data()
      .history.filter((h) => h.rank === rank && h.kind !== "retry" && h.total >= 5)
      .map((h) => h.correct / h.total);
    return scores.length ? Math.max(...scores) : null;
  },
  reset() {
    remove(KEYS.quiz);
  },
};

// ---- Tuỳ chọn giao diện ----
export const prefs = {
  get(key, fallback) {
    const p = read(KEYS.prefs, {});
    return p && key in p ? p[key] : fallback;
  },
  set(key, value) {
    write(KEYS.prefs, { ...read(KEYS.prefs, {}), [key]: value });
  },
};

// ---- Sao lưu / khôi phục ----
export function exportAll() {
  const out = { app: "flutter-prep", version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const key of Object.values(KEYS)) {
    const value = read(key, null);
    if (value !== null) out.data[key] = value;
  }
  return out;
}

export function importAll(payload) {
  if (!payload || payload.app !== "flutter-prep" || typeof payload.data !== "object") {
    throw new Error("File không đúng định dạng sao lưu của interview.");
  }
  const allowed = new Set(Object.values(KEYS));
  for (const [key, value] of Object.entries(payload.data)) {
    if (allowed.has(key)) write(key, value);
  }
  notifySrs();
}

export function resetAll() {
  for (const key of Object.values(KEYS)) {
    if (key !== KEYS.prefs) remove(key);
  }
  notifySrs();
}
