# interview

Website **Mobile Interview**: ôn phỏng vấn mobile theo nền tảng (**Flutter**, **Android** — Kotlin/Java, **iOS** — Swift, **React Native**) và rank (Fresher → Junior → Middle → Senior). Chọn nền tảng ở góc phải menu hoặc trên trang chủ; mỗi nền tảng có ngân hàng câu hỏi, quiz, lịch ôn và tiến độ riêng:

- **Ôn luyện**: câu hỏi phỏng vấn kèm đáp án mẫu, lọc theo chủ đề/trạng thái, tìm kiếm, đánh dấu _Đã thuộc_ / _Cần ôn lại_, chế độ **Flashcard**.
- **Quiz**: trắc nghiệm 4 đáp án theo rank hoặc tổng hợp, chọn chủ đề và số câu. Chế độ _Luyện tập_ (giải thích ngay) và _Thi thử_ (đếm giờ). Có màn xem lại bài và nút làm lại câu sai.
- **Ôn hôm nay**: ôn tập ngắt quãng (hộp Leitner 1 → 3 → 7 → 14 → 30 → 60 ngày). Mỗi ngày gồm các câu đến hạn + vài câu mới; tự chấm _Quên / Khó / Nhớ_. Số câu cần ôn hiện trên menu.
- **Phỏng vấn thử**: bốc câu ngẫu nhiên theo rank (xen kẽ chủ đề), đếm giờ, ghi âm câu trả lời ngay trên trình duyệt để nghe lại, tự chấm; câu chưa tốt tự vào lịch ôn.
- **Lộ trình 35 ngày** (chỉ Flutter): lộ trình ~5 phút/ngày từ phiên bản đầu tiên. Tiến độ cũ vẫn được giữ.
- **Tiến độ**: chuỗi ngày học, mức độ thuộc bài theo rank, chủ đề hay sai, lịch sử quiz, sao lưu/khôi phục JSON.
- **Cộng đồng**: người dùng đóng góp câu hỏi, đề xuất tính năng, góp ý nội dung, báo lỗi, hỏi đáp; có Roadmap và trạng thái xử lý từng yêu cầu (dữ liệu lấy từ GitHub Issues). Câu hỏi được duyệt hiển thị tên người đóng góp.
- **Chia sẻ**: mỗi câu có trang riêng `#/q/<id>` và link chia sẻ `s/<id>.html` với ảnh/tiêu đề preview riêng khi đăng lên Facebook, Zalo.
- **Cài như app (PWA)**: cài lên màn hình chính điện thoại, học được cả khi offline.

Đây là site tĩnh thuần HTML/CSS/JS (ES modules): không cần build, không có dependency. Tiến độ được lưu trong `localStorage` của trình duyệt.

## Chạy local

ES modules không chạy qua `file://`, nên cần một static server:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

## Deploy (GitHub Pages)

Repo đang deploy từ nhánh `main`, thư mục gốc. Chỉ cần commit và push, Pages sẽ tự build lại. File `.nojekyll` giúp Pages phục vụ nguyên trạng các file, không qua Jekyll.

## Cấu trúc

```
index.html              khung trang + nav
css/styles.css          giao diện (dark/light)
js/main.js              router dạng hash theo track (#/android/study/junior, #/ios/quiz, ...);
                        link không có track (#/study/junior) tự chuyển sang track đang chọn
js/store.js             lưu tiến độ trong localStorage
js/utils.js             escape HTML, tô màu code (Dart, Kotlin, Java, Swift, TS/JSX, XML), helpers
js/views/               home, study, review (Ôn hôm nay), quiz, interview (Phỏng vấn thử),
                        roadmap, progress, community, question (#/q/<id>)
js/pwa.js, sw.js        đăng ký service worker, cài app, cache offline (network-first)
manifest.webmanifest    thông tin PWA (tên, icon, shortcut)
assets/                 icon app, og.png (preview trang chủ), og-<track>.png (preview trang chia sẻ)
s/<id>.html             trang chia sẻ từng câu (sinh bởi scripts/build-share-pages.mjs)
js/config.js            repo GitHub dùng cho trang Cộng đồng
js/community.js         đọc GitHub Issues (cache + ETag), map label → trạng thái
.github/ISSUE_TEMPLATE/ form đóng góp (5 loại) trên GitHub
.github/labels.json     label loại + trạng thái, được workflow labels.yml tự tạo
data/meta.js            danh sách rank (dùng chung)
data/tracks.js          danh sách track: tên, tiền tố id, ngôn ngữ code mặc định, mô tả rank, chủ đề
data/index.js           tải dữ liệu từng track khi cần (dynamic import) + các hàm truy vấn
data/<track>/index.js   gom dữ liệu của track (flutter, android, ios, react-native)
data/<track>/questions/<rank>.js  câu hỏi phỏng vấn theo rank
data/<track>/quiz/<rank>.js       câu quiz trắc nghiệm theo rank
data/flutter/roadmap.js lộ trình 35 ngày của Flutter (mỗi câu có rank + topic)
scripts/validate.mjs    kiểm tra schema dữ liệu, danh sách cache offline, trang chia sẻ
```

Ngân hàng câu hỏi Flutter của mỗi rank = `data/flutter/questions/<rank>.js` + các câu trong lộ trình có `rank` tương ứng.

