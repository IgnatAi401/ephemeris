// Manually maintained background information. No remote catalogue or update
// script is involved. Keep exact launch dates on individual objects; a family's
// first launch is not the launch date of every satellite in that family.
import type { CatalogEntry } from './catalog';
import type { SpacecraftKey } from './ephemeris';
import type { ConstellationKey } from './orbits';
import { CONSTELLATIONS } from './orbits.ts';

export type ProfileText = { en: string; zh: string };
export type ObjectProfile = {
  name?: ProfileText;
  affiliation?: ProfileText;
  operator?: ProfileText;
  mission: ProfileText;
  summary: ProfileText;
  /** ISO date, UTC. Only use a date verified for this particular object. */
  launch?: string;
  launchSite?: ProfileText;
  event?: { date: string; label: ProfileText };
  sources: { name: string; href: string }[];
};
const text = (en: string, zh: string): ProfileText => ({ en, zh });
const source = (name: string, href: string) => ({ name, href });
const US = text('United States', '美国');
const CHINA = text('China', '中国');
const RUSSIA = text('Russia', '俄罗斯');
const ISS_SOURCE = source(
  'NASA',
  'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
);
const CATALOG_SOURCE = source(
  'CelesTrak',
  'https://celestrak.org/satcat/satcat-format.php',
);
const COLLISION_SOURCE = source(
  'NASA',
  'https://www.nasa.gov/science-research/the-day-nasas-fermi-dodged-a-1-5-ton-bullet/',
);
const GOES_SOURCE = source(
  'NOAA',
  'https://www.ncei.noaa.gov/products/satellite/goes-r',
);

/** One background per data group. GEO, stations and recent launches are
 * catalogue groupings, so their fallback must not invent a common mission. */
