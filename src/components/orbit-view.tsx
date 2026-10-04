import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Navigation, Pause, Play, Radar, Satellite } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { CONSTELLATIONS, type ConstellationKind } from '@/lib/orbits';
import type { OrbitScene, SceneText, SceneView } from '@/lib/orbit-scene';
import { drawTape, TAPE_PX_PER_HOUR } from '@/lib/orbit-tape';
import {
  loadOrbitStage,
  orbitStageUnsupported,
  readyOrbitStage,
  type OrbitStage,
} from '@/lib/orbit-stage';
import { createFrameLoop } from '@/lib/frame-loop';
import { Fallback } from '@/components/fallback';
import { Freshness } from '@/components/freshness';

type Topic = 'leo' | 'deep' | 'moon';
type Focus = Topic | 'overview';
type Pose = Omit<SceneView, 'time'>;

const DEG = Math.PI / 180;
// Camera and layer weights per legend topic. The overview frames the GNSS
// shells; the Moon and the L1/L2 spacecraft sit at true distance only when
// asked for.
const POSES: Record<Focus, Pose> = {
  overview: {
    zoom: 3.7,
    elevation: 22 * DEG,
    azimuth: 62 * DEG,
    leo: 1,
    gnss: 1,
    trails: 1,
    receiver: 1,
    moonPath: 0,
    deep: 0,
    spill: 0,
    lunar: 0,
    fitMoon: 0,
  },
  leo: {
    zoom: 1.5,
    elevation: 16 * DEG,
    azimuth: 52 * DEG,
    leo: 1,
    gnss: 0.18,
    trails: 1,
    receiver: 0.35,
    moonPath: 0,
    deep: 0,
    spill: 0,
    lunar: 0,
    fitMoon: 0,
  },
  moon: {
    zoom: 72,
    elevation: 34 * DEG,
    azimuth: 48 * DEG,
    leo: 1,
    gnss: 0.55,
    trails: 0.3,
    receiver: 0,
    moonPath: 1,
    deep: 0,
    spill: 1,
    lunar: 1,
    fitMoon: 1,
  },
  deep: {
    zoom: 245,
    elevation: 40 * DEG,
    azimuth: 44 * DEG,
    leo: 1,
    gnss: 0.4,
    trails: 0,
    receiver: 0,
    moonPath: 0.5,
    deep: 1,
    spill: 0,
    lunar: 0,
    fitMoon: 0,
  },
};
const KEYS = Object.keys(POSES.overview) as (keyof Pose)[];
// Playback: real time ("now") or one fixed fast-forward, 2 minutes a second.
const FAST = 120;
const DAY = 86400000;
const SPAN = 14 * DAY;
const MS_PER_PX = 3600000 / TAPE_PX_PER_HOUR;
const GLIDE_LIMIT = DAY / 2 / 320;
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// Keep the clock within the tape, ±14 days of page load.
const clamp = (time: number, anchor: number) =>
  Math.min(anchor + SPAN, Math.max(anchor - SPAN, time));
const utc = (time: number) =>
  new Date(time).toISOString().slice(0, 19).replace('T', ' ');

const sceneText = (lang: Language): SceneText & { now: string } =>
  lang === 'en'
    ? {
        sun: 'Sun',
        moon: 'Moon',
        earth: 'Earth',
        zh: false,
        l1: 'Sun–Earth L1',
        l2: 'Sun–Earth L2',
        spill: (count) =>
          `GNSS main-lobe spillover · ${count} reach the Moon now`,
        lugre: 'LuGRE tracked GPS and Galileo on the Moon in 2025',
        closeUp: 'Lunar close-up · LRO · Danuri',
        now: 'NOW',
        phase: (percent, waxing) =>
          `${percent}% ${waxing ? 'waxing' : 'waning'}`,
      }
    : {
        sun: '太阳方向',
        moon: '月球',
        earth: '地球',
        zh: true,
        l1: '日地 L1',
        l2: '日地 L2',
        spill: (count) => `GNSS 主瓣外溢 · 此刻 ${count} 颗可达月球`,
        lugre: '2025 年 LuGRE 在月面收到 GPS / Galileo 信号',
        closeUp: '月球近景 · LRO · Danuri',
        now: '此刻',
        phase: (percent, waxing) => `${waxing ? '盈' : '亏'} ${percent}%`,
      };

