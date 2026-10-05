# Mission replay trajectories

Written by `scripts/fetch-missions.mjs` (`pnpm missions:fetch`) and committed:
unlike `public/data/`, these past trajectories do not change.

- Source: NASA/JPL Horizons, https://ssd.jpl.nasa.gov/horizons/ — reconstructed
  spacecraft trajectories and the Moon's ephemeris, fetched once (2026-10-04)
  as geocentric state vectors. JPL publishes
  Horizons output for public use; credit "NASA/JPL Horizons".
- Processing: rotated from ICRF to the mean equator and equinox of date,
  thinned to the samples cubic Hermite interpolation needs to stay within
  about 0.5 km near Earth and the Moon; samples whose velocity disagrees with
  their neighbours' positions (a few badly fitted stretches around small
  burns) are dropped. Where Horizons passes from one orbit determination to
  the next the position can jump while the velocity does not (Chandrayaan-3's
  lander: 131 km on 20 July 2023, 67 km on 7 August, two of about 5 km); each
  such seam is split between its sides and ramped in over two hours either
  way, a few m/s on the velocity.
- Spacecraft (Horizons IDs): Artemis II Orion −1024, Artemis I Orion −1023,
  Chandrayaan-3 lander −158 and propulsion module −169, JWST −170,
  CAPSTONE −1176; the Moon 301.
- Interplanetary missions (heliocentric, ICRF, no precession): Voyager 2 −32,
  Voyager 1 −31, New Horizons −98, Cassini −82, Parker Solar Probe −96,
  Mars 2020 −168; bodies met: Venus 299, Earth 399, Mars 499, Jupiter 599,
  Saturn 699, Uranus 799, Neptune 899, Pluto 999, Arrokoth 2486958. Near a
  body the spacecraft is fetched relative to it and placed on the body's
  heliocentric path, because Horizons' heliocentric and planetocentric
  solutions for old spacecraft can disagree by thousands of km at a flyby.
  Velocities are kept to 0.1 m/s.
- Planets not met by a mission are placed with JPL's approximate mean
  elements (E. M. Standish, Keplerian Elements for Approximate Positions of
  the Major Planets, Table 1), in `src/lib/planets.ts`.

## Reconstructed missions

Sputnik 1, Vostok 1, Apollo 8, 11 and 13, Chang'e 4 with Queqiao, Chang'e 5
and Tianwen-1 have no public trajectory data. Their files are rebuilt by
`scripts/reconstruct-missions.mjs` (`pnpm missions:reconstruct [id …]`),
carry `reconstructed: true`, and are labelled as reconstructions in the app.

- Method: numerical integration (Dormand–Prince) under Earth with J2, the
  Moon and the Sun, whose positions come from JPL Horizons (Moon 301, Sun
  10); burns are impulsive at the middle of the real ones and solved so the
  path meets the published figures (orbits, closest approaches and their
  times, entry altitude and angle). Powered ascent and descent, rendezvous
  and atmospheric flight are smooth blends between the states either side.
  Tianwen-1 is patched two-body arcs (a Lambert arc about the Sun between
  hyperbolas at Earth and Mars, then Mars orbits), with Earth 399 and Mars
  499 from Horizons; its course corrections are not drawn.
- Apollo figures: R. W. Orloff, *Apollo by the Numbers: A Statistical
  Reference*, NASA SP-2000-4029 (https://history.nasa.gov/SP-4029/, a work
  of the US government): parking-orbit insertion states, burn times and
  orbits, entry and splashdown. The translunar coasts of Apollo 8 and 11
  start from the S-IVB trajectories in Horizons (−399080, −399110), run back
  to the end of the burn.
- Chang'e 4, Queqiao, Chang'e 5 and Tianwen-1: times and orbits from the
  China National Space Administration's announcements (https://www.cnsa.gov.cn)
  and the mission articles on Wikipedia. Where nothing is published (parking
  orbits, the landers' orbit changes, Queqiao's transfer to L2 and its halo
  orbit), the reconstruction is a sketch that keeps the published times.
- Sputnik 1 (215 × 939 km, 65.1°) and Vostok 1 (181 × 327 km, 64.95°):
  published orbits, launch, retrofire and landing times.
- Precision: positions to 0.1 km and velocities to 1 cm/s (1 km and 0.1 m/s
  for Tianwen-1); faithful to a few km in orbit and tens of km in transit
  where the published figures are complete, not a navigation solution.

Event times in `src/lib/missions.ts` come from NASA, ISRO and ESA mission
timelines and were checked against these files (closest approaches, record
distances and burns show in the vectors). Distances quoted for Parker are
from the Sun's surface, as NASA gives them; the files measure from its
centre.
