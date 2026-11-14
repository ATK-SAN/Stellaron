import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://polarwindow.ahbab.tech/assets/index-BJKCp_Nb.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        js = r.read().decode('utf-8', errors='ignore')
        print('JS Bundle size:', len(js))
        terms = ['earth', 'sun', 'horizon', 'spice', 'libration', 'polar', 'shadow', 'azimuth', 'elevation']
        for t in terms:
            matches = [m.start() for m in re.finditer(t, js, re.I)]
            print(f'Term "{t}": {len(matches)} matches')
except Exception as e:
    print('Error:', e)
