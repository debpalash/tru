"""Package verified binaries, corresponding source, licenses and public media."""
import hashlib, json, shutil, subprocess, zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
package = json.loads((root / 'package.json').read_text())
stem = f"{package['name']}-{package['version']}"
output = root / '.local' / 'release'
subprocess.run(['python3', 'scripts/verify-release.py'], cwd=root, check=True)
subprocess.run(['python3', 'scripts/package-source.py'], cwd=root, check=True)
shutil.copy2(root / 'LICENSE', output / 'LICENSE.txt')
notices = [root / 'THIRD_PARTY_NOTICES.md', root / '.local/licenses/THIRD_PARTY_LICENSES.txt',
           root / 'assets/brand/SourceSerif4-LICENSE.md', *sorted((root / 'licenses/native').glob('*.txt'))]
(output / 'THIRD_PARTY_LICENSES.txt').write_text('\n\n'.join(
    f"{'=' * 72}\n{p.name}\n{'=' * 72}\n{p.read_text()}" for p in notices))

media = output / f'{stem}-media.zip'
with zipfile.ZipFile(media, 'w', zipfile.ZIP_DEFLATED) as archive:
    for folder in ['assets/brand', 'docs/screenshots', 'docs/demos']:
        for p in sorted((root / folder).rglob('*')):
            if not p.is_file() or p.is_symlink(): continue
            entry = zipfile.ZipInfo(p.relative_to(root).as_posix(), (2026, 9, 30, 0, 0, 0))
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, p.read_bytes())

artifacts = [output / f'{stem}-{abi}.apk' for abi in ['universal', 'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']]
artifacts += [output / f'{stem}.aab', output / f'{stem}-source.zip', media,
              output / 'LICENSE.txt', output / 'THIRD_PARTY_LICENSES.txt', output / 'release-verification.json']
subprocess.run(['python3', 'scripts/audit-release.py', *map(str, artifacts)], cwd=root, check=True)
def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): checksum.update(block)
    return checksum.hexdigest()
(output / 'SHA256SUMS.txt').write_text(''.join(
    f'{digest(p)}  {p.name}\n' for p in sorted(artifacts)))
print(f'Packaged {len(artifacts)} artifacts plus SHA256SUMS.txt under .local/release/.')
