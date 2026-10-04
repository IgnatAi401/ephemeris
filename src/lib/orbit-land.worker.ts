// Paints the orbit view's land texture off the main thread, so building the
// scene never stalls the page.
import { paintLand, type LandTopology } from './orbit-land';

self.onmessage = async (event: MessageEvent<string>) => {
  try {
    const response = await fetch(event.data);
    if (!response.ok) throw new Error('Map unavailable');
    const topology = (await response.json()) as LandTopology;
    const bitmap = paintLand(
      topology,
      new OffscreenCanvas(1, 1),
    ).transferToImageBitmap();
    self.postMessage(bitmap, { transfer: [bitmap] });
  } catch {
    self.postMessage(null);
  }
};