Thêm một nền tảng mới: khai báo trong `data/tracks.js`, tạo `data/<track>/` giống các track khác, thêm file vào `PRECACHE` của `sw.js`, tạo ảnh `assets/og-<track>.png`, rồi chạy `node scripts/build-share-pages.mjs` và `node scripts/validate.mjs`.

## Thống kê truy cập

Site dùng [GoatCounter](https://www.goatcounter.com) (miễn phí, không dùng cookie nên không cần banner xin đồng ý). Xem số liệu tại https://interview.goatcounter.com.

- Site dùng hash route (`#/quiz`, `#/study/junior`) nên `index.html` tắt đếm tự động (`no_onload`), còn `js/analytics.js` đếm mỗi lần đổi trang. Đường dẫn được gửi dạng `/flutter-prep/#/quiz` (bỏ phần `?query`).
- Lượt xem từ `localhost` không được tính.
- Muốn bỏ qua lượt truy cập của chính bạn: vào Settings của GoatCounter và thêm IP của bạn vào mục bỏ qua.

## Quản lý trang Cộng đồng

Mỗi đóng góp là một **GitHub Issue** trong repo này. Trang Cộng đồng đọc issues qua GitHub API công khai (không cần token), nên bạn chỉ cần thao tác trên GitHub:

| Trạng thái trên web | Cách đặt trên GitHub |
| --- | --- |
| Mới | Issue đang mở, chưa có label `status: ...` |
| Đang xem xét | Gắn label `status: reviewing` |
| Đã lên kế hoạch | Gắn label `status: planned` (hiện ở cột Roadmap) |
| Đang thực hiện | Gắn label `status: in progress` |
| Đã hoàn thành | Close issue → **Close as completed** |
| Không thực hiện | Close issue → **Close as not planned** (nên để lại comment giải thích) |

- **Loại đóng góp** do issue template tự gắn: `type: question`, `type: feature`, `type: content`, `type: bug`, `type: discussion`.
- **Bình chọn** = số reaction 👍 trên issue. **Phản hồi** = comment; comment của owner/collaborator có nhãn "Quản trị".
- Các label được workflow `.github/workflows/labels.yml` tự tạo khi push. Muốn đổi màu hay mô tả thì sửa `.github/labels.json`.
- Câu hỏi được duyệt thì thêm vào `data/<track>/questions/<rank>.js` hoặc `data/<track>/quiz/<rank>.js` kèm `by: "<github-username>", issue: <số issue>` để ghi công người đóng góp, rồi close issue với **Close as completed**.
- GitHub giới hạn 60 request/giờ cho mỗi IP khi không đăng nhập. Trang cache 1 phút và dùng ETag (request không đổi trả 304, không bị tính vào giới hạn). Nếu vẫn bị giới hạn, trang hiển thị dữ liệu đã lưu kèm thông báo.

## Thêm câu hỏi

Câu hỏi phỏng vấn (`data/<track>/questions/<rank>.js`):

```js
{
  id: "and-jun-q26",      // <tiền tố track>-<fre|jun|mid|sen>-q<số>; Flutter không có tiền tố track (jun-q31)
  topic: "coroutines",    // key trong `topics` của track (data/tracks.js)
  q: "Câu hỏi, dùng `backtick` cho code inline",
  a: "Đáp án mẫu",
  code: "optional: đoạn code nhiều dòng (hiển thị cùng đáp án)",
  lang: "java",           // optional: chỉ khi code khác ngôn ngữ mặc định của track (dart, kotlin, java, swift, ts, xml)
  by: "octocat",          // optional: GitHub username người đóng góp
  issue: 12,              // optional: số issue trên trang Cộng đồng (cần có `by`)
}
```

Tiền tố track: Android `and`, iOS `ios`, React Native `rn`. Ngôn ngữ code mặc định: Flutter `dart`, Android `kotlin`, iOS `swift`, React Native `ts` (TypeScript + JSX).

Câu quiz (`data/<track>/quiz/<rank>.js`):

```js
{
  id: "and-jun-m41",
  topic: "async",
  q: "Câu hỏi",
  code: "optional",
  options: ["A", "B", "C", "D"],   // đúng 4 đáp án
  answer: 0,                       // index đáp án đúng
  explain: "Vì sao đúng / vì sao đáp án dễ nhầm lại sai",
}
```

App tự xáo trộn thứ tự đáp án, nên **không** viết đáp án kiểu "Cả A và B" hay "Tất cả các đáp án trên".

Sau khi thêm/sửa câu hỏi, tạo lại trang chia sẻ rồi chạy kiểm tra (cần Node 18+):

```bash
node scripts/build-share-pages.mjs        # cập nhật thư mục s/
node scripts/validate.mjs                 # mọi track + cache offline + trang chia sẻ
node scripts/validate.mjs android         # chỉ kiểm tra dữ liệu một track
node scripts/validate.mjs android junior  # chỉ một rank của một track
```

Thêm file JS/CSS mới thì nhớ thêm vào danh sách `PRECACHE` trong `sw.js` (validator sẽ báo nếu thiếu), và tăng `CACHE` (`interview-v2` → `interview-v3`) nếu muốn xoá cache cũ trên máy người dùng.
