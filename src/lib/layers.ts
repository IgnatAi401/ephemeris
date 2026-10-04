import { CONSTELLATIONS, type ConstellationKey } from '@/lib/orbits';

// The switches in the layer panel. Every satellite group has its own, except
// the three debris clouds, which share one; the visual layers follow.
export type LayerId =
  | Exclude<
      ConstellationKey,
      'debrisFy1c' | 'debrisCosmos2251' | 'debrisIridium33'
    >
  | 'debris'
  | 'trails'
  | 'receivers'
  | 'lights'
  | 'halo'
  | 'highlight'
  | 'bloom';

/** The switch that shows or hides each group, in CONSTELLATIONS order. */
export const GROUP_LAYER: LayerId[] = CONSTELLATIONS.map(({ key, kind }) =>
  kind === 'debris' ? 'debris' : (key as LayerId),
);

export const VISUAL_LAYERS = [
  { id: 'trails', en: 'Trails', zh: '轨迹拖尾' },
  { id: 'receivers', en: 'Ground links', zh: '地面站连线' },
  { id: 'lights', en: 'City lights', zh: '城市灯光' },
  { id: 'halo', en: 'Starlink glow', zh: '星链光晕' },
  { id: 'highlight', en: 'Highlight new launches', zh: '新发射高亮' },
  { id: 'bloom', en: 'Bloom', zh: '辉光' },
] as const satisfies readonly { id: LayerId; en: string; zh: string }[];

export type Layers = Record<LayerId, boolean>;

export function defaultLayers(bloom: boolean): Layers {
  const layers = {} as Layers;
  for (const id of GROUP_LAYER) layers[id] = true;
  for (const { id } of VISUAL_LAYERS) layers[id] = true;
  layers.bloom = bloom;
  return layers;
}
