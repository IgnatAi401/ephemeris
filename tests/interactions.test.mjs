import assert from 'node:assert/strict';
import test from 'node:test';
import * as satellite from 'satellite.js';
import {
  basis,
  makeCamera,
  project,
  reframeCamera,
} from '../src/lib/scene-camera.ts';
import { predictPasses, predictPassesAsync } from '../src/lib/passes.ts';

const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const world = (v, axes) =>
  [0, 1, 2].map((axis) =>
    v.reduce((sum, value, i) => sum + value * axes[i][axis], 0),
  );
const close = (a, b, tolerance = 1e-8) =>
  a.forEach((value, axis) => assert.ok(Math.abs(value - b[axis]) < tolerance));

test('reference-frame handover preserves the entire camera and projected points', () => {
  for (const zoom of [0.3, 72, 4e6]) {
    for (const elevation of [-1.39, 0.4, 1.39]) {
      const camera = makeCamera(
        1280,
        720,
        zoom,
        basis(elevation, 2.4, 0.65),
        [7, -3, 9],
      );
      const rotated = basis(-0.6, -1.2, -0.4);
      const axes = [rotated.toward, rotated.right, rotated.up];
      const pose = reframeCamera(camera, axes);
      const local = basis(pose.elevation, pose.azimuth, pose.roll);
      const orientation = Object.fromEntries(
        Object.entries(local).map(([key, value]) => [key, world(value, axes)]),
      );
      const next = makeCamera(
        1280,
        720,
        pose.zoom,
        orientation,
        world(pose.target, axes),
      );
      close(camera.position, next.position, zoom * 1e-12 + 1e-8);
      close(camera.right, next.right);
      close(camera.up, next.up);
      close(camera.toward, next.toward);
      for (const point of [
        [0, 0, 0],
        [5, 2, 3],
        [-20, 8, -2],
      ]) {
        const before = project(camera, point);
        const after = project(next, point);
        if (before.every(Number.isFinite))
          close(before, after, zoom * 1e-12 + 1e-7);
        else assert.equal(Number.isNaN(before[0]), Number.isNaN(after[0]));
      }
      // The faster whole-path fitting calculation agrees with the full
      // local → world → local round trip, including scaled rotating frames.
      for (const scale of [0.9, 1, 1.1]) {
        const origin = [9, -7, 2];
        const point = [4, 2, -1];
        const full = world(
          point.map((value) => value / scale),
          axes,
        ).map((value, axis) => value + origin[axis]);
        close(
          axes.map((axis) => dot(axis, full)),
          point.map((value, axis) => value / scale + dot(axes[axis], origin)),
        );
      }
    }
  }
});

// A deterministic orbital fixture; no fetched files, date or network needed.
const from = Date.UTC(2026, 9, 5);
const model = () => {
  const satrec = satellite.json2satrec({
    OBJECT_NAME: 'Forecast regression fixture',
    OBJECT_ID: '1998-067A',
    EPOCH: '2026-10-05T00:00:00.000Z',
    MEAN_MOTION: 15.49,
    ECCENTRICITY: 0.0005,
    INCLINATION: 51.64,
    RA_OF_ASC_NODE: 40,
    ARG_OF_PERICENTER: 60,
    MEAN_ANOMALY: 30,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: 25544,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: 0.0001,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  });
  return {
    lib: satellite,
    entry: { name: 'Forecast regression fixture', norad: 25544 },
    state(time) {
      const result = satellite.propagate(satrec, new Date(time));
      if (!result) return null;
      return {
        position: Object.values(result.position),
        velocity: Object.values(result.velocity),
      };
    },
  };
};

test('forecast yields to input without changing any visibility boundary or path sample', async () => {
  const observer = { latitude: 31.23, longitude: 121.47, label: 'Shanghai' };
  const expected = predictPasses(model(), observer, from, 5);
  assert.ok(expected.length > 0);
  let inputRan = false;
  const input = setTimeout(() => {
    inputRan = true;
  }, 0);
  const actual = await predictPassesAsync(model(), observer, from, 5);
  clearTimeout(input);
  assert.ok(inputRan, 'input should be handled before the forecast finishes');
  assert.deepEqual(actual, expected);
});

test('a replaced forecast stops before scanning the rest of its range', async () => {
  const precise = model();
  const state = precise.state.bind(precise);
  let samples = 0;
  let cancelled = false;
  precise.state = (time) => {
    samples++;
    if (samples === 300) cancelled = true;
    return state(time);
  };
  assert.equal(
    await predictPassesAsync(
      precise,
      { latitude: 0, longitude: 0 },
      from,
      5,
      () => cancelled,
    ),
    null,
  );
  assert.ok(samples >= 300 && samples < 600);
});
