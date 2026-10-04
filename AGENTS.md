# ephemeris：orbit.ignat.ai 项目说明

纯静态卫星轨道可视化站，部署到 GitHub Pages 的子域名 `orbit.ignat.ai`（计划仓库 `IgnatAi401/ephemeris`，公开）。优先级：炫酷展示 > 实用功能 > 科普内容。分阶段计划见 `/Users/ignat/.claude/plans/wondrous-floating-turing.md`。

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
- `scripts/fetch-orbits.mjs`、`scripts/check-orbits.mjs`：抓取与离线校验。
- `public/data/`：抓取产物，**不进 Git**，只随构建部署。
- `public/textures/night-lights.webp`：NASA Black Marble 2016 夜光（来源与处理见同目录 `README.md`）。
- 开发模式下 `window.__orbitScene()` 返回当前场景对象，便于在控制台计时或检查（生产构建不包含）。
- `orbits.ts` 和 `ephemeris.ts` 会被 Node 脚本直接导入（类型剥离），只能用可擦除的 TS 语法，且不要引入其他模块。

## 命令

- 依赖：`pnpm install --frozen-lockfile`（Node 版本见 `.node-version`，pnpm 见 `packageManager`）。
- 预览：`pnpm dev` → `http://127.0.0.1:3001/`（3000 留给主站；端口被占用时不擅自换端口）。按 `Ctrl+C` 停止。
- 日常检查：`pnpm typecheck`、`pnpm lint`、`pnpm check:data`。
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

## 发布

- 工作流 `.github/workflows/update-and-deploy.yml`：
  - 触发：`schedule` 每天 03:17、15:17（UTC）抓 CelesTrak；周一早上那次同时抓 Horizons（每周一次）；`workflow_dispatch` 手动，可勾选“立即刷新 Horizons”和“接受数量下降”（对应 `--accept-drop`）；push 到 `main` 只部署代码，数据取线上现有版本。
  - build job：安装 → typecheck → lint → 恢复 `.cache/celestrak`（跨运行保证 2 小时规则）→ `scripts/prepare-data.mjs` → `pnpm build` → 上传 Pages 产物和 status 产物。
  - `prepare-data.mjs`：每部分先用首选来源（`fetch` 抓取或 `live` 从 `https://orbit.ignat.ai/data/` 取回），失败再用另一个；航天器两者都失败时不带航天器部署。然后跑 `check-orbits`；新抓的数据不过校验时换回线上版本再校验，通过则照常部署，但最后的 `report` job 让本次运行失败以便收到通知；线上版本也不可用时整次运行失败、不部署（线上保持旧版）。本地测试可用 `SITE_ORIGIN=http://127.0.0.1:3001` 指向本地 preview。
  - deploy job（`pages: write`、`id-token: write`）→ commit-status job（`contents: write`，只在定时/手动运行时把 `status/status.json` 提交回 `main`）。`concurrency: pages`，排队不取消。
- 抓取的数据不进 Git；`status/status.json` 是校验的基线，只由工作流更新（或本地确认后手动更新）。
- `public/CNAME` 为 `orbit.ignat.ai`；页面顶部显示“星历更新于 X 小时前”（读 `status.json`），超过 3 天变为警告。
- 本地验证构建：`pnpm build` 后 `pnpm preview`（同为 3001 端口，需先停开发服务器）。

## 视觉与性能约定

- 每帧的开销大头：天空着色器（逐像素，与画布像素数成正比）和地月视角的 GNSS 外溢波束锥（2D 画布，已降到半分辨率并限制为镜头/图层变化时或每 100 ms 重画）。新增效果前先在开发模式下用 `__orbitScene().render(...)` 加 `gl.finish()` 计时。
- Bloom 只在非触屏设备默认开启；开启状态下前 2 秒帧时间中位数超过 25 ms 会自动关闭。
- `prefers-reduced-motion`：跳过开场、关闭惯性和补间，时钟默认暂停在 1×。

## 约束

- **未经用户明确要求，不 commit、不 push、不在 GitHub 上创建仓库、不触发部署。** 需要用户手动操作的步骤（DNS、GitHub 设置）写成清单交给用户。
- 新增依赖只限必要项，并说明用途；保留 `pnpm-lock.yaml`，不引入其他包管理器。
- 外部素材须注明来源与许可（页脚和 `public/` 下的说明文件）。
- 下载外部文件前先征得用户同意。
