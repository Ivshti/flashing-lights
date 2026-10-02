#!/usr/bin/env python3
"""Re-read generated Gerbers/drills with gerbonara (independent parser) and
render a preview: tools/pcbflow/gerbercheck.py <gerber-dir> <out.svg> [top|bottom]"""
import re, shutil, sys, tempfile
from pathlib import Path
from gerbonara import LayerStack

d, out = sys.argv[1], sys.argv[2]
# gerbonara has no G85 canned slots: copy the set and rewrite slots as routed
# moves (G00 / M15 / G01 / M16) so they still get parsed and counted
tmp = Path(tempfile.mkdtemp())
for f in Path(d).iterdir():
    t = f.read_text()
    if f.suffix.upper() == ".DRL":
        t = re.sub(r"^(X[-\d.]+Y[-\d.]+)G85(X[-\d.]+Y[-\d.]+)$", r"G00\1\nM15\nG01\2\nM16\nG05", t, flags=re.M)
    (tmp / f.name).write_text(t)
d = str(tmp)
side = sys.argv[3] if len(sys.argv) > 3 else "top"
st = LayerStack.open_dir(d) if hasattr(LayerStack, "open_dir") else LayerStack.from_directory(d)
for (s, use), layer in sorted(st.graphic_layers.items()):
    print(f"{s:6} {use:10} {layer.original_path.name if layer.original_path else '-':28} objects={len(layer.objects)}")
for dl in st.drill_layers:
    print(f"drill  {dl.original_path.name:39} holes={len(dl.objects)}")
if st.outline:
    print("outline:", st.outline.original_path.name)
else:  # the guesser often misses Protel .GKO; parse it directly
    from gerbonara import GerberFile
    for f in tmp.glob("*.GKO"):
        g = GerberFile.open(f)
        (x0, y0), (x1, y1) = g.bounding_box()
        print(f"outline: {f.name} objects={len(g.objects)} size={x1 - x0:.2f} x {y1 - y0:.2f} mm")
open(out, "w").write(str(st.to_pretty_svg(side=side)))
shutil.rmtree(tmp)
