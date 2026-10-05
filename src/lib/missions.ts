// Imported by scripts/check-missions.mjs too: types only from other modules.
import type { BodyKey } from '@/lib/planets';

// Historical missions for the replay mode. Each trajectory is a JPL Horizons
// reconstruction (scripts/fetch-missions.mjs → public/missions/<id>.json);
// the events and phases here are from the agencies' own timelines, checked
// against the data itself (closest approaches, record distances and burns
// show up in the vectors to the minute). Missions marked `reconstructed`
// have no such data: their paths are rebuilt from published figures by
// scripts/reconstruct-missions.mjs, and the panel says so.

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
    | 'mars2020'
    | 'sputnik1'
    | 'vostok1'
    | 'apollo8'
    | 'apollo11'
    | 'apollo13'
    | 'change4'
    | 'change5'
    | 'tianwen1';
  /** Around the Sun rather than around Earth. */
  kind?: 'helio';
  /** Rebuilt from published figures, not tracking data. */
  reconstructed?: boolean;
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
  {
    id: 'sputnik1',
    reconstructed: true,
    en: 'Sputnik 1',
    zh: '斯普特尼克 1 号',
    tagline: {
      en: '1957 · the first artificial satellite',
      zh: '1957 · 第一颗人造卫星',
    },
    summary: {
      en: 'A polished 58 cm sphere with four antennas, launched by the Soviet Union on an R-7 rocket from Baikonur. Its radio beeps, picked up by amateurs around the world, opened the space age. It circled Earth every 96 minutes for three months and burned up in January 1958.',
      zh: '一个直径 58 cm、带四根天线的抛光金属球，由苏联用 R-7 火箭从拜科努尔发射。它的“嘀嘀”无线电信号被世界各地的业余爱好者收到，开启了太空时代。它每 96 分钟绕地球一圈，三个月后于 1958 年 1 月再入大气层烧毁。',
    },
    launch: '1957-10-04T19:28:34Z',
    agency: 'USSR',
    color: '#dfe5ef',
    craft: [{ en: 'Sputnik 1', zh: '斯普特尼克 1 号', color: '#dfe5ef' }],
    frames: ['earth'],
    note: {
      en: 'Reconstructed from the published orbit (215 × 939 km, 65.1°); the first day of three months.',
      zh: '根据公布的轨道（215 × 939 km，倾角 65.1°）重建，只画三个月中的第一天。',
    },
    phases: [
      {
        from: '1957-10-04T19:28:34Z',
        en: 'Launch',
        zh: '发射',
        about: {
          en: 'The R-7, built as an intercontinental missile, lifts off from Baikonur in Kazakhstan and heads north-east.',
          zh: '原本作为洲际导弹研制的 R-7 火箭从哈萨克斯坦的拜科努尔起飞，向东北方向爬升。',
        },
        shot: { aim: 'craft', zoom: 3 },
        speed: 60,
      },
      {
        from: '1957-10-04T19:34Z',
        en: 'In orbit',
        zh: '在轨运行',
        about: {
          en: 'About five minutes after liftoff the satellite separates at about 8 km/s. The 26 m core stage reached orbit too: the bright moving “star” people saw at dusk was the rocket stage, not the small sphere.',
          zh: '起飞约 5 分钟后，卫星以约 8 km/s 的速度与火箭分离。26 m 长的芯级也进了轨道：人们在黄昏看到的那颗移动的“亮星”其实是火箭芯级，而不是这个小球。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 600,
      },
    ],
    events: [
      { at: '1957-10-04T19:28:34Z', en: 'Liftoff', zh: '起飞' },
      {
        at: '1957-10-04T19:33:49Z',
        en: 'Separation',
        zh: '星箭分离',
        about: { en: '315 s after liftoff', zh: '起飞后 315 秒' },
      },
      {
        at: '1957-10-04T21:10Z',
        en: 'First orbit complete',
        zh: '绕地球一圈',
        about: { en: '96.2 minutes per orbit', zh: '周期 96.2 分钟' },
      },
    ],
  },
  {
    id: 'vostok1',
    reconstructed: true,
    en: 'Vostok 1',
    zh: '东方 1 号',
    tagline: {
      en: '1961 · Yuri Gagarin, the first human in space',
      zh: '1961 · 加加林，人类首次进入太空',
    },
    summary: {
      en: 'On 12 April 1961 Yuri Gagarin flew once around Earth in 108 minutes: up from Baikonur, over Siberia, the Pacific and Africa, and down near Saratov, where he ejected from the capsule at about 7 km and came down by parachute.',
      zh: '1961 年 4 月 12 日，加加林绕地球飞行一圈，历时 108 分钟：从拜科努尔起飞，飞越西伯利亚、太平洋和非洲上空，最后在萨拉托夫附近返回；他在约 7 km 高度弹射出舱，跳伞落地。',
    },
    launch: '1961-04-12T06:07:00Z',
    agency: 'USSR',
    color: '#ff9580',
    craft: [{ en: 'Vostok', zh: '东方号', color: '#ff9580' }],
    frames: ['earth'],
    note: {
      en: 'Reconstructed from the published orbit (181 × 327 km, 64.95°) and times; the re-entry and descent are a sketch.',
      zh: '根据公布的轨道（181 × 327 km，倾角 64.95°）和时间重建，再入和降落段为示意。',
    },
    phases: [
      {
        from: '1961-04-12T06:07:00Z',
        en: 'Launch',
        zh: '发射',
        about: {
          en: '“Poyekhali!” — “Let’s go!” A three-stage R-7 puts the 4.7-tonne Vostok into orbit about ten minutes later.',
          zh: '“Poyekhali！”（“我们出发了！”）三级 R-7 火箭约 10 分钟后把 4.7 吨重的东方号送入轨道。',
        },
        shot: { aim: 'craft', zoom: 3 },
        speed: 60,
      },
      {
        from: '1961-04-12T06:18Z',
        en: 'One orbit',
        zh: '绕地球一圈',
        about: {
          en: 'The flight is automatic. Nobody knew how a person would cope with weightlessness, so the manual controls were locked; the code was in a sealed envelope on board.',
          zh: '整个飞行由自动系统控制。当时没人知道人在失重下会怎样，手动控制被锁住，解锁密码封在舱内的信封里。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 60,
      },
      {
        from: '1961-04-12T07:22Z',
        en: 'Re-entry',
        zh: '返回',
        about: {
          en: 'Over Africa the retro-rocket fires for about 40 seconds. The equipment module fails to separate cleanly and the capsule tumbles until the cables between them burn through in the atmosphere.',
          zh: '在非洲上空，制动发动机点火约 40 秒。仪器舱没能干净分离，返回舱一路翻滚，直到两者之间的电缆在大气中烧断。',
        },
        shot: { aim: 'craft', zoom: 3 },
        speed: 60,
      },
    ],
    events: [
      { at: '1961-04-12T06:07:00Z', en: 'Liftoff', zh: '起飞' },
      { at: '1961-04-12T06:17:00Z', en: 'In orbit', zh: '入轨' },
      { at: '1961-04-12T07:25:00Z', en: 'Retrofire', zh: '制动点火' },
      {
        at: '1961-04-12T07:55:00Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'Near Smelovka, Saratov region',
          zh: '萨拉托夫州斯梅洛夫卡村附近',
        },
      },
    ],
  },
  {
    id: 'apollo8',
    reconstructed: true,
    en: 'Apollo 8',
    zh: '阿波罗 8 号',
    tagline: {
      en: '1968 · the first humans around the Moon',
      zh: '1968 · 人类首次环绕月球',
    },
    summary: {
      en: 'Frank Borman, Jim Lovell and Bill Anders rode the first crewed Saturn V out of Earth orbit, circled the Moon ten times over Christmas Eve 1968 and photographed “Earthrise”.',
      zh: '博尔曼、洛弗尔和安德斯乘第一枚载人土星五号火箭飞离地球轨道，1968 年平安夜前后绕月飞行 10 圈，拍下了著名的《地出》照片。',
    },
    launch: '1968-12-21T12:51:00Z',
    agency: 'NASA',
    color: '#a9c9ff',
    craft: [
      { en: 'Command/service module', zh: '指令/服务舱', color: '#a9c9ff' },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Reconstructed by numerical integration from published burn times and orbits (Apollo by the Numbers); not tracking data.',
      zh: '根据公布的点火时间和轨道（《Apollo by the Numbers》）数值积分重建，不是实测轨迹。',
    },
    phases: [
      {
        from: '1968-12-21T12:51:00Z',
        en: 'Earth orbit',
        zh: '地球停泊轨道',
        about: {
          en: 'Almost three hours in a 185 km parking orbit while the crew and Mission Control check the spacecraft.',
          zh: '先在约 185 km 高的停泊轨道上飞近三个小时，宇航员和地面检查飞船状态。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '1968-12-21T15:35Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: {
          en: 'The third stage fires again for over five minutes: for the first time, people leave Earth’s orbit.',
          zh: '第三级再次点火五分多钟——人类第一次飞离地球轨道。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
      {
        from: '1968-12-21T16:00Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'Nearly three days of coasting, with television pictures of a shrinking Earth sent home on the way.',
          zh: '近三天的滑行，途中向地面传回越来越小的地球的电视画面。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1968-12-24T09:30Z',
        en: 'Ten orbits of the Moon',
        zh: '绕月十圈',
        about: {
          en: 'Behind the Moon, out of radio contact, the engine brakes them into lunar orbit. On the fourth orbit Anders photographs Earth rising over the lunar horizon; Lovell calls Earth “a grand oasis in the big vastness of space”, and that evening the crew reads from Genesis on live television.',
          zh: '在月球背面、与地面失联时，发动机点火减速进入环月轨道。第四圈时安德斯拍下地球从月平线升起的照片；洛弗尔说地球是“广阔太空中的一片绿洲”，当晚宇航员在电视直播中朗读《创世记》。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '1968-12-25T06:00Z',
        en: 'Home',
        zh: '返回地球',
        about: {
          en: 'The burn home happens behind the Moon on Christmas morning. “Please be informed, there is a Santa Claus,” Lovell radios when they reappear.',
          zh: '圣诞节清晨，返回点火同样在月球背面进行。飞船重新出现时，洛弗尔报告：“请注意，圣诞老人是存在的。”',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1968-12-27T15:25Z',
        en: 'Re-entry',
        zh: '再入大气层',
        about: {
          en: 'The command module hits the atmosphere at about 11 km/s and splashes down in the Pacific before dawn.',
          zh: '指令舱以约 11 km/s 的速度再入大气层，黎明前溅落在太平洋。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
    ],
    events: [
      {
        at: '1968-12-21T15:41:38Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: { en: '5 min 18 s burn', zh: '点火 5 分 18 秒' },
      },
      {
        at: '1968-12-24T09:59:20Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: { en: '4 min 7 s burn', zh: '点火 4 分 7 秒' },
      },
      { at: '1968-12-24T16:40Z', en: 'Earthrise', zh: '《地出》' },
      {
        at: '1968-12-25T06:10:16Z',
        en: 'Trans-Earth injection',
        zh: '月地转移点火',
      },
      {
        at: '1968-12-27T15:51:42Z',
        en: 'Splashdown',
        zh: '溅落',
        about: { en: 'Pacific Ocean', zh: '太平洋' },
      },
    ],
  },
  {
    id: 'apollo11',
    reconstructed: true,
    en: 'Apollo 11',
    zh: '阿波罗 11 号',
    tagline: {
      en: '1969 · the first landing on the Moon',
      zh: '1969 · 人类首次登月',
    },
    summary: {
      en: 'Neil Armstrong and Buzz Aldrin landed Eagle in the Sea of Tranquility on 20 July 1969 and stayed about 21½ hours, while Michael Collins circled overhead in Columbia. They lifted off, docked, and the three splashed down in the Pacific four days later.',
      zh: '1969 年 7 月 20 日，阿姆斯特朗和奥尔德林驾驶“鹰”号登月舱降落在静海，在月面停留约 21.5 小时；柯林斯在“哥伦比亚”号指令舱里绕月等待。两人起飞与指令舱对接后，三人一同返回，溅落在太平洋。',
    },
    launch: '1969-07-16T13:32:00Z',
    agency: 'NASA',
    color: '#9fd0ff',
    craft: [
      {
        en: 'Columbia (CSM)',
        zh: '哥伦比亚号（指令/服务舱）',
        color: '#9fd0ff',
      },
      { en: 'Eagle (lunar module)', zh: '鹰号（登月舱）', color: '#ffd27f' },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Reconstructed by numerical integration from published burn times and orbits (Apollo by the Numbers); the landing, ascent and re-entry are sketches.',
      zh: '根据公布的点火时间和轨道（《Apollo by the Numbers》）数值积分重建；下降、上升和再入为示意。',
    },
    phases: [
      {
        from: '1969-07-16T13:32:00Z',
        en: 'Launch and Earth orbit',
        zh: '发射与停泊轨道',
        about: {
          en: 'The Saturn V puts the stack into a 185 km parking orbit in twelve minutes; one and a half orbits of checks follow.',
          zh: '土星五号用 12 分钟把飞船送入约 185 km 的停泊轨道，随后绕地球一圈半做检查。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '1969-07-16T16:10Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: {
          en: 'The third stage fires for almost six minutes over the Pacific; Columbia then turns round to pull Eagle out of its housing.',
          zh: '第三级在太平洋上空点火近 6 分钟；随后哥伦比亚号掉头，把鹰号从火箭整流罩里“拔”出来。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
      {
        from: '1969-07-16T16:40Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'Three days of coasting. Only one of four planned corrections was needed.',
          zh: '约三天的滑行，原定四次中途修正只用了一次。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1969-07-19T17:00Z',
        en: 'Lunar orbit',
        zh: '环月轨道',
        about: {
          en: 'Braking behind the Moon, then a second burn makes the orbit nearly circular, 100 to 120 km up.',
          zh: '在月球背面减速入轨，第二次点火把轨道修成接近圆形，高度 100–120 km。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '1969-07-20T19:00Z',
        en: 'The landing',
        zh: '降落',
        about: {
          en: 'Eagle drops to 15 km and starts its powered descent. Computer alarms, then a boulder field: Armstrong flies on by hand and lands with little fuel to spare. “The Eagle has landed.”',
          zh: '鹰号降到 15 km 高度后开始动力下降。先是计算机报警，接着发现着陆点满是巨石，阿姆斯特朗改为手动驾驶，着陆时燃料已所剩无几。“鹰已着陆。”',
        },
        shot: { aim: 'body', zoom: 0.8 },
        speed: 60,
        frame: 'moon',
      },
      {
        from: '1969-07-20T20:30Z',
        en: 'On the Moon',
        zh: '月面活动',
        about: {
          en: '“One small step for [a] man, one giant leap for mankind.” Two and a half hours outside: a flag, experiments, 21.5 kg of rock and soil.',
          zh: '“这是个人的一小步，却是人类的一大步。”两人在舱外活动约两个半小时：插国旗、布置实验、采集 21.5 kg 岩石和土壤。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '1969-07-21T17:45Z',
        en: 'Ascent and docking',
        zh: '起飞与对接',
        about: {
          en: 'The ascent stage lifts off, leaving the descent stage behind as a launch pad, and catches up with Columbia in under four hours.',
          zh: '上升级以下降级为发射台起飞，不到四小时就追上哥伦比亚号并对接。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 600,
        frame: 'moon',
      },
      {
        from: '1969-07-22T04:30Z',
        en: 'Home',
        zh: '返回地球',
        about: {
          en: 'Behind the Moon, Columbia’s engine fires for two and a half minutes; two and a half days later they reach Earth.',
          zh: '哥伦比亚号在月球背面点火两分半钟，两天半后回到地球。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1969-07-24T16:20Z',
        en: 'Splashdown',
        zh: '溅落',
        about: {
          en: 'Re-entry at 11 km/s; the crew is picked up by USS Hornet and spends three weeks in quarantine.',
          zh: '以 11 km/s 的速度再入大气层，宇航员被大黄蜂号航母接回，随后隔离三周。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
    ],
    events: [
      {
        at: '1969-07-16T16:16:16Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
        about: { en: '5 min 47 s burn', zh: '点火 5 分 47 秒' },
      },
      {
        at: '1969-07-19T17:21:50Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: { en: '5 min 58 s burn', zh: '点火 5 分 58 秒' },
      },
      { at: '1969-07-20T17:44Z', en: 'Eagle undocks', zh: '鹰号分离' },
      {
        at: '1969-07-20T20:05:05Z',
        en: 'Powered descent',
        zh: '动力下降',
      },
      {
        at: '1969-07-20T20:17:40Z',
        en: 'Landing',
        zh: '着陆',
        about: { en: 'Sea of Tranquility', zh: '静海' },
      },
      { at: '1969-07-21T02:56Z', en: 'First step', zh: '迈出第一步' },
      { at: '1969-07-21T17:54Z', en: 'Liftoff', zh: '月面起飞' },
      { at: '1969-07-21T21:35Z', en: 'Docking', zh: '对接' },
      {
        at: '1969-07-22T04:55:42Z',
        en: 'Trans-Earth injection',
        zh: '月地转移点火',
      },
      {
        at: '1969-07-24T16:50:35Z',
        en: 'Splashdown',
        zh: '溅落',
        about: { en: 'Pacific Ocean', zh: '太平洋' },
      },
    ],
  },
  {
    id: 'apollo13',
    reconstructed: true,
    en: 'Apollo 13',
    zh: '阿波罗 13 号',
    tagline: {
      en: '1970 · “Houston, we’ve had a problem”',
      zh: '1970 · “休斯敦，我们遇到了问题”',
    },
    summary: {
      en: 'Fifty-six hours out, an oxygen tank exploded in the service module. Jim Lovell, Jack Swigert and Fred Haise used the lunar module Aquarius as a lifeboat: its engine put them back on a free return around the Moon and then sped up the trip home.',
      zh: '飞行 56 小时后，服务舱的一个氧气罐爆炸。洛弗尔、斯威格特和海斯把“水瓶座”号登月舱当作救生艇：先用它的发动机让飞船回到绕月自由返回轨道，绕过月球后再点火加速回家。',
    },
    launch: '1970-04-11T19:13:00Z',
    agency: 'NASA',
    color: '#c7b8ff',
    craft: [
      {
        en: 'Odyssey + Aquarius',
        zh: '奥德赛号 + 水瓶座号',
        color: '#c7b8ff',
      },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Reconstructed by numerical integration from published burn times and the planned flyby (Apollo by the Numbers); not tracking data.',
      zh: '根据公布的点火时间和飞越参数（《Apollo by the Numbers》）数值积分重建，不是实测轨迹。',
    },
    phases: [
      {
        from: '1970-04-11T19:13:00Z',
        en: 'Launch',
        zh: '发射',
        about: {
          en: 'A second-stage engine shuts down early; the others burn longer and the flight goes on as planned.',
          zh: '第二级一台发动机提前关机，其余发动机多烧了一会儿补上，飞行照常进行。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '1970-04-11T22:00Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'A day and a half out, a small burn takes them off the free-return path toward the planned landing at Fra Mauro.',
          zh: '出发一天半后，一次小点火让飞船离开自由返回轨道，转向原定的弗拉·毛罗着陆区。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1970-04-14T02:30Z',
        en: '“We’ve had a problem”',
        zh: '“我们遇到了问题”',
        about: {
          en: 'Oxygen tank 2 explodes; the service module loses its oxygen and power. Five hours later Aquarius’ descent engine puts them back on a free return.',
          zh: '2 号氧气罐爆炸，服务舱的氧气和电力随之耗尽。五小时后，水瓶座号的下降发动机点火，让飞船回到自由返回轨道。',
        },
        shot: { aim: 'craft', zoom: 30 },
        speed: 600,
      },
      {
        from: '1970-04-14T22:00Z',
        en: 'Around the Moon',
        zh: '绕过月球',
        about: {
          en: 'They swing 254 km over the far side and reach 400,171 km from Earth, still the farthest humans have been (until Artemis II). Two hours later a second burn shortens the trip home.',
          zh: '飞船从月球背面 254 km 高处掠过，到达距地球 400,171 km 处，创下人类到达最远距离的纪录（直到阿尔忒弥斯 2 号）。两小时后再次点火，缩短回家的时间。',
        },
        shot: { aim: 'body', zoom: 6 },
        speed: 600,
        frame: 'moon',
      },
      {
        from: '1970-04-15T04:00Z',
        en: 'The cold way home',
        zh: '寒冷的归途',
        about: {
          en: 'Near freezing, short of water, with carbon dioxide rising until a fix made of tape, plastic bags and cardboard adapts the command module’s filters.',
          zh: '舱内接近冰点，饮水短缺，二氧化碳浓度不断升高——直到宇航员用胶带、塑料袋和硬纸板把指令舱的滤罐改装后接到登月舱上。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '1970-04-17T17:40Z',
        en: 'Splashdown',
        zh: '溅落',
        about: {
          en: 'They leave Aquarius behind an hour before re-entry and splash down safely in the South Pacific.',
          zh: '再入前约一小时抛掉水瓶座号，最终安全溅落在南太平洋。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
      },
    ],
    events: [
      {
        at: '1970-04-11T21:48:46Z',
        en: 'Translunar injection',
        zh: '地月转移点火',
      },
      {
        at: '1970-04-13T01:53:49Z',
        en: 'Leaving the free return',
        zh: '离开自由返回轨道',
      },
      {
        at: '1970-04-14T03:07:53Z',
        en: 'Oxygen tank explodes',
        zh: '氧气罐爆炸',
      },
      {
        at: '1970-04-14T08:42:43Z',
        en: 'Back to a free return',
        zh: '回到自由返回轨道',
        about: {
          en: 'Lunar module engine, about 35 s',
          zh: '登月舱发动机点火约 35 秒',
        },
      },
      {
        at: '1970-04-15T00:21Z',
        en: 'Behind the Moon',
        zh: '飞越月球背面',
        about: { en: '254 km above the far side', zh: '距月面 254 km' },
      },
      {
        at: '1970-04-15T02:40:39Z',
        en: 'Speeding up',
        zh: '加速返回',
        about: { en: '4 min 24 s burn', zh: '点火 4 分 24 秒' },
      },
      {
        at: '1970-04-17T18:07:41Z',
        en: 'Splashdown',
        zh: '溅落',
        about: { en: 'South Pacific', zh: '南太平洋' },
      },
    ],
  },
  {
    id: 'change4',
    reconstructed: true,
    en: 'Chang’e 4 + Queqiao',
    zh: '嫦娥四号 + 鹊桥',
    tagline: {
      en: '2018–19 · the first soft landing on the far side',
      zh: '2018–19 · 人类首次在月球背面软着陆',
    },
    summary: {
      en: 'The far side never faces Earth, so a lander there cannot talk to us directly. China first sent the relay satellite Queqiao to a halo orbit around the Earth–Moon L2 point, about 65,000 km beyond the Moon; seven months later Chang’e 4 landed in Von Kármán crater and released the Yutu-2 rover.',
      zh: '月球背面永远背对地球，着陆器无法直接与地面通信。中国先把“鹊桥”中继星送到月球后方约 6.5 万 km 的地月 L2 点晕轨道；七个月后，嫦娥四号降落在冯·卡门撞击坑，放出玉兔二号月球车。',
    },
    launch: '2018-05-20T21:28:00Z',
    agency: 'CNSA',
    color: '#ffcf7a',
    craft: [
      { en: 'Queqiao relay', zh: '鹊桥中继星', color: '#7fe0d0' },
      { en: 'Chang’e 4 lander', zh: '嫦娥四号着陆器', color: '#ffcf7a' },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Reconstructed from published times and orbits by numerical integration; Queqiao’s transfer to L2, its halo orbit (a linear model) and the lander’s orbit adjustments are sketches.',
      zh: '根据公布的时间和轨道参数数值积分重建；鹊桥飞往 L2 点的转移段、晕轨道（线性模型）以及着陆器的轨道调整为示意。',
    },
    phases: [
      {
        from: '2018-05-20T21:28:00Z',
        en: 'Queqiao launches',
        zh: '鹊桥发射',
        about: {
          en: 'A Long March 4C from Xichang sends the relay satellite toward the Moon. Its name, “magpie bridge”, comes from the folk tale of the cowherd and the weaver girl.',
          zh: '长征四号丙火箭从西昌把中继星送往月球。“鹊桥”的名字来自牛郎织女的传说。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '2018-05-20T22:10Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'Four and a half days to the Moon.',
          zh: '约四天半飞到月球。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 21600,
      },
      {
        from: '2018-05-25T08:00Z',
        en: 'Past the Moon',
        zh: '近月制动',
        about: {
          en: 'About 100 km above the Moon, a braking burn lets it swing past onto the slow path out to L2.',
          zh: '在距月面约 100 km 处减速，借月球引力转向，慢慢飞往 L2 点。',
        },
        shot: { aim: 'body', zoom: 6 },
        speed: 600,
        frame: 'moon',
      },
      {
        from: '2018-05-26T00:00Z',
        en: 'Out to L2',
        zh: '飞往 L2 点',
        about: {
          en: 'Beyond the Moon, Earth’s and the Moon’s pulls together hold a spacecraft in step with the Moon. Shown turning with the Moon, Queqiao drifts out there over three weeks.',
          zh: '在月球后方，地球和月球的引力合起来能让航天器跟着月球同步绕地球转。在随月球旋转的参考系里，可以看到鹊桥用三周时间慢慢飘到那里。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 86400,
        frame: 'earthMoon',
      },
      {
        from: '2018-06-14T03:06Z',
        en: 'Halo orbit',
        zh: '晕轨道',
        about: {
          en: 'Queqiao loops around L2 every two weeks, never behind the Moon as seen from Earth, so it can see both Earth and the far side: the first relay satellite there.',
          zh: '鹊桥每两周绕 L2 点一圈。从地球看去，它始终不会被月球挡住，因此能同时看到地球和月球背面——这是人类第一颗位于这里的中继卫星。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 86400,
        frame: 'earthMoon',
      },
      {
        from: '2018-12-07T18:00Z',
        en: 'Chang’e 4 launches',
        zh: '嫦娥四号发射',
        about: {
          en: 'Half a year later, a Long March 3B launches the lander from Xichang in the early hours of 8 December, Beijing time.',
          zh: '半年后，长征三号乙火箭于北京时间 12 月 8 日凌晨从西昌发射着陆器。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
        frame: 'earth',
      },
      {
        from: '2018-12-07T19:00Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'About four and a half days, with one course correction.',
          zh: '约四天半的旅程，途中做了一次轨道修正。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 21600,
        frame: 'earth',
      },
      {
        from: '2018-12-12T07:00Z',
        en: 'Lunar orbit',
        zh: '环月飞行',
        about: {
          en: 'Braking 100 km above the Moon, then three weeks in lunar orbit, waiting for sunrise over the landing site.',
          zh: '在距月面约 100 km 处制动入轨，随后在环月轨道上飞行约三周，等待着陆区迎来日出。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 21600,
        frame: 'moon',
      },
      {
        from: '2019-01-03T01:50Z',
        en: 'Landing on the far side',
        zh: '降落月球背面',
        about: {
          en: 'From 15 km, an 11-minute powered descent; at the end it hovers, picks a flat spot, and touches down in Von Kármán crater inside the South Pole–Aitken basin.',
          zh: '从 15 km 高度开始约 11 分钟的动力下降，最后悬停、避开障碍，降落在南极–艾特肯盆地内的冯·卡门撞击坑。',
        },
        shot: { aim: 'body', zoom: 0.8 },
        speed: 60,
        frame: 'moon',
      },
      {
        from: '2019-01-03T02:40Z',
        en: 'Yutu-2',
        zh: '玉兔二号',
        about: {
          en: 'The rover rolls down a ramp that evening; it went on to drive across the far side for years.',
          zh: '当晚，月球车沿滑梯驶上月面，此后在月球背面行驶了多年。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
    ],
    events: [
      { at: '2018-05-20T21:28:00Z', en: 'Queqiao launches', zh: '鹊桥发射' },
      {
        at: '2018-05-25T13:46Z',
        en: 'Braking near the Moon',
        zh: '鹊桥近月制动',
        about: { en: 'About 100 km up', zh: '距月面约 100 km' },
      },
      {
        at: '2018-06-14T03:06Z',
        en: 'Halo orbit',
        zh: '进入晕轨道',
        about: {
          en: 'About 65,000 km beyond the Moon',
          zh: '月球后方约 6.5 万 km',
        },
      },
      {
        at: '2018-12-07T18:23:34Z',
        en: 'Chang’e 4 launches',
        zh: '嫦娥四号发射',
      },
      {
        at: '2018-12-12T08:39Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: { en: 'About 100 km up', zh: '近月点约 100 km' },
      },
      {
        at: '2018-12-30T00:55Z',
        en: 'Lowered orbit',
        zh: '降轨',
        about: { en: '15 × 100 km', zh: '15 × 100 km' },
      },
      { at: '2019-01-03T02:15Z', en: 'Powered descent', zh: '动力下降' },
      {
        at: '2019-01-03T02:26Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'Von Kármán crater, 45.4° S 177.6° E',
          zh: '冯·卡门撞击坑，南纬 45.4°，东经 177.6°',
        },
      },
      {
        at: '2019-01-03T14:22Z',
        en: 'Yutu-2 on the surface',
        zh: '玉兔二号驶上月面',
      },
    ],
  },
  {
    id: 'change5',
    reconstructed: true,
    en: 'Chang’e 5',
    zh: '嫦娥五号',
    tagline: {
      en: '2020 · bringing Moon rock home',
      zh: '2020 · 月球采样返回',
    },
    summary: {
      en: 'Four spacecraft in one: orbiter, returner, lander and ascender. The lander drilled and scooped 1,731 g of soil in Oceanus Procellarum; the ascender carried it up to the orbiter, and the returner skipped off the atmosphere before landing in Inner Mongolia — the first lunar samples brought home since 1976.',
      zh: '“四器一体”：轨道器、返回器、着陆器和上升器。着陆器在风暴洋钻取和铲取了 1731 g 月壤，上升器把样品送回环月轨道交给轨道器，返回器以“打水漂”的方式再入大气层，降落在内蒙古。这是 1976 年以来人类首次从月球带回样品。',
    },
    launch: '2020-11-23T20:30:12Z',
    agency: 'CNSA',
    color: '#ff9d8a',
    craft: [
      { en: 'Orbiter + returner', zh: '轨道器 + 返回器', color: '#ff9d8a' },
      { en: 'Lander + ascender', zh: '着陆器 + 上升器', color: '#ffd98a' },
    ],
    frames: ['earth', 'moon', 'earthMoon'],
    note: {
      en: 'Reconstructed from published times and orbits by numerical integration; the lander’s and ascender’s orbit changes, the rendezvous and the skip re-entry are sketches.',
      zh: '根据公布的时间和轨道参数数值积分重建；着陆器和上升器的变轨、交会对接以及跳跃式再入为示意。',
    },
    phases: [
      {
        from: '2020-11-23T20:30:12Z',
        en: 'Launch',
        zh: '发射',
        about: {
          en: 'A Long March 5 from Wenchang, Hainan, sends the 8.2-tonne stack straight toward the Moon.',
          zh: '长征五号火箭从海南文昌起飞，把 8.2 吨重的探测器直接送入地月转移轨道。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 600,
      },
      {
        from: '2020-11-23T21:10Z',
        en: 'To the Moon',
        zh: '奔月',
        about: {
          en: 'Four and a half days, with two course corrections.',
          zh: '约四天半的旅程，途中做了两次轨道修正。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
      },
      {
        from: '2020-11-28T12:30Z',
        en: 'Lunar orbit',
        zh: '环月飞行',
        about: {
          en: 'A 17-minute braking burn, then a second one into a circular orbit about 200 km up. The lander and ascender then leave the orbiter and returner.',
          zh: '先点火 17 分钟减速，第二次制动后进入约 200 km 高的圆轨道。随后着陆器和上升器与轨道器和返回器分离。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '2020-12-01T14:40Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'A 14-minute powered descent from 15 km to the plains near Mons Rümker.',
          zh: '从 15 km 高度开始约 14 分钟的动力下降，降落在吕姆克山附近的平原。',
        },
        shot: { aim: 'body', zoom: 0.8 },
        speed: 60,
        frame: 'moon',
      },
      {
        from: '2020-12-01T15:20Z',
        en: 'Sampling',
        zh: '采样',
        about: {
          en: 'About 19 hours of drilling and scooping, sealed into a container in the ascender.',
          zh: '约 19 小时的钻取和表取采样，样品封装进上升器的容器里。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '2020-12-03T15:00Z',
        en: 'Ascent and docking',
        zh: '起飞与对接',
        about: {
          en: 'The ascender lifts off from the lander, reaches lunar orbit in six minutes, and two days later docks with the orbiter: the first robotic docking in lunar orbit.',
          zh: '上升器以着陆器为发射台起飞，约 6 分钟进入环月轨道，两天后与轨道器交会对接——这是人类首次在月球轨道上进行无人交会对接。',
        },
        shot: { aim: 'body', zoom: 3 },
        speed: 3600,
        frame: 'moon',
      },
      {
        from: '2020-12-12T01:30Z',
        en: 'Home',
        zh: '返回地球',
        about: {
          en: 'Two burns a day apart send the orbiter and returner back toward Earth.',
          zh: '相隔一天的两次点火，把轨道器和返回器送上返回地球的轨道。',
        },
        shot: { aim: 'path', zoom: 'fit' },
        speed: 3600,
        frame: 'earth',
      },
      {
        from: '2020-12-16T16:50Z',
        en: 'Skip re-entry',
        zh: '跳跃式再入',
        about: {
          en: 'The returner hits the atmosphere at almost 11 km/s, skips back out like a stone on water to shed speed, re-enters and lands under its parachute in Siziwang Banner.',
          zh: '返回器以接近第二宇宙速度再入大气层，像打水漂一样先“弹”出大气层减速，再次进入后开伞，降落在四子王旗。',
        },
        shot: { aim: 'craft', zoom: 4 },
        speed: 60,
        frame: 'earth',
      },
    ],
    events: [
      { at: '2020-11-24T14:06Z', en: 'Correction 1', zh: '第一次轨道修正' },
      { at: '2020-11-25T14:06Z', en: 'Correction 2', zh: '第二次轨道修正' },
      {
        at: '2020-11-28T12:58Z',
        en: 'Lunar orbit insertion',
        zh: '近月制动',
        about: {
          en: 'About 400 km up, 17 minutes',
          zh: '距月面约 400 km，点火约 17 分钟',
        },
      },
      {
        at: '2020-11-29T12:23Z',
        en: 'Circular orbit',
        zh: '进入圆轨道',
        about: { en: 'About 200 km up', zh: '高度约 200 km' },
      },
      {
        at: '2020-11-29T20:40Z',
        en: 'Lander separates',
        zh: '着上组合体分离',
      },
      { at: '2020-12-01T14:57Z', en: 'Powered descent', zh: '动力下降' },
      {
        at: '2020-12-01T15:11Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'Near Mons Rümker, 43.1° N 51.9° W',
          zh: '吕姆克山附近，北纬 43.1°，西经 51.9°',
        },
      },
      { at: '2020-12-03T15:10Z', en: 'Ascent', zh: '月面起飞' },
      { at: '2020-12-05T21:42Z', en: 'Docking', zh: '交会对接' },
      {
        at: '2020-12-12T01:54Z',
        en: 'Trans-Earth injection 1',
        zh: '第一次月地入射',
      },
      {
        at: '2020-12-13T01:51Z',
        en: 'Trans-Earth injection 2',
        zh: '第二次月地入射',
      },
      {
        at: '2020-12-16T17:33Z',
        en: 'Atmospheric entry',
        zh: '再入大气层',
        about: { en: 'About 120 km up', zh: '高度约 120 km' },
      },
      {
        at: '2020-12-16T17:59Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'Siziwang Banner, Inner Mongolia',
          zh: '内蒙古四子王旗',
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
  {
    id: 'tianwen1',
    kind: 'helio',
    reconstructed: true,
    en: 'Tianwen-1',
    zh: '天问一号',
    tagline: {
      en: '2020 · orbit, land and rove on the first try',
      zh: '2020 · 一次实现“绕、着、巡”',
    },
    summary: {
      en: 'China’s first Mars mission sent an orbiter, a lander and the Zhurong rover together. After three months in orbit surveying the landing area, the lander touched down in Utopia Planitia on 15 May 2021, Beijing time.',
      zh: '中国首次火星探测任务，环绕器、着陆器和祝融号火星车一同出发。环绕火星三个月、勘察预选着陆区后，着陆器于北京时间 2021 年 5 月 15 日降落在乌托邦平原。',
    },
    launch: '2020-07-23T04:41:15Z',
    agency: 'CNSA',
    color: '#ff9a6b',
    craft: [
      { en: 'Orbiter', zh: '环绕器', color: '#ff9a6b' },
      { en: 'Lander + Zhurong', zh: '着陆巡视器', color: '#ffd27f' },
    ],
    frames: ['sun', 'mars'],
    note: {
      en: 'Reconstructed from published times and orbits with two-body arcs (Sun, Earth, Mars); course corrections, including the deep-space manoeuvre of October 2020, are not drawn. Times are at Mars.',
      zh: '按公布的时间和轨道参数，用二体轨道（太阳、地球、火星）分段拼接重建；途中的轨道修正（包括 2020 年 10 月的深空机动）没有单独画出。时间按火星当地的事件时刻。',
    },
    phases: [
      {
        from: '2020-07-23T04:41:15Z',
        en: 'Launch',
        zh: '发射',
        about: {
          en: 'A Long March 5 from Wenchang sends the five-tonne spacecraft straight onto its path to Mars.',
          zh: '长征五号火箭从文昌起飞，把约 5 吨重的探测器直接送入地火转移轨道。',
        },
        shot: { aim: 'craft', zoom: 6 },
        speed: 60,
      },
      {
        from: '2020-07-23T05:30Z',
        en: 'Cruise to Mars',
        zh: '奔火巡航',
        about: {
          en: 'Six and a half months and some 470 million km, with four course corrections and a deep-space manoeuvre in October.',
          zh: '约六个半月、4.7 亿 km 的旅程，途中做了四次轨道修正和一次深空机动。',
        },
        shot: { aim: 'path', zoom: au(1.9) },
        speed: 604800,
        frame: 'sun',
      },
      {
        from: '2021-02-08T12:00Z',
        en: 'Into Mars orbit',
        zh: '火星捕获',
        about: {
          en: 'A braking burn of about 15 minutes near Mars lets its gravity capture the spacecraft, on a long orbit of about ten Martian days.',
          zh: '在火星附近点火制动约 15 分钟，被火星引力捕获，进入周期约 10 个火星日的大椭圆轨道。',
        },
        shot: {
          aim: 'body',
          body: 'mars',
          zoom: radii('mars', 70),
        },
        speed: 21600,
        frame: 'mars',
      },
      {
        from: '2021-02-15T00:00Z',
        en: 'Surveying from orbit',
        zh: '环火勘察',
        about: {
          en: 'At the far point the orbit is turned over the poles; then it shrinks to a parking orbit of two Martian days, from which the orbiter photographs the landing area for three months.',
          zh: '在远火点把轨道调整为经过两极的极轨道，随后缩小为周期 2 个火星日的停泊轨道，环绕器在这条轨道上对预选着陆区拍摄了三个月。',
        },
        shot: {
          aim: 'body',
          body: 'mars',
          zoom: radii('mars', 30),
        },
        speed: 86400,
        frame: 'mars',
      },
      {
        from: '2021-05-14T20:00Z',
        en: 'Landing',
        zh: '着陆',
        about: {
          en: 'The lander separates, enters the atmosphere at about 4.8 km/s and, with a heat shield, a parachute and its engine, comes to rest in Utopia Planitia nine minutes later.',
          zh: '着陆巡视器分离后以约 4.8 km/s 的速度进入火星大气，依靠防热罩、降落伞和发动机减速，约 9 分钟后降落在乌托邦平原。',
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
      { at: '2020-07-23T04:41:15Z', en: 'Launch', zh: '发射' },
      {
        at: '2020-10-09T15:00Z',
        en: 'Deep-space manoeuvre',
        zh: '深空机动',
      },
      {
        at: '2021-02-10T11:52Z',
        en: 'Mars orbit insertion',
        zh: '火星捕获',
        about: { en: 'About 400 km up', zh: '近火点约 400 km' },
      },
      {
        at: '2021-02-15T09:00Z',
        en: 'Polar orbit',
        zh: '调整为极轨道',
      },
      {
        at: '2021-02-23T22:29Z',
        en: 'Parking orbit',
        zh: '进入停泊轨道',
        about: { en: 'Two Martian days per orbit', zh: '周期 2 个火星日' },
      },
      {
        at: '2021-05-14T20:20Z',
        en: 'Lander separates',
        zh: '两器分离',
      },
      {
        at: '2021-05-14T23:18Z',
        en: 'Touchdown',
        zh: '着陆',
        about: {
          en: 'Utopia Planitia, 25.1° N 109.9° E',
          zh: '乌托邦平原，北纬 25.1°，东经 109.9°',
        },
      },
    ],
  },
];
MISSIONS.push(...HELIO_MISSIONS);

export const missionById = (id: string) =>
  MISSIONS.find((mission) => mission.id === id) ?? null;
