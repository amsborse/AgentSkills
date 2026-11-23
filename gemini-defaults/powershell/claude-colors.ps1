# --- CLAUDE CODE TERMINAL COLORS, TITLE & LIVE STATUS ---
# Unified with agy-colors.ps1:
#   - Collision-free distinct text (OSC 10) & cursor (OSC 12) across BOTH claude & agy sessions
#   - Leaves terminal background untouched
#   - Live tab title with colored dot + folder/custom -Title + WT progress ring (OSC 9;4)
#   - Exports CLAUDE_SESSION_COLOR / CLAUDE_SESSION_ACCENT for statusline.js & notify-done.ps1

$script:ClaudeUnifiedThemes = @(
    @{ Name = 'Mint';  Fg = '#8AF7C2'; Accent = '#00E0A0'; Dot = 0x1F7E2 }
    @{ Name = 'Sky';   Fg = '#8CD4FF'; Accent = '#2FA8FF'; Dot = 0x1F535 }
    @{ Name = 'Lilac'; Fg = '#CFAFFF'; Accent = '#A67BFF'; Dot = 0x1F7E3 }
    @{ Name = 'Gold';  Fg = '#FFD970'; Accent = '#FFB800'; Dot = 0x1F7E1 }
    @{ Name = 'Peach'; Fg = '#FFB78A'; Accent = '#FF7A3D'; Dot = 0x1F7E0 }
    @{ Name = 'Rose';  Fg = '#FF9EC7'; Accent = '#FF4F9A'; Dot = 0x1F534 }
    @{ Name = 'Aqua';  Fg = '#7CF2F2'; Accent = '#00D4E0'; Dot = 0x1FA75 }
    @{ Name = 'Lime';  Fg = '#CCF57A'; Accent = '#9BE000'; Dot = 0x1F7E9 }
)

function ConvertTo-ClaudeRgb([string]$Hex) {
    $h = $Hex.TrimStart('#')
    '{0};{1};{2}' -f [Convert]::ToInt32($h.Substring(0, 2), 16), [Convert]::ToInt32($h.Substring(2, 2), 16), [Convert]::ToInt32($h.Substring(4, 2), 16)
}

