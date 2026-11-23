# --- AGY SESSION COLORS, TITLE & LIVE STATUS ---
# Wraps `agy` so every interactive session gets:
#   1. A distinct color theme (collision-free across live sessions)
#   2. A clear tab title (folder / custom -Title / auto-captured first prompt)
#   3. Live status in the tab title + Windows Terminal progress ring (via hooks)
# Also provides `agyn` to open a new Windows Terminal tab with matching --tabColor.

$script:AgySessionThemes = @(
    @{ Name = 'Mint';  Fg = '#8AF7C2'; Accent = '#00E0A0'; Dot = 0x1F7E2 }
    @{ Name = 'Sky';   Fg = '#8CD4FF'; Accent = '#2FA8FF'; Dot = 0x1F535 }
    @{ Name = 'Lilac'; Fg = '#CFAFFF'; Accent = '#A67BFF'; Dot = 0x1F7E3 }
    @{ Name = 'Gold';  Fg = '#FFD970'; Accent = '#FFB800'; Dot = 0x1F7E1 }
    @{ Name = 'Peach'; Fg = '#FFB78A'; Accent = '#FF7A3D'; Dot = 0x1F7E0 }
    @{ Name = 'Rose';  Fg = '#FF9EC7'; Accent = '#FF4F9A'; Dot = 0x1F534 }
    @{ Name = 'Aqua';  Fg = '#7CF2F2'; Accent = '#00D4E0'; Dot = 0x1FA75 }
    @{ Name = 'Lime';  Fg = '#CCF57A'; Accent = '#9BE000'; Dot = 0x1F7E9 }
)

function ConvertTo-AgyRgb([string]$Hex) {
    $h = $Hex.TrimStart('#')
    '{0};{1};{2}' -f [Convert]::ToInt32($h.Substring(0, 2), 16), [Convert]::ToInt32($h.Substring(2, 2), 16), [Convert]::ToInt32($h.Substring(4, 2), 16)
}

