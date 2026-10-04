// UTC → TT for the Horizons requests that only accept TDB instants.
//
// TT − UTC = 32.184 s + ΔAT, where ΔAT = TAI − UTC changes only at leap
// seconds. TDB differs from TT by periodic terms under 2 ms, far below the
// page's needs, so TDB − UTC is taken as TT − UTC.
//
// ΔAT is not computable from first principles: the IERS announces each leap
// second about six months ahead in Bulletin C. The table below is therefore
// only trusted up to LEAP_TABLE_VALID_UNTIL; past that the fetch fails and
// asks for the table to be checked against the newest bulletin.

const TT_MINUS_TAI = 32184;
/** [UTC instant (ms) from which ΔAT applies, ΔAT in ms]. Older entries are
 * not needed: the data window never reaches back before 2017. */
const LEAP_SECONDS = [[Date.UTC(2017, 0, 1), 37000]];
/** Bulletin C 72 (Paris, 6 July 2026): no leap second at the end of December
 * 2026, so ΔAT = 37 s holds until the next possible step, the end of June
 * 2027. https://hpiers.obspm.fr/iers/bul/bulc/bulletinc.dat */
export const LEAP_TABLE_SOURCE = 'IERS Bulletin C 72 (2026-07-06)';
export const LEAP_TABLE_VALID_UNTIL = Date.UTC(2027, 6, 1);

/** TT − UTC in milliseconds at UTC instant `time` (Unix ms). */
export function ttMinusUtc(time) {
  if (time >= LEAP_TABLE_VALID_UNTIL) {
    throw new Error(
      `Leap-second table only checked until ${new Date(LEAP_TABLE_VALID_UNTIL).toISOString().slice(0, 10)} ` +
        `(${LEAP_TABLE_SOURCE}). Read the newest Bulletin C and update scripts/lib/time-scales.mjs.`,
    );
  }
  const entry = LEAP_SECONDS.findLast(([from]) => time >= from);
  if (!entry)
    throw new Error(
      `No leap-second entry before ${new Date(time).toISOString()}`,
    );
  return TT_MINUS_TAI + entry[1];
}
