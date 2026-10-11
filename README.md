# interview

Website ôn phỏng vấn Flutter theo rank (Fresher → Junior → Middle → Senior):

- **Ôn luyện**: câu hỏi phỏng vấn kèm đáp án mẫu, lọc theo chủ đề/trạng thái, tìm kiếm, đánh dấu _Đã thuộc_ / _Cần ôn lại_, chế độ **Flashcard**.
- **Quiz**: trắc nghiệm 4 đáp án theo rank hoặc tổng hợp, chọn chủ đề và số câu. Chế độ _Luyện tập_ (giải thích ngay) và _Thi thử_ (đếm giờ). Có màn xem lại bài và nút làm lại câu sai.
- **Lộ trình 35 ngày**: lộ trình ~5 phút/ngày từ phiên bản đầu tiên. Tiến độ cũ vẫn được giữ.
- **Tiến độ**: chuỗi ngày học, mức độ thuộc bài theo rank, chủ đề hay sai, lịch sử quiz, sao lưu/khôi phục JSON.
- **Cộng đồng**: người dùng đóng góp câu hỏi, đề xuất tính năng, góp ý nội dung, báo lỗi, hỏi đáp; có Roadmap và trạng thái xử lý từng yêu cầu (dữ liệu lấy từ GitHub Issues).

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
js/views/               home, study, quiz, roadmap, progress, community
js/config.js            repo GitHub dùng cho trang Cộng đồng
js/community.js         đọc GitHub Issues (cache + ETag), map label → trạng thái
.github/ISSUE_TEMPLATE/ form đóng góp (5 loại) trên GitHub
.github/labels.json     label loại + trạng thái, được workflow labels.yml tự tạo
data/meta.js            danh sách rank + chủ đề
data/roadmap.js         lộ trình 35 ngày (mỗi câu có rank + topic)
data/questions/<rank>.js  câu hỏi phỏng vấn bổ sung theo rank
data/quiz/<rank>.js       câu quiz trắc nghiệm theo rank
scripts/validate.mjs    kiểm tra schema dữ liệu
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
- Câu hỏi được duyệt thì thêm vào `data/questions/<rank>.js` hoặc `data/quiz/<rank>.js`, rồi close issue với **Close as completed**.
- GitHub giới hạn 60 request/giờ cho mỗi IP khi không đăng nhập. Trang cache 1 phút và dùng ETag (request không đổi trả 304, không bị tính vào giới hạn). Nếu vẫn bị giới hạn, trang hiển thị dữ liệu đã lưu kèm thông báo.

## Thêm câu hỏi

Câu hỏi phỏng vấn (`data/questions/<rank>.js`):

```js
{
  id: "jun-q31",          // tiền tố: fre / jun / mid / sen
  topic: "state",         // key trong data/meta.js → TOPICS
  q: "Câu hỏi, dùng `backtick` cho code inline",
  a: "Đáp án mẫu",
  code: "optional: đoạn Dart nhiều dòng",
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

Sau khi sửa dữ liệu, chạy kiểm tra (cần Node 18+):

```bash
node scripts/validate.mjs          # tất cả rank
node scripts/validate.mjs junior   # một rank
```
