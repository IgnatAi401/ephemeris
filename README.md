# Orbit · 实时卫星轨道

`orbit.ignat.ai`：全屏的实时卫星轨道视图。星链、铱星、ORBCOMM 与四大 GNSS 星座在真实的太阳和月球下运行，可拉远到地月空间和日地 L1/L2 航天器。

```bash
pnpm install --frozen-lockfile
pnpm dev          # http://127.0.0.1:3001/
pnpm check:data   # 校验 public/data 下的快照
```

数据：[CelesTrak](https://celestrak.org)（卫星根数）、[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)（航天器星历）、[Natural Earth](https://www.naturalearthdata.com)（经 [world-atlas](https://github.com/topojson/world-atlas)，陆地边界）。

开发约定见 [AGENTS.md](AGENTS.md)。
