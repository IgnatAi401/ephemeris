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

Event times in `src/lib/missions.ts` come from NASA, ISRO and ESA mission
timelines and were checked against these files (closest approaches, record
distances and burns show in the vectors).
