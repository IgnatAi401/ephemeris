# ephemeris：orbit.ignat.ai 项目说明

纯静态卫星轨道可视化站，部署到 GitHub Pages 的子域名 `orbit.ignat.ai`（计划仓库 `IgnatAi401/ephemeris`，公开）。优先级：炫酷展示 > 实用功能 > 科普内容。分阶段计划见 `/Users/ignat/.claude/plans/wondrous-floating-turing.md`（阶段 0–5）和项目内的 `missions-plan.md`（阶段 6 起：历史任务回放）。

## 来源与只读约束

- 场景、推算和数据脚本最初复制自个人主页 `/Users/ignat/Developer/personal_profile`（学术页轨道板块）。**该目录只读，不得修改**；本项目不跨目录引用它的任何文件。
- 主站的 boot、Alice、profile 依赖已去掉：`settled()` 换成 `src/lib/orbit-stage.ts` 里的 `idle()`，`createFrameLoop` 复制为精简版 `src/lib/frame-loop.ts`，语言类型在 `src/lib/i18n.ts`。

## 目录

- `src/main.tsx`、`src/app.tsx`、`src/styles.css`：入口、外壳和样式（`.orbit-*` 样式改编自主站 `app/globals.css`）。
- `src/components/orbit-view.tsx`：全屏视图的 React 外壳：模拟时钟（1×/60×/600×/3600×、回到现在）、时间标尺拖动与惯性、开场动画、四个尺度预设（近地 → 中高轨 → 地月 → 日地 L1/L2，加总览）、镜头拖动旋转/滚轮与双指缩放（带惯性）、键盘快捷键、图层权重的淡入淡出、Bloom 的性能降级。
- `src/components/layer-panel.tsx`：图例兼图层开关（`src/lib/layers.ts` 定义开关和默认值）；`shortcut-help.tsx`：快捷键说明；`freshness.tsx`：“星历更新于 X 小时前”。
- `src/components/fallback.tsx`：无 WebGL 2 时的海报（`public/poster.webp`）和提示；`?nowebgl` 可强制预览。
- `src/lib/orbit-scene.ts`：ogl（WebGL 2）主场景和 2D 标注层；`SceneView` 中 0–1 的权重控制淡入淡出（每组可见度、城市灯光、新发射脉动、星链光晕、Bloom 强度）。
- `src/lib/scene-camera.ts`：透视相机（视场 32°，`zoom` 仍表示“地球距离处画面半高对应的地球半径数”）、投影、地球遮挡判断；`src/lib/scene-shaders.ts`：全部 GLSL（天球星空与银河、地球与大气、卫星点与光晕、拖尾、Bloom 三个后期 pass）。
- `src/lib/orbits.ts`：平均根数 + J2 长期项的快速推算（不是 SGP4）、太阳/月球/恒星时等。
- `src/lib/ephemeris.ts`：Horizons 快照插值（Hermite / 二体）。
- `src/lib/orbit-stage.ts`：后台加载数据和陆地纹理、构建场景、WebGL 上下文丢失后重建。
- `src/lib/orbit-land*.ts`：在 Worker 中把 `public/maps/countries-50m.json` 画成陆地纹理。
- `src/lib/site.ts`：站点域名和数据来源列表（页脚用）。
- 实用功能（阶段 4）：
  - `src/lib/catalog.ts`：按需加载 `catalog.json`（首次悬停、搜索、点选或打开过境面板时），与卫星群同序，支持按名称/NORAD 编号搜索。
  - `src/lib/precise.ts`：选中卫星用 `satellite.js`（SGP4/SDP4）精确推算，动态导入，不进首屏包；OMM 由 `orbits.json` 的原始根数（`fleet.elements`）和 catalog 的阻力项重建。满天光点仍用 `orbits.ts` 的快速 J2 推算。
  - 点选：`OrbitScene.pick()` 在 CPU 上按屏幕距离找最近的可见卫星（约 1–4 ms），不做 GPU 读回。场景为选中卫星画轨道线、星下点轨迹（按地球自转校正到当前时刻）和标记。
  - `src/lib/passes.ts`：过境预报，条件为仰角 > 10°、卫星受光（satellite.js `shadowFraction`）、观测地太阳低于 −6°；30 秒步长扫描、二分细化起止。`src/lib/cities.ts` 为手选城市。位置**只在浏览器内计算，不上传**；只有勾选“记住”才写入 localStorage（`orbit.observer`）。
  - `src/lib/share.ts`：分享链接的 hash 格式（`t`、`cam`、`f`、`sel`、`layers`）。只有点“分享”时才写入地址栏；打开带 hash 的链接会跳过开场、暂停在该时刻；之后第一次点击或滚轮就清掉 hash，避免刷新时一直停在旧时刻。
  - 组件：`search-box.tsx`、`info-card.tsx`、`pass-panel.tsx`、`sky-chart.tsx`，都放在场景右侧的 `.orbit-side` 栏（窄屏时变为底部浮层）。
