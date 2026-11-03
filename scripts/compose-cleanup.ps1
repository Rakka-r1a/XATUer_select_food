# [FIX 2026.11.03] 人物由 imagegen 去除；这里只把人物区域的修补结果合回原图，保护其余招牌与菜单。
param(
    [Parameter(Mandatory=$true)][string]$ManifestPath,
    [Parameter(Mandatory=$true)][string]$MasksPath,
    [Parameter(Mandatory=$true)][string]$OutputDir
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (-not ('CleanupComposite' -as [type])) {
# old: 引用列表缺少新版 .NET 的 GDI+ 程序集。
# old: 新版 .NET 将底层图像接口进一步拆分到 Windows.Core。
Add-Type -ReferencedAssemblies 'System.Drawing.Common','System.Drawing.Primitives','System.Runtime.InteropServices','System.Private.Windows.GdiPlus','System.Private.Windows.Core' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
public static class CleanupComposite {
    public static void Save(string originalPath, string generatedPath, double[][] boxes, string output) {
        using (var source=Image.FromFile(originalPath))
        using (var generated=Image.FromFile(generatedPath)) {
            int w=Math.Min(960,source.Width), h=(int)Math.Round((double)source.Height*w/source.Width);
            using(var original=new Bitmap(w,h,PixelFormat.Format24bppRgb))
            using(var patch=new Bitmap(w,h,PixelFormat.Format24bppRgb)) {
                using(var g=Graphics.FromImage(original)){g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.DrawImage(source,0,0,w,h);}
                using(var g=Graphics.FromImage(patch)){g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.DrawImage(generated,0,0,w,h);}
                var bounds=new Rectangle(0,0,w,h);
                var a=original.LockBits(bounds,ImageLockMode.ReadWrite,PixelFormat.Format24bppRgb);
                var b=patch.LockBits(bounds,ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);
                try {
                    int length=a.Stride*h;
                    byte[] left=new byte[length], right=new byte[length];
                    Marshal.Copy(a.Scan0,left,0,length);Marshal.Copy(b.Scan0,right,0,length);
                    float[] alpha=new float[w*h];
                    foreach(var box in boxes){
                        int x0=Math.Max(0,(int)(box[0]*w)), y0=Math.Max(0,(int)(box[1]*h));
                        int x1=Math.Min(w,(int)Math.Ceiling((box[0]+box[2])*w)), y1=Math.Min(h,(int)Math.Ceiling((box[1]+box[3])*h));
                        float feather=7;
                        for(int y=y0;y<y1;y++)for(int x=x0;x<x1;x++){
                            float dx=x0==0?feather:x-x0+1, dy=y0==0?feather:y-y0+1;
                            if(x1<w)dx=Math.Min(dx,x1-x);if(y1<h)dy=Math.Min(dy,y1-y);
                            float opacity=Math.Min(1,Math.Min(dx,dy)/feather);
                            int p=y*w+x;alpha[p]=Math.Max(alpha[p],opacity);
                        }
                    }
                    double[] shift=new double[3];int count=0;
                    for(int y=0;y<h;y++)for(int x=0;x<w;x++){
                        float opacity=alpha[y*w+x];if(opacity<=0||opacity>.3)continue;
                        int p=y*a.Stride+x*3;for(int c=0;c<3;c++)shift[c]+=left[p+c]-right[p+c];count++;
                    }
                    if(count>0)for(int c=0;c<3;c++)shift[c]=Math.Max(-30,Math.Min(30,shift[c]/count));
                    for(int y=0;y<h;y++)for(int x=0;x<w;x++){
                        float opacity=alpha[y*w+x];if(opacity<=0)continue;
                        int p=y*a.Stride+x*3;
                        for(int c=0;c<3;c++){double value=Math.Max(0,Math.Min(255,right[p+c]+shift[c]));left[p+c]=(byte)Math.Round(left[p+c]*(1-opacity)+value*opacity);}
                    }
                    Marshal.Copy(left,0,a.Scan0,length);
                } finally {original.UnlockBits(a);patch.UnlockBits(b);}
                ImageCodecInfo codec=null;foreach(var candidate in ImageCodecInfo.GetImageEncoders())if(candidate.MimeType=="image/jpeg")codec=candidate;
                using(var options=new EncoderParameters(1)){options.Param[0]=new EncoderParameter(Encoder.Quality,88L);original.Save(output,codec,options);}
            }
        }
    }
}
'@
}
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json -AsHashtable
$masks = Get-Content -LiteralPath $MasksPath -Raw | ConvertFrom-Json -AsHashtable
[System.IO.Directory]::CreateDirectory($OutputDir) | Out-Null
foreach ($name in $manifest.Keys) {
    if (-not $masks.ContainsKey($name)) { continue }
    $source = Join-Path (Join-Path $root '图片') ($name + '.jpg')
    $target = Join-Path $OutputDir ($name + '.jpg')
    $regions = [double[][]]@($masks[$name] | ForEach-Object { ,([double[]]$_) })
    [CleanupComposite]::Save($source, $manifest[$name], $regions, $target)
    Write-Output ('[OK] ' + $name)
}
