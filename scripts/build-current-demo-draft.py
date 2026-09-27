"""Create a new editable Jianying draft from the current demo's final assets.

No existing draft or exported video is replaced. Media is copied into the new
draft, with video, narration and timed captions on separate editable tracks.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = ROOT / "runtime/current-submission-video/output"


def load_skill():
    current_dir = Path(__file__).resolve().parent
    candidates = [
        os.environ.get("JY_SKILL_ROOT", "").strip(),
        current_dir / ".agent/skills/jianying-editor",
        current_dir / ".trae/skills/jianying-editor",
        current_dir / ".claude/skills/jianying-editor",
        ROOT / ".agent/skills/jianying-editor",
        ROOT / "skills/jianying-editor",
        Path("D:/.codex/skills/jianying-editor"),
    ]
    skill = next((Path(item).resolve() for item in candidates if item and
                  (Path(item) / "scripts/jy_wrapper.py").is_file()), None)
    if skill is None:
        raise ImportError("Set JY_SKILL_ROOT to the installed jianying-editor skill.")
    os.environ["JY_SKILL_ROOT"] = str(skill)
    sys.path.insert(0, str(skill / "scripts"))
    from jy_wrapper import JyProject
    import pyJianYingDraft as draft
    from utils.formatters import get_default_drafts_root
    return JyProject, draft, get_default_drafts_root


def sha256(file: Path) -> str:
    with file.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def timestamp_us(value: str) -> int:
    hour, minute, second, millis = map(int, re.split(r"[:,.]", value))
    return (((hour * 60 + minute) * 60 + second) * 1000 + millis) * 1000


def read_srt(file: Path) -> list[dict]:
    content = file.read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip()
    cues = []
    previous_end = 0
    for block in re.split(r"\n\s*\n", content):
        lines = block.splitlines()
        if len(lines) < 3 or not lines[0].strip().isdigit():
            raise ValueError("Expected numbered SRT cues with timing and text.")
        match = re.fullmatch(r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})", lines[1].strip())
        if not match:
            raise ValueError("Unsupported SRT timing line.")
        start, end = (timestamp_us(part) for part in match.groups())
        text = "\n".join(lines[2:]).strip()
        if not text or end <= start or start < previous_end:
            raise ValueError("Subtitle cues must be nonempty, ordered and non-overlapping.")
        cues.append({"start": start, "end": end, "text": text})
        previous_end = end
    if not cues:
        raise ValueError("No subtitle cues found.")
    return cues


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", type=Path, default=DEFAULT_ASSETS)
    parser.add_argument("--drafts-root", type=Path)
    parser.add_argument("--name", default="Ming - Current Product Demo - 20260927")
    args = parser.parse_args()
    assets = args.assets_dir.resolve()
    sources = {
        "video": assets / "ming-demo-silent.mp4",
        "narration": assets / "ming-demo-narration.wav",
        "subtitles": assets / "ming-demo.srt",
    }
    for file in sources.values():
        if not file.is_file() or not file.stat().st_size:
            raise FileNotFoundError(f"Final asset is missing or empty: {file}")
    source_hashes = {kind: sha256(file) for kind, file in sources.items()}
    cues = read_srt(sources["subtitles"])
    JyProject, draft, default_root = load_skill()
    from pymediainfo import MediaInfo
    video_info = MediaInfo.parse(str(sources["video"]))
    if len(video_info.video_tracks) != 1 or video_info.audio_tracks:
        raise ValueError("The draft's video input must have one video track and no audio.")
    video_meta = video_info.video_tracks[0]
    if (video_meta.width, video_meta.height) != (1600, 900):
        raise ValueError("Expected 1600 x 900 final silent footage.")
    if abs(float(video_meta.frame_rate) - 30) > .001:
        raise ValueError("Expected final silent footage at 30 fps.")
    video_duration = draft.VideoMaterial(str(sources["video"])).duration
    audio_duration = draft.AudioMaterial(str(sources["narration"])).duration
    if abs(video_duration - audio_duration) > 150_000:
        raise ValueError("Final silent footage and narration durations differ by more than 150 ms.")
    if cues[-1]["end"] > min(video_duration, audio_duration) + 50_000:
        raise ValueError("Subtitles extend past the final media.")

    drafts_root = (args.drafts_root or Path(default_root())).resolve()
    if not drafts_root.is_dir():
        raise FileNotFoundError("The installed Jianying draft root does not exist.")
    if not args.name or re.search(r'[<>:"/\\|?*\x00-\x1f]', args.name) or ".." in args.name or args.name.strip(" .") != args.name:
        raise ValueError("Use a simple, safe new draft name.")
    name = args.name
    suffix = 2
    while (drafts_root / name).exists():
        name = f"{args.name} - {suffix:02}"
        suffix += 1
    destination = (drafts_root / name).resolve()
    if destination.parent != drafts_root:
        raise ValueError("The draft path must remain inside the configured draft root.")

    # Atomic create with replacement explicitly prohibited, including race cases.
    script = draft.DraftFolder(str(drafts_root)).create_draft(name, 1600, 900, 30, allow_replace=False)
    project = JyProject(name, width=1600, height=900, drafts_root=str(drafts_root),
                        overwrite=False, script_instance=script)
    copied = {}
    local_media = destination / "media"
    local_media.mkdir()
    for kind, source in sources.items():
        copied[kind] = local_media / source.name
        shutil.copy2(source, copied[kind])
        if sha256(copied[kind]) != source_hashes[kind]:
            raise ValueError("Copied media does not match its input.")
    video = project.add_media_safe(str(copied["video"]), start_time=0,
                                   duration=video_duration, track_name="Actual product footage")
    narration = project.add_audio_safe(str(copied["narration"]), start_time=0,
                                       duration=audio_duration, track_name="English narration")
    if video is None or narration is None:
        raise RuntimeError("Jianying could not import the final media.")
    video.volume = 0
    narration.volume = 1
    for cue in cues:
        project.add_text_simple(
            cue["text"], start_time=cue["start"], duration=cue["end"] - cue["start"],
            track_name="English subtitles",
            style=draft.TextStyle(size=5.0, color=(1.0, 1.0, 1.0), align=1,
                                  auto_wrapping=True, max_line_width=.94),
            border=draft.TextBorder(color=(.04, .06, .1), alpha=1.0, width=12.0),
            clip_settings=draft.ClipSettings(transform_y=-.865),
        )
    saved = project.save()
    if not saved or saved.get("status") != "SUCCESS":
        raise RuntimeError("Jianying draft save did not report success.")
    info = destination / "draft_info.json"
    content = json.loads(info.read_text(encoding="utf-8"))
    tracks = content.get("tracks", [])
    expected = {"video": 1, "audio": 1, "text": len(cues)}
    actual = {kind: sum(len(track.get("segments", [])) for track in tracks
                        if track.get("type") == kind) for kind in expected}
    if actual != expected or content["fps"] != 30 or content["canvas_config"]["width"] != 1600 or content["canvas_config"]["height"] != 900:
        raise ValueError("Saved draft track structure or canvas differs from the requested edit.")
    text_segments = next(track["segments"] for track in tracks if track["type"] == "text")
    for segment, cue in zip(text_segments, cues):
        if segment["target_timerange"] != {"start": cue["start"], "duration": cue["end"] - cue["start"]}:
            raise ValueError("Saved subtitle timing differs from the supplied SRT.")
    for kind, source in sources.items():
        if sha256(source) != source_hashes[kind]:
            raise ValueError("An original media file changed during draft creation.")
    report = {
        "ok": True, "draftName": name, "draftPath": str(destination), "saved": True,
        "canvas": {"width": 1600, "height": 900, "fps": 30},
        "durationSeconds": content["duration"] / 1_000_000,
        "trackSegments": actual, "subtitleTimingMatchesSrt": True,
        "mediaCopiedIntoDraft": True, "originalAssetsUnchanged": True,
        "sourceAssets": {kind: {"path": str(file), "sha256": source_hashes[kind]}
                         for kind, file in sources.items()},
        "existingDraftsOverwritten": False,
        "uiOpenVerified": False,
        "note": "Saved and structurally inspected through JyProject. This does not claim an interactive Jianying preview or export was performed.",
    }
    report_file = destination / "ming-draft-build-report.json"
    report_file.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    report["reportPath"] = str(report_file)
    (assets.parent / "jianying-draft-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
