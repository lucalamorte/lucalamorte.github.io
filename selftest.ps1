# Prueba el juego de punta a punta en escritorio y en celular, sin tocar nada a mano.
# Uso: powershell -ExecutionPolicy Bypass -File selftest.ps1
$root = $PSScriptRoot
$server = Start-Process python -ArgumentList '-m', 'http.server', '8799', '--bind', '127.0.0.1' -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$failed = $false
foreach ($size in @('1600,912', '375,812')) {
  $prof = Join-Path $env:TEMP "pk-selftest-$(Get-Random)"
  $dom = & $edge --headless=new --disable-gpu --user-data-dir=$prof --window-size=$size --virtual-time-budget=240000 --dump-dom "http://127.0.0.1:8799/index.html#selftest" 2>$null | Out-String
  $title = [regex]::Match($dom, '<title>([^<]*)</title>').Groups[1].Value
  Write-Output "$size  $title"
  if ($title -notlike 'SELFTEST PASS*') { $failed = $true }
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
}
Stop-Process -Id $server.Id -Force
if ($failed) { exit 1 }
