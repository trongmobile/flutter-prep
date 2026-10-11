// Lưu tiến độ trong localStorage. Mọi thao tác đều bọc try/catch để trang vẫn
// chạy được khi trình duyệt chặn storage (chế độ ẩn danh, iframe...).

export const KEYS = {
  roadmap: "flutter-senior-completed-days", // giữ key cũ để không mất tiến độ đã có
  study: "fip.study.v1",
  quiz: "fip.quiz.v1",
  activity: "fip.activity.v1",
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
export const study = {
  all() {
    const map = read(KEYS.study, {});
    return map && typeof map === "object" ? map : {};
  },
  get(id) {
    return study.all()[id];
  },
  set(id, status) {
    const map = { ...study.all() };
    if (status) map[id] = status;
    else delete map[id];
    write(KEYS.study, map);
    activity.touch();
  },
  reset() {
    remove(KEYS.study);
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
}

export function resetAll() {
  for (const key of Object.values(KEYS)) {
    if (key !== KEYS.prefs) remove(key);
  }
}
