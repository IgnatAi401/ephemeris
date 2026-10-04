import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  GraduationCap,
  Keyboard,
  Link2,
  Moon,
  Orbit,
  Pause,
  Play,
  Radar,
  Satellite,
  Telescope,
} from 'lucide-react';
import type { Language } from '@/lib/i18n';
import {
  CONSTELLATIONS,
  EARTH_RADIUS_KM,
  groundPoint,
  positionAt,
  sunDirection,
  type Fleet,
} from '@/lib/orbits';
import type {
  OrbitScene,
  SceneText,
  SceneView,
  Selection,
} from '@/lib/orbit-scene';
import { drawTape, TAPE_PX_PER_HOUR } from '@/lib/orbit-tape';
import {
  loadOrbitStage,
  orbitStageUnsupported,
  readyOrbitStage,
  type OrbitStage,
} from '@/lib/orbit-stage';
import { createFrameLoop } from '@/lib/frame-loop';
import {
  defaultLayers,
  GROUP_LAYER,
  type LayerId,
  type Layers,
} from '@/lib/layers';
import { Fallback } from '@/components/fallback';
import { Freshness } from '@/components/freshness';
import { LayerPanel } from '@/components/layer-panel';
import { ShortcutHelp } from '@/components/shortcut-help';
import { SearchBox } from '@/components/search-box';
import { InfoCard } from '@/components/info-card';
import { PassPanel } from '@/components/pass-panel';
import { loadCatalog, type Catalog, type CatalogEntry } from '@/lib/catalog';
import { precise, type Precise } from '@/lib/precise';
import type { Observer, Pass } from '@/lib/passes';
import { readHash, writeHash } from '@/lib/share';
import { LearnPanel } from '@/components/learn-panel';
import { apsides, orbitPoint, type Elements } from '@/lib/kepler';
import {
  classify,
  lunarTransfer,
  ORBIT_TYPES,
  type OrbitTypeId,
} from '@/lib/orbit-types';
import { frameHalf } from '@/lib/scene-camera';

type Preset = 'leo' | 'gnss' | 'moon' | 'deep';
type Focus = Preset | 'overview';
/** The tweened part of a frame: camera and the topic weights. */
type Pose = Omit<
  SceneView,
  | 'time'
  | 'groups'
  | 'lights'
  | 'recent'
  | 'halo'
  | 'bloom'
  | 'selected'
  | 'hovered'
  | 'insetRight'
  | 'focus'
  | 'example'
>;

const DEG = Math.PI / 180;
// Camera and topic weights per scale. The overview frames the GNSS shells;
// the presets roam out from low orbit to the Sun–Earth L1/L2 points.
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
    zoom: 1.35,
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
  gnss: {
    zoom: 8.5,
    elevation: 26 * DEG,
    azimuth: 70 * DEG,
    leo: 1,
    gnss: 1,
    trails: 1,
    receiver: 0.6,
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
// The opening shot starts far out in deep space and pushes in to the overview.
const INTRO_POSE: Pose = {
  ...POSES.overview,
  zoom: 420,
  elevation: 38 * DEG,
  azimuth: 150 * DEG,
};
const INTRO_MS = 5200;
// Where the camera goes for each orbit family in the learn panel.
const TYPE_POSES: Record<OrbitTypeId, Pose> = {
  leo: { ...POSES.leo, zoom: 1.6 },
  meo: { ...POSES.gnss, zoom: 7 },
  geo: { ...POSES.gnss, zoom: 9.5, elevation: 10 * DEG },
  heo: { ...POSES.gnss, zoom: 11, elevation: 22 * DEG },
  molniya: { ...POSES.gnss, zoom: 10, elevation: 18 * DEG },
  sso: { ...POSES.leo, zoom: 2.3, elevation: 62 * DEG },
  // Turned to the trip itself when chosen (see transferPose).
  tli: { ...POSES.moon, zoom: 60, spill: 0, lunar: 0, fitMoon: 0 },
};
const DEMO_START: Elements = {
  a: 3.4,
  e: 0.35,
  i: 40 * DEG,
  raan: 40 * DEG,
  argp: 60 * DEG,
  M: 30 * DEG,
};
const EXAMPLE_COLOR = '#ffd28a';
// Room the side panels leave either side of Earth on a wide screen, px.
const PANEL_ROOM = 240;
const PRESETS: Preset[] = ['leo', 'gnss', 'moon', 'deep'];
const KEYS = Object.keys(POSES.overview) as (keyof Pose)[];
const ZOOM_RANGE = [0.75, 600];
const ELEVATION_LIMIT = 80 * DEG;
const SPEEDS = [1, 60, 600, 3600];
const DEFAULT_SPEED = 60;
const DAY = 86400000;
const SPAN = 14 * DAY;
const MS_PER_PX = 3600000 / TAPE_PX_PER_HOUR;
const GLIDE_LIMIT = DAY / 2 / 320;
// Radians of rotation per pixel of drag.
const DRAG = 0.0055;
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const ramp = (t: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (t - from) / (to - from)));
// Keep the clock within the tape, ±14 days of page load.
const clamp = (time: number, anchor: number) =>
  Math.min(anchor + SPAN, Math.max(anchor - SPAN, time));
const utc = (time: number) =>
  new Date(time).toISOString().slice(0, 19).replace('T', ' ');
/** A typed UTC time ("2026-10-04 12:00[:00][ UTC]"), or null if it is not a
 * real date and time. */
