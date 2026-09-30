from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
root=Path(__file__).resolve().parent.parent
font=TTFont(root/'assets/brand/SourceSerif4-Black.otf')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap()
def word(text):
 x=0; paths=[]; bounds=[]
 for letter in text:
  glyph=glyphs[cmap[ord(letter)]]; pen=SVGPathPen(glyphs); bound=BoundsPen(glyphs)
  glyph.draw(pen); glyph.draw(bound)
  paths.append(f'<path transform="translate({x} 0)" d="{pen.getCommands()}"/>')
  if bound.bounds:
   a,b,c,d=bound.bounds; bounds.append((a+x,b,c+x,d))
  x+=glyph.width
 return ''.join(paths),(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
paths,(x0,y0,x1,y1)=word('Tru'); w=x1-x0; h=y1-y0
mark=f'<g transform="translate({-x0} {y1}) scale(1 -1)">{paths}</g>'
def svg(body,view,title): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"><title>{title}</title>{body}</svg>\n'
for color,name in [('#171717','wordmark'),('#ffffff','wordmark-light')]:
 (root/f'assets/brand/{name}.svg').write_text(svg(f'<g fill="{color}">{mark}</g>',f'0 0 {w} {h}','Tru editorial wordmark'))
scale=334/w; left=(512-334)/2; top=(512-h*scale)/2
iconmark=f'<g fill="#ffffff" transform="translate({left} {top}) scale({scale})">{mark}</g>'
(root/'assets/icon.svg').write_text(svg('<rect width="512" height="512" rx="112" fill="#171717"/>'+iconmark,'0 0 512 512','Tru'))
(root/'assets/icon-foreground.svg').write_text(svg(iconmark,'0 0 512 512','Tru'))
# A compact T masthead letter stays legible in Android’s one-color status bar.
p,b=word('T'); a,bb,c,d=b; s=46/(d-bb)
(root/'assets/notification-icon.svg').write_text(svg(f'<g fill="#fff" transform="translate({(64-(c-a)*s)/2-a*s} {9+d*s}) scale({s} {-s})">{p}</g>','0 0 64 64','Tru notification'))
hero=f'<rect width="1280" height="400" fill="#fff"/><path d="M56 344H1224" stroke="#dedede"/><g fill="#171717" transform="translate(56 80) scale({310/w})">{mark}</g><g font-family="Arial,Helvetica,sans-serif" fill="#171717"><text x="450" y="145" font-size="46" font-weight="700">Find the facts.</text><text x="450" y="200" font-size="46" font-weight="700">Keep your privacy.</text><text x="450" y="258" font-size="21" fill="#606060">Independent news. Source-backed AI. No subscription.</text><text x="56" y="379" font-size="15" fill="#606060">FREE &amp; OPEN SOURCE</text><text x="1224" y="379" text-anchor="end" font-size="15" fill="#606060">NO ADS · NO TRU TELEMETRY</text></g>'
(root/'assets/brand/readme-banner.svg').write_text(svg(hero,'0 0 1280 400','Tru — Find the facts. Keep your privacy.'))
feature=f'<rect width="1024" height="500" fill="#171717"/><g fill="#fff" transform="translate({(1024-330)/2} 86) scale({330/w})">{mark}</g><g font-family="Arial,Helvetica,sans-serif" fill="#fff" text-anchor="middle"><text x="512" y="334" font-size="34" font-weight="700">Find the facts. Keep your privacy.</text><text x="512" y="390" font-size="22" fill="#bcbcbc">Free. Open source. No subscription.</text></g>'
(root/'assets/brand/feature-graphic.svg').write_text(svg(feature,'0 0 1024 500','Tru private news reader'))
print('Editorial Tru wordmark generated from Source Serif 4 Black (SIL OFL).')
