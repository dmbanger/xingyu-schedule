param(
    [string]$JavaHome = 'D:\PyCharm 2024.1\jbr',
    [string]$AndroidJar = 'E:\Codex\tmp\android-build\platform\android-35\android.jar',
    [string]$BuildTools = 'E:\Codex\tmp\android-build\build-tools\android-15'
)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$appVersion = Get-Content -LiteralPath (Join-Path $projectRoot 'version.properties') -Raw | ConvertFrom-StringData
$taskBuild = Join-Path $projectRoot 'build\manual'
$classes = Join-Path $taskBuild 'classes'
$dex = Join-Path $taskBuild 'dex'
$dist = Join-Path $projectRoot 'dist'
foreach ($folder in @($taskBuild,$classes,$dex,$dist)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
function Run-Checked([string]$program, [string[]]$arguments) {
    # javac/aapt2 write notes to stderr. Windows PowerShell 5.1 turns native stderr into a
    # terminating error while ErrorActionPreference is Stop, so relax it for the call and
    # rely on the exit code below to detect real failures.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $program @arguments } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "Build step failed: $program (exit $LASTEXITCODE)" }
}
Run-Checked 'node' @((Join-Path $projectRoot 'tools\generate-extractor.cjs'))
Run-Checked 'node' @((Join-Path $projectRoot 'tools\generate-version.cjs'))
$env:JAVA_HOME = $JavaHome
$env:PATH = (Join-Path $JavaHome 'bin') + ';' + $env:PATH
$resources = Join-Path $taskBuild 'resources.zip'
Run-Checked (Join-Path $BuildTools 'aapt2.exe') @('compile','--dir',(Join-Path $projectRoot 'app\src\main\res'),'-o',$resources)
$baseApk = Join-Path $taskBuild 'base.apk'
Run-Checked (Join-Path $BuildTools 'aapt2.exe') @('link','-o',$baseApk,'-I',$AndroidJar,'--manifest',(Join-Path $projectRoot 'app\src\main\AndroidManifest.xml'),'-A',(Join-Path $projectRoot 'app\src\main\assets'),'--min-sdk-version','26','--target-sdk-version','35','--version-code',$appVersion.versionCode,'--version-name',$appVersion.versionName,$resources)
$sources = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'app\src\main\java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $JavaHome 'bin\javac.exe') (@('-encoding','UTF-8','--release','8','-classpath',$AndroidJar,'-d',$classes) + $sources)
$classFiles = @(Get-ChildItem -LiteralPath $classes -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
Run-Checked (Join-Path $BuildTools 'd8.bat') (@('--min-api','26','--lib',$AndroidJar,'--output',$dex) + $classFiles)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($baseApk, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $oldEntry = $archive.GetEntry('classes.dex')
    if ($oldEntry) { $oldEntry.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $dex 'classes.dex'),'classes.dex') | Out-Null
} finally { $archive.Dispose() }
$alignedApk = Join-Path $taskBuild 'aligned.apk'
Run-Checked (Join-Path $BuildTools 'zipalign.exe') @('-f','4',$baseApk,$alignedApk)
$keystore = Join-Path $projectRoot 'build\xingyu-local-development.jks'
# This is a development signing key. Preserve it locally for updates; do not publish it.
if (-not (Test-Path -LiteralPath $keystore)) {
    Run-Checked (Join-Path $JavaHome 'bin\keytool.exe') @('-genkeypair','-keystore',$keystore,'-alias','xingyu','-storepass','xingyu-local-development','-keypass','xingyu-local-development','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Xingyu Local Development')
}
$apkName = 'XingyuSchedule-' + $appVersion.versionName + '.apk'
$apk = Join-Path $dist $apkName
Run-Checked (Join-Path $BuildTools 'apksigner.bat') @('sign','--ks',$keystore,'--ks-key-alias','xingyu','--ks-pass','pass:xingyu-local-development','--key-pass','pass:xingyu-local-development','--out',$apk,$alignedApk)
Run-Checked (Join-Path $BuildTools 'apksigner.bat') @('verify','--verbose',$apk)
$hash = Get-FileHash -LiteralPath $apk -Algorithm SHA256
($hash.Hash.ToLowerInvariant() + '  ' + $apkName) | Set-Content -LiteralPath (Join-Path $dist 'SHA256SUMS.txt') -Encoding utf8
Get-Item -LiteralPath $apk | Select-Object FullName,Length
