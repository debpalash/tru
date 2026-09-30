"""Build signed artifacts using a private identity; never pass passwords as command arguments."""
import json, os, shutil, subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
config=root/'.local'/'signing'/'signing.env'
env=dict(os.environ, EXPO_NO_DOTENV='1')
if config.exists():
    for line in config.read_text().splitlines():
        k, sep, v = line.partition('=')
        if sep and k.startswith('TRU_RELEASE_'): env.setdefault(k,v)
required=['TRU_RELEASE_STORE_FILE','TRU_RELEASE_STORE_PASSWORD','TRU_RELEASE_KEY_ALIAS','TRU_RELEASE_KEY_PASSWORD']
if any(not env.get(k) for k in required): raise SystemExit('Production signing is missing. Supply release signing variables or explicitly create a new identity with scripts/create-signing-key.py --new-key.')
for k in list(env):
    if k.startswith('EXPO_PUBLIC_') and any(part in k for part in ['KEY','TOKEN','SECRET']): del env[k]
java=Path('/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home')
if 'JAVA_HOME' not in env and java.exists(): env['JAVA_HOME']=str(java)
sdk=Path('/opt/homebrew/share/android-commandlinetools')
if 'ANDROID_HOME' not in env and sdk.exists(): env['ANDROID_HOME']=str(sdk)
subprocess.run(['bun','run','notices'],cwd=root,check=True)
notices=root/'android'/'app'/'src'/'main'/'assets'/'licenses'
notices.mkdir(parents=True,exist_ok=True)
for name in ['LICENSE','THIRD_PARTY_NOTICES.md']: shutil.copy2(root/name,notices/name)
shutil.copy2(root/'assets'/'brand'/'SourceSerif4-LICENSE.md',notices/'SourceSerif4-LICENSE.md')
shutil.copytree(root/'licenses'/'native',notices/'native',dirs_exist_ok=True)
for name in ['dependencies.json','THIRD_PARTY_LICENSES.txt']: shutil.copy2(root/'.local'/'licenses'/name,notices/name)
subprocess.run(['./android/gradlew','-p','android',':app:assembleRelease',':app:bundleRelease','-PtruSplitApks=true','--console=plain'],cwd=root,env=env,check=True)
package=json.loads((root/'package.json').read_text())
version=package['version']
output=root/'.local'/'release'; output.mkdir(parents=True,exist_ok=True)
artifacts = [(f'{abi}.apk', f'apk/release/app-{abi}-release.apk') for abi in ['universal','arm64-v8a','armeabi-v7a','x86','x86_64']]
artifacts.append(('aab','bundle/release/app-release.aab'))
for suffix,path in artifacts:
    target=output/f"{package['name']}-{version}-{suffix}" if suffix.endswith('.apk') else output/f"{package['name']}-{version}.{suffix}"
    shutil.copy2(root/'android'/'app'/'build'/'outputs'/path,target)
    subprocess.run(['python3','scripts/audit-release.py',str(target)],cwd=root,check=True)
subprocess.run(['python3','scripts/verify-release.py'],cwd=root,env=env,check=True)
print('Signed artifacts saved under .local/release/.')
