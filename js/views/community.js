import { RANKS, TRACKS, getRank, getTrack, trackOfId, currentTrack, findItem, loadTrack, loadAllTracks, contributors } from "../../data/index.js";
import { GITHUB_URL } from "../config.js";
import {
  TYPES,
  STATUSES,
  STATUS_FLOW,
  getType,
  getStatus,
  newIssueUrl,
  loadIssues,
  loadIssue,
  loadComments,
  sanitizeHtml,
  timeAgo,
  RateLimitError,
} from "../community.js";
import { escapeHtml } from "../utils.js";
import { jobOf } from "../jobs.js";

const SORTS = [
  { id: "new", label: "Mới nhất", fn: (a, b) => b.created.localeCompare(a.created) },
  { id: "votes", label: "Nhiều bình chọn", fn: (a, b) => b.votes - a.votes || b.created.localeCompare(a.created) },
  { id: "comments", label: "Nhiều phản hồi", fn: (a, b) => b.comments - a.comments || b.created.localeCompare(a.created) },
  { id: "updated", label: "Mới cập nhật", fn: (a, b) => b.updated.localeCompare(a.updated) },
];
const TABS = [
  { id: "", label: "Thảo luận" },
  { id: "roadmap", label: "Roadmap" },
  { id: "features", label: "Đề xuất tính năng" },
];
const ROADMAP_COLUMNS = ["planned", "in-progress", "done"];

// Bộ lọc giữ nguyên khi chuyển qua lại giữa các trang.
const ui = { sort: "new", search: "", type: "all", status: "all" };

export function mount(el, params, query) {
  const first = params[0] || "";
  if (/^\d+$/.test(first)) return mountDetail(el, Number(first));
  if (first === "new") return mountCompose(el, query);
  const tab = TABS.some((t) => t.id === first) ? first : "";
  return mountBoard(el, tab);
}

// ---------- Thành phần dùng chung ----------
function avatar(url, login, size = 22) {
  let src = "";
  if (/^https:\/\//.test(url)) {
    const u = new URL(url);
    u.searchParams.set("s", String(size * 2));
    src = u.href;
  }
  return src
    ? `<img class="avatar" src="${escapeHtml(src)}" alt="" width="${size}" height="${size}" loading="lazy" />`
    : `<span class="avatar avatar-empty" style="width:${size}px;height:${size}px">${escapeHtml((login || "?")[0].toUpperCase())}</span>`;
}
function statusPill(id, typeId) {
  if (typeId === "job") {
    return id === "done" || id === "declined" ? `<span class="status-pill st-gray">Đã đóng tuyển</span>` : `<span class="status-pill st-green">Đang tuyển</span>`;
  }
  const s = getStatus(id);
  const name = id === "done" && typeId === "discussion" ? "Đã giải quyết" : s.name;
  return `<span class="status-pill st-${s.color}">${name}</span>`;
}
function typeTag(id) {
  return `<span class="type-tag type-${id}">${escapeHtml(getType(id).short)}</span>`;
}
function voteBox(item) {
  return `<span class="vote-box" title="${item.votes} lượt bình chọn 👍"><span class="vote-arrow">▲</span>${item.votes}</span>`;
}
function errorText(err) {
  if (err instanceof RateLimitError) {
    const when = err.resetAt ? ` Thử lại sau ${new Date(err.resetAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.` : "";
    return `GitHub tạm giới hạn số lượt tải (60 lượt/giờ cho mỗi mạng).${when}`;
  }
  return err && err.message ? err.message : "Không tải được dữ liệu từ GitHub.";
}

// Những người có câu hỏi được thêm vào ngân hàng (trường `by` trong dữ liệu).
function contributorsBlock() {
  const list = contributors();
  if (!list.length) return "";
  return `
    <div class="side-block">
      <h2 class="side-title">Người đóng góp câu hỏi</h2>
      <ul class="contributor-list">
        ${list
          .slice(0, 10)
          .map(
            (c) => `<li><a href="https://github.com/${escapeHtml(c.login)}" target="_blank" rel="noopener">${avatar(`https://avatars.githubusercontent.com/${encodeURIComponent(c.login)}?v=4`, c.login)}<span>@${escapeHtml(c.login)}</span></a><span class="count">${c.count} câu</span></li>`,
          )
          .join("")}
      </ul>
    </div>`;
}

