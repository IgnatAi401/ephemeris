import { useEffect, useRef } from 'react';
import type { Language } from '@/lib/i18n';
import type { Pass } from '@/lib/passes';

/** The observer's sky as a polar chart: zenith in the centre, the horizon at
 * the rim, north up and east to the left (as when looking up). The chosen
 * pass is drawn with its direction, and a dot follows the simulated clock. */
export function SkyChart({
  lang,
  pass,
  simTime,
}: {
  lang: Language;
  pass: Pass | null;
  simTime: () => number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const font =
      getComputedStyle(element).getPropertyValue('--font-mono').trim() ||
      'monospace';
    let frame = 0;
    let lastSize = 0;
    let lastDpr = 0;
    let lastTime: number | null | undefined;
    const draw = () => {
      const size = element.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const current = simTime();
      const time =
        pass && current >= pass.start.time && current <= pass.end.time
          ? current
          : null;
      // A panel can briefly have no layout while opening or unmounting.
      // Keep the loop alive without drawing invalid, negative-radius arcs.
      // Outside the pass (or while paused), the chart is entirely static.
      if (
        size <= 32 ||
        (size === lastSize && dpr === lastDpr && time === lastTime)
      ) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      lastSize = size;
      lastDpr = dpr;
      lastTime = time;
      if (element.width !== Math.round(size * dpr)) {
        element.width = Math.round(size * dpr);
        element.height = Math.round(size * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);
      const c = size / 2;
      const r = c - 16;
      const at = (azimuth: number, elevation: number): [number, number] => {
        const distance = (r * (90 - elevation)) / 90;
        const a = (azimuth * Math.PI) / 180;
        // East on the left: the chart is the sky seen from below.
        return [c - Math.sin(a) * distance, c - Math.cos(a) * distance];
      };
      context.strokeStyle = 'rgba(223, 218, 245, 0.16)';
      context.lineWidth = 1;
      for (const elevation of [0, 30, 60]) {
        context.beginPath();
        context.arc(c, c, (r * (90 - elevation)) / 90, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(c - r, c);
      context.lineTo(c + r, c);
      context.moveTo(c, c - r);
      context.lineTo(c, c + r);
      context.stroke();
      context.fillStyle = 'rgba(223, 218, 245, 0.6)';
      context.font = `500 10px ${font}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const labels =
        lang === 'en' ? ['N', 'E', 'S', 'W'] : ['北', '东', '南', '西'];
      labels.forEach((text, index) => {
        const [x, y] = at(index * 90, -12);
        context.fillText(text, x, y);
      });
      context.fillStyle = 'rgba(223, 218, 245, 0.32)';
      context.fillText('30°', c + 4, c - (r * 60) / 90 + 8);
      context.fillText('60°', c + 4, c - (r * 30) / 90 + 8);

      if (pass) {
        context.strokeStyle = 'rgba(159, 240, 200, 0.85)';
        context.lineWidth = 2;
        context.beginPath();
        pass.path.forEach(({ azimuth, elevation }, index) => {
          const [x, y] = at(azimuth, elevation);
          if (index) context.lineTo(x, y);
          else context.moveTo(x, y);
        });
        context.stroke();
        // Arrowhead at the end, start dot at the beginning.
        const end = pass.path[pass.path.length - 1];
        const before = pass.path[Math.max(0, pass.path.length - 3)];
        const [ex, ey] = at(end.azimuth, end.elevation);
        const [bx, by] = at(before.azimuth, before.elevation);
        const angle = Math.atan2(ey - by, ex - bx);
        context.fillStyle = 'rgba(159, 240, 200, 0.9)';
        context.beginPath();
        context.moveTo(ex, ey);
        context.lineTo(
          ex - 8 * Math.cos(angle - 0.45),
          ey - 8 * Math.sin(angle - 0.45),
        );
        context.lineTo(
          ex - 8 * Math.cos(angle + 0.45),
          ey - 8 * Math.sin(angle + 0.45),
        );
        context.closePath();
        context.fill();
        const [sx, sy] = at(pass.start.azimuth, pass.start.elevation);
        context.beginPath();
        context.arc(sx, sy, 2.5, 0, Math.PI * 2);
        context.fill();
        // Where the satellite is at the simulated instant, if mid-pass.
        if (time !== null) {
          let index = 0;
          while (
            index + 1 < pass.path.length &&
            pass.path[index + 1].time <= time
          )
            index++;
          const a = pass.path[index];
          const b = pass.path[Math.min(index + 1, pass.path.length - 1)];
          const fraction =
            b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
          // Follow the sampled arc continuously, including crossing north.
          const turn = ((b.azimuth - a.azimuth + 540) % 360) - 180;
          const [x, y] = at(
            a.azimuth + turn * fraction,
            a.elevation + (b.elevation - a.elevation) * fraction,
          );
          context.fillStyle = '#fff';
          context.shadowColor = 'rgba(159, 240, 200, 0.9)';
          context.shadowBlur = 10;
          context.beginPath();
          context.arc(x, y, 4, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
      }
      frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [lang, pass, simTime]);
  return <canvas ref={canvas} className="orbit-sky" aria-hidden="true" />;
}
