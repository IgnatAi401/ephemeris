import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Pause, Play } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import {
  apsides,
  orbitPoint,
  periodMinutes,
  trueAnomaly,
  type Elements,
} from '@/lib/kepler';
import { basis } from '@/lib/scene-camera';

const DEG = Math.PI / 180;
type Key = keyof Elements;
// Fixed scale, so changing the semi-major axis visibly changes the size.
const VIEW_RADIUS = 5.6;

const SLIDERS: {
  key: Key;
  symbol: string;
  min: number;
  max: number;
  step: number;
  unit: 'Re' | '°' | '';
  zh: [string, string];
  en: [string, string];
}[] = [
  {
    key: 'a',
    symbol: 'a',
    min: 1.1,
    max: 7,
    step: 0.01,
    unit: 'Re',
    zh: ['半长轴', '轨道的大小：越大离地球越远、周期越长（周期只取决于 a）。'],
    en: [
      'Semi-major axis',
      'The size of the orbit: larger means farther out and slower; the period depends on a alone.',
    ],
  },
  {
    key: 'e',
    symbol: 'e',
    min: 0,
    max: 0.8,
    step: 0.005,
    unit: '',
    zh: [
      '偏心率',
      '轨道的形状：0 是正圆，越接近 1 越扁长；地球始终在椭圆的一个焦点上。',
    ],
    en: [
      'Eccentricity',
      'The shape: 0 is a circle, towards 1 ever more stretched; Earth always sits at one focus.',
    ],
  },
  {
    key: 'i',
    symbol: 'i',
    min: 0,
    max: 180,
    step: 0.5,
    unit: '°',
    zh: [
      '倾角',
      '轨道面相对赤道面的倾斜：0° 沿赤道东行，90° 过两极，大于 90° 为逆行。',
    ],
    en: [
      'Inclination',
      'Tilt of the orbit plane from the equator: 0° runs east along it, 90° over the poles, above 90° retrograde.',
    ],
  },
  {
    key: 'raan',
    symbol: 'Ω',
    min: 0,
    max: 360,
    step: 1,
    unit: '°',
    zh: [
      '升交点赤经',
      '轨道面绕地轴转到哪里：从春分点方向 ♈ 量到卫星由南向北穿过赤道的升交点 ☊。',
    ],
    en: [
      'Right ascension of the ascending node',
      'Which way the plane is turned about Earth’s axis: measured from the vernal equinox ♈ to the ascending node ☊, where the satellite crosses the equator heading north.',
    ],
  },
  {
    key: 'argp',
    symbol: 'ω',
    min: 0,
    max: 360,
    step: 1,
    unit: '°',
    zh: ['近地点幅角', '椭圆在轨道面内的朝向：从升交点沿运动方向量到近地点。'],
    en: [
      'Argument of perigee',
      'How the ellipse is turned within its plane: from the ascending node, along the motion, to perigee.',
    ],
  },
  {
    key: 'M',
    symbol: 'M',
    min: 0,
    max: 360,
    step: 1,
    unit: '°',
    zh: [
      '平近点角',
      '卫星此刻在轨道上的位置，按时间均匀增长；图中弧线是由它换算出的真近点角 ν。',
    ],
    en: [
      'Mean anomaly',
      'Where the satellite is on the orbit, growing evenly with time; the arc shows the true anomaly ν it corresponds to.',
    ],
  },
];

export const PRESETS: {
  id: string;
  zh: string;
  en: string;
  elements: Elements;
}[] = [
  {
    id: 'iss',
    zh: '空间站',
    en: 'ISS',
    elements: {
      a: 1.066,
      e: 0.0006,
      i: 51.6 * DEG,
      raan: 120 * DEG,
      argp: 0,
      M: 0,
    },
  },
  {
    id: 'gps',
    zh: 'GPS',
    en: 'GPS',
    elements: {
      a: 4.16,
      e: 0.01,
      i: 55 * DEG,
      raan: 60 * DEG,
      argp: 40 * DEG,
      M: 0,
    },
  },
  {
    id: 'geo',
    zh: '地球静止',
    en: 'GEO',
    elements: { a: 6.611, e: 0, i: 0, raan: 0, argp: 0, M: 0 },
  },
  {
    id: 'molniya',
    zh: '闪电',
    en: 'Molniya',
    elements: {
      a: 4.17,
      e: 0.72,
      i: 63.4 * DEG,
      raan: 80 * DEG,
      argp: 270 * DEG,
      M: 0,
    },
  },
];

const display = (key: Key, value: number) =>
  key === 'a' || key === 'e' ? value : value / DEG;
const store = (key: Key, value: number) =>
  key === 'a' || key === 'e' ? value : value * DEG;

