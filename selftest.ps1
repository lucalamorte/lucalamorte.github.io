# Prueba el juego de punta a punta en escritorio y en celular, sin tocar nada a mano.
# Uso: powershell -ExecutionPolicy Bypass -File selftest.ps1
# Corre en tiempo real: con el tiempo virtual del modo headless el reloj salta cuando la página no pide cuadros
# (el juego duerme su ciclo mientras no se juega) y la prueba deja de parecerse a un navegador de verdad.
$root = $PSScriptRoot
$server = Start-Process python -ArgumentList '-m', 'http.server', '8799', '--bind', '127.0.0.1' -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$steps = Join-Path $env:TEMP "pk-selftest-$(Get-Random).json"
'[{"wait":60000},{"eval":"document.title"}]' | Set-Content -Encoding ascii $steps
$out = Join-Path $env:TEMP "pk-selftest-shots"
$failed = $false
foreach ($size in @(@(1600, 912), @(375, 812))) {
  $env:FILM_W = $size[0]; $env:FILM_H = $size[1]
  $env:FILM_DESKTOP = if ($size[0] -ge 768) { '1' } else { '' }
  $log = & node (Join-Path $root 'tools/film.mjs') 'http://127.0.0.1:8799/index.html#selftest' $out $steps | Out-String
  $title = [regex]::Match($log, 'SELFTEST [^"]*').Value
  Write-Output "$($size -join ',')  $title"
  if ($title -notlike 'SELFTEST PASS*') { $failed = $true }
}
Remove-Item $steps -ErrorAction SilentlyContinue
Stop-Process -Id $server.Id -Force
if ($failed) { exit 1 }
