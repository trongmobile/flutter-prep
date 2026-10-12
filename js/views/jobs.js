import { currentTrack } from "../../data/index.js";
import { GITHUB_URL } from "../config.js";
import { loadIssues, timeAgo, RateLimitError } from "../community.js";
import { JOB_SITES, JOB_TTL_DAYS, activeJobs } from "../jobs.js";
import { escapeHtml } from "../utils.js";

const POST_URL = "#/community/new?type=job";

function errorText(err) {
  if (err instanceof RateLimitError) return "GitHub tạm giới hạn số lượt tải (60 lượt/giờ cho mỗi mạng). Thử lại sau ít phút.";
  return err && err.message ? err.message : "Không tải được tin tuyển dụng từ GitHub.";
}

function jobCard(j) {
  const facts = [j.location, j.mode].filter(Boolean).map(escapeHtml).join(" · ");
  const tags = [j.rank && `<span class="job-tag">${escapeHtml(j.rank)}</span>`, j.salary && `<span class="job-tag job-salary">${escapeHtml(j.salary)}</span>`]
    .filter(Boolean)
    .join("");
  return `
    <article class="job">
      <div class="job-main">
        <a class="job-title" href="#/community/${j.number}">${escapeHtml(j.title)}</a>
        <div class="job-company">${escapeHtml(j.company || "Chưa ghi công ty")}${facts ? `<span class="muted"> · ${facts}</span>` : ""}</div>
        ${tags ? `<div class="job-tags">${tags}</div>` : ""}
        <div class="muted small">Đăng bởi @${escapeHtml(j.author)} · ${timeAgo(j.created)}</div>
      </div>
      <div class="job-actions">
        ${
          j.applyUrl
            ? `<a class="btn btn-primary" href="${escapeHtml(j.applyUrl)}" target="_blank" rel="noopener noreferrer nofollow">Ứng tuyển ↗</a>`
            : ""
        }
        <a class="btn btn-ghost" href="#/community/${j.number}">Chi tiết</a>
      </div>
    </article>`;
}

export function mount(el) {
  const track = currentTrack();

  el.innerHTML = `
    <header class="community-head">
      <div>
        <div class="eyebrow">việc làm · ${escapeHtml(track.name.toLowerCase())}</div>
        <h1>Việc làm ${escapeHtml(track.name)}</h1>
        <p class="subtitle">Tin tuyển dụng do cộng đồng đăng, kèm lối tắt tìm việc ${escapeHtml(track.name)} trên các trang tuyển dụng lớn.</p>
      </div>
      <a class="btn btn-primary" href="${POST_URL}">+ Đăng tin tuyển dụng</a>
    </header>

    <section class="job-sites-section">
      <div class="section-head">
        <h2>Tìm trên các trang tuyển dụng</h2>
        <span class="section-sub">Mở trang tìm kiếm đã lọc sẵn ${escapeHtml(track.name)}</span>
      </div>
      <div class="job-sites">
        ${JOB_SITES.map(
          (s) => `
          <a class="job-site" href="${escapeHtml(s.url(track))}" target="_blank" rel="noopener noreferrer">
            <strong>${s.name} <span aria-hidden="true">↗</span></strong>
            <span>Việc ${escapeHtml(track.name)} tại Việt Nam</span>
          </a>`,
        ).join("")}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Tin từ cộng đồng</h2>
        <span class="section-sub">Tin tự ẩn sau ${JOB_TTL_DAYS} ngày hoặc khi người đăng đóng tin</span>
      </div>
      <div data-slot="jobs"><div class="skeleton-list">${'<div class="skeleton"></div>'.repeat(2)}</div></div>
    </section>`;

  const slot = el.querySelector('[data-slot="jobs"]');

  function render(items, notice) {
    const jobs = activeJobs(items, track.id);
    slot.innerHTML = `
      ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
      ${
        jobs.length
          ? `<div class="job-list">${jobs.map(jobCard).join("")}</div>`
          : `<div class="empty">
              <p><strong>Chưa có tin ${escapeHtml(track.name)} nào.</strong><br />Bạn đang tuyển? Đăng tin miễn phí để tiếp cận người đang ôn phỏng vấn ${escapeHtml(track.name)}.</p>
              <a class="btn btn-primary" href="${POST_URL}">+ Đăng tin tuyển dụng</a>
            </div>`
      }`;
  }

  async function load(force) {
    try {
      const res = await loadIssues({ force });
      if (!el.isConnected) return;
      render(res.items, res.stale ? `${errorText(res.error)} Đang hiển thị dữ liệu đã lưu.` : "");
    } catch (err) {
      if (!el.isConnected) return;
      slot.innerHTML = `
        <div class="empty">
          <p>${escapeHtml(errorText(err))}</p>
          <div class="btn-row center">
            <button type="button" class="btn btn-ghost" data-action="refresh">Thử lại</button>
            <a class="btn btn-ghost" href="${GITHUB_URL}/issues?q=label%3A%22type%3A+job%22+is%3Aopen" target="_blank" rel="noopener">Xem trên GitHub ↗</a>
          </div>
        </div>`;
    }
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="refresh"]')) load(true);
  });

  load(false);
}
