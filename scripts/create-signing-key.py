"""Create a new private signing identity only when explicitly selected by the operator."""
import os, secrets, subprocess, sys
from pathlib import Path
if sys.argv[1:] != ['--new-key']:
    raise SystemExit('Usage: python3 scripts/create-signing-key.py --new-key. Do not run for an app that already has a production key.')
root = Path(__file__).resolve().parent.parent
folder = root/'.local'/'signing'
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
key = folder/'tru-release.jks'
config = folder/'signing.env'
if key.exists() or config.exists(): raise SystemExit('Signing identity already exists; refusing to replace it.')
os.umask(0o077)
password = secrets.token_urlsafe(36)
env = dict(os.environ, TRU_KEY_PASSWORD=password)
java = Path('/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home')
tool = str(java/'bin'/'keytool') if java.exists() else 'keytool'
subprocess.run([tool,'-genkeypair','-keystore',str(key),'-storetype','JKS','-storepass:env','TRU_KEY_PASSWORD','-keypass:env','TRU_KEY_PASSWORD','-alias','tru','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Tru'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
config.write_text('\n'.join(f'{k}={v}' for k,v in {'TRU_RELEASE_STORE_FILE':str(key),'TRU_RELEASE_STORE_PASSWORD':password,'TRU_RELEASE_KEY_ALIAS':'tru','TRU_RELEASE_KEY_PASSWORD':password}.items())+'\n')
key.chmod(0o600); config.chmod(0o600)
print('Private signing identity saved under .local/signing/. Back up both files privately before publishing; future updates require this key.')