function Get-AgySessionDir {
    $dir = Join-Path $env:TEMP 'agy-sessions'
    if (-not (Test-Path $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
    return $dir
}

function Select-AgyTheme([string]$Preferred) {
    if ($Preferred) {
        $match = $script:AgySessionThemes | Where-Object { $_.Name -ieq $Preferred } | Select-Object -First 1
        if ($match) { return $match }
    }

    $dir = Get-AgySessionDir
    $inUse = @{}
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

    $lastFile = Join-Path $dir 'last-color.txt'
    $last = if (Test-Path $lastFile) { (Get-Content -LiteralPath $lastFile -ErrorAction SilentlyContinue | Select-Object -First 1) } else { '' }

    $available = @($script:AgySessionThemes | Where-Object { -not $inUse.ContainsKey($_.Name) })
    if ($available.Count -eq 0) { $available = $script:AgySessionThemes }

    $nonRepeat = @($available | Where-Object { $_.Name -ne $last })
    $pool = if ($nonRepeat.Count -gt 0) { $nonRepeat } else { $available }

    $picked = $pool | Get-Random
    Set-Content -Path $lastFile -Value $picked.Name -ErrorAction SilentlyContinue
    return $picked
}

function agy {
    $exe = (Get-Command agy -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source

    # Parse optional wrapper flags (-Title / -Color) and forward everything else to agy.exe
    $customTitle = $null
    $customColor = $null
    $convId = $null
    $passArgs = New-Object System.Collections.Generic.List[string]
    $nonInteractive = $false
    $nonInteractiveFlags = @('-p', '--print', '--prompt', '-h', '--help', 'help', 'acp', 'agent', 'agents', 'changelog', 'install', 'mcp', 'mic-serve', 'models', 'plugin', 'plugins', 'remote-control', 'update')

    for ($i = 0; $i -lt $args.Count; $i++) {
        $arg = [string]$args[$i]
        if ($arg -ieq '-Title' -and ($i + 1) -lt $args.Count) {
            $customTitle = [string]$args[++$i]
            continue
        }
        if ($arg -ieq '-Color' -and ($i + 1) -lt $args.Count) {
            $customColor = [string]$args[++$i]
            continue
        }
        if ($arg -eq '--conversation' -and ($i + 1) -lt $args.Count) {
            $convId = [string]$args[$i + 1]
        }
        if ($nonInteractiveFlags -contains $arg) {
            $nonInteractive = $true
        }
        $passArgs.Add($arg)
    }

    if ($nonInteractive -or [Console]::IsOutputRedirected) {
        & $exe @passArgs
        return
    }

    $esc = [char]27
    $bel = [char]7
    $midDot = [char]0x00B7
    $theme = Select-AgyTheme -Preferred $customColor
    $dotChar = [char]::ConvertFromUtf32($theme.Dot)

    $cwd = (Get-Location).Path
    $folder = Split-Path $cwd -Leaf
    if (-not $folder) { $folder = $cwd }
    $initialTitle = if ($customTitle) { $customTitle } else { $folder }

    $sessionDir = Get-AgySessionDir
    $sid = if ($env:WT_SESSION) { $env:WT_SESSION } else { "pid-$PID-$([guid]::NewGuid().ToString('N').Substring(0,8))" }
    $stateFile = Join-Path $sessionDir "$sid.json"

    $initState = @{
        pid            = $PID
        cwd            = $cwd
        color          = $theme.Name
        accent         = $theme.Accent
        title          = $initialTitle
        autoTitle      = (-not [bool]$customTitle)
        titleLocked    = [bool]$customTitle
        status         = 'ready'
        detail         = ''
        conversationId = $convId
        startedAt      = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        updatedAt      = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    $jsonState = $initState | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($stateFile, $jsonState, [System.Text.UTF8Encoding]::new($false))

    $prevEnv = @{
        AGY_SESSION_STATE  = $env:AGY_SESSION_STATE
        AGY_SESSION_COLOR  = $env:AGY_SESSION_COLOR
        AGY_SESSION_ACCENT = $env:AGY_SESSION_ACCENT
        AGY_SESSION_TITLE  = $env:AGY_SESSION_TITLE
    }
    $env:AGY_SESSION_STATE = $stateFile
    $env:AGY_SESSION_COLOR = $theme.Name
    $env:AGY_SESSION_ACCENT = $theme.Accent
    $env:AGY_SESSION_TITLE = $initialTitle

    $keeper = $null
    if ($env:WT_SESSION) {
        # Recolor text (OSC 10) and cursor (OSC 12) only; keep default background
        $colorSeq = "$esc]10;$($theme.Fg)$bel$esc]12;$($theme.Accent)$bel"
        $initTab = "$dotChar Ready $midDot $initialTitle"
        [Console]::Write("$colorSeq$esc]0;$initTab$bel$esc]9;4;0;0$bel")

        $keeper = [PowerShell]::Create().AddScript({
            param($colorSeq, $stateFile, $dotChar, $defaultTitle)
            $esc = [char]27
            $bel = [char]7
            $midDot = [char]0x00B7
            $spin = [char]0x27F3
            $check = [char]0x2713
            $cross = [char]0x2716
            $pause = [char]0x23F8
            $lastMtime = [datetime]::MinValue
            $curTab = "$dotChar Ready $midDot $defaultTitle"
            $curProg = "$esc]9;4;0;0$bel"
            $tick = 0

            while ($true) {
                Start-Sleep -Milliseconds 250
                $tick++
                $changed = $false

                if (Test-Path -LiteralPath $stateFile) {
                    try {
                        $mtime = (Get-Item -LiteralPath $stateFile -ErrorAction Stop).LastWriteTimeUtc
                        if ($mtime -ne $lastMtime) {
                            $lastMtime = $mtime
                            $st = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
                            $t = if ($st.title) { [string]$st.title } else { $defaultTitle }
                            $det = if ($st.detail) { " ($($st.detail))" } else { '' }
                            switch ([string]$st.status) {
                                'working' {
                                    $curTab = "$dotChar $spin Working$det $midDot $t"
                                    $curProg = "$esc]9;4;3;0$bel"
                                }
                                'done' {
                                    $curTab = "$dotChar $check Done $midDot $t"
                                    $curProg = "$esc]9;4;0;0$bel"
                                }
                                'error' {
                                    $curTab = "$dotChar $cross Error $midDot $t"
                                    $curProg = "$esc]9;4;2;100$bel"
                                }
                                'paused' {
                                    $curTab = "$dotChar $pause Paused $midDot $t"
                                    $curProg = "$esc]9;4;4;100$bel"
                                }
                                default {
                                    $curTab = "$dotChar Ready $midDot $t"
                                    $curProg = "$esc]9;4;0;0$bel"
                                }
                            }
                            $changed = $true
                        }
                    } catch {}
                }

                # Re-assert colors every 250ms (guards against agy.exe OSC 110 resets) and title/progress on change or every 1s
                try {
                    if ($changed -or ($tick % 4 -eq 0)) {
                        [Console]::Write("$colorSeq$esc]0;$curTab$bel$curProg")
                    } else {
                        [Console]::Write($colorSeq)
                    }
                } catch {}
            }
        }).AddArgument($colorSeq).AddArgument($stateFile).AddArgument($dotChar).AddArgument($initialTitle)
        $null = $keeper.BeginInvoke()
    }

    # Compact distinct launch banner
    $accentRgb = ConvertTo-AgyRgb $theme.Accent
    $fgRgb = ConvertTo-AgyRgb $theme.Fg
    $rule = ([string][char]0x2500) * 50
    [Console]::Write("`n$esc[38;2;${accentRgb}m$rule$esc[0m`n")
    [Console]::Write("$esc[48;2;${accentRgb};38;2;14;18;22;1m  AGY $midDot $($theme.Name.ToUpper())  $esc[0m  $esc[38;2;${fgRgb};1m$initialTitle$esc[0m  $esc[2m$(Get-Date -Format 'ddd HH:mm')$esc[0m`n")
    [Console]::Write("$esc[38;2;${accentRgb}m$rule$esc[0m`n`n")

    try {
        & $exe @passArgs
    }
    finally {
        if ($keeper) { $keeper.Stop(); $keeper.Dispose() }
        if ($env:WT_SESSION) {
            [Console]::Write("$esc]110$bel$esc]112$bel$esc]9;4;0;0$bel")
        }
        Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
        foreach ($key in $prevEnv.Keys) {
            if ($prevEnv[$key]) { Set-Item "Env:$key" $prevEnv[$key] }
            else { Remove-Item "Env:$key" -ErrorAction SilentlyContinue }
        }
    }
}

function agyn {
    param(
        [string]$Title,
        [string]$Color,
        [string]$Dir = (Get-Location).Path
    )
    $theme = Select-AgyTheme -Preferred $Color
    $safeDir = $Dir.Replace("'", "''")
    $cmd = "Set-Location '$safeDir'; agy -Color '$($theme.Name)'"
    if ($Title) {
        $safeTitle = $Title.Replace("'", "''")
        $cmd += " -Title '$safeTitle'"
    }
    $tabTitle = if ($Title) { $Title } else { Split-Path $Dir -Leaf }
    wt -w 0 new-tab --tabColor $theme.Accent --title $tabTitle -d $Dir powershell -NoExit -Command $cmd
}
