// Tạo lại thư mục s/ (trang chia sẻ cho từng câu). Chạy sau khi thêm/sửa câu hỏi:
//   node scripts/build-share-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allSharePages } from "./share-pages.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "s");
fs.mkdirSync(dir, { recursive: true });

const pages = allSharePages();
const wanted = new Set(pages.map((p) => `${p.id}.html`));
let written = 0;
for (const p of pages) {
  const file = path.join(dir, `${p.id}.html`);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old !== p.html) {
    fs.writeFileSync(file, p.html);
    written++;
  }
}
let removed = 0;
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".html") && !wanted.has(f)) {
    fs.unlinkSync(path.join(dir, f));
    removed++;
  }
}
console.log(`s/: ${pages.length} trang · ${written} cập nhật · ${removed} xoá`);
