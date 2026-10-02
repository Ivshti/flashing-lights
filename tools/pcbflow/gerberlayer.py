#!/usr/bin/env python3
"""Render one Gerber layer to SVG for a visual check (e.g. the inner plane):
tools/pcbflow/gerberlayer.py <file.gbr> <out.svg>"""
import sys
from gerbonara import GerberFile

g = GerberFile.open(sys.argv[1])
open(sys.argv[2], "w").write(str(g.to_svg(fg="#d4a017", bg="#101010")))
print(f"{sys.argv[1]}: {len(g.objects)} objects -> {sys.argv[2]}")