export const GROUP_PROFILES: Record<ConstellationKey, ObjectProfile> = {
  starlink: {
    affiliation: US,
    operator: text('SpaceX', 'SpaceX'),
    mission: text('Starlink · broadband internet', '星链 · 宽带互联网'),
    summary: text(
      'Part of SpaceX’s low-Earth-orbit internet constellation. Many moving satellites pass connections between one another to reach areas with limited ground infrastructure. Their relatively low altitude reduces signal travel time compared with geostationary links.',
      'SpaceX 建设的低轨卫星互联网星座成员。大量卫星在地球周围不断移动、接力传递连接，为地面网络难以覆盖的地区提供宽带服务。相比地球静止轨道，较低的飞行高度缩短了信号传播时间。',
    ),
    sources: [source('Starlink', 'https://starlink.com/sb/technology')],
  },
  iridium: {
    affiliation: US,
    operator: text('Iridium', '铱星通信公司'),
    mission: text(
      'Iridium NEXT · mobile communications',
      '铱星 NEXT · 移动通信',
    ),
    summary: text(
      'A member of the second-generation Iridium communications network. Near-polar orbits and links between satellites let the network carry calls and data over oceans and polar regions, supporting ships, aircraft and people beyond terrestrial mobile coverage.',
      '第二代铱星通信网络的成员。卫星沿接近极地的轨道飞行，并通过星间链路传递信号，让海洋和极区也能获得语音与数据通信，服务于船舶、飞机和远离地面移动网络的用户。',
    ),
    sources: [source('Iridium', 'https://www.iridium.com/network')],
  },
  orbcomm: {
    affiliation: US,
    operator: text('ORBCOMM', 'ORBCOMM'),
    mission: text('ORBCOMM · satellite IoT', 'ORBCOMM · 卫星物联网'),
    summary: text(
      'Part of ORBCOMM’s low-orbit data network. It carries small messages for connected equipment rather than ordinary broadband browsing: remote assets can report their position and condition even when cellular coverage is unavailable.',
      'ORBCOMM 低轨数据通信网络的成员，主要传输设备之间的小型消息。车辆、货物和偏远地区的设备可以通过卫星报告位置与状态，在没有蜂窝移动网络的地方继续保持联系。',
    ),
    sources: [source('ORBCOMM', 'https://www.orbcomm.com/about-us')],
  },
  gps: {
    affiliation: US,
    operator: text('U.S. Space Force', '美国太空军'),
    mission: text('GPS · positioning and timing', 'GPS · 定位与授时'),
    summary: text(
      'One of the satellites in the United States’ Global Positioning System. It broadcasts its orbit and precise time from an onboard atomic clock. A receiver compares signals from several satellites to determine its position and clock offset.',
      '美国全球定位系统的一颗卫星，通过无线电广播自身轨道和星载原子钟给出的精确时间。手机或导航设备比较多颗卫星的信号传播时间，就能求出自己的位置，并校正时钟误差。',
    ),
    sources: [source('GPS.gov', 'https://www.gps.gov/space-segment')],
  },
  glonass: {
    affiliation: RUSSIA,
    mission: text('GLONASS · satellite navigation', '格洛纳斯 · 卫星导航'),
    summary: text(
      'A satellite in Russia’s GLONASS navigation system. Its medium-Earth-orbit constellation broadcasts timing and orbit information for positioning. Receivers can combine GLONASS with other navigation systems to improve the number and geometry of satellites in view.',
      '俄罗斯格洛纳斯卫星导航系统的成员。中轨卫星持续广播时间与轨道信息，供地面接收机定位。接收机可以把它与 GPS、北斗等系统联合使用，增加可用卫星数量，改善观测方向的分布。',
    ),
    sources: [
      source(
        'ESA Navipedia',
        'https://gssc.esa.int/navipedia/index.php/GLONASS',
      ),
    ],
  },
  galileo: {
    affiliation: text('European Union', '欧盟'),
    mission: text('Galileo · civilian navigation', '伽利略 · 民用卫星导航'),
    summary: text(
      'Part of the European Union’s civilian satellite navigation system. Galileo satellites broadcast precise timing signals from medium Earth orbit for positioning and timing; the system also supports search and rescue and can be used alongside other navigation constellations.',
      '欧盟民用卫星导航系统的成员。伽利略卫星在中轨广播精确的时间信号，提供定位与授时服务，并支持搜救。它可以与其他导航星座一起使用，帮助接收机在更多环境下找到足够的卫星。',
    ),
    sources: [
      source(
        'ESA',
        'https://www.esa.int/Applications/Satellite_navigation/Galileo/What_is_Galileo',
      ),
    ],
  },
  beidou: {
    affiliation: CHINA,
    mission: text('BeiDou · navigation and timing', '北斗 · 导航与授时'),
    summary: text(
      'A satellite in China’s BeiDou navigation system. BeiDou combines medium-Earth, inclined geosynchronous and geostationary orbits. Different satellites play different roles in navigation, timing and messaging; the orbit readouts below describe this particular satellite.',
      '中国北斗卫星导航系统的成员。北斗把中圆轨道、倾斜地球同步轨道和地球静止轨道组合在一起，不同卫星分工提供导航、授时与通信服务。下方的轨道读数对应你选中的这一颗卫星。',
    ),
    sources: [
      source(
        '北斗卫星导航系统',
        'https://www.beidou.gov.cn/zy/kpyd/202007/t20200713_20772.html',
      ),
    ],
  },
  qianfan: {
    affiliation: CHINA,
    operator: text(
      'Shanghai Spacecom Satellite Technology',
      '上海垣信卫星科技有限公司',
    ),
    mission: text('Qianfan · broadband internet', '千帆星座 · 宽带互联网'),
    summary: text(
      'Part of the Qianfan low-Earth-orbit internet constellation, developed and operated by Shanghai Spacecom Satellite Technology. The satellites are deployed in batches to build a network for broadband communications and internet access.',
      '由上海垣信卫星科技有限公司建设和运营的低轨卫星互联网星座成员。千帆卫星分批发射、逐步组网，通过大量低轨卫星提供宽带通信和互联网接入服务。',
    ),
    sources: [
      source(
        '工业和信息化部',
        'https://www.miit.gov.cn/xwfb/gxdt/sjdt/art/2026/art_b4bbc68e008d43ec84e60505229e6960.html',
      ),
    ],
  },
  guowang: {
    affiliation: CHINA,
    mission: text('Guowang · satellite internet', '国网 · 卫星互联网'),
    summary: text(
      'A member of the Chinese satellite internet grouping identified as Guowang in the orbital catalogue. Satellites are deployed in batches to build an orbital communications network. Detailed payload specifications for this individual satellite have not been added here.',
      '轨道目录中归入“国网”的中国卫星互联网目标。卫星通过分批发射逐步建立在轨通信网络。这里介绍的是所属项目的背景，本颗卫星的具体载荷配置尚未补录。',
    ),
    sources: [
      source(
        '工业和信息化部',
        'https://www.miit.gov.cn/jgsj/wgj/gzdt/art/2026/art_ff35b1bf6d6a47f7a9732da343bb556e.html',
      ),
    ],
  },
  stations: {
    mission: text('Space-station catalogue group', '空间站相关目标'),
    summary: text(
      'This catalogue group includes station modules, visiting spacecraft, released small satellites and some nearby objects. Membership alone does not establish this object’s operator or purpose. Its individual background has not yet been documented here.',
      '空间站目录还会收录来访飞船、释放的小卫星和部分相关目标，并非每个光点都是空间站舱段。本目标的具体任务与所属机构尚未补录，可以通过名称和国际编号查阅下方目录来源。',
    ),
    sources: [CATALOG_SOURCE],
  },
  geo: {
    mission: text('Geosynchronous-orbit background', '地球同步轨道背景'),
    summary: text(
      'Objects in this group orbit roughly once per sidereal day. An almost circular equatorial orbit can keep a satellite above the same region, useful for communications and weather monitoring. This orbital grouping alone does not identify this object’s actual mission or operating status.',
      '这组目标的绕地周期接近地球自转周期。接近圆形、位于赤道上方的轨道能让卫星长期停留在同一地区上空，适合通信与气象观测。不过，仅凭轨道分组无法判断本目标的具体任务或是否仍在工作。',
    ),
    sources: [
      source('NOAA', 'https://www.ncei.noaa.gov/products/satellite/goes-r'),
    ],
  },
  debrisFy1c: {
    affiliation: CHINA,
    mission: text('Fengyun-1C debris', '风云一号 C 碎片'),
    summary: text(
      'A tracked fragment associated with the Fengyun-1C weather satellite, destroyed in a 2007 anti-satellite test. A fragment has no active mission or propulsion: it follows its own orbit and can remain a collision hazard long after the original spacecraft has gone.',
      '与风云一号 C 气象卫星有关的可跟踪碎片。原卫星在 2007 年反卫星试验中被摧毁，形成大量碎片。这些目标不再执行任务，也没有主动避碰能力，却可能长期留在轨道上，威胁其他航天器。',
    ),
    event: {
      date: '2007-01-11',
      label: text('Fragmentation event', '碎片形成事件'),
    },
    sources: [
      source('NASA NTRS', 'https://ntrs.nasa.gov/search.jsp?R=20080014830'),
    ],
  },
  debrisCosmos2251: {
    affiliation: RUSSIA,
    mission: text('Cosmos 2251 collision debris', '宇宙 2251 碰撞碎片'),
    summary: text(
      'A fragment of the defunct Russian communications satellite Cosmos 2251. It collided with Iridium 33 in 2009, producing two clouds of debris. Each tracked piece receives its own catalogue number; its orbit can differ substantially from that of the original satellite.',
      '失效的俄罗斯通信卫星宇宙 2251 的碎片。它在 2009 年与铱星 33 相撞，两颗卫星形成了各自的碎片云。每块可跟踪碎片都有独立的目录编号，轨道也可能与原卫星明显不同。',
    ),
    event: {
      date: '2009-02-10',
      label: text('Collision event', '碰撞形成日期'),
    },
    sources: [COLLISION_SOURCE],
  },
  debrisIridium33: {
    affiliation: US,
    mission: text('Iridium 33 collision debris', '铱星 33 碰撞碎片'),
    summary: text(
      'A fragment of the American Iridium 33 communications satellite, which collided with Cosmos 2251 in 2009. It is no longer a working Iridium satellite. The breakup spread pieces across different orbits, and tracking them helps other spacecraft avoid collisions.',
      '美国铱星 33 通信卫星的碎片，来源于 2009 年与宇宙 2251 的碰撞。这个光点已经不是仍在工作的铱星。碰撞把碎片散布到不同轨道，持续跟踪这些目标有助于其他航天器避碰。',
    ),
    event: {
      date: '2009-02-10',
      label: text('Collision event', '碰撞形成日期'),
    },
    sources: [COLLISION_SOURCE],
  },
  recent: {
    mission: text('Recently catalogued launch objects', '近期发射相关目标'),
    summary: text(
      'An object from the catalogue’s recent-launch group, which can include spacecraft, rocket stages and released objects with very different purposes. Its individual mission has not yet been documented here. A recent listing does not by itself establish the date it separated or began operating.',
      '近期发射分组中的一个目标。这组既可能包含卫星，也可能包含火箭级或释放物，各自用途不同。本目标的具体任务尚未补录；进入近期目录也不等于在那一天分离或开始工作。',
    ),
    sources: [CATALOG_SOURCE],
  },
};

