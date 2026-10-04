import { geoEquirectangular, geoPath } from 'd3-geo';
import { merge, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type LandTopology = Topology<{ countries: GeometryCollection }>;
export const LAND_WIDTH = 2048;
export const LAND_HEIGHT = 1024;

/** Land (R), coastlines and borders (G) and a soft continental shelf (B) in
 * an equirectangular texture, from the Natural Earth file in public/maps. Painting takes about a tenth of a second, so the page runs it in a
 * worker (lib/orbit-land.worker.ts) and keeps this only as a fallback. */
export function paintLand<Surface extends HTMLCanvasElement | OffscreenCanvas>(
  topology: LandTopology,
  canvas: Surface,
): Surface {
  canvas.width = LAND_WIDTH;
  canvas.height = LAND_HEIGHT;
  const context = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) return canvas;
  const path = geoPath(
    geoEquirectangular()
      .scale(LAND_WIDTH / (2 * Math.PI))
      .translate([LAND_WIDTH / 2, LAND_HEIGHT / 2]),
    context,
  );
  const countries = topology.objects.countries;
  const land = merge(topology, countries.geometries as never);
  context.fillStyle = '#000';
  context.fillRect(0, 0, LAND_WIDTH, LAND_HEIGHT);
  context.globalCompositeOperation = 'lighter';
  context.lineJoin = 'round';
  for (const [lineWidth, alpha] of [
    [22, 0.12],
    [13, 0.16],
    [7, 0.22],
  ]) {
    context.beginPath();
    path(land);
    context.strokeStyle = `rgba(0, 0, 255, ${alpha})`;
    context.lineWidth = lineWidth;
    context.stroke();
  }
  context.beginPath();
  path(land);
  context.fillStyle = 'rgb(255, 0, 255)';
  context.fill();
  context.beginPath();
  path(mesh(topology, countries));
  context.strokeStyle = 'rgba(0, 255, 0, 0.9)';
  context.lineWidth = 1.4;
  context.stroke();
  return canvas;
}
