#!/usr/bin/env python3
"""Dựng video dọc 1080x1920 (Reels / TikTok) cho một câu phỏng vấn, cho agent marketing.

  python3 scripts/mkt/video.py render video.json out/   -> out/video.mp4, out/cover.jpg, out/page.html
  python3 scripts/mkt/video.py page out/                 -> chỉ viết lại out/page.html từ video đã dựng

page.html nhúng sẵn video (base64) nên xuất bản một lần là xong, không cần tải video lên riêng.

Cần: pip install pillow imageio-ffmpeg  (imageio-ffmpeg có sẵn ffmpeg, không phải cài riêng).

video.json do agent viết, dựa trên `node scripts/mkt/pick.mjs --video`:
  id, kind ("quiz" | "question"), trackName, rankName, topicName, rank, url, total
  hook       câu mở đầu, hiện 2 giây đầu (vd. "Câu phỏng vấn Android Senior, bạn chọn gì?")
  question   câu hỏi đã rút gọn; `code` trong backtick được tô màu
  code       đoạn code ngắn hoặc null
  quiz:      options (4 lựa chọn, không kèm "A."), correct (0–3 hoặc "A"–"D"), explain
  question:  points (2–4 ý chính của câu trả lời)
  caption, hashtags   nội dung đăng kèm video (hiện trên trang, không nằm trong video)

Kịch bản: mở đầu (hook) -> câu hỏi + đếm ngược 5 giây -> đáp án / ý chính -> kêu gọi vào trang.
Video không có nhạc: thêm nhạc thịnh hành ngay trong app TikTok / Instagram khi đăng.
Mã thoát 2: chữ quá dài, đã thu nhỏ cỡ chữ mà vẫn không vừa khung -> rút gọn rồi chạy lại.
"""
import base64
import html
import io
import json
import math
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import imageio_ffmpeg

W, H, FPS = 1080, 1920, 30
# Vùng an toàn: TikTok/Reels che phía trên (tab), phía dưới (caption, nhạc) và cột nút bên phải.
X0, X1 = 80, 950
Y0, Y1 = 150, 1540
CONTENT_TOP = Y0 + 230
COUNTDOWN = 5
FADE = 0.25

BG = (11, 18, 32)
CARD = (20, 29, 48)
LINE = (38, 52, 78)
TEXT = (230, 237, 246)
MUTED = (147, 164, 189)
ACCENT = (63, 184, 214)
CODE_BG = (8, 13, 24)
CODE_TEXT = (125, 211, 252)
GOOD = (34, 197, 94)
RANK_COLORS = {"fresher": (52, 211, 153), "junior": (96, 165, 250), "middle": (251, 191, 36), "senior": (167, 139, 250)}
LETTERS = "ABCD"

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
FONT_FILES = {
    "bold": "BeVietnamPro-Bold.ttf",
    "semi": "BeVietnamPro-SemiBold.ttf",
    "medium": "BeVietnamPro-Medium.ttf",
    "mono": "JetBrainsMono.ttf",
}
_fonts = {}


class TooLong(Exception):
    pass


def font(kind, size):
    size = int(round(size))
    key = (kind, size)
    if key not in _fonts:
        f = ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[kind]), size)
        if kind == "mono":
            try:
                f.set_variation_by_axes([500])  # JetBrains Mono là variable font, mặc định quá mảnh
            except Exception:
                pass
        _fonts[key] = f
    return _fonts[key]


# ---------- Chữ nhiều dòng, có đoạn `code` ----------

def tokens(text):
    """Tách thành (từ, là_code, có_khoảng_trắng_trước). Dòng mới trả về từ "\\n"."""
    out = []
    for pi, para in enumerate(str(text).split("\n")):
        if pi:
            out.append(("\n", False, False))
        space = False
        for part in re.split(r"(`[^`]+`)", para):
            if not part:
                continue
            code = len(part) > 2 and part[0] == "`" and part[-1] == "`"
            for w in re.split(r"(\s+)", part[1:-1] if code else part):
                if not w:
                    continue
                if w.isspace():
                    space = True
                    continue
                out.append((w, code, space))
                space = False
    return out