// More specific family matches are useful in mixed catalogue groups. Keep
// patterns narrow: a GEO orbit, a launch vehicle or a station association must
// never be used to guess the payload's nationality or mission.
const FAMILIES: { match: RegExp; profile: ObjectProfile }[] = [
  { match: /^STARLINK(?:-|\s)/i, profile: GROUP_PROFILES.starlink },
  { match: /^QIANFAN\s/i, profile: GROUP_PROFILES.qianfan },
  { match: /^(?:GUOWANG|HULIANWANG)\s/i, profile: GROUP_PROFILES.guowang },
  {
    match: /^TDRS\s\d/i,
    profile: {
      affiliation: US,
      operator: text('NASA', 'NASA'),
      mission: text('TDRS · space communications relay', 'TDRS · 航天通信中继'),
      summary: text(
        'A NASA Tracking and Data Relay Satellite. From geosynchronous orbit it relays signals between ground stations and lower-orbit spacecraft, reducing the communication gaps that occur when a spacecraft flies beyond the horizon of a ground antenna.',
        'NASA 的跟踪与数据中继卫星。在地球同步轨道上，它把较低轨道航天器的信号转发给地面站，减少航天器飞出地面天线视野时的通信中断，为空间科学与载人任务提供数据通道。',
      ),
      sources: [
        source(
          'NASA',
          'https://www.nasa.gov/mission/tracking-and-data-relay-satellites/',
        ),
      ],
    },
  },
  {
    match: /^GOES\s\d/i,
    profile: {
      affiliation: US,
      operator: text('NOAA', '美国国家海洋和大气管理局（NOAA）'),
      mission: text('GOES · weather observation', 'GOES · 气象观测'),
      summary: text(
        'A satellite in NOAA’s geostationary weather programme. Watching the same region repeatedly lets these spacecraft follow developing clouds and storms. The programme also observes space weather; this family description does not imply that every listed satellite remains operational.',
        '美国 NOAA 地球静止轨道气象卫星系列的成员。反复观测同一片区域，可以追踪云系和风暴的发展；该系列还承担空间天气观测。这里介绍系列用途，不表示目录中的每颗卫星都仍在服役。',
      ),
      sources: [GOES_SOURCE],
    },
  },
  {
    match: /^CREW DRAGON\s/i,
    profile: {
      affiliation: US,
      operator: text('SpaceX', 'SpaceX'),
      mission: text('Crew Dragon · crew transport', '载人龙飞船 · 人员运输'),
      summary: text(
        'SpaceX’s crew transport spacecraft, used for NASA Commercial Crew missions to the International Space Station. It carries people and supplies to orbit and can return them to Earth. The numbered catalogue entry refers to a particular flight, not the first launch of the Dragon programme.',
        'SpaceX 的载人运输飞船，用于 NASA 商业载人计划中的国际空间站任务。它把乘员和物资送入轨道，并能把乘员带回地球。目录名称中的编号对应某次具体飞行，不是龙飞船系列的首次发射。',
      ),
      sources: [source('NASA', 'https://www.nasa.gov/commercial-crew/')],
    },
  },
  {
    match: /^CYGNUS\s/i,
    profile: {
      affiliation: US,
      operator: text('Northrop Grumman', '诺斯罗普·格鲁曼'),
      mission: text('Cygnus · station resupply', '天鹅座飞船 · 空间站补给'),
      summary: text(
        'An uncrewed cargo spacecraft used to deliver experiments, equipment and supplies to the International Space Station. After its visit, Cygnus can carry waste away from the station and is disposed of by re-entry into Earth’s atmosphere.',
        '为国际空间站运送实验设备、日用品和其他物资的无人货运飞船。完成补给后，天鹅座飞船可以装载空间站的废弃物离站，随后通过再入地球大气层结束飞行。',
      ),
      sources: [source('NASA', 'https://www.nasa.gov/northrop-grumman/')],
    },
  },
  {
    match: /^PROGRESS[- ]MS\s/i,
    profile: {
      affiliation: RUSSIA,
      mission: text('Progress · station resupply', '进步号 · 空间站补给'),
      summary: text(
        'A Russian uncrewed cargo spacecraft supplying the International Space Station with items such as fuel and provisions. Its propulsion can also help adjust the station’s orbit. Progress is a cargo vehicle rather than a crew-return capsule.',
        '俄罗斯的无人货运飞船，为国际空间站输送燃料、补给等物资，推进系统也可用于帮助调整空间站轨道。进步号主要承担补给任务，不是运送乘员返回地球的飞船。',
      ),
      sources: [ISS_SOURCE],
    },
  },
  {
    match: /^SOYUZ[- ]MS\s/i,
    profile: {
      affiliation: RUSSIA,
      mission: text('Soyuz · crew transport', '联盟号 · 人员运输'),
      summary: text(
        'A Russian crew spacecraft used to travel to and from the International Space Station. While docked, it can serve as a return vehicle for its crew. Its descent module is designed to bring people back through the atmosphere to a landing on land.',
        '俄罗斯载人飞船，用于往返国际空间站。对接期间，它也承担乘员返回地球的任务。返回舱经过大气层减速，再依靠降落伞等系统在陆地着陆。',
      ),
      sources: [ISS_SOURCE],
    },
  },
  {
    match: /^TIANZHOU[- ]\d/i,
    profile: {
      affiliation: CHINA,
      mission: text('Tianzhou · Tiangong resupply', '天舟 · 天宫补给'),
      summary: text(
        'China’s uncrewed cargo spacecraft for the Tiangong space station. Tianzhou delivers consumables, equipment and propellant, supporting long crew stays in orbit. The spacecraft is expendable and ends its flight by controlled atmospheric re-entry.',
        '为空间站天宫提供补给的中国无人货运飞船。天舟运送生活物资、设备与推进剂，支持航天员长期驻留；它不搭载乘员返回地面，飞行结束后受控再入大气层。',
      ),
      sources: [source('中国载人航天工程', 'https://en.cmse.gov.cn/missions/')],
    },
  },
  {
    match: /^SHENZHOU[- ]\d/i,
    profile: {
      affiliation: CHINA,
      mission: text('Shenzhou · crew transport', '神舟 · 人员运输'),
      summary: text(
        'China’s crew spacecraft, used to carry astronauts to and from the Tiangong space station. The orbital, return and propulsion modules have different roles; only the return capsule brings the crew back to Earth.',
        '中国载人飞船，用于把航天员送往天宫空间站并接回地球。轨道舱、返回舱和推进舱各自承担不同职责，最终只有返回舱载着乘员回到地面。',
      ),
      sources: [source('中国载人航天工程', 'https://en.cmse.gov.cn/missions/')],
    },
  },
];