function parseUtc(value: string) {
  const match =
    /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:UTC|Z)?\s*$/i.exec(
      value,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second = 0] = match
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)));
  const time = Date.UTC(year!, month! - 1, day, hour, minute, second);
  const date = new Date(time);
  // Date.UTC rolls 31 April over to 1 May: only exact round trips count.
  return date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    minute! < 60 &&
    second < 60
    ? time
    : null;
}
// The clock the camera tweens run on (the frame loop's own time base).
const frameClock = () => performance.now();
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        closeUp: '月球近景 · LRO · Danuri',
        now: '此刻',
        phase: (percent, waxing) => `${waxing ? '盈' : '亏'} ${percent}%`,
      };

type Tween = { from: Pose; to: Pose; start: number; duration: number };
const still = (pose: Pose): Tween => ({
  from: pose,
  to: pose,
  start: 0,
  duration: 1,
});
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

// The opening sequence lights the sky in layers: GNSS first, then the
// Starlink shells, then everything else. Each returns a 0–1 factor for
// the intro's progress t.
const introGroup = CONSTELLATIONS.map(({ key, kind }) =>
  kind === 'gnss'
    ? (t: number) => ramp(t, 0.28, 0.48)
    : key === 'starlink'
      ? (t: number) => ramp(t, 0.45, 0.68)
      : (t: number) => ramp(t, 0.6, 0.85),
);

/** A view down onto a trip to the Moon, the meeting point on the left (the
 * side panel covers the right) and the whole path in the frame. */
function transferPose(trip: ReturnType<typeof lunarTransfer>, time: number) {
  const { elements } = trip;
  const meet = orbitPoint(elements, Math.PI);
  // Looking along this longitude, the apse line runs across the screen
  // with the Moon end to the left.
  const phi = Math.atan2(meet[1], meet[0]) + Math.PI / 2;
  const normal = [
    Math.sin(elements.raan) * Math.sin(elements.i),
    -Math.cos(elements.raan) * Math.sin(elements.i),
    Math.cos(elements.i),
  ];
  // Tip down toward the plane's normal, a little short of face-on for depth.
  const faceOn = Math.atan2(
    normal[2],
    normal[0] * Math.cos(phi) + normal[1] * Math.sin(phi),
  );
  const sun = sunDirection(time);
  const { innerWidth: width, innerHeight: height } = window;
  const room = width / 2 - (width >= 720 ? PANEL_ROOM : 16);
  return {
    ...TYPE_POSES.tli,
    zoom: Math.max(
      40,
      ((Math.hypot(...meet) + 4) * frameHalf(width, height)) /
        Math.max(room, 120),
    ),
    elevation: Math.min(65 * DEG, Math.max(20 * DEG, faceOn - 20 * DEG)),
    azimuth: phi - Math.atan2(sun[1], sun[0]),
  };
}

/** The live sky, full screen: every group propagated from a CelesTrak
 * snapshot under the real Sun and Moon, with presets that roam from low
 * orbit out to the Moon and the Sun–Earth L1/L2 points. */
