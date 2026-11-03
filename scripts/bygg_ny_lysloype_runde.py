"""Gjør «Ny Lysløype Hovden» til en runde fra stadion (startpunktet til Rørvikåsen).
Turrutebasen mangler koblingene mellom stadion og endene av lysløypa, så de legges som rette linjer [Bruker: løypa går i virkeligheten helt rundt til stadion].
Bruk: python3 -I scripts/bygg_ny_lysloype_runde.py   (kjør deretter hent_terreng.py --navn "Ny Lysløype Hovden")"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import hent_hoyde as hh
from pyproj import Transformer

FIL = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'trails.json')
t = json.load(open(FIL))
ny = next(x for x in t if x['navn'] == 'Ny Lysløype Hovden')
stadion = next(x for x in t if x['navn'] == 'Rørvikåsen')['punkter'][0]
p = ny['punkter']
if ny['type'] == 'retur':
    ut = next(i for i, q in enumerate(p) if q[3] >= p[-1][3] / 2)  # halvveis = ytterste punkt
    p = p[: ut + 1]
else:
    sys.exit('Ny Lysløype er allerede en runde (type %s)' % ny['type'])
til = Transformer.from_crs('EPSG:4326', 'EPSG:25832', always_xy=True)
fra = Transformer.from_crs('EPSG:25832', 'EPSG:4326', always_xy=True)
rute = [til.transform(stadion[0], stadion[1])] + [til.transform(q[0], q[1]) for q in p] + [til.transform(stadion[0], stadion[1])]
pr = hh.resample(rute, 50)
hs = hh.hoyder(pr)
dist = [0.0]
for a, b in zip(pr, pr[1:]):
    dist.append(dist[-1] + math.dist(a, b))
pun = []
for q, h, d, in zip(pr, hs, dist):
    lon, lat = fra.transform(*q)
    pun.append([round(lon, 5), round(lat, 5), round(h['z'], 1), round(d), int(h.get('terreng') == 'Skog')])
ny.update({'type': 'sloyfe', 'lengde_m': round(dist[-1]), 'punkter': pun, 'overlapp_pct': 0})
ny.pop('terreng', None)
json.dump(t, open(FIL, 'w'), ensure_ascii=False)
print('Ny Lysløype Hovden: sloyfe', round(dist[-1]), 'm,', len(pun), 'punkter, start/slutt', pun[0][:3], pun[-1][:3])