/** Exact identities take precedence over families. Add a verified NORAD
 * number here to provide an individual story, UTC launch date and launch site. */
export const SATELLITE_PROFILES: Record<number, ObjectProfile> = {
  25544: {
    name: text('International Space Station', '国际空间站'),
    affiliation: text(
      'United States · Russia · Europe · Japan · Canada',
      '美国 · 俄罗斯 · 欧洲 · 日本 · 加拿大',
    ),
    mission: text('ISS · orbital research laboratory', 'ISS · 在轨科研实验室'),
    summary: text(
      'An orbital laboratory assembled through international cooperation. Its first module, Zarya, launched in 1998; many later flights built the station around it. Crews carry out microgravity research and test technologies for living and working in space. This date is the first module’s launch.',
      '由多方合作在轨组装的科研实验室。1998 年曙光号首舱发射，此后多次任务陆续扩建。航天员在这里开展微重力研究，并验证长期太空生活与工作所需的技术。下列日期对应首舱发射，不是整座空间站一次性升空。',
    ),
    launch: '1998-11-20',
    launchSite: text('Baikonur, Kazakhstan', '哈萨克斯坦 · 拜科努尔'),
    sources: [
      ISS_SOURCE,
      source(
        'NASA · Zarya',
        'https://www.nasa.gov/international-space-station/zarya-module/',
      ),
    ],
  },
  36086: {
    name: text('Poisk', '探索号（Poisk）'),
    affiliation: RUSSIA,
    mission: text('ISS · docking and research module', 'ISS · 对接与研究舱'),
    summary: text(
      'A small Russian module attached to the International Space Station. Poisk provides docking facilities and supports spacewalks and research. Although separately catalogued, it is a part of the station rather than a free-flying satellite while attached.',
      '国际空间站的俄罗斯小型舱段，为飞船提供对接口，并支持出舱活动与科学研究。它有独立的目录编号，但连接在空间站上时，与空间站一起飞行，并不是独立运行的卫星。',
    ),
    launch: '2009-11-10',
    launchSite: text('Baikonur, Kazakhstan', '哈萨克斯坦 · 拜科努尔'),
    sources: [
      source(
        'NASA',
        'https://www.nasa.gov/international-space-station/poisk-mini-research-module-2-yezof/',
      ),
    ],
  },
  49044: {
    name: text('Nauka', '科学号（Nauka）'),
    affiliation: RUSSIA,
    mission: text('ISS · multipurpose laboratory module', 'ISS · 多用途实验舱'),
    summary: text(
      'The Russian multipurpose laboratory module of the International Space Station. Launched in 2021, it adds space for scientific experiments and work and carries the European Robotic Arm. Once attached, its motion follows that of the whole station.',
      '国际空间站的俄罗斯多用途实验舱。2021 年发射，为科学实验和在轨工作增加空间，并携带欧洲机械臂。对接后，它随整座空间站共同运行。',
    ),
    launch: '2021-07-21',
    launchSite: text('Baikonur, Kazakhstan', '哈萨克斯坦 · 拜科努尔'),
    sources: [
      source(
        'NASA',
        'https://www.nasa.gov/blogs/spacestation/2021/07/21/liftoff-multipurpose-laboratory-module-nauka-launches-to-space-station/',
      ),
    ],
  },
  48274: {
    name: text('Tianhe core module', '天和核心舱'),
    affiliation: CHINA,
    mission: text('Tiangong · core module', '天宫 · 核心舱'),
    summary: text(
      'The core of China’s Tiangong space station, launched in 2021. Tianhe provides living space for astronauts and key systems for controlling the station and supporting life. The Wentian and Mengtian laboratory modules later joined it to form the main station.',
      '中国天宫空间站的核心舱，2021 年发射。天和提供航天员生活空间，并承担空间站管理、控制和生命保障等关键功能。问天、梦天实验舱随后与它连接，组成空间站主体。',
    ),
    launch: '2021-04-29',
    launchSite: text('Wenchang, China', '中国 · 文昌'),
    sources: [
      source(
        '中国载人航天工程',
        'https://en.cmse.gov.cn/news/202105/t20210528_48002.html',
      ),
    ],
  },
  53239: {
    name: text('Wentian laboratory module', '问天实验舱'),
    affiliation: CHINA,
    mission: text('Tiangong · laboratory module', '天宫 · 实验舱'),
    summary: text(
      'A laboratory module of China’s Tiangong space station, launched in July 2022. Wentian provides facilities for scientific experiments, additional astronaut living space and an airlock for spacewalks, expanding the station’s research and operational capabilities.',
      '中国天宫空间站的实验舱，2022 年 7 月发射。问天提供科学实验设施、额外的航天员生活空间和用于出舱活动的气闸舱，扩展了空间站的科研与运行能力。',
    ),
    launch: '2022-07-24',
    launchSite: text('Wenchang, China', '中国 · 文昌'),
    sources: [
      source('中国载人航天工程', 'https://en.cmse.gov.cn/missions/wentian/'),
    ],
  },
  54216: {
    name: text('Mengtian laboratory module', '梦天实验舱'),
    affiliation: CHINA,
    mission: text('Tiangong · laboratory module', '天宫 · 实验舱'),
    summary: text(
      'The second laboratory module of China’s Tiangong space station, launched in October 2022. It provides experimental facilities and a cargo airlock for transferring equipment outside. With Tianhe and Wentian it forms the station’s main T-shaped configuration.',
      '中国天宫空间站的第二个实验舱，2022 年 10 月发射。梦天配备科学实验设施和把设备送到舱外的货物气闸舱，与天和、问天共同组成空间站主体的 T 字构型。',
    ),
    launch: '2022-10-31',
    launchSite: text('Wenchang, China', '中国 · 文昌'),
    sources: [
      source('中国载人航天工程', 'https://en.cmse.gov.cn/missions/mengtian/'),
    ],
  },
};

