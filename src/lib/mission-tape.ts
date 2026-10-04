// The time tape in mission replay: the same sliding ruler as lib/orbit-tape.ts,
// but over the mission's own span, with a zoomable scale (`msPerPx`) and its
// events marked along the base line.

const HOUR = 3600000;
const DAY = 24 * HOUR;
// Tick spacings to choose from, smallest first.
const STEPS = [
  10 * 60000,
  30 * 60000,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  28 * DAY,
];
const pad = (value: number) => String(value).padStart(2, '0');

export type MissionTapeFrame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  min: number;
  max: number;
  msPerPx: number;
  font: string;
  color: string;
  events: readonly { time: number; label: string }[];
};

/** Labelled ticks at least this far apart (px). */
const LABEL_GAP = 64;

export function drawMissionTape(
  context: CanvasRenderingContext2D,
  frame: MissionTapeFrame,
) {
  const { width, height, dpr, time, min, max, msPerPx, font } = frame;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const center = width / 2;
  const x = (at: number) => center + (at - time) / msPerPx;
  const base = height - 9;
  const left = Math.max(0, x(min));
  const right = Math.min(width, x(max));

  // The mission's span, with the flown part lit.
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(223, 218, 245, 0.14)';
  context.beginPath();
  context.moveTo(left, base + 0.5);
  context.lineTo(right, base + 0.5);
  context.stroke();
  context.strokeStyle = frame.color;
  context.globalAlpha = 0.55;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, base + 0.5);
  context.lineTo(Math.min(center, right), base + 0.5);
  context.stroke();
  context.globalAlpha = 1;

  const label =
    STEPS.find((step) => step / msPerPx >= LABEL_GAP) ?? STEPS.at(-1)!;
  const minor = [...STEPS]
    .reverse()
    .find((step) => step < label && step / msPerPx >= 7 && label % step === 0);
  context.font = `500 9px ${font}`;
  context.textAlign = 'center';
  const ticks = (step: number, major: boolean) => {
    const first = Math.ceil((time - center * msPerPx) / step) * step;
    for (let at = first; x(at) <= width + 1; at += step) {
      if (at < min || at > max) continue;
      const date = new Date(at);
      const midnight = at % DAY === 0;
      const tick = Math.round(x(at)) + 0.5;
      context.strokeStyle = `rgba(223, 218, 245, ${major ? (midnight ? 0.62 : 0.42) : 0.16})`;
      context.beginPath();
      context.moveTo(tick, base);
      context.lineTo(tick, base - (major ? (midnight ? 13 : 9) : 4));
      context.stroke();
      if (!major) continue;
      context.fillStyle = `rgba(223, 218, 245, ${midnight ? 0.8 : 0.45})`;
      context.fillText(
        midnight
          ? `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
          : `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
        tick,
        base - 18,
      );
    }
  };
  if (minor) ticks(minor, false);
  ticks(label, true);

  // Events: a diamond on the base line; names where there is room, nearest
  // the cursor first.
  const placed: [number, number][] = [];
  const order = frame.events
    .map((event, index) => ({ ...event, index, at: x(event.time) }))
    .filter(({ at }) => at > -40 && at < width + 40)
    .sort((a, b) => Math.abs(a.at - center) - Math.abs(b.at - center));
  for (const event of order) {
    const done = event.time <= time;
    context.fillStyle = done
      ? 'rgba(255, 255, 255, 0.9)'
      : 'rgba(7, 8, 15, 0.9)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(event.at, base - 4);
    context.lineTo(event.at + 4, base);
    context.lineTo(event.at, base + 4);
    context.lineTo(event.at - 4, base);
    context.closePath();
    context.fill();
    context.stroke();
    const text = event.label;
    const span = context.measureText(text).width;
    const box: [number, number] = [
      event.at - span / 2 - 4,
      event.at + span / 2 + 4,
    ];
    if (placed.some(([a, b]) => box[0] < b && box[1] > a)) continue;
    placed.push(box);
    context.fillStyle = 'rgba(255, 224, 190, 0.9)';
    context.fillText(text, event.at, 9);
  }

  // The cursor stays put; the tape moves under it.
  const gradient = context.createLinearGradient(0, 2, 0, height - 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(1, 'rgba(200, 189, 255, 0.9)');
  context.shadowColor = 'rgba(200, 189, 255, 0.9)';
  context.shadowBlur = 8;
  context.strokeStyle = gradient;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(center, 14);
  context.lineTo(center, height - 3);
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = '#fff';
  context.beginPath();
  context.moveTo(center - 4, height - 1);
  context.lineTo(center + 4, height - 1);
  context.lineTo(center, height - 6);
  context.closePath();
  context.fill();
}
