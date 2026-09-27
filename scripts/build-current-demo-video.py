"""Edit real recorded scenes with measured offline narration and English subtitles.

Only idle provider waiting may be shortened. Browser actions never speed up and
results/captures are never replaced. Original media and edit decisions remain
under ignored runtime/current-submission-video for provenance and review.
"""
from pathlib import Path
import json, subprocess, sys, shutil, textwrap

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'runtime/media-tools'))
import imageio_ffmpeg
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
WORK=ROOT/'runtime/current-submission-video'
OUT=WORK/'output'; OUT.mkdir(parents=True,exist_ok=True)
STORY=json.loads((ROOT/'scripts/demo-video-narration.json').read_text(encoding='utf-8'))
RECORD=json.loads((WORK/'take/recording.json').read_text(encoding='utf-8'))
TIMING=json.loads((WORK/'voices-final/timing.json').read_text(encoding='utf-8-sig'))
assert RECORD['success'] and not RECORD['preflight'] and RECORD['actualProvider']
assert RECORD['draftRequests']==1 and not RECORD['errors'] and not RECORD['blockedRequests']
assert RECORD['runs']['samePlan'] and RECORD['runs']['sourceChanged']
assert RECORD['runs']['baseline']['status']=='failed' and RECORD['runs']['revision']['status']=='passed'
assert len(RECORD['scenes'])==len(STORY)==10
DURATION=STORY[-1]['end']
shutil.copyfile('C:/Windows/Fonts/arial.ttf',WORK/'arial.ttf')

def run(args,name):
    with (WORK/(name+'.log')).open('w',encoding='utf-8') as log:
        subprocess.run([FFMPEG,'-y','-hide_banner',*args],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)