- 科普（阶段 5）：
  - `src/lib/orbit-types.ts`：七类轨道（LEO、MEO、GEO、HEO、闪电、太阳同步、地月转移）的判定规则、中英文讲解和示例根数；`classify(fleet)` 生成每类的卫星掩码和数量。太阳同步按 J2 升交点进动速率与太阳平运动（每天约 0.9856°）相差 10% 以内判定。
  - 地月转移（`tli`）：CelesTrak 数据里通常没有这类目标（远地点 > 15 万 km），按示意轨道处理。`lunarTransfer(depart)` 从 200 km 停泊轨道出发，远地点放在月球到达时刻的真实位置、轨道面取月球轨道面，飞行时间为半个周期（约 5 天）。选中时镜头转到俯视这段路程（`transferPose`，远地点在左，避开右侧面板），时钟调到 3600×；场景只画去程半个椭圆、到达点标记，到达后探测器绕月飞行（`SceneView.example.transfer`）。
  - 场景的教学模式：`OrbitScene.setFocus(mask)` 加 `SceneView.focus`（0–1）让该类卫星突出、其余变暗；`SceneView.example` 用经典根数画一条虚线示例轨道（`src/lib/kepler.ts`）。
  - `src/components/learn-panel.tsx`：“轨道类型”和“轨道六根数”两个标签页；`elements-demo.tsx` 是可拖动旋转的二维小图，六个滑块分别标出 a、e、i、Ω、ω、M（以真近点角 ν 表示）并给出说明，可把演示轨道画进主视图（Ω 从真实春分点方向量起，轨道超出当前画面时镜头自动拉远）。a 的滑块按对数刻度，范围 1.1–64 地球半径（到月球距离），e 最大 0.98；远地点超过约 6 个地球半径后画面比例随之缩小，并显示月球距离圈。
  - 文案全部中英双语，默认中文。
- 历史任务回放（阶段 6–7，计划见 `missions-plan.md`）：
  - `src/lib/missions.ts`：任务表（`MISSIONS`）：中英文名称和讲解、发射时间、各航天器颜色、可选参考系、阶段（起始时间、讲解、镜头 `shot`、播放速度、自动导览切换到的参考系）和关键事件。事件时间取自机构公布的时间线，并用数据核对过（近月点、最远距离、点火都能在矢量里看出来）。会被 Node 脚本直接导入，只能用可擦除的 TS 语法，从其他模块只能 `import type`（行星半径等数值在文件内自带一份）。
  - `src/lib/mission-track.ts`：按需加载 `public/missions/<id>.json`，三次 Hermite 插值；四种参考系 `earth`（地心）、`moon`（月心）、`earthMoon`（地月旋转，按当时地月距离归一化，月球保持不动）、`sunEarth`（日地旋转，绕黄道极转）。轨迹先按“离较近天体约 3° 弧”加密，再存成各参考系的局部坐标（首次用到时生成）。
  - 场景：`SceneView.mission` 时隐藏全部卫星群和今天的深空航天器，月球改用任务数据里的月球（解析公式误差约 2000 km，大于月球半径）；轨迹在 GPU 上画成带宽度的条带（`pathVertex`/`pathFragment`，已飞部分亮、其余暗，被地球或月球挡住的部分不画，参与 Bloom），每个航天器每种参考系一个网格；事件菱形、航天器标记和标签在 2D 层。镜头：`aimMoon`/`aimCraft` 权重决定看向地球、月球还是航天器，`aimX/Y/Z` 是在 `cameraAxes`（参考系的坐标轴，镜头随参考系一起转）里的偏移，用来把轨迹放在面板留出的空间中间。
  - `orbit-view.tsx`：进入任务后时钟范围换成任务时段，时间标尺换成 `src/lib/mission-tape.ts`（滚轮缩放比例，标出事件），速度档为 1 分/秒到 1 天/秒；“自动”导览在进入新阶段时切换镜头、速度和参考系，用户缩放、改速度或手选参考系时关闭。初始视角取轨迹按长度加权后最“薄”的方向（再倾斜 25°），“全程”按轨迹在屏幕上的范围取景并保证相机离轨迹足够远，避免透视变形。
  - `src/components/mission-panel.tsx`：任务列表；回放中显示讲解、实时读数（任务时间 T+、速度、距地面、距月面，由帧循环直接写入 DOM）、镜头和参考系按钮、可点击跳转的事件列表（跳到事件前 20 分钟）。
  - 分享链接多 `m`（任务）和 `fr`（参考系）；带任务的链接打开后暂停在该时刻、不开自动导览。快捷键：回放中 1/2/3 为全程/月球/飞行器镜头，0 打开自动导览，`[`/`]` 跳到上一个/下一个事件，N 退出。
