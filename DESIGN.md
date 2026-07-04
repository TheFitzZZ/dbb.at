# Design

## Overview

dbB is a single-screen static memorial. The visual system exists to dissolve the edge between `main-logo.png` and the page atmosphere so the emblem reads as an artifact embedded in darkness, not as a rectangular image placed on a web page.

## Register

Brand memorial. Design is the experience.

## Scene

A late-night visit to an abandoned gothic-industrial Quake map: cold stone, oxidized metal, dim rust, compression-era texture, and a clan mark left standing after the server went quiet.

## Color Strategy

Restrained, leaning committed through darkness and texture rather than visible UI color. The Impeccable seed hue is interpreted as rusted iron instead of warm coral.

```css
:root {
  --dbb-void: oklch(0.070 0.000 0);
  --dbb-depth: oklch(0.115 0.006 260);
  --dbb-stone: oklch(0.285 0.012 255);
  --dbb-ash: oklch(0.620 0.010 255);
  --dbb-rust: oklch(0.380 0.118 35.8);
  --dbb-rust-dim: oklch(0.260 0.072 35.8);
  --dbb-tech: oklch(0.560 0.120 190);
  --dbb-text: oklch(0.880 0.006 255);
  --dbb-muted: oklch(0.580 0.008 255);
}
```

## Imagery

`main-logo.png` is the only visible foreground subject and must remain the centerpiece. `dbb_modern_grau_2.jpg` may be used only as environmental material: page background texture, favicon/icon source, or social preview support.

The centerpiece must be blended with:

- full-viewport background texture from `dbb_modern_grau_2.jpg`
- radial and edge vignettes
- CSS masks on the image edge
- restrained `mix-blend-mode` and contrast/brightness filtering
- shadow and grain that make the image feel set into the page rather than pasted onto it

If CSS blending cannot hide the rectangle well enough, create a derived optimized asset with feathered edges while preserving the original root image.

## Layout

One locked viewport. Use CSS grid to center the image both horizontally and vertically. The image should scale from mobile to wide desktop with `clamp()` and `min()` constraints, preserving its 3:2 aspect ratio. No visible headings, captions, menus, footer, buttons, cards, or decorative panels.

## Typography

No visible typography by default. Text exists only in metadata and screen-reader-only content. If visible text is later requested, it must be treated as inscription, not UI: minimal, low-volume, and subordinate to the image.

## Motion

Motion should be sparse and atmospheric: a short first-load reveal, almost-static grain, and a slow low-frequency glow or contrast drift. Disable nonessential animation under `prefers-reduced-motion: reduce`. Content must be visible before animation starts.

## Cursor

Use a CSS-only Quake-style reticle cursor on fine-pointer devices. The cursor should feel like a precision crosshair, not a spooky prop. Disable the custom cursor on coarse pointers and under reduced-motion preferences.

## Accessibility

Use semantic landmarks, a meaningful alt description for the image, and screen-reader-only context explaining dbB as an inactive Austrian/German Quake clan founded in the late 1990s. Maintain focus visibility for hidden skip links or future interactive elements, even though the default page has no visible controls.

## Implementation Constraints

Plain HTML and CSS. No framework, no build step, no GitHub Actions workflow. Publish from `/docs` on the `master` branch through GitHub Pages branch deployment.