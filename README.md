# interview

Website ôn phỏng vấn Flutter theo rank (Fresher → Junior → Middle → Senior):

- **Ôn luyện**: câu hỏi phỏng vấn kèm đáp án mẫu, lọc theo chủ đề/trạng thái, tìm kiếm, đánh dấu _Đã thuộc_ / _Cần ôn lại_, chế độ **Flashcard**.
- **Quiz**: trắc nghiệm 4 đáp án theo rank hoặc tổng hợp, chọn chủ đề và số câu. Chế độ _Luyện tập_ (giải thích ngay) và _Thi thử_ (đếm giờ). Có màn xem lại bài và nút làm lại câu sai.
- **Ôn hôm nay**: ôn tập ngắt quãng (hộp Leitner 1 → 3 → 7 → 14 → 30 → 60 ngày). Mỗi ngày gồm các câu đến hạn + vài câu mới; tự chấm _Quên / Khó / Nhớ_. Số câu cần ôn hiện trên menu.
- **Phỏng vấn thử**: bốc câu ngẫu nhiên theo rank (xen kẽ chủ đề), đếm giờ, ghi âm câu trả lời ngay trên trình duyệt để nghe lại, tự chấm; câu chưa tốt tự vào lịch ôn.
- **Lộ trình 35 ngày**: lộ trình ~5 phút/ngày từ phiên bản đầu tiên. Tiến độ cũ vẫn được giữ.
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
js/main.js              router dạng hash (#/study/junior, #/quiz, ...)
js/store.js             lưu tiến độ trong localStorage
js/utils.js             escape HTML, tô màu code Dart, helpers
js/views/               home, study, review (Ôn hôm nay), quiz, interview (Phỏng vấn thử),
                        roadmap, progress, community, question (#/q/<id>)
js/pwa.js, sw.js        đăng ký service worker, cài app, cache offline (network-first)
manifest.webmanifest    thông tin PWA (tên, icon, shortcut)
assets/                 icon app + og.png (ảnh preview khi chia sẻ)
s/<id>.html             trang chia sẻ từng câu (sinh bởi scripts/build-share-pages.mjs)
js/config.js            repo GitHub dùng cho trang Cộng đồng
js/community.js         đọc GitHub Issues (cache + ETag), map label → trạng thái
.github/ISSUE_TEMPLATE/ form đóng góp (5 loại) trên GitHub
.github/labels.json     label loại + trạng thái, được workflow labels.yml tự tạo
data/meta.js            danh sách rank + chủ đề
data/roadmap.js         lộ trình 35 ngày (mỗi câu có rank + topic)
data/questions/<rank>.js  câu hỏi phỏng vấn bổ sung theo rank
data/quiz/<rank>.js       câu quiz trắc nghiệm theo rank
scripts/validate.mjs    kiểm tra schema dữ liệu, danh sách cache offline, trang chia sẻ
```

Ngân hàng câu hỏi của mỗi rank = `data/questions/<rank>.js` + các câu trong lộ trình có `rank` tương ứng.

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
- Câu hỏi được duyệt thì thêm vào `data/questions/<rank>.js` hoặc `data/quiz/<rank>.js` kèm `by: "<github-username>", issue: <số issue>` để ghi công người đóng góp, rồi close issue với **Close as completed**.
- GitHub giới hạn 60 request/giờ cho mỗi IP khi không đăng nhập. Trang cache 1 phút và dùng ETag (request không đổi trả 304, không bị tính vào giới hạn). Nếu vẫn bị giới hạn, trang hiển thị dữ liệu đã lưu kèm thông báo.

## Thêm câu hỏi

Câu hỏi phỏng vấn (`data/questions/<rank>.js`):

```js
{
  id: "jun-q31",          // tiền tố: fre / jun / mid / sen
  topic: "state",         // key trong data/meta.js → TOPICS
  q: "Câu hỏi, dùng `backtick` cho code inline",
  a: "Đáp án mẫu",
  code: "optional: đoạn Dart nhiều dòng (hiển thị cùng đáp án)",
  by: "octocat",          // optional: GitHub username người đóng góp
  issue: 12,              // optional: số issue trên trang Cộng đồng (cần có `by`)
}
```

Câu quiz (`data/quiz/<rank>.js`):

```js
{
  id: "jun-m41",
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
node scripts/build-share-pages.mjs # cập nhật thư mục s/
node scripts/validate.mjs          # tất cả rank + cache offline + trang chia sẻ
node scripts/validate.mjs junior   # chỉ kiểm tra dữ liệu một rank
```

Thêm file JS/CSS mới thì nhớ thêm vào danh sách `PRECACHE` trong `sw.js` (validator sẽ báo nếu thiếu), và tăng `CACHE` (`interview-v1` → `interview-v2`) nếu muốn xoá cache cũ trên máy người dùng.
