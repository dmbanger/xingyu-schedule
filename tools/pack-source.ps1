# 打包源码压缩包，并刷新 dist/SHA256SUMS.txt（APK + 源码包两行）。
# 用法：先跑 build-apk.ps1，再跑 .\tools\pack-source.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $root 'version.properties') -Raw | ConvertFrom-StringData)
$name = $version.versionName
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$zipPath = Join-Path $dist ('XingyuSchedule-' + $name + '-source.zip')
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$skipTop = @('build', 'dist', '.git', '.gradle', '.idea')
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$count = 0
try {
    foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File -Force) {
        $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        $top = $relative.Split('/')[0]
        if ($skipTop -contains $top) { continue }
        if ($relative -match '\.(apk|idsig|jks)$') { continue }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $count++
    }
} finally { $archive.Dispose() }
$lines = @()
$apkPath = Join-Path $dist ('XingyuSchedule-' + $name + '.apk')
if (Test-Path -LiteralPath $apkPath) {
    $lines += (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + (Split-Path -Leaf $apkPath)
}
$lines += (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + (Split-Path -Leaf $zipPath)
Set-Content -LiteralPath (Join-Path $dist 'SHA256SUMS.txt') -Value $lines -Encoding utf8
Get-Item -LiteralPath $zipPath | Select-Object FullName, Length
"entries: $count"