export const SPACECRAFT_PROFILES: Record<SpacecraftKey, ObjectProfile> = {
  soho: {
    name: text(
      'Solar and Heliospheric Observatory',
      '太阳与日球层探测器（SOHO）',
    ),
    affiliation: text('Europe · United States', '欧洲 · 美国'),
    operator: text('ESA / NASA', 'ESA / NASA'),
    mission: text('SOHO · solar observation', 'SOHO · 太阳观测'),
    summary: text(
      'A joint ESA–NASA observatory studying the Sun’s interior, atmosphere and solar wind. Its orbit near the Sun–Earth L1 point gives it a nearly continuous view of the Sun. It launched in 1995, and its observations help researchers understand solar activity and space weather.',
      '欧洲航天局与 NASA 合作的太阳观测任务，研究太阳内部、外层大气和太阳风。它在日地 L1 点附近运行，能近乎连续地观测太阳。1995 年发射以来，其数据帮助科学家研究太阳活动与空间天气。',
    ),
    launch: '1995-12-02',
    launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
    sources: [
      source(
        'ESA',
        'https://www.esa.int/Science_Exploration/Space_Science/SOHO',
      ),
      source(
        'ESA · launch',
        'https://www.esa.int/Newsroom/Press_Releases/Successful_launch_of_SOHO',
      ),
    ],
  },
  jwst: {
    name: text('James Webb Space Telescope', '詹姆斯·韦伯空间望远镜'),
    affiliation: text(
      'United States · Europe · Canada',
      '美国 · 欧洲 · 加拿大',
    ),
    operator: text('NASA / ESA / CSA', 'NASA / ESA / CSA'),
    mission: text('Webb · infrared astronomy', '韦伯 · 红外天文学'),
    summary: text(
      'An infrared space telescope developed by NASA, ESA and CSA. Its segmented mirror and sunshield let it study early galaxies, star formation and exoplanet atmospheres. It observes from an orbit around Sun–Earth L2, keeping the Sun and Earth on the sunshield side.',
      'NASA、欧洲航天局与加拿大航天局合作研制的红外空间望远镜。分块主镜和大型遮阳罩帮助它研究早期星系、恒星形成与系外行星大气。它绕日地 L2 点运行，让太阳和地球始终位于遮阳罩同一侧。',
    ),
    launch: '2021-12-25',
    launchSite: text('Kourou, French Guiana', '法属圭亚那 · 库鲁'),
    sources: [
      source(
        'NASA',
        'https://science.nasa.gov/missions/webb/nasas-webb-telescope-launches-to-see-first-galaxies-distant-worlds/',
      ),
    ],
  },
  euclid: {
    name: text('Euclid', '欧几里得空间望远镜'),
    affiliation: text('Europe', '欧洲'),
    operator: text('ESA', '欧洲航天局（ESA）'),
    mission: text('Euclid · the dark Universe', '欧几里得 · 暗宇宙探测'),
    summary: text(
      'ESA’s space telescope mapping galaxies to investigate dark matter and dark energy. By measuring galaxy shapes and distances, Euclid traces the large-scale structure of the Universe and its expansion. It launched in 2023 and observes near Sun–Earth L2.',
      '欧洲航天局研究暗物质和暗能量的空间望远镜。通过测量星系的形状与距离，欧几里得描绘宇宙大尺度结构，并研究宇宙如何膨胀。它于 2023 年发射，在日地 L2 点附近开展观测。',
    ),
    launch: '2023-07-01',
    launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
    sources: [
      source(
        'ESA',
        'https://www.esa.int/Science_Exploration/Space_Science/Euclid_overview',
      ),
    ],
  },
  lro: {
    name: text('Lunar Reconnaissance Orbiter', '月球勘测轨道飞行器（LRO）'),
    affiliation: US,
    operator: text('NASA', 'NASA'),
    mission: text('LRO · lunar mapping', 'LRO · 月球测绘'),
    summary: text(
      'NASA’s lunar orbiter, launched in 2009. It maps the Moon’s terrain and environment, photographs landing sites and studies polar regions. Its close lunar orbit provides detailed observations that support lunar science and planning for future exploration.',
      'NASA 的月球轨道探测器，2009 年发射。它测绘月球地形与环境、拍摄历史着陆点，并研究极区。近距离环月飞行带来的细致观测，为月球科学和后续探测任务规划提供依据。',
    ),
    launch: '2009-06-18',
    launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
    sources: [source('NASA', 'https://science.nasa.gov/mission/lro/about/')],
  },
  danuri: {
    name: text(
      'Danuri · Korea Pathfinder Lunar Orbiter',
      'Danuri · 韩国探路者月球轨道器',
    ),
    affiliation: text('South Korea', '韩国'),
    operator: text('KARI', '韩国航空宇宙研究院（KARI）'),
    mission: text('Danuri · lunar exploration', 'Danuri · 月球探测'),
    summary: text(
      'South Korea’s first lunar orbiter, developed by KARI with international contributions. It took a fuel-saving transfer to the Moon to study the surface and demonstrate exploration technologies. NASA’s ShadowCam aboard it images permanently shadowed lunar terrain.',
      '韩国首个月球轨道探测器，由韩国航空宇宙研究院研制并开展国际合作。它沿节省燃料的路线前往月球，研究月面并验证探测技术。搭载的 NASA ShadowCam 相机用于拍摄月球永久阴影区。',
    ),
    launch: '2022-08-04',
    launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
    sources: [
      source('KARI', 'https://www.kari.re.kr/eng/contents/193'),
      source(
        'NASA · launch (UTC date)',
        'https://www.nasa.gov/blogs/missions/2022/08/04/nasas-shadowcam-launches-aboard-korea-pathfinder-lunar-orbiter/',
      ),
    ],
  },
};

