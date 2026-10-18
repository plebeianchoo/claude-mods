"""Converts an image to a PNG small enough to send to the terminal.

topng.py SRC OUT MAX_PX MAX_BYTES -> prints "WIDTH HEIGHT" of the PNG written to OUT.
The first frame of an animation, EXIF rotation applied, longest side at most
MAX_PX, file at most MAX_BYTES (shrunk by a quarter until it fits).
"""

import io
import os
import sys

from PIL import Image, ImageOps


def main() -> None:
    src, out, max_px, max_bytes = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    im = Image.open(src)
    im.seek(0)
    im = ImageOps.exif_transpose(im)
    has_alpha = "A" in im.getbands() or "transparency" in im.info
    im = im.convert("RGBA" if has_alpha else "RGB")
    side = max_px
    while True:
        frame = im.copy()
        frame.thumbnail((side, side))
        buf = io.BytesIO()
        frame.save(buf, "PNG", compress_level=6)
        if buf.tell() <= max_bytes or side <= 64:
            break
        side = int(side * 0.75)
    tmp = f"{out}.{os.getpid()}.tmp"
    with open(tmp, "wb") as f:
        f.write(buf.getvalue())
    os.replace(tmp, out)
    print(frame.width, frame.height)


main()
