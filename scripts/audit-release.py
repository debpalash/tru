"""Scan runtime source or exported artifacts without printing secret values."""
from pathlib import Path
import os, re, sys, zipfile
root = Path(__file__).resolve().parent.parent
secrets = []
private_files = [root / '.env', root / '.local' / 'signing' / 'signing.env']
for private_file in private_files:
    if not private_file.is_file(): continue
    for line in private_file.read_text().splitlines():
        if '=' in line and re.search(r'(API_KEY|TOKEN|PASSWORD)=', line):
            value = line.split('=', 1)[1].strip().strip('\"\x27')
            if len(value) >= 16: secrets.append(value.encode())
for token_file in (root / '.local').glob('*.token'):
    value = token_file.read_bytes().strip()
    if len(value) >= 16: secrets.append(value)
patterns = [
    rb'AIza[\w-]{35}', rb'sk-or-v1-[a-f0-9]{64}', rb'nvapi-[\w-]{30,}',
    rb'csk-[\w-]{30,}', rb'gsk_[\w-]{30,}',
    rb'sk-(?:proj-|svcacct-)[A-Za-z0-9_-]{40,}|(?<![A-Za-z0-9_-])sk-[A-Za-z0-9]{40,}',
    rb'gh[pousr]_[A-Za-z0-9]{36,}', rb'github_pat_[A-Za-z0-9_]{60,}',
    rb'AKIA[A-Z0-9]{16}', rb'xox[baprs]-[A-Za-z0-9-]{25,}',
    rb'AAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%_-]{60,180}',
    rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
]
failures = []
def private_name(name):
    p = Path(name)
    return any(part in {'.local', 'node_modules', '.expo', '__pycache__'} for part in p.parts) or (p.name.startswith('.env') and p.name != '.env.example') or p.name in {'signing.env', 'local.properties', '.dev.vars'} or p.suffix.lower() in {'.token', '.sqlite', '.jks', '.keystore', '.p12', '.p8', '.key', '.pem'} or '.sqlite-' in p.name
def inspect(label, data):
    if any(value in data for value in secrets) or any(re.search(p, data) for p in patterns): failures.append(label)
    if re.search(rb'/(?:Users|home)/[A-Za-z0-9_.-]+/(?:Desktop|Documents|\.codex|\.local)/', data): failures.append(label+' (private build path)')
paths = [Path(p) for p in sys.argv[1:]] or [root / 'app', root / 'src', root / 'assets']
for path in paths:
    candidates = path.rglob('*') if path.is_dir() else [path]
    for p in candidates:
        if not p.is_file(): continue
        if private_name(p.name): failures.append(str(p)); continue
        if p.suffix in ['.apk', '.aab', '.zip']:
            with zipfile.ZipFile(p) as archive:
                for name in archive.namelist():
                    if private_name(name): failures.append(f'{p}:{name}')
                    data = archive.read(name)
                    inspect(f'{p}:{name}', data)
                    if name.endswith('.dex') and re.search(rb'Lcom/google/(?:firebase|android/gms)/', data):
                        failures.append(f'{p}:{name} (Firebase/Play Services dependency)')
        else: inspect(str(p), p.read_bytes())
for p in (root / 'src').rglob('*.ts*'):
    if re.search(r'process\.env\.EXPO_PUBLIC_\w*(?:API_KEY|TOKEN|SECRET)', p.read_text()): failures.append(str(p)+' (public credential variable)')
if failures:
    print('Release audit failed (values redacted):\n' + '\n'.join(sorted(set(failures))))
    sys.exit(1)
print('Release credential audit passed.')
