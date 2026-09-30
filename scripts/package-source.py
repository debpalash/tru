"""Create the exact distributable source tree without local state or build caches."""
import hashlib, json, subprocess, zipfile
from pathlib import Path
root = Path(__file__).resolve().parent.parent
package = json.loads((root/'package.json').read_text())
version = package['version']
name = package['name']
output = root/'.local'/'release'
output.mkdir(parents=True, exist_ok=True)
roots = ['app','src','assets','android','modules','server','scripts','tests','docs','relay-worker','patches','.github','licenses']
files = ['LICENSE','README.md','THIRD_PARTY_NOTICES.md','QUALITY.md','DESIGN.md','package.json','bun.lock','bunfig.toml','app.json','babel.config.js','metro.config.js','tsconfig.json','tsconfig.node.json','expo-env.d.ts','.gitignore','.env.example','Dockerfile','.dockerignore','compose.yaml']
excluded = {'build','.gradle','.cxx','.kotlin','node_modules','.git','.expo','.local','__pycache__'}
def allowed(p):
    parts = p.relative_to(root).parts
    return not any(part in excluded for part in parts) and p.name != 'local.properties' and not (p.name.startswith('.env') and p.name != '.env.example') and p.suffix.lower() not in {'.keystore','.jks','.p12','.p8','.key','.pem','.apk','.aab','.hbc','.token','.sqlite'} and not p.is_symlink()
paths = [root/f for f in files if (root/f).is_file()]
for folder in roots:
    paths.extend(p for p in (root/folder).rglob('*') if p.is_file() and allowed(p))
archive = output/f'{name}-{version}-source.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(set(paths)):
        entry = zipfile.ZipInfo(f'{name}-{version}/{p.relative_to(root).as_posix()}', (2026,9,30,0,0,0))
        entry.external_attr = (0o100755 if p.name in {'gradlew','with-llm-env.sh'} else 0o100644) << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(entry,p.read_bytes())
subprocess.run(['python3', str(root/'scripts/audit-release.py'), str(archive)], check=True)
print(f'Source bundle: {archive.relative_to(root)} ({len(set(paths))} files)')
print(f'SHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
