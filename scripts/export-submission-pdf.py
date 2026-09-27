"""Export the finalized deck's original page renders as an eight-page viewing PDF.

The PPTX contains editable text; this matching PDF preserves the reviewed layout.
Run finalize-submission-presentation.mjs first. Requires reportlab and pypdf.
Final files remain in ignored runtime until reviewed and copied to submission/.
"""
from pathlib import Path
import hashlib
import json
from reportlab.pdfgen import canvas
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "runtime/submission-deck-20260927"
RENDERS = BUILD / "final-renders"
OUTPUT = BUILD / "output/ming-slides.pdf"
PAGES = [RENDERS / f"slide-{i:02}.png" for i in range(1, 9)]
for image in PAGES:
    if not image.is_file():
        raise FileNotFoundError(image)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(OUTPUT), pagesize=(960, 540), pageCompression=1)
pdf.setTitle("Ming - Every done comes with proof")
pdf.setAuthor("Ming")
pdf.setSubject("IBM Bob 2.0 Hackathon project presentation")
for index, image in enumerate(PAGES):
    pdf.drawImage(str(image), 0, 0, width=960, height=540)
    if index == 7:
        # The links follow the editable source slide's text positions.
        pdf.linkURL("https://ming-acceptance-proof.amosming.chatgpt.site", (54, 182, 730, 216), relative=0)
        pdf.linkURL("https://github.com/Ming-Amos/Ming", (54, 122, 520, 156), relative=0)
    pdf.showPage()
pdf.save()
reader = PdfReader(OUTPUT)
assert len(reader.pages) == 8
assert all(tuple(float(v) for v in page.mediabox) == (0, 0, 960, 540) for page in reader.pages)
assert len(reader.pages[-1].get("/Annots", [])) == 2
receipt = {
    "pages": len(reader.pages),
    "pageSizePoints": [960, 540],
    "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "outputBytes": OUTPUT.stat().st_size,
    "source": "Finalized PPTX rendered by the artifact runtime; raster viewing copy.",
    "editableSource": "submission/ming-slides.pptx",
}
(BUILD / "pdf-validation.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
print(json.dumps(receipt))
