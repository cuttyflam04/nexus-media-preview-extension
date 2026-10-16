param(
  [string]$OutputDirectory = "dist"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$outputRoot = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory
} else {
  Join-Path $root $OutputDirectory
}
$stageRoot = Join-Path $root "tmp\distribution-stage"

if (Test-Path -LiteralPath $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot, $outputRoot -Force | Out-Null

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "manifest.json does not contain a version."
}

$rootFiles = @("options.css", "options.html", "options.js", "README.md")
$sourceDirectories = @("icons", "src")

function New-BrowserPackage {
  param(
    [Parameter(Mandatory = $true)][string]$Browser,
    [Parameter(Mandatory = $true)][bool]$IncludeServiceWorker
  )

  $stage = Join-Path $stageRoot $Browser
  New-Item -ItemType Directory -Path (Join-Path $stage "icons"), (Join-Path $stage "src") -Force | Out-Null

  foreach ($file in $rootFiles) {
    Copy-Item -LiteralPath (Join-Path $root $file) -Destination $stage
  }
  foreach ($directory in $sourceDirectories) {
    Copy-Item -Path (Join-Path $root "$directory\*") -Destination (Join-Path $stage $directory) -Recurse
  }

  $packageManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($IncludeServiceWorker) {
    # Chromium: service worker only; the Firefox id would only raise a warning.
    $packageManifest.background.PSObject.Properties.Remove("scripts")
    $packageManifest.PSObject.Properties.Remove("browser_specific_settings")
  } else {
    $packageManifest.background.PSObject.Properties.Remove("service_worker")
  }
  # UTF-8 without BOM: store validators reject a BOM in manifest.json.
  $json = $packageManifest | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText((Join-Path $stage "manifest.json"), $json, (New-Object System.Text.UTF8Encoding($false)))

  $zipPath = Join-Path $outputRoot "nexus-media-preview-$version-$Browser.zip"
  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  # Build the ZIP entry by entry with forward slashes: Windows PowerShell's
  # Compress-Archive writes backslashes, which addons.mozilla.org refuses.
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $stageFull = (Resolve-Path -LiteralPath $stage).Path.TrimEnd("\") + "\"
    foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File) {
      $entry = $file.FullName.Substring($stageFull.Length).Replace("\", "/")
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
  return Get-Item -LiteralPath $zipPath
}

$packages = @(
  (New-BrowserPackage -Browser "chrome" -IncludeServiceWorker $true),
  (New-BrowserPackage -Browser "firefox" -IncludeServiceWorker $false)
)

$packages | Select-Object FullName, Length
