# [FIX 2026.11.03] 可重复用于补充实拍图片；保留原图，仅生成网页副本和应用图标。
param([int]$MaxWidth = 960)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$photoRoot = Join-Path $projectRoot '图片'
$assetRoot = Join-Path $projectRoot 'assets'
$outputRoot = Join-Path $assetRoot 'stalls'
[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]78)
foreach ($photo in Get-ChildItem -LiteralPath $photoRoot -File -Filter '*.jpg') {
    $target = Join-Path $outputRoot $photo.Name
    if (Test-Path -LiteralPath $target) { continue }
    $source = [System.Drawing.Image]::FromFile($photo.FullName)
    try {
        # $scale = [Math]::Min(1, $MaxWidth / $source.Width) # old: 整数重载可能把缩放比例取整为零。
        $scale = [Math]::Min(1.0, [double]$MaxWidth / $source.Width) # [FIX 2026.11.03] 使用浮点重载。
        $result = [System.Drawing.Bitmap]::new([int]($source.Width*$scale),[int]($source.Height*$scale))
        $graphics = [System.Drawing.Graphics]::FromImage($result)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source,0,0,$result.Width,$result.Height)
            $result.Save($target,$encoder,$parameters)
        } finally { $graphics.Dispose(); $result.Dispose() }
    } finally { $source.Dispose() }
}
$parameters.Dispose()
foreach ($size in @(192,512)) {
    $target = Join-Path $assetRoot ('icon-{0}.png' -f $size)
    if (Test-Path -LiteralPath $target) { continue }
    $bitmap = [System.Drawing.Bitmap]::new($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#e66539'))
        $graphics.ScaleTransform([single]($size/192),[single]($size/192))
        $bowl = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $bowl.AddBezier(43,94,46,125,66,143,96,143)
        $bowl.AddBezier(96,143,126,143,146,125,149,94)
        $bowl.CloseFigure()
        $graphics.FillPath([System.Drawing.Brushes]::White,$bowl)
        $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White,10)
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $graphics.DrawLine($pen,71,153,121,153)
        $graphics.DrawLine($pen,75,48,75,73)
        $graphics.DrawLine($pen,96,39,96,73)
        $graphics.DrawLine($pen,117,48,117,73)
        $bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
        $pen.Dispose(); $bowl.Dispose()
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
Write-Output '[OK] 网页图片与图标准备完成，已有副本保持不变。'