class Block:
    """Đoạn chữ đã ngắt dòng theo bề rộng, vẽ được ở bất kỳ vị trí nào."""

    def __init__(self, text, size, width, weight="semi", color=TEXT, lh=1.36):
        self.size, self.color, self.weight = size, color, weight
        self.f, self.fc = font(weight, size), font("mono", size * 0.9)
        self.lh = int(size * lh)
        space = self.f.getlength(" ")
        # Gom các từ dính liền nhau (vd. `code` + dấu "?") thành một cụm để không bị ngắt dòng giữa chừng.
        groups = []
        for word, code, sp in tokens(text):
            if word == "\n":
                groups.append(None)
                continue
            piece = (word, code, (self.fc if code else self.f).getlength(word))
            if sp or not groups or groups[-1] is None:
                groups.append([piece])
            else:
                groups[-1].append(piece)
        self.lines = [[]]
        x = 0
        for g in groups:
            if g is None:
                self.lines.append([])
                x = 0
                continue
            gw = sum(p[2] for p in g)
            if gw > width:
                raise TooLong("từ quá dài cho một dòng: " + "".join(p[0] for p in g))
            gap = space if self.lines[-1] else 0
            if self.lines[-1] and x + gap + gw > width:
                self.lines.append([])
                x, gap = 0, 0
            x += gap
            for word, code, w in g:
                self.lines[-1].append((word, code, x))
                x += w
        self.height = len(self.lines) * self.lh

    def draw(self, d, x, y, color=None):
        for i, ln in enumerate(self.lines):
            base = y + i * self.lh + self.size * 1.02
            for word, code, wx in ln:
                if code:
                    d.text((x + wx, base), word, font=self.fc, fill=CODE_TEXT, anchor="ls")
                else:
                    d.text((x + wx, base), word, font=self.f, fill=color or self.color, anchor="ls")


class CodeBlock:
    def __init__(self, code, size):
        self.f = font("mono", size)
        self.lh = int(size * 1.45)
        self.pad = 26
        self.lines = str(code).rstrip("\n").split("\n")
        if len(self.lines) > 10:
            raise TooLong("code dài hơn 10 dòng")
        width = max(self.f.getlength(ln) for ln in self.lines)
        if width > X1 - X0 - 2 * self.pad:
            raise TooLong("dòng code quá dài")
        self.height = len(self.lines) * self.lh + 2 * self.pad

    def draw(self, d, y):
        d.rounded_rectangle((X0, y, X1, y + self.height), 18, fill=CODE_BG, outline=LINE, width=2)
        for i, ln in enumerate(self.lines):
            d.text((X0 + self.pad, y + self.pad + i * self.lh), ln, font=self.f, fill=CODE_TEXT)


# ---------- Phần dùng chung của các cảnh ----------

def background():
    img = Image.new("RGB", (W, H), BG)
    top = Image.new("RGB", (W, H), (17, 31, 58))
    img = Image.composite(top, img, Image.linear_gradient("L").rotate(180).resize((W, H)))
    glow = Image.radial_gradient("L").resize((1400, 1400))
    glow = glow.point(lambda v: max(0, 255 - v) * 0.22)
    layer = Image.new("RGB", (W, H), ACCENT)
    mask = Image.new("L", (W, H), 0)
    mask.paste(glow, (W - 700, -800))
    return Image.composite(layer, img, mask.filter(ImageFilter.GaussianBlur(40)))


def logo(d, x, y, s):
    """Logo bong bóng chat + dấu nhắc lệnh, giống logo của site."""
    d.rounded_rectangle((x, y, x + s, y + s * 0.72), radius=s * 0.22, fill=ACCENT)
    d.polygon([(x + s * 0.2, y + s * 0.6), (x + s * 0.2, y + s * 0.92), (x + s * 0.45, y + s * 0.68)], fill=ACCENT)
    w = max(3, int(s * 0.085))
    d.line([(x + s * 0.27, y + s * 0.22), (x + s * 0.42, y + s * 0.36), (x + s * 0.27, y + s * 0.5)], fill=BG, width=w, joint="curve")
    d.line([(x + s * 0.5, y + s * 0.5), (x + s * 0.72, y + s * 0.5)], fill=BG, width=w)