const ROCKET: ObjectProfile = {
  mission: text('Rocket body · launch remnant', '火箭体 · 发射遗留物'),
  summary: text(
    'A catalogued rocket body rather than a working satellite. After carrying a payload to space, a rocket stage can remain in orbit. It does not perform the payload’s mission, and the rocket’s name alone does not establish the payload’s operator or nationality.',
    '这是编目中的火箭体，不是正在执行任务的卫星。火箭级把载荷送入太空后，可能继续留在轨道上。它不承担原载荷的任务，仅凭火箭名称也不能确定载荷的所属国家或运营机构。',
  ),
  sources: [CATALOG_SOURCE],
};
const DEBRIS: ObjectProfile = {
  mission: text('Debris · separated object', '碎片 · 分离物'),
  summary: text(
    'The catalogue identifies this object as debris. It can be a fragment or a discarded component, with no independent active mission. Its catalogue designator can be associated with the parent launch; that does not establish when this piece separated or formed.',
    '目录名称将本目标标为碎片，可能是破裂碎片或被丢弃的组件，本身不承担独立的主动任务。它的国际编号可能沿用原发射事件的信息，不能据此认定这块碎片的分离或形成日期。',
  ),
  sources: [CATALOG_SOURCE],
};

/** Manually verified launch batches. Both the catalogue group and designator
 * must match; other rideshare payloads, deployed objects and debris must not
 * inherit these dates. Dates use UTC, including Iridium-4 and ORBCOMM OG2-2. */