- 太阳系视图与行星际任务（阶段 7）：
  - `src/lib/planets.ts`：行星（水星到海王星、冥王星、阿罗科斯）的半径、外观参数、自转轴（IAU）、JPL Standish 平均根数（1800–2050，误差约 1–10 角分），`meanPosition` 给出日心位置（ICRF），`meanOrbit` 画轨道；`ECLIPTIC_AXES` 是日心视图镜头所用的黄道坐标轴。
  - 任务表里 `kind: 'helio'` 的任务用日心场景：`mission-track.ts` 读日心文件（航天器 + 遇到的天体，均为 ICRF/J2000 赤道坐标、km），没在文件里的行星用平均根数；参考系为 `sun`（日心）或以某个遇到的天体为中心（`jupiter` 等），坐标轴都是黄道轴。镜头的 `aimBody` 在地月任务里指月球，在行星际任务里指 `MissionView.focus` 天体；阶段的 `shot.body` 指定看哪个天体，`shot.above` 让镜头从行星上方俯看航天器（着陆）。
  - `orbit-scene.ts` 的 `renderHelio`：太阳在原点；`helioFragment` 一遍画出星空、按真实距离缩放的太阳和光晕、光线追踪的行星球体（纬向条带、斑驳纹理、晨昏线，土星带环和环上的行星阴影；地球沿用原来的纹理着色）。行星由 CPU 按距离由远到近排序，太小时放大到约 2 像素。行星轨道（平均根数）、名称、太阳标签、比例尺（AU）画在 2D 层。轨迹着色器整体改为相对相机的坐标（原点和遮挡球都在 CPU 上用双精度减去相机位置），几十 AU 外的近景也不抖。
  - 时间轴支持按月、年取刻度；行星际速度档 1 分/秒到 1 年/秒；读数改为相对太阳的速度、距太阳（靠近行星时改为距该行星表面）、距地球和光信号单程时间。
  - 镜头：行星际任务初始从黄道北侧 40° 俯看，轨迹主方向横向铺开；开场先停在地球近旁再拉远。“全程”取景会按真实透视迭代缩放和居中（轨迹朝相机延伸时不会出画）。
