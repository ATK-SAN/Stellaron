
import requests
r = requests.get('https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/', timeout=15)
for line in r.text.splitlines():
    if 'href' in line.lower():
        print(line[:120])
