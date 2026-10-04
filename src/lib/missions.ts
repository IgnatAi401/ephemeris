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
export type FrameId = 'earth' | 'moon' | 'earthMoon' | 'sunEarth';
export const FRAMES: Record<FrameId, { en: string; zh: string }> = {
  earth: { en: 'Earth-centred', zh: '地心' },
  moon: { en: 'Moon-centred', zh: '月心' },
  earthMoon: { en: 'Earth–Moon rotating', zh: '地月旋转' },
  sunEarth: { en: 'Sun–Earth rotating', zh: '日地旋转' },
};

/** What the camera looks at and how wide (Earth radii, as SceneView.zoom);
 * `fit` frames the whole path. */
export type Shot = { aim: 'earth' | 'moon' | 'craft'; zoom: number | 'fit' };
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
  id: 'artemis2' | 'artemis1' | 'chandrayaan3' | 'jwst' | 'capstone';
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
        shot: { aim: 'earth', zoom: 16 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'moon', zoom: 6 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'moon', zoom: 3 },
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
        shot: { aim: 'moon', zoom: 22 },
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
        shot: { aim: 'moon', zoom: 22 },
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
        shot: { aim: 'moon', zoom: 22 },
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
        shot: { aim: 'moon', zoom: 3 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'earth', zoom: 12 },
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
        shot: { aim: 'earth', zoom: 26 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'moon', zoom: 4 },
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
        shot: { aim: 'moon', zoom: 3 },
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
        shot: { aim: 'moon', zoom: 0.8 },
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
        shot: { aim: 'moon', zoom: 0.6 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'earth', zoom: 4 },
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
        shot: { aim: 'earth', zoom: 16 },
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
        shot: { aim: 'earth', zoom: 'fit' },
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
        shot: { aim: 'moon', zoom: 20 },
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

export const missionById = (id: string) =>
  MISSIONS.find((mission) => mission.id === id) ?? null;