export function OrbitView({
  lang,
  children,
}: {
  lang: Language;
  children?: ReactNode;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const stage = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const tape = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLInputElement>(null);
  const [anchor] = useState(() => Date.now());
  // A shared link (lib/share.ts) sets the opening state instead of the intro.
  const [shared] = useState(() =>
    readHash(
      window.location.hash,
      Object.keys(defaultLayers(true)) as LayerId[],
    ),
  );
  const [defaults] = useState(() =>
    defaultLayers(!window.matchMedia('(pointer: coarse)').matches),
  );
  const fromLink = Object.keys(shared).length > 0;
  const linkFocus: Focus =
    shared.focus && shared.focus in POSES
      ? (shared.focus as Focus)
      : 'overview';
  // Simulation clock: `sim` at wall time `real`, advancing at `speed`.
  // `live` is the "now" mode: real-time speed, pinned to the present until
  // the tape is moved or another speed is chosen.
  const clock = useRef({
    sim: shared.time === undefined ? anchor : clamp(shared.time, anchor),
    real: anchor,
    speed: DEFAULT_SPEED,
    // A linked instant opens paused, exactly as shared.
    playing: shared.time === undefined,
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
  const tween = useRef<Tween>(
    still(
      shared.camera
        ? { ...POSES[linkFocus], ...shared.camera, fitMoon: 0 }
        : fromLink
          ? POSES[linkFocus]
          : INTRO_POSE,
    ),
  );
  // A linked camera must not be replaced by the preset's own on mount.
  const skipFocusTween = useRef(fromLink);
  // Camera drag: active pointers, and the spin left after release (rad/ms).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const spin = useRef({ azimuth: 0, elevation: 0, at: 0 });
  const pinch = useRef<number | null>(null);
  // Opening sequence: starts once the scene is ready; null until then.
  const intro = useRef<{ start: number | null; done: boolean }>({
    start: null,
    done: fromLink,
  });
  const sceneRef = useRef<OrbitScene | null>(null);
  const invalidate = useRef(() => {});
  const text = useRef(sceneText(lang));
  const [focus, setFocus] = useState<Focus>(linkFocus);
  const focusRef = useRef(focus);
  const [playing, setPlaying] = useState(shared.time === undefined);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [live, setLive] = useState(false);
  const [help, setHelp] = useState(false);
  // Bloom and an open layer panel only by default where there is room and,
  // for bloom, a GPU that is probably up to it.
  const [layers, setLayers] = useState<Layers>(() => ({
    ...defaults,
    ...shared.layers,
  }));
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 720);
  const layersRef = useRef(layers);
  // Usually built before the view mounts.
  const [counts, setCounts] = useState(() => readyOrbitStage()?.counts ?? null);
  const [fetched, setFetched] = useState(
    () => readyOrbitStage()?.fetched ?? null,
  );
  const [status, setStatus] = useState<
    'idle' | 'ready' | 'failed' | 'unsupported'
  >(() => (readyOrbitStage() ? 'ready' : 'idle'));
  // --- Selection, search and passes ----------------------------------------
  const [fleet, setFleet] = useState<Fleet | null>(
    () => readyOrbitStage()?.fleet ?? null,
  );
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [model, setModel] = useState<Precise | null>(null);
  const [passesOpen, setPassesOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const selectedRef = useRef<CatalogEntry | null>(null);
  const selection = useRef<Selection | null>(null);
  // The pointer over the scene (CSS px in the stage), and what it is over.
  const hover = useRef<{ x: number; y: number } | null>(null);
  const hovered = useRef<{ index: number; label: string } | null>(null);
  const press = useRef<{
    x: number;
    y: number;
    at: number;
    editing: boolean;
  } | null>(null);
  // A click on empty sky hides every control; another brings them back.
  const [chromeHidden, setChromeHidden] = useState(false);
  // Typing a time into the clock: whether to play on afterwards.
  const editing = useRef<{ resume: boolean } | null>(null);
  const [timeInvalid, setTimeInvalid] = useState(false);
  const side = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const insetRight = useRef(0);
  const catalogRef = useRef<Catalog | null>(null);
  const fleetRef = useRef<Fleet | null>(fleet);
  // --- Learn panel ----------------------------------------------------------
  const [learnOpen, setLearnOpen] = useState(false);
  const [orbitType, setOrbitType] = useState<OrbitTypeId | null>(null);
  const [families, setFamilies] = useState<ReturnType<typeof classify> | null>(
    null,
  );
  const [demo, setDemo] = useState<Elements>(DEMO_START);
  const [demoShown, setDemoShown] = useState(false);
  const focusMask = useRef<Uint8Array | null>(null);
  const focusTarget = useRef(0);
  const example = useRef<SceneView['example']>(null);
  // The trip to the Moon shown for the transfer family, from when it was picked.
  const transfer = useRef<ReturnType<typeof lunarTransfer> | null>(null);

  useEffect(() => {
    text.current = sceneText(lang);
    invalidate.current();
  }, [lang]);
  useEffect(() => {
    layersRef.current = layers;
    invalidate.current();
  }, [layers]);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  /** Fetch catalog.json once, the first time anything needs a name. */
  const ensureCatalog = () => {
    const current = fleetRef.current;
    if (!current) return Promise.resolve(null);
    if (catalogRef.current) return Promise.resolve(catalogRef.current);
    return loadCatalog(current).then(
      (loaded) => {
        catalogRef.current = loaded;
        setCatalog(loaded);
        return loaded;
      },
      () => null,
    );
  };
  const select = (entry: CatalogEntry | null) => {
    selectedRef.current = entry;
    setSelected(entry);
    setModel(null);
    const current = fleetRef.current;
    if (!entry || !current) return;
    precise(current, entry).then(
      (next) => {
        if (selectedRef.current === entry) setModel(next);
      },
      () => {},
    );
  };
  // What the scene draws for the selection: SGP4 once loaded, the fast
  // propagator until then.
  useEffect(() => {
    const current = fleetRef.current;
    if (!selected || !current) {
      selection.current = null;
      invalidate.current();
      return;
    }
    const out = new Float32Array(3);
    const fast = (time: number) => {
      positionAt(current, selected.index, time, out, 0);
      return [out[0], out[1], out[2]];
    };
    selection.current = {
      index: selected.index,
      // One colour for whatever is selected, so it stands out from its group.
      color: '#9ff0c8',
      label: selected.name,
      position: model ? (time) => model.position(time) : fast,
      period:
        model?.period ?? 86400000 / current.elements[selected.index * 7 + 1],
    };
    invalidate.current();
  }, [selected, model]);

  /** Glide the camera to `target` from wherever it is, the short way round. */
  const tweenTo = (target: Pose, duration: number) => {
    const now = frameClock();
    intro.current.done = true;
    spin.current = { azimuth: 0, elevation: 0, at: 0 };
    const current = poseAt(tween.current, now);
    current.azimuth =
      target.azimuth +
      ((((current.azimuth - target.azimuth) % (2 * Math.PI)) + 3 * Math.PI) %
        (2 * Math.PI)) -
      Math.PI;
    tween.current = {
      from: current,
      to: target,
      start: now,
      duration: reducedMotion() ? 1 : duration,
    };
    invalidate.current();
  };

  // Count the orbit families once, the first time the panel opens.
  useEffect(() => {
    if (!learnOpen || families || !fleet) return;
    const timer = window.setTimeout(() => setFamilies(classify(fleet)), 0);
    return () => window.clearTimeout(timer);
  }, [learnOpen, families, fleet]);
  const chooseType = (id: OrbitTypeId | null) => {
    setOrbitType(id);
    if (!id) return;
    setDemoShown(false);
    if (id === 'tli') {
      // Five days of flight: run the clock fast enough to watch it.
      if (!reducedMotion())
        setClock({ speed: 3600, playing: true, live: false });
      const now = simTime();
      transfer.current = lunarTransfer(now);
      tweenTo(transferPose(transfer.current, now), 2200);
      return;
    }
    tweenTo(TYPE_POSES[id], 1800);
  };
  // The family's members stand out in the scene, with its example orbit.
  useEffect(() => {
    focusMask.current =
      orbitType && families ? families.masks[orbitType] : null;
    sceneRef.current?.setFocus(focusMask.current);
    focusTarget.current = orbitType ? 1 : 0;
    const type = ORBIT_TYPES.find(({ id }) => id === orbitType);
    if (demoShown) {
      example.current = {
        elements: demo,
        label: lang === 'en' ? 'Demo orbit' : '演示轨道',
        color: EXAMPLE_COLOR,
      };
    } else if (type?.id === 'tli' && transfer.current) {
      const { elements, arrive, depart } = transfer.current;
      const date = utc(arrive).slice(5, 16);
      example.current = {
        elements,
        label: lang === 'en' ? type.en : type.zh,
        color: EXAMPLE_COLOR,
        transfer: {
          depart,
          arrive,
          arrival:
            lang === 'en'
              ? `Moon arrives ${date} UTC`
              : `月球 ${date} UTC 到达此处`,
        },
      };
    } else if (type) {
      // Turn the example's plane square to the camera: its node line runs
      // across the screen.
      const pose = TYPE_POSES[type.id];
      // The Sun moves a degree a day: the clock's last set time is close enough.
      const sun = sunDirection(clock.current.sim);
      const raan = Math.atan2(sun[1], sun[0]) + pose.azimuth + Math.PI / 2;
      example.current = {
        elements: { ...type.example, raan },
        label: lang === 'en' ? type.en : type.zh,
        color: EXAMPLE_COLOR,
      };
    } else example.current = null;
    invalidate.current();
  }, [orbitType, families, demoShown, demo, lang]);
  const closeLearn = () => {
    setLearnOpen(false);
    setOrbitType(null);
    setDemoShown(false);
  };

  /** Select a pass's satellite and run the clock through the pass at 60×,
   * starting half a minute early. */
  const playPass = (pass: Pass, observer: Observer) => {
    const entry = catalogRef.current?.byNorad.get(pass.norad);
    if (entry && selectedRef.current?.norad !== pass.norad) select(entry);
    setClock({
      sim: pass.start.time - 30000,
      speed: 60,
      playing: true,
      live: false,
    });
    // Turn the camera to look down on the observer at mid-pass. Its
    // azimuth is measured from the Sun's meridian (see SceneView).
    const middle = (pass.start.time + pass.end.time) / 2;
    const site = groundPoint(observer.latitude, observer.longitude, middle);
    const sun = sunDirection(middle);
    tweenTo(
      {
        ...POSES.leo,
        zoom: 1.7,
        azimuth: Math.atan2(site[1], site[0]) - Math.atan2(sun[1], sun[0]),
        elevation: Math.max(
          -ELEVATION_LIMIT,
          Math.min(ELEVATION_LIMIT, observer.latitude * DEG),
        ),
      },
      1800,
    );
    // The preset buttons show near-Earth, without re-running its own tween.
    if (focus !== 'leo') {
      skipFocusTween.current = true;
      setFocus('leo');
    }
  };
  /** Put the current view in the URL and copy the link. */
  const share = () => {
    const scene = sceneRef.current;
    // Where the camera is, or is heading if a transition is under way.
    const pose = poseAt(tween.current, Number.POSITIVE_INFINITY);
    const hash = writeHash({
      time: simTime(),
      camera: {
        azimuth: pose.azimuth,
        elevation: pose.elevation,
        zoom: scene?.camera()?.zoom ?? pose.zoom,
      },
      focus,
      norad: selected?.norad ?? null,
      layers,
      defaults,
    });
    window.history.replaceState(null, '', hash);
    const url = window.location.href;
    const done = (copied: boolean) => {
      setShareNote(
        copied
          ? t('Link copied', '链接已复制')
          : t('Link is in the address bar', '链接已写入地址栏'),
      );
      window.setTimeout(() => setShareNote(null), 2200);
    };
    if (navigator.clipboard)
      navigator.clipboard.writeText(url).then(
        () => done(true),
        () => done(false),
      );
    else done(false);
  };
  // A link describes one moment: the first interaction after it was opened
  // (or shared) drops the hash, so a reload starts fresh, with the intro.
  useEffect(() => {
    if (!fromLink && !shareNote) return;
    const clear = () => {
      if (window.location.hash)
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
    };
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', clear, { once: true });
      window.addEventListener('wheel', clear, { once: true });
    }, 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', clear);
      window.removeEventListener('wheel', clear);
    };
  }, [fromLink, shareNote]);

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
    setSpeed(clock.current.speed);
    invalidate.current();
  };
  const backToNow = () =>
    setClock({
      sim: Date.now(),
      real: Date.now(),
      speed: 1,
      live: true,
      playing: true,
    });
  const togglePlay = () => setClock({ playing: !clock.current.playing });
  const step = (ms: number) => setClock({ sim: simTime() + ms, live: false });
  // Editing the clock pauses it; a valid time within the tape is applied on
  // Enter or blur, anything else is dropped.
  const typedTime = (value: string) => {
    const time = parseUtc(value);
    return time !== null && time === clamp(time, anchor) ? time : null;
  };
  const startEdit = () => {
    if (editing.current) return;
    editing.current = { resume: clock.current.playing };
    setClock({ playing: false, live: false });
  };
  const endEdit = (apply: boolean) => {
    const field = readout.current;
    const state = editing.current;
    if (!field || !state) return;
    editing.current = null;
    const time = apply ? typedTime(field.value) : null;
    setTimeInvalid(false);
    setClock({
      ...(time === null ? {} : { sim: time }),
      playing: state.resume,
    });
    field.value = `${utc(simTime())} UTC`;
  };

  // --- Camera ---------------------------------------------------------------
  /** The pose on screen now, frozen: user input takes over from any tween. */
  const holdPose = () => {
    const pose = poseAt(tween.current, performance.now());
    // A preset that fits the Moon hands over its fitted zoom.
    const camera = sceneRef.current?.camera();
    if (pose.fitMoon > 0 && camera) {
      pose.zoom = camera.zoom;
      pose.fitMoon = 0;
    }
    tween.current = still(pose);
    return pose;
  };
  const rotate = (dAzimuth: number, dElevation: number) => {
    const pose = holdPose();
    pose.azimuth += dAzimuth;
    pose.elevation = Math.max(
      -ELEVATION_LIMIT,
      Math.min(ELEVATION_LIMIT, pose.elevation + dElevation),
    );
    invalidate.current();
  };
  const zoomBy = (factor: number) => {
    const pose = holdPose();
    pose.zoom = Math.max(
      ZOOM_RANGE[0],
      Math.min(ZOOM_RANGE[1], pose.zoom * factor),
    );
    invalidate.current();
  };
  const go = (next: Focus) => {
    intro.current.done = true;
    setFocus(next);
  };

  useEffect(() => {
    // The opening tween is set up when the scene becomes ready.
    if (!intro.current.done) return;
    if (skipFocusTween.current) {
      skipFocusTween.current = false;
      return;
    }
    const now = performance.now();
    const current = poseAt(tween.current, now);
    const target = POSES[focus];
    // Unwind any spin to the nearest turn, so the camera takes the short way.
    current.azimuth =
      target.azimuth +
      ((((current.azimuth - target.azimuth) % (2 * Math.PI)) + 3 * Math.PI) %
        (2 * Math.PI)) -
      Math.PI;
    const span = Math.abs(Math.log(target.zoom / current.zoom));
    spin.current = { azimuth: 0, elevation: 0, at: 0 };
    tween.current = {
      from: current,
      to: target,
      start: now,
      duration: reducedMotion() ? 1 : Math.min(2600, 900 + 420 * span),
    };
    invalidate.current();
  }, [focus]);

  // Grab the camera and turn it; two fingers pinch to zoom.
  const grabStage = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest(
        'button, a, input, select, .orbit-key, .orbit-side',
      )
    )
      return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (synthetic events): no capture, still usable.
    }
    press.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      // This press only ends the time edit (by blurring the field).
      editing: document.activeElement === readout.current,
    };
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    spin.current = { azimuth: 0, elevation: 0, at: performance.now() };
    pinch.current = null;
    intro.current.done = true;
  };
  const moveStage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) {
      // Hovering: the frame loop picks the satellite under the pointer.
      if (event.pointerType !== 'mouse') return;
      if ((event.target as HTMLElement).closest('.orbit-key, .orbit-side')) {
        hover.current = null;
      } else {
        const box = event.currentTarget.getBoundingClientRect();
        hover.current = {
          x: event.clientX - box.left,
          y: event.clientY - box.top,
        };
        void ensureCatalog();
      }
      invalidate.current();
      return;
    }
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) zoomBy(pinch.current / Math.max(1, distance));
      pinch.current = distance;
      return;
    }
    const dAzimuth = -(next.x - previous.x) * DRAG;
    const dElevation = (next.y - previous.y) * DRAG;
    rotate(dAzimuth, dElevation);
    const now = performance.now();
    const elapsed = Math.max(8, now - spin.current.at);
    // Smoothed angular speed, for the spin after release.
    spin.current = {
      azimuth: spin.current.azimuth * 0.5 + (dAzimuth / elapsed) * 0.5,
      elevation: spin.current.elevation * 0.5 + (dElevation / elapsed) * 0.5,
      at: now,
    };
  };
  const releaseStage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wasDown = pointers.current.delete(event.pointerId);
    pinch.current = null;
    // A short press without movement is a click: select what is under it.
    const down = press.current;
    press.current = null;
    if (
      wasDown &&
      down &&
      event.type === 'pointerup' &&
      pointers.current.size === 0 &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5 &&
      performance.now() - down.at < 500
    ) {
      const box = event.currentTarget.getBoundingClientRect();
      const index =
        sceneRef.current?.pick(
          event.clientX - box.left,
          event.clientY - box.top,
          event.pointerType === 'mouse' ? 14 : 26,
        ) ?? -1;
      if (index < 0) {
        if (!down.editing) setChromeHidden((hidden) => !hidden);
      } else
        void ensureCatalog().then(
          (loaded) => loaded && select(loaded.entries[index]),
        );
      spin.current = { azimuth: 0, elevation: 0, at: 0 };
      return;
    }
    // A pause before letting go means no spin.
    if (reducedMotion() || performance.now() - spin.current.at > 90)
      spin.current = { azimuth: 0, elevation: 0, at: 0 };
    else spin.current.at = performance.now();
    invalidate.current();
  };

  // --- Time tape --------------------------------------------------------------
  // Grab the tape and pull it: dragging right goes back in time.
  const grab = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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
  const pull = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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
    // A flick coasts at most about half a day (velocity × 320 ms decay).
    const velocity = Math.max(
      -GLIDE_LIMIT,
      Math.min(GLIDE_LIMIT, state.velocity),
    );
    if (!reducedMotion() && Math.abs(velocity) > MS_PER_PX / 20)
      glide.current = { velocity, at: performance.now(), resume: state.resume };
    else setClock({ playing: state.resume });
  };

  const toggleLayer = (id: LayerId) =>
    setLayers((current) => ({ ...current, [id]: !current[id] }));
  const setAllLayers = (on: boolean) =>
    setLayers((current) => {
      const next = { ...current };
      for (const id of Object.keys(next) as LayerId[]) next[id] = on;
      return next;
    });

  // --- Keyboard ---------------------------------------------------------------
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target =
        event.target instanceof Element ? event.target : document.body;
      if (help) {
        if (event.key === 'Escape' || event.key === '?') {
          event.preventDefault();
          setHelp(false);
        }
        return;
      }
      // Keys typed into a field, or arrows on the time slider, stay there.
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      const preset = '1234'.indexOf(event.key);
      if (preset >= 0) go(PRESETS[preset]);
      else if (event.key === '0') go('overview');
      else if (event.key === ' ') {
        if (target.closest('button')) return;
        togglePlay();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        step(
          (event.key === 'ArrowLeft' ? -1 : 1) *
            (event.shiftKey ? 6 * 3600000 : 600000),
        );
      else if (event.key === 'n' || event.key === 'N') backToNow();
      else if (event.key === 'l' || event.key === 'L')
        setPanelOpen((open) => !open);
      else if (event.key === '+' || event.key === '=') zoomBy(1 / 1.25);
      else if (event.key === '-' || event.key === '_') zoomBy(1.25);
      else if (event.key === '?') setHelp(true);
      else if (event.key === 'Escape') {
        if (learnOpen) closeLearn();
        else if (passesOpen) setPassesOpen(false);
        else if (selectedRef.current) select(null);
        else return;
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  // --- Frame loop -------------------------------------------------------------
  useEffect(() => {
    if (reducedMotion())
      clock.current = { ...clock.current, playing: false, speed: 1 };
    setPlaying(clock.current.playing);
    setSpeed(clock.current.speed);
    const box = stage.current;
    const ruler = tape.current;
    const rulerContext = ruler?.getContext('2d');
    if (!box || !ruler || !rulerContext) return;
    const font =
      getComputedStyle(ruler).getPropertyValue('--font-mono').trim() ||
      'monospace';
    let rulerSize = { width: 1, height: 1, dpr: 1 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let attached: OrbitStage | null = null;
    let disposed = false;
    // Layer weights ease toward their switches; `previous` times the easing.
    const weights = {} as Record<LayerId, number>;
    for (const [id, on] of Object.entries(layersRef.current))
      weights[id as LayerId] = on ? 1 : 0;
    let previous = performance.now();
    let focusWeight = 0;
    let settlingFocus = false;
    // Bloom is dropped if the first frames are slow.
    const frameTimes: number[] = [];
    let bloomChecked = false;

    const paint = (now: number) => {
      const dt = Math.min(100, now - previous);
      previous = now;
      const scene = sceneRef.current;

      // Opening sequence, once the scene can draw it.
      const opening = intro.current;
      if (scene && opening.start === null && !opening.done) {
        if (reduced.matches) {
          opening.done = true;
          tween.current = still(POSES.overview);
        } else {
          opening.start = now;
          tween.current = {
            from: INTRO_POSE,
            to: POSES.overview,
            start: now,
            duration: INTRO_MS,
          };
        }
      }
      const progress =
        opening.start === null
          ? opening.done
            ? 1
            : 0
          : Math.min(1, (now - opening.start) / INTRO_MS);
      const introAt = opening.done ? 1 : progress;
      if (progress >= 1) opening.done = true;

      // Spin left over from a camera drag.
      const turn = spin.current;
      if (pointers.current.size === 0 && (turn.azimuth || turn.elevation)) {
        rotate(turn.azimuth * dt, turn.elevation * dt);
        const decay = Math.exp(-dt / 420);
        turn.azimuth *= decay;
        turn.elevation *= decay;
        if (Math.abs(turn.azimuth) + Math.abs(turn.elevation) < 2e-6)
          spin.current = { azimuth: 0, elevation: 0, at: 0 };
      }

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
      if (clock.current.playing && time > anchor + SPAN) {
        clock.current = {
          ...clock.current,
          sim: anchor + SPAN,
          playing: false,
        };
        setPlaying(false);
        time = anchor + SPAN;
      }

      // Layer weights: a fifth of a second to fade.
      const blend = reduced.matches ? 1 : 1 - Math.exp(-dt / 180);
      focusWeight += (focusTarget.current - focusWeight) * blend;
      if (Math.abs(focusTarget.current - focusWeight) < 0.002)
        focusWeight = focusTarget.current;
      else settlingFocus = true;
      let settling = settlingFocus;
      settlingFocus = false;
      for (const [id, on] of Object.entries(layersRef.current)) {
        const key = id as LayerId;
        const target = on ? 1 : 0;
        weights[key] += (target - weights[key]) * blend;
        if (Math.abs(target - weights[key]) < 0.002) weights[key] = target;
        else settling = true;
      }
      const pose = poseAt(tween.current, now);
      const view: SceneView = {
        time,
        ...pose,
        trails: pose.trails * weights.trails * ramp(introAt, 0.7, 0.95),
        receiver: pose.receiver * weights.receivers * ramp(introAt, 0.7, 0.95),
        groups: GROUP_LAYER.map(
          (id, index) => weights[id] * introGroup[index](introAt),
        ),
        lights: weights.lights * ramp(introAt, 0.15, 0.45),
        recent: weights.highlight * ramp(introAt, 0.85, 1),
        halo: weights.halo * ramp(introAt, 0.5, 0.75),
        bloom: weights.bloom * 0.9,
        selected: selection.current,
        hovered: hovered.current,
        insetRight: insetRight.current,
        focus: focusWeight,
        example: example.current,
      };
      scene?.render(view, reduced.matches ? 0 : now, text.current);
      // What is under the mouse, for the next frame: the scene picks from the
      // positions it has just drawn.
      const point = hover.current;
      const index =
        scene && point && pointers.current.size === 0
          ? scene.pick(point.x, point.y)
          : -1;
      const label =
        index >= 0 ? (catalogRef.current?.entries[index]?.name ?? '') : '';
      if (
        index !== (hovered.current?.index ?? -1) ||
        label !== (hovered.current?.label ?? '')
      ) {
        hovered.current = index >= 0 ? { index, label } : null;
        box.dataset.hover = index >= 0 ? 'satellite' : '';
        loop.invalidate();
      }
      if (settling || !opening.done || turn.azimuth || turn.elevation)
        loop.invalidate();

      // Watch the first two seconds of frames: if they average under ~40
      // fps with bloom on, turn bloom off.
      if (
        scene &&
        !bloomChecked &&
        layersRef.current.bloom &&
        !reduced.matches
      ) {
        frameTimes.push(dt);
        if (frameTimes.length >= 120) {
          bloomChecked = true;
          const sorted = frameTimes.slice(10).sort((a, b) => a - b);
          if (sorted[Math.floor(sorted.length / 2)] > 25)
            setLayers((current) => ({ ...current, bloom: false }));
        }
      }

      if (readout.current && document.activeElement !== readout.current)
        readout.current.value = `${utc(time)} UTC`;
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
      sceneRef.current?.resize(
        Math.max(1, box.clientWidth),
        Math.max(1, box.clientHeight),
        dpr,
      );
      loop.invalidate();
    };
    // The stage lives for the whole visit (lib/orbit-stage.ts): attach its
    // canvases on mount and only detach them on unmount.
    const rebuilt = () => {
      sceneRef.current = attached?.scene ?? null;
      sceneRef.current?.setFocus(focusMask.current);
      resize();
    };
    // Development only: lets the browser console time and inspect the scene.
    if (import.meta.env.DEV)
      Object.assign(window, { __orbitScene: () => sceneRef.current });
    const attach = (next: OrbitStage) => {
      if (disposed) return;
      attached = next;
      box.insertBefore(next.overlay, box.firstChild);
      box.insertBefore(next.canvas, next.overlay);
      next.rebuilt.add(rebuilt);
      rebuilt();
      fleetRef.current = next.fleet;
      setFleet(next.fleet);
      // A linked satellite is selected once the catalogue is in.
      if (shared.norad)
        void ensureCatalog().then((loaded) => {
          const entry = loaded?.byNorad.get(shared.norad ?? 0);
          if (entry) select(entry);
        });
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
      sceneRef.current = null;
    };
    const ready = readyOrbitStage();
    if (ready) attach(ready);
    else
      loadOrbitStage().then(attach, () => {
        if (!disposed)
          setStatus(orbitStageUnsupported() ? 'unsupported' : 'failed');
      });
    // Panels docked on the right push the lunar close-up left.
    const measureSide = () => {
      const panel = side.current;
      insetRight.current =
        panel && box.clientWidth > 760 ? panel.offsetWidth + 12 : 0;
      loop.invalidate();
    };
    // The floating dock's height, for the panels that must stop above it.
    const measureDock = () => {
      const bar = dock.current;
      bar?.parentElement?.style.setProperty(
        '--dock-h',
        `${bar.offsetHeight}px`,
      );
    };
    const observer = new ResizeObserver(() => {
      resize();
      measureSide();
      measureDock();
    });
    observer.observe(box);
    if (side.current) observer.observe(side.current);
    if (dock.current) observer.observe(dock.current);
    observer.observe(ruler);
    // Sideways trackpad swipes (or shift + wheel) scroll the tape.
    const tapeWheel = (event: WheelEvent) => {
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
    // The wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms.
    const stageWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('.orbit-key, .orbit-side'))
        return;
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      intro.current.done = true;
      zoomBy(Math.exp(delta * (event.ctrlKey ? 0.01 : 0.0015)));
    };
    ruler.addEventListener('wheel', tapeWheel, { passive: false });
    box.addEventListener('wheel', stageWheel, { passive: false });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true;
      loop.dispose();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      ruler.removeEventListener('wheel', tapeWheel);
      box.removeEventListener('wheel', stageWheel);
      detach();
    };
  }, [anchor, shared]);

  const presets = [
    {
      id: 'leo' as const,
      Icon: Satellite,
      en: 'Low Earth orbit',
      zh: '近地轨道',
      short: ['LEO', '近地'],
      meta: 'STARLINK · ISS · CSS',
    },
    {
      id: 'gnss' as const,
      Icon: Orbit,
      en: 'GNSS & GEO',
      zh: '中高轨道',
      short: ['GNSS·GEO', '中高轨'],
      meta: 'GPS · BEIDOU · GEO BELT',
    },
    {
      id: 'moon' as const,
      Icon: Moon,
      en: 'Earth–Moon',
      zh: '地月空间',
      short: ['Moon', '地月'],
      meta: 'CISLUNAR · GNSS SPILLOVER',
    },
    {
      id: 'deep' as const,
      Icon: Radar,
      en: 'Sun–Earth L1 · L2',
      zh: '日地 L1 · L2',
      short: ['L1·L2', '日地'],
      meta: 'SOHO · JWST · EUCLID',
    },
  ];

  return (
    <div
      className="orbit-map"
      data-focus={focus}
      data-chrome={chromeHidden ? 'hidden' : undefined}
    >
      <div
        className="orbit-map-stage"
        ref={stage}
        data-status={status}
        onPointerDown={grabStage}
        onPointerMove={moveStage}
        onPointerUp={releaseStage}
        onPointerCancel={releaseStage}
        onPointerLeave={() => {
          hover.current = null;
          invalidate.current();
        }}
      >
        <LayerPanel
          lang={lang}
          layers={layers}
          counts={counts}
          fetched={fetched}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          onToggle={toggleLayer}
          onSetAll={setAllLayers}
        />
        <Freshness lang={lang} />
        <div className="orbit-side" ref={side}>
          <SearchBox
            lang={lang}
            catalog={catalog}
            onOpen={() => void ensureCatalog()}
            onPick={select}
          />
          {selected && fleet && (
            <InfoCard
              lang={lang}
              entry={selected}
              fleet={fleet}
              precise={model}
              simTime={simTime}
              onClose={() => select(null)}
              onPasses={() => setPassesOpen(true)}
            />
          )}
          {passesOpen && fleet && (
            <PassPanel
              lang={lang}
              fleet={fleet}
              catalog={catalog}
              selected={selected}
              simTime={simTime}
              onClose={() => setPassesOpen(false)}
              onPlay={playPass}
            />
          )}
          {learnOpen && (
            <LearnPanel
              lang={lang}
              counts={families?.counts ?? null}
              active={orbitType}
              onType={chooseType}
              elements={demo}
              onElements={setDemo}
              showing={demoShown}
              onShow={(show) => {
                setDemoShown(show);
                if (show) setOrbitType(null);
                // Step back far enough to see the whole orbit.
                const reach = apsides(demo)[1] / EARTH_RADIUS_KM + 1;
                if (
                  show &&
                  reach > (sceneRef.current?.camera()?.zoom ?? 0) * 0.8
                )
                  tweenTo({ ...holdPose(), zoom: reach * 1.25 }, 1400);
              }}
              onClose={closeLearn}
            />
          )}
        </div>
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
      <div className="orbit-dock" ref={dock}>
        <div className="orbit-timeline">
          <button
            type="button"
            className="orbit-play"
            aria-label={playing ? t('Pause', '暂停') : t('Play', '播放')}
            onClick={togglePlay}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <div className="orbit-speeds">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={!live && speed === value}
                onClick={() =>
                  setClock({ speed: value, live: false, playing: true })
                }
              >
                {value}×
              </button>
            ))}
          </div>
          <button
            type="button"
            className="orbit-now"
            data-live={live || undefined}
            data-paused={!playing || undefined}
            aria-pressed={live}
            onClick={backToNow}
            title={t('Back to now (N)', '回到现在（N）')}
          >
            <i aria-hidden="true" />
            {live ? t('Now', '此刻') : t('Back to now', '回到现在')}
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
          <input
            ref={readout}
            className="orbit-clock"
            type="text"
            inputMode="numeric"
            spellCheck={false}
            autoComplete="off"
            aria-label={t('Time (UTC)', '时间（UTC）')}
            aria-invalid={timeInvalid || undefined}
            onFocus={startEdit}
            onChange={(event) => {
              startEdit();
              setTimeInvalid(typedTime(event.currentTarget.value) === null);
            }}
            onBlur={() => endEdit(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (typedTime(event.currentTarget.value) === null) return;
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                endEdit(false);
                event.currentTarget.blur();
              }
            }}
          />
          <button
            type="button"
            className="orbit-icon-button"
            aria-label={t('Learn about orbits', '轨道科普')}
            title={t(
              'Orbit types and the six elements',
              '轨道类型与轨道六根数',
            )}
            aria-pressed={learnOpen}
            onClick={() => (learnOpen ? closeLearn() : setLearnOpen(true))}
          >
            <GraduationCap size={15} />
          </button>
          <button
            type="button"
            className="orbit-icon-button"
            aria-label={t('Visible passes', '可见过境预报')}
            title={t('Visible passes over you', '你所在地的可见过境')}
            aria-pressed={passesOpen}
            onClick={() => {
              void ensureCatalog();
              setPassesOpen((open) => !open);
            }}
          >
            <Telescope size={15} />
          </button>
          <button
            type="button"
            className="orbit-icon-button"
            aria-label={t('Copy a link to this view', '复制当前视图的链接')}
            title={t('Share this view', '分享当前视图')}
            onClick={share}
          >
            <Link2 size={15} />
          </button>
          {shareNote && (
            <output className="orbit-share-note">{shareNote}</output>
          )}
          <button
            type="button"
            className="orbit-help-button"
            aria-label={t('Keyboard shortcuts', '快捷键')}
            title={t('Keyboard shortcuts (?)', '快捷键（?）')}
            onClick={() => setHelp(true)}
          >
            <Keyboard size={15} />
          </button>
        </div>
        <ul className="orbit-legend">
          {presets.map(({ id, Icon, en, zh, short, meta }, index) => (
            <li key={id} data-focused={focus === id || undefined}>
              <button
                type="button"
                aria-pressed={focus === id}
                aria-keyshortcuts={String(index + 1)}
                onClick={() => go(focus === id ? 'overview' : id)}
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
                <kbd aria-hidden="true">{index + 1}</kbd>
              </button>
            </li>
          ))}
        </ul>
        {children}
      </div>
      {help && <ShortcutHelp lang={lang} onClose={() => setHelp(false)} />}
    </div>
  );
}
