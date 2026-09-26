"""Mux actual Playwright footage with offline Zira narration and English captions."""
from pathlib import Path
import sys, json, wave, subprocess, re, textwrap, shutil
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'runtime/media-tools'))
import imageio_ffmpeg
WORK = ROOT / 'runtime/submission-video'
OUT = ROOT / 'submission/ming-demo.mp4'
STORY = json.loads((WORK / 'story.json').read_text(encoding='utf-8'))
RECORD = json.loads((WORK / 'recording.json').read_text(encoding='utf-8'))
assert RECORD['success'] is True and not RECORD['pageErrors']
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
shutil.copyfile('C:/Windows/Fonts/arial.ttf', WORK / 'arial.ttf')

def timestamp(seconds, srt=True):
    milliseconds = round(seconds * 1000)
    h, rest = divmod(milliseconds, 3600000); m, rest = divmod(rest, 60000); s, ms = divmod(rest, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}' if srt else f'{h}:{m:02}:{s:02}.{ms//10:02}'

ass = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1600', 'PlayResY: 900', 'WrapStyle: 2', '', '[V4+ Styles]',
       'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
       'Style: Default,Arial,27,&H00FFFFFF,&H00FFFFFF,&H0010244D,&H0010244D,0,0,0,0,100,100,0,0,1,0,0,2,30,30,9,1', '', '[Events]',
       'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
srt = []; caption_id = 0; voice_info = []; audio_filters = []
inputs = ['-i', RECORD['rawVideo']]
for i, chapter in enumerate(STORY):
    audio = WORK / f'voice-{i:02}.wav'; inputs += ['-i', str(audio)]
    with wave.open(str(audio)) as source:
        duration = source.getnframes() / source.getframerate()
    available = chapter['end'] - chapter['start'] - 0.4
    tempo = max(1.0, duration / available)
    spoken = duration / tempo
    voice_info.append({'chapter': i, 'originalSeconds': duration, 'tempo': tempo, 'finalSeconds': spoken})
    audio_filters.append(f'[{i+1}:a]atempo={tempo:.6f},aresample=48000,adelay={chapter["start"]*1000}:all=1[a{i}]')
    (WORK / f'chapter-{i:02}.txt').write_text(chapter['title'], encoding='utf-8')
    sentences = re.split(r'(?<=[.!?])\s+', chapter['text'])
    weights = [len(sentence.split()) + 1 for sentence in sentences]; total = sum(weights); cursor = chapter['start']
    for sentence, weight in zip(sentences, weights):
        stop = cursor + spoken * weight / total
        lines = textwrap.wrap(sentence, width=100, break_long_words=False)
        assert len(lines) <= 2, sentence
        caption_id += 1
        srt += [str(caption_id), f'{timestamp(cursor)} --> {timestamp(stop)}', '\n'.join(lines), '']
        caption = r'\N'.join(lines).replace('{', '').replace('}', '')
        ass.append(f'Dialogue: 0,{timestamp(cursor,False)},{timestamp(stop,False)},Default,,0,0,0,,{caption}')
        cursor = stop

(ROOT / 'submission/ming-demo.srt').write_text('\n'.join(srt), encoding='utf-8')
(WORK / 'captions.ass').write_text('\n'.join(ass), encoding='utf-8')
vf = f'[0:v]trim=start={RECORD["trimStartSeconds"]:.3f}:duration=164,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2,trim=duration=164,fps=30,pad=1600:900:0:0:color=0x10244D'
for i, chapter in enumerate(STORY):
    vf += f",drawtext=fontfile=runtime/submission-video/arial.ttf:textfile=runtime/submission-video/chapter-{i:02}.txt:fontsize=18:fontcolor=0xB5C6E8:x=30:y=818:enable='between(t,{chapter['start']},{chapter['end']})'"
vf += ',ass=runtime/submission-video/captions.ass[v]'
audio = ''.join(f'[a{i}]' for i in range(len(STORY))) + f'amix=inputs={len(STORY)}:normalize=0,apad,atrim=duration=164,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
filters = ';\n'.join([vf, *audio_filters, audio]); (WORK / 'mux-filters.txt').write_text(filters, encoding='utf-8')
command = [FFMPEG, '-y', '-hide_banner', *inputs, '-filter_complex_script', str(WORK / 'mux-filters.txt'),
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-threads', '4', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', '-t', '164', '-movflags', '+faststart', str(OUT)]
with (WORK / 'mux.log').open('w', encoding='utf-8') as log:
    subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
assert OUT.stat().st_size < 90 * 1024 * 1024
(WORK / 'audio-timing.json').write_text(json.dumps(voice_info, indent=2), encoding='utf-8')
# Representative start/middle/end frames. Review them before presenting the video.
for seconds in [4, 24, 40, 58, 70, 91, 106, 120, 136, 145, 158, 163]:
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(seconds), '-i', str(OUT), '-frames:v', '1', str(WORK / f'qa-{seconds:03}.png')], cwd=ROOT, check=True)
probe = subprocess.run([FFMPEG, '-hide_banner', '-i', str(OUT)], capture_output=True, text=True)
(WORK / 'final-probe.txt').write_text(probe.stderr, encoding='utf-8')
print(f'Created {OUT}, {OUT.stat().st_size/1024/1024:.1f} MiB; target164s,150s actual working-solution UI.')