function Select-ClaudeTheme([string]$Preferred) {
    if ($Preferred) {
        $match = $script:ClaudeUnifiedThemes | Where-Object { $_.Name -ieq $Preferred } | Select-Object -First 1
        if ($match) { return $match }
    }

    $inUse = @{}
    foreach ($sub in @('claude-sessions', 'agy-sessions')) {
        $dir = Join-Path $env:TEMP $sub
        if (-not (Test-Path $dir)) { continue }
        foreach ($f in (Get-ChildItem -Path $dir -Filter '*.json' -ErrorAction SilentlyContinue)) {
            try {
                $data = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
                if ($data.pid -and (Get-Process -Id $data.pid -ErrorAction SilentlyContinue)) {
                    if ($data.color) { $inUse[$data.color] = $true }
                } else {
                    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
    }

    $lastFile = Join-Path $env:TEMP 'claude-last-color.txt'
    $last = if (Test-Path $lastFile) { (Get-Content -LiteralPath $lastFile -ErrorAction SilentlyContinue | Select-Object -First 1) } else { '' }
    $available = @($script:ClaudeUnifiedThemes | Where-Object { -not $inUse.ContainsKey($_.Name) })
    if ($available.Count -eq 0) { $available = $script:ClaudeUnifiedThemes }
    $nonRepeat = @($available | Where-Object { $_.Name -ne $last })
    $pool = if ($nonRepeat.Count -gt 0) { $nonRepeat } else { $available }
    $picked = $pool | Get-Random
    Set-Content -Path $lastFile -Value $picked.Name -ErrorAction SilentlyContinue
    return $picked
}

function claude {
    $exe = (Get-Command claude -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source

    $customTitle = $null
    $customColor = $null
    $passArgs = New-Object System.Collections.Generic.List[string]
    $nonInteractive = $false
    $nonInteractiveFlags = @('-p', '--print', '-h', '--help', '--version', '-v')
    for ($i = 0; $i -lt $args.Count; $i++) {
        $arg = [string]$args[$i]
        if ($arg -ieq '-Title' -and ($i + 1) -lt $args.Count) { $customTitle = [string]$args[++$i]; continue }
        if ($arg -ieq '-Color' -and ($i + 1) -lt $args.Count) { $customColor = [string]$args[++$i]; continue }
        if ($nonInteractiveFlags -contains $arg) { $nonInteractive = $true }
        $passArgs.Add($arg)
    }

    if ($nonInteractive -or [Console]::IsOutputRedirected) {
        & $exe @passArgs
        return
    }

    $esc = [char]27; $bel = [char]7; $midDot = [char]0x00B7
    $theme = Select-ClaudeTheme -Preferred $customColor
    $dotChar = [char]::ConvertFromUtf32($theme.Dot)
    $cwd = (Get-Location).Path
    $folder = Split-Path $cwd -Leaf
    if (-not $folder) { $folder = $cwd }
    $initialTitle = if ($customTitle) { $customTitle } else { $folder }

    $sessionDir = Join-Path $env:TEMP 'claude-sessions'
    if (-not (Test-Path $sessionDir)) { $null = New-Item -ItemType Directory -Path $sessionDir -Force }
    $sid = if ($env:WT_SESSION) { $env:WT_SESSION } else { "pid-$PID-$([guid]::NewGuid().ToString('N').Substring(0,8))" }
    $stateFile = Join-Path $sessionDir "$sid.json"

    $initState = @{
        pid = $PID; cwd = $cwd; color = $theme.Name; accent = $theme.Accent;
        title = $initialTitle; status = 'ready';
        startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    [System.IO.File]::WriteAllText($stateFile, ($initState | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))

    $prev = @{
        Color = $env:CLAUDE_SESSION_COLOR
        Accent = $env:CLAUDE_SESSION_ACCENT
        State = $env:CLAUDE_SESSION_STATE
    }
    $env:CLAUDE_SESSION_COLOR = $theme.Name
    $env:CLAUDE_SESSION_ACCENT = $theme.Accent
    $env:CLAUDE_SESSION_STATE = $stateFile

    $keeper = $null
    if ($env:WT_SESSION) {
        $colorSeq = "$esc]10;$($theme.Fg)$bel$esc]12;$($theme.Accent)$bel"
        $tabTitle = "$dotChar Claude $midDot $initialTitle"
        [Console]::Write("$colorSeq$esc]0;$tabTitle$bel")

        $keeper = [PowerShell]::Create().AddScript({
            param($colorSeq, $tabTitle)
            $esc = [char]27; $bel = [char]7
            $tick = 0
            while ($true) {
                Start-Sleep -Milliseconds 350
                $tick++
                try {
                    if ($tick % 3 -eq 0) { [Console]::Write("$colorSeq$esc]0;$tabTitle$bel") }
                    else { [Console]::Write($colorSeq) }
                } catch {}
            }
        }).AddArgument($colorSeq).AddArgument($tabTitle)
        $null = $keeper.BeginInvoke()
    }

    $accent = ConvertTo-ClaudeRgb $theme.Accent
    $fg = ConvertTo-ClaudeRgb $theme.Fg
    $rule = ([string][char]0x2500) * 50
    [Console]::Write("`n$esc[38;2;${accent}m$rule$esc[0m`n")
    [Console]::Write("$esc[48;2;${accent};38;2;14;18;22;1m  CLAUDE $midDot $($theme.Name.ToUpper())  $esc[0m  $esc[38;2;${fg};1m$initialTitle$esc[0m  $esc[2m$(Get-Date -Format 'ddd HH:mm')$esc[0m`n")
    [Console]::Write("$esc[38;2;${accent}m$rule$esc[0m`n`n")

    try {
        & $exe @passArgs
    }
    finally {
        if ($keeper) { $keeper.Stop(); $keeper.Dispose() }
        if ($env:WT_SESSION) {
            [Console]::Write("$esc]110$bel$esc]112$bel$esc]9;4;0;0$bel")
        }
        Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
        foreach ($pair in @(@('CLAUDE_SESSION_COLOR', $prev.Color), @('CLAUDE_SESSION_ACCENT', $prev.Accent), @('CLAUDE_SESSION_STATE', $prev.State))) {
            if ($pair[1]) { Set-Item "Env:$($pair[0])" $pair[1] }
            else { Remove-Item "Env:$($pair[0])" -ErrorAction SilentlyContinue }
        }
    }
}
