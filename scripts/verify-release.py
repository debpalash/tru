"""Verify installable APKs, bundle signature and supported architectures."""
import hashlib, json, os, re, subprocess, zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
package = json.loads((root / 'package.json').read_text())
folder = root / '.local' / 'release'
env = dict(os.environ)
config = root / '.local' / 'signing' / 'signing.env'
if config.exists():
    for line in config.read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and key.startswith('TRU_RELEASE_'): env.setdefault(key, value)
java = Path(env.get('JAVA_HOME', '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'))
env['JAVA_HOME'] = str(java)
sdk = Path(env.get('ANDROID_HOME', '/opt/homebrew/share/android-commandlinetools'))
buildtools = sdk / 'build-tools' / '36.0.0'
abis = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']
expected = {'universal': set(abis), **{abi: {abi} for abi in abis}}
signers = set()
results = []
for suffix, architectures in expected.items():
    artifact = folder / f"{package['name']}-{package['version']}-{suffix}.apk"
    verification = subprocess.run([str(buildtools / 'apksigner'), 'verify', '--verbose', '--print-certs', str(artifact)], env=env, capture_output=True, text=True, check=True).stdout
    signer = re.search(r'Signer #1 certificate SHA-256 digest: (\w+)', verification)[1]
    assert 'Signer #1 certificate DN: CN=Tru\n' in verification, 'Unexpected release identity'
    signers.add(signer)
    with zipfile.ZipFile(artifact) as archive:
        native = {name.split('/')[1] for name in archive.namelist() if name.startswith('lib/') and name.endswith('.so')}
        assert native == architectures, f'Wrong native architectures: {artifact.name}'
    badging = subprocess.run([str(buildtools / 'aapt2'), 'dump', 'badging', str(artifact)], capture_output=True, text=True, check=True).stdout
    assert "name='com.tru.news'" in badging and "application-label:'Tru'" in badging
    assert 'application-debuggable' not in badging
    assert "minSdkVersion:'24'" in badging and "targetSdkVersion:'36'" in badging
    results.append({'file': artifact.name, 'architectures': sorted(native), 'signature': 'valid', 'debuggable': False})
assert len(signers) == 1, 'APK signatures must match for updates'
signer = signers.pop()
if env.get('TRU_RELEASE_STORE_FILE'):
    certificate = subprocess.run([str(java / 'bin' / 'keytool'), '-exportcert', '-keystore', env['TRU_RELEASE_STORE_FILE'], '-alias', env['TRU_RELEASE_KEY_ALIAS'], '-storepass:env', 'TRU_RELEASE_STORE_PASSWORD'], env=env, capture_output=True, check=True).stdout
    assert hashlib.sha256(certificate).hexdigest() == signer, 'APK does not use the selected production key'
bundle = folder / f"{package['name']}-{package['version']}.aab"
with zipfile.ZipFile(bundle) as archive:
    assert {name.split('/')[2] for name in archive.namelist() if name.startswith('base/lib/') and name.endswith('.so')} == set(abis)
verification = subprocess.run([str(java / 'bin' / 'jarsigner'), '-verify', str(bundle)], env=env, capture_output=True, text=True, check=True).stdout
assert 'jar verified' in verification
report = {'version': package['version'], 'applicationId': 'com.tru.news', 'minSdk': 24, 'targetSdk': 36, 'certificateSha256': signer, 'apks': results, 'bundleSignature': 'valid'}
(folder / 'release-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print('All five APK signatures, architectures and production identity verified; AAB signature verified.')
