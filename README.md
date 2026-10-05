# Orbit · Live Satellite Tracker

English · [中文](README.zh-CN.md)

**[orbit.ignat.ai](https://orbit.ignat.ai)** — see where thousands of satellites around Earth are right now, in your browser.

![Orbit](public/poster.webp)

- **Live sky**: Starlink, the GNSS constellations (GPS / BeiDou / Galileo / GLONASS), Iridium and more, lit by the real Sun and Moon. Zoom out to cislunar space and the spacecraft at Sun–Earth L1/L2.
- **Tools**: search satellites by name or NORAD ID, see a precise orbit (SGP4), and predict visible passes over your location. Your location is computed in the browser and never uploaded.
- **Learn**: interactive guides to seven common orbit types and the six orbital elements.
- **Mission replays**: Apollo, Artemis, Chang'e, Voyager, Cassini, Tianwen-1 and more, replayed along their real (or reconstructed) trajectories.

A static site built with React, [ogl](https://github.com/oframe/ogl) (WebGL 2) and [satellite.js](https://github.com/shashwatak/satellite-js), hosted on GitHub Pages. GitHub Actions refreshes the ephemerides twice a day.

## Run locally

Requires Node.js 24 (see `.node-version`) and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm data:fetch   # fetch the latest ephemerides into public/data/
pnpm dev          # open http://127.0.0.1:3001/
```

## Data and assets

- Satellite elements: [CelesTrak](https://celestrak.org)
- Spacecraft and mission ephemerides: [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
- Land boundaries: [Natural Earth](https://www.naturalearthdata.com) (via [world-atlas](https://github.com/topojson/world-atlas))
- Night lights: [NASA Earth Observatory · Black Marble 2016](https://earthobservatory.nasa.gov/features/NightLights)

Sources and processing for each asset are described in the README files under `public/`. Missions marked "reconstructed" are illustrative trajectories derived from published figures, not measured data.
