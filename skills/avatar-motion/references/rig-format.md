# Fitting a portrait

Rig version 1 uses **native image pixels**, with origin at the top left, x rightwards and y downwards. `size` must exactly match the decoded image. Do not resize an illustration after fitting without updating the rig. The runtime letterboxes arbitrary container sizes instead of stretching the face.

Use `references/style-reference.png` and `assets/demo.rig.json` as an executable example. Every coordinate and radius belongs to that specific approved portrait. Other faces require their own measurements. The repository's `tests/fixtures/geometry.svg` is only a synthetic validation fixture, never an art reference or a generated-quality example.

## Required fields

- `version`: 1.
- `size`: `[width,height]`, integer dimensions 64–4096.
- `lookOrigin`: `[x,y]`, the point around which pointer direction is measured, typically between the eyes.
- `head`: `pivot` at the base of the neck; `fullUntil` below the face; `fadeUntil` lower on the torso; `maxTilt` in degrees, usually 3–6; `travel` as maximum x/y displacement in pixels. The full head moves together, blending into the unchanged body.
- `eyes`: exactly two eye objects, described below.
- `hair`: zero to eight isolated spike objects. Empty is valid for bald, close-cropped or unsuitable hair.
- `breath`: `centerX`, `start`, `full`, `hem`, `width`, `rise`, `rate`. The y coordinates require `start < full < hem`. `width` is fractional expansion (e.g. .025 = 2.5% at intensity 1); `rise` is pixels; `rate` is radians/second (1.48 gives about a 4.25-second cycle). Put the hem at the source shirt's baseline. For head-only art, keep default breathing at 0.

## Eyes

- `center`, `radius`: the socket's ellipse, including the upper lash. Measure each separately for a three-quarter portrait.
- `pupilCenter`, `pupilRadius`: the original dark pupil. Keep its radius smaller than its socket.
- `travel`: `[left,right,up,down]` travel distances in pixels at intensity 1. Existing gaze may already favour one side; do not assume symmetric room. Start below available white-space margins, test extremes, then increase.
- `whiteSample`: an unobstructed light eye-white pixel, away from the pupil and anti-aliased edge.
- `skinSample`: nearby plain skin, away from eyebrows, cheeks, nose highlights and shadows. It backs the moving eyelid.
- `lidInset` (optional): adjusts the open lid's inner curve relative to the socket's top; default 10% of its vertical radius.
- `lashDepth` (optional): source pixels to sample above the lid; default 35% of vertical radius. Fit this to the actual upper lash.

The reference renderer assumes dark oval pupils and light whites, reconstructs white behind a moving pupil and carries the original lash texture through closure. It does not automatically segment arbitrary painted or photorealistic eyes. Ghost ink means the pupil mask is wrong; squeezing the whole eye texture is not a fix.

## Hair tips

Each object has `root`, `tip`, `width`, `angle`, `phase`, and optional `follow`.

- Root is the stationary attachment point. Tip is the pointed outer end.
- Width bounds the influence perpendicular to root→tip. Keep it narrow enough to exclude the crown and adjacent features.
- Angle is radians; .08–.14 is a sensible starting range. The validator caps it at .3.
- Phase staggers individual tips. Follow adds a small cursor-change response, usually .05–.1.

Inspect with head and breath set to zero. A spatial sine wave over the entire hair is deliberately absent.

## Optional reactions and crop

- `brows`: up to two objects with `bounds:[x0,y0,x1,y1]`, `lift` in pixels, and `lowerLimit` where the blend has fully ended. Lower limit must stay above the lashes and leave enough room for a monotonic translation. The validator checks room to avoid texture folding. `color:[r,g,b]` (0–1) optionally flattens dark ink in the source bounds; omit it to preserve the source's colour. Review it against skin/hair near the rectangle.
- `mouth`: `center`, `radius`, `gain:[xScale,yScale]` for a restrained smile deformation, e.g. `[.09,.16]`. It is not a replacement mouth or arbitrary expression generator.
- `cropY`: a straight lower crop below the torso's full expansion point. The source stays intact. Use the `straightBottom` control to enable it.
- `defaults`: optional settings: `eyes`, `head`, `hair`, `breath` (0–1.5); `tracking` (`Page`/`Nearby`); `radius` (100–3000 px); `blinkEvery` (2–20 s); and booleans `paused`, `autoplay`, `straightBottom`. Defaults remain editable in the preview and Framer panel.

Validation catches dimensions, types and degenerate regions, **not likeness or visual quality**. Inspect the actual render. No automatic photo fitting model is bundled: the agent performs fitting from the supplied/generated artwork.