- 重建任务（阶段 8）：
  - 斯普特尼克 1 号、东方 1 号、阿波罗 8/11/13 号、嫦娥四号 + 鹊桥、嫦娥五号、天问一号。`missions.ts` 里带 `reconstructed: true`，数据文件同样带此标记；任务列表单独一组“根据公开资料重建”，回放时名称旁有“重建示意”标记，来源行写明“根据公开资料重建，非实测”，`note` 说明哪些段落是示意。
  - 做法：每次点火按真实点火的中点做成瞬时速度增量，用最小范数牛顿法解出满足公布数值（轨道高度、近月点高度与时刻、轨道面经过着陆点、再入高度和角度）的增量；动力上升/下降、交会、大气层内飞行用 `blend`（半径和转角的三次 Hermite；落地用 `settle`，不越过终点）。
  - 奔月：停泊轨道面取“过发射场且对着月球到达时位置的反方向”，并绕发射场微转使地月转移点火没有侧向分量；先在无月球引力下瞄准月球后方一点（兰伯特初值），月球引力会让慢速到达提前几小时，就把瞄准时刻推后，再用“距月 4 万 km 处的二体双曲线”估计、最后用实际近月点精化（近月点从最近采样点附近按 5 秒步长重积分，避免采样带来的跳动）。
  - 对时：着陆器到动力下降起点的相位靠调一次轨道的远（近）月点高度来对上公布时刻（`scanRoot` 先扫描再割线法）；这类调相变轨没有公开数据，属示意。
  - 返回：`homeward` 在公布时刻前后各 1 小时每 4 分钟试一次，取到达再入走廊（121.9 km、给定角度、公布时刻）最省的；路径没碰到地球时按密切近地点高度和时刻打分，求解器仍能把它拉回来。嫦娥五号先用“无月球引力下从月心出发”解出所需的出发速度方向，再选第一次月地入射的位置。
  - 天问一号：日心兰伯特弧连接地球和火星的双曲线（各自 3 天处对接，迭代使两端剩余速度一致），火星轨道段为二体椭圆，按公布时刻改变轨道；停泊轨道远火点微调使近火点落在着陆时刻。
  - 重建脚本运行约 5 分钟（Horizons 下载有缓存）；`DEBUG=1` 打印每次牛顿迭代的残差。
- `scripts/fetch-orbits.mjs`、`scripts/check-orbits.mjs`：抓取与离线校验。
- `scripts/fetch-missions.mjs`、`scripts/check-missions.mjs`：任务轨迹的一次性抓取与校验（见“数据管线”）。
- `scripts/reconstruct-missions.mjs`：没有实测数据的任务的重建（阶段 8，见下）；`scripts/lib/mission-data.mjs` 是抓取和重建共用的 Horizons 请求、插值、抽稀、打包函数；`scripts/lib/dynamics.mjs` 是力学模型（地球 J2 + 月球 + 太阳）、Dormand–Prince 积分、最小范数牛顿求解、兰伯特、二体推算、地球/月球/火星的地面点和“blend”过渡段。
- `public/missions/`：任务轨迹，**进 Git**（历史数据不会变）；来源与处理见同目录 `README.md`。
- `public/data/`：抓取产物，**不进 Git**，只随构建部署。
- `public/textures/night-lights.webp`：NASA Black Marble 2016 夜光（来源与处理见同目录 `README.md`）。
- 开发模式下 `window.__orbitScene()` 返回当前场景对象、`window.__mission()` 返回正在回放的任务状态，便于在控制台计时或检查（生产构建不包含）。
- `orbits.ts` 和 `ephemeris.ts` 会被 Node 脚本直接导入（类型剥离），只能用可擦除的 TS 语法，且不要引入其他模块。

## 命令

- 依赖：`pnpm install --frozen-lockfile`（Node 版本见 `.node-version`，pnpm 见 `packageManager`）。
- 预览：`pnpm dev` → `http://127.0.0.1:3001/`（3000 留给主站；端口被占用时不擅自换端口）。按 `Ctrl+C` 停止。
- 日常检查：`pnpm typecheck`、`pnpm lint`、`pnpm check:data`、`pnpm check:missions`。
- 任务轨迹：`pnpm missions:fetch [任务 id …]`，只在新增任务或改时段时手动运行（下载有缓存，在 `.cache/horizons-missions/`）。
- 重建任务：`pnpm missions:reconstruct [任务 id …]`，同样只在改动重建方法或参数时手动运行。
- 抓取数据：`pnpm data:fetch`（`--only=constellations`、`--only=spacecraft` 只刷新一部分，`--only=status` 只重建 status.json）。
- 按工作流方式准备数据：`pnpm data:prepare --constellations=fetch|live --spacecraft=fetch|live`。
- 构建：`pnpm build`，**只在验证部署流程或用户要求时运行**。
- 格式化：`pnpm format`（oxfmt）。

## 数据管线

