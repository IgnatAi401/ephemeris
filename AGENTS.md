# ephemeris：orbit.ignat.ai 项目说明

纯静态卫星轨道可视化站，部署到 GitHub Pages 的子域名 `orbit.ignat.ai`（计划仓库 `IgnatAi401/ephemeris`，公开）。优先级：炫酷展示 > 实用功能 > 科普内容。分阶段计划见 `/Users/ignat/.claude/plans/wondrous-floating-turing.md`。

## 来源与只读约束

- 场景、推算和数据脚本最初复制自个人主页 `/Users/ignat/Developer/personal_profile`（学术页轨道板块）。**该目录只读，不得修改**；本项目不跨目录引用它的任何文件。
- 主站的 boot、Alice、profile 依赖已去掉：`settled()` 换成 `src/lib/orbit-stage.ts` 里的 `idle()`，`createFrameLoop` 复制为精简版 `src/lib/frame-loop.ts`，语言类型在 `src/lib/i18n.ts`。

## 目录

- `src/main.tsx`、`src/app.tsx`、`src/styles.css`：入口、外壳和样式（`.orbit-*` 样式改编自主站 `app/globals.css`）。
- `src/components/orbit-view.tsx`：全屏视图的 React 外壳（时钟、时间标尺拖动与惯性、三个专题镜头、图例）。
- `src/components/fallback.tsx`：无 WebGL 2 时的海报（`public/poster.webp`）和提示；`?nowebgl` 可强制预览。
- `src/lib/orbit-scene.ts`：ogl（WebGL 2）主场景；`SceneView` 中 0–1 的图层权重控制淡入淡出。
- `src/lib/orbits.ts`：平均根数 + J2 长期项的快速推算（不是 SGP4）、太阳/月球/恒星时等。
- `src/lib/ephemeris.ts`：Horizons 快照插值（Hermite / 二体）。
- `src/lib/orbit-stage.ts`：后台加载数据和陆地纹理、构建场景、WebGL 上下文丢失后重建。
- `src/lib/orbit-land*.ts`：在 Worker 中把 `public/maps/countries-50m.json` 画成陆地纹理。
- `src/lib/site.ts`：站点域名和数据来源列表（页脚用）。
- `scripts/fetch-orbits.mjs`、`scripts/check-orbits.mjs`：抓取与离线校验。
- `public/data/`：抓取产物，**不进 Git**，只随构建部署。
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

## 约束

- **未经用户明确要求，不 commit、不 push、不在 GitHub 上创建仓库、不触发部署。** 需要用户手动操作的步骤（DNS、GitHub 设置）写成清单交给用户。
- 新增依赖只限必要项，并说明用途；保留 `pnpm-lock.yaml`，不引入其他包管理器。
- 外部素材须注明来源与许可（页脚和 `public/` 下的说明文件）。
- 下载外部文件前先征得用户同意。
