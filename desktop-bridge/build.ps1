param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'release'))
$ErrorActionPreference = 'Stop'
$outPath = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outPath -Force | Out-Null
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
$argsList = @('/nologo','/target:winexe',('/out:' + (Join-Path $outPath 'BESTSNS-Studio-Bridge.exe')),
 '/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Net.Http.dll',
 '/reference:System.Web.Extensions.dll','/reference:System.Security.dll',
 ('/reference:' + (Join-Path $framework 'WPF\UIAutomationClient.dll')),
 ('/reference:' + (Join-Path $framework 'WPF\UIAutomationTypes.dll')),
 ('/reference:' + (Join-Path $framework 'WPF\WindowsBase.dll')),
 (Join-Path $PSScriptRoot 'StudioBridge.cs'))
& $compiler @argsList
if ($LASTEXITCODE -ne 0) { throw '컴파일에 실패했습니다.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '사용안내.txt') -Destination $outPath -Force
& $compiler /nologo /target:winexe "/out:$outPath\BESTSNS-Setup.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.CSharp.dll "/resource:$outPath\BESTSNS-Studio-Bridge.exe,Bridge.exe" (Join-Path $PSScriptRoot 'Installer.cs')
if ($LASTEXITCODE -ne 0) { throw '설치 프로그램 컴파일에 실패했습니다.' }
Write-Output "빌드 완료: $outPath"
