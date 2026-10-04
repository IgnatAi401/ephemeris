# orbit 子站：新会话提示词


---

## 任务

在 `/Users/ignat/Developer/ephemeris` 新建一个独立的纯静态网站项目：卫星轨道可视化站，部署到 GitHub Pages，绑定子域名 `orbit.<你的域名>`。星历数据由 GitHub Actions 定时自动更新。

**优先级：炫酷展示 > 实用功能 > 科普内容。** 前一类达标后再做后一类。

请先读完本说明和下文列出的源文件，进入计划模式（plan mode），给出分阶段实施计划。我确认后再逐阶段实现，每阶段结束时运行检查并启动本地预览。

## 背景：现有实现（只读参考，不要修改）

我的个人主页 `/Users/ignat/Developer/personal_profile` 的学术页里有一个卫星轨道板块。本项目是把它独立出来并扩展。读取该目录如需授权，请向我申请；**不得修改该目录中的任何文件**。

相关文件及作用：

| 文件 | 作用 |
| --- | --- |
| `scripts/fetch-orbits.mjs` | 手动抓取数据。从 CelesTrak 抓 7 个星座的 TLE（starlink、iridium-NEXT、orbcomm、gps-ops、glo-ops、galileo、beidou，约 1.09 万颗），压缩成每颗 7 个数的扁平数组写入 `public/data/orbits.json`（约 700 KB）；从 JPL Horizons 抓 SOHO、JWST、Euclid 的地心状态向量（6 小时一个点）和 LRO、Danuri 的月心密切根数（2 小时一组），时间范围为抓取前 16 天到抓取后 30 天，写入 `public/data/spacecraft.json`（约 100 KB）。含 J2000 到瞬时平赤道的岁差旋转；`TDB_OFFSET` 写死为 69.184 s（仅在不出现新闰秒时成立）。 |
| `scripts/check-orbits.mjs` | 离线校验：各星座非空，±7 天内所有卫星的半径落在合理壳层内，深空和绕月航天器的距离合理。 |
| `lib/orbits.ts` | 平均根数加 J2 长期项的快速推算（不是 SGP4），以及太阳方向、月球位置、恒星时、地面站仰角、月相。 |
| `lib/ephemeris.ts` | Horizons 快照的插值：状态向量用三次 Hermite 插值，月球轨道器用二体推算。 |
| `lib/orbit-scene.ts`（约 1170 行） | ogl（WebGL 2）主场景：地球、星座、GNSS 拖尾、地面接收点、GNSS 信号溢出、月球轨迹、L1/L2、月球特写；`SceneView` 中 0–1 的图层权重控制淡入淡出。 |
| `lib/orbit-stage.ts` | 后台加载数据和陆地纹理、构建场景，处理 WebGL 上下文丢失后重建。依赖主站的 `@/lib/boot`（`settled`），迁移时需解耦。 |
| `lib/orbit-land.ts`、`lib/orbit-land.worker.ts` | 在 Worker 中用 d3-geo 和 topojson 把 `public/maps/countries-50m.json` 画成陆地纹理（数据来源见同目录的 `README.md` 和 `provenance.json`）。 |
| `lib/orbit-tape.ts` | 底部 UTC 时间标尺。 |
| `components/orbit-map.tsx` | React 交互外壳：播放/暂停、拖动时间、图层切换、中英双语文案。依赖主站的 `@/lib/profile`（`Language`）和 `@/models/alice/alice-frame-loop`（`createFrameLoop`）。 |
| `components/hero-orbit.tsx`、`lib/milky-way.ts` | 可选参考：首页的小轨道动画和银河着色器，可借鉴视觉效果。 |

主站技术栈（新项目沿用相同大版本，保持一致）：Node 24.21.0（fnm，`.node-version`），pnpm 12.3.4，Vite 8，React 19.2，TypeScript 5.9，Tailwind CSS 4，ogl 1.0.11，d3-geo 3，topojson-client 3，lucide-react。格式化和检查工具是 oxfmt 和 oxlint。

## 技术与工程约定

- 新建独立 Git 仓库，计划用公开仓库 `IgnatAi401/ephemeris`。纯静态 Vite 应用，`base: '/'`（子域名部署在根路径）。
- 从主站**复制**所需模块后再解耦重构，不跨目录引用。去掉对 boot、Alice、profile 的依赖；`createFrameLoop` 这类小工具直接复制一份精简版。
- 新增依赖只限必要项，并说明用途。实用阶段计划引入 `satellite.js`（SGP4）。
- 本地预览端口用 **3001**（3000 留给主站），地址 `http://127.0.0.1:3001/`。
- 为新项目写 `AGENTS.md`（或 `CLAUDE.md`），记录目录结构、命令、数据管线、发布方式和本文的约束。
- 日常检查运行 `pnpm typecheck` 和数据校验脚本。构建只在验证部署流程或我要求时运行。
- **未经我明确要求，不 commit、不 push、不在 GitHub 上创建仓库、不触发部署。** 需要我手动操作的步骤（DNS、GitHub 设置）写成清单交给我。

## 阶段 0：项目骨架与迁移

1. 初始化 pnpm 项目、Vite、TS、Tailwind、oxlint 和 oxfmt；建立 `src/`、`scripts/`、`public/`。
2. 迁移上述模块和资源（陆地 TopoJSON 及其来源说明），先把现有场景全屏跑起来，效果与主站一致。
3. 处理 WebGL 2 不可用时的降级：显示静态海报图和提示。
4. 页脚注明数据与素材来源：CelesTrak、JPL Horizons、Natural Earth（经 world-atlas）。

