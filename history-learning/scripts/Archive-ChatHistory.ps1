<#
.SYNOPSIS
  Zips coding-agent chat logs older than N days into one archive, verifies every
  file in the zip against a SHA-256 of the original, and only then deletes the
  originals. Run history-learning (`hl learn` + synthesis) first: its evidence
  survives the deletion, but sessions removed here can no longer be re-extracted.

  Archived (per agent, a unit is skipped if ANY of its files is newer than the cutoff):
    claude       ~/.claude/projects/<proj>/<id>.jsonl + <id>/ (subagents, tool results)
                 memory/ folders are never touched.
    codex        ~/.codex/sessions/** rollout files. The state/thread_history SQLite
                 databases (used by Codex Memories) are never touched.
    antigravity  ~/.gemini/antigravity/conversations/* and brain/<id>/
                 conversation_summaries.db is never touched.

  Restore: unzip the archive over $HOME (entries are stored relative to $HOME).

.EXAMPLE
  .\Archive-ChatHistory.ps1 -WhatIf            # list what would be archived
  .\Archive-ChatHistory.ps1 -Days 7 -Dest E:\ChatArchive
#>
param(
    [int]$Days = 7,
    [string]$Dest = (Join-Path $env:USERPROFILE 'ChatArchive'),
    [ValidateSet('claude', 'codex', 'antigravity')][string[]]$Agents = @('claude', 'codex', 'antigravity'),
    [string]$HomeDir = $env:USERPROFILE,
    [switch]$WhatIf,
    [switch]$KeepOriginals
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$cutoff = (Get-Date).AddDays(-$Days)
$homeFull = (Resolve-Path $HomeDir).Path.TrimEnd('\')

# Apps that hold their logs open; deleting under a running app can corrupt its index.
$procFor = @{ antigravity = 'antigravity*' }
foreach ($a in $Agents) {
    if ($procFor[$a] -and (Get-Process -Name $procFor[$a] -EA 0)) {
        throw "$a is running. Close it first, or pass -Agents without '$a'."
    }
}

function Get-Files($dir) {
    # Files under $dir, never descending into junctions/symlinks.
    $out = New-Object System.Collections.Generic.List[System.IO.FileInfo]
    $stack = New-Object System.Collections.Stack
    $stack.Push((Get-Item -LiteralPath $dir))
    while ($stack.Count) {
        $d = $stack.Pop()
        foreach ($e in $d.GetFileSystemInfos()) {
            if ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) { Write-Warning "skipping link $($e.FullName)"; continue }
            if ($e -is [IO.DirectoryInfo]) { $stack.Push($e) } else { $out.Add($e) }
        }
    }
    return $out.ToArray()
}

# Each unit = files that are archived together (or not at all), plus dirs to remove after.
$units = New-Object System.Collections.Generic.List[object]
function Add-Unit($agent, $files, $dirs) {
    $files = @($files | Where-Object { $_ })
    if (-not $files.Count) { return }
    $newest = ($files | Measure-Object LastWriteTime -Maximum).Maximum
    if ($newest -lt $cutoff) { $units.Add([pscustomobject]@{ Agent = $agent; Files = $files; Dirs = @($dirs) }) }
}

if ($Agents -contains 'claude') {
    $root = Join-Path $homeFull '.claude\projects'
    if (Test-Path $root) {
        foreach ($proj in Get-ChildItem -LiteralPath $root -Directory) {
            if ($proj.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            foreach ($j in Get-ChildItem -LiteralPath $proj.FullName -File -Filter *.jsonl) {
                $sub = Join-Path $proj.FullName $j.BaseName
                $files = @($j)
                $dirs = @()
                if (Test-Path -LiteralPath $sub -PathType Container) { $files += (Get-Files $sub); $dirs = @($sub) }
                Add-Unit 'claude' $files $dirs
            }
        }
    }
}
if ($Agents -contains 'codex') {
    $root = Join-Path $homeFull '.codex\sessions'
    if (Test-Path $root) { foreach ($f in Get-Files $root) { Add-Unit 'codex' @($f) @() } }
}
if ($Agents -contains 'antigravity') {
    $ag = Join-Path $homeFull '.gemini\antigravity'
    $conv = Join-Path $ag 'conversations'
    if (Test-Path $conv) {
        # A conversation DB may have -wal/-shm siblings; archive them together.
        foreach ($g in Get-ChildItem -LiteralPath $conv -File | Group-Object { $_.Name -replace '-(wal|shm|journal)$', '' }) {
            Add-Unit 'antigravity' $g.Group @()
        }
    }
    $brain = Join-Path $ag 'brain'
    if (Test-Path $brain) {
        foreach ($d in Get-ChildItem -LiteralPath $brain -Directory) {
            if ($d.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            Add-Unit 'antigravity' (Get-Files $d.FullName) @($d.FullName)
        }
    }
}

$all = @($units | ForEach-Object { $_.Files })
$mb = [math]::Round((($all | Measure-Object Length -Sum).Sum) / 1MB)
foreach ($g in $units | Group-Object Agent) {
    $n = @($g.Group | ForEach-Object { $_.Files }).Count
    Write-Host ("{0,-12} {1,5} units  {2,6} files  {3,7:N0} MB" -f $g.Name, $g.Count, $n, ((@($g.Group | ForEach-Object { $_.Files }) | Measure-Object Length -Sum).Sum / 1MB))
}
Write-Host "Total: $($all.Count) files, $mb MB older than $($cutoff.ToString('yyyy-MM-dd HH:mm'))"
if (-not $all.Count) { Write-Host 'Nothing to archive.'; exit 0 }
if ($WhatIf) { Write-Host 'WhatIf: nothing written or deleted.'; exit 0 }

function Get-Rel($full) {
    if (-not $full.StartsWith($homeFull + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "outside home: $full" }
    $full.Substring($homeFull.Length + 1).Replace('\', '/')
}
function Get-Sha($stream) {
    $h = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($h.ComputeHash($stream)).Replace('-', '') } finally { $h.Dispose() }
}
$noCompress = '.zst', '.gz', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.pb', '.mp4'

New-Item -ItemType Directory -Force $Dest | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipPath = Join-Path $Dest "chat-logs-$stamp.zip"
$tmpZip = "$zipPath.partial"
$manifest = @{}
$failed = New-Object System.Collections.Generic.List[string]

# 1. Write the zip (to .partial, renamed only after verification).
$fs = [IO.File]::Open($tmpZip, 'CreateNew')
$zip = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
try {
    $i = 0
    foreach ($f in $all) {
        $i++
        if ($i % 200 -eq 0) { Write-Host "  zipped $i / $($all.Count)" }
        $rel = Get-Rel $f.FullName
        $lvl = if ($noCompress -contains $f.Extension.ToLower()) { 'NoCompression' } else { 'Optimal' }
        try {
            $src = [IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite')
            try {
                $sha = Get-Sha $src
                $src.Position = 0
                $e = $zip.CreateEntry($rel, [IO.Compression.CompressionLevel]::$lvl)
                $e.LastWriteTime = $f.LastWriteTime
                $w = $e.Open(); try { $src.CopyTo($w) } finally { $w.Dispose() }
            } finally { $src.Dispose() }
            $manifest[$rel] = [pscustomobject]@{ Path = $rel; Bytes = $f.Length; Modified = $f.LastWriteTime.ToString('o'); Sha256 = $sha }
        } catch { $failed.Add("$($f.FullName): $($_.Exception.Message)") }
    }
    $csv = ($manifest.Values | Sort-Object Path | ConvertTo-Csv -NoTypeInformation) -join "`r`n"
    $m = $zip.CreateEntry('MANIFEST.csv'); $w = New-Object IO.StreamWriter($m.Open()); $w.Write($csv); $w.Dispose()
} finally { $zip.Dispose(); $fs.Dispose() }
if ($failed.Count) {
    Remove-Item -LiteralPath $tmpZip
    throw "Could not read $($failed.Count) file(s); nothing deleted, archive discarded:`n$($failed -join "`n")"
}

# 2. Verify: re-read every entry from disk and compare hash + size with the original.
Write-Host 'Verifying archive...'
$bad = New-Object System.Collections.Generic.List[string]
$z = [IO.Compression.ZipFile]::OpenRead($tmpZip)
try {
    $seen = @{}
    foreach ($e in $z.Entries) {
        if ($e.FullName -eq 'MANIFEST.csv') { continue }
        $exp = $manifest[$e.FullName]
        if (-not $exp) { $bad.Add("unexpected entry $($e.FullName)"); continue }
        $s = $e.Open(); try { $got = Get-Sha $s } finally { $s.Dispose() }
        if ($got -ne $exp.Sha256 -or $e.Length -ne $exp.Bytes) { $bad.Add("mismatch $($e.FullName)") }
        $seen[$e.FullName] = 1
    }
    foreach ($k in $manifest.Keys) { if (-not $seen[$k]) { $bad.Add("missing $k") } }
} finally { $z.Dispose() }
if ($bad.Count) { throw "Archive verification FAILED ($($bad.Count)); nothing deleted. Kept $tmpZip for inspection:`n$($bad -join "`n")" }
Move-Item -LiteralPath $tmpZip $zipPath
($manifest.Values | Sort-Object Path | ConvertTo-Csv -NoTypeInformation) | Set-Content -Encoding UTF8 ($zipPath -replace '\.zip$', '.manifest.csv')
$zmb = [math]::Round((Get-Item $zipPath).Length / 1MB)
Write-Host "Verified $($manifest.Count) files -> $zipPath ($zmb MB, from $mb MB)" -ForegroundColor Green
if ($KeepOriginals) { exit 0 }

# 3. Delete originals: files one by one (never recursive deletes), then now-empty dirs.
$delFail = New-Object System.Collections.Generic.List[string]
foreach ($f in $all) {
    # Skip a file that changed since it was hashed rather than delete unarchived data.
    $now = Get-Item -LiteralPath $f.FullName -EA 0
    if (-not $now) { continue }
    if ($now.LastWriteTime -ne $f.LastWriteTime -or $now.Length -ne $f.Length) { $delFail.Add("changed since archive, kept: $($f.FullName)"); continue }
    try { [IO.File]::Delete($f.FullName) } catch { $delFail.Add("$($f.FullName): $($_.Exception.Message)") }
}
foreach ($d in ($units | ForEach-Object { $_.Dirs } | Where-Object { $_ })) {
    # Deepest first; only removes directories that are now empty.
    foreach ($sub in @(Get-ChildItem -LiteralPath $d -Recurse -Directory -EA 0 | Sort-Object { $_.FullName.Length } -Descending) + @(Get-Item -LiteralPath $d -EA 0)) {
        if ($sub -and -not ($sub.Attributes -band [IO.FileAttributes]::ReparsePoint) -and -not $sub.GetFileSystemInfos().Count) { [IO.Directory]::Delete($sub.FullName) }
    }
}
if ($delFail.Count) {
    Write-Host "Archive is complete, but $($delFail.Count) original(s) were not deleted:`n$($delFail -join "`n")" -ForegroundColor Red
    exit 1
}
Write-Host "Deleted $($all.Count) originals." -ForegroundColor Green
exit 0
