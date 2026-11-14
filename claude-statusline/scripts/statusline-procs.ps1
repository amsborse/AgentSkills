# Snapshot of every process (pid, parent, name, RAM in use, short command line) for statusline.js.
# statusline.js starts this in the background when the cache is older than a few seconds, so the
# status line itself never waits on the ~0.3s process query. Errors go to the .err file, not silence.
param([Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = 'Stop'
try {
  $rows = foreach ($p in Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,WorkingSetSize,CommandLine) {
    $c = [string]$p.CommandLine
    if ($c.Length -gt 300) { $c = $c.Substring(0, 300) }
    [pscustomobject]@{ p = [int]$p.ProcessId; pp = [int]$p.ParentProcessId; n = $p.Name; ws = [int64]$p.WorkingSetSize; c = $c }
  }
  $json = @{ at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); procs = @($rows) } | ConvertTo-Json -Depth 3 -Compress
  $tmp = "$Out.$PID.tmp"
  [IO.File]::WriteAllText($tmp, $json)
  Move-Item -LiteralPath $tmp -Destination $Out -Force
  Remove-Item -LiteralPath "$Out.err" -ErrorAction SilentlyContinue
} catch {
  [IO.File]::WriteAllText("$Out.err", "$(Get-Date -Format o) $($_.Exception.Message)")
}