- 入口 `scripts/fetch-orbits.mjs`，模块在 `scripts/lib/`：`celestrak.mjs`（OMM JSON、去重、新发射标记）、`horizons.mjs`（JPL 星历）、`time-scales.mjs`（TT−UTC 与闰秒表）、`net.mjs`（User-Agent、退避重试、缓存）、`status.mjs`（生成 status.json）。
- 分组表只有一处：`src/lib/orbits.ts` 的 `CONSTELLATIONS`（key、kind、CelesTrak 分组名、中英文名、颜色），前端和脚本共用。新增分组前先在 https://celestrak.org/NORAD/elements/ 核实分组名，并在 `orbit-scene.ts` 的 `STYLE` 里给出点大小和拖尾。
- 输出到 `public/data/`（不进 Git）：
  - `orbits.json`：每颗 7 个数（历元相对 `reference` 的天数保留 8 位小数≈1 ms、平均运动、偏心率、倾角、升交点赤经、近地点幅角、平近点角），`recent` 为最近 30 天发射的组内序号，`stats` 为各组原始数量、重复数和剔除数。
  - `catalog.json`：与 `orbits.json` 同序的 `[NORAD, 名称, 国际编号, BSTAR, ndot, nddot]`，按需加载（搜索、信息卡、SGP4）。
  - `spacecraft.json`：Horizons，抓取前 21 天到后 30 天；某航天器预报不足 30 天时可截短，但至少覆盖抓取后 21 天，否则报错。
  - `status.json`：抓取时间、各组数量、来源、文件体积。
- 同一 NORAD 编号出现在多组时只保留一次，优先级见 `celestrak.mjs` 的 `PRIORITY`；`last-30-days` 只收留不在其他组的目标，其余作为“新发射”标记。
- 抓取礼仪：同一分组 2 小时内最多下载一次（`.cache/celestrak/` 缓存，`fetched` 记最早的下载时间）；User-Agent `ephemeris-orbit/<version> (+https://orbit.ignat.ai)`；5/20/60 秒退避，4xx（除 408/429）不重试。浏览器端**永远不直接请求** CelesTrak 或 Horizons。
- 闰秒表 `time-scales.mjs` 的 `LEAP_TABLE_VALID_UNTIL` 到期后抓取会报错：读最新 IERS Bulletin C（每年 1 月、7 月发布）后更新表格和有效期。
- `check-orbits.mjs`：各组非空（`recent` 除外）；±7 天半径在各 kind 的壳层内；catalog 与 orbits 对齐、编号不重复；与 `status/status.json`（上次成功部署的基线）比较，任一组减少超过 20% 且超过 3 颗即失败（`recent` 除外），确认属实后用 `--accept-drop` 放行；航天器距离合理；体积预算 orbits/catalog ≤ 1.5 MB、spacecraft ≤ 200 kB、status ≤ 20 kB。
- 任务轨迹（`scripts/fetch-missions.mjs`，不进定时工作流）：每个地月任务在脚本的 `MISSIONS` 里写明 Horizons 编号和 UTC 时段（时段须落在 Horizons 覆盖范围内，加任务前先用 Horizons API 查起止）。先按粗步长抓全程，再对离地 < 6 万 km 或离月 < 1.5 万 km 的时段按 1 分钟重抓；剔除速度与前后位置差分相差 > 100 m/s 的行（Horizons 文件在小点火附近偶有拟合很差的片段）；再补“接缝”（`mend`：Horizons 在两次定轨解交接处位置会跳几到上百 km、速度不跳；按梯形公式 p₂ = p₁ + (v₁+v₂)·Δt/2 判定，偏差超过点火可能造成的 |v₂−v₁|·Δt/2 再加 1 km 即为接缝，两侧各分一半、在前后各 2 小时内线性摊平）；转到瞬时平赤道后按 Hermite 误差 0.5 km（远处略放宽）抽稀；月球每 3 小时一个点。Horizons 下载永久缓存在 `.cache/horizons-missions/`。
- 行星际任务（脚本的 `HELIO`，可遇天体表 `BODIES`）：日心 ICRF，不做岁差旋转。全程每天一行；离太阳 < 0.25 AU 或离遇到的天体 < 约 100 个半径的时段每 30 分钟一行；近距离飞掠（< 5 个半径，至少 10 万 km）每 2 分钟一行。**靠近天体的行以该天体为中心抓取，再加上该天体的日心状态**：Horizons 里老航天器的日心轨迹和行星为中心的轨迹在飞掠时可能差几千 km（旅行者 2 号飞掠天王星时，日心相减得 10.2 万 km，以天王星为中心查得 10.7 万 km，后者与公布值一致）。抽稀容差为 0.5 km 加离最近天体（含太阳）距离的 2/10,000；遇到的天体在相遇前后按小时抓、容差 50 km，其余按天、容差 8,000 km；速度保留到 0.1 m/s。剔除“坏行”时只看两小时内的相邻行，且只剔除速度跳出两侧邻行范围的（进入大气的减速是单调的，会保留）。
- `check-missions.mjs`（CI 的 build job 也跑）：数据文件与 `missions.ts` 的 `reconstructed` 标记一致；重建任务的地心轨迹允许落到地面（半径不小于极半径），其余仍要求高于大气层；每个任务都有数据文件且 ≤ 300 kB（行星际 ≤ 600 kB：卡西尼约 505 kB，gzip 后约 230 kB，只在选中时加载）；航天器数量一致、时间递增、相邻采样的位移不超过两端速度所能达到的范围（两倍速度乘间隔再加 20 km，抓“甩出轨道”的坏点）、间隔 ≤ 5 分钟的相邻采样符合梯形公式（偏差不超过 |v₂−v₁|·Δt/2 + 5 km，抓定轨解交接处的接缝；重建任务不查）、半径与速度合理（行星际：0.03–300 AU，< 250 km/s）；月球覆盖全程（行星际：阶段用到的天体都在文件里且覆盖全程）；阶段按时间排序且在数据范围内、阶段参考系是可选项；事件在数据范围内；发射早于数据开始。