/** The six classical elements, one slider each, on a small orbit you can
 * turn by dragging. The element last moved is drawn bright and explained. */
export function ElementsDemo({
  lang,
  elements,
  onChange,
}: {
  lang: Language;
  elements: Elements;
  onChange: (next: Elements) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<Key>('i');
  const [playing, setPlaying] = useState(false);
  const view = useRef({ azimuth: 35 * DEG, elevation: 24 * DEG });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ elements, active, onChange });
  useEffect(() => {
    latest.current = { elements, active, onChange };
  });

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const font =
      getComputedStyle(element).getPropertyValue('--font-mono').trim() ||
      'monospace';
    const tr = (en: string, zh: string) => (lang === 'en' ? en : zh);
    let frame = 0;
    let previous = performance.now();
    let reported = previous;
    const draw = (now: number) => {
      const dt = Math.min(100, now - previous);
      previous = now;
      let el = latest.current.elements;
      // Play: the mean anomaly runs at one lap per eight seconds, so the
      // satellite visibly hurries through perigee. The picture moves every
      // frame; the sliders and the scene hear about it ten times a second.
      if (playing) {
        el = { ...el, M: (el.M + (dt / 8000) * Math.PI * 2) % (Math.PI * 2) };
        latest.current.elements = el;
        if (now - reported > 100) {
          reported = now;
          latest.current.onChange(el);
        }
      }
      const width = element.clientWidth;
      const height = element.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (element.width !== Math.round(width * dpr)) {
        element.width = Math.round(width * dpr);
        element.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const { toward, right, up } = basis(
        view.current.elevation,
        view.current.azimuth,
      );
      const scale = (Math.min(width, height) / 2 - 6) / VIEW_RADIUS;
      const cx = width / 2;
      const cy = height / 2;
      const dot = (a: readonly number[], b: readonly number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const at = (p: readonly number[]): [number, number] => [
        cx + dot(p, right) * scale,
        cy - dot(p, up) * scale,
      ];
      const hidden = (p: readonly number[]) => {
        const x = dot(p, right);
        const y = dot(p, up);
        return dot(p, toward) < 0 && x * x + y * y < 1;
      };
      const path = (points: number[][], close = false) => {
        context.beginPath();
        let drawing = false;
        for (const p of points) {
          if (hidden(p)) {
            drawing = false;
            continue;
          }
          const [x, y] = at(p);
          if (drawing) context.lineTo(x, y);
          else context.moveTo(x, y);
          drawing = true;
        }
        if (close) context.closePath();
      };
      const range = (n: number, f: (k: number) => number[]) =>
        Array.from({ length: n + 1 }, (_, k) => f(k / n));
      const isActive = (key: Key) => latest.current.active === key;
      const accent = (key: Key, alpha = 1) =>
        isActive(key)
          ? `rgba(159, 240, 200, ${alpha})`
          : `rgba(200, 189, 255, ${0.45 * alpha})`;
      const text = (
        value: string,
        p: number[],
        color: string,
        align: CanvasTextAlign = 'left',
      ) => {
        const [x, y] = at(p);
        context.font = `500 10px ${font}`;
        context.textAlign = align;
        context.fillStyle = color;
        context.fillText(value, x, y);
      };

      // Equatorial plane and the vernal equinox direction.
      context.fillStyle = 'rgba(120, 140, 255, 0.05)';
      context.strokeStyle = 'rgba(160, 170, 230, 0.22)';
      context.lineWidth = 1;
      const rim = range(96, (k) => [
        Math.cos(k * 2 * Math.PI) * 5.2,
        Math.sin(k * 2 * Math.PI) * 5.2,
        0,
      ]);
      context.beginPath();
      rim.forEach((p, index) =>
        index ? context.lineTo(...at(p)) : context.moveTo(...at(p)),
      );
      context.fill();
      context.stroke();
      context.setLineDash([3, 4]);
      path([
        [0, 0, 0],
        [5.2, 0, 0],
      ]);
      context.stroke();
      context.setLineDash([]);
      text(
        tr('♈ equinox', '♈ 春分点'),
        [5.35, 0, 0],
        'rgba(200, 205, 240, 0.7)',
      );

      // Earth.
      const [ex, ey] = at([0, 0, 0]);
      const glow = context.createRadialGradient(
        ex - scale * 0.3,
        ey - scale * 0.3,
        0,
        ex,
        ey,
        scale,
      );
      glow.addColorStop(0, '#5f8fd8');
      glow.addColorStop(1, '#173a78');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(ex, ey, scale, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(200, 220, 255, 0.4)';
      path(
        range(64, (k) => [
          Math.cos(k * 2 * Math.PI),
          Math.sin(k * 2 * Math.PI),
          0,
        ]),
      );
      context.stroke();

      // The orbit plane's frame: ascending node n, normal h, perigee p.
      const node = [Math.cos(el.raan), Math.sin(el.raan), 0];
      const normal = [
        Math.sin(el.raan) * Math.sin(el.i),
        -Math.cos(el.raan) * Math.sin(el.i),
        Math.cos(el.i),
      ];
      const cross = (a: number[], b: number[]) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const inPlane = cross(normal, node);
      const perigeeDir = node.map(
        (value, k) =>
          value * Math.cos(el.argp) + inPlane[k] * Math.sin(el.argp),
      );
      const arc = (
        center: number[],
        u: number[],
        v: number[],
        angle: number,
        radius: number,
      ) =>
        range(48, (k) =>
          center.map(
            (c, j) =>
              c +
              radius *
                (u[j] * Math.cos(k * angle) + v[j] * Math.sin(k * angle)),
          ),
        );

      // Orbit: a faint fill of its plane, then the ellipse.
      const ellipse = range(180, (k) => orbitPoint(el, k * 2 * Math.PI));
      context.fillStyle = 'rgba(159, 240, 200, 0.05)';
      context.beginPath();
      ellipse.forEach((p, index) =>
        index ? context.lineTo(...at(p)) : context.moveTo(...at(p)),
      );
      context.fill();
      context.strokeStyle =
        isActive('a') || isActive('e')
          ? 'rgba(159, 240, 200, 0.95)'
          : 'rgba(223, 218, 245, 0.85)';
      context.lineWidth = 1.6;
      path(ellipse);
      context.stroke();

      // Line of nodes and the ascending node.
      const nodeRadius =
        (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(-el.argp));
      const descendingRadius =
        (el.a * (1 - el.e * el.e)) / (1 - el.e * Math.cos(-el.argp));
      context.setLineDash([2, 3]);
      context.strokeStyle = accent('raan', 0.8);
      context.lineWidth = 1;
      path([
        node.map((v) => -v * descendingRadius),
        node.map((v) => v * nodeRadius),
      ]);
      context.stroke();
      context.setLineDash([]);
      text(
        '☊',
        node.map((v) => v * (nodeRadius + 0.5)),
        accent('raan'),
        'center',
      );

      // Ω on the equator, from ♈ to the node.
      context.lineWidth = isActive('raan') ? 2 : 1.2;
      context.strokeStyle = accent('raan');
      path(arc([0, 0, 0], [1, 0, 0], [0, 1, 0], el.raan, 2.6));
      context.stroke();
      text(
        'Ω',
        [Math.cos(el.raan / 2) * 3, Math.sin(el.raan / 2) * 3, 0],
        accent('raan'),
        'center',
      );

      // i at the node, between the equator and the orbit.
      const nodePoint = node.map((v) => v * nodeRadius);
      const eastward = cross([0, 0, 1], node);
      context.lineWidth = isActive('i') ? 2 : 1.2;
      context.strokeStyle = accent('i');
      path(arc(nodePoint, eastward, [0, 0, 1], el.i, 1.1));
      context.stroke();
      path([nodePoint, nodePoint.map((c, j) => c + eastward[j] * 1.6)]);
      context.stroke();
      text(
        'i',
        nodePoint.map(
          (c, j) =>
            c +
            1.5 *
              (eastward[j] * Math.cos(el.i / 2) +
                (j === 2 ? Math.sin(el.i / 2) : 0)),
        ),
        accent('i'),
        'center',
      );

      // ω in the plane, from the node to perigee; ν from perigee to the
      // satellite; a and e along the apse line.
      context.lineWidth = isActive('argp') ? 2 : 1.2;
      context.strokeStyle = accent('argp');
      path(arc([0, 0, 0], node, inPlane, el.argp, 1.9));
      context.stroke();
      const half = el.argp / 2;
      text(
        'ω',
        node.map(
          (v, k) => 2.3 * (v * Math.cos(half) + inPlane[k] * Math.sin(half)),
        ),
        accent('argp'),
        'center',
      );
      const perigee = perigeeDir.map((v) => v * el.a * (1 - el.e));
      const apogee = perigeeDir.map((v) => -v * el.a * (1 + el.e));
      context.strokeStyle =
        isActive('a') || isActive('e')
          ? 'rgba(159, 240, 200, 0.8)'
          : 'rgba(223, 218, 245, 0.35)';
      context.lineWidth = 1;
      path([apogee, perigee]);
      context.stroke();
      if (isActive('e') && el.e > 0.01) {
        // The ellipse's centre, a·e from Earth at the focus.
        const centre = perigeeDir.map((v) => -v * el.a * el.e);
        const [x, y] = at(centre);
        context.fillStyle = 'rgba(159, 240, 200, 0.9)';
        context.fillRect(x - 2, y - 2, 4, 4);
        text(tr('centre', '中心'), centre, 'rgba(159, 240, 200, 0.9)');
      }
      text(
        tr('perigee', '近地点'),
        perigee.map((v) => v * 1.12),
        'rgba(223, 218, 245, 0.7)',
        'center',
      );
      if (isActive('a'))
        text(
          'a',
          // Half the apse line, from the ellipse's centre to perigee.
          perigeeDir.map((v) => v * el.a * (0.5 - el.e)),
          'rgba(159, 240, 200, 0.9)',
          'center',
        );
      const nu = trueAnomaly(el.M, el.e);
      context.lineWidth = isActive('M') ? 2 : 1.2;
      context.strokeStyle = accent('M');
      path(
        arc(
          [0, 0, 0],
          perigeeDir,
          cross(normal, perigeeDir),
          ((nu % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
          1.45,
        ),
      );
      context.stroke();
      const satellite = orbitPoint(el, nu);
      context.strokeStyle = 'rgba(223, 218, 245, 0.3)';
      path([[0, 0, 0], satellite]);
      context.stroke();
      const [sx, sy] = at(satellite);
      context.fillStyle = hidden(satellite)
        ? 'rgba(255, 255, 255, 0.35)'
        : '#fff';
      context.shadowColor = 'rgba(159, 240, 200, 0.9)';
      context.shadowBlur = 8;
      context.beginPath();
      context.arc(sx, sy, 3.5, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [lang, playing]);

  const turn = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const from = drag.current;
    if (!from) return;
    view.current = {
      azimuth: view.current.azimuth - (event.clientX - from.x) * 0.01,
      elevation: Math.max(
        -1.4,
        Math.min(1.4, view.current.elevation + (event.clientY - from.y) * 0.01),
      ),
    };
    drag.current = { x: event.clientX, y: event.clientY };
  };

  const slider = SLIDERS.find(({ key }) => key === active)!;
  const [perigee, apogee] = apsides(elements);
  return (
    <div className="orbit-demo">
      <canvas
        ref={canvas}
        className="orbit-demo-canvas"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={turn}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <p className="orbit-demo-hint">
        {t('Drag the picture to turn it.', '拖动图形可以旋转视角。')}
      </p>
      <div className="orbit-demo-explain">
        <strong>
          {slider.symbol} · {t(slider.en[0], slider.zh[0])}
        </strong>
        <p>{t(slider.en[1], slider.zh[1])}</p>
      </div>
      <div className="orbit-demo-sliders">
        {SLIDERS.map(({ key, symbol, min, max, step, unit, zh, en }) => {
          const value = display(key, elements[key]);
          return (
            <label key={key} data-active={key === active || undefined}>
              <span className="orbit-demo-symbol">{symbol}</span>
              <span className="orbit-demo-name">{t(en[0], zh[0])}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onFocus={() => setActive(key)}
                onPointerDown={() => setActive(key)}
                onChange={(event) => {
                  setActive(key);
                  onChange({
                    ...elements,
                    [key]: store(key, Number(event.currentTarget.value)),
                  });
                }}
              />
              <output>
                {key === 'e'
                  ? value.toFixed(3)
                  : key === 'a'
                    ? value.toFixed(2)
                    : Math.round(value)}
                {unit === 'Re' ? ` ${t('Re', '地球半径')}` : unit}
              </output>
            </label>
          );
        })}
      </div>
      <div className="orbit-demo-derived">
        <span>
          {t('Period', '周期')} {periodMinutes(elements.a).toFixed(0)}{' '}
          {t('min', '分钟')}
        </span>
        <span>
          {t('Perigee', '近地点')} {Math.round(perigee).toLocaleString('en-US')}{' '}
          km
        </span>
        <span>
          {t('Apogee', '远地点')} {Math.round(apogee).toLocaleString('en-US')}{' '}
          km
        </span>
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={
            playing
              ? t('Stop the satellite', '停止卫星运动')
              : t('Move the satellite', '让卫星动起来')
          }
          title={t(
            'Kepler’s second law: fastest at perigee',
            '开普勒第二定律：近地点附近最快',
          )}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>
      {perigee < 0 && (
        <p className="orbit-demo-warning">
          {t(
            'Perigee is below the surface: this orbit would hit Earth.',
            '近地点在地面以下：这条轨道会撞上地球。',
          )}
        </p>
      )}
    </div>
  );
}