def header(d, meta):
    logo(d, X0, Y0, 58)
    d.text((X0 + 76, Y0 + 30), "Mobile Interview", font=font("bold", 36), fill=TEXT, anchor="lm")
    color = RANK_COLORS.get(meta.get("rank"), ACCENT)
    label = f"{meta['trackName']} · {meta['rankName']}".upper()
    f = font("bold", 30)
    tw = f.getlength(label)
    by = Y0 + 110
    d.rounded_rectangle((X0, by, X0 + tw + 44, by + 58), 29, fill=tuple(int(c * 0.22) for c in color), outline=color, width=3)
    d.text((X0 + 22, by + 29), label, font=f, fill=color, anchor="lm")
    topic = meta.get("topicName") or ""
    ft = font("medium", 30)
    if topic and X0 + tw + 70 + ft.getlength(topic) <= X1:
        d.text((X0 + tw + 66, by + 29), topic, font=ft, fill=MUTED, anchor="lm")


def base_frame(meta):
    img = background()
    header(ImageDraw.Draw(img), meta)
    return img


def progress(d, frac):
    y = Y0 + 196
    d.rounded_rectangle((X0, y, X1, y + 10), 5, fill=LINE)
    if frac > 0:
        d.rounded_rectangle((X0, y, X0 + max(10, (X1 - X0) * frac), y + 10), 5, fill=ACCENT)


def countdown(d, n):
    cx, cy, r = (X0 + X1) // 2, Y1 - 70, 66
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ACCENT)
    d.text((cx, cy), str(n), font=font("bold", 76), fill=BG, anchor="mm")


