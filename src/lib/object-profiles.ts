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
  /** Separated from its launch later (debris, stages, released objects), so
   * the designator's launch is not when this object entered free flight. */
  separated?: boolean;
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
    operator: text('Roscosmos', '俄罗斯国家航天集团（Roscosmos）'),
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
    operator: text('EUSPA / ESA', '欧盟空间计划署 / 欧洲航天局'),
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
    operator: text(
      'China Satellite Navigation Office',
      '中国卫星导航系统管理办公室',
    ),
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
    operator: text('China Satellite Network Group', '中国卫星网络集团'),
    mission: text('Guowang · satellite internet', '国网 · 卫星互联网'),
    summary: text(
      'Part of China’s national satellite internet constellation, often called Guowang (“national network”) and run by China Satellite Network Group, founded in 2021. Batches launched on Long March rockets fly at several altitudes and inclinations; together they are planned to form a network of more than ten thousand low-orbit satellites for broadband access.',
      '中国国家卫星互联网星座（常称“国网”）的成员，由 2021 年成立的中国卫星网络集团建设。卫星由长征系列火箭分批发射，分布在多个高度和倾角的轨道面上，规划规模超过一万颗，用于提供宽带接入和通信服务。',
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
      'Besides station modules, this catalogue group lists visiting spacecraft, small satellites released from a station and pieces that drifted away during operations. Objects launched with a station share its designator: 1998-067 is the International Space Station, 2021-035 is Tiangong’s Tianhe module. Free-flying objects near a station usually sink faster than the station, which reboosts regularly.',
      '这一目录分组除了空间站舱段，还收录来访飞船、从空间站释放的小卫星，以及在操作中脱离的物体。随空间站编目的目标沿用其国际编号：1998-067 是国际空间站，2021-035 是天宫的天和核心舱。脱离空间站独立飞行的目标没有定期抬升轨道，通常比空间站下降得更快。',
    ),
    sources: [CATALOG_SOURCE],
  },
  geo: {
    mission: text('Geosynchronous-orbit background', '地球同步轨道背景'),
    summary: text(
      'Objects in this group circle Earth once per sidereal day (23 h 56 min), about 35,786 km above the surface. If the orbit is circular and over the equator, the satellite appears fixed in the sky, so ground dishes need not track it; most are communications or weather satellites. Working satellites fire thrusters to hold their slot; retired ones are raised a few hundred kilometres into a “graveyard” orbit and slowly drift around the planet. Inclination far from 0° means the satellite traces a figure-eight over the ground.',
      '这组目标绕地一圈约等于一个恒星日（23 小时 56 分），离地面约 35,786 km。轨道接近圆形且位于赤道上空时，卫星看上去停在天上不动，地面天线不必转动跟踪，因此多用于通信和气象观测。在役卫星要定期点火保持定点位置；退役后通常被抬高几百千米，进入“坟墓轨道”，在地球周围缓慢漂移。倾角明显大于 0° 的卫星，星下点会在地面画出“8”字形。',
    ),
    sources: [
      source('NOAA', 'https://www.ncei.noaa.gov/products/satellite/goes-r'),
    ],
  },
  debrisFy1c: {
    separated: true,
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
    separated: true,
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
    separated: true,
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
      'An object from a launch in the last 30 days. Every launch puts several catalogued objects in orbit: payloads, upper stages and adapters. The designator below tells you which launch it came from (year, launch number, then a letter for each piece). Names are often provisional at first; tracking networks may need days or weeks to tell which object is which satellite.',
      '最近 30 天内某次发射送入轨道的目标。一次发射通常会编目多个物体：载荷、上面级和分离装置等。下方的国际编号说明它来自哪一次发射（年份、当年第几次发射、再用字母区分各个物体）。新目标的名称起初常是临时的，跟踪网络可能需要几天到几周，才能确认哪个光点是哪颗卫星。',
    ),
    sources: [CATALOG_SOURCE],
  },
};

type Family = { match: RegExp; profile: ObjectProfile };
const family = (
  match: RegExp,
  affiliation: ProfileText | undefined,
  operator: ProfileText | undefined,
  mission: ProfileText,
  summary: ProfileText,
  ...sources: { name: string; href: string }[]
): Family => ({
  match,
  profile: { affiliation, operator, mission, summary, sources },
});
/** A country's own communications satellite; the summary is shared. */
const national = (
  match: RegExp,
  affiliation: ProfileText,
  operator: ProfileText,
  href?: string,
): Family =>
  family(
    match,
    affiliation,
    operator,
    text(
      `${operator.en} · national communications`,
      `${operator.zh} · 国家通信卫星`,
    ),
    text(
      `A communications satellite serving ${affiliation.en} and neighbouring regions with television, telephone and data links. A geostationary satellite can cover islands, mountains and rural areas at once, where laying cables or building towers would be slow and costly; owning one also gives a country its own orbital slot and capacity.`,
      `为${affiliation.zh}及周边地区提供电视、电话和数据通信的卫星。一颗地球静止卫星就能同时覆盖海岛、山区和农村，而在这些地方铺设光缆或建设基站既慢又贵；拥有自己的卫星，也让一个国家掌握自己的轨道位置和通信容量。`,
    ),
    href ? source(operator.en, href) : CATALOG_SOURCE,
  );

const JAPAN = text('Japan', '日本');
const INDIA = text('India', '印度');
const FRANCE = text('France', '法国');
const UK = text('United Kingdom', '英国');
const LUXEMBOURG = text('Luxembourg', '卢森堡');
const ISRO = text('ISRO', '印度空间研究组织（ISRO）');
const ISRO_SOURCE = source('ISRO', 'https://www.isro.gov.in/');
const USSF = text('U.S. Space Force', '美国太空军');
const SPACE_SYSTEMS_SOURCE = source(
  'U.S. Space Systems Command',
  'https://www.ssc.spaceforce.mil/',
);

/** Geosynchronous operators and series. Patterns match the start of the
 * catalogue name; a series name never implies the satellite still operates. */
