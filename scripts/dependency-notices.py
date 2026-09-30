"""Build distributable dependency metadata and license texts from the locked install."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
modules = root / 'node_modules'
if not modules.exists(): raise SystemExit('Run bun install --frozen-lockfile first.')
packages = []
for child in modules.iterdir():
    if child.name.startswith('@'):
        packages.extend(p for p in child.iterdir() if (p/'package.json').exists())
    elif (child/'package.json').exists(): packages.append(child)
records = []; texts = []
for path in sorted(packages):
    data = json.loads((path/'package.json').read_text())
    record = {key: data.get(key) for key in ['name','version','license']}
    records.append(record)
    files = [p for p in path.iterdir() if p.is_file() and p.name.lower().startswith(('license','licence','notice','copying'))]
    for p in files: texts.append(f"\n{'='*72}\n{record['name']} {record['version']} — {p.name}\n{'='*72}\n" + p.read_text(errors='replace'))
output = root / '.local' / 'licenses'; output.mkdir(parents=True, exist_ok=True)
(output/'dependencies.json').write_text(json.dumps(records,indent=2)+'\n')
(output/'THIRD_PARTY_LICENSES.txt').write_text('\n'.join(texts))
print(f'Wrote {len(records)} dependency records and {len(texts)} license texts to .local/licenses/. Include these notices with distributions.')
