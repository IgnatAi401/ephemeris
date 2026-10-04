import type { CSSProperties } from 'react';
import { Clapperboard, Crosshair, Globe2, Moon, Rocket, X } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import {
  FRAMES,
  MISSIONS,
  type FrameId,
  type Mission,
  type Shot,
} from '@/lib/missions';

export type Telemetry = 'tplus' | 'earth' | 'moon' | 'speed';

/** "T+3 d 04:12" (or "T−…" before launch). */
export function tPlus(time: number, launch: number, lang: Language) {
  const delta = time - launch;
  const sign = delta < 0 ? '−' : '+';
  const total = Math.floor(Math.abs(delta) / 60000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return days
    ? `T${sign}${days}${lang === 'en' ? ' d ' : ' 天 '}${clock}`
    : `T${sign}${clock}`;
}

/** The historical missions: a list to pick from, then, while one replays,
 * its story so far, live distances, camera and frame choices, and its
 * events to jump between. */
export function MissionPanel({
  lang,
  mission,
  loading,
  failed,
  phase,
  event,
  frame,
  autopilot,
  shot,
  telemetry,
  onPick,
  onExit,
  onClose,
  onFrame,
  onAutopilot,
  onShot,
  onEvent,
}: {
  lang: Language;
  mission: Mission | null;
  loading: Mission['id'] | null;
  failed: boolean;
  /** Index of the current phase and of the last event passed (-1: none). */
  phase: number;
  event: number;
  frame: FrameId;
  autopilot: boolean;
  shot: Shot['aim'] | null;
  /** Receives the elements the frame loop writes the live readouts into. */
  telemetry: (key: Telemetry) => (element: HTMLElement | null) => void;
  onPick: (mission: Mission) => void;
  onExit: () => void;
  onClose: () => void;
  onFrame: (frame: FrameId) => void;
  onAutopilot: (on: boolean) => void;
  onShot: (aim: Shot['aim']) => void;
  onEvent: (index: number) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const pick = <T extends { en: string; zh: string }>(text: T) =>
    lang === 'en' ? text.en : text.zh;

  if (!mission)
    return (
      <section
        className="orbit-missions"
        aria-label={t('Missions', '历史任务')}
      >
        <header>
          <h2>
            <Rocket size={14} aria-hidden="true" />
            {t('Mission replays', '历史任务回放')}
          </h2>
          <button
            type="button"
            className="orbit-learn-close"
            onClick={onClose}
            aria-label={t('Close', '关闭')}
          >
            <X size={15} />
          </button>
        </header>
        <p className="orbit-learn-intro">
          {t(
            'Real trajectories reconstructed by JPL. Pick one to fly it again; drag the time tape to scrub through the whole mission.',
            '轨迹来自 JPL 的实测重建数据。选一个任务重新飞一遍，拖动下方时间轴可以浏览全程。',
          )}
        </p>
        <ul className="orbit-mission-list">
          {MISSIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item)}
                disabled={loading !== null}
                style={{ '--dot': item.color } as CSSProperties}
              >
                <i aria-hidden="true" />
                <strong>{pick(item)}</strong>
                <small>{pick(item.tagline)}</small>
                <span>
                  {loading === item.id ? t('Loading…', '加载中…') : item.agency}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {failed && (
          <p className="orbit-type-none">
            {t(
              'The trajectory could not be loaded. Please try again.',
              '轨迹数据加载失败，请重试。',
            )}
          </p>
        )}
      </section>
    );

  const current = mission.phases[Math.max(0, phase)];
  const launch = Date.parse(mission.launch);
  const shots: {
    aim: Shot['aim'];
    Icon: typeof Globe2;
    en: string;
    zh: string;
  }[] = [
    { aim: 'earth', Icon: Globe2, en: 'Whole path', zh: '全程' },
    { aim: 'moon', Icon: Moon, en: 'Moon', zh: '月球' },
    { aim: 'craft', Icon: Crosshair, en: 'Spacecraft', zh: '飞行器' },
  ];
  return (
    <section
      className="orbit-missions"
      aria-label={pick(mission)}
      style={{ '--dot': mission.color } as CSSProperties}
    >
      <header>
        <h2>
          <i aria-hidden="true" />
          {pick(mission)}
        </h2>
        <button
          type="button"
          className="orbit-mission-exit"
          onClick={onExit}
          title={t('Back to the live sky (N)', '返回实时星空（N）')}
        >
          {t('Exit', '退出')}
          <X size={13} aria-hidden="true" />
        </button>
      </header>
      <p className="orbit-mission-summary">{pick(mission.summary)}</p>

      <dl className="orbit-mission-readout">
        <div>
          <dt>{t('Mission time', '任务时间')}</dt>
          <dd ref={telemetry('tplus')} />
        </div>
        <div>
          <dt>{t('Speed (vs Earth)', '速度（相对地球）')}</dt>
          <dd ref={telemetry('speed')} />
        </div>
        <div>
          <dt>{t('Above Earth', '距地面')}</dt>
          <dd ref={telemetry('earth')} />
        </div>
        <div>
          <dt>{t('Above the Moon', '距月面')}</dt>
          <dd ref={telemetry('moon')} />
        </div>
      </dl>

      <div className="orbit-mission-phase">
        <small>
          {t('Phase', '阶段')} {Math.max(0, phase) + 1}/{mission.phases.length}
        </small>
        <strong>{pick(current)}</strong>
        <p>{pick(current.about)}</p>
      </div>

      <div className="orbit-mission-controls">
        <fieldset className="orbit-mission-shots">
          <legend>{t('Camera', '镜头')}</legend>
          {shots.map(({ aim, Icon, en, zh }) => (
            <button
              key={aim}
              type="button"
              aria-pressed={!autopilot && shot === aim}
              onClick={() => onShot(aim)}
            >
              <Icon size={13} aria-hidden="true" />
              {t(en, zh)}
            </button>
          ))}
          <button
            type="button"
            className="orbit-mission-auto"
            aria-pressed={autopilot}
            onClick={() => onAutopilot(!autopilot)}
            title={t(
              'Camera and speed follow the mission phases',
              '镜头和播放速度随任务阶段自动切换',
            )}
          >
            <Clapperboard size={13} aria-hidden="true" />
            {t('Auto', '自动')}
          </button>
        </fieldset>
        {mission.frames.length > 1 && (
          <fieldset className="orbit-mission-frames">
            <legend>{t('Reference frame', '参考系')}</legend>
            <div>
              {mission.frames.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={frame === id}
                  onClick={() => onFrame(id)}
                >
                  {pick(FRAMES[id])}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <ol className="orbit-mission-events">
        {mission.events.map((item, index) => {
          const at = Date.parse(item.at);
          return (
            <li key={item.at} data-done={index <= event || undefined}>
              <button type="button" onClick={() => onEvent(index)}>
                <time dateTime={item.at}>{tPlus(at, launch, lang)}</time>
                <strong>{pick(item)}</strong>
                {item.about && <small>{pick(item.about)}</small>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="orbit-mission-source">
        {mission.note && <>{pick(mission.note)} </>}
        {t('Trajectory', '轨迹')}: JPL Horizons ·{' '}
        {new Date(launch).toISOString().slice(0, 10)} {t('launch', '发射')} ·{' '}
        {mission.agency}
      </p>
    </section>
  );
}