def timestamp(t,srt=False):
    ms=round(t*1000); hours,ms=divmod(ms,3600000); minutes,ms=divmod(ms,60000); seconds,ms=divmod(ms,1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{ms:03}' if srt else f'{hours}:{minutes:02}:{seconds:02}.{ms//10:02}'

decisions=[];segments=[]; filters=[]
for i,(scene,target) in enumerate(zip(RECORD['scenes'],STORY)):
    length=target['end']-target['start']; excess=scene['duration']-length
    begin=RECORD['trimStartSeconds']+scene['start']
    intervals=[(begin,begin+length)]
    if excess>0.25:
        assert i==3, f'Unplanned operation overrun in scene {i}: {excess:.2f}s. Review before editing.'
        cut_begin=RECORD['trimStartSeconds']+RECORD['modelWaitStart']+3
        cut_end=cut_begin+excess
        assert cut_end<RECORD['trimStartSeconds']+RECORD['modelWaitEnd']-2, 'Only idle waiting can be removed.'
        intervals=[(begin,cut_begin),(cut_end,begin+scene['duration'])]
        decisions.append({'scene':i,'reason':'Idle model waiting shortened; execution unchanged','removedSeconds':excess,'rawStart':cut_begin,'rawEnd':cut_end})
    for j,(a,b) in enumerate(intervals):
        label=f's{i}_{j}';filters.append(f'[0:v]trim=start={a:.6f}:end={b:.6f},setpts=PTS-STARTPTS[{label}]');segments.append(f'[{label}]')
filters.append(''.join(segments)+f'concat=n={len(segments)}:v=1:a=0,fps=30,pad=1600:900:0:0:color=0x080b16[scene]')
labels='[scene]'
for i,chapter in enumerate(STORY):
    title=chapter['title'].replace(' · ', ' | ')
    if any(d['scene']==i for d in decisions): title+=' | idle wait shortened'
    (WORK/f'chapter-{i:02}.txt').write_text(title,encoding='utf-8')
    labels+=f"drawtext=fontfile=runtime/current-submission-video/arial.ttf:textfile=runtime/current-submission-video/chapter-{i:02}.txt:fontsize=17:fontcolor=0x9DB8EA:x=32:y=816:enable='between(t,{chapter['start']},{chapter['end']})',"
filters.append(labels.rstrip(',')+'[v]')
(WORK/'footage-filters.txt').write_text(';\n'.join(filters),encoding='utf-8')
run(['-i',RECORD['rawVideo'],'-filter_complex_script',str(WORK/'footage-filters.txt'),'-map','[v]','-an','-c:v','libx264','-threads','4','-preset','medium','-crf','19','-pix_fmt','yuv420p','-t',str(DURATION),'-movflags','+faststart',str(OUT/'ming-demo-silent.mp4')],'silent-render')
print('Edited real footage.',flush=True)

ass=['[Script Info]','ScriptType: v4.00+','PlayResX: 1600','PlayResY: 900','WrapStyle: 2','','[V4+ Styles]',
'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
'Style: Default,Arial,26,&H00F3F5FF,&H00F3F5FF,&H00080B16,&H00080B16,0,0,0,0,100,100,0,0,1,0,0,2,32,32,9,1','','[Events]',
'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
srt=[];cue_id=0;inputs=[];audio=[]
for i,scene in enumerate(TIMING['scenes']):
    inputs+=['-i',scene['file']]
    audio.append(f'[{i}:a]atempo={scene["recommendedTempo"]:.6f},aresample=48000,adelay={round(scene["sceneStartSeconds"]*1000)}:all=1[a{i}]')
    for sentence in scene['sentences']:
        start=sentence['timelineStartSeconds'];end=sentence['timelineEndSeconds']
        assert start<end<=STORY[i]['end']
        lines=textwrap.wrap(sentence['text'],width=105,break_long_words=False)
        assert len(lines)<=2
        cue_id+=1;srt +=[str(cue_id),f'{timestamp(start,True)} --> {timestamp(end,True)}','\n'.join(lines),'']
        content=r'\N'.join(lines).replace('{','').replace('}','')
        ass.append(f'Dialogue: 0,{timestamp(start)},{timestamp(end)},Default,,0,0,0,,{content}')
(OUT/'ming-demo.srt').write_text('\n'.join(srt),encoding='utf-8')
(WORK/'captions.ass').write_text('\n'.join(ass),encoding='utf-8')
audio.append(''.join(f'[a{i}]' for i in range(len(STORY)))+f'amix=inputs={len(STORY)}:normalize=0,apad,atrim=duration={DURATION},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]')
(WORK/'audio-filters.txt').write_text(';\n'.join(audio),encoding='utf-8')
run([*inputs,'-filter_complex_script',str(WORK/'audio-filters.txt'),'-map','[a]','-c:a','pcm_s16le','-ar','48000','-ac','1',str(OUT/'ming-demo-narration.wav')],'voice-render')
print('Aligned offline narration and English subtitles.',flush=True)
run(['-i',str(OUT/'ming-demo-silent.mp4'),'-i',str(OUT/'ming-demo-narration.wav'),'-vf','ass=runtime/current-submission-video/captions.ass','-map','0:v','-map','1:a','-c:v','libx264','-threads','4','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','160k','-t',str(DURATION),'-movflags','+faststart',str(OUT/'ming-demo.mp4')],'final-render')
assert (OUT/'ming-demo.mp4').stat().st_size<95*1024*1024
(WORK/'edit-decisions.json').write_text(json.dumps({'duration':DURATION,'edits':decisions,'actualProductOperationSeconds':122,'captureSize':[1600,810],'finalSize':[1600,900],'fps':30,'subtitleCues':cue_id,'recording':RECORD['rawVideo'],'narration':'Microsoft Zira Desktop (offline)'},indent=2),encoding='utf-8')
print(json.dumps({'candidate':str(OUT/'ming-demo.mp4'),'seconds':DURATION,'bytes':(OUT/'ming-demo.mp4').stat().st_size,'subtitleCues':cue_id,'edits':decisions}))