const GEO_FAMILIES: Family[] = [
  family(
    /^(?:INTELSAT|GALAXY)\s/i,
    LUXEMBOURG,
    text('Intelsat (SES)', 'Intelsat（属 SES）'),
    text('Intelsat · commercial communications', 'Intelsat · 商业卫星通信'),
    text(
      'Intelsat began in 1964 as the intergovernmental consortium that built the first global satellite communications network, carrying live television and international telephone calls across oceans. Now a commercial company, its satellites carry video distribution, corporate and government networks and in-flight connectivity; the Galaxy series mainly serves North America. SES acquired Intelsat in 2025.',
      'Intelsat 于 1964 年作为政府间组织成立，建成了第一个全球卫星通信网络，让电视直播和国际电话跨越大洋。它后来成为商业公司，卫星用于电视节目分发、企业与政府专网和航班上网；Galaxy 系列主要服务北美。2025 年 SES 完成了对 Intelsat 的收购。',
    ),
    source('Intelsat', 'https://www.intelsat.com/'),
  ),
  family(
    /^(?:SES|ASTRA|AMC|NSS)[\s-]/i,
    LUXEMBOURG,
    text('SES', 'SES'),
    text('SES · commercial communications', 'SES · 商业卫星通信'),
    text(
      'SES, headquartered in Luxembourg, is one of the largest satellite operators. Its ASTRA satellites broadcast television directly to home dishes across Europe, with several satellites sharing one orbital position so a single fixed dish can receive them all; other SES, AMC and NSS satellites carry video and data across the Americas, Africa and Asia.',
      'SES 总部位于卢森堡，是规模最大的卫星运营商之一。ASTRA 卫星向欧洲家庭的碟形天线直接广播电视，几颗卫星共用同一个轨道位置，一面固定天线就能同时接收；其他 SES、AMC 和 NSS 卫星为美洲、非洲和亚洲传输视频与数据。',
    ),
    source('SES', 'https://www.ses.com/'),
  ),
  family(
    /^EUTELSAT\s/i,
    FRANCE,
    text('Eutelsat', 'Eutelsat（欧洲通信卫星公司）'),
    text('Eutelsat · commercial communications', 'Eutelsat · 商业卫星通信'),
    text(
      'Eutelsat, based in Paris, began as a European intergovernmental organisation. HOTBIRD satellites at 13° East broadcast hundreds of television channels to Europe, North Africa and the Middle East; KONNECT and KA-SAT provide satellite broadband, and Eutelsat Quantum can be reprogrammed in orbit. Eutelsat merged with the OneWeb low-orbit constellation in 2023.',
      'Eutelsat 总部位于巴黎，最初是欧洲的政府间组织。位于东经 13° 的 HOTBIRD 卫星向欧洲、北非和中东播出数百个电视频道；KONNECT 和 KA-SAT 提供卫星宽带，Eutelsat Quantum 能在轨重新编程覆盖范围。2023 年 Eutelsat 与低轨星座 OneWeb 合并。',
    ),
    source('Eutelsat', 'https://www.eutelsat.com/'),
  ),
  family(
    /^(?:ECHOSTAR|JUPITER)\s/i,
    US,
    text('EchoStar (Hughes)', 'EchoStar（Hughes）'),
    text('EchoStar · TV and satellite broadband', 'EchoStar · 电视与卫星宽带'),
    text(
      'EchoStar satellites relay DISH direct-broadcast television in the United States. Those under the Hughes brand, including the Jupiter series, provide HughesNet satellite internet: high-throughput satellites divide the coverage area into many small spot beams, reusing the same frequencies to serve homes far from fibre or cable.',
      'EchoStar 卫星为美国 DISH 直播电视转发信号。Hughes 品牌的卫星（包括 Jupiter 系列）提供 HughesNet 卫星上网：高通量卫星把覆盖区分成许多小点波束，重复使用同一频率，为光纤和有线网络难以到达的家庭服务。',
    ),
    source('EchoStar', 'https://www.echostar.com/'),
  ),
  family(
    /^DIRECTV\s/i,
    US,
    text('DIRECTV', 'DIRECTV'),
    text('DIRECTV · direct-to-home television', 'DIRECTV · 卫星直播电视'),
    text(
      'A satellite for DIRECTV, a US pay-television service received with small home dishes. Several satellites cluster around a few orbital positions so that one dish with multiple feeds can pick up national channels and the local channels beamed to each city.',
      '美国付费电视服务 DIRECTV 的卫星，用户用家里的小型碟形天线接收。几颗卫星聚集在少数几个轨道位置附近，一面带多个馈源的天线就能同时收到全国频道和分区播出的本地频道。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^(?:SXM|XM)[\s-]/i,
    US,
    text('SiriusXM', 'SiriusXM'),
    text('SiriusXM · satellite radio', 'SiriusXM · 卫星广播'),
    text(
      'A satellite for SiriusXM digital radio in North America. Receivers in cars pick up hundreds of audio channels directly from space; ground repeaters fill in cities and tunnels where buildings block the satellite.',
      '北美 SiriusXM 数字广播的卫星。汽车里的接收机直接从太空接收数百个音频频道；在高楼遮挡或隧道等收不到卫星的地方，由地面中继站补充信号。',
    ),
    source('SiriusXM', 'https://www.siriusxm.com/'),
  ),
  family(
    /^WGS\s/i,
    US,
    USSF,
    text('WGS · military communications', 'WGS · 军用宽带通信'),
    text(
      'A Wideband Global SATCOM satellite, the highest-capacity communications satellites of the US military. They link commanders, ships, aircraft and deployed forces, and are shared with allied countries that helped fund the programme.',
      '“宽带全球卫星通信”（WGS）卫星，是美国军方容量最大的通信卫星，为指挥机构、舰船、飞机和前方部队传输数据，并与出资参加项目的盟国共享。',
    ),
    SPACE_SYSTEMS_SOURCE,
  ),
  family(
    /^(?:AEHF|USA \d+ \(MILSTAR)/i,
    US,
    USSF,
    text('Protected military communications', '抗干扰军用通信'),
    text(
      'Milstar and its successor AEHF (Advanced Extremely High Frequency) provide jam-resistant, hard-to-intercept communications for national leaders and military forces, designed to keep working in a nuclear conflict. The satellites relay messages between one another, so traffic can cross the globe without passing through ground stations.',
      '军事星（Milstar）及其后继者 AEHF（先进极高频卫星）为国家领导层和军队提供抗干扰、难以截获的通信，设计目标是在核冲突中也能继续工作。卫星之间可以互相转发，信息不经地面站也能传到地球另一侧。',
    ),
    SPACE_SYSTEMS_SOURCE,
  ),
  family(
    /^(?:SBIRS|USA \d+ \(DSP)/i,
    US,
    USSF,
    text('Missile warning · infrared', '导弹预警 · 红外'),
    text(
      'Missile-warning satellites watch Earth with infrared sensors for the hot exhaust of rocket launches. The Defense Support Program (DSP) did this from the 1970s; SBIRS succeeded it with more sensitive scanning and staring sensors that also support missile defence and battlefield awareness.',
      '导弹预警卫星用红外传感器注视地球，寻找火箭发射时炽热的尾焰。从 20 世纪 70 年代起由国防支援计划（DSP）卫星承担；天基红外系统（SBIRS）接替了它，扫描和凝视两类传感器更灵敏，还为导弹防御和战场态势提供数据。',
    ),
    SPACE_SYSTEMS_SOURCE,
  ),
  family(
    /^(?:MUOS|UFO|FLTSATCOM)[\s-]/i,
    US,
    text('U.S. Navy', '美国海军'),
    text('Narrowband military mobile communications', '军用窄带移动通信'),
    text(
      'UHF communications satellites for mobile US forces. FLTSATCOM and UHF Follow-On served ships, submarines, aircraft and troops with small antennas; MUOS (Mobile User Objective System) replaced them with a smartphone-like cellular waveform, giving handheld radios voice and data worldwide.',
      '为机动部队服务的美国特高频（UHF）通信卫星。舰队通信卫星（FLTSATCOM）和 UHF 后继星为舰船、潜艇、飞机和地面部队的小天线提供通信；移动用户目标系统（MUOS）接替它们，采用类似手机网络的信号体制，让手持电台在全球通话和传输数据。',
    ),
    source('U.S. Navy', 'https://www.navy.mil/'),
  ),
  family(
    /^EWS-G\d/i,
    US,
    USSF,
    text('EWS-G · military weather', 'EWS-G · 军用气象'),
    text(
      'A former NOAA GOES weather satellite transferred to the US Space Force under the Electro-optical/Infrared Weather System – Geostationary programme. Moved over the Indian Ocean, a region with little geostationary weather coverage from US systems, it provides cloud imagery for military operations there.',
      '原 NOAA GOES 气象卫星，移交美国太空军后改称 EWS-G（地球静止光电/红外气象系统）。它被移到印度洋上空，那里美国的静止气象卫星覆盖较少，为当地的军事行动提供云图。',
    ),
    SPACE_SYSTEMS_SOURCE,
  ),
  family(
    /^USA \d+/i,
    US,
    text('U.S. government', '美国政府'),
    text('USA-series government satellite', 'USA 系列政府卫星'),
    text(
      'US military and intelligence satellites receive a sequential “USA” number at launch. Some are publicly identified (communications, navigation, missile warning); for others, including those of the National Reconnaissance Office, the mission and capabilities are not disclosed. Amateur observers still track their orbits from the ground.',
      '美国军方和情报部门的卫星在发射时都会获得一个顺序编号“USA-数字”。其中一部分公开了身份（通信、导航、导弹预警等）；另一些，例如国家侦察局的卫星，任务与性能并不公开。业余观测者仍会从地面跟踪测定它们的轨道。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^LUCH-5[ABV]\b/i,
    RUSSIA,
    text('Roscosmos', '俄罗斯国家航天集团'),
    text('Luch · data relay', '射线 · 数据中继'),
    text(
      'A Russian data-relay satellite of the Luch (“ray”) system. Like NASA’s TDRS, it passes communications between ground control and spacecraft in low orbit, including the Russian segment of the International Space Station, so contact is not limited to passes over Russian ground stations.',
      '俄罗斯“射线”（Luch）数据中继系统的卫星。与 NASA 的 TDRS 类似，它在地面控制中心和低轨航天器（包括国际空间站俄罗斯舱段）之间转发通信，让联络不再局限于飞越俄罗斯地面站的时段。',
    ),
    source('Roscosmos', 'https://www.roscosmos.ru/'),
  ),
  family(
    /^LUCH-5X|OLYMP/i,
    RUSSIA,
    text('Russian government', '俄罗斯政府'),
    text('Luch-5X / Olymp-K 2', '射线-5X / 奥林普-K 2'),
    text(
      'Launched in 2023 under the name Luch-5X and also known as Olymp-K 2. It is a Russian government satellite whose mission has not been disclosed. Its predecessor Olymp-K drew attention for repeatedly parking close to other operators’ geostationary communications satellites.',
      '2023 年以“射线-5X”的名称发射，也被称为“奥林普-K 2”，是任务未公开的俄罗斯政府卫星。它的前一颗“奥林普-K”曾多次停靠在其他运营商的地球静止通信卫星附近，引起关注。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^ELEKTRO-L/i,
    RUSSIA,
    text('Roshydromet', '俄罗斯联邦水文气象与环境监测局'),
    text('Elektro-L · weather observation', '电子-L · 气象观测'),
    text(
      'A Russian geostationary weather satellite. Its imager photographs the full Earth disc in visible and infrared light every 15 to 30 minutes, supporting weather forecasts across Russia, the Indian Ocean and Europe; it also relays data from ground weather stations and distress beacons.',
      '俄罗斯的地球静止气象卫星。成像仪每 15–30 分钟用可见光和红外拍摄一次完整地球圆盘，为俄罗斯、印度洋和欧洲的天气预报提供资料；它还转发地面气象站数据和遇险信标信号。',
    ),
    source('Roshydromet', 'https://www.meteorf.gov.ru/'),
  ),
  family(
    /^(?:EXPRESS|YAMAL)[\s-]/i,
    RUSSIA,
    undefined,
    text('Russian communications', '俄罗斯通信卫星'),
    text(
      'A Russian communications satellite. The Express series belongs to the state operator RSCC and carries television, government communications and internet links; Yamal satellites are operated by Gazprom Space Systems, initially to connect the gas company’s remote facilities. Russia’s width across eleven time zones makes satellites essential for reaching the far north and east.',
      '俄罗斯的通信卫星。“快讯”（Express）系列属于国有运营商俄罗斯卫星通信公司（RSCC），传输电视、政府通信和互联网；“亚马尔”（Yamal）由俄气航天系统公司运营，最初用于连接天然气公司偏远的设施。俄罗斯横跨 11 个时区，北部和东部的边远地区很依赖卫星通信。',
    ),
    source('RSCC', 'https://eng.rscc.ru/'),
  ),
  family(
    /^COSMOS \d+/i,
    RUSSIA,
    text('Russian (Soviet) government', '俄罗斯（苏联）政府'),
    text('Kosmos-series satellite', '宇宙系列卫星'),
    text(
      'Since 1962 the Soviet Union and Russia have given the name “Kosmos” plus a sequence number to most military satellites and many experimental ones, so the name hides the mission. More than 2,500 have been launched, including early-warning, communications, navigation and reconnaissance satellites; numbers above 2500 have been launched since the mid-2010s.',
      '自 1962 年起，苏联和俄罗斯把大多数军用卫星和不少试验卫星都命名为“宇宙”加顺序编号，名称本身不透露任务。至今已发射 2500 多颗，包括预警、通信、导航和侦察卫星；编号超过 2500 的卫星发射于 2010 年代中期以后。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^RADUGA/i,
    RUSSIA,
    text('Russian Ministry of Defence', '俄罗斯国防部'),
    text('Raduga-1M · military communications', '彩虹-1M · 军用通信'),
    text(
      'Raduga (“rainbow”) satellites relay communications for the Russian armed forces. The 1M generation was launched from 2007 to 2013, successors of a series dating back to the 1970s.',
      '“彩虹”（Raduga）卫星为俄罗斯武装力量转发通信。1M 型在 2007–2013 年间发射，延续了始于 20 世纪 70 年代的系列。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^TJS-\d/i,
    CHINA,
    undefined,
    text(
      'TJS · communication technology experiment',
      '通信技术试验卫星（TJS）',
    ),
    text(
      'Officially described as communication technology experiment satellites, mostly launched from Xichang on Long March 3 rockets since 2015. Their detailed missions have not been disclosed, and outside observers have noted that several of them change position along the geostationary belt.',
      '官方称为“通信技术试验卫星”，2015 年起多由长征三号系列火箭从西昌发射。具体任务和载荷没有公开；外界观测发现其中一些卫星会沿地球静止轨道带改变定点位置。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^(?:ZHONGXING|CHINASAT)[\s-]/i,
    CHINA,
    text('China Satcom', '中国卫通'),
    text('ChinaSat · broadcasting and communications', '中星 · 广播与通信'),
    text(
      'A Zhongxing (ChinaSat) communications satellite. China Satcom’s fleet broadcasts radio and television to homes across China, including direct-to-home service for rural areas, and provides links for emergencies, ships, aircraft and enterprise networks. ChinaSat 16 was China’s first high-throughput satellite for broadband.',
      '中星系列通信卫星。中国卫通的卫星向全国传输广播电视信号（包括面向农村的直播卫星服务），并为应急通信、船舶、航空和行业专网提供链路。中星十六号是中国第一颗高通量宽带通信卫星。',
    ),
    source('中国卫通', 'https://www.chinasatcom.com/'),
  ),
  family(
    /^TIANLIAN/i,
    CHINA,
    undefined,
    text('Tianlian · data relay', '天链 · 数据中继'),
    text(
      'A satellite of China’s Tianlian (“sky link”) data-relay system. Like NASA’s TDRS, it lets ground control talk to spacecraft in low orbit almost continuously, including the Shenzhou crew ships and the Tiangong space station, instead of only during passes over ground stations or tracking ships.',
      '中国天链数据中继系统的卫星。与 NASA 的 TDRS 类似，它让地面能几乎连续地与低轨航天器联络（包括神舟飞船和天宫空间站），不再只在飞越地面站或测量船时才能通信。',
    ),
    source('中国载人航天工程', 'https://en.cmse.gov.cn/'),
  ),
  family(
    /^FENGYUN/i,
    CHINA,
    text('China Meteorological Administration', '中国气象局'),
    text('Fengyun · weather observation', '风云 · 气象观测'),
    text(
      'A geostationary satellite of China’s Fengyun (“wind and cloud”) programme. Fengyun-2 satellites spin to scan Earth with their imager; the three-axis-stabilised Fengyun-4 series adds an atmospheric sounder and a lightning imager. They image East Asia every few minutes to track typhoons, rainstorms and dust storms, and share data with countries in the region.',
      '中国风云系列的地球静止气象卫星。风云二号依靠星体自旋带动成像仪扫描地球；三轴稳定的风云四号又增加了大气垂直探测仪和闪电成像仪。它们每隔几分钟对东亚成像，追踪台风、暴雨和沙尘暴，并向周边国家共享数据。',
    ),
    source('国家卫星气象中心', 'https://www.nsmc.org.cn/'),
  ),
  family(
    /^SHIJIAN-\d/i,
    CHINA,
    undefined,
    text('Shijian · technology experiments', '实践 · 技术试验'),
    text(
      'Shijian (“practice”) satellites test new space technologies. In geostationary orbit, Shijian-17 demonstrated close manoeuvring, and in 2022 Shijian-21 docked with the defunct BeiDou-2 G2 satellite and towed it to a graveyard orbit, an early demonstration of removing a dead satellite from the geostationary belt.',
      '实践系列卫星用于验证新的航天技术。在地球静止轨道上，实践十七号验证了近距离机动；2022 年实践二十一号与失效的北斗二号 G2 卫星对接，并把它拖入坟墓轨道，这是清理地球静止轨道上失效卫星的早期示范。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^SHIYAN-\d/i,
    CHINA,
    undefined,
    text('Shiyan · technology experiments', '试验 · 技术试验卫星'),
    text(
      'Shiyan (“experiment”) satellites test new technologies, from Earth-observation sensors to communications and space-environment instruments, before they are used on operational satellites. Details of individual satellites are often brief or not disclosed.',
      '试验系列卫星在新技术投入业务卫星之前先行验证，内容涵盖对地观测传感器、通信和空间环境探测等。单颗卫星的公开资料通常很简略，甚至不公开。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^GAOFEN/i,
    CHINA,
    undefined,
    text('Gaofen · staring Earth observation', '高分 · 静止轨道对地观测'),
    text(
      'A high-resolution Earth-observation satellite of China’s Gaofen (“high resolution”) programme. From geostationary orbit, Gaofen-4 and Gaofen-13 can stare at the same region for long periods, which suits monitoring of disasters, forest fires and floods as they develop, though with coarser detail than satellites in low orbit.',
      '中国高分专项的对地观测卫星。高分四号和高分十三号在地球静止轨道上可以长时间盯住同一地区，适合跟踪灾害、森林火灾和洪水的发展过程；不过离地面远，分辨率不如低轨卫星。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^TIANTONG/i,
    CHINA,
    text('China Telecom', '中国电信'),
    text('Tiantong-1 · satellite mobile phone', '天通一号 · 卫星移动通信'),
    text(
      'China’s own mobile satellite communications system. Tiantong-1 satellites let handheld satellite phones, and some ordinary smartphones, make calls and send messages over China, its surrounding seas and parts of Asia-Pacific, where there is no cellular coverage or the ground network has been knocked out by a disaster.',
      '中国自主的卫星移动通信系统。天通一号卫星让卫星电话（以及部分普通智能手机）在中国、周边海域和亚太部分地区通话、发短信，在没有地面基站或基站被灾害毁坏时也能保持联系。',
    ),
    source('中国电信', 'https://www.chinatelecom.com.cn/'),
  ),
  family(
    /^(?:APSTAR|ASIASAT)[\s-]/i,
    text('Hong Kong, China', '中国香港'),
    undefined,
    text(
      'APSTAR / AsiaSat · regional communications',
      '亚太星 / 亚洲卫星 · 区域通信',
    ),
    text(
      'A communications satellite of one of the two Hong Kong-based operators, APT Satellite (APSTAR) and AsiaSat. They distribute television channels and carry telecom and data links across Asia, the Pacific and beyond. AsiaSat 1 (1990) was a satellite recovered by the Space Shuttle and relaunched, and became the first privately owned regional satellite in Asia.',
      '两家香港卫星运营商之一的通信卫星：亚太卫星（APSTAR）或亚洲卫星（AsiaSat）。它们为亚洲、太平洋及更远地区分发电视频道，并提供电信和数据链路。亚洲一号（1990 年）是一颗被航天飞机回收后重新发射的卫星，成为亚洲第一颗私营区域通信卫星。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^HULIANWANG? GAOGUI/i,
    CHINA,
    undefined,
    text('High-orbit satellite internet', '高轨卫星互联网'),
    text(
      'A satellite catalogued as part of China’s high-orbit satellite internet programme (Hulianwang Gaogui), launched from Xichang starting in 2024. High-orbit broadband satellites complement the low-orbit Guowang constellation: a few satellites cover wide areas at once, at the cost of a longer signal delay.',
      '编目为中国卫星互联网高轨卫星（互联网高轨）的目标，2024 年起从西昌陆续发射。高轨宽带卫星与低轨的“国网”星座互补：少数几颗就能覆盖大片区域，代价是信号传输延迟更长。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^LUDI TANCE/i,
    CHINA,
    undefined,
    text('Ludi Tance-4 · geostationary radar', '陆地探测四号 · 静止轨道雷达'),
    text(
      'Ludi Tance-4 01, launched in 2023, is the first synthetic-aperture radar satellite in geostationary orbit. Radar sees through cloud and works at night; from its high orbit it can revisit the same area of China many times a day, to monitor earthquakes, landslides, floods and crops.',
      '陆地探测四号 01 星于 2023 年发射，是世界上第一颗地球静止轨道合成孔径雷达卫星。雷达能穿透云层、昼夜工作；在高轨道上，它一天内可以多次观测中国同一地区，用于监测地震、滑坡、洪水和农作物。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^YAOGAN-/i,
    CHINA,
    undefined,
    text('Yaogan · remote sensing', '遥感 · 遥感卫星'),
    text(
      'Yaogan (“remote sensing”) is a long-running series of Chinese satellites officially described as serving scientific experiments, land surveys, crop yield estimation and disaster prevention. Many fly in groups of three in low orbit, and outside analysts generally consider much of the series to support military reconnaissance; detailed payloads are not published.',
      '遥感系列是中国长期发射的卫星系列，官方说明用于科学试验、国土资源普查、农作物估产和防灾减灾等。其中不少以三颗一组的形式在低轨飞行；外界普遍认为该系列有相当部分承担军事侦察任务，具体载荷没有公开。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^INSAT-3D/i,
    INDIA,
    ISRO,
    text('INSAT-3D · weather observation', 'INSAT-3D · 气象观测'),
    text(
      'An Indian geostationary weather satellite. Its imager and atmospheric sounder watch the Indian Ocean region, tracking monsoon rainfall and cyclones in the Bay of Bengal and Arabian Sea; it also relays distress beacon signals for search and rescue.',
      '印度的地球静止气象卫星。成像仪和大气垂直探测仪覆盖印度洋地区，追踪季风降雨以及孟加拉湾、阿拉伯海的气旋；它还转发遇险信标信号，支持搜索救援。',
    ),
    ISRO_SOURCE,
  ),
  family(
    /^(?:GSAT|CMS-|INSAT)/i,
    INDIA,
    ISRO,
    text('GSAT / INSAT · Indian communications', 'GSAT / INSAT · 印度通信卫星'),
    text(
      'An Indian communications satellite built by ISRO. The INSAT and GSAT series carry television broadcasting, telecommunications, distance education, telemedicine and links for remote islands; some serve the armed forces. India began building its own communications satellites in the 1980s.',
      '印度空间研究组织研制的通信卫星。INSAT 和 GSAT 系列承担电视广播、电信、远程教育、远程医疗和偏远岛屿通信，部分卫星服务于军队。印度从 20 世纪 80 年代起自主研制通信卫星。',
    ),
    ISRO_SOURCE,
  ),
  family(
    /^(?:IRNSS|NVS)-/i,
    INDIA,
    ISRO,
    text('NavIC · regional navigation', 'NavIC · 区域导航'),
    text(
      'A satellite of NavIC (Navigation with Indian Constellation), India’s regional navigation system. Instead of a global constellation, a handful of satellites in geostationary and inclined geosynchronous orbits stay above the Indian Ocean, providing positioning over India and about 1,500 km around it. NVS satellites are the second generation.',
      '印度区域导航系统 NavIC 的卫星。它不建全球星座，而是用少数几颗地球静止和倾斜地球同步轨道卫星始终停留在印度洋上空，为印度及周边约 1500 km 的范围提供定位服务。NVS 是第二代卫星。',
    ),
    ISRO_SOURCE,
  ),
  family(
    /^(?:JCSAT|SUPERBIRD)/i,
    JAPAN,
    text('SKY Perfect JSAT', 'SKY Perfect JSAT'),
    text('JSAT · commercial communications', 'JSAT · 商业卫星通信'),
    text(
      'A satellite of SKY Perfect JSAT, Asia’s largest satellite operator by fleet. It carries Japan’s multichannel pay television and provides links for ships, aircraft, disaster response and enterprise networks across Asia and Oceania.',
      '亚洲卫星数量最多的运营商 SKY Perfect JSAT 的卫星，承担日本的多频道付费电视，并为亚洲和大洋洲的船舶、飞机、救灾和企业网络提供链路。',
    ),
    source('SKY Perfect JSAT', 'https://www.skyperfectjsat.space/en/'),
  ),
  family(
    /^BSAT/i,
    JAPAN,
    text('B-SAT', 'B-SAT（广播卫星系统）'),
    text('BSAT · satellite broadcasting', 'BSAT · 卫星电视广播'),
    text(
      'A Japanese broadcasting satellite at 110° East. BSAT satellites relay NHK and commercial BS channels to millions of home dishes, including 4K and 8K ultra-high-definition broadcasts.',
      '位于东经 110° 的日本广播卫星，向数以百万计的家庭天线转发 NHK 和商业 BS 频道，包括 4K、8K 超高清节目。',
    ),
    source('B-SAT', 'https://www.b-sat.co.jp/'),
  ),
  family(
    /^HIMAWARI/i,
    JAPAN,
    text('Japan Meteorological Agency', '日本气象厅'),
    text('Himawari · weather observation', '向日葵 · 气象观测'),
    text(
      'A Japanese geostationary weather satellite. Himawari-8 and -9 image the full Earth disc every 10 minutes in 16 wavelength bands, with rapid scans of Japan every 2.5 minutes, tracking typhoons, volcanic ash and heavy rain across East Asia and the western Pacific. Their true-colour images are among the most widely shared views of Earth.',
      '日本的地球静止气象卫星。向日葵 8 号、9 号每 10 分钟用 16 个波段拍摄一次完整地球圆盘，对日本周边每 2.5 分钟快速扫描一次，追踪东亚和西太平洋的台风、火山灰和强降雨。它们的真彩色地球图像传播很广。',
    ),
    source('JMA', 'https://www.data.jma.go.jp/mscweb/en/index.html'),
  ),
  family(
    /^QZS-/i,
    JAPAN,
    text('Cabinet Office, Japan', '日本内阁府'),
    text('QZSS Michibiki · regional navigation', '准天顶 · 引路号 · 区域导航'),
    text(
      'A satellite of Japan’s Quasi-Zenith Satellite System, “Michibiki”. Some satellites follow tilted, elongated geosynchronous orbits that keep one of them almost straight overhead in Japan, where tall buildings and mountains block GPS signals from low in the sky; others are geostationary. They broadcast GPS-compatible signals plus centimetre-level correction data.',
      '日本准天顶卫星系统“引路号”（Michibiki）的卫星。部分卫星沿倾斜而拉长的地球同步轨道飞行，总有一颗几乎位于日本头顶，弥补高楼和山区遮挡低仰角 GPS 信号的问题；另一部分是地球静止卫星。它们播发与 GPS 兼容的信号，以及厘米级定位所需的改正数据。',
    ),
    source('QZSS', 'https://qzss.go.jp/en/'),
  ),
  family(
    /^GEO-KOMPSAT/i,
    text('South Korea', '韩国'),
    text('KARI', '韩国航空宇宙研究院（KARI）'),
    text(
      'GEO-KOMPSAT · weather, ocean and air quality',
      '千里眼 · 气象、海洋与空气质量',
    ),
    text(
      'South Korea’s geostationary environmental satellites. GEO-KOMPSAT-2A images weather and space weather; 2B carries an ocean-colour imager and GEMS, the first geostationary spectrometer for air pollution, which measures pollutants such as nitrogen dioxide over Asia several times a day.',
      '韩国的地球静止环境卫星“千里眼”。2A 星观测天气和空间天气；2B 星搭载海洋水色成像仪和 GEMS——世界上第一台静止轨道大气污染光谱仪，每天多次测量亚洲上空二氧化氮等污染物。',
    ),
    source('KARI', 'https://www.kari.re.kr/eng/'),
  ),
  national(
    /^RASCOM/i,
    text('Africa', '非洲'),
    text('RASCOM', '非洲区域卫星通信组织（RASCOM）'),
  ),
  national(
    /^NIGCOMSAT/i,
    text('Nigeria', '尼日利亚'),
    text('NIGCOMSAT', 'NIGCOMSAT'),
  ),
  national(
    /^(?:MEXSAT|MORELOS)/i,
    text('Mexico', '墨西哥'),
    text('Mexican government', '墨西哥政府'),
  ),
  national(
    /^TKSAT/i,
    text('Bolivia', '玻利维亚'),
    text('Bolivian Space Agency', '玻利维亚航天局'),
  ),
  national(/^LAOSAT/i, text('Laos', '老挝'), text('LaoSat', '老挝卫星公司')),
  national(
    /^BELINTERSAT/i,
    text('Belarus', '白俄罗斯'),
    text('Belintersat', 'Belintersat'),
  ),
  national(
    /^BULGARIASAT/i,
    text('Bulgaria', '保加利亚'),
    text('Bulsatcom', 'Bulsatcom'),
  ),
  national(
    /^ALCOMSAT/i,
    text('Algeria', '阿尔及利亚'),
    text('Algerian Space Agency', '阿尔及利亚航天局'),
  ),
  national(
    /^BANGABANDHU/i,
    text('Bangladesh', '孟加拉国'),
    text('BSCL', '孟加拉国卫星公司'),
  ),
  national(
    /^ANGOSAT/i,
    text('Angola', '安哥拉'),
    text('GGPEN', '安哥拉国家空间计划办公室'),
  ),
  national(
    /^PAKSAT/i,
    text('Pakistan', '巴基斯坦'),
    text('SUPARCO', '巴基斯坦空间与高层大气研究委员会'),
  ),
  national(
    /^TURKMENALEM/i,
    text('Turkmenistan', '土库曼斯坦'),
    text('Turkmenistan government', '土库曼斯坦政府'),
  ),
  national(
    /^TIBA/i,
    text('Egypt', '埃及'),
    text('Egyptian government', '埃及政府'),
  ),
  family(
    /^(?:LUCAS|DSN-\d)/i,
    JAPAN,
    undefined,
    text('Japanese government relay and communications', '日本政府中继与通信'),
    text(
      'A Japanese government satellite in geostationary orbit. LUCAS (JDRS-1) is an optical data-relay satellite that receives images from Earth-observation satellites by laser and forwards them to the ground; the DSN “Kirameki” satellites provide X-band communications for Japan’s Self-Defense Forces.',
      '日本政府的地球静止卫星。LUCAS（JDRS-1）是光学数据中继卫星，用激光接收对地观测卫星的数据再转发到地面；DSN“煌”（Kirameki）卫星为日本自卫队提供 X 波段通信。',
    ),
    CATALOG_SOURCE,
  ),
  national(
    /^KOREASAT/i,
    text('South Korea', '韩国'),
    text('KT SAT', 'KT SAT'),
    'https://www.ktsat.com/',
  ),
  national(
    /^TURKSAT/i,
    text('Türkiye', '土耳其'),
    text('Türksat', 'Türksat'),
    'https://www.turksat.com.tr/en',
  ),
  national(
    /^(?:ARABSAT|BADR)/i,
    text('the Arab League member states', '阿拉伯国家联盟成员国'),
    text('Arabsat', '阿拉伯卫星通信组织（Arabsat）'),
    'https://www.arabsat.com/',
  ),
  national(
    /^HELLAS-SAT/i,
    text('Greece', '希腊'),
    text('Hellas Sat', 'Hellas Sat'),
    'https://www.hellas-sat.net/',
  ),
  national(
    /^(?:YAHSAT|AL YAH)/i,
    text('the United Arab Emirates', '阿联酋'),
    text('Yahsat (Space42)', 'Yahsat（Space42）'),
    'https://space42.ai/',
  ),
  national(
    /^ES'HAIL/i,
    text('Qatar', '卡塔尔'),
    text('Es’hailSat', 'Es’hailSat'),
    'https://www.eshailsat.qa/',
  ),
  national(
    /^NILESAT/i,
    text('Egypt', '埃及'),
    text('Nilesat', 'Nilesat'),
    'https://www.nilesat.com.eg/',
  ),
  national(
    /^(?:AMOS|DROR)/i,
    text('Israel', '以色列'),
    text('Spacecom', 'Spacecom'),
    'https://www.amos-spacecom.com/',
  ),
  national(
    /^THOR\s/i,
    text('Norway', '挪威'),
    text('Space Norway', 'Space Norway'),
    'https://spacenorway.no/',
  ),
  national(
    /^(?:HISPASAT|AMAZONAS)/i,
    text('Spain', '西班牙'),
    text('Hispasat', 'Hispasat'),
    'https://www.hispasat.com/',
  ),
  national(
    /^(?:STAR ONE|SGDC)/i,
    text('Brazil', '巴西'),
    text('Star One / Telebras', 'Star One / Telebras'),
  ),
  national(
    /^ARSAT/i,
    text('Argentina', '阿根廷'),
    text('ARSAT', 'ARSAT'),
    'https://www.arsat.com.ar/',
  ),
  national(
    /^MEASAT/i,
    text('Malaysia', '马来西亚'),
    text('MEASAT', 'MEASAT'),
    'https://www.measat.com/',
  ),
  national(
    /^THAICOM/i,
    text('Thailand', '泰国'),
    text('Thaicom', 'Thaicom'),
    'https://www.thaicom.net/',
  ),
  national(/^VINASAT/i, text('Vietnam', '越南'), text('VNPT', 'VNPT')),
  national(
    /^KAZSAT/i,
    text('Kazakhstan', '哈萨克斯坦'),
    text('KazSat', 'KazSat'),
    'https://www.rcsc.kz/',
  ),
  national(
    /^AZERSPACE/i,
    text('Azerbaijan', '阿塞拜疆'),
    text('Azercosmos', 'Azercosmos'),
    'https://azercosmos.az/',
  ),
  national(
    /^(?:TELKOM|MERAH PUTIH|NUSANTARA|BRISAT)/i,
    text('Indonesia', '印度尼西亚'),
    text('Indonesian operators', '印尼运营商'),
    'https://www.telkomsat.co.id/',
  ),
  national(
    /^(?:OPTUS|SKY MUSTER)/i,
    text('Australia', '澳大利亚'),
    text('Optus / NBN Co', 'Optus / NBN Co'),
    'https://www.nbnco.com.au/',
  ),
  national(
    /^(?:TELSTAR|ANIK|NIMIQ)\s/i,
    text('Canada', '加拿大'),
    text('Telesat', 'Telesat'),
    'https://www.telesat.com/',
  ),
  family(
    /^(?:SYRACUSE|ATHENA-FIDUS)/i,
    FRANCE,
    text('French Armed Forces', '法国军方'),
    text('Military communications', '军用通信'),
    text(
      'A French military communications satellite. Syracuse satellites link French forces, ships and command centres worldwide with secure, jam-resistant links; Athena-Fidus is a dual-use satellite shared by France and Italy for defence and civil security.',
      '法国的军用通信卫星。“锡拉丘兹”（Syracuse）卫星为全球各地的法国部队、舰船和指挥中心提供安全、抗干扰的链路；Athena-Fidus 是法国与意大利共用的军民两用卫星，服务国防与公共安全。',
    ),
    source('DGA', 'https://www.defense.gouv.fr/dga'),
  ),
  family(
    /^SKYNET/i,
    UK,
    text('UK Ministry of Defence', '英国国防部'),
    text('Skynet · military communications', 'Skynet · 军用通信'),
    text(
      'A satellite of Skynet, the UK’s military communications system since 1969. Skynet 5 satellites have hardened, jam-resistant transponders and serve British forces and allies worldwide.',
      '英国自 1969 年起使用的军用通信系统 Skynet 的卫星。Skynet 5 卫星的转发器经过抗干扰加固，为英国及盟国部队在全球范围内提供通信。',
    ),
    CATALOG_SOURCE,
  ),
  family(
    /^SPAINSAT/i,
    text('Spain', '西班牙'),
    text('Hisdesat', 'Hisdesat'),
    text('SpainSat · government communications', 'SpainSat · 政府安全通信'),
    text(
      'A Spanish government and military communications satellite operated by Hisdesat. SpainSat NG satellites carry secure X-band and military Ka-band links for Spain’s armed forces and NATO allies, with protection against jamming and nuclear radiation.',
      '西班牙 Hisdesat 公司运营的政府与军用通信卫星。新一代 SpainSat NG 携带 X 波段和军用 Ka 波段安全链路，服务西班牙武装力量和北约盟国，具有抗干扰和抗核辐射能力。',
    ),
    source('Hisdesat', 'https://www.hisdesat.es/'),
  ),
  family(
    /^(?:METEOSAT|MTG-)/i,
    text('Europe', '欧洲'),
    text('EUMETSAT', '欧洲气象卫星组织（EUMETSAT）'),
    text('Meteosat · weather observation', '气象卫星 Meteosat · 气象观测'),
    text(
      'A European geostationary weather satellite. Meteosat images Europe, Africa and the Atlantic every 15 minutes, and every 5 minutes over Europe in rapid-scan mode, feeding weather forecasts and climate records. The new Meteosat Third Generation adds a lightning imager (MTG-I) and an infrared sounder carrying the Copernicus Sentinel-4 air-quality instrument (MTG-S).',
      '欧洲的地球静止气象卫星。Meteosat 每 15 分钟拍摄一次欧洲、非洲和大西洋，快速扫描模式下每 5 分钟观测一次欧洲，为天气预报和气候记录提供数据。第三代（MTG）新增闪电成像仪（MTG-I），以及搭载哥白尼哨兵-4 空气质量仪器的红外探测星（MTG-S）。',
    ),
    source('EUMETSAT', 'https://www.eumetsat.int/'),
  ),
  family(
    /^(?:INMARSAT|ALPHASAT)/i,
    UK,
    text('Inmarsat (Viasat)', 'Inmarsat（属 Viasat）'),
    text(
      'Inmarsat · mobile satellite communications',
      'Inmarsat · 移动卫星通信',
    ),
    text(
      'Inmarsat was founded in 1979 as an intergovernmental organisation to provide communications for ships at sea. Its satellites still carry the Global Maritime Distress and Safety System and aviation safety services, as well as voice and broadband for ships, aircraft and remote sites. Viasat acquired Inmarsat in 2023.',
      'Inmarsat 于 1979 年作为政府间组织成立，最初为海上船舶提供通信。它的卫星至今承担全球海上遇险与安全系统（GMDSS）和航空安全通信，并为船舶、飞机和偏远站点提供语音和宽带。2023 年 Viasat 收购了 Inmarsat。',
    ),
    source('Viasat', 'https://www.viasat.com/'),
  ),
  family(
    /^VIASAT/i,
    US,
    text('Viasat', 'Viasat'),
    text('Viasat · satellite broadband', 'Viasat · 卫星宽带'),
    text(
      'A high-throughput broadband satellite from Viasat. Hundreds of narrow spot beams let it reuse frequencies many times, delivering internet to homes, aircraft and ships. The ViaSat-3 satellites are among the largest communications satellites ever built.',
      'Viasat 公司的高通量宽带卫星。数百个窄点波束使频率可以多次复用，为家庭、飞机和船舶提供互联网接入。ViaSat-3 卫星是迄今体积最大的通信卫星之一。',
    ),
    source('Viasat', 'https://www.viasat.com/'),
  ),
  family(
    /^THURAYA/i,
    text('United Arab Emirates', '阿联酋'),
    text('Thuraya (Space42)', 'Thuraya（Space42）'),
    text('Thuraya · mobile satellite phone', 'Thuraya · 卫星移动电话'),
    text(
      'A mobile satellite communications satellite. Its very large antenna forms hundreds of spot beams, letting pocket-sized satellite phones work across Europe, Africa, the Middle East, Asia and Australia without a dish.',
      '移动卫星通信卫星。巨大的天线形成数百个点波束，让小巧的卫星电话在欧洲、非洲、中东、亚洲和澳大利亚不用碟形天线就能通话。',
    ),
    source('Thuraya', 'https://www.thuraya.com/'),
  ),
  family(
    /^HYLAS/i,
    UK,
    text('Avanti Communications', 'Avanti Communications'),
    text('HYLAS · Ka-band broadband', 'HYLAS · Ka 波段宽带'),
    text(
      'A British high-throughput Ka-band satellite operated by Avanti. Spot beams over Europe, Africa and the Middle East provide internet, mobile network backhaul and government links where terrestrial networks are thin.',
      '英国 Avanti 公司运营的 Ka 波段高通量卫星。点波束覆盖欧洲、非洲和中东，在地面网络薄弱的地方提供互联网、移动网络回传和政府专线。',
    ),
    source('Avanti', 'https://www.avantiplc.com/'),
  ),
  family(
    /^MEV-\d/i,
    US,
    text(
      'Northrop Grumman (SpaceLogistics)',
      '诺斯罗普·格鲁曼（SpaceLogistics）',
    ),
    text('MEV · satellite life extension', 'MEV · 卫星延寿服务'),
    text(
      'A Mission Extension Vehicle, the first commercial spacecraft to service satellites in orbit. MEV-1 docked with Intelsat 901 in 2020 and MEV-2 with Intelsat 10-02 in 2021; once attached, the vehicle takes over orbit and attitude control for a client satellite that is low on fuel, extending its working life by years.',
      '任务延寿飞行器（MEV），首批在轨为卫星提供服务的商业航天器。MEV-1 于 2020 年与 Intelsat 901 对接，MEV-2 于 2021 年与 Intelsat 10-02 对接；对接后由它接管燃料将尽的客户卫星的轨道和姿态控制，把卫星寿命延长数年。',
    ),
    source(
      'Northrop Grumman',
      'https://www.northropgrumman.com/space/space-logistics-services',
    ),
  ),
  family(
    /^SDO$/i,
    US,
    text('NASA', 'NASA'),
    text('SDO · solar observatory', 'SDO · 太阳动力学天文台'),
    text(
      'NASA’s Solar Dynamics Observatory, launched in 2010, photographs the whole Sun in many wavelengths every few seconds and measures its magnetic field, studying how solar activity drives space weather. Its inclined geosynchronous orbit keeps it in constant view of a dedicated ground station in New Mexico, which receives its very high data rate.',
      'NASA 太阳动力学天文台于 2010 年发射，每隔几秒用多个波段拍摄整个太阳并测量其磁场，研究太阳活动如何引发空间天气。倾斜的地球同步轨道让它始终处在新墨西哥州一座专用地面站的视野内，以接收它极高速率的数据。',
    ),
    source('NASA', 'https://sdo.gsfc.nasa.gov/'),
  ),
  family(
    /^EDRS/i,
    text('Europe', '欧洲'),
    text('ESA / Airbus', '欧洲航天局 / 空客'),
    text('EDRS · laser data relay', 'EDRS · 激光数据中继'),
    text(
      'Part of the European Data Relay System, the “SpaceDataHighway”. Laser terminals receive data from Earth-observation satellites such as the Copernicus Sentinels while they fly over any part of the globe and relay it to Europe within minutes, instead of waiting for the satellite to pass over a ground station.',
      '欧洲数据中继系统（“太空数据高速公路”）的一部分。激光终端在哥白尼哨兵等对地观测卫星飞越全球任何地方时接收数据，几分钟内转发回欧洲，而不必等卫星飞过地面站。',
    ),
    source(
      'ESA',
      'https://www.esa.int/Applications/Connectivity_and_Secure_Communications/EDRS',
    ),
  ),
];

/** Series that commonly appear among recent launches. */
const RECENT_FAMILIES: Family[] = [
  family(
    /^[O0]3B MPOWER/i,
    LUXEMBOURG,
    text('SES', 'SES'),
    text('O3b mPOWER · medium-orbit broadband', 'O3b mPOWER · 中轨宽带'),
    text(
      'O3b mPOWER satellites circle the equator about 8,000 km up, in medium Earth orbit. Being much closer than geostationary satellites, they offer lower-latency broadband; thousands of steerable beams per satellite can be pointed at ships, aircraft, island telecom networks and government users. The catalogue sometimes spells the name with a zero (03B).',
      'O3b mPOWER 卫星在赤道上空约 8000 km 的中地球轨道运行。比地球静止卫星近得多，宽带延迟更低；每颗卫星有数千个可灵活指向的波束，服务船舶、飞机、海岛电信网络和政府用户。目录中名称有时把字母 O 写成数字 0（03B）。',
    ),
    source('SES', 'https://www.ses.com/'),
  ),
  family(
    /^SENTINEL-/i,
    text('European Union', '欧盟'),
    text('ESA / EUMETSAT (Copernicus)', '欧洲航天局 / EUMETSAT（哥白尼计划）'),
    text('Copernicus Sentinel · Earth observation', '哥白尼哨兵 · 对地观测'),
    text(
      'A Sentinel satellite of Copernicus, the European Union’s Earth-observation programme, with data free to anyone. Each family has a speciality: Sentinel-1 radar, Sentinel-2 high-resolution colour images, Sentinel-3 ocean and land temperature and colour, Sentinel-5P/4/5 air quality, Sentinel-6 sea level. Satellites are launched in pairs or in sequence so that coverage continues.',
      '欧盟哥白尼对地观测计划的哨兵卫星，数据向所有人免费开放。各系列分工不同：哨兵一号是雷达，二号拍摄高分辨率彩色影像，三号测量海洋和陆地的温度与颜色，五号前身星、四号、五号监测空气质量，六号测量海平面高度。卫星成对或接力发射，保证观测不中断。',
    ),
    source(
      'ESA',
      'https://www.esa.int/Applications/Observing_the_Earth/Copernicus',
    ),
  ),
  family(
    /^FLEX$/i,
    text('Europe', '欧洲'),
    text('ESA', '欧洲航天局（ESA）'),
    text('FLEX · plant fluorescence', 'FLEX · 植物荧光探测'),
    text(
      'ESA’s FLuorescence EXplorer, an Earth Explorer mission. When plants photosynthesise they emit a faint red glow; FLEX measures it from space to map how actively vegetation is growing and how stressed it is, before the stress becomes visible as browning. It flies in tandem with Sentinel-3.',
      '欧洲航天局“地球探索者”系列的荧光探测器（FLEX）。植物进行光合作用时会发出微弱的红色荧光；FLEX 在太空测量这种荧光，绘制植被光合作用的强弱和受胁迫程度，早于叶片变黄被看到之前。它与哨兵三号编队飞行。',
    ),
    source(
      'ESA',
      'https://www.esa.int/Applications/Observing_the_Earth/FutureEO/FLEX',
    ),
  ),
  family(
    /^STRIX/i,
    JAPAN,
    text('Synspective', 'Synspective'),
    text('StriX · small radar satellites', 'StriX · 小型雷达卫星'),
    text(
      'A small synthetic-aperture radar satellite from the Japanese company Synspective. Radar images are taken day or night, through cloud; a constellation of StriX satellites is designed to revisit cities and infrastructure frequently to measure ground subsidence and assess damage after disasters. Most are launched on Rocket Lab’s Electron.',
      '日本 Synspective 公司的小型合成孔径雷达卫星。雷达不分昼夜、能穿透云层成像；StriX 星座设计为频繁重访城市和基础设施，测量地面沉降、评估灾后损毁。它们大多由 Rocket Lab 的电子号火箭发射。',
    ),
    source('Synspective', 'https://synspective.com/'),
  ),
  family(
    /^GLOBAL-\d/i,
    US,
    text('BlackSky', 'BlackSky'),
    text('BlackSky · rapid-revisit imaging', 'BlackSky · 高频重访成像'),
    text(
      'A BlackSky Earth-imaging satellite. The company’s constellation of small satellites can photograph the same place many times a day, sacrificing some resolution compared with large imaging satellites to monitor ports, airports and disaster areas quickly.',
      'BlackSky 公司的对地成像卫星。这一小卫星星座每天可以多次拍摄同一地点，以分辨率略低于大型成像卫星为代价，快速监测港口、机场和灾区的变化。',
    ),
    source('BlackSky', 'https://www.blacksky.com/'),
  ),
];

// More specific family matches are useful in mixed catalogue groups. Keep
// patterns narrow: a GEO orbit, a launch vehicle or a station association must
// never be used to guess the payload's nationality or mission.
const FAMILIES: Family[] = [
  { match: /^STARLINK(?:-|\s)/i, profile: GROUP_PROFILES.starlink },
  { match: /^BEIDOU/i, profile: GROUP_PROFILES.beidou },
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
  ...GEO_FAMILIES,
  ...RECENT_FAMILIES,
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
  separated: true,
  mission: text('Rocket body · launch remnant', '火箭体 · 发射遗留物'),
  summary: text(
    'A spent rocket stage rather than a working satellite. After releasing its payloads, an upper stage often reaches orbit too. Without power or control it tumbles slowly and decays as the upper atmosphere drags on it: weeks to years from low orbit, centuries or more from high orbit. Large, intact stages are a major source of future debris, so newer rockets often fire their engines again to deorbit them. The country shown is the rocket’s; payloads it carried may belong to other countries.',
    '这是用完的火箭级，不是工作中的卫星。末级在释放载荷后，往往自己也进入了轨道。它失去动力和控制，缓慢翻滚，在高层大气阻力下逐渐降低：低轨上几周到几年就会再入，高轨上可能留存数百年以上。完整的大型火箭级是未来碎片的主要来源之一，因此新型火箭常在释放载荷后再次点火，让末级主动离轨。这里显示的国家属于火箭本身，它运送的载荷可能属于其他国家。',
  ),
  sources: [CATALOG_SOURCE],
};
/** Launch vehicles named in rocket-body entries. The rocket's country is the
 * vehicle's, not necessarily the payload's. */
const VEHICLES: {
  match: RegExp;
  name: ProfileText;
  affiliation: ProfileText;
  operator?: ProfileText;
}[] = [
  {
    match: /^CZ-/i,
    name: text('Long March', '长征系列'),
    affiliation: CHINA,
    operator: text('CASC', '中国航天科技集团'),
  },
  {
    match: /^KZ-/i,
    name: text('Kuaizhou', '快舟系列'),
    affiliation: CHINA,
    operator: text('ExPace', '航天科工火箭技术有限公司'),
  },
  {
    match: /^(?:ZK-1A|LIJIAN)/i,
    name: text('Kinetica-1 (Lijian-1)', '力箭一号'),
    affiliation: CHINA,
    operator: text('CAS Space', '中科宇航'),
  },
  {
    match: /^GRAVITY-/i,
    name: text('Gravity-1', '引力一号'),
    affiliation: CHINA,
    operator: text('Orienspace', '东方空间'),
  },
  {
    match: /^CERES-/i,
    name: text('Ceres-1', '谷神星一号'),
    affiliation: CHINA,
    operator: text('Galactic Energy', '星河动力'),
  },
  {
    match: /^(?:ZQ-|ZHUQUE)/i,
    name: text('Zhuque', '朱雀系列'),
    affiliation: CHINA,
    operator: text('LandSpace', '蓝箭航天'),
  },
  {
    match: /^(?:JIELONG|SD-3)/i,
    name: text('Jielong-3', '捷龙三号'),
    affiliation: CHINA,
    operator: text('China Rocket', '中国长征火箭有限公司'),
  },
  {
    match: /^FALCON/i,
    name: text('Falcon 9 upper stage', '猎鹰 9 号第二级'),
    affiliation: US,
    operator: text('SpaceX', 'SpaceX'),
  },
  {
    match: /^ELECTRON/i,
    name: text('Electron kick stage', '电子号末级（Kick Stage）'),
    affiliation: text('United States · New Zealand', '美国 · 新西兰'),
    operator: text('Rocket Lab', 'Rocket Lab'),
  },
  {
    match: /^(?:ATLAS|CENTAUR|DELTA|VULCAN|MINOTAUR|PEGASUS)/i,
    name: text('US launch vehicle', '美国运载火箭'),
    affiliation: US,
  },
  {
    match: /^(?:FREGAT|BREEZE|BRIZ|SL-|SOYUZ|PROTON|ANGARA)/i,
    name: text('Soviet/Russian launch vehicle', '苏联／俄罗斯运载火箭'),
    affiliation: RUSSIA,
  },
  {
    match: /^(?:ARIANE|VEGA)/i,
    name: text('European launch vehicle', '欧洲运载火箭'),
    affiliation: text('Europe', '欧洲'),
    operator: text('Arianespace', '阿丽亚娜航天公司'),
  },
  {
    match: /^(?:H-2A|H-IIA|H3|H-3)/i,
    name: text('Japanese launch vehicle', '日本运载火箭'),
    affiliation: JAPAN,
  },
  {
    match: /^(?:PSLV|GSLV|LVM3)/i,
    name: text('Indian launch vehicle', '印度运载火箭'),
    affiliation: INDIA,
    operator: ISRO,
  },
];
const rocketProfile = (name: string): ObjectProfile => {
  const vehicle = VEHICLES.find(({ match }) => match.test(name));
  return vehicle
    ? {
        ...ROCKET,
        affiliation: vehicle.affiliation,
        operator: vehicle.operator,
        mission: text(
          `Rocket body · ${vehicle.name.en}`,
          `火箭体 · ${vehicle.name.zh}`,
        ),
      }
    : ROCKET;
};
const DEBRIS: ObjectProfile = {
  separated: true,
  mission: text('Debris · separated object', '碎片 · 分离物'),
  summary: text(
    'The catalogue marks this object as debris: a fragment from a breakup or explosion, or a part shed during launch, such as an adapter, fairing or cover. Ground radars and telescopes track pieces larger than about 10 cm in low orbit; far more smaller pieces go untracked. At orbital speeds of several kilometres per second even a small fragment can damage a satellite, so operators screen their orbits against catalogued debris and manoeuvre when the risk is high.',
    '目录将本目标标为碎片：可能是解体或爆炸产生的残片，也可能是发射时抛下的部件，如适配器、整流罩或保护盖。地面雷达和望远镜能跟踪低轨上大于约 10 cm 的碎片，更小的碎片数量多得多却无法编目。轨道上相对速度达每秒数千米，即使很小的碎片也能损坏卫星，所以运营者会把轨道与碎片目录比对，风险较高时就变轨规避。',
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

const UNIDENTIFIED: ObjectProfile = {
  mission: text('Not yet identified', '尚待识别的目标'),
  summary: text(
    'The catalogue still uses a provisional name: the launch designator, or the launch name followed by “OBJECT” and a letter. A single launch can release dozens of satellites, stages and adapters flying close together; until tracking data separate them and the operator confirms which is which, each piece gets a placeholder name. The real name is filled in later, sometimes weeks afterwards.',
    '目录仍在使用临时名称：直接用国际编号，或在发射名称后加“OBJECT”和字母。一次发射可能释放数十颗卫星以及火箭级和分离装置，起初它们挤在相近的轨道上；在跟踪数据把它们区分开、运营方确认对应关系之前，每个物体只能先用临时名称，正式名称往往要几周后才补上。',
  ),
  sources: [CATALOG_SOURCE],
};
const STATION_RELEASE: ObjectProfile = {
  separated: true,
  mission: text(
    'Released from the International Space Station',
    '从国际空间站释放的目标',
  ),
  summary: text(
    'This object shares the space station’s designator, 1998-067, because it reached orbit inside the station rather than on its own launch. Most such objects are CubeSats: university and company satellites delivered with cargo and pushed out from deployers on the Japanese Kibo module. Equipment released or lost during spacewalks is catalogued the same way. Without propulsion they sink faster than the station and re-enter within months to a few years.',
    '这个目标沿用国际空间站的国际编号 1998-067，因为它是先随货运飞船进入空间站、再从空间站进入轨道的，没有自己单独的发射。这类目标多数是立方星：大学和企业的小卫星随补给运上空间站，再由日本“希望号”实验舱上的释放器推出。出舱活动中释放或脱落的设备也以同样方式编目。它们没有推进系统，比空间站下降得更快，几个月到几年内就会再入大气层。',
  ),
  sources: [ISS_SOURCE, CATALOG_SOURCE],
};
const SHENZHOU_MODULE: ObjectProfile = {
  separated: true,
  affiliation: CHINA,
  mission: text('Shenzhou · separated module', '神舟 · 分离舱段'),
  summary: text(
    'A separately catalogued module from a Shenzhou crew spacecraft. Shenzhou has three parts: an orbital module, a return capsule and a propulsion module. Before coming home they separate, and only the return capsule with the crew lands; the other parts burn up in the atmosphere, immediately or after some time in orbit.',
    '神舟载人飞船中单独编目的一个舱段。神舟由轨道舱、返回舱和推进舱组成；返回前各舱分离，只有载着航天员的返回舱落回地面，其余部分立即或在轨道上停留一段时间后，在大气层中烧毁。',
  ),
  sources: [source('中国载人航天工程', 'https://en.cmse.gov.cn/missions/')],
};

export function satelliteProfile(entry: CatalogEntry) {
  const individual = SATELLITE_PROFILES[entry.norad];
  if (individual) return { profile: individual, scope: 'object' as const };
  const key = CONSTELLATIONS[entry.group].key;
  // The three named debris clouds already have their own event backgrounds.
  if (CONSTELLATIONS[entry.group].kind === 'debris')
    return { profile: GROUP_PROFILES[key], scope: 'family' as const };
  if (/\bR\/B\b/i.test(entry.name))
    return { profile: rocketProfile(entry.name), scope: 'object' as const };
  if (/\bDEB\b/i.test(entry.name))
    return { profile: DEBRIS, scope: 'object' as const };
  if (/^\d{4}-\d{3}[A-Z]*$|\bOBJECT [A-Z]+$/i.test(entry.name))
    return { profile: UNIDENTIFIED, scope: 'object' as const };
  if (/^SZ-\d+ MODULE/i.test(entry.name))
    return { profile: SHENZHOU_MODULE, scope: 'object' as const };
  if (entry.cospar.startsWith('1998-067'))
    return { profile: STATION_RELEASE, scope: 'object' as const };
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