type Tween = { from: Pose; to: Pose; start: number; duration: number };
function poseAt(tween: Tween, now: number): Pose {
  const t = ease(
    Math.min(1, Math.max(0, (now - tween.start) / tween.duration)),
  );
  const pose = { ...tween.to };
  for (const key of KEYS) {
    const [a, b] = [tween.from[key], tween.to[key]];
    // Zoom moves evenly in scale, not in distance, across three decades.
    pose[key] = key === 'zoom' ? a * (b / a) ** t : a + (b - a) * t;
  }
  return pose;
}

/** The live sky, full screen: Starlink, Iridium and ORBCOMM with the four
 * GNSS constellations, propagated from a CelesTrak snapshot, under the real
 * Sun and Moon. The legend zooms out to the Moon and deep space. */
export function OrbitView({
  lang,
  children,
}: {
  lang: Language;
  children?: ReactNode;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const tape = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const [anchor] = useState(() => Date.now());
  // Simulation clock: `sim` at wall time `real`, advancing at `speed`.
  // `live` is the "Now" mode: real-time speed, pinned to the present until
  // the tape is moved or fast playback is chosen.
  const clock = useRef({
    sim: anchor,
    real: anchor,
    speed: FAST,
    playing: true,
    live: false,
  });
  // Tape drag, then its glide after release; `resume` restores playback.
  const drag = useRef<{
    x: number;
    sim: number;
    at: number;
    velocity: number;
    resume: boolean;
  } | null>(null);
  const glide = useRef<{
    velocity: number;
    at: number;
    resume: boolean;
  } | null>(null);
  const tween = useRef<Tween>({
    from: POSES.overview,
    to: POSES.overview,
    start: 0,
    duration: 1,
  });
  const invalidate = useRef(() => {});
  const text = useRef(sceneText(lang));
  const [hovered, setHovered] = useState<Topic | null>(null);
  const [pinned, setPinned] = useState<Topic | null>(null);
  const [playing, setPlaying] = useState(true);
  const [live, setLive] = useState(false);
  // Usually built in the background before the page is first opened.
  const [counts, setCounts] = useState(() => readyOrbitStage()?.counts ?? null);
  const [fetched, setFetched] = useState(
    () => readyOrbitStage()?.fetched ?? null,
  );
  const [status, setStatus] = useState<
    'idle' | 'ready' | 'failed' | 'unsupported'
  >(() => (readyOrbitStage() ? 'ready' : 'idle'));
  const focus: Focus = hovered ?? pinned ?? 'overview';
  const leave = useRef<number | undefined>(undefined);

  useEffect(() => {
    text.current = sceneText(lang);
    invalidate.current();
  }, [lang]);

  const simTime = () => {
    const { sim, real, speed: rate, playing: running } = clock.current;
    return running ? sim + (Date.now() - real) * rate : sim;
  };
  const setClock = (next: Partial<typeof clock.current>) => {
    clock.current = {
      ...clock.current,
      sim: simTime(),
      real: Date.now(),
      ...next,
    };
    clock.current.sim = clamp(clock.current.sim, anchor);
    setPlaying(clock.current.playing);
    setLive(clock.current.live);
    invalidate.current();
  };

  // Grab the tape and pull it: dragging right goes back in time.
  const grab = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const resume = glide.current?.resume ?? clock.current.playing;
    glide.current = null;
    setClock({ playing: false, live: false });
    drag.current = {
      x: event.clientX,
      sim: clock.current.sim,
      at: performance.now(),
      velocity: 0,
      resume,
    };
  };
  const pull = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current;
    if (!state) return;
    const now = performance.now();
    const sim = clamp(
      state.sim - (event.clientX - state.x) * MS_PER_PX,
      anchor,
    );
    const elapsed = Math.max(8, now - state.at);
    // Smoothed tape speed, in simulated ms per real ms, for the glide.
    state.velocity =
      state.velocity * 0.6 + ((sim - clock.current.sim) / elapsed) * 0.4;
    state.at = now;
    clock.current = { ...clock.current, sim, real: Date.now() };
    invalidate.current();
  };
  const release = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    // A flick coasts at most about half a day (velocity × 320 ms decay).
    const velocity = Math.max(
      -GLIDE_LIMIT,
      Math.min(GLIDE_LIMIT, state.velocity),
    );
    if (!reduced && Math.abs(velocity) > MS_PER_PX / 20)
      glide.current = { velocity, at: performance.now(), resume: state.resume };
    else setClock({ playing: state.resume });
  };

  useEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const now = performance.now();
    const current = poseAt(tween.current, now);
    const target = POSES[focus];
    const span = Math.abs(Math.log(target.zoom / current.zoom));
    tween.current = {
      from: current,
      to: target,
      start: now,
      duration: reduced ? 1 : Math.min(2400, 900 + 420 * span),
    };
    invalidate.current();
  }, [focus]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      clock.current = { ...clock.current, playing: false, speed: 1 };
    setPlaying(clock.current.playing);
    const element = frame.current;
    const box = stage.current;
    const ruler = tape.current;
    const rulerContext = ruler?.getContext('2d');
    if (!element || !box || !ruler || !rulerContext) return;
    const font =
      getComputedStyle(ruler).getPropertyValue('--font-mono').trim() ||
      'monospace';
    let rulerSize = { width: 1, height: 1, dpr: 1 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let scene: OrbitScene | null = null;
    let attached: OrbitStage | null = null;
    let disposed = false;

    const paint = (now: number) => {
      const coast = glide.current;
      if (coast) {
        const elapsed = Math.min(64, now - coast.at);
        coast.at = now;
        const sim = clamp(clock.current.sim + coast.velocity * elapsed, anchor);
        coast.velocity =
          sim === clock.current.sim
            ? 0
            : coast.velocity * Math.exp(-elapsed / 320);
        clock.current = { ...clock.current, sim, real: Date.now() };
        if (Math.abs(coast.velocity) < MS_PER_PX / 30) {
          glide.current = null;
          clock.current = { ...clock.current, playing: coast.resume };
          setPlaying(coast.resume);
        }
      }
      let time = simTime();
      const { playing: running } = clock.current;
      if (running && time > anchor + SPAN) {
        clock.current = {
          ...clock.current,
          sim: anchor + SPAN,
          playing: false,
        };
        setPlaying(false);
        time = anchor + SPAN;
      }
      scene?.render(
        { time, ...poseAt(tween.current, now) },
        reduced.matches ? 0 : now,
        text.current,
      );
      if (readout.current) readout.current.textContent = `${utc(time)} UTC`;
      if (scrub.current && document.activeElement !== scrub.current)
        scrub.current.value = String(Math.round((time - anchor) / 1000));
      drawTape(rulerContext, {
        ...rulerSize,
        time,
        now: Date.now(),
        min: anchor - SPAN,
        max: anchor + SPAN,
        font,
        nowLabel: text.current.now,
      });
    };
    const loop = createFrameLoop(
      paint,
      {
        request: (callback) => window.requestAnimationFrame(callback),
        cancel: (callbackId) => window.cancelAnimationFrame(callbackId),
      },
      60,
    );
    const sync = () =>
      loop.update({
        visible: !document.hidden,
        active: !reduced.matches,
        fps: 60,
      });
    invalidate.current = () => loop.invalidate();

    const resize = () => {
      // Layout sizes, not getBoundingClientRect, so a transform on the stage
      // can never shrink the canvas.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      rulerSize = {
        width: Math.max(1, ruler.clientWidth),
        height: Math.max(1, ruler.clientHeight),
        dpr,
      };
      ruler.width = Math.round(rulerSize.width * dpr);
      ruler.height = Math.round(rulerSize.height * dpr);
      scene?.resize(
        Math.max(1, box.clientWidth),
        Math.max(1, box.clientHeight),
        dpr,
      );
      loop.invalidate();
    };
    // The stage lives for the whole visit (lib/orbit-stage.ts): attach its
    // canvases on mount and only detach them on unmount.
    const rebuilt = () => {
      scene = attached?.scene ?? null;
      resize();
    };
    const attach = (next: OrbitStage) => {
      if (disposed) return;
      attached = next;
      box.insertBefore(next.overlay, box.firstChild);
      box.insertBefore(next.canvas, next.overlay);
      next.rebuilt.add(rebuilt);
      rebuilt();
      setCounts(next.counts);
      setFetched(next.fetched);
      setStatus('ready');
    };
    const detach = () => {
      if (!attached) return;
      attached.rebuilt.delete(rebuilt);
      attached.canvas.remove();
      attached.overlay.remove();
      attached = null;
      scene = null;
    };
    const ready = readyOrbitStage();
    if (ready) attach(ready);
    else
      loadOrbitStage().then(attach, () => {
        if (!disposed)
          setStatus(orbitStageUnsupported() ? 'unsupported' : 'failed');
      });
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    observer.observe(ruler);
    // Sideways trackpad swipes (or shift + wheel) scroll the tape.
    const wheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;
      if (!delta) return;
      event.preventDefault();
      clock.current = {
        ...clock.current,
        sim: clamp(simTime() + delta * MS_PER_PX, anchor),
        real: Date.now(),
        live: false,
      };
      setLive(false);
      loop.invalidate();
    };
    ruler.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true;
      loop.dispose();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      ruler.removeEventListener('wheel', wheel);
      detach();
    };
  }, [anchor]);

  useEffect(() => () => window.clearTimeout(leave.current), []);
  const enter = (topic: Topic) => {
    window.clearTimeout(leave.current);
    setHovered(topic);
  };
  // A short grace period so sliding between legend cards does not bounce the
  // camera back to the overview.
  const exit = () => {
    window.clearTimeout(leave.current);
    leave.current = window.setTimeout(() => setHovered(null), 220);
  };

  const topics = [
    {
      id: 'leo' as const,
      Icon: Satellite,
      en: 'Low Earth orbit satellites',
      short: ['LEO', '低轨'],
      zh: '低轨卫星',
      meta: 'STARLINK · IRIDIUM · ORBCOMM',
    },
    {
      id: 'moon' as const,
      Icon: Navigation,
      en: 'Earth–Moon navigation',
      short: ['Earth–Moon', '地月'],
      zh: '地月导航',
      meta: 'CISLUNAR · GNSS SPILLOVER',
    },
    {
      id: 'deep' as const,
      Icon: Radar,
      en: 'Deep-space positioning',
      short: ['Deep space', '深空'],
      zh: '深空定位',
      meta: 'SUN–EARTH L1 · L2',
    },
  ];
  // Legend rows: one per group, except the three debris clouds, which share
  // a row (and a colour family) as one kind.
  const sections = [
    { id: 'leo', label: 'LEO', kinds: ['leo'] },
    { id: 'gnss', label: 'GNSS', kinds: ['gnss'] },
    {
      id: 'other',
      label: t('More', '其他'),
      kinds: ['station', 'geo', 'debris', 'new'],
    },
  ] as const;
  type Row = { key: string; color: string; label: string; count: number };
  const rows = (kinds: readonly ConstellationKind[]) =>
    CONSTELLATIONS.flatMap((item, index): Row[] => {
      if (!kinds.includes(item.kind)) return [];
      const count = counts?.[index] ?? 0;
      if (item.kind !== 'debris')
        return [
          {
            key: item.key,
            color: item.color,
            label: t(item.en, item.zh),
            count,
          },
        ];
      const first = CONSTELLATIONS.findIndex(({ kind }) => kind === 'debris');
      if (index !== first) return [];
      const total = CONSTELLATIONS.reduce(
        (sum, { kind }, at) =>
          sum + (kind === 'debris' ? (counts?.[at] ?? 0) : 0),
        0,
      );
      return [
        {
          key: 'debris',
          color: item.color,
          label: t('Debris clouds', '碎片云'),
          count: total,
        },
      ];
    });

  return (
    <div className="orbit-map" ref={frame} data-focus={focus}>
      <div className="orbit-map-stage" ref={stage} data-status={status}>
        <div className="orbit-key">
          {sections.map(({ id, label, kinds }) => (
            <div key={id} className="orbit-key-group" data-kind={id}>
              <span className="orbit-key-title">{label}</span>
              <ul>
                {rows(kinds).map((row) => (
                  <li
                    key={row.key}
                    style={{ '--dot': row.color } as CSSProperties}
                  >
                    <i aria-hidden="true" />
                    {row.label}
                    <span>
                      {counts ? row.count.toLocaleString('en-US') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {fetched && <p className="orbit-key-source">CELESTRAK · {fetched}</p>}
        </div>
        <Freshness lang={lang} />
        {status === 'unsupported' && <Fallback lang={lang} />}
        {status === 'failed' && (
          <p className="orbit-fallback">
            {t(
              'The orbit data could not be loaded. Please reload.',
              '轨道数据加载失败，请刷新重试。',
            )}
          </p>
        )}
      </div>
      <div className="orbit-dock">
        <div className="orbit-timeline">
          <button
            type="button"
            className="orbit-play"
            aria-label={
              playing
                ? t('Pause', '暂停')
                : t('Play at 120×', '以 120 倍速播放')
            }
            onClick={() =>
              setClock(
                playing
                  ? { playing: false }
                  : { playing: true, speed: FAST, live: false },
              )
            }
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            className="orbit-now"
            data-live={live || undefined}
            data-paused={!playing || undefined}
            aria-pressed={live}
            // First press follows the present in real time; pressing again
            // returns to fast playback. Either way a paused clock stays paused.
            onClick={() =>
              setClock(
                live
                  ? { speed: FAST, live: false }
                  : { sim: Date.now(), real: Date.now(), speed: 1, live: true },
              )
            }
          >
            <i aria-hidden="true" />
            {t('Now', '此刻')}
          </button>
          <div className="orbit-tape">
            <canvas
              ref={tape}
              aria-hidden="true"
              onPointerDown={grab}
              onPointerMove={pull}
              onPointerUp={release}
              onPointerCancel={release}
            />
            {/* Keyboard and screen-reader access to the same clock. */}
            <input
              ref={scrub}
              className="orbit-scrub"
              type="range"
              min={-SPAN / 1000}
              max={SPAN / 1000}
              step={3600}
              defaultValue={0}
              aria-label={t('Time, ±14 days from now', '时间：此刻前后 14 天')}
              onChange={(event) =>
                setClock({
                  sim: anchor + Number(event.currentTarget.value) * 1000,
                  live: false,
                })
              }
            />
          </div>
          <output ref={readout} className="orbit-clock" />
        </div>
        <ul className="orbit-legend">
          {topics.map(({ id: topic, Icon, en, zh, short, meta }) => (
            <li key={topic} data-focused={focus === topic || undefined}>
              <button
                type="button"
                aria-pressed={pinned === topic}
                onPointerEnter={(event) =>
                  event.pointerType === 'mouse' && enter(topic)
                }
                onPointerLeave={(event) =>
                  event.pointerType === 'mouse' && exit()
                }
                onFocus={(event) =>
                  event.currentTarget.matches(':focus-visible') && enter(topic)
                }
                onBlur={exit}
                onClick={() =>
                  setPinned((value) => (value === topic ? null : topic))
                }
              >
                <span className="orbit-legend-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>
                    <span className="orbit-legend-long">{t(en, zh)}</span>
                    <span className="orbit-legend-short">
                      {t(short[0], short[1])}
                    </span>
                  </strong>
                  <small>{meta}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}
