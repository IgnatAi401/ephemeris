# Land map

`countries-50m.json` is derived from the `world-atlas@2.0.2` TopoJSON dataset,
using Natural Earth's 1:50m Admin 0 boundaries (Natural Earth 4.1.0). It was
copied unchanged from the author's personal site, where
it was simplified; `provenance.json` records the original checksum and the
processing.

The orbit view paints it into an equirectangular land texture in a worker
(`src/lib/orbit-land.ts`). The site serves the file itself; no third-party
request is needed to draw Earth.

- Download: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
- Dataset and format: https://github.com/topojson/world-atlas
- Original map: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/
- Natural Earth terms (public domain): https://www.naturalearthdata.com/about/terms-of-use/
- Retrieved: 2026-09-09
