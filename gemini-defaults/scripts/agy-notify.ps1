# Antigravity (AGY) Stop notification: persistent Windows toast with colored
# session badge + sound (ported from ~/.claude/hooks/notify-done.ps1).
param(
    [string]$Status = 'done',
    [string]$SessionTitle = '',
    [string]$Folder = '',
    [string]$ColorName = '',
    [string]$AccentHex = '',
    [string]$Detail = ''
)

$where = if ($Folder) { " in $Folder" } else { '' }
$tag = if ($ColorName) { " [$ColorName]" } else { '' }
$label = if ($SessionTitle -and $SessionTitle -ne $Folder) { "$SessionTitle$where" } else { "Task$where" }

if ($Status -eq 'error') {
    $title = 'Antigravity - ERROR'
    $body = if ($Detail) { "$label$tag - $Detail" } else { "Stopped with error$where$tag" }
    $sound = 'Windows Critical Stop.wav'
} else {
    $title = 'Antigravity'
    $body = "Finished: $label$tag"
    $claudeWav = Join-Path $env:USERPROFILE '.claude\hooks\sounds\tube-hq.wav'
    $sound = if (Test-Path $claudeWav) { $claudeWav } else { 'Windows Notify Messaging.wav' }
}

# Generate/cache a circular badge image in the session's accent color
$logo = ''
if ($AccentHex -match '^#[0-9A-Fa-f]{6}$') {
    $initial = if ($ColorName) { $ColorName.Substring(0, 1).ToUpper() } else { 'A' }
    $png = Join-Path $env:TEMP ("agy-toast-{0}-{1}.png" -f $AccentHex.TrimStart('#'), $initial)
    if (-not (Test-Path $png)) {
        try {
            Add-Type -AssemblyName System.Drawing
            $bmp = New-Object System.Drawing.Bitmap 96, 96
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.SmoothingMode = 'AntiAlias'
            $g.TextRenderingHint = 'AntiAliasGridFit'
            $g.Clear([System.Drawing.ColorTranslator]::FromHtml($AccentHex))
            $font = New-Object System.Drawing.Font 'Segoe UI', 44, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
            $fmt = New-Object System.Drawing.StringFormat
            $fmt.Alignment = 'Center'
            $fmt.LineAlignment = 'Center'
            $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#121418'))
            $g.DrawString($initial, $font, $ink, (New-Object System.Drawing.RectangleF 0, 0, 96, 96), $fmt)
            $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
            $g.Dispose(); $bmp.Dispose()
        } catch {}
    }
    if (Test-Path $png) {
        $logo = '<image placement="appLogoOverride" hint-crop="circle" src="file:///{0}"/>' -f ($png -replace '\\', '/')
    }
}

$titleEsc = [System.Security.SecurityElement]::Escape($title)
$bodyEsc = [System.Security.SecurityElement]::Escape($body)

try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    $xml = @"
<toast scenario="reminder">
  <visual>
    <binding template="ToastGeneric">
      $logo
      <text>$titleEsc</text>
      <text>$bodyEsc</text>
    </binding>
  </visual>
  <actions>
    <action content="Dismiss" arguments="dismiss" activationType="system"/>
  </actions>
  <audio silent="true"/>
</toast>
"@

    $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
    $doc.LoadXml($xml)
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show(
        [Windows.UI.Notifications.ToastNotification]::new($doc))
} catch {}

try {
    if (-not [System.IO.Path]::IsPathRooted($sound)) { $sound = "$env:WINDIR\Media\$sound" }
    if (Test-Path $sound) {
        (New-Object System.Media.SoundPlayer $sound).PlaySync()
    }
} catch {}