def option_card(text, letter, width, size, state="normal"):
    """Thẻ lựa chọn A–D. state: normal | correct | dim. Trả về ảnh RGBA."""
    pad, circle = 24, 62
    body = Block(text, size, width - 2 * pad - circle - 22, "medium")
    h = max(body.height, circle) + 2 * pad
    img = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill, outline, ink = CARD, LINE, TEXT
    if state == "correct":
        fill, outline = (14, 58, 38), GOOD
    elif state == "dim":
        ink = (92, 106, 130)
    d.rounded_rectangle((0, 0, width - 1, h - 1), 22, fill=fill, outline=outline, width=3)
    cy = pad + circle // 2 if body.height > circle else h // 2
    d.ellipse((pad, cy - circle // 2, pad + circle, cy + circle // 2), fill=GOOD if state == "correct" else LINE)
    if state == "correct":
        cx = pad + circle / 2
        d.line([(cx - 14, cy + 1), (cx - 4, cy + 11), (cx + 15, cy - 11)], fill=TEXT, width=6, joint="curve")
    else:
        d.text((pad + circle / 2, cy), letter, font=font("bold", 32), fill=TEXT, anchor="mm")
    body.draw(d, pad + circle + 22, pad + max(0, (circle - body.height) // 2), color=ink)
    return img


def fit(build):
    """Thử dựng bố cục với cỡ chữ giảm dần cho tới khi vừa khung."""
    last = None
    for s in (1.0, 0.94, 0.88, 0.82, 0.76, 0.7, 0.65):
        try:
            layout = build(s)
            if layout["bottom"] <= Y1 - 150:
                return layout
            last = "nội dung cao quá khung"
        except TooLong as e:
            last = str(e)
    raise TooLong(last)


def shift(lay):
    """Nội dung ngắn thì dời xuống, để khối chữ nằm gần giữa vùng an toàn hơn."""
    return min(120, max(0, (Y1 - 150 - lay["bottom"]) // 2))


# ---------- Các cảnh. Mỗi cảnh: (thời lượng, hàm vẽ khung hình tại thời điểm t) ----------

def scene_hook(meta):
    img = base_frame(meta)
    d = ImageDraw.Draw(img)
    hook = None
    for size in (84, 76, 68, 60):
        hook = Block(meta["hook"], size, X1 - X0, "bold")
        if hook.height < 600:
            break
    else:
        raise TooLong("hook quá dài")
    y = (CONTENT_TOP + Y1 - 150 - hook.height) // 2
    d.rounded_rectangle((X0, y - 44, X0 + 120, y - 32), 6, fill=ACCENT)
    hook.draw(d, X0, y)
    return 2.2, lambda t: img


def reading_time(*texts, most=10.0):
    chars = sum(len(t or "") for t in texts)
    return min(most, max(4.0, chars / 17))


def scene_question(meta):
    quiz = meta["kind"] == "quiz"

    def build(s):
        q = Block(meta["question"], 54 * s, X1 - X0, "semi")
        y = CONTENT_TOP + q.height + 34
        code = None
        if meta.get("code"):
            code = CodeBlock(meta["code"], max(24, 34 * s))
            y += code.height + 34
        cards = []
        if quiz:
            for i, opt in enumerate(meta["options"]):
                c = option_card(opt, LETTERS[i], X1 - X0, 40 * s)
                cards.append((y, c))
                y += c.height + 18
        else:
            hint = Block("Dừng 5 giây, tự trả lời trước khi xem gợi ý.", 38 * s, X1 - X0, "medium", MUTED)
            cards.append((y + 10, hint))
            y += hint.height + 10
        return {"q": q, "code": code, "cards": cards, "bottom": y}

    lay = fit(build)
    dy = shift(lay)
    base = base_frame(meta)
    d = ImageDraw.Draw(base)
    lay["q"].draw(d, X0, CONTENT_TOP + dy)
    if lay["code"]:
        lay["code"].draw(d, CONTENT_TOP + dy + lay["q"].height + 34)
    read = reading_time(meta["question"], meta.get("code"), *(meta.get("options") or []))
    duration = read + COUNTDOWN

    def frame(t):
        img = base.copy()
        dd = ImageDraw.Draw(img)
        for i, (y, card) in enumerate(lay["cards"]):
            y += dy
            a = min(1.0, max(0.0, (t - 0.3 - i * 0.3) / 0.3))
            if a <= 0:
                continue
            if isinstance(card, Block):
                card.draw(dd, X0, y)
                continue
            if a < 1:
                card = card.copy()
                card.putalpha(card.getchannel("A").point(lambda v: int(v * a)))
            img.paste(card, (X0, int(y + (1 - a) * 24)), card)
        progress(dd, max(0.0, 1 - t / duration))
        left = duration - t
        if left <= COUNTDOWN:
            countdown(dd, max(1, math.ceil(left - 1e-6)))
        return img

    return duration, frame, lay


def scene_answer(meta):
    if meta["kind"] == "quiz":
        correct = meta["correct"]

        def build(s):
            title = Block(f"Đáp án đúng: {LETTERS[correct]}", 64 * s, X1 - X0, "bold", GOOD)
            card = option_card(meta["options"][correct], LETTERS[correct], X1 - X0, 42 * s, "correct")
            why = Block(meta["explain"], 40 * s, X1 - X0 - 56, "medium")
            y = CONTENT_TOP + title.height + 26
            card_y = y
            y += card.height + 34
            why_y = y
            y += why.height + 56
            return {"title": title, "card": (card_y, card), "why": (why_y, why), "bottom": y}

        lay = fit(build)
        dy = shift(lay)
        img = base_frame(meta)
        d = ImageDraw.Draw(img)
        lay["title"].draw(d, X0, CONTENT_TOP + dy)
        cy, card = lay["card"]
        img.paste(card, (X0, cy + dy), card)
        wy, why = lay["why"]
        wy += dy
        d.rounded_rectangle((X0, wy, X1, wy + why.height + 56), 22, fill=CARD, outline=LINE, width=2)
        why.draw(d, X0 + 28, wy + 28)
        duration = reading_time(meta["explain"], meta["options"][correct], most=9.0) + 1
        return duration, lambda t: img

    # Câu tự luận: các ý chính hiện lần lượt.
    def build(s):
        title = Block("Ý chính khi trả lời", 60 * s, X1 - X0, "bold", ACCENT)
        y = CONTENT_TOP + title.height + 30
        items = []
        for i, p in enumerate(meta["points"]):
            b = Block(p, 42 * s, X1 - X0 - 100, "medium")
            items.append((y, b))
            y += max(b.height, 60) + 56 + 18
        return {"title": title, "items": items, "bottom": y}

    lay = fit(build)
    dy = shift(lay)
    base = base_frame(meta)
    d = ImageDraw.Draw(base)
    lay["title"].draw(d, X0, CONTENT_TOP + dy)
    cards = []
    for i, (y, b) in enumerate(lay["items"]):
        y += dy
        h = max(b.height, 60) + 56
        c = Image.new("RGBA", (X1 - X0, h), (0, 0, 0, 0))
        cd = ImageDraw.Draw(c)
        cd.rounded_rectangle((0, 0, X1 - X0 - 1, h - 1), 22, fill=CARD, outline=LINE, width=2)
        cd.ellipse((24, 28, 84, 88), fill=ACCENT)
        cd.text((54, 58), str(i + 1), font=font("bold", 32), fill=BG, anchor="mm")
        b.draw(cd, 100, 28 + max(0, (60 - b.height) // 2))
        cards.append((y, c))
    step = 1.4
    duration = step * len(cards) + reading_time(*meta["points"]) * 0.7 + 1

    def frame(t):
        img = base.copy()
        for i, (y, c) in enumerate(cards):
            a = min(1.0, max(0.0, (t - 0.2 - i * step) / 0.35))
            if a <= 0:
                continue
            if a < 1:
                c = c.copy()
                c.putalpha(c.getchannel("A").point(lambda v: int(v * a)))
            img.paste(c, (X0, int(y + (1 - a) * 24)), c)
        return img

    return duration, frame


def scene_cta(meta):
    img = background()
    d = ImageDraw.Draw(img)
    cx = W // 2
    logo(d, cx - 90, 470, 180)
    d.text((cx, 760), "Mobile Interview", font=font("bold", 76), fill=TEXT, anchor="mm")
    d.text((cx, 850), "Ôn phỏng vấn mobile miễn phí", font=font("semi", 46), fill=TEXT, anchor="mm")
    d.text((cx, 920), "Flutter · Android · iOS · React Native", font=font("medium", 36), fill=MUTED, anchor="mm")
    lines = [f"{meta.get('total') or 'Hơn 1000'} câu hỏi & quiz kèm đáp án", "Phỏng vấn thử · Bảng xếp hạng · Không cần đăng ký"]
    for i, ln in enumerate(lines):
        d.text((cx, 1030 + i * 58), ln, font=font("medium", 36), fill=TEXT, anchor="mm")
    url = "trongmobile.github.io/flutter-prep"
    f = font("bold", 38)
    tw = f.getlength(url)
    d.rounded_rectangle((cx - tw / 2 - 36, 1190, cx + tw / 2 + 36, 1276), 43, fill=ACCENT)
    d.text((cx, 1233), url, font=f, fill=BG, anchor="mm")
    d.text((cx, 1340), "Link ở bio · Lưu lại để ôn dần", font=font("medium", 34), fill=MUTED, anchor="mm")
    return 3.5, lambda t: img


# ---------- Ghép video ----------

def validate(meta):
    need = ["id", "kind", "trackName", "rankName", "hook", "question", "url"]
    if meta.get("kind") == "quiz":
        need += ["options", "correct", "explain"]
    elif meta.get("kind") == "question":
        need += ["points"]
    else:
        raise ValueError('kind phải là "quiz" hoặc "question"')
    missing = [k for k in need if meta.get(k) in (None, "", [])]
    if missing:
        raise ValueError("thiếu trường: " + ", ".join(missing))
    if meta["kind"] == "quiz":
        if len(meta["options"]) != 4:
            raise ValueError("options phải có đúng 4 lựa chọn")
        c = meta["correct"]
        meta["correct"] = LETTERS.index(c.strip().upper()) if isinstance(c, str) else int(c)
        if not 0 <= meta["correct"] <= 3:
            raise ValueError("correct phải là 0–3 hoặc A–D")
    elif not 2 <= len(meta["points"]) <= 4:
        raise ValueError("points cần 2–4 ý")


def render(meta, out):
    validate(meta)
    os.makedirs(out, exist_ok=True)
    hook = scene_hook(meta)
    q_dur, q_frame, _ = scene_question(meta)
    scenes = [hook, (q_dur, q_frame), scene_answer(meta), scene_cta(meta)]
    total = sum(s[0] for s in scenes)

    path = os.path.join(out, "video.mp4")
    cmd = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        # Track âm thanh im lặng: vài nền tảng xử lý video không có audio kém ổn định.
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-shortest", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    prev = None
    for si, (dur, frame) in enumerate(scenes):
        n = int(round(dur * FPS))
        for i in range(n):
            img = frame(i / FPS)
            if prev is not None and i < FADE * FPS:
                img = Image.blend(prev, img, (i + 1) / (FADE * FPS + 1))
            proc.stdin.write(img.tobytes())
            if si == 1 and i == int((q_dur - COUNTDOWN) * FPS) - 1:
                img.convert("RGB").save(os.path.join(out, "cover.jpg"), quality=88)
        prev = frame((n - 1) / FPS)
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg lỗi")

    meta["duration"] = round(total, 1)
    meta["sizeMB"] = round(os.path.getsize(path) / 1024 / 1024, 2)
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    write_page(out)
    print(json.dumps({"video": path, "cover": os.path.join(out, "cover.jpg"), "page": os.path.join(out, "page.html"),
                      "seconds": meta["duration"], "sizeMB": meta["sizeMB"]}, ensure_ascii=False))


# ---------- Trang để tải video và copy caption (xuất bản thành Artifact) ----------

PAGE = """<title>Video ngày __DATE__</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Một cột hẹp như màn hình điện thoại: video, hai nút, caption, mẹo đăng. Màu theo nhận diện của site. */
:root{--bg:#f5f7fb;--card:#fff;--text:#0f172a;--muted:#5b6475;--line:#e2e7f0;--accent:#0e7490;--accent-ink:#fff;--good:#15803d}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b1220;--card:#121b2e;--text:#e6edf6;--muted:#93a4bd;--line:#22304a;--accent:#3fb8d6;--accent-ink:#0b1220;--good:#4ade80;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b1220;--card:#121b2e;--text:#e6edf6;--muted:#93a4bd;--line:#22304a;--accent:#3fb8d6;--accent-ink:#0b1220;--good:#4ade80;color-scheme:dark}
body{background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:520px;margin:0 auto;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:22px;margin:0 0 2px}
h2{font-size:15px;margin:26px 0 8px}
.meta{color:var(--muted);margin:0 0 16px}
.player{max-width:100%;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:9/16;max-height:70vh;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#93a4bd}
video,.player img{width:100%;height:100%;object-fit:contain;display:block}
.actions{display:flex;gap:10px;margin-top:14px}
button{flex:1;font:600 15px system-ui,sans-serif;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
#status{min-height:1.5em;color:var(--muted);margin:8px 0 0;font-size:14px}
#status.ok{color:var(--good)}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:15px/1.55 system-ui,sans-serif}
ul{margin:0;padding-left:20px}
li{margin:4px 0}
a{color:var(--accent)}
.foot{color:var(--muted);font-size:13px;margin-top:22px}
</style>
<main>
<h1>Video ngày __DATE__</h1>
<p class="meta">__LABEL__ · __SECONDS__ giây · __SIZE__ MB</p>
<div class="player"><video id="player" controls playsinline preload="auto" poster="__POSTER__"></video></div>
<div class="actions">
<button class="primary" id="save" hidden>Lưu video</button>
<button id="copy">Copy caption</button>
</div>
<p id="status" role="status"></p>
<h2>Caption cho TikTok / Reels</h2>
<div class="box"><pre id="caption">__CAPTION__</pre></div>
<h2>Khi đăng</h2>
<div class="box"><ul>
<li>Chọn một bản nhạc thịnh hành ngay trong app, để âm lượng nhỏ (video không có tiếng).</li>
<li>Đặt link <b>trongmobile.github.io/flutter-prep</b> ở bio, vì video nhắc "link ở bio".</li>
<li>Ghim một bình luận hỏi người xem chọn đáp án nào để kéo tương tác.</li>
<li>Khung giờ tốt: 19h–22h. Ảnh bìa nên chọn đoạn có câu hỏi.</li>
</ul></div>
<p class="foot">Câu gốc: <a href="__URL__" target="_blank" rel="noopener">__ID__</a></p>
</main>
<script type="application/octet-stream" id="video-data">__VIDEO_B64__</script>
<script>
const FILE_NAME = __FILE_JSON__;
const statusEl = document.getElementById("status");
const say = (msg, ok) => { statusEl.textContent = msg; statusEl.className = ok ? "ok" : ""; };

// Video nhúng ngay trong trang: dựng Blob từ base64 để phát và để lưu, không phụ thuộc máy chủ.
const b64 = document.getElementById("video-data").textContent.trim();
const raw = atob(b64);
const bytes = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
const videoBlob = new Blob([bytes], { type: "video/mp4" });
const player = document.getElementById("player");
let triedDataUrl = false;
player.addEventListener("error", () => {
  if (triedDataUrl) {
    say("Trình duyệt này không phát được video ngay trên trang. Bấm Lưu video rồi mở bằng app Ảnh.");
    return;
  }
  triedDataUrl = true;
  player.src = "data:video/mp4;base64," + b64;
});
try {
  player.src = URL.createObjectURL(videoBlob);
} catch (e) {
  triedDataUrl = true;
  player.src = "data:video/mp4;base64," + b64;
}

document.getElementById("copy").addEventListener("click", async () => {
  const text = document.getElementById("caption").textContent;
  try {
    await navigator.clipboard.writeText(text);
    say("Đã copy caption.", true);
  } catch (e) {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("caption"));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    say("Caption đã được bôi đen, bấm Copy trên bàn phím hoặc menu.");
  }
});

(async () => {
  if (!window.claude) return;
  const downloads = await window.claude.use("downloads");
  if (!downloads) return;
  const btn = document.getElementById("save");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    say("Đang chuẩn bị video…");
    try {
      await downloads.save({ filename: FILE_NAME, data: videoBlob });
      say("Đã lưu video.", true);
    } catch (e) {
      if (e && e.code === "declined") say("");
      else if (e && e.code === "rate_limited") say("Đang có một hộp thoại lưu khác, thử lại sau giây lát.");
      else say("Không lưu được ở đây. Mở video rồi nhấn giữ hoặc dùng menu ⋯ để tải.");
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>
"""


MAX_EMBED_MB = 12  # trang Artifact tối đa 16 MB, base64 làm file to thêm 1/3


def write_page(out):
    with open(os.path.join(out, "meta.json"), encoding="utf-8") as f:
        meta = json.load(f)
    esc = lambda s: html.escape(str(s), quote=True)
    with open(os.path.join(out, "video.mp4"), "rb") as f:
        video = f.read()
    if len(video) > MAX_EMBED_MB * 1024 * 1024:
        raise RuntimeError(f"video {len(video) // 1024 // 1024} MB, quá lớn để nhúng vào trang")
    # Ảnh bìa nhỏ cho thẻ <video>, để trang nhẹ.
    cover = Image.open(os.path.join(out, "cover.jpg")).convert("RGB")
    cover.thumbnail((540, 960))
    buf = io.BytesIO()
    cover.save(buf, "JPEG", quality=80)
    poster = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    caption = meta.get("caption", "").strip()
    tags = " ".join(meta.get("hashtags") or [])
    if tags and tags not in caption:
        caption = f"{caption}\n\n{tags}".strip()
    date = meta.get("date") or ""
    if re.match(r"\d{4}-\d{2}-\d{2}$", date):
        date = f"{date[8:10]}/{date[5:7]}"
    page = PAGE
    for k, v in {
        "__DATE__": esc(date),
        "__LABEL__": esc(f"{meta['trackName']} · {meta['rankName']}" + (f" · {meta['topicName']}" if meta.get("topicName") else "")),
        "__SECONDS__": esc(meta.get("duration", "")),
        "__SIZE__": esc(meta.get("sizeMB", "")),
        "__POSTER__": poster,
        "__VIDEO_B64__": base64.b64encode(video).decode(),
        "__CAPTION__": esc(caption),
        "__URL__": esc(meta["url"]),
        "__ID__": esc(meta["id"]),
        "__FILE_JSON__": json.dumps(f"mobile-interview-{meta.get('date') or meta['id']}.mp4"),
    }.items():
        page = page.replace(k, v)
    with open(os.path.join(out, "page.html"), "w", encoding="utf-8") as f:
        f.write(page)


def main(argv):
    if len(argv) >= 3 and argv[0] == "render":
        with open(argv[1], encoding="utf-8") as f:
            meta = json.load(f)
        try:
            render(meta, argv[2])
        except TooLong as e:
            print(f"Chữ quá dài, rút gọn rồi chạy lại: {e}")
            return 2
        except ValueError as e:
            print(f"video.json chưa đúng: {e}")
            return 1
        return 0
    if len(argv) >= 2 and argv[0] == "page":
        write_page(argv[1])
        print(os.path.join(argv[1], "page.html"))
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
