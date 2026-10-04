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
  burns) are dropped.
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

Event times in `src/lib/missions.ts` come from NASA, ISRO and ESA mission
timelines and were checked against these files (closest approaches, record
distances and burns show in the vectors). Distances quoted for Parker are
from the Sun's surface, as NASA gives them; the files measure from its
centre.
