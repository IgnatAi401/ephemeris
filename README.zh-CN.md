# Orbit · 实时卫星轨道

[English](README.md) · 中文

**[orbit.ignat.ai](https://orbit.ignat.ai)** — 在浏览器里看地球周围上万颗卫星此刻在哪里。

![Orbit](public/poster.webp)

- **实时星空**：星链、GNSS（GPS / 北斗 / 伽利略 / 格洛纳斯）、铱星等卫星在真实的太阳光照和月球下运行；可拉远到地月空间和日地 L1/L2 的航天器。
- **实用工具**：按名称或 NORAD 编号搜索卫星，查看精确轨道（SGP4），预报你所在地能看到的过境。位置只在浏览器内计算，不会上传。
- **目标介绍**：点选或搜索卫星与航天器，查看中英文任务背景、国家／所属机构和已核实的发射资料。
- **轨道科普**：七类常见轨道和轨道六根数的交互讲解。
- **历史任务回放**：阿波罗、阿尔忒弥斯、嫦娥、旅行者、卡西尼、天问一号等，按真实（或根据公开资料重建的）轨迹重演。

纯静态网站，用 React、[ogl](https://github.com/oframe/ogl)（WebGL 2）和 [satellite.js](https://github.com/shashwatak/satellite-js) 构建，部署在 GitHub Pages；星历由 GitHub Actions 每天自动更新两次。

## 本地运行

需要 Node.js 24（见 `.node-version`）和 pnpm。

```bash
pnpm install --frozen-lockfile
pnpm data:fetch   # 抓取最新星历到 public/data/
pnpm dev          # 打开 http://127.0.0.1:3001/
```

## 数据与素材

- 卫星根数：[CelesTrak](https://celestrak.org)
- 航天器与任务星历：[NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
- 陆地边界：[Natural Earth](https://www.naturalearthdata.com)（经 [world-atlas](https://github.com/topojson/world-atlas)）
- 夜间灯光：[NASA Earth Observatory · Black Marble 2016](https://earthobservatory.nasa.gov/features/NightLights)

各素材的来源和处理方式见 `public/` 下对应目录的 README。标为“重建”的历史任务轨迹是根据公开资料推算的示意，并非实测数据。

## 人工维护目标介绍

介绍集中在 `src/lib/object-profiles.ts`，点击时才加载，不由脚本或工作流更新。

- `GROUP_PROFILES`：每个卫星分组的背景；`FAMILIES`：混合分组里可明确识别的系列。不要把“地球静止轨道”或“近期发射”当成一个任务。
- `SATELLITE_PROFILES`：以 NORAD 编号填写单个目标的专属介绍；`SPACECRAFT_PROFILES`：5 个深空、绕月航天器。
- `LAUNCH_PROFILES`：人工录入已核实的发射批次及来源，分组和国际编号同时匹配才使用。不要让同次发射的其他载荷、释放物或碎片沿用这些日期。
- 每条介绍提供中英文文案和来源链接。`launch` 只填核实过的本目标发射日期（`YYYY-MM-DD`，UTC），`launchSite` 为其发射地点。不要填系列首发日期，也不要把碎片形成日期写成发射日期；碎片事件单独放在 `event`。
- 缺项会显示“尚未补录”。国际编号中的年份单列为“编号关联年份”，可能指母航天器发射，不保证是释放物自身发射或分离的年份。

已有星历更新流程继续只维护轨道数据。介绍无需新依赖、外部实时请求或定期抓取。
