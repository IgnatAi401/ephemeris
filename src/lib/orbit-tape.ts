// The time tape under the orbit map: a ruler of UTC hours that slides under
// a fixed centre cursor. Drawn on a 2D canvas each frame the map paints.

export const TAPE_PX_PER_HOUR = 9;
const HOUR = 3600000;
const pad = (value: number) => String(value).padStart(2, '0');

export type TapeFrame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  now: number;
  min: number;
  max: number;
  font: string;
  nowLabel: string;
};

export function drawTape(context: CanvasRenderingContext2D, frame: TapeFrame) {
  const { width, height, dpr, time, now, min, max, font } = frame;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const center = width / 2;
  const scale = TAPE_PX_PER_HOUR / HOUR;
  const x = (at: number) => center + (at - time) * scale;
  const base = height - 9;
  const left = Math.max(0, x(min));
  const right = Math.min(width, x(max));

  context.lineWidth = 1;
  context.strokeStyle = 'rgba(223, 218, 245, 0.14)';
  context.beginPath();
  context.moveTo(left, base + 0.5);
  context.lineTo(right, base + 0.5);
  context.stroke();

  context.font = `500 9px ${font}`;
  context.textAlign = 'center';
  const nowX = x(now);
  const first = Math.ceil((time - center / scale) / HOUR) * HOUR;
  for (let at = first; x(at) <= width + 1; at += HOUR) {
    if (at < min || at > max) continue;
    const date = new Date(at);
    const hour = date.getUTCHours();
    const day = hour === 0;
    const quarter = hour % 6 === 0;
    const tick = Math.round(x(at)) + 0.5;
    context.strokeStyle = `rgba(223, 218, 245, ${day ? 0.62 : quarter ? 0.4 : 0.18})`;
    context.beginPath();
    context.moveTo(tick, base);
    context.lineTo(tick, base - (day ? 14 : quarter ? 8 : 4));
    context.stroke();
    // Leave room for the "now" label.
    if ((day || quarter) && Math.abs(tick - nowX) > 20) {
      context.fillStyle = `rgba(223, 218, 245, ${day ? 0.8 : 0.38})`;
      context.fillText(
        day
          ? `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
          : pad(hour),
        tick,
        base - 19,
      );
    }
  }

  // Real time, in the signal green used for "live".
  if (nowX > -20 && nowX < width + 20) {
    context.strokeStyle = 'rgba(159, 240, 200, 0.75)';
    context.beginPath();
    context.moveTo(Math.round(nowX) + 0.5, 12);
    context.lineTo(Math.round(nowX) + 0.5, base);
    context.stroke();
    context.fillStyle = 'rgba(159, 240, 200, 0.9)';
    context.fillText(frame.nowLabel, nowX, 9);
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
  context.moveTo(center, 4);
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
