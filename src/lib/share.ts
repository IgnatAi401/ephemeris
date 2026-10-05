// Shareable state in the URL hash:
//   #t=2026-10-04T08:30:00Z&cam=62.0,22.0,3.70&f=moon&sel=25544&layers=-debris,+bloom
// t: the simulation instant; cam: camera azimuth and elevation (degrees) and
// zoom; f: the scale preset; sel: the selected satellite's NORAD number;
// sc: a selected deep-space or lunar spacecraft key;
// layers: switches that differ from the defaults; m and fr: a mission replay
// (lib/missions.ts) and its reference frame. Every field is optional, and
// anything unreadable is ignored.
import type { LayerId, Layers } from '@/lib/layers';
import { spacecraftByKey, type SpacecraftKey } from './ephemeris.ts';

export type Shared = {
  time?: number;
  camera?: { azimuth: number; elevation: number; zoom: number };
  focus?: string;
  norad?: number;
  spacecraft?: SpacecraftKey;
  layers?: Partial<Layers>;
  mission?: string;
  frame?: string;
};

const DEG = Math.PI / 180;

export function readHash(hash: string, known: readonly LayerId[]): Shared {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const shared: Shared = {};
  const time = Date.parse(params.get('t') ?? '');
  if (Number.isFinite(time)) shared.time = time;
  const camera = (params.get('cam') ?? '').split(',').map(Number);
  if (camera.length === 3 && camera.every(Number.isFinite) && camera[2] > 0)
    shared.camera = {
      azimuth: camera[0] * DEG,
      elevation: camera[1] * DEG,
      zoom: camera[2],
    };
  const focus = params.get('f');
  if (focus) shared.focus = focus;
  const norad = Number(params.get('sel'));
  if (Number.isInteger(norad) && norad > 0) shared.norad = norad;
  const spacecraft = spacecraftByKey(params.get('sc') ?? '');
  if (spacecraft) shared.spacecraft = spacecraft.key;
  const layers: Partial<Layers> = {};
  for (const item of (params.get('layers') ?? '').split(',')) {
    const id = item.slice(1) as LayerId;
    if ((item[0] === '+' || item[0] === '-') && known.includes(id))
      layers[id] = item[0] === '+';
  }
  if (Object.keys(layers).length) shared.layers = layers;
  const mission = params.get('m');
  if (mission) shared.mission = mission;
  const frame = params.get('fr');
  if (frame) shared.frame = frame;
  return shared;
}

export function writeHash(state: {
  time: number;
  camera: { azimuth: number; elevation: number; zoom: number };
  focus: string;
  norad: number | null;
  spacecraft?: SpacecraftKey | null;
  layers: Layers;
  defaults: Layers;
  mission?: { id: string; frame: string } | null;
}) {
  const azimuth = ((((state.camera.azimuth / DEG) % 360) + 540) % 360) - 180;
  const parts = [
    `t=${new Date(Math.round(state.time / 1000) * 1000).toISOString().replace('.000Z', 'Z')}`,
    `cam=${azimuth.toFixed(1)},${(state.camera.elevation / DEG).toFixed(1)},${state.camera.zoom.toPrecision(3)}`,
  ];
  if (state.focus !== 'overview') parts.push(`f=${state.focus}`);
  if (state.spacecraft) parts.push(`sc=${state.spacecraft}`);
  else if (state.norad) parts.push(`sel=${state.norad}`);
  const changed = (Object.keys(state.layers) as LayerId[])
    .filter((id) => state.layers[id] !== state.defaults[id])
    .map((id) => `${state.layers[id] ? '+' : '-'}${id}`);
  if (changed.length) parts.push(`layers=${changed.join(',')}`);
  if (state.mission)
    parts.push(`m=${state.mission.id}`, `fr=${state.mission.frame}`);
  return `#${parts.join('&')}`;
}
