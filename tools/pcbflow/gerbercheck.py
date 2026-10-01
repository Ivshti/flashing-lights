#!/usr/bin/env python3
"""Re-read generated Gerbers/drills with gerbonara (independent parser) and
render a preview: tools/pcbflow/gerbercheck.py <gerber-dir> <out.svg> [top|bottom]"""
import sys
from gerbonara import LayerStack

d, out = sys.argv[1], sys.argv[2]
side = sys.argv[3] if len(sys.argv) > 3 else "top"
st = LayerStack.open_dir(d) if hasattr(LayerStack, "open_dir") else LayerStack.from_directory(d)
for (s, use), layer in sorted(st.graphic_layers.items()):
    print(f"{s:6} {use:10} {layer.original_path.name if layer.original_path else '-':28} objects={len(layer.objects)}")
for dl in st.drill_layers:
    print(f"drill  {dl.original_path.name:39} holes={len(dl.objects)}")
print("outline:", st.outline.original_path.name if st.outline else None)
open(out, "w").write(str(st.to_pretty_svg(side=side)))
