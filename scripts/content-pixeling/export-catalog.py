"""Read-only export of shared preset identities; no prompts, keys or private presets."""
import json, sys, hashlib, base64
from pathlib import Path
library=Path(sys.argv[1])
target=Path(sys.argv[2])
rows=json.loads(library.read_text(encoding='utf-8'))['saved']
items=[]
for row in rows:
    ref=row.get('shared_reference',{})
    if ref.get('kind') not in ['community','pixeling'] or ref.get('retired'): continue
    output=row.get('binding',{}).get('style',{}).get('output',{})
    size=output.get('size','')
    parts=size.split('x')
    portrait=len(parts)==2 and all(p.isdigit() for p in parts) and int(parts[1])>int(parts[0])
    item=dict(id=row['saved_id'],name=row['name'],group=ref['kind'],version=ref['version'],format='short' if portrait else 'long',size=size,fps=str(output.get('fps','')),thumbnail=None)
    # Include only verified thumbnails, never raw private template data or local paths.
    relative=ref.get('thumbnail_path')
    if relative and not Path(relative).is_absolute() and '..' not in Path(relative).parts:
        for root in [library.parent.parent/'media',library.parent]:
            file=root/relative
            if file.is_file() and file.stat().st_size<100000:
                data=file.read_bytes()
                if hashlib.sha256(data).hexdigest()==ref.get('thumbnail_sha256'):
                    item['thumbnail']='data:image/jpeg;base64,'+base64.b64encode(data).decode()
                    break
    items.append(item)
items.sort(key=lambda x:(x['group']!='pixeling',x['name']))
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps({'source':'Pixeling Desktop','exportedAt':'2026-11-13','items':items},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'presets':len(items),'thumbnails':sum(bool(x['thumbnail']) for x in items)}))
