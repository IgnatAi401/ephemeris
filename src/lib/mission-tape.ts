// The time tape in mission replay: the same sliding ruler as lib/orbit-tape.ts,
// but over the mission's own span, with a zoomable scale (`msPerPx`) and its
// events marked along the base line.

const HOUR = 3600000;
const DAY = 24 * HOUR;
const MONTH = 30.44 * DAY;
// Tick spacings to choose from, smallest first: fixed spans up to a fortnight,
// then calendar months and years (a decades-long voyage needs both).
type Step = { span: number; months?: number };
const STEPS: Step[] = [
  ...[10 * 60000, 30 * 60000, HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR].map(
    (span) => ({ span }),
  ),
  ...[DAY, 2 * DAY, 7 * DAY, 14 * DAY].map((span) => ({ span })),
  ...[1, 3, 6, 12, 24, 60, 120].map((months) => ({
    span: months * MONTH,
    months,
  })),
];
/** Tick times of `step` from `from` to `to`. */
function* tickTimes(step: Step, from: number, to: number) {
  if (!step.months) {
    for (
      let at = Math.ceil(from / step.span) * step.span;
      at <= to;
      at += step.span
    )
      yield at;
    return;
  }
  const date = new Date(from);
  let index = date.getUTCFullYear() * 12 + date.getUTCMonth();
  index = Math.ceil(index / step.months) * step.months;
  for (;;) {
    const at = Date.UTC(Math.floor(index / 12), index % 12, 1);
    if (at > to) return;
    if (at >= from) yield at;
    index += step.months;
  }
}
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
    STEPS.find((step) => step.span / msPerPx >= LABEL_GAP) ?? STEPS.at(-1)!;
  // Minor ticks divide the labelled ones: months into months (or days),
  // fixed spans into fixed spans.
  const minor = [...STEPS]
    .reverse()
    .find(
      (step) =>
        step.span < label.span &&
        step.span / msPerPx >= 7 &&
        (label.months
          ? step.months
            ? label.months % step.months === 0
            : step.span === DAY
          : !step.months && label.span % step.span === 0),
    );
  context.font = `500 9px ${font}`;
  context.textAlign = 'center';
  const ticks = (step: Step, major: boolean) => {
    const from = Math.max(min, time - center * msPerPx);
    const to = Math.min(max, time + (width - center) * msPerPx);
    for (const at of tickTimes(step, from, to)) {
      const date = new Date(at);
      // Days, or years when the ticks are months apart, stand out.
      const strong = step.months ? date.getUTCMonth() === 0 : at % DAY === 0;
      const tick = Math.round(x(at)) + 0.5;
      context.strokeStyle = `rgba(223, 218, 245, ${major ? (strong ? 0.62 : 0.42) : 0.16})`;
      context.beginPath();
      context.moveTo(tick, base);
      context.lineTo(tick, base - (major ? (strong ? 13 : 9) : 4));
      context.stroke();
      if (!major) continue;
      context.fillStyle = `rgba(223, 218, 245, ${strong ? 0.8 : 0.45})`;
      const year = date.getUTCFullYear();
      context.fillText(
        step.months
          ? step.months >= 12
            ? String(year)
            : `${year}-${pad(date.getUTCMonth() + 1)}`
          : strong
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