const IRIDIUM_LAUNCHES = [
  [
    '2017-003',
    '2017-01-14',
    'january-14-2017-iridium-announces-successful-first-launch-of-iridium-next-satellites',
  ],
  [
    '2017-039',
    '2017-06-25',
    'June-25-2017-successful-second-launch-doubles-the-number-of-iridium-R-next-satellites-in-space',
  ],
  [
    '2017-061',
    '2017-10-09',
    'october-9-2017-successful-third-iridium-R-next-launch-brings-new-services-closer-to-life',
  ],
  [
    '2017-083',
    '2017-12-23',
    '12-22-2017-iridium-next-launch-campaign-reaches-its-halfway-point-with-a-fourth-successful-launch',
  ],
  [
    '2018-030',
    '2018-03-30',
    'Mar-30-2018-fifth-successful-iridium-R-next-launch-completed-as-iridium-surpasses-1-million-subscribers',
  ],
  [
    '2018-047',
    '2018-05-22',
    '2018-05-022-Iridium-Completes-Sixth-Successful-Iridium-R-NEXT-Launch',
  ],
  [
    '2018-061',
    '2018-07-25',
    '2018-07-25-Iridium-Completes-Seventh-Successful-Iridium-R-NEXT-Launch',
  ],
  [
    '2019-002',
    '2019-01-11',
    '2019-01-11-Iridium-Completes-Historic-Satellite-Launch-Campaign',
  ],
  [
    '2023-068',
    '2023-05-20',
    '2023-05-20-Iridium-Adds-to-Constellation-Resilience-with-Launch-of-Spare-Satellites',
  ],
] as const;
type LaunchProfile = Required<
  Pick<ObjectProfile, 'launch' | 'launchSite' | 'sources'>
