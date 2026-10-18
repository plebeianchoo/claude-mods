"""Uploads a PNG to the outer terminal through tmux passthrough, as a kitty
graphics virtual placement for unicode placeholders already on screen.

tmux_upload.py PNG TTY IMAGE_ID COLUMNS ROWS

Claude Code sends its Image uploads unwrapped, which tmux drops; peek re-sends
the same picture under the id Claude Code gave it, written to its own pane.
"""

import base64
import sys


def wrap(seq: str) -> str:
    return "\x1bPtmux;" + seq.replace("\x1b", "\x1b\x1b") + "\x1b\\"


def main() -> None:
    png, tty, image_id, cols, rows = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    b64 = base64.standard_b64encode(open(png, "rb").read()).decode()
    chunks = [b64[i : i + 4096] for i in range(0, len(b64), 4096)] or [""]
    out = []
    for n, chunk in enumerate(chunks):
        more = 1 if n < len(chunks) - 1 else 0
        head = f"a=T,U=1,q=2,f=100,i={image_id},c={cols},r={rows},m={more}" if n == 0 else f"m={more}"
        out.append(wrap(f"\x1b_G{head};{chunk}\x1b\\"))
    with open(tty, "w") as f:
        f.write("".join(out))


main()
