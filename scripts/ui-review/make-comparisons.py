from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'output/ui-review';F=P/'fixes';O=P/'final';O.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
def pair(name,a,b,note):
 im=Image.new('RGB',(a.width+b.width+48,max(a.height,b.height)+100),'#edf1f5');d=ImageDraw.Draw(im);d.text((16,12),'Figma (browser capture)',font=font,fill='#152739');d.text((32+a.width,12),'Implementation',font=font,fill='#152739');im.paste(a,(16,40));im.paste(b,(32+a.width,40));d.text((16,im.height-42),note,font=font,fill='#42566a');im.save(O/(name+'.png'))
a=Image.open(F/'figma-339-7524.jpg').crop((244,160,570,885)).resize((360,800),Image.Resampling.LANCZOS).convert('RGB');b=Image.open(F/'final-map.png').crop((0,0,360,800)).convert('RGB');pair('compare-map',a,b,'Rescaled source. Different map/data; not a pixel-error metric.');Image.blend(a,b,.5).save(O/'overlay-map.png')
a=Image.open(F/'figma-572-25983.jpg').crop((240,160,574,885)).resize((360,783),Image.Resampling.LANCZOS).crop((0,0,360,700)).convert('RGB');b=Image.open(F/'final-participants.png').crop((0,0,360,700)).convert('RGB');pair('compare-participants',a,b,'Geometry checked in DOM/XML; names and images differ.');Image.blend(a,b,.5).save(O/'overlay-participants.png')
a=Image.open(F/'figma-525-19067.jpg').crop((739,708,1261,1252)).convert('RGB');r=json.loads((F/'final-probes.json').read_text())['geometry']['sos'];b=Image.open(F/'final-sos.png').crop((round(r['x']),round(r['y']),round(r['x']+r['width']),round(r['y']+r['height']))).convert('RGB');pair('compare-sos',a,b,'One consistent athlete in fixture. Source No.14/15 conflict retained in Figma.')
a=Image.open(F/'user-admin-dropdown.png').convert('RGB').resize((338,242),Image.Resampling.LANCZOS);b=Image.open(F/'admin-acceptance-normal.png').crop((20,228,220,388)).resize((300,240),Image.Resampling.LANCZOS);pair('compare-dropdown',a,b,'Reference fragment and implemented expanded group (different scales).')
(O/'README.md').write_text('''# Итоговые сравнения

- [Карта: пара](compare-map.png) · [наложение 50%](overlay-map.png)
- [Участники: пара](compare-participants.png) · [наложение 50%](overlay-participants.png)
- [Раскрывающаяся «Гонка»](compare-dropdown.png)
- [Подтверждение SOS](compare-sos.png)

Эталон — браузерные JPEG из актуальной Figma. Они масштабированы/обрезаны для сопоставления. Наложения служат иллюстрацией: это не pixel-diff с допуском 1 px. Динамические тексты, количество записей, фотоснимки и карта различаются; полная точность не подтверждена. Числа геометрии взяты из Figma XML и DOM, см. `../verification.json`.
''')