// ---------- Bảng cộng đồng ----------
function mountBoard(el, tab) {
  let items = null;
  let notice = "";

  el.innerHTML = `
    <header class="community-head">
      <div>
        <div class="eyebrow">cộng đồng · github issues</div>
        <h1>Cộng đồng</h1>
        <p class="subtitle">Đóng góp câu hỏi phỏng vấn, đề xuất tính năng, báo lỗi — và theo dõi trạng thái xử lý từng yêu cầu.</p>
      </div>
      <a class="btn btn-primary" href="#/community/new">+ Tạo đóng góp</a>
    </header>
    <nav class="tabs" aria-label="Mục cộng đồng">
      ${TABS.map(
        (t) =>
          `<a class="tab${t.id === tab ? " active" : ""}" href="#/community${t.id ? "/" + t.id : ""}" ${t.id === tab ? 'aria-current="page"' : ""}>${t.label}${
            t.id === "features" ? ' <span class="count" data-slot="feature-count"></span>' : ""
          }</a>`,
      ).join("")}
    </nav>
    <div data-slot="notice"></div>
    <div data-slot="body">${skeleton()}</div>
  `;
  const slot = (n) => el.querySelector(`[data-slot="${n}"]`);
  // Người đóng góp tính trên mọi track: tải dữ liệu các track còn lại rồi vẽ lại khối này.
  loadAllTracks().then(() => {
    const s = slot("contributors");
    if (s) s.innerHTML = contributorsBlock();
  });

  function skeleton() {
    return `<div class="skeleton-list">${'<div class="skeleton"></div>'.repeat(4)}</div>`;
  }

  async function load(force) {
    try {
      const res = await loadIssues({ force });
      if (!el.isConnected) return;
      items = res.items.filter((i) => i.type !== "job"); // tin tuyển dụng nằm ở trang Việc làm
      notice = res.stale
        ? `${errorText(res.error)} Đang hiển thị dữ liệu đã lưu lúc ${new Date(res.fetchedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`
        : "";
      render();
    } catch (err) {
      if (!el.isConnected) return;
      slot("body").innerHTML = `
        <div class="empty">
          <p>${escapeHtml(errorText(err))}</p>
          <div class="btn-row center">
            <button type="button" class="btn btn-ghost" data-action="refresh">Thử lại</button>
            <a class="btn btn-ghost" href="${GITHUB_URL}/issues" target="_blank" rel="noopener">Xem trên GitHub ↗</a>
          </div>
        </div>`;
    }
  }

  function render() {
    slot("notice").innerHTML = notice ? `<div class="notice">${escapeHtml(notice)}</div>` : "";
    const fc = slot("feature-count");
    if (fc) fc.textContent = items.filter((i) => i.type === "feature").length;
    if (tab === "roadmap") renderRoadmap();
    else if (tab === "features") renderFeatures();
    else renderDiscuss();
  }

  // ----- Tab Thảo luận -----
  function filtered() {
    const needle = ui.search.toLowerCase();
    return items
      .filter((i) => ui.type === "all" || i.type === ui.type)
      .filter((i) => ui.status === "all" || i.status === ui.status)
      .filter((i) => !needle || (i.title + " " + i.excerpt + " " + i.author).toLowerCase().includes(needle))
      .sort(SORTS.find((s) => s.id === ui.sort).fn);
  }

  function postCard(i) {
    return `
      <a class="post" href="#/community/${i.number}">
        <div class="post-meta">
          ${avatar(i.avatar, i.author)}<strong>${escapeHtml(i.author)}</strong>${i.staff ? '<span class="staff">Quản trị</span>' : ""}
          <span class="muted">· ${timeAgo(i.created)}</span>
          ${typeTag(i.type)}
        </div>
        <h3 class="post-title">${escapeHtml(i.title)}</h3>
        ${i.excerpt ? `<p class="post-excerpt">${escapeHtml(i.excerpt)}</p>` : ""}
        <div class="post-foot">
          ${statusPill(i.status, i.type)}
          <span class="pill-stat">💬 ${i.comments} phản hồi</span>
          <span class="pill-stat">▲ ${i.votes} bình chọn</span>
          ${i.meta.length ? `<span class="post-extra">${escapeHtml(i.meta.join(" · "))}</span>` : ""}
        </div>
      </a>`;
  }

  function renderDiscuss() {
    const list = filtered();
    const typeCount = (id) => items.filter((i) => id === "all" || i.type === id).length;
    const statusCount = (id) => items.filter((i) => (ui.type === "all" || i.type === ui.type) && (id === "all" || i.status === id)).length;
    const hasOther = items.some((i) => i.type === "other");

    slot("body").innerHTML = `
      <div class="community-layout">
        <div class="community-main">
          <div class="toolbar">
            <select class="select" data-control="sort" aria-label="Sắp xếp">
              ${SORTS.map((s) => `<option value="${s.id}" ${ui.sort === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
            <input type="search" class="search" data-control="search" placeholder="Tìm kiếm..." aria-label="Tìm đóng góp" value="${escapeHtml(ui.search)}" />
          </div>
          <div data-slot="list">${listHtml(list)}</div>
        </div>
        <aside class="community-side">
          <div class="side-block">
            <h2 class="side-title">Danh mục</h2>
            <div class="chips">
              <button type="button" class="chip${ui.type === "all" ? " active" : ""}" data-type="all">Tất cả <span class="count">${typeCount("all")}</span></button>
              ${TYPES.filter((t) => t.id !== "job").map(
                (t) =>
                  `<button type="button" class="chip${ui.type === t.id ? " active" : ""}" data-type="${t.id}">${t.name} <span class="count">${typeCount(t.id)}</span></button>`,
              ).join("")}
              ${hasOther ? `<button type="button" class="chip${ui.type === "other" ? " active" : ""}" data-type="other">Khác <span class="count">${typeCount("other")}</span></button>` : ""}
            </div>
          </div>
          <div class="side-block">
            <h2 class="side-title">Trạng thái</h2>
            <ul class="status-list">
              <li><button type="button" class="${ui.status === "all" ? "active" : ""}" data-status="all"><span>Tất cả</span><span class="count">${statusCount("all")}</span></button></li>
              ${STATUSES.map(
                (s) =>
                  `<li><button type="button" class="${ui.status === s.id ? "active" : ""}" data-status="${s.id}"><span><i class="st-dot st-${s.color}"></i>${s.name}</span><span class="count">${statusCount(s.id)}</span></button></li>`,
              ).join("")}
            </ul>
          </div>
          <div class="side-block">
            <h2 class="side-title">Quy trình xử lý</h2>
            <ol class="flow-mini">
              ${STATUS_FLOW.map((id) => `<li><i class="st-dot st-${getStatus(id).color}"></i>${getStatus(id).name}</li>`).join("")}
            </ol>
            <p class="muted small">Bình chọn 👍 trên GitHub để ưu tiên yêu cầu bạn quan tâm.</p>
          </div>
          <div class="side-slot" data-slot="contributors">${contributorsBlock()}</div>
          <div class="side-block side-links">
            <button type="button" class="link-btn" data-action="refresh">↻ Làm mới</button>
            <a class="link-btn" href="${GITHUB_URL}/issues" target="_blank" rel="noopener">Mở trên GitHub ↗</a>
          </div>
        </aside>
      </div>`;
  }

  function listHtml(list) {
    if (list.length) return `<div class="post-list">${list.map(postCard).join("")}</div>`;
    if (!items.length) {
      return `<div class="empty">
        <p><strong>Chưa có đóng góp nào.</strong><br />Hãy là người đầu tiên đóng góp câu hỏi hoặc ý tưởng!</p>
        <a class="btn btn-primary" href="#/community/new">+ Tạo đóng góp</a>
      </div>`;
    }
    return `<div class="empty"><p>Không có đóng góp nào khớp bộ lọc.</p>
      <button type="button" class="btn btn-ghost" data-action="clear">Xoá bộ lọc</button></div>`;
  }

  // ----- Tab Roadmap -----
  function renderRoadmap() {
    const roadmapItems = items.filter((i) => i.type !== "discussion");
    slot("body").innerHTML = `
      <p class="muted roadmap-intro">Những yêu cầu đã được duyệt và tiến độ thực hiện. Mục hoàn thành hiển thị 10 mục cập nhật gần nhất.</p>
      <div class="kanban">
        ${ROADMAP_COLUMNS.map((id) => {
          const s = getStatus(id);
          let col = roadmapItems.filter((i) => i.status === id);
          col = id === "done" ? col.sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 10) : col.sort((a, b) => b.votes - a.votes);
          return `
            <section class="kanban-col">
              <h2 class="kanban-head"><i class="st-dot st-${s.color}"></i>${s.name}<span class="count">${col.length}</span></h2>
              <div class="kanban-body">
                ${
                  col.length
                    ? col
                        .map(
                          (i) => `
                    <a class="kanban-card" href="#/community/${i.number}">
                      ${voteBox(i)}
                      <span class="kanban-text"><span class="kanban-title">${escapeHtml(i.title)}</span>${typeTag(i.type)}</span>
                    </a>`,
                        )
                        .join("")
                    : `<p class="kanban-empty">Chưa có mục nào</p>`
                }
              </div>
            </section>`;
        }).join("")}
      </div>`;
  }

  // ----- Tab Đề xuất tính năng -----
  function renderFeatures() {
    const features = items.filter((i) => i.type === "feature");
    const shown = features
      .filter((i) => ui.status === "all" || i.status === ui.status)
      .sort((a, b) => b.votes - a.votes || b.created.localeCompare(a.created));
    slot("body").innerHTML = `
      <div class="feature-top">
        <div class="chips">
          <button type="button" class="chip${ui.status === "all" ? " active" : ""}" data-status="all">Tất cả <span class="count">${features.length}</span></button>
          ${STATUSES.map((s) => {
            const n = features.filter((i) => i.status === s.id).length;
            return n || ui.status === s.id
              ? `<button type="button" class="chip${ui.status === s.id ? " active" : ""}" data-status="${s.id}"><i class="st-dot st-${s.color}"></i>${s.name} <span class="count">${n}</span></button>`
              : "";
          }).join("")}
        </div>
        <a class="btn btn-ghost" href="#/community/new?type=feature">+ Đề xuất tính năng</a>
      </div>
      ${
        shown.length
          ? `<div class="feature-list">${shown
              .map(
                (i) => `
            <a class="feature-row" href="#/community/${i.number}">
              ${voteBox(i)}
              <span class="feature-main">
                <span class="post-title">${escapeHtml(i.title)}</span>
                ${i.excerpt ? `<span class="post-excerpt">${escapeHtml(i.excerpt)}</span>` : ""}
                <span class="post-foot">${statusPill(i.status, i.type)}<span class="pill-stat">💬 ${i.comments}</span><span class="muted small">${escapeHtml(i.author)} · ${timeAgo(i.created)}</span></span>
              </span>
            </a>`,
              )
              .join("")}</div>`
          : `<div class="empty"><p>${features.length ? "Không có đề xuất nào ở trạng thái này." : "Chưa có đề xuất tính năng nào."}</p>
              <a class="btn btn-primary" href="#/community/new?type=feature">+ Đề xuất tính năng</a></div>`
      }`;
  }

  // ----- Sự kiện -----
  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.type) {
      ui.type = t.dataset.type;
      return render();
    }
    if (t.dataset.status) {
      ui.status = t.dataset.status;
      return render();
    }
    if (t.dataset.action === "refresh") {
      slot("body").innerHTML = skeleton();
      return load(true);
    }
    if (t.dataset.action === "clear") {
      ui.type = "all";
      ui.status = "all";
      ui.search = "";
      return render();
    }
  });
  el.addEventListener("change", (e) => {
    if (e.target.dataset.control === "sort") {
      ui.sort = e.target.value;
      slot("list").innerHTML = listHtml(filtered());
    }
  });
  let searchTimer = null;
  el.addEventListener("input", (e) => {
    if (e.target.dataset.control !== "search") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      ui.search = e.target.value.trim();
      slot("list").innerHTML = listHtml(filtered());
    }, 150);
  });

  load(false);
  return { destroy: () => clearTimeout(searchTimer) };
}

// ---------- Chi tiết một đóng góp ----------
function mountDetail(el, number) {
  el.innerHTML = `
    <a class="back-link" href="#/community" data-slot="back">← Cộng đồng</a>
    <div data-slot="detail"><div class="skeleton tall"></div></div>
    <div data-slot="comments"></div>`;
  const slot = (n) => el.querySelector(`[data-slot="${n}"]`);

  function tracker(status) {
    if (status === "declined") {
      return `<div class="tracker declined"><span class="status-pill st-red">Không thực hiện</span><span class="muted small">Yêu cầu đã được xem xét nhưng sẽ không thực hiện — xem phản hồi bên dưới để biết lý do.</span></div>`;
    }
    const current = STATUS_FLOW.indexOf(status);
    return `<ol class="tracker" aria-label="Trạng thái xử lý">
      ${STATUS_FLOW.map((id, idx) => {
        const cls = idx < current ? "done" : idx === current ? "current" : "";
        return `<li class="${cls}"><span class="tracker-dot"></span><span class="tracker-label">${getStatus(id).name}</span></li>`;
      }).join("")}
    </ol>`;
  }

  (async () => {
    let item;
    try {
      item = await loadIssue(number);
    } catch (err) {
      if (!el.isConnected) return;
      slot("detail").innerHTML = `<div class="empty"><p>${escapeHtml(errorText(err))}</p>
        <a class="btn btn-ghost" href="${GITHUB_URL}/issues/${number}" target="_blank" rel="noopener">Mở trên GitHub ↗</a></div>`;
      return;
    }
    if (!el.isConnected) return;
    document.title = `${item.title} — ${item.type === "job" ? "Việc làm" : "Cộng đồng"}`;
    if (item.type === "job") Object.assign(slot("back"), { href: "#/jobs", textContent: "← Việc làm" });
    slot("detail").innerHTML = `
      <article class="card post-detail">
        <div class="post-meta">
          ${avatar(item.avatar, item.author, 28)}<strong>${escapeHtml(item.author)}</strong>${item.staff ? '<span class="staff">Quản trị</span>' : ""}
          <span class="muted">· ${timeAgo(item.created)}</span>
          ${typeTag(item.type)}
          <span class="muted issue-no">#${item.number}</span>
        </div>
        <h1 class="detail-h1">${escapeHtml(item.title)}</h1>
        <div class="detail-status">${statusPill(item.status, item.type)}</div>
        ${item.type !== "discussion" && item.type !== "job" ? tracker(item.status) : ""}
        <div class="md">${sanitizeHtml(item.bodyHtml) || '<p class="muted">Không có nội dung.</p>'}</div>
        <div class="btn-row detail-actions">
          ${
            item.type === "job"
              ? jobOf(item).applyUrl
                ? `<a class="btn btn-ghost" href="${escapeHtml(jobOf(item).applyUrl)}" target="_blank" rel="noopener noreferrer nofollow">Ứng tuyển ↗</a>`
                : ""
              : `<a class="btn btn-ghost" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">▲ Bình chọn (${item.votes}) trên GitHub</a>`
          }
          <a class="btn btn-primary" href="${escapeHtml(item.url)}#new_comment_field" target="_blank" rel="noopener">Phản hồi trên GitHub ↗</a>
        </div>
      </article>`;

    if (!item.comments) {
      slot("comments").innerHTML = `<section><div class="section-head"><h2>Phản hồi</h2></div><p class="muted">Chưa có phản hồi nào.</p></section>`;
      return;
    }
    slot("comments").innerHTML = `<section><div class="section-head"><h2>Phản hồi (${item.comments})</h2></div><div class="skeleton"></div></section>`;
    try {
      const comments = await loadComments(number);
      if (!el.isConnected) return;
      slot("comments").innerHTML = `
        <section>
          <div class="section-head"><h2>Phản hồi (${comments.length})</h2></div>
          <div class="comment-list">
            ${comments
              .map(
                (c) => `
              <article class="comment${c.staff ? " is-staff" : ""}">
                <div class="post-meta">${avatar(c.avatar, c.author)}<strong>${escapeHtml(c.author)}</strong>${c.staff ? '<span class="staff">Quản trị</span>' : ""}<span class="muted">· ${timeAgo(c.created)}</span></div>
                <div class="md">${sanitizeHtml(c.bodyHtml)}</div>
              </article>`,
              )
              .join("")}
          </div>
        </section>`;
    } catch (err) {
      if (!el.isConnected) return;
      slot("comments").innerHTML = `<section><div class="section-head"><h2>Phản hồi</h2></div>
        <p class="muted">${escapeHtml(errorText(err))} <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Xem trên GitHub ↗</a></p></section>`;
    }
  })();
}

// ---------- Tạo đóng góp ----------
const MAX_URL = 7000; // GitHub trả 414 khi URL quá dài

// trackName: nền tảng đang chọn trong form -> danh sách chủ đề tương ứng.
function fieldsFor(typeId, trackName) {
  const rankOptions = RANKS.map((r) => r.name);
  const track = TRACKS.find((t) => t.name === trackName) || currentTrack();
  const topicOptions = Object.values(track.topics);
  switch (typeId) {
    case "question":
      return [
        { id: "track", label: "Nền tảng", kind: "select", options: TRACKS.map((t) => t.name), required: true },
        { id: "rank", label: "Rank", kind: "select", options: rankOptions, required: true },
        { id: "topic", label: "Chủ đề", kind: "select", options: topicOptions },
        { id: "kind", label: "Loại", kind: "select", options: ["Câu hỏi phỏng vấn", "Câu quiz trắc nghiệm"] },
        { id: "question", label: "Câu hỏi", kind: "textarea", required: true, hint: "Với câu quiz, ghi kèm 4 đáp án A–D." },
        { id: "answer", label: "Đáp án gợi ý", kind: "textarea", hint: "Đáp án mẫu hoặc đáp án đúng kèm giải thích." },
      ];
    case "feature":
      return [
        { id: "details", label: "Mô tả tính năng", kind: "textarea", required: true },
        { id: "why", label: "Vì sao cần tính năng này?", kind: "textarea" },
      ];
    case "content":
      return [
        { id: "location", label: "Vị trí nội dung", kind: "input", required: true, hint: "Link hoặc nội dung câu hỏi cần góp ý." },
        { id: "details", label: "Nội dung góp ý", kind: "textarea", required: true, hint: "Điểm nào chưa đúng / chưa rõ và nên sửa thành gì?" },
      ];
    case "job":
      return [
        { id: "track", label: "Nền tảng", kind: "input", required: true, hint: "Nhiều nền tảng thì cách nhau bằng dấu phẩy, vd. Flutter, React Native." },
        { id: "company", label: "Công ty", kind: "input", required: true },
        { id: "rank", label: "Cấp độ", kind: "select", options: rankOptions },
        { id: "location", label: "Địa điểm", kind: "input", required: true, hint: "VD: Hà Nội, TP.HCM, Remote." },
        { id: "mode", label: "Hình thức", kind: "input", hint: "VD: Full-time · Hybrid." },
        { id: "salary", label: "Mức lương", kind: "input", hint: "VD: 25–40 triệu, Thoả thuận." },
        { id: "apply", label: "Link ứng tuyển hoặc email", kind: "input", required: true },
        { id: "details", label: "Mô tả công việc", kind: "textarea", required: true, hint: "Yêu cầu, quyền lợi, quy trình phỏng vấn..." },
      ];
    case "bug":
      return [
        { id: "details", label: "Mô tả lỗi", kind: "textarea", required: true },
        { id: "steps", label: "Các bước tái hiện", kind: "textarea" },
        { id: "env", label: "Thiết bị / trình duyệt", kind: "input" },
      ];
    default:
      return [{ id: "details", label: "Nội dung", kind: "textarea", required: true }];
  }
}

function describeEnv() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Trình duyệt khác";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? " · " + os : ""} · ${window.innerWidth}×${window.innerHeight}`;
}

// ?type=content&ref=<id câu hỏi> -> điền sẵn vị trí nội dung (track của câu phải được tải trước).
function refLocation(ref) {
  const found = findItem(ref);
  if (!found) return "";
  const { item: q, kind } = found;
  const text = q.q.length > 90 ? q.q.slice(0, 90) + "…" : q.q;
  return `[${q.id}] ${kind === "quiz" ? "quiz" : "câu hỏi"} ${getTrack(q.track).name} ${getRank(q.rank)?.name || q.rank}: ${text}`;
}

function mountCompose(el, query) {
  const state = {
    type: TYPES.some((t) => t.id === query.type) ? query.type : null,
    values: {},
    sent: false,
  };
  state.values.track = currentTrack().name;
  if (query.ref) {
    loadTrack(trackOfId(query.ref).id).then(() => {
      if (state.values.location || !el.isConnected) return;
      state.values.location = refLocation(query.ref);
      const input = el.querySelector("#f-location");
      if (input && !input.value) input.value = state.values.location;
    });
  }

  function render() {
    const isJob = state.type === "job";
    const back = isJob ? `<a class="back-link" href="#/jobs">← Việc làm</a>` : `<a class="back-link" href="#/community">← Cộng đồng</a>`;
    if (state.sent) {
      el.innerHTML = `
        ${back}
        <div class="card sent-card">
          <h1>Đã mở GitHub ở tab mới ✓</h1>
          <p class="muted">Kiểm tra lại nội dung rồi bấm <strong>Create</strong> trên GitHub. ${isJob ? "Tin sẽ xuất hiện ở trang Việc làm" : "Đóng góp sẽ xuất hiện ở trang Cộng đồng"} sau khoảng 1 phút, và bạn nhận thông báo qua GitHub khi có phản hồi hoặc khi trạng thái thay đổi.</p>
          <p class="muted small">GitHub chưa mở? <a href="${escapeHtml(state.url)}" target="_blank" rel="noopener">Bấm vào đây để mở</a>.</p>
          ${state.copied ? `<p class="notice">Nội dung khá dài nên đã được <strong>copy vào clipboard</strong> — hãy dán vào các ô tương ứng trên GitHub.</p>` : ""}
          <div class="btn-row">
            <a class="btn btn-primary" href="${isJob ? "#/jobs" : "#/community"}">Về trang ${isJob ? "Việc làm" : "Cộng đồng"}</a>
            <button type="button" class="btn btn-ghost" data-action="again">Tạo đóng góp khác</button>
          </div>
        </div>`;
      return;
    }
    const fields = state.type ? fieldsFor(state.type, state.values.track) : [];
    if (state.type === "bug" && !state.values.env) state.values.env = describeEnv();
    el.innerHTML = `
      ${back}
      <header class="view-head">
        <div class="eyebrow">cộng đồng · đóng góp</div>
        <h1>Tạo đóng góp</h1>
        <p class="subtitle">Đóng góp được gửi dưới dạng GitHub Issue (cần tài khoản GitHub miễn phí). Bạn điền ở đây, rồi xem lại và bấm gửi trên GitHub.</p>
      </header>
      <div class="type-grid" role="radiogroup" aria-label="Loại đóng góp">
        ${TYPES.map(
          (t) => `
          <button type="button" class="type-card type-${t.id}${state.type === t.id ? " active" : ""}" data-pick="${t.id}" role="radio" aria-checked="${state.type === t.id}">
            <strong>${t.name}</strong><span>${t.desc}</span>
          </button>`,
        ).join("")}
      </div>
      ${
        state.type
          ? `<form class="card compose-form" novalidate>
              <div class="field">
                <label for="f-title">Tiêu đề <span class="req">*</span></label>
                <input id="f-title" name="title" class="input" maxlength="140" required value="${escapeHtml(state.values.title || "")}" placeholder="${isJob ? "Vị trí tuyển, vd. Senior Flutter Developer" : "Tóm tắt ngắn gọn trong một câu"}" />
              </div>
              ${fields
                .map((f) => {
                  const v = state.values[f.id] || "";
                  const label = `<label for="f-${f.id}">${f.label}${f.required ? ' <span class="req">*</span>' : ""}</label>`;
                  const hint = f.hint ? `<span class="field-hint">${f.hint}</span>` : "";
                  let control;
                  if (f.kind === "select") {
                    control = `<select id="f-${f.id}" name="${f.id}" class="select">
                      ${f.required ? "" : '<option value="">— Không chọn —</option>'}
                      ${f.options.map((o) => `<option ${v === o ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
                    </select>`;
                  } else if (f.kind === "textarea") {
                    control = `<textarea id="f-${f.id}" name="${f.id}" class="input" rows="5" maxlength="4000" ${f.required ? "required" : ""}>${escapeHtml(v)}</textarea>`;
                  } else {
                    control = `<input id="f-${f.id}" name="${f.id}" class="input" maxlength="300" ${f.required ? "required" : ""} value="${escapeHtml(v)}" />`;
                  }
                  return `<div class="field${f.kind === "select" ? " field-inline" : ""}">${label}${hint}${control}</div>`;
                })
                .join("")}
              <p class="form-error" role="alert" data-slot="error"></p>
              <div class="compose-foot">
                <span class="muted small">Bạn sẽ được chuyển sang GitHub để xem lại trước khi gửi.</span>
                <button type="submit" class="btn btn-primary">Tiếp tục trên GitHub →</button>
              </div>
            </form>`
          : `<p class="muted pick-hint">Chọn loại đóng góp để tiếp tục.</p>`
      }`;
  }

  function collect(form) {
    for (const [k, v] of new FormData(form)) state.values[k] = String(v).trim();
  }

  // Đổi nền tảng -> vẽ lại form để danh sách chủ đề khớp nền tảng mới.
  el.addEventListener("change", (e) => {
    if (e.target.name !== "track" || e.target.tagName !== "SELECT") return;
    collect(e.target.form);
    const topics = Object.values((TRACKS.find((t) => t.name === state.values.track) || currentTrack()).topics);
    if (!topics.includes(state.values.topic)) state.values.topic = "";
    render();
    el.querySelector("#f-track")?.focus();
  });

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.pick) {
      const form = el.querySelector(".compose-form");
      if (form) collect(form);
      state.type = t.dataset.pick;
      render();
      el.querySelector("#f-title")?.focus();
    } else if (t.dataset.action === "again") {
      state.sent = false;
      state.values = { track: currentTrack().name };
      state.type = null;
      render();
    }
  });

  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    collect(form);
    const fields = fieldsFor(state.type, state.values.track);
    const missing = [{ id: "title", label: "Tiêu đề" }, ...fields.filter((f) => f.required)].filter((f) => !state.values[f.id]);
    const error = el.querySelector("[data-slot=error]");
    if (missing.length) {
      error.textContent = `Vui lòng điền: ${missing.map((f) => f.label).join(", ")}.`;
      form.querySelector(`[name="${missing[0].id}"]`)?.focus();
      return;
    }
    error.textContent = "";
    const values = { title: state.values.title };
    for (const f of fields) values[f.id] = state.values[f.id];
    let url = newIssueUrl(state.type, values);
    state.copied = false;
    if (url.length > MAX_URL) {
      // URL quá dài: chỉ điền sẵn các ô ngắn, copy nội dung dài vào clipboard.
      const long = fields.filter((f) => f.kind === "textarea" && values[f.id]);
      const text = long.map((f) => `${f.label}:\n${values[f.id]}`).join("\n\n");
      long.forEach((f) => delete values[f.id]);
      url = newIssueUrl(state.type, values);
      try {
        await navigator.clipboard.writeText(text);
        state.copied = true;
      } catch (err) {
        error.textContent = "Nội dung quá dài để chuyển qua đường link. Hãy rút gọn bớt hoặc copy thủ công trước khi tiếp tục.";
        return;
      }
    }
    state.url = url;
    window.open(url, "_blank", "noopener");
    state.sent = true;
    render();
    window.scrollTo(0, 0);
  });

  render();
}
