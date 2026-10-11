// Đếm lượt xem bằng GoatCounter (không dùng cookie). Xem thống kê tại:
// https://interview.goatcounter.com
// Site dùng hash route (#/quiz, #/study/junior) nên index.html tắt đếm tự động
// (no_onload) và router gọi trackPageview() mỗi lần đổi trang.

let pending = null;

function send(vars) {
  const gc = window.goatcounter;
  if (gc && typeof gc.count === "function") gc.count(vars);
  else pending = vars; // count.js tải async, chưa xong thì gửi khi tải xong
}

const script = document.querySelector("script[data-goatcounter]");
if (script) {
  script.addEventListener("load", () => {
    if (!pending) return;
    const vars = pending;
    pending = null;
    send(vars);
  });
}

// path dạng "/flutter-prep/#/quiz": bỏ phần ?query để thống kê gọn theo trang.
export function trackPageview(title) {
  const hash = location.hash.split("?")[0] || "#/";
  send({ path: location.pathname + hash, title });
}
