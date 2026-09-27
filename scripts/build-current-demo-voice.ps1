param(
  [string]$NarrationPath,
  [string]$OutputDirectory,
  [string]$Voice = 'Microsoft Zira Desktop'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $NarrationPath) { $NarrationPath = Join-Path $PSScriptRoot 'demo-video-narration.json' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'runtime/current-submission-video/voices' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$story = @(Get-Content -Raw -LiteralPath $NarrationPath | ConvertFrom-Json)
if (-not $story.Count) { throw 'The narration storyboard is empty.' }
if ((Test-Path -LiteralPath $OutputDirectory) -and @(Get-ChildItem -LiteralPath $OutputDirectory -File).Count) {
  throw 'The voice output folder already contains files. Choose a new output directory to preserve prior recordings.'
}

Add-Type -AssemblyName System.Speech
if (-not ('MingOfflineNarrator' -as [type])) {
  Add-Type -ReferencedAssemblies ([System.Speech.Synthesis.SpeechSynthesizer].Assembly.Location) -TypeDefinition @'
using System;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;

public static class MingOfflineNarrator {
    public static void Render(string text, string outputPath, string voiceName) {
        using (var speech = new SpeechSynthesizer()) {
            speech.SelectVoice(voiceName);
            speech.Rate = 0;
            speech.Volume = 100;
            speech.SetOutputToWaveFile(outputPath, new SpeechAudioFormatInfo(22050, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            speech.Speak(text);
            speech.SetOutputToNull();
        }
    }
}
'@
}

function Get-WaveMetadata([string]$Path) {
  $reader = [IO.BinaryReader]::new([IO.File]::OpenRead($Path))
  try {
    if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(4)) -ne 'RIFF') { throw 'Expected RIFF WAV.' }
    $null = $reader.ReadUInt32()
    if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(4)) -ne 'WAVE') { throw 'Expected WAVE format.' }
    $byteRate = 0; $sampleRate = 0; $channels = 0; $sampleBits = 0; $dataBytes = 0
    while ($reader.BaseStream.Position + 8 -le $reader.BaseStream.Length) {
      $chunk = [Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
      $length = $reader.ReadUInt32()
      $chunkStart = $reader.BaseStream.Position
      if ($chunk -eq 'fmt ') {
        if ($reader.ReadUInt16() -ne 1) { throw 'Expected PCM narration WAV.' }
        $channels = $reader.ReadUInt16()
        $sampleRate = $reader.ReadUInt32()
        $byteRate = $reader.ReadUInt32()
        $null = $reader.ReadUInt16()
        $sampleBits = $reader.ReadUInt16()
      } elseif ($chunk -eq 'data') {
        $dataBytes += $length
      }
      $reader.BaseStream.Position = $chunkStart + $length + ($length % 2)
    }
    if ($byteRate -le 0 -or $dataBytes -le 0) { throw 'No measured PCM audio found.' }
    return @{ durationSeconds = $dataBytes / $byteRate; sampleRate = $sampleRate; channels = $channels; bitsPerSample = $sampleBits }
  } finally { $reader.Dispose() }
}

