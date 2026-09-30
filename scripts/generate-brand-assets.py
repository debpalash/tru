"""Render Tru's vector mark to Expo and Android assets. Requires librsvg and ImageMagick."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent.parent
assets = root/'assets'
res = root/'android/app/src/main/res'
def render(svg, output, size):
    subprocess.run(['rsvg-convert','-w',str(size),'-h',str(size),str(assets/svg),'-o',str(output)],check=True)
render('icon.svg',assets/'icon.png',1024)
render('icon-foreground.svg',assets/'icon-foreground.png',1024)
render('icon-foreground.svg',assets/'splash.png',512)
render('notification-icon.svg',assets/'notification-icon.png',96)
for name in ['wordmark','wordmark-light']:
    subprocess.run(['rsvg-convert','-w','1200',str(assets/'brand'/f'{name}.svg'),'-o',str(assets/'brand'/f'{name}.png')],check=True)
for name in ['readme-banner','feature-graphic']:
    subprocess.run(['rsvg-convert',str(assets/'brand'/f'{name}.svg'),'-o',str(assets/'brand'/f'{name}.png')],check=True)
for density, scale in [('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
    folder=res/f'mipmap-{density}'
    folder.mkdir(parents=True,exist_ok=True)
    # Use librsvg's transparent PNG output. ImageMagick's SVG delegate can
    # flatten a white foreground onto white before the background option applies.
    for name,png,size in [('ic_launcher','icon.png',48),('ic_launcher_foreground','icon-foreground.png',108)]:
        subprocess.run(['magick',str(assets/png),'-resize',f'{int(size*scale)}x{int(size*scale)}','-define','webp:lossless=true',str(folder/f'{name}.webp')],check=True)
    alpha = subprocess.check_output(['magick', 'identify', '-format', '%[fx:mean.a]', str(folder/'ic_launcher_foreground.webp')], text=True)
    if not 0 < float(alpha) < 1:
        raise SystemExit(f'Adaptive icon must contain both visible lettering and transparency: {density}')
    for prefix in ['drawable','drawable-night']:
        folder=res/f'{prefix}-{density}';folder.mkdir(parents=True,exist_ok=True)
        render('icon-foreground.svg',folder/'splashscreen_logo.png',int(288*scale))
    folder=res/f'drawable-{density}'
    render('notification-icon.svg',folder/'notification_icon.png',int(24*scale))
print('Updated Expo, launcher, splash and notification assets for Tru.')
