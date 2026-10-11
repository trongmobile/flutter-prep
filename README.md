# interview

Website ôn phỏng vấn Flutter theo rank (Fresher → Junior → Middle → Senior):

- **Ôn luyện**: câu hỏi phỏng vấn kèm đáp án mẫu, lọc theo chủ đề/trạng thái, tìm kiếm, đánh dấu _Đã thuộc_ / _Cần ôn lại_, chế độ **Flashcard**.
- **Quiz**: trắc nghiệm 4 đáp án theo rank hoặc tổng hợp, chọn chủ đề và số câu. Chế độ _Luyện tập_ (giải thích ngay) và _Thi thử_ (đếm giờ). Có màn xem lại bài và nút làm lại câu sai.
- **Lộ trình 35 ngày**: lộ trình ~5 phút/ngày từ phiên bản đầu tiên. Tiến độ cũ vẫn được giữ.
- **Tiến độ**: chuỗi ngày học, mức độ thuộc bài theo rank, chủ đề hay sai, lịch sử quiz, sao lưu/khôi phục JSON.

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
js/views/               home, study, quiz, roadmap, progress
data/meta.js            danh sách rank + chủ đề
data/roadmap.js         lộ trình 35 ngày (mỗi câu có rank + topic)
data/questions/<rank>.js  câu hỏi phỏng vấn bổ sung theo rank
data/quiz/<rank>.js       câu quiz trắc nghiệm theo rank
scripts/validate.mjs    kiểm tra schema dữ liệu
```

Ngân hàng câu hỏi của mỗi rank = `data/questions/<rank>.js` + các câu trong lộ trình có `rank` tương ứng.

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
