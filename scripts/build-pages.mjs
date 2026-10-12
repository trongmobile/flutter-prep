// Sinh lại các trang tĩnh (s/, phong-van/, sitemap.xml — xem scripts/pages.mjs).
// Chạy sau khi thêm/sửa câu hỏi:
//   node scripts/build-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPages, GENERATED_DIRS } from "./pages.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const pages = await allPages();
let written = 0;
for (const p of pages) {
  const file = path.join(root, p.path);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old !== p.content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, p.content);
    written++;
  }
}

// Xoá trang của câu hỏi/chủ đề không còn tồn tại, rồi xoá thư mục rỗng.
const wanted = new Set(pages.map((p) => p.path));
let removed = 0;
function prune(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) prune(rel);
    else if (e.name.endsWith(".html") && !wanted.has(rel)) {
      fs.unlinkSync(path.join(root, rel));
      removed++;
    }
  }
  if (!fs.readdirSync(abs).length) fs.rmdirSync(abs);
}
GENERATED_DIRS.forEach(prune);

console.log(`${pages.length} trang tĩnh · ${written} cập nhật · ${removed} xoá`);
