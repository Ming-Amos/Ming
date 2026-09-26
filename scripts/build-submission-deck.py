"""Build Ming's five-slide PDF from genuine, unaltered local evidence.

Requires reportlab, pypdf and PyMuPDF. Windows task environment has them in
runtime/media-tools; use PYTHONPATH or install the packages in your environment.
No screenshots are synthesized or edited by this builder.
"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / "runtime/media-tools").exists():
    sys.path.insert(0, str(ROOT / "runtime/media-tools"))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
import pymupdf as fitz
from pypdf import PdfReader

W, H = 960, 540
BG, NAVY, GRAY = "#F8F7F4", "#10244D", "#647082"
RED, GREEN = "#AD4234", "#256C55"
OUT = ROOT / "submission/ming-slides.pdf"
QA = ROOT / "runtime/submission-deck-qa"
OUT.parent.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
serif_file = Path("C:/Windows/Fonts/georgia.ttf")
if serif_file.exists():
    pdfmetrics.registerFont(TTFont("Editorial", str(serif_file)))
    SERIF = "Editorial"
else:
    SERIF = "Times-Roman"

manifest = json.loads((ROOT / "docs/demo-evidence/manifest.json").read_text(encoding="utf-8"))
assert manifest["comparison"]["verifiedRepair"] is True
assert manifest["comparison"]["planFingerprintMatch"] is True
assert manifest["comparison"]["runnerFingerprintMatch"] is True
baseline_id, rerun_id = manifest["featuredBaselineRunId"], manifest["featuredRerunId"]
before_name = f"runtime/screenshots/{baseline_id}_AC-02-S2_failed.png"
after_name = f"runtime/screenshots/{rerun_id}_AC-02_final.png"
todo_name = "runtime/screenshots/a35c69f6-cb5c-4293-90df-2a82d96eb067_TODO-03_final.png"
for name in [before_name, after_name, todo_name]:
    assert hashlib.sha256((ROOT / "docs/demo-evidence" / name).read_bytes()).hexdigest() == manifest["files"][name]

c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Ming - Automatic acceptance for AI-built features")
c.setAuthor("Ming")
c.setSubject("IBM Bob 2.0 hackathon project presentation")

def text(value, x, y, size=18, color=NAVY, font="Helvetica"):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def paragraph(value, x, top, width, size=18, color=NAVY, font="Helvetica", leading=None):
    p = Paragraph(value, ParagraphStyle("content", fontName=font, fontSize=size,
        leading=leading or size * 1.32, textColor=HexColor(color), spaceAfter=0))
    pw, ph = p.wrap(width, H)
    if top - ph < 36:
        raise ValueError(f"Text exceeds page safe area: {value}")
    p.drawOn(c, x, top - ph)
    return ph

def photo(file, x, y, width, height):
    reader = ImageReader(str(file)); iw, ih = reader.getSize()
    ratio = min(width / iw, height / ih)
    dw, dh = iw * ratio, ih * ratio
    c.drawImage(reader, x + (width-dw)/2, y + (height-dh)/2, width=dw, height=dh, mask="auto")

def page(number, title=None):
    c.setFillColor(HexColor(BG)); c.rect(0, 0, W, H, fill=1, stroke=0)
    if title:
        text(title, 48, 469, 34, font=SERIF)
    text("Ming  /  IBM Bob 2.0 hackathon", 48, 23, 10, GRAY)
    c.setFillColor(HexColor(GRAY)); c.setFont("Helvetica", 10); c.drawRightString(912, 23, f"{number:02d} / 05")

# 1. Existing conceptual cover; the small label avoids confusing art with a product capture.
page(1)
photo(ROOT / "submission/ming-cover.png", 0, 45, W, 495)
text("Automatic acceptance for AI-built features", 48, 45, 19)
text("Concept cover", 826, 45, 11, GRAY)
c.showPage()

# 2. Flat editorial composition: the pain point beside the actual workflow.
page(2, "The work left after \"done\"")
paragraph('AI says the feature<br/>is finished.<br/>I still have to check it.', 48, 403, 365, 31, font=SERIF, leading=42)
paragraph("Open the page. Click every case. Capture the failure. Explain it to the AI. Repeat after each edit.",
          48, 237, 350, 20, GRAY, leading=28)
paragraph("Ming turns those checks into a repeatable acceptance run with evidence the coding agent can use.",
          48, 117, 350, 17, NAVY, leading=23)
steps = [
    ("01", "Confirm the acceptance plan", "Review the requirement, expected result and boundaries."),
    ("02", "Run a real browser", "Execute the confirmed steps against the target."),
    ("03", "Capture the failure", "Keep expected vs. observed results and screenshots."),
    ("04", "Hand evidence to the agent", "The coding agent claims a repair task through MCP."),
    ("05", "Rerun the same plan", "Compare both runs without weakening the checks."),
]
for i, (number, title, body) in enumerate(steps):
    yy = 408 - i * 70
    text(number, 473, yy, 15, GRAY)
    text(title, 514, yy, 20)
    paragraph(body, 514, yy - 13, 390, 14, GRAY, leading=19)
c.showPage()

# 3. Original browser screenshots, aspect-preserved and uncropped.
page(3, "A repair with the same acceptance plan")
text("Before: the report disappears on refresh", 48, 416, 19, RED)
text("After: the same check passes", 496, 416, 19, GREEN)
photo(ROOT / "docs/demo-evidence" / before_name, 48, 158, 416, 234)
photo(ROOT / "docs/demo-evidence" / after_name, 496, 158, 416, 234)
text("AC-02 failed", 48, 142, 17, RED, "Helvetica-Bold")
text("AC-02 passed; all 3 criteria passed", 496, 142, 17, GREEN, "Helvetica-Bold")
paragraph("Same target, plan and runner. The agent changed the source, and the original failure passed on rerun.",
          48, 107, 860, 18, leading=24)
text(f"Recorded local repair by Codex via MCP  |  Runs {baseline_id[:8]} / {rerun_id[:8]}", 48, 48, 12, GRAY)
c.showPage()

# 4. Genuine Bob session summary, entire original image preserved.
page(4, "Built with IBM Bob")
photo(ROOT / "bob_sessions/ming_task03_stage_b_final_summary.png", 48, 76, 566, 353)
paragraph("Original Bob task summary. Full-resolution evidence: bob_sessions/.",
          48, 63, 565, 12, GRAY, leading=16)
text("Bob implemented", 654, 403, 21, font="Helvetica-Bold")
paragraph("Browser execution and evidence history.<br/><br/>Model adapter and confirmed plans.<br/><br/>Repair-task / MCP foundation.",
          654, 373, 258, 17, leading=23)
text("Codex completed", 654, 185, 21, font="Helvetica-Bold")
paragraph("Final interface, integrity checks and second sample. Codex performed the recorded MCP repair after Bob's trial quota ended.",
          654, 155, 258, 16, leading=20)
c.showPage()

# 5. Explicit scope and model/runtime boundary, with a separate real application.
page(5, "Prototype scope")
text("Daily reports + a task manager", 48, 406, 23, font="Helvetica-Bold")
paragraph("Each sample has its own markup and acceptance plan. Both use the same browser runner.",
          48, 373, 370, 19, leading=27)
text("Full workflow runs locally", 48, 274, 21, font="Helvetica-Bold")
paragraph("Review evidence and rerun after the agent repairs the source.",
          48, 244, 370, 18, leading=25)
text("Public demo shares real history", 48, 160, 21, font="Helvetica-Bold")
paragraph("The online view is read-only. It shows saved runs and repair evidence; it does not execute new checks.",
          48, 130, 370, 18, leading=25)
photo(ROOT / "docs/demo-evidence" / todo_name, 466, 175, 446, 251)
paragraph("Second sample: task creation, completion and persistence after refresh.",
          466, 157, 430, 17, leading=23)
paragraph("Model adapter available. This demonstration uses hand-authored plans; live model generation awaits API configuration.",
          466, 89, 430, 14, GRAY, leading=19)
c.showPage()
c.save()

# Render every page for actual visual review and verify text/page dimensions.
reader = PdfReader(str(OUT))
assert len(reader.pages) == 5
assert all(float(p.mediabox.width) == W and float(p.mediabox.height) == H for p in reader.pages)
document = fitz.open(str(OUT))
for index, pdf_page in enumerate(document):
    assert len(pdf_page.get_text().strip()) > 30
    pdf_page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(str(QA / f"slide-{index + 1:02d}.png"))
(QA / "text.txt").write_text("\n\n".join(p.extract_text() for p in reader.pages), encoding="utf-8")
print(f"Created {OUT}; five 16:9 pages, rendered to {QA}")
