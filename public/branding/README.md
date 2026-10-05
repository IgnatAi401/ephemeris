# Orbit 网站图标

图标由 OpenAI 内置 ImageGen 工具生成，以用户最终附图确认的「紫色发光轨道」为准。它由一条倾斜的紫色椭圆轨道和一颗亮点组成，轨道带有柔和光晕，背景与轨道中央均透明，没有使用第三方素材。

来源：本项目的图标设计会话（2026-10-05）。作为项目生成素材使用，没有引入第三方素材及其许可文件。

- `orbit-source.png`：选定的原始 PNG（1254 × 1254），保留透明通道。
- `icon-192.png`：192 × 192 PNG，供浏览器使用。
- `apple-touch-icon.png`：180 × 180 PNG，供添加到主屏幕使用。
- `../favicon.ico`：包含 16、32、48 像素三种尺寸的透明图标。

使用 ImageMagick 从原图直接缩放并转换格式，没有重绘设计或添加底色。入口 `index.html` 引用这些导出文件。

## 生成提示词

```text
Use case: logo-brand.
Asset type: transparent favicon/logo concept for ORBIT, a dark scientific satellite orbit and space mission visualization website.
Create ONE standalone icon centered in a square canvas, occupying about 78% of the canvas, with generous transparent padding and balanced negative space. Subject: a single elliptical orbital ring tilted from lower left to upper right by about 35 degrees, and exactly one satellite represented by a circular bright dot on the upper-right segment of the ring. The empty ellipse suggests the letter O. No central planet. Palette: the existing site's lavender purple (#9782e8, #c8bdff), optional near-white highlight. It must have a strong simple silhouette and remain recognizable at 16 and 32 pixels.
Background: genuinely transparent alpha, including the hollow center of the ring. No colored backdrop, no square tile, no checkerboard baked into the pixels, no mockup.
Constraints: no text, no letters written as text, no labels, no watermark, no extra stars, no multiple orbital rings, no atom symbol, no globe, no continents, no satellite equipment.
Variant D: a luminous purple orbital ring with a sharp lavender core stroke and a very restrained semitransparent violet halo immediately around the stroke. A single near-white circular satellite dot on the upper-right path has a compact subtle glow, WITHOUT star spikes. The glow is only a few stroke widths, leaving most background genuinely transparent. Elegant night-sky observatory feeling, not a neon sign. Slightly varying ring brightness suggests motion; keep one closed ellipse and no trailing extra strokes.
```
