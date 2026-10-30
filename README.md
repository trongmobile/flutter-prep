# interview

Website **Mobile Interview**: ôn phỏng vấn mobile theo nền tảng (**Flutter**, **Android** — Kotlin/Java, **iOS** — Swift, **React Native**) và rank (Fresher → Junior → Middle → Senior). Chọn nền tảng ở góc phải menu hoặc trên trang chủ; mỗi nền tảng có ngân hàng câu hỏi, quiz, lịch ôn và tiến độ riêng:

- **Ôn luyện**: câu hỏi phỏng vấn kèm đáp án mẫu, lọc theo chủ đề/trạng thái, tìm kiếm, đánh dấu _Đã thuộc_ / _Cần ôn lại_, chế độ **Flashcard**.
- **Quiz**: trắc nghiệm 4 đáp án theo rank hoặc tổng hợp, chọn chủ đề và số câu. Chế độ _Luyện tập_ (giải thích ngay) và _Thi thử_ (đếm giờ). Có màn xem lại bài và nút làm lại câu sai.
- **Bảng xếp hạng**: bài _Thi thử_ đề chuẩn (20 câu, không lọc chủ đề) được xếp hạng theo nền tảng × rank (và Tổng hợp), có bảng _Tuần này_ và _Mọi thời đại_. Người thi tự đặt biệt danh, không cần đăng nhập. Điểm lưu trên Supabase (xem [Bật bảng xếp hạng](#bật-bảng-xếp-hạng-supabase)).
- **Ôn hôm nay**: ôn tập ngắt quãng (hộp Leitner 1 → 3 → 7 → 14 → 30 → 60 ngày). Mỗi ngày gồm các câu đến hạn + vài câu mới; tự chấm _Quên / Khó / Nhớ_. Số câu cần ôn hiện trên menu.
- **Phỏng vấn thử**: bốc câu ngẫu nhiên theo rank (xen kẽ chủ đề), đếm giờ, ghi âm câu trả lời ngay trên trình duyệt để nghe lại, tự chấm; câu chưa tốt tự vào lịch ôn.
- **Lộ trình 35 ngày** (chỉ Flutter): lộ trình ~5 phút/ngày từ phiên bản đầu tiên. Tiến độ cũ vẫn được giữ.
- **Tiến độ**: chuỗi ngày học, mức độ thuộc bài theo rank, chủ đề hay sai, lịch sử quiz, sao lưu/khôi phục JSON.
- **Cộng đồng**: người dùng đóng góp câu hỏi, đề xuất tính năng, góp ý nội dung, báo lỗi, hỏi đáp; có Roadmap và trạng thái xử lý từng yêu cầu (dữ liệu lấy từ GitHub Issues). Câu hỏi được duyệt hiển thị tên người đóng góp.
- **Việc làm**: theo từng nền tảng, có lối tắt sang trang tìm kiếm đã lọc sẵn (chọn được Toàn quốc / Hà Nội / TP.HCM / Đà Nẵng) trên ITviec, TopDev, TopCV, VietnamWorks, CareerViet, LinkedIn, kèm tin tuyển dụng do cộng đồng đăng (GitHub Issues).
- **Chia sẻ**: mỗi câu có trang riêng `#/q/<id>` và link chia sẻ `s/<id>.html` với ảnh/tiêu đề preview riêng khi đăng lên Facebook, Zalo.
- **SEO**: site dùng `#hash` nên Google chỉ thấy trang chủ. `scripts/build-pages.mjs` sinh trang HTML tĩnh có sẵn nội dung cho từng câu (`s/<id>.html`), cho từng nền tảng / rank / chủ đề (`phong-van/...`) và `sitemap.xml`. Đáp án nằm trong ô bấm để xem, Google vẫn đọc được.
- **Cài như app (PWA)**: cài lên màn hình chính điện thoại, học được cả khi offline.

Đây là site tĩnh thuần HTML/CSS/JS (ES modules): không cần build, không có dependency. Tiến độ được lưu trong `localStorage` của trình duyệt; riêng bảng xếp hạng gửi biệt danh và điểm thi lên Supabase.

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
js/views/               home, study, review (Ôn hôm nay), quiz, leaderboard (Bảng xếp hạng), interview (Phỏng vấn thử),
                        roadmap, progress, jobs (Việc làm), community, question (#/q/<id>)
js/pwa.js, sw.js        đăng ký service worker, cài app, cache offline (network-first)
manifest.webmanifest    thông tin PWA (tên, icon, shortcut)
assets/                 icon app, og.png (preview trang chủ), og-<track>.png (preview trang chia sẻ)
s/<id>.html             trang tĩnh từng câu: link chia sẻ + trang cho Google (sinh bởi scripts/build-pages.mjs)
phong-van/              trang tổng hợp tĩnh theo nền tảng / rank / chủ đề (SEO)
sitemap.xml             danh sách trang tĩnh, gửi cho Google Search Console
js/config.js            repo GitHub dùng cho trang Cộng đồng, Supabase cho bảng xếp hạng
js/leaderboard.js       gọi API bảng xếp hạng (Supabase RPC), luật đề chuẩn, kiểm tra biệt danh
supabase/leaderboard.sql  bảng + hàm SQL của bảng xếp hạng (chạy một lần trong Supabase)
js/community.js         đọc GitHub Issues (cache + ETag), map label → trạng thái
js/jobs.js              trang tuyển dụng ngoài theo track, đọc tin tuyển dụng (label `type: job`)
.github/ISSUE_TEMPLATE/ form đóng góp (6 loại, gồm tin tuyển dụng) trên GitHub
.github/labels.json     label loại + trạng thái, được workflow labels.yml tự tạo
data/meta.js            danh sách rank (dùng chung)
data/tracks.js          danh sách track: tên, tiền tố id, ngôn ngữ code mặc định, mô tả rank, chủ đề
data/index.js           tải dữ liệu từng track khi cần (dynamic import) + các hàm truy vấn
data/<track>/index.js   gom dữ liệu của track (flutter, android, ios, react-native)
data/<track>/questions/<rank>.js  câu hỏi phỏng vấn theo rank
data/<track>/quiz/<rank>.js       câu quiz trắc nghiệm theo rank
data/flutter/roadmap.js lộ trình 35 ngày của Flutter (mỗi câu có rank + topic)
scripts/validate.mjs    kiểm tra schema dữ liệu, danh sách cache offline, trang chia sẻ
scripts/mkt/            script cho agent marketing: chọn câu của ngày, số liệu, đăng X/Threads, dựng video
```

Ngân hàng câu hỏi Flutter của mỗi rank = `data/flutter/questions/<rank>.js` + các câu trong lộ trình có `rank` tương ứng.

Thêm một nền tảng mới: khai báo trong `data/tracks.js`, tạo `data/<track>/` giống các track khác, thêm file vào `PRECACHE` của `sw.js`, tạo ảnh `assets/og-<track>.png`, rồi chạy `node scripts/build-pages.mjs` và `node scripts/validate.mjs`.

## Bật bảng xếp hạng (Supabase)

Bảng xếp hạng cần một nơi lưu điểm chung nên dùng [Supabase](https://supabase.com) (gói miễn phí là đủ). Khi `SUPABASE_URL` / `SUPABASE_KEY` trong `js/config.js` còn trống, menu _Bảng xếp hạng_ và các gợi ý trong Quiz tự ẩn.

1. Tạo project mới trên Supabase (nên chọn region Singapore cho gần Việt Nam).
2. Vào **SQL Editor**, dán toàn bộ `supabase/leaderboard.sql` rồi bấm **Run**. File chạy lại nhiều lần cũng được, không mất dữ liệu.
3. Vào **Project Settings → API Keys**, copy **Project URL** và **publishable key** (hoặc `anon` key kiểu cũ), điền vào `js/config.js`:
   ```js
   export const SUPABASE_URL = "https://<project>.supabase.co";
   export const SUPABASE_KEY = "sb_publishable_...";
   ```
4. Commit và push. Menu _Bảng xếp hạng_ sẽ hiện.

Key này được phép công khai: hai bảng bật RLS và không có policy, trình duyệt chỉ gọi được 3 hàm `lb_set_nickname`, `lb_submit`, `lb_board`. Mỗi máy tự sinh một mã người chơi bí mật (nằm trong file sao lưu ở trang Tiến độ, nên chuyển máy vẫn giữ được biệt danh); bảng xếp hạng không bao giờ trả về mã này.

Luật tính hạng:

- Chỉ tính bài _Thi thử_ đúng 20 câu, không lọc chủ đề, không phải "Làm lại câu sai". Nút _Thi ngay_ trên trang Bảng xếp hạng mở thẳng đề chuẩn (`#/<track>/quiz?rank=<rank>&ranked=1`).
- Xếp theo số câu đúng; bằng điểm thì ai làm nhanh hơn đứng trên, rồi tới ai nộp sớm hơn. Mỗi người chỉ tính bài tốt nhất trên từng bảng.
- Bảng tuần tính từ 0h thứ Hai, giờ Việt Nam.
- Lần đầu thi đề chuẩn, màn kết quả hỏi biệt danh (có thể bỏ qua). Từ lần sau điểm tự gửi lên.

Chống gian lận chỉ ở mức cơ bản: đáp án nằm sẵn trong file JS nên ai cố tình vẫn gian lận được. Máy chủ từ chối kết quả bất thường (khác 20 câu, dưới 2 giây/câu, quá giờ), giới hạn 1 bài/30 giây cho mỗi bảng và 100 bài/ngày cho mỗi người. Biệt danh dài 2–20 ký tự, không trùng (không phân biệt hoa thường), có lọc vài từ tục: muốn thêm từ thì sửa mảng trong `lb_clean_nickname` rồi chạy lại file SQL.

Quản trị trong **SQL Editor** của Supabase:

```sql
-- Xem bài nộp gần đây
select p.nickname, s.* from lb_scores s join lb_players p on p.id = s.player_id order by s.created_at desc limit 50;
-- Xoá một bài bất thường
delete from lb_scores where id = 123;
-- Đổi tên người chơi
update lb_players set nickname = 'Tên mới' where lower(nickname) = lower('tên cũ');
-- Xoá người chơi cùng toàn bộ điểm
delete from lb_players where lower(nickname) = lower('tên');
```

Project miễn phí của Supabase tự tạm dừng nếu cả tuần không có request nào. Khi đó bật lại trong dashboard; trong lúc tạm dừng, trang Bảng xếp hạng chỉ báo không kết nối được, các phần khác của site vẫn chạy bình thường.

## Thống kê truy cập

Site dùng [GoatCounter](https://www.goatcounter.com) (miễn phí, không dùng cookie nên không cần banner xin đồng ý). Xem số liệu tại https://interview.goatcounter.com.

- Site dùng hash route (`#/quiz`, `#/study/junior`) nên `index.html` tắt đếm tự động (`no_onload`), còn `js/analytics.js` đếm mỗi lần đổi trang. Đường dẫn được gửi dạng `/flutter-prep/#/quiz` (bỏ phần `?query`).
- Lượt xem từ `localhost` không được tính.
- Muốn bỏ qua lượt truy cập của chính bạn: vào Settings của GoatCounter và thêm IP của bạn vào mục bỏ qua.

## Marketing tự động

Hai routine của Claude Code (chạy trên cloud theo lịch, quản lý tại https://claude.ai/code/routines) dùng các script trong `scripts/mkt/`:

- **Đăng bài hằng ngày** (20h giờ Việt Nam): đăng một câu phỏng vấn lên X và Threads. Tối Chủ nhật đổi thành bài vinh danh top bảng xếp hạng tuần.
- **Video hằng ngày** (19h): dựng một video dọc 1080×1920 khoảng 30 giây (câu hỏi, đếm ngược 5 giây, đáp án, lời mời vào trang) bằng `scripts/mkt/video.py`. Video được xuất bản thành một trang riêng tư trên Claude, kèm nút lưu video và caption, để tự đăng Reels / TikTok. Video không có nhạc: chọn nhạc ngay trong app khi đăng.
- **Báo cáo tuần** (22h Chủ nhật): ghi báo cáo vào Claude Docs gồm lượt xem, bảng xếp hạng, issue cộng đồng, gợi ý nội dung/SEO, bản nháp bài cho nhóm Facebook/LinkedIn (đăng tay) và lịch câu tuần tới.

```bash
node scripts/mkt/pick.mjs            # câu của hôm nay; --next 7 để xem lịch tuần tới
node scripts/mkt/stats.mjs           # số liệu dạng JSON; thêm "leaderboard" để chỉ lấy bảng xếp hạng
node scripts/mkt/post.mjs --x x.txt --threads threads.txt --dry-run   # kiểm tra độ dài, bỏ --dry-run để đăng
node scripts/mkt/pick.mjs --video    # câu cho video hôm nay (lịch riêng, không trùng bài viết)
pip install pillow imageio-ffmpeg && python3 scripts/mkt/video.py render video.json out/   # dựng video, xem mô tả video.json đầu file
```

Font trong `scripts/mkt/fonts/` (Be Vietnam Pro, JetBrains Mono) dùng giấy phép SIL Open Font License, kèm file OFL.

Token đặt trong biến môi trường của environment chạy routine, không đưa vào repo: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `THREADS_ACCESS_TOKEN`, `GOATCOUNTER_TOKEN` và `GITHUB_TOKEN` (tuỳ chọn, chỉ cần quyền đọc public repo). Kênh nào thiếu token thì script bỏ qua. Token Threads hết hạn sau 60 ngày.

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

- **Loại đóng góp** do issue template tự gắn: `type: question`, `type: feature`, `type: content`, `type: bug`, `type: discussion`, `type: job`.
- **Tin tuyển dụng** (`type: job`) không hiện ở trang Cộng đồng mà ở trang **Việc làm**, lọc theo trường "Nền tảng". Tin tự ẩn sau 60 ngày; gỡ tin sớm (tuyển xong, spam) bằng cách close issue.
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
  doc: "https://docs.flutter.dev/perf/impeller", // optional: link https tới tài liệu chính thức, hiện nút "Đọc thêm trong tài liệu"
  by: "octocat",          // optional: GitHub username người đóng góp
  issue: 12,              // optional: số issue trên trang Cộng đồng (cần có `by`)
}
```

Trường `doc` dùng được cho cả câu quiz. Chỉ gắn link trang tài liệu chính thức đã mở thử, đúng chủ đề của câu hỏi.

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

Sau khi thêm/sửa câu hỏi, tạo lại trang tĩnh rồi chạy kiểm tra (cần Node 18+):

```bash
node scripts/build-pages.mjs              # cập nhật s/, phong-van/, sitemap.xml
node scripts/validate.mjs                 # mọi track + cache offline + trang tĩnh
node scripts/validate.mjs android         # chỉ kiểm tra dữ liệu một track
node scripts/validate.mjs android junior  # chỉ một rank của một track
```

Thêm file JS/CSS mới thì nhớ thêm vào danh sách `PRECACHE` trong `sw.js` (validator sẽ báo nếu thiếu), và tăng `CACHE` (`interview-v2` → `interview-v3`) nếu muốn xoá cache cũ trên máy người dùng.
