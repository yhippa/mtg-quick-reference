"""Generate simple original PWA icons using only Python's standard library."""
import struct
import zlib
from pathlib import Path

def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))

for size in (192, 512):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            u, v = x / size, y / size
            border = (.27 < u < .62 and .25 < v < .72 and not (.30 < u < .59 and .28 < v < .69))
            second = (.41 < u < .75 and .33 < v < .80 and not (.41 < u < .72 and .33 < v < .77) and not (u < .64 and v < .74))
            bolt = (.36 < u < .54 and .36 < v < .61 and abs(u - (.61 - .36*v)) < .025)
            rows.extend((198, 221, 160) if border or second or bolt else (23, 29, 27))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