## 阶段 1：数据管线重写

1. `scripts/fetch-orbits.mjs` 改用 CelesTrak 的 **OMM JSON**（`gp.php?GROUP=...&FORMAT=json`），不再解析 TLE。原因是 TLE 的卫星编号只有 5 位，编号超过 99999 的新目标无法表示。保留现有的紧凑数组输出，或设计一个同样紧凑的新格式，并说明理由。
2. 扩展分组。实现前先在 CelesTrak 的分组列表里核实每个名称是否存在，不要猜：
   - 空间站：`stations`（天宫、ISS）
   - 地球静止轨道：`geo`
   - 最近 30 天发射：`last-30-days`
   - 碎片云：风云一号 C、宇宙 2251、铱星 33 的碎片分组
   - 千帆、国网：有对应分组才加
3. 卫星名称和 NORAD 编号（点选、搜索要用）放进单独的 `catalog.json` 按需加载，不拖慢首屏。
4. Horizons 部分：去掉写死的 2026 时间注释和闰秒假设，改成带说明的常量或可计算值。保留"失败即报错"的严格校验。
5. 输出 `status.json`：抓取时间、每个分组的数量、数据来源。
6. 加强 `check-orbits`：除壳层校验外，与上一次的 `status.json` 比较，任一分组数量骤降超过 20% 或为 0 时失败；文件超过体积预算时失败。
7. 抓取礼仪：同一分组 2 小时内最多下载一次；请求带有可识别的 User-Agent；失败按退避策略重试。**浏览器端永远不直接请求 CelesTrak 或 Horizons。**

## 阶段 2：自动化与部署

GitHub Actions 工作流 `.github/workflows/update-and-deploy.yml`：

- 触发条件：
  - `schedule`：星座数据每天 2 次，选一个非整点的分钟（如 `17 3,15 * * *`，UTC），避开整点高峰；
  - `workflow_dispatch`：手动触发；
  - push 到 `main`。
- Horizons 数据每周更新一次，可以在同一工作流里按星期判断，也可以拆成单独的 job。
- 流程：安装依赖（`pnpm install --frozen-lockfile`）→ 抓取 → 校验 → 构建 → `actions/upload-pages-artifact` → `actions/deploy-pages`。
- 抓取的大数据文件**不提交进 Git**，只随构建产物部署。某个数据源失败、或本次不需要刷新时，从线上 `https://orbit.<你的域名>/data/*.json` 取回上一版继续用。这样 Horizons 故障不会阻断星座数据的更新，任何一步失败时线上也保持旧版。
- 每次成功后只把很小的 `status.json` 提交回仓库。这样既保留数量变化的历史，也能避免公开仓库 60 天无提交导致定时任务被停用。用 `GITHUB_TOKEN` 推送不会再触发工作流，不会循环。
- 权限最小化：deploy job 用 `pages: write`、`id-token: write`，提交 status 的 job 用 `contents: write`。设置 `concurrency`，防止两次部署重叠。
- `public/CNAME` 写 `orbit.<你的域名>`。
- 页面上显著显示"星历更新于 X 小时前"。数据超过 3 天未更新时显示提示。


## 阶段 3：炫酷展示（最优先）

目标是全屏沉浸式体验，打开就有"哇"的感觉。

- 开场：镜头从深空推近地球，星座按层依次点亮（GNSS → Starlink 壳层 → 其他）。遵循 `prefers-reduced-motion`，减少动态时直接显示最终画面。
- 视觉：
  - 晨昏线和夜面城市灯光（素材需注明来源）
  - 大气辉光
  - Starlink 各轨道壳层的整体光晕
  - 碎片云单独配色，可开关
  - 新发射卫星高亮
  - 后期辉光（bloom）仅在性能允许时开启
- 尺度漫游：近地轨道 → GNSS 和静止轨道 → 月球 → L1/L2，镜头平滑过渡。复用现有 `SceneView` 的图层权重机制。
- 时间控制：沿用时间标尺，加倍速档位（1×、60×、600×、3600×）和"回到现在"。
- 交互：鼠标、触控旋转缩放带惯性；图层开关；键盘快捷键。

## 阶段 4：实用功能

1. 点选或搜索卫星：拾取方案（屏幕空间最近点或 GPU picking）需在计划中说明取舍。信息卡显示名称、NORAD 编号、所属分组、高度、倾角、周期、数据历元。
2. 选中卫星用 `satellite.js` 的 SGP4 精确推算，显示轨道线和星下点轨迹。大批量卫星仍用快速 J2 推算。
3. 过境预报：通过定位权限或手动选城市获取观测位置，**位置只在本地计算，不上传**，可选存入 localStorage。算出未来几天天宫、ISS 等亮目标的可见过境：卫星受阳光照射，观测者处于天文昏暗。给出开始和结束方位、最高仰角，可在天空图上播放。
4. 可分享链接：时间、视角、选中卫星、图层写入 URL hash。

## 阶段 5：科普内容

- 轨道类型讲解：LEO、MEO、GEO、HEO、闪电轨道、太阳同步轨道，点击后在场景里高亮对应卫星。
- 交互演示六个轨道根数各自控制什么。
- 文案简短，中英双语（默认中文，可切换英文）。

## 每阶段结束时汇报

说明改动、实际运行过的检查及结果、预览地址、未解决的问题和需要我决定的事项。