>;
export const LAUNCH_PROFILES: Partial<
  Record<ConstellationKey, Record<string, LaunchProfile>>
> = {
  iridium: Object.fromEntries(
    IRIDIUM_LAUNCHES.map(([id, launch, release]) => [
      id,
      {
        launch,
        launchSite: text('Vandenberg, United States', '美国 · 范登堡'),
        sources: [
          source('Iridium · launch', `https://investor.iridium.com/${release}`),
        ],
      },
    ]),
  ),
  orbcomm: {
    '2014-040': {
      launch: '2014-07-14',
      launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
      sources: [
        source(
          'SNC · launch',
          'https://www.sncorp.com/news-archive/sierra-nevada-corporation-establishes-initial-communication-to-all-six-on-orbit-orbcomm-generation-2-satellites',
        ),
      ],
    },
    '2015-081': {
      launch: '2015-12-22',
      launchSite: text('Cape Canaveral, United States', '美国 · 卡纳维拉尔角'),
      sources: [
        source(
          'U.S. Space Force · launch',
          'https://www.patrick.spaceforce.mil/News/Article-Display/Article/732882/45th-space-wing-successfully-launches-orbcomm-historically-lands-first-stage-bo/',
        ),
      ],
    },
  },
};

export function satelliteProfile(entry: CatalogEntry) {
  const individual = SATELLITE_PROFILES[entry.norad];
  if (individual) return { profile: individual, scope: 'object' as const };
  const key = CONSTELLATIONS[entry.group].key;
  // The three named debris clouds already have their own event backgrounds.
  if (CONSTELLATIONS[entry.group].kind === 'debris')
    return { profile: GROUP_PROFILES[key], scope: 'family' as const };
  if (/\bR\/B\b/i.test(entry.name))
    return { profile: ROCKET, scope: 'object' as const };
  if (/\bDEB\b/i.test(entry.name))
    return { profile: DEBRIS, scope: 'object' as const };
  const family = FAMILIES.find(({ match }) => match.test(entry.name));
  const background = family?.profile ?? GROUP_PROFILES[key];
  const designator = /^(\d{4}-\d{3})[A-Z]+$/i.exec(entry.cospar)?.[1];
  const launch = designator ? LAUNCH_PROFILES[key]?.[designator] : undefined;
  return {
    profile: launch
      ? {
          ...background,
          ...launch,
          sources: [...background.sources, ...launch.sources],
        }
      : background,
    scope:
      !family && (key === 'stations' || key === 'geo' || key === 'recent')
        ? ('group' as const)
        : ('family' as const),
  };
}
