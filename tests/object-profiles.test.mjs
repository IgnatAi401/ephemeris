import assert from 'node:assert/strict';
import test from 'node:test';
import { CONSTELLATIONS } from '../src/lib/orbits.ts';
import { SPACECRAFT } from '../src/lib/ephemeris.ts';
import {
  satelliteProfile,
  SPACECRAFT_PROFILES,
} from '../src/lib/object-profiles.ts';
import { readHash, writeHash } from '../src/lib/share.ts';

const entry = (key, name, norad = 999999, cospar = '2026-123A') => ({
  group: CONSTELLATIONS.findIndex((group) => group.key === key),
  name,
  norad,
  cospar,
});

test('a visiting ship, rocket body and deployed object do not inherit a station identity', () => {
  const ship = satelliteProfile(entry('stations', 'CREW DRAGON 13'));
  assert.match(ship.profile.mission.en, /crew transport/);
  assert.equal(
    ship.profile.launch,
    undefined,
    'a series date must not become this flight’s launch date',
  );
  const rocket = satelliteProfile(entry('recent', 'CZ-4B R/B'));
  assert.match(rocket.profile.mission.en, /Rocket body/);
  assert.equal(
    rocket.profile.affiliation,
    undefined,
    'a rocket cannot establish payload nationality',
  );
  const released = satelliteProfile(
    entry('stations', 'UNIDENTIFIED CUBESAT', 999998, '1998-067XS'),
  );
  assert.equal(released.scope, 'group');
  assert.equal(
    released.profile.launch,
    undefined,
    'an ISS designator is not this object’s launch date',
  );
});

test('fragment formation stays separate from launch and active constellation membership', () => {
  const fragment = satelliteProfile(entry('debrisIridium33', 'IRIDIUM 33 DEB'));
  assert.equal(fragment.profile.event.date, '2009-02-10');
  assert.equal(fragment.profile.launch, undefined);
  const other = satelliteProfile(entry('recent', 'STARLINK DEB'));
  assert.match(other.profile.mission.en, /Debris/);
  assert.doesNotMatch(other.profile.summary.en, /internet constellation/);
});

test('an individual identity overrides the catalogue grouping and all backgrounds are bilingual', () => {
  const station = satelliteProfile(
    entry('stations', 'ISS (ZARYA)', 25544, '1998-067A'),
  );
  assert.equal(station.scope, 'object');
  assert.equal(station.profile.launch, '1998-11-20');
  for (const group of CONSTELLATIONS) {
    const { profile } = satelliteProfile(
      entry(group.key, 'UNIDENTIFIED OBJECT'),
    );
    assert.ok(profile.summary.en && profile.summary.zh);
    assert.ok(profile.sources.length);
  }
  for (const item of SPACECRAFT) {
    const profile = SPACECRAFT_PROFILES[item.key];
    assert.ok(profile.summary.en && profile.summary.zh);
    assert.match(profile.launch, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('a spacecraft share round-trips and invalid keys do not create a selection', () => {
  const hash = writeHash({
    time: Date.UTC(2026, 9, 5),
    camera: { azimuth: 0.8, elevation: 0.4, zoom: 245 },
    focus: 'deep',
    spacecraft: 'jwst',
    norad: 25544,
    layers: {},
    defaults: {},
  });
  const shared = readHash(hash, []);
  assert.equal(shared.spacecraft, 'jwst');
  assert.equal(shared.norad, undefined);
  assert.equal(readHash('#sc=unknown', []).spacecraft, undefined);
  assert.equal(readHash('#sel=25544', []).norad, 25544);
});

test('verified batch dates use UTC and do not spread to other payloads or fragments', () => {
  const iridium = satelliteProfile(
    entry('iridium', 'IRIDIUM 135', 43070, '2017-083A'),
  );
  assert.equal(iridium.profile.launch, '2017-12-23');
  assert.equal(
    satelliteProfile(entry('orbcomm', 'ORBCOMM FM115', 41182, '2015-081A'))
      .profile.launch,
    '2015-12-22',
  );
  assert.equal(
    satelliteProfile(entry('recent', 'OTHER PAYLOAD', 999998, '2017-083Z'))
      .profile.launch,
    undefined,
  );
  assert.equal(
    satelliteProfile(entry('iridium', 'IRIDIUM DEB', 999997, '2017-083Z'))
      .profile.launch,
    undefined,
  );
  assert.equal(
    satelliteProfile(entry('iridium', 'UNKNOWN', 999996, 'bad-designator'))
      .profile.launch,
    undefined,
  );
});