$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$ffmpegPath = Join-Path $projectRoot 'runtime/media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
if (-not (Test-Path -LiteralPath $ffmpegPath)) { throw 'The existing project FFmpeg is required for PCM concatenation.' }
$sceneResults = @()
for ($index = 0; $index -lt $story.Count; $index++) {
  $chapter = $story[$index]
  if (-not $chapter.text -or $chapter.end -le $chapter.start) { throw "Invalid scene $index." }
  $wavePath = Join-Path $OutputDirectory ('scene-{0:d2}.wav' -f $index)
  $sentenceMatches = [regex]::Matches($chapter.text, '\S[\s\S]*?(?:[.!?](?=\s|$)|$)')
  $sentences = @(); $concat = @(); $cursor = 0.0
  for ($sentenceIndex = 0; $sentenceIndex -lt $sentenceMatches.Count; $sentenceIndex++) {
    $sentence = $sentenceMatches[$sentenceIndex]
    $sentenceFile = Join-Path $OutputDirectory ('scene-{0:d2}-sentence-{1:d2}.wav' -f $index, $sentenceIndex)
    [MingOfflineNarrator]::Render($sentence.Value.Trim(), $sentenceFile, $Voice)
    $measured = Get-WaveMetadata $sentenceFile
    $sentences += [ordered]@{
      text = $sentence.Value.Trim(); characterPosition = $sentence.Index; file = $sentenceFile
      durationSeconds = [Math]::Round($measured.durationSeconds, 6)
      audioStartSeconds = [Math]::Round($cursor, 6)
      audioEndSeconds = [Math]::Round($cursor + $measured.durationSeconds, 6)
    }
    $cursor += $measured.durationSeconds
    $concat += "file '" + ([IO.Path]::GetFileName($sentenceFile)) + "'"
  }
  $concatPath = Join-Path $OutputDirectory ('scene-{0:d2}-concat.txt' -f $index)
  [IO.File]::WriteAllLines($concatPath, $concat, [Text.UTF8Encoding]::new($false))
  & $ffmpegPath -hide_banner -loglevel error -f concat -safe 0 -i $concatPath -c:a pcm_s16le $wavePath
  if ($LASTEXITCODE -ne 0) { throw "Scene $index PCM concatenation failed." }
  $audio = Get-WaveMetadata $wavePath
  if ([Math]::Abs($audio.durationSeconds - $cursor) -gt 0.002) { throw "Scene $index measured sentence timing does not match concatenated audio." }
  $windowSeconds = [double]$chapter.end - [double]$chapter.start
  $availableSeconds = $windowSeconds - 0.4
  $neededTempo = [Math]::Max(1.0, $audio.durationSeconds / $availableSeconds)
  $recommendedTempo = [Math]::Min(1.08, $neededTempo)
  foreach ($sentence in $sentences) {
    $sentence.timelineStartSeconds = [Math]::Round([double]$chapter.start + $sentence.audioStartSeconds / $recommendedTempo, 6)
    $sentence.timelineEndSeconds = [Math]::Round([double]$chapter.start + $sentence.audioEndSeconds / $recommendedTempo, 6)
  }
  $sceneResults += [ordered]@{
    index = $index; title = $chapter.title; file = $wavePath
    sceneStartSeconds = $chapter.start; sceneEndSeconds = $chapter.end
    originalDurationSeconds = [Math]::Round($audio.durationSeconds, 6)
    sampleRate = $audio.sampleRate; channels = $audio.channels; bitsPerSample = $audio.bitsPerSample
    availableSeconds = $availableSeconds
    tempoNeededToFit = [Math]::Round($neededTempo, 6)
    recommendedTempo = [Math]::Round($recommendedTempo, 6)
    fittedDurationSeconds = [Math]::Round($audio.durationSeconds / $recommendedTempo, 6)
    fitsAtOrBelow108Percent = ($neededTempo -le 1.08)
    sentences = $sentences
  }
  Write-Output ('Scene {0:d2}: {1:N2}s voice / {2:N2}s available; needed tempo {3:N3}' -f $index, $audio.durationSeconds, $availableSeconds, $neededTempo)
}
$report = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString('o')
  engine = 'Windows System.Speech (offline)'
  voice = $Voice; speechRate = 0; maxTempo = 1.08
  timingMethod = 'Each sentence is synthesized as a separate offline PCM WAV. Exact measured file durations determine sentence boundaries; sentence PCM is concatenated without added gaps into each scene WAV. Timeline positions apply the recommended tempo. No SAPI progress-event timing is used.'
  generatedNetworkRequests = 0
  allScenesFit = (@($sceneResults | Where-Object { -not $_.fitsAtOrBelow108Percent }).Count -eq 0)
  scenes = $sceneResults
}
$reportPath = Join-Path $OutputDirectory 'timing.json'
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding utf8
Write-Output ('Timing report: ' + $reportPath)
if (-not $report.allScenesFit) { Write-Warning 'One or more scenes need shorter narration or a longer scene; this generator did not time-stretch audio.' }
