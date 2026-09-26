$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$videoWork = Join-Path $projectRoot 'runtime/submission-video'
$story = Get-Content -Raw -LiteralPath (Join-Path $videoWork 'story.json') | ConvertFrom-Json
$speech = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$speech.SelectVoice('Microsoft Zira Desktop')
$speech.Rate = 0
$speech.Volume = 100
try {
  for ($segment = 0; $segment -lt $story.Count; $segment++) {
    $wavePath = Join-Path $videoWork ('voice-{0:d2}.wav' -f $segment)
    $speech.SetOutputToWaveFile($wavePath)
    $speech.Speak($story[$segment].text)
    $speech.SetOutputToNull()
    Write-Output ('Narration {0} generated' -f $segment)
  }
} finally { $speech.Dispose() }
