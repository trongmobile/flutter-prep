// Bảng xếp hạng thi: điểm lưu trên Supabase (bảng + hàm SQL trong supabase/leaderboard.sql).
// Trình duyệt chỉ gọi 3 hàm qua REST: lb_set_nickname, lb_submit, lb_board.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { player } from "./store.js";

// Đề chuẩn: Thi thử đúng số câu này, không lọc chủ đề. Phải khớp kiểm tra trong lb_submit.
export const RANKED_COUNT = 20;
export const BOARD_LIMIT = 50;
export const NICK_MIN = 2;
export const NICK_MAX = 20;
const TIMEOUT = 8000;
const CACHE_MS = 30 * 1000;

// Cache bảng xếp hạng ngắn hạn để chuyển qua lại giữa các tab không gọi lại liên tục.
const boards = new Map();

export function leaderboardEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

// Bài nào được tính lên bảng: Thi thử, không phải "làm lại câu sai", mọi chủ đề, đúng RANKED_COUNT câu.
export function isRankedRun({ mode, kind, topicCount, total }) {
  return leaderboardEnabled() && mode === "exam" && kind === "normal" && topicCount === 0 && total === RANKED_COUNT;
}

export function currentPlayer() {
  return player.get();
}

// Mã lỗi do hàm SQL raise -> câu báo cho người dùng.
const MESSAGES = {
  nickname_taken: "Biệt danh này đã có người dùng, chọn tên khác nhé.",
  bad_nickname: `Biệt danh dài ${NICK_MIN}–${NICK_MAX} ký tự, chỉ gồm chữ, số, khoảng trắng và . _ -`,
  no_player: "Bạn cần đặt biệt danh trước khi gửi điểm.",
  bad_score: "Kết quả bài thi không hợp lệ nên không được tính.",
  bad_board: "Bảng xếp hạng không hợp lệ.",
  too_fast: "Bạn vừa gửi điểm cho bảng này, đợi ít giây rồi thử lại.",
  too_many: "Hôm nay bạn đã gửi quá nhiều bài, mai thử lại nhé.",
};

export class LeaderboardError extends Error {
  constructor(code, message) {
    super(message || MESSAGES[code] || "Máy chủ bảng xếp hạng đang lỗi, thử lại sau.");
    this.code = code;
  }
}

// Cùng quy tắc với lb_clean_nickname: chữ Latin có dấu (gồm tiếng Việt), số, khoảng trắng, . _ -
const NICK_CHARS = /^[A-Za-z0-9 ._À-ɏḀ-ỿ-]+$/;
const NICK_LETTER = /[A-Za-z0-9À-ɏḀ-ỿ]/;

// Chuẩn hoá biệt danh; ném LeaderboardError("bad_nickname") nếu không hợp lệ (máy chủ kiểm tra lại lần nữa).
export function cleanNickname(raw) {
  const v = String(raw || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (v.length < NICK_MIN || v.length > NICK_MAX || !NICK_CHARS.test(v) || !NICK_LETTER.test(v)) {
    throw new LeaderboardError("bad_nickname");
  }
  return v;
}

async function rpc(fn, body) {
  const headers = { "Content-Type": "application/json", apikey: SUPABASE_KEY };
  // Key kiểu cũ (JWT "anon") gửi kèm Authorization; key mới sb_publishable_... chỉ cần apikey.
  if (SUPABASE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new LeaderboardError(
      "network",
      navigator.onLine === false
        ? "Bạn đang offline nên chưa kết nối được bảng xếp hạng."
        : "Không kết nối được máy chủ bảng xếp hạng. Kiểm tra mạng rồi thử lại.",
    );
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data && typeof data.message === "string" && MESSAGES[data.message] ? data.message : `http_${res.status}`;
    throw new LeaderboardError(code);
  }
  return data;
}

// Đặt / đổi biệt danh. Trả về biệt danh đã chuẩn hoá và lưu lại trên máy.
export async function setNickname(raw) {
  const nick = cleanNickname(raw);
  const { id } = player.ensure();
  const saved = await rpc("lb_set_nickname", { p_player: id, p_nickname: nick });
  player.setNick(saved);
  boards.clear(); // tên mới phải hiện ngay trên bảng
  return saved;
}

// Nộp điểm. Trả về { week: { pos, best }, all: { pos, best } } — hạng hiện tại trên 2 bảng.
export async function submitScore({ track, rank, correct, total, duration }) {
  const p = player.get();
  if (!p || !p.nick) throw new LeaderboardError("no_player");
  try {
    return await rpc("lb_submit", {
      p_player: p.id,
      p_track: track,
      p_rank: rank,
      p_correct: correct,
      p_total: total,
      p_duration: duration,
    });
  } catch (err) {
    // Máy chủ không biết mã này (vd. dữ liệu bị xoá): đặt lại biệt danh từ đầu.
    if (err.code === "no_player") player.setNick("");
    throw err;
  } finally {
    boards.clear();
  }
}

// period: "week" | "all". Mỗi dòng: { pos, nickname, correct, total, duration, played_at, me }.

export async function fetchBoard(track, rank, period, { force = false } = {}) {
  const p = player.get();
  const key = [track, rank, period, p ? p.id : ""].join("|");
  const hit = boards.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const rows = await rpc("lb_board", {
    p_track: track,
    p_rank: rank,
    p_period: period,
    p_player: p && p.nick ? p.id : null,
    p_limit: BOARD_LIMIT,
  });
  const list = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, pos: Number(r.pos) }));
  boards.set(key, { at: Date.now(), rows: list });
  return list;
}
