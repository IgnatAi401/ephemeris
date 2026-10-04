// Imported by scripts/check-missions.mjs too: types only from other modules.
import type { BodyKey } from '@/lib/planets';

// Historical missions for the replay mode. Each trajectory is a JPL Horizons
// reconstruction (scripts/fetch-missions.mjs → public/missions/<id>.json);
// the events and phases here are from the agencies' own timelines, checked
// against the data itself (closest approaches, record distances and burns
// show up in the vectors to the minute).

/** How the path is drawn. `earth`: geocentric, fixed stars (the true
 * motion). `moon`: centred on the Moon, so lunar orbits close on themselves.
 * `earthMoon`: turning with the Moon (Earth–Moon rotating frame), where
 * free returns trace a figure eight and DROs and NRHOs keep their shape.
 * `sunEarth`: turning with the Sun line, where an L2 halo orbit and a
 * ballistic lunar transfer show their loops. */
/** Interplanetary missions: `sun`, centred on the Sun, or centred on a
 * body met (`jupiter`, …), all in fixed ecliptic axes. */
export type FrameId =
  | 'earth'
  | 'moon'
  | 'earthMoon'
  | 'sunEarth'
  | 'sun'
  | Exclude<BodyKey, 'earth'>;
/** Names of the frames centred somewhere else than a body met; those are
 * named after the body (see mission-panel.tsx). */
export const FRAMES: Partial<Record<FrameId, { en: string; zh: string }>> = {
  earth: { en: 'Earth-centred', zh: '地心' },
  moon: { en: 'Moon-centred', zh: '月心' },
  earthMoon: { en: 'Earth–Moon rotating', zh: '地月旋转' },
  sunEarth: { en: 'Sun–Earth rotating', zh: '日地旋转' },
  sun: { en: 'Sun-centred', zh: '日心' },
};

/** What the camera looks at and how wide (Earth radii, as SceneView.zoom):
 * the whole path (`fit`), a body (the Moon unless `body` names a planet) or
 * the spacecraft. */
export type Shot = {
  aim: 'path' | 'body' | 'craft';
  zoom: number | 'fit';
  body?: BodyKey;
  /** Turn the camera to look down on the spacecraft from above the body
   * (a landing), instead of keeping its angles. */
  above?: boolean;
};
type Text = { en: string; zh: string };
export type MissionPhase = Text & {
  /** UTC; the first phase starts with the data. */
  from: string;
  about: Text;
  shot: Shot;
  /** Playback rate, simulated seconds per second. */
  speed: number;
  /** The frame the autopilot turns to (the mission's first otherwise). */
  frame?: FrameId;
};
export type MissionEvent = Text & { at: string; about?: Text };
export type Mission = {
  id:
    | 'artemis2'
    | 'artemis1'
    | 'chandrayaan3'
    | 'jwst'
    | 'capstone'
    | 'voyager2'
    | 'voyager1'
    | 'newhorizons'
    | 'cassini'
    | 'parker'
    | 'mars2020';
  /** Around the Sun rather than around Earth. */
  kind?: 'helio';
  en: string;
  zh: string;
  /** Short line for the mission list. */
  tagline: Text;
  summary: Text;
  launch: string;
  agency: string;
  color: string;
  /** One per track in the data file, in the same order. */
  craft: (Text & { color: string })[];
  frames: FrameId[];
  /** Where the trajectory data begins, when it is not at launch. */
  note?: Text;
  /** Show the Sun–Earth L1/L2 markers (0–1). */
  lagrange?: number;
  phases: MissionPhase[];
  events: MissionEvent[];
};

export type MissionId = Mission['id'];

