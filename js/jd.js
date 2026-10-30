// Nhận diện chủ đề kỹ thuật trong mô tả công việc (JD) bằng từ khoá của từng track (data/tracks.js).

// Bỏ hoa thường và dấu tiếng Việt để "Bảo mật", "bao mat" và "BẢO MẬT" khớp như nhau.
const fold = (str) =>
  String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
const escapeRe = (str) => str.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const cache = new Map(); // trackId -> [{ topic, re }]

function matchersFor(track) {
  if (!cache.has(track.id)) {
    const list = Object.keys(track.topics)
      .filter((topic) => track.keywords && track.keywords[topic])
      .map((topic) => {
        // Từ khoá dài đứng trước để "unit test" thắng "test"; khớp theo từ nguyên vẹn ("art" không khớp "start"),
        // cho phép số nhiều tiếng Anh ("unit tests", "APIs", "memory leaks", "batches").
        const words = track.keywords[topic].map((k) => escapeRe(fold(k))).sort((a, b) => b.length - a.length);
        return { topic, re: new RegExp(`(?:^|[^a-z0-9])(?:${words.join("|")})(?:e?s)?(?![a-z0-9])`, "g") };
      });
    cache.set(track.id, list);
  }
  return cache.get(track.id);
}

// Trả về [{ topic, hits }] các chủ đề của track xuất hiện trong text, nhiều lần nhắc nhất đứng trước.
export function detectTopics(text, track) {
  const folded = fold(text);
  return matchersFor(track)
    .map(({ topic, re }) => ({ topic, hits: (folded.match(re) || []).length }))
    .filter((t) => t.hits > 0)
    .sort((a, b) => b.hits - a.hits);
}