## 发布

- 工作流 `.github/workflows/update-and-deploy.yml`：
  - 触发：`schedule` 每天 03:17、15:17（UTC）抓 CelesTrak；周一早上那次同时抓 Horizons（每周一次）；`workflow_dispatch` 手动，可勾选“立即刷新 Horizons”和“接受数量下降”（对应 `--accept-drop`）；push 到 `main` 只部署代码，数据取线上现有版本。
  - build job：安装 → typecheck → lint → check:missions → 恢复 `.cache/celestrak`（跨运行保证 2 小时规则）→ `scripts/prepare-data.mjs` → `pnpm build` → 上传 Pages 产物和 status 产物。
  - `prepare-data.mjs`：每部分先用首选来源（`fetch` 抓取或 `live` 从 `https://orbit.ignat.ai/data/` 取回），失败再用另一个；航天器两者都失败时不带航天器部署。然后跑 `check-orbits`；新抓的数据不过校验时换回线上版本再校验，通过则照常部署，但最后的 `report` job 让本次运行失败以便收到通知；线上版本也不可用时整次运行失败、不部署（线上保持旧版）。本地测试可用 `SITE_ORIGIN=http://127.0.0.1:3001` 指向本地 preview。
  - deploy job（`pages: write`、`id-token: write`）→ commit-status job（`contents: write`，只在定时/手动运行时把 `status/status.json` 提交回 `main`）。`concurrency: pages`，排队不取消。
- 抓取的数据不进 Git；`status/status.json` 是校验的基线，只由工作流更新（或本地确认后手动更新）。
- `public/CNAME` 为 `orbit.ignat.ai`；页面顶部显示“星历更新于 X 小时前”（读 `status.json`），超过 3 天变为警告。
- 本地验证构建：`pnpm build` 后 `pnpm preview`（同为 3001 端口，需先停开发服务器）。

## 视觉与性能约定

- 每帧的开销大头：天空着色器（逐像素，与画布像素数成正比）和 GNSS 外溢波束锥（图层开关“GNSS 信号锥”，默认关闭，任何尺度都可开；2D 画布，已降到半分辨率并限制为镜头/图层变化时或每 100 ms 重画）。新增效果前先在开发模式下用 `__orbitScene().render(...)` 加 `gl.finish()` 计时。
- Bloom 只在非触屏设备默认开启；开启状态下前 2 秒帧时间中位数超过 25 ms 会自动关闭。
- `prefers-reduced-motion`：跳过开场、关闭惯性和补间，时钟默认暂停在 1×。

## 约束

- **未经用户明确要求，不 commit、不 push、不在 GitHub 上创建仓库、不触发部署。** 需要用户手动操作的步骤（DNS、GitHub 设置）写成清单交给用户。
- 新增依赖只限必要项，并说明用途；保留 `pnpm-lock.yaml`，不引入其他包管理器。
- 外部素材须注明来源与许可（页脚和 `public/` 下的说明文件）。
- 下载外部文件前先征得用户同意。