export const MISSIONS: Mission[] = [
  {
    id: 'artemis2',
    en: 'Artemis II',
    zh: '阿尔忒弥斯 2 号',
    tagline: {
      en: '2026 · four astronauts around the Moon',
      zh: '2026 · 四名宇航员绕月飞行',
    },
    summary: {
      en: 'The first crew beyond low Earth orbit since Apollo 17 in 1972. Reid Wiseman, Victor Glover, Christina Koch and Jeremy Hansen flew Orion around the far side of the Moon and straight home, without entering lunar orbit: about nine days in all.',
      zh: '1972 年阿波罗 17 号之后，人类第一次飞出近地轨道。韦斯曼、格洛弗、科赫和汉森四名宇航员乘猎户座飞船绕过月球背面后直接返回，不进入环月轨道，全程约 9 天。',
    },
    launch: '2026-04-01T22:35:12Z',
    agency: 'NASA',
    color: '#ffb48a',
    craft: [{ en: 'Orion', zh: '猎户座', color: '#ffb48a' }],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Trajectory data begins about 3.5 hours after launch.',
      zh: '轨迹数据从发射后约 3.5 小时开始。',
    },
    phases: [
      {
        from: '2026-04-02T02:00Z',
        en: 'High Earth orbit',
        zh: '大椭圆地球轨道',
        about: {
          en: 'Orion first loops Earth on an orbit reaching about 70,000 km, while the crew spends a day checking life support, the toilet and manual piloting before committing to the Moon.',
          zh: '飞船先在远地点约 7 万 km 的大椭圆轨道上绕地球飞行。宇航员用将近一天检查生命保障、卫生设施和手动驾驶，确认无误后才奔向月球。',
        },
        shot: { aim: 'path', zoom: 16 },
        speed: 600,
      },
      {
        from: '2026-04-02T23:20Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: {
          en: 'Near perigee the service module fires for almost six minutes, adding the speed that will carry Orion out to the Moon.',
          zh: '在近地点附近，服务舱发动机点火近 6 分钟，给飞船加上飞往月球所需的速度。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
      {
        from: '2026-04-03T01:00Z',
        en: 'Outbound coast',
        zh: '奔月滑行',
        about: {
          en: 'Four days of coasting with only small correction burns. The path is a free return: if the engine failed, the Moon’s gravity alone would swing Orion back to Earth.',
          zh: '约四天的无动力滑行，只做几次小的轨道修正。这条路线是“自由返回轨道”：即使发动机失灵，月球引力也会把飞船甩回地球。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2026-04-06T14:00Z',
        en: 'Around the Moon',
        zh: '飞越月球',
        about: {
          en: 'Orion passes 6,545 km above the far side, out of contact with Earth for about 40 minutes, and reaches the farthest distance any human has travelled from Earth.',
          zh: '飞船从月球背面上空 6,545 km 处掠过，与地球失联约 40 分钟，并到达人类离地球最远的距离。',
        },
        shot: { aim: 'body', zoom: 6 },
        speed: 600,
      },
      {
        from: '2026-04-07T08:00Z',
        en: 'Homeward coast',
        zh: '返回地球',
        about: {
          en: 'The Moon has bent the path back toward Earth. Three more days of coasting and small corrections.',
          zh: '月球引力已经把轨道“掰”回地球方向。再滑行约三天，期间做几次小修正。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2026-04-10T19:00Z',
        en: 'Re-entry',
        zh: '再入大气层',
        about: {
          en: 'The crew module separates from the service module and hits the atmosphere at about 11 km/s. Splashdown in the Pacific off San Diego at 00:07 UTC on 11 April.',
          zh: '乘员舱与服务舱分离，以约 11 km/s 的速度冲入大气层，于 4 月 11 日 00:07 UTC 溅落在圣迭戈外海的太平洋上。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
    ],
    events: [
      {
        at: '2026-04-02T23:49Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: { en: '5 min 49 s burn', zh: '点火 5 分 49 秒' },
      },
      {
        at: '2026-04-06T23:01Z',
        en: 'Closest to the Moon',
        zh: '最接近月球',
        about: {
          en: '6,545 km above the far side',
          zh: '距月面 6,545 km（月球背面）',
        },
      },
      {
        at: '2026-04-06T23:05Z',
        en: 'Farthest humans have been',
        zh: '人类到达的最远距离',
        about: {
          en: '406,771 km from Earth, beating Apollo 13’s 1970 record',
          zh: '距地球 406,771 km，打破阿波罗 13 号 1970 年的纪录',
        },
      },
      {
        at: '2026-04-10T23:53Z',
        en: 'Atmospheric entry',
        zh: '再入大气层',
        about: { en: 'Splashdown 14 minutes later', zh: '约 14 分钟后溅落' },
      },
    ],
  },
  {
    id: 'artemis1',
    en: 'Artemis I',
    zh: '阿尔忒弥斯 1 号',
    tagline: {
      en: '2022 · uncrewed Orion in a distant lunar orbit',
      zh: '2022 · 无人猎户座进入远距离逆行轨道',
    },
    summary: {
      en: 'The first flight of SLS and Orion, without a crew. Orion swung low over the Moon into a distant retrograde orbit (DRO), stayed about six days, and came home after 25 days, testing the heat shield at lunar return speed.',
      zh: 'SLS 火箭和猎户座飞船的首次飞行（无人）。飞船贴近月面掠过后进入远距离逆行轨道（DRO），停留约 6 天，25 天后返回地球，验证了以奔月返回速度再入时的防热罩。',
    },
    launch: '2022-11-16T06:47:44Z',
    agency: 'NASA',
    color: '#ffc98a',
    craft: [{ en: 'Orion', zh: '猎户座', color: '#ffc98a' }],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Trajectory data begins two hours after launch, once Orion has left the upper stage.',
      zh: '轨迹数据从发射约 2 小时后、飞船与上面级分离时开始。',
    },
    phases: [
      {
        from: '2022-11-16T08:46Z',
        en: 'Outbound coast',
        zh: '奔月滑行',
        about: {
          en: 'The upper stage has already done the translunar injection. Orion coasts for five days toward the Moon.',
          zh: '上面级已经完成地月转移点火。猎户座飞船向月球滑行约五天。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2022-11-21T09:00Z',
        en: 'Outbound powered flyby',
        zh: '动力飞越月球',
        about: {
          en: 'Orion dives to 130 km above the surface and fires its engine there, using the Moon’s gravity to bend toward the distant orbit.',
          zh: '飞船俯冲到距月面仅 130 km 处并点火，借助月球引力转向远距离轨道。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 600,
      },
      {
        from: '2022-11-21T16:00Z',
        en: 'To the distant orbit',
        zh: '前往远距离逆行轨道',
        about: {
          en: 'Four days climbing away from the Moon to the orbit’s far point.',
          zh: '用约四天爬升到远离月球的轨道入口。',
        },
        shot: { aim: 'body', zoom: 22 },
        speed: 3600,
        frame: 'earthMoon',
      },
      {
        from: '2022-11-25T20:00Z',
        en: 'Distant retrograde orbit',
        zh: '远距离逆行轨道',
        about: {
          en: 'A very stable orbit about 70,000 km above the Moon, circling against the Moon’s own motion. In the Earth–Moon rotating frame, which turns with the Moon (the guided view switches to it here), it is a closed loop around it.',
          zh: '距月面约 7 万 km、绕行方向与月球公转相反的轨道，非常稳定，几乎不用燃料维持。在随月球一起转动的“地月旋转”参考系里（自动导览会切换过去），它是一个绕月的闭合圈。',
        },
        shot: { aim: 'body', zoom: 22 },
        speed: 21600,
        frame: 'earthMoon',
      },
      {
        from: '2022-12-01T20:00Z',
        en: 'Leaving the DRO',
        zh: '离开逆行轨道',
        about: {
          en: 'A burn starts the trip back down to the Moon for the return flyby.',
          zh: '一次点火让飞船离开逆行轨道，返回月球附近准备再次飞越。',
        },
        shot: { aim: 'body', zoom: 22 },
        speed: 3600,
        frame: 'earthMoon',
      },
      {
        from: '2022-12-05T13:00Z',
        en: 'Return powered flyby',
        zh: '返回动力飞越',
        about: {
          en: 'Again 128 km above the surface: the burn here sets up the trip home.',
          zh: '再次贴近到距月面 128 km 处点火，进入返回地球的轨道。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 600,
      },
      {
        from: '2022-12-05T20:00Z',
        en: 'Homeward coast',
        zh: '返回地球',
        about: {
          en: 'Six days back to Earth.',
          zh: '约六天的返程滑行。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2022-12-11T13:00Z',
        en: 'Re-entry',
        zh: '再入大气层',
        about: {
          en: 'A skip entry at about 11 km/s: the capsule dips into the atmosphere, bounces out and dives in again. Splashdown off Baja California at 17:40 UTC.',
          zh: '以约 11 km/s 的速度“跳跃式”再入：先切入大气层，弹出后再次进入，以分散热量和过载。17:40 UTC 溅落在下加利福尼亚外海。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
    ],
    events: [
      {
        at: '2022-11-21T12:57Z',
        en: 'Outbound flyby',
        zh: '去程飞越月球',
        about: { en: '130 km above the surface', zh: '距月面 130 km' },
      },
      {
        at: '2022-11-25T21:52Z',
        en: 'Enters the DRO',
        zh: '进入逆行轨道',
      },
      {
        at: '2022-11-28T21:06Z',
        en: 'Farthest from Earth',
        zh: '离地球最远',
        about: {
          en: '432,210 km: a record for a spacecraft built to carry people',
          zh: '432,210 km，载人级飞船的最远纪录',
        },
      },
      {
        at: '2022-12-01T21:53Z',
        en: 'Leaves the DRO',
        zh: '离开逆行轨道',
      },
      {
        at: '2022-12-05T16:43Z',
        en: 'Return flyby',
        zh: '返程飞越月球',
        about: { en: '128 km above the surface', zh: '距月面 128 km' },
      },
      {
        at: '2022-12-11T17:19Z',
        en: 'Atmospheric entry',
        zh: '再入大气层',
        about: { en: 'Splashdown 21 minutes later', zh: '约 21 分钟后溅落' },
      },
    ],
  },
  {
    id: 'chandrayaan3',
    en: 'Chandrayaan-3',
    zh: '月船 3 号',
    tagline: {
      en: '2023 · first landing near the lunar south pole',
      zh: '2023 · 首次在月球南极附近着陆',
    },
    summary: {
      en: 'India’s second landing attempt. With a modest rocket, the spacecraft stretched its orbit step by step for two weeks, slipped into lunar orbit, lowered it, and the Vikram lander touched down near the south pole — India became the fourth country to land softly on the Moon.',
      zh: '印度的第二次着陆尝试。火箭运力有限，飞船用两周时间一圈圈抬高地球轨道，再被月球捕获、逐步降低轨道，最后维克拉姆着陆器在月球南极附近软着陆，印度成为第四个实现月面软着陆的国家。',
    },
    launch: '2023-07-14T09:05:17Z',
    agency: 'ISRO',
    color: '#ffd08a',
    craft: [
      { en: 'Vikram lander', zh: '维克拉姆着陆器', color: '#ffd08a' },
      { en: 'Propulsion module', zh: '推进舱', color: '#9fd8ff' },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    phases: [
      {
        from: '2023-07-14T09:22Z',
        en: 'Raising the orbit',
        zh: '抬高地球轨道',
        about: {
          en: 'Burns at perigee stretch the far end of the orbit step by step, from 36,000 km to 41,000, 51,000, 71,000 and finally 127,000 km. Cheap on fuel, but it takes two and a half weeks.',
          zh: '在近地点点火，把远地点一步步推远：从最初的 3.6 万 km，到 4.1 万、5.1 万、7.1 万，最后到 12.7 万 km。这样很省燃料，但要花两周半。',
        },
        shot: { aim: 'path', zoom: 12 },
        speed: 3600,
      },
      {
        from: '2023-07-25T06:00Z',
        en: 'The long ellipse',
        zh: '最后一圈大椭圆',
        about: {
          en: 'Three laps of a 127,000 km ellipse, timed so the next perigee burn points the spacecraft at the Moon.',
          zh: '在远地点 12.7 万 km 的大椭圆上绕三圈，等待合适的时机，让下一次近地点点火正好对准月球。',
        },
        shot: { aim: 'path', zoom: 26 },
        speed: 3600,
      },
      {
        from: '2023-07-31T17:00Z',
        en: 'Translunar injection',
        zh: '地月转移入射',
        about: {
          en: 'The burn at perigee raises the far end to the Moon’s distance.',
          zh: '近地点点火，把远地点抬到月球距离。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '2023-07-31T21:00Z',
        en: 'Transfer to the Moon',
        zh: '奔月',
        about: {
          en: 'Five days on the way to the Moon.',
          zh: '约五天的奔月旅程。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2023-08-05T11:00Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: {
          en: 'Braking near the Moon lets its gravity capture the spacecraft, into an orbit of 164 × 18,074 km.',
          zh: '在月球附近减速，让月球引力把飞船“抓住”，进入 164 × 18,074 km 的环月轨道。',
        },
        shot: { aim: 'body', zoom: 4 },
        speed: 600,
        frame: 'moon',
      },
      {
        from: '2023-08-05T18:00Z',
        en: 'Lowering the lunar orbit',
        zh: '逐步降低环月轨道',
        about: {
          en: 'Four burns shrink the orbit to an almost circular 153 × 163 km.',
          zh: '四次点火把轨道缩小到接近圆形的 153 × 163 km。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '2023-08-17T06:00Z',
        en: 'Lander separates',
        zh: '着陆器分离',
        about: {
          en: 'Vikram leaves the propulsion module and lowers its own orbit to 25 × 134 km.',
          zh: '维克拉姆着陆器与推进舱分离，自己把轨道降到 25 × 134 km。',
        },
        shot: { aim: 'body', zoom: 0.8 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '2023-08-23T11:30Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'From 25 km up, a 19-minute powered descent ends at 69.4° S, 32.3° E, about 600 km from the south pole, where permanently shadowed craters may hold water ice.',
          zh: '从 25 km 高度开始约 19 分钟的动力下降，最终落在南纬 69.4°、东经 32.3°，距南极约 600 km。南极附近的永久阴影坑里可能有水冰。',
        },
        shot: { aim: 'body', zoom: 0.6 },
        speed: 60,
        frame: 'moon',
      },
    ],
    events: [
      { at: '2023-07-15T06:42Z', en: 'Orbit raising 1', zh: '地球轨道机动 1' },
      { at: '2023-07-16T13:48Z', en: 'Orbit raising 2', zh: '地球轨道机动 2' },
      { at: '2023-07-18T09:25Z', en: 'Orbit raising 3', zh: '地球轨道机动 3' },
      { at: '2023-07-20T09:16Z', en: 'Orbit raising 4', zh: '地球轨道机动 4' },
      { at: '2023-07-25T08:59Z', en: 'Orbit raising 5', zh: '地球轨道机动 5' },
      {
        at: '2023-07-31T18:43Z',
        en: 'Translunar injection',
        zh: '地月转移入射',
        about: { en: '288 × 369,328 km', zh: '288 × 369,328 km' },
      },
      {
        at: '2023-08-05T13:42Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: { en: '164 × 18,074 km', zh: '164 × 18,074 km' },
      },
      { at: '2023-08-06T17:30Z', en: 'Orbit lowering 1', zh: '环月降轨 1' },
      { at: '2023-08-09T08:15Z', en: 'Orbit lowering 2', zh: '环月降轨 2' },
      { at: '2023-08-14T06:15Z', en: 'Orbit lowering 3', zh: '环月降轨 3' },
      { at: '2023-08-16T03:00Z', en: 'Orbit lowering 4', zh: '环月降轨 4' },
      {
        at: '2023-08-17T07:45Z',
        en: 'Lander separates',
        zh: '着陆器分离',
      },
      { at: '2023-08-18T10:30Z', en: 'Deboost 1', zh: '着陆器减速 1' },
      {
        at: '2023-08-19T20:30Z',
        en: 'Deboost 2',
        zh: '着陆器减速 2',
        about: { en: '25 × 134 km', zh: '25 × 134 km' },
      },
      {
        at: '2023-08-23T12:33Z',
        en: 'Touchdown',
        zh: '着陆',
        about: { en: '69.4° S, 32.3° E', zh: '南纬 69.4°，东经 32.3°' },
      },
    ],
  },
  {
    id: 'jwst',
    en: 'James Webb Space Telescope',
    zh: '韦伯空间望远镜',
    tagline: {
      en: '2021 · a month to L2, then a halo orbit',
      zh: '2021 · 一个月飞抵日地 L2 点',
    },
    summary: {
      en: 'Launched on Christmas Day 2021, Webb unfolded its sunshield and mirrors on the way out and settled into a halo orbit around the Sun–Earth L2 point, 1.5 million km beyond Earth, where it keeps Sun, Earth and Moon behind its shield.',
      zh: '2021 年圣诞节发射。韦伯望远镜在飞行途中展开遮阳罩和主镜，一个月后进入距地球约 150 万 km 的日地 L2 点晕轨道。在那里太阳、地球和月球始终在遮阳罩的同一侧。',
    },
    launch: '2021-12-25T12:20Z',
    agency: 'NASA · ESA · CSA',
    color: '#d9b8ff',
    craft: [{ en: 'Webb', zh: '韦伯', color: '#d9b8ff' }],
    frames: ['sunEarth', 'earth'],
    lagrange: 1,
    note: {
      en: 'Trajectory data begins 40 minutes after launch.',
      zh: '轨迹数据从发射后约 40 分钟开始。',
    },
    phases: [
      {
        from: '2021-12-25T13:02Z',
        en: 'Leaving Earth',
        zh: '离开地球',
        about: {
          en: 'Ariane 5 aimed Webb so precisely that the fuel saved should keep it working well beyond its planned ten years.',
          zh: '阿丽亚娜 5 号火箭入轨极其精确，省下的燃料足以让韦伯远超原定 10 年的工作寿命。',
        },
        shot: { aim: 'craft', zoom: 6 },
        speed: 600,
      },
      {
        from: '2021-12-26T00:00Z',
        en: 'Cruise and unfolding',
        zh: '巡航与展开',
        about: {
          en: 'Over two weeks the telescope unfolds: sunshield, five layers tensioned; secondary mirror; then the two wings of the 6.5 m primary mirror.',
          zh: '两周内依次展开：遮阳罩（五层薄膜逐层拉紧）、次镜，最后是 6.5 m 主镜的两侧镜翼。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 21600,
      },
      {
        from: '2022-01-24T00:00Z',
        en: 'Halo orbit around L2',
        zh: 'L2 晕轨道',
        about: {
          en: 'Webb does not sit at L2: it circles it on a six-month halo orbit about as wide as the Moon’s orbit around Earth. Seen turning with the Sun line (Sun–Earth rotating frame) the loop is plain.',
          zh: '韦伯并不停在 L2 点上，而是绕着它走一圈约半年的晕轨道，尺寸和月球绕地球的轨道差不多。在“日地旋转”参考系里能清楚看到这个绕圈。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 86400,
      },
    ],
    events: [
      {
        at: '2021-12-26T00:50Z',
        en: 'First course correction',
        zh: '第一次轨道修正',
        about: { en: '65-minute burn', zh: '点火 65 分钟' },
      },
      {
        at: '2022-01-04T16:59Z',
        en: 'Sunshield tensioned',
        zh: '遮阳罩展开完成',
      },
      {
        at: '2022-01-05T16:52Z',
        en: 'Secondary mirror deployed',
        zh: '次镜展开',
      },
      {
        at: '2022-01-08T18:17Z',
        en: 'Primary mirror unfolded',
        zh: '主镜展开完成',
      },
      {
        at: '2022-01-24T19:00Z',
        en: 'Arrival at L2',
        zh: '抵达 L2',
        about: { en: 'Five-minute insertion burn', zh: '5 分钟入轨点火' },
      },
      {
        at: '2022-07-12T14:30Z',
        en: 'First images released',
        zh: '首批科学图像发布',
      },
    ],
  },
  {
    id: 'capstone',
    en: 'CAPSTONE',
    zh: 'CAPSTONE',
    tagline: {
      en: '2022 · four months the slow way to the Moon',
      zh: '2022 · 绕远路四个月奔月',
    },
    summary: {
      en: 'A microwave-oven-sized cubesat that tested the near-rectilinear halo orbit (NRHO) planned for the Gateway station. Instead of Apollo’s three-day dash it took a ballistic lunar transfer: out to 1.5 million km, where the Sun’s pull reshapes the orbit, and back to the Moon for almost no fuel.',
      zh: '一颗微波炉大小的立方星，任务是先行验证“门户”月球空间站计划使用的近直线晕轨道（NRHO）。它没有像阿波罗那样三天直飞，而是走“弹道式低能量转移”：先飞到 150 万 km 外，借太阳引力改变轨道，再几乎不耗燃料地回到月球。',
    },
    launch: '2022-06-28T09:55:52Z',
    agency: 'NASA · Advanced Space · Rocket Lab',
    color: '#8ff0c8',
    craft: [{ en: 'CAPSTONE', zh: 'CAPSTONE', color: '#8ff0c8' }],
    frames: ['sunEarth', 'earth', 'moon', 'earthMoon'],
    lagrange: 0.6,
    phases: [
      {
        from: '2022-06-28T10:07Z',
        en: 'Riding the Photon stage',
        zh: 'Photon 上面级抬轨',
        about: {
          en: 'Rocket Lab’s Photon stage raises its orbit over six days with a series of burns at perigee.',
          zh: '火箭实验室的 Photon 上面级在六天里多次近地点点火，一步步抬高轨道。',
        },
        shot: { aim: 'path', zoom: 4 },
        speed: 600,
      },
      {
        from: '2022-07-01T00:00Z',
        en: 'Last elliptical laps',
        zh: '最后几圈大椭圆',
        about: {
          en: 'Three laps of a 76,000 km ellipse before the final burn.',
          zh: '在远地点约 7.6 万 km 的椭圆轨道上绕三圈，等待最后一次点火。',
        },
        shot: { aim: 'path', zoom: 16 },
        speed: 3600,
      },
      {
        from: '2022-07-04T05:30Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: {
          en: 'Photon’s last burn sends CAPSTONE away; the cubesat separates minutes later.',
          zh: 'Photon 最后一次点火把 CAPSTONE 送上转移轨道，几分钟后立方星与它分离。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '2022-07-04T10:00Z',
        en: 'Ballistic lunar transfer',
        zh: '弹道式低能量转移',
        about: {
          en: 'Out to four times the Moon’s distance. There the Sun’s tide raises the perigee of the orbit, so that four months later it meets the Moon slowly enough to be captured with a small burn.',
          zh: '飞到约四倍月球距离之外。在那里，太阳引力的“潮汐”把轨道近地点抬高，四个月后飞船以很低的相对速度遇上月球，只需一次小点火就能被捕获。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 86400,
      },
      {
        from: '2022-11-12T00:00Z',
        en: 'Near-rectilinear halo orbit',
        zh: '近直线晕轨道',
        about: {
          en: 'A six-and-a-half-day orbit that swoops 1,600 km over the Moon’s north pole and climbs 70,000 km over the south, always in sight of Earth. In the Earth–Moon rotating frame (the guided view switches to it here) it holds its shape lap after lap.',
          zh: '周期约 6.5 天的轨道：在月球北极上空 1,600 km 处掠过，在南极一侧远到 7 万 km，始终能看到地球。在“地月旋转”参考系里（自动导览会切换过去），可以看到它一圈圈保持同样的形状。',
        },
        shot: { aim: 'body', zoom: 20 },
        speed: 21600,
        frame: 'earthMoon',
      },
    ],
    events: [
      {
        at: '2022-07-04T06:58Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
      },
      {
        at: '2022-08-26T19:33Z',
        en: 'Farthest from Earth',
        zh: '离地球最远',
        about: { en: '1.53 million km', zh: '约 153 万 km' },
      },
      {
        at: '2022-11-14T00:38Z',
        en: 'Enters NRHO',
        zh: '进入近直线晕轨道',
        about: {
          en: 'The first spacecraft ever in this orbit',
          zh: '人类首个进入这种轨道的航天器',
        },
      },
    ],
  },
];

// Widths around the Sun are easier to think about in AU.
const AU = 149597870.7 / 6378.137;
const au = (value: number) => value * AU;
// Mean radii (km) of the bodies close-ups are framed on.
const RADIUS: Partial<Record<BodyKey, number>> = {
  venus: 6051.8,
  mars: 3389.5,
  jupiter: 69911,
  saturn: 58232,
  uranus: 25362,
  neptune: 24622,
  pluto: 1188.3,
};
/** Earth radii for `count` radii of `body` (a close-up's width). */
const radii = (body: BodyKey, count: number) =>
  ((RADIUS[body] ?? 6378.137) / 6378.137) * count;

/** Interplanetary missions, played on the solar-system view. */
const HELIO_MISSIONS: Mission[] = [
  {
    id: 'voyager2',
    kind: 'helio',
    en: 'Voyager 2',
    zh: '旅行者 2 号',
    tagline: {
      en: '1977 · the only visit to all four giant planets',
      zh: '1977 · 唯一一次造访全部四颗巨行星',
    },
    summary: {
      en: 'A line-up of the outer planets that comes round every 175 years let one spacecraft swing from Jupiter to Saturn to Uranus to Neptune, each flyby bending its path toward the next. It is still the only visitor to Uranus and Neptune, and since 2018 it has been in interstellar space.',
      zh: '外行星每 175 年才有一次这样的排列：一个探测器可以借木星、土星、天王星、海王星的引力依次转向，一路飞下去。它至今仍是唯一造访过天王星和海王星的探测器，2018 年起进入星际空间。',
    },
    launch: '1977-08-20T14:29:44Z',
    agency: 'NASA · JPL',
    color: '#9fd8ff',
    craft: [{ en: 'Voyager 2', zh: '旅行者 2 号', color: '#9fd8ff' }],
    frames: ['sun', 'jupiter', 'saturn', 'uranus', 'neptune'],
    note: {
      en: 'Trajectory data begins about an hour after launch.',
      zh: '轨迹数据从发射后约 1 小时开始。',
    },
    phases: [
      {
        from: '1977-08-20T15:33Z',
        en: 'To Jupiter',
        zh: '飞向木星',
        about: {
          en: 'Launched sixteen days before its twin, on a slower path that keeps the whole grand tour open.',
          zh: '比孪生兄弟旅行者 1 号早 16 天发射，走一条更慢的路线，好把“大旅行”的后续目标都留着。',
        },
        shot: { aim: 'path', zoom: au(6.5) },
        speed: 2629800,
      },
      {
        from: '1979-07-09T08:00Z',
        en: 'Jupiter',
        zh: '木星',
        about: {
          en: 'Passing 650,000 km above the clouds, Voyager 2 picks up speed from Jupiter and is flung toward Saturn. It images Europa’s cracked ice and Io’s volcanoes along the way.',
          zh: '在木星云顶上方约 65 万 km 处掠过，借木星引力加速，被甩向土星。途中拍下了木卫二布满裂纹的冰壳和木卫一的火山。',
        },
        shot: { aim: 'body', body: 'jupiter', zoom: radii('jupiter', 30) },
        speed: 3600,
        frame: 'jupiter',
      },
      {
        from: '1979-07-10T12:00Z',
        en: 'To Saturn',
        zh: '飞向土星',
        about: {
          en: 'Two years of cruise. Jupiter’s pull has bent the path and raised the speed enough to reach Saturn.',
          zh: '两年的巡航。木星已经把轨道掰弯并加速，足够飞到土星。',
        },
        shot: { aim: 'path', zoom: au(11) },
        speed: 2629800,
      },
      {
        from: '1981-08-25T15:00Z',
        en: 'Saturn',
        zh: '土星',
        about: {
          en: '101,000 km above the clouds, then behind the rings and the planet as seen from Earth. Saturn turns the path toward Uranus.',
          zh: '在云顶上方约 10 万 km 处飞过，随后从地球看去绕到土星环和土星背后。土星把轨道转向天王星。',
        },
        shot: { aim: 'body', body: 'saturn', zoom: radii('saturn', 8) },
        speed: 3600,
        frame: 'saturn',
      },
      {
        from: '1981-08-27T00:00Z',
        en: 'To Uranus',
        zh: '飞向天王星',
        about: {
          en: 'Four and a half years to a planet no spacecraft had seen up close.',
          zh: '四年半的飞行，前往从没有探测器近距离看过的天王星。',
        },
        shot: { aim: 'path', zoom: au(22) },
        speed: 2629800,
      },
      {
        from: '1986-01-24T08:00Z',
        en: 'Uranus',
        zh: '天王星',
        about: {
          en: 'Uranus lies on its side, so the spacecraft crosses its system like a bullseye. Ten new moons and two new rings in a few days.',
          zh: '天王星“躺着”自转，探测器像射向靶心一样穿过它的卫星系统。几天里发现了 10 颗新卫星和 2 条新环。',
        },
        shot: { aim: 'body', body: 'uranus', zoom: radii('uranus', 12) },
        speed: 3600,
        frame: 'uranus',
      },
      {
        from: '1986-01-25T06:00Z',
        en: 'To Neptune',
        zh: '飞向海王星',
        about: {
          en: 'Three and a half more years, the target now 4.5 billion km from the Sun.',
          zh: '再飞三年半，目标距太阳 45 亿 km。',
        },
        shot: { aim: 'path', zoom: au(32) },
        speed: 2629800,
      },
      {
        from: '1989-08-24T20:00Z',
        en: 'Neptune',
        zh: '海王星',
        about: {
          en: 'The closest planetary flyby of the tour, about 5,000 km over Neptune’s north pole, then on to Triton. Neptune bends the path steeply south, out of the plane of the planets.',
          zh: '整个旅程中最近的一次行星飞掠：从海王星北极上空约 5,000 km 处掠过，接着飞越海卫一。海王星把轨道向南大幅偏折，离开行星所在的平面。',
        },
        shot: { aim: 'body', body: 'neptune', zoom: radii('neptune', 10) },
        speed: 3600,
        frame: 'neptune',
      },
      {
        from: '1989-08-26T00:00Z',
        en: 'Into interstellar space',
        zh: '驶向星际空间',
        about: {
          en: 'Still sending data. In 2018, 119 AU out, it crossed the heliopause, where the Sun’s wind gives way to the gas between the stars.',
          zh: '至今仍在发回数据。2018 年在距太阳 119 AU 处穿过日球层顶：太阳风到此为止，外面是恒星之间的气体。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 31557600,
      },
    ],
    events: [
      {
        at: '1979-07-09T22:29Z',
        en: 'Jupiter',
        zh: '飞掠木星',
        about: { en: '650,000 km above the clouds', zh: '距云顶约 65 万 km' },
      },
      {
        at: '1981-08-26T03:24Z',
        en: 'Saturn',
        zh: '飞掠土星',
        about: { en: '101,000 km above the clouds', zh: '距云顶约 10 万 km' },
      },
      {
        at: '1986-01-24T17:59Z',
        en: 'Uranus',
        zh: '飞掠天王星',
        about: { en: '81,500 km above the clouds', zh: '距云顶约 8.2 万 km' },
      },
      {
        at: '1989-08-25T03:56Z',
        en: 'Neptune',
        zh: '飞掠海王星',
        about: {
          en: '4,950 km above the north pole',
          zh: '距北极云顶约 4,950 km',
        },
      },
      {
        at: '2018-11-05T00:00Z',
        en: 'Heliopause',
        zh: '穿过日球层顶',
        about: { en: '119 AU from the Sun', zh: '距太阳 119 AU' },
      },
    ],
  },
  {
    id: 'voyager1',
    kind: 'helio',
    en: 'Voyager 1',
    zh: '旅行者 1 号',
    tagline: {
      en: '1977 · the farthest human-made object',
      zh: '1977 · 离地球最远的人造物体',
    },
    summary: {
      en: 'The faster twin: Jupiter in 1979, Saturn and a close look at Titan in 1980, then up out of the planets’ plane. In 1990 it turned round for the Pale Blue Dot, and in 2012 it became the first spacecraft in interstellar space.',
      zh: '跑得更快的那一个：1979 年飞掠木星，1980 年飞掠土星并近距离观测土卫六，随后向上离开行星平面。1990 年回头拍下“暗淡蓝点”，2012 年成为第一个进入星际空间的航天器。',
    },
    launch: '1977-09-05T12:56:00Z',
    agency: 'NASA · JPL',
    color: '#ffd59a',
    craft: [{ en: 'Voyager 1', zh: '旅行者 1 号', color: '#ffd59a' }],
    frames: ['sun', 'jupiter', 'saturn'],
    note: {
      en: 'Trajectory data begins about an hour after launch.',
      zh: '轨迹数据从发射后约 1 小时开始。',
    },
    phases: [
      {
        from: '1977-09-05T14:00Z',
        en: 'To Jupiter',
        zh: '飞向木星',
        about: {
          en: 'Launched second but on a faster path, it overtakes Voyager 2 before the end of the year.',
          zh: '晚发射 16 天，但走更快的路线，当年年底就超过了旅行者 2 号。',
        },
        shot: { aim: 'path', zoom: au(6.5) },
        speed: 2629800,
      },
      {
        from: '1979-03-04T20:00Z',
        en: 'Jupiter',
        zh: '木星',
        about: {
          en: 'Within 280,000 km of the clouds. Its cameras find active volcanoes on Io, the first seen beyond Earth, and a faint ring.',
          zh: '距云顶约 28 万 km。相机在木卫一上发现了活火山，这是人类第一次在地球以外看到正在喷发的火山；还发现了木星的暗弱光环。',
        },
        shot: { aim: 'body', body: 'jupiter', zoom: radii('jupiter', 16) },
        speed: 3600,
        frame: 'jupiter',
      },
      {
        from: '1979-03-06T06:00Z',
        en: 'To Saturn',
        zh: '飞向土星',
        about: {
          en: 'A year and a half to Saturn.',
          zh: '一年半后到达土星。',
        },
        shot: { aim: 'path', zoom: au(11) },
        speed: 2629800,
      },
      {
        from: '1980-11-12T00:00Z',
        en: 'Titan and Saturn',
        zh: '土卫六与土星',
        about: {
          en: 'Seeing Titan up close was worth more than Pluto: the flyby, 6,490 km from Titan, bends the path sharply up out of the planets’ plane, ending the planetary tour.',
          zh: '近距离观测土卫六被认为比去冥王星更重要：在距土卫六约 6,490 km 处飞过，轨道被大幅向上偏折、离开行星平面，行星之旅就此结束。',
        },
        shot: { aim: 'body', body: 'saturn', zoom: radii('saturn', 14) },
        speed: 3600,
        frame: 'saturn',
      },
      {
        from: '1980-11-14T00:00Z',
        en: 'Out of the solar system',
        zh: '飞出太阳系',
        about: {
          en: 'At about 17 km/s it gains 3.6 AU a year. In 1998 it passed Pioneer 10 as the most distant human-made object; in 2012, 121.6 AU out, it crossed the heliopause.',
          zh: '以约 17 km/s 的速度每年远离太阳 3.6 AU。1998 年超过先驱者 10 号成为最远的人造物体；2012 年在距太阳 121.6 AU 处穿过日球层顶。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 31557600,
      },
    ],
    events: [
      {
        at: '1979-03-05T12:04Z',
        en: 'Jupiter',
        zh: '飞掠木星',
        about: { en: '280,000 km above the clouds', zh: '距云顶约 28 万 km' },
      },
      {
        at: '1980-11-12T05:41Z',
        en: 'Titan',
        zh: '飞掠土卫六',
        about: { en: '6,490 km', zh: '距土卫六约 6,490 km' },
      },
      {
        at: '1980-11-12T23:45Z',
        en: 'Saturn',
        zh: '飞掠土星',
        about: { en: '124,000 km above the clouds', zh: '距云顶约 12.4 万 km' },
      },
      {
        at: '1990-02-14T04:48Z',
        en: 'Pale Blue Dot',
        zh: '“暗淡蓝点”',
        about: {
          en: 'Earth photographed from 40.5 AU',
          zh: '在 40.5 AU 外回望地球',
        },
      },
      {
        at: '1998-02-17T00:00Z',
        en: 'Farthest human-made object',
        zh: '成为最远的人造物体',
        about: {
          en: 'Passes Pioneer 10, 69 AU out',
          zh: '超过先驱者 10 号，距太阳 69 AU',
        },
      },
      {
        at: '2012-08-25T00:00Z',
        en: 'Heliopause',
        zh: '穿过日球层顶',
        about: { en: '121.6 AU from the Sun', zh: '距太阳 121.6 AU' },
      },
    ],
  },
  {
    id: 'newhorizons',
    kind: 'helio',
    en: 'New Horizons',
    zh: '新视野号',
    tagline: {
      en: '2006 · Pluto, then a Kuiper-belt snowman',
      zh: '2006 · 冥王星，然后是柯伊伯带的“雪人”',
    },
    summary: {
      en: 'The fastest launch ever, past the Moon’s orbit in nine hours. A Jupiter flyby cut three years off the trip; nine and a half years after launch it swept past Pluto, and three and a half years later past Arrokoth, the most distant object ever visited.',
      zh: '史上离开地球速度最快的发射，9 小时就越过月球轨道。借木星引力省下三年航程，发射九年半后飞掠冥王星，又过三年半飞掠阿罗科斯，那是人类探测过的最远天体。',
    },
    launch: '2006-01-19T19:00:00Z',
    agency: 'NASA · JHU APL',
    color: '#c9b6ff',
    craft: [{ en: 'New Horizons', zh: '新视野号', color: '#c9b6ff' }],
    frames: ['sun', 'jupiter', 'pluto', 'arrokoth'],
    note: {
      en: 'Trajectory data begins about an hour after launch.',
      zh: '轨迹数据从发射后约 1 小时开始。',
    },
    phases: [
      {
        from: '2006-01-19T19:52Z',
        en: 'To Jupiter',
        zh: '飞向木星',
        about: {
          en: 'Leaving Earth at 16.3 km/s, it reaches Jupiter in thirteen months; Voyager took nearly two years.',
          zh: '以 16.3 km/s 离开地球，13 个月就到达木星；旅行者号用了将近两年。',
        },
        shot: { aim: 'path', zoom: au(6) },
        speed: 2629800,
      },
      {
        from: '2007-02-27T12:00Z',
        en: 'Jupiter gravity assist',
        zh: '木星引力弹弓',
        about: {
          en: '2.3 million km from Jupiter, it gains 4 km/s and a straight line to Pluto.',
          zh: '在距木星约 230 万 km 处飞过，速度增加约 4 km/s，从此直奔冥王星。',
        },
        shot: { aim: 'body', body: 'jupiter', zoom: radii('jupiter', 70) },
        speed: 3600,
        frame: 'jupiter',
      },
      {
        from: '2007-03-01T00:00Z',
        en: 'The long cruise',
        zh: '漫长巡航',
        about: {
          en: 'Eight years, mostly asleep, waking once a year for checkouts.',
          zh: '八年巡航，大部分时间在“冬眠”，每年唤醒一次做检查。',
        },
        shot: { aim: 'path', zoom: au(36) },
        speed: 31557600,
      },
      {
        from: '2015-07-13T12:00Z',
        en: 'Pluto',
        zh: '冥王星',
        about: {
          en: '12,500 km from Pluto at 14 km/s: one pass, no braking. It reveals the heart-shaped nitrogen-ice plain and mountains of water ice.',
          zh: '以 14 km/s 的速度在距冥王星约 1.25 万 km 处掠过，只有一次机会、无法减速。它揭示了心形的氮冰平原和水冰构成的山脉。',
        },
        shot: { aim: 'body', body: 'pluto', zoom: radii('pluto', 40) },
        speed: 3600,
        frame: 'pluto',
      },
      {
        from: '2015-07-15T12:00Z',
        en: 'Into the Kuiper belt',
        zh: '深入柯伊伯带',
        about: {
          en: 'A target found by Hubble a year before the Pluto flyby: a small ice body a billion and a half km further out.',
          zh: '飞掠冥王星前一年，哈勃望远镜才找到这个新目标：再往外约 15 亿 km 的一颗小冰体。',
        },
        shot: { aim: 'path', zoom: au(46) },
        speed: 2629800,
      },
      {
        from: '2018-12-31T23:00Z',
        en: 'Arrokoth',
        zh: '阿罗科斯',
        about: {
          en: '3,500 km from a 36 km snowman of two lobes that came together gently as the solar system formed.',
          zh: '在约 3,500 km 处飞过一个长约 36 km 的“雪人”：两个小天体在太阳系形成之初轻轻贴在一起。',
        },
        shot: { aim: 'body', body: 'arrokoth', zoom: 1.6 },
        speed: 3600,
        frame: 'arrokoth',
      },
      {
        from: '2019-01-02T00:00Z',
        en: 'Beyond',
        zh: '继续远行',
        about: {
          en: 'Still flying outward at about 14 km/s, studying the Kuiper belt from inside.',
          zh: '仍以约 14 km/s 向外飞行，从内部观测柯伊伯带。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 31557600,
      },
    ],
    events: [
      {
        at: '2007-02-28T05:45Z',
        en: 'Jupiter',
        zh: '飞掠木星',
        about: { en: '2.3 million km', zh: '约 230 万 km' },
      },
      {
        at: '2015-07-14T11:49Z',
        en: 'Pluto',
        zh: '飞掠冥王星',
        about: { en: '12,500 km above the surface', zh: '距地表约 1.25 万 km' },
      },
      {
        at: '2019-01-01T05:33Z',
        en: 'Arrokoth',
        zh: '飞掠阿罗科斯',
        about: { en: '3,500 km', zh: '约 3,500 km' },
      },
    ],
  },
  {
    id: 'cassini',
    kind: 'helio',
    en: 'Cassini–Huygens',
    zh: '卡西尼–惠更斯号',
    tagline: {
      en: '1997 · four gravity assists, thirteen years at Saturn',
      zh: '1997 · 四次借力，在土星工作 13 年',
    },
    summary: {
      en: 'Too heavy to fly straight to Saturn, Cassini borrowed speed from Venus twice, Earth and Jupiter. It then orbited Saturn 294 times, dropped the Huygens probe onto Titan, and ended by diving into Saturn so as never to contaminate its moons.',
      zh: '太重，无法直飞土星，于是两次借金星、一次借地球、一次借木星的引力加速。到达后绕土星 294 圈，把惠更斯号着陆器送上土卫六，最后主动坠入土星，以免污染可能宜居的卫星。',
    },
    launch: '1997-10-15T08:43:00Z',
    agency: 'NASA · ESA · ASI',
    color: '#ffcf7a',
    craft: [{ en: 'Cassini', zh: '卡西尼', color: '#ffcf7a' }],
    frames: ['sun', 'venus', 'earth', 'jupiter', 'saturn'],
    note: {
      en: 'Trajectory data begins about 45 minutes after launch.',
      zh: '轨迹数据从发射后约 45 分钟开始。',
    },
    phases: [
      {
        from: '1997-10-15T09:28Z',
        en: 'Loops in the inner solar system',
        zh: '在内太阳系兜圈',
        about: {
          en: 'Launched inward, toward Venus: two Venus flybys and one of Earth add the speed the rocket could not.',
          zh: '先朝太阳方向飞向金星：两次飞掠金星、一次飞掠地球，补上火箭给不了的速度。',
        },
        shot: { aim: 'path', zoom: au(1.4) },
        speed: 604800,
      },
      {
        from: '1998-04-26T06:00Z',
        en: 'Venus, first pass',
        zh: '第一次飞掠金星',
        about: { en: '284 km above Venus.', zh: '距金星表面 284 km。' },
        shot: { aim: 'body', body: 'venus', zoom: radii('venus', 6) },
        speed: 3600,
        frame: 'venus',
      },
      {
        from: '1998-04-27T00:00Z',
        en: 'Around the Sun again',
        zh: '再绕太阳一圈',
        about: {
          en: 'A deep-space burn in December 1998 sets up the second Venus pass.',
          zh: '1998 年 12 月的一次深空机动，为第二次飞掠金星对准方向。',
        },
        shot: { aim: 'path', zoom: au(1.4) },
        speed: 604800,
      },
      {
        from: '1999-06-24T14:00Z',
        en: 'Venus, second pass',
        zh: '第二次飞掠金星',
        about: { en: '623 km above Venus.', zh: '距金星表面 623 km。' },
        shot: { aim: 'body', body: 'venus', zoom: radii('venus', 6) },
        speed: 3600,
        frame: 'venus',
      },
      {
        from: '1999-06-25T12:00Z',
        en: 'Back past Earth',
        zh: '回到地球',
        about: {
          en: 'Eight weeks later it sweeps 1,171 km over the Pacific at 19 km/s and heads for Jupiter.',
          zh: '八周后以 19 km/s 在太平洋上空 1,171 km 处掠过地球，转向木星。',
        },
        shot: { aim: 'path', zoom: au(1.4) },
        speed: 604800,
      },
      {
        from: '1999-08-17T22:00Z',
        en: 'Earth flyby',
        zh: '飞掠地球',
        about: {
          en: 'The last gravity assist from the inner planets.',
          zh: '来自内行星的最后一次引力弹弓。',
        },
        shot: { aim: 'body', body: 'earth', zoom: 6 },
        speed: 3600,
        frame: 'earth',
      },
      {
        from: '1999-08-19T00:00Z',
        en: 'To Jupiter and Saturn',
        zh: '经木星飞向土星',
        about: {
          en: 'Jupiter, passed at 9.7 million km in December 2000, adds the last push; Cassini and Galileo study Jupiter together.',
          zh: '2000 年 12 月在 970 万 km 外飞过木星，获得最后一次加速；卡西尼和伽利略号还一起观测了木星。',
        },
        shot: { aim: 'path', zoom: au(10.5) },
        speed: 2629800,
      },
      {
        from: '2004-06-30T18:00Z',
        en: 'Saturn orbit insertion',
        zh: '进入土星轨道',
        about: {
          en: 'A 96-minute burn, flying through the gap between two rings, slows it enough for Saturn to capture it.',
          zh: '从两道光环之间的空隙穿过，主发动机点火 96 分钟减速，被土星捕获。',
        },
        shot: { aim: 'body', body: 'saturn', zoom: radii('saturn', 6) },
        speed: 3600,
        frame: 'saturn',
      },
      {
        from: '2004-07-02T00:00Z',
        en: 'Thirteen years at Saturn',
        zh: '环绕土星 13 年',
        about: {
          en: 'Each Titan flyby reshapes the orbit, so the tour keeps changing: equatorial, tilted, near and far. Huygens landed on Titan in January 2005.',
          zh: '每次飞掠土卫六都会改变轨道，所以环绕路线不断变化：赤道面、倾斜、远、近。2005 年 1 月惠更斯号降落在土卫六上。',
        },
        shot: { aim: 'body', body: 'saturn', zoom: radii('saturn', 90) },
        speed: 2629800,
        frame: 'saturn',
      },
      {
        from: '2017-04-22T00:00Z',
        en: 'Grand Finale',
        zh: '壮丽终章',
        about: {
          en: '22 dives through the gap between Saturn and its rings, then a final plunge into the atmosphere, sending data to the end.',
          zh: '22 次从土星和光环之间的缝隙穿过，最后一头扎进土星大气，直到最后一刻还在发回数据。',
        },
        shot: { aim: 'body', body: 'saturn', zoom: radii('saturn', 8) },
        speed: 86400,
        frame: 'saturn',
      },
    ],
    events: [
      {
        at: '1998-04-26T13:44Z',
        en: 'Venus',
        zh: '飞掠金星',
        about: { en: '284 km', zh: '距地表 284 km' },
      },
      {
        at: '1999-06-24T20:30Z',
        en: 'Venus',
        zh: '再次飞掠金星',
        about: { en: '623 km', zh: '距地表 623 km' },
      },
      {
        at: '1999-08-18T03:28Z',
        en: 'Earth',
        zh: '飞掠地球',
        about: { en: '1,171 km', zh: '距地表 1,171 km' },
      },
      {
        at: '2000-12-30T10:02Z',
        en: 'Jupiter',
        zh: '飞掠木星',
        about: { en: '9.7 million km', zh: '约 970 万 km' },
      },
      {
        at: '2004-07-01T01:12Z',
        en: 'Saturn orbit insertion',
        zh: '土星入轨点火',
        about: { en: '96-minute burn', zh: '点火 96 分钟' },
      },
      {
        at: '2005-01-14T12:43Z',
        en: 'Huygens lands on Titan',
        zh: '惠更斯号着陆土卫六',
      },
      {
        at: '2017-04-26T09:00Z',
        en: 'First ring-gap dive',
        zh: '首次穿越环缝',
      },
      {
        at: '2017-09-15T10:30Z',
        en: 'Plunge into Saturn',
        zh: '坠入土星',
        about: {
          en: 'Last signal reached Earth at 11:55 UTC',
          zh: '最后信号于 11:55 UTC 到达地球',
        },
      },
    ],
  },
  {
    id: 'parker',
    kind: 'helio',
    en: 'Parker Solar Probe',
    zh: '帕克太阳探测器',
    tagline: {
      en: '2018 · seven Venus flybys to touch the Sun',
      zh: '2018 · 七次借力金星去“触摸”太阳',
    },
    summary: {
      en: 'Reaching the Sun is harder than leaving the solar system: Earth’s 30 km/s sideways speed has to be shed. Each of seven Venus flybys takes some away, pulling the closest approach in from 24 to 6.1 million km above the Sun’s surface, where Parker races at 192 km/s through its outer atmosphere.',
      zh: '飞向太阳比飞出太阳系更难：要抵消地球带来的 30 km/s 横向速度。七次飞掠金星，每次都减掉一些，把近日点（距太阳表面）从 2,400 万 km 一步步拉近到 610 万 km。在那里，帕克以 192 km/s 的速度穿过太阳的外层大气。',
    },
    launch: '2018-08-12T07:31:00Z',
    agency: 'NASA · JHU APL',
    color: '#ffe08a',
    craft: [{ en: 'Parker', zh: '帕克', color: '#ffe08a' }],
    frames: ['sun', 'venus'],
    note: {
      en: 'Trajectory data begins about 45 minutes after launch.',
      zh: '轨迹数据从发射后约 45 分钟开始。',
    },
    phases: [
      {
        from: '2018-08-12T08:17Z',
        en: 'Falling toward the Sun',
        zh: '向太阳坠落',
        about: {
          en: 'A Delta IV Heavy with an extra stage, and still Venus is needed within two months.',
          zh: '用上了加装第三级的德尔塔 4 重型火箭，两个月后仍然需要金星帮忙。',
        },
        shot: { aim: 'path', zoom: au(1.2) },
        speed: 604800,
      },
      {
        from: '2018-10-03T00:00Z',
        en: 'First Venus flyby',
        zh: '第一次飞掠金星',
        about: {
          en: 'Passing behind Venus in its orbit, Parker gives up speed to the planet and falls closer to the Sun.',
          zh: '从金星公转方向的后方经过，把一部分速度“让给”金星，于是离太阳更近。',
        },
        shot: { aim: 'body', body: 'venus', zoom: radii('venus', 8) },
        speed: 3600,
        frame: 'venus',
      },
      {
        from: '2018-10-04T00:00Z',
        en: 'Tightening the loops',
        zh: '一圈比一圈近',
        about: {
          en: 'Each Venus flyby moves the perihelion in and shortens the orbit, from 150 days to 88: 24 orbits in seven years.',
          zh: '每次飞掠金星后近日点都更近、轨道周期更短，从约 150 天缩短到 88 天，七年里绕太阳 24 圈。',
        },
        shot: { aim: 'path', zoom: au(1) },
        speed: 2629800,
      },
      {
        from: '2024-12-23T12:00Z',
        en: 'Closest ever to the Sun',
        zh: '离太阳最近的一次',
        about: {
          en: '6.1 million km above the Sun’s surface at 192 km/s, the fastest any human-made object has gone, behind an 11.4 cm carbon-foam shield built for about 1,400 °C.',
          zh: '距太阳表面约 610 万 km，速度 192 km/s，是人造物体达到过的最快速度。挡在前面的是 11.4 cm 厚的碳泡沫隔热罩，设计耐受约 1,400 °C。',
        },
        shot: { aim: 'path', zoom: au(0.12) },
        speed: 3600,
      },
      {
        from: '2024-12-25T12:00Z',
        en: 'Orbiting on',
        zh: '继续绕行',
        about: {
          en: 'Every 88 days it repeats the record-close pass.',
          zh: '此后每 88 天重复一次这样的极近飞掠。',
        },
        shot: { aim: 'path', zoom: au(1) },
        speed: 604800,
      },
    ],
    events: [
      { at: '2018-10-03T08:44Z', en: 'Venus 1', zh: '金星 1' },
      {
        at: '2018-11-06T03:27Z',
        en: 'Perihelion 1',
        zh: '近日点 1',
        about: {
          en: '24 million km above the surface',
          zh: '距太阳表面约 2,400 万 km',
        },
      },
      { at: '2019-12-26T18:14Z', en: 'Venus 2', zh: '金星 2' },
      { at: '2020-07-11T03:24Z', en: 'Venus 3', zh: '金星 3' },
      { at: '2021-02-20T20:05Z', en: 'Venus 4', zh: '金星 4' },
      { at: '2021-10-16T09:31Z', en: 'Venus 5', zh: '金星 5' },
      { at: '2023-08-21T12:03Z', en: 'Venus 6', zh: '金星 6' },
      { at: '2024-11-06T18:43Z', en: 'Venus 7', zh: '金星 7' },
      {
        at: '2024-12-24T11:53Z',
        en: 'Record perihelion',
        zh: '创纪录近日点',
        about: {
          en: '6.1 million km above the surface, 192 km/s',
          zh: '距太阳表面约 610 万 km，192 km/s',
        },
      },
    ],
  },
  {
    id: 'mars2020',
    kind: 'helio',
    en: 'Perseverance',
    zh: '毅力号',
    tagline: {
      en: '2020 · seven months to Mars, seven minutes to land',
      zh: '2020 · 七个月飞到火星，七分钟落地',
    },
    summary: {
      en: 'Launched in the Earth–Mars window that opens every 26 months, the cruise stage carried the rover half way round the Sun to meet Mars in Jezero crater, an ancient lake bed, after a seven-minute entry, parachute and sky-crane descent.',
      zh: '在每 26 个月才打开一次的地火发射窗口出发，巡航级带着火星车绕太阳飞行半圈，与火星相会；再经过“恐怖七分钟”的进入、开伞和空中吊车下降，落在曾经是湖泊的杰泽罗陨石坑。',
    },
    launch: '2020-07-30T11:50:00Z',
    agency: 'NASA · JPL',
    color: '#ffb38a',
    craft: [{ en: 'Perseverance', zh: '毅力号', color: '#ffb38a' }],
    frames: ['sun', 'mars'],
    note: {
      en: 'Trajectory data begins about an hour after launch. Times are at Mars; signals took 11 more minutes to reach Earth.',
      zh: '轨迹数据从发射后约 1 小时开始。时间按火星当地的事件时刻，信号还要约 11 分钟才传到地球。',
    },
    phases: [
      {
        from: '2020-07-30T12:53Z',
        en: 'Cruise to Mars',
        zh: '奔火巡航',
        about: {
          en: 'Not a straight line: a transfer orbit that rises from Earth’s orbit to Mars’ while both planets move round the Sun.',
          zh: '不是直线：而是一条从地球轨道升到火星轨道的转移轨道，两颗行星在此期间也在绕太阳运行。',
        },
        shot: { aim: 'path', zoom: au(1.9) },
        speed: 604800,
      },
      {
        from: '2021-02-17T12:00Z',
        en: 'Approach',
        zh: '接近火星',
        about: {
          en: 'No braking into orbit: it heads straight for the atmosphere at 5.4 km/s.',
          zh: '不先入轨减速，而是以 5.4 km/s 直接冲向大气层。',
        },
        shot: {
          aim: 'body',
          body: 'mars',
          zoom: radii('mars', 14),
          above: true,
        },
        speed: 3600,
        frame: 'mars',
      },
      {
        from: '2021-02-18T20:25Z',
        en: 'Seven minutes of terror',
        zh: '恐怖七分钟',
        about: {
          en: 'Heat shield, a 21.5 m parachute, then a rocket-powered sky crane lowers the rover on cables. Every step runs on its own: Mars is 11 light-minutes away.',
          zh: '先靠防热罩减速，再打开 21.5 m 的降落伞，最后由火箭驱动的“空中吊车”用绳索把火星车放下。火星距地球 11 光分，全程只能自主完成。',
        },
        shot: {
          aim: 'body',
          body: 'mars',
          zoom: radii('mars', 2.4),
          above: true,
        },
        speed: 60,
        frame: 'mars',
      },
    ],
    events: [
      { at: '2021-02-18T20:37Z', en: 'Atmospheric entry', zh: '进入火星大气' },
      {
        at: '2021-02-18T20:44Z',
        en: 'Touchdown in Jezero',
        zh: '降落杰泽罗陨石坑',
        about: { en: '18.4° N, 77.5° E', zh: '北纬 18.4°，东经 77.5°' },
      },
    ],
  },
];
MISSIONS.push(...HELIO_MISSIONS);

export const missionById = (id: string) =>
  MISSIONS.find((mission) => mission.id === id) ?? null;
