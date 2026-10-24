# Framer delivery

1. In Framer, open Assets → Code and create a code file/component.
2. Replace its contents with generated `AvatarMotion.tsx`, then save.
3. Insert AvatarMotion into the header/navigation. Keep the intended dimensions; the renderer preserves image aspect ratio within the frame.
4. Open Preview and move the cursor across the page. The editing canvas intentionally shows the neutral static pose.
5. Adjust Eye travel, Head turn, Hair tips, Breathing, Tracking, Radius and Blink interval in the property panel. Straight crop is offered only when the rig has `cropY`.

Alternatively use the standalone `avatar.html` with your hosting/embed workflow. It needs no animation library or paid Rive runtime. When isolated in an iframe it can only see pointer events in that iframe; use the Code Component for page-wide tracking. Generated standalone output can be opened directly for interaction, but serve the preview over HTTP for its export-download buttons.

The component uses React and Framer's `addPropertyControls`, `ControlType` and `RenderTarget` APIs. Runtime is embedded; there is no external animation CDN or image request. It respects reduced motion, pauses GPU animation while hidden/offscreen, and shows the source image when WebGL initialization fails. Very large portraits increase the component file size because the asset is embedded.

Source: https://www.framer.com/developers/property-controls

Structural TypeScript checks are not proof of successful installation in a user's actual Framer project. Test the inserted component in Preview before calling that integration verified. Framer is a separate product and no affiliation is implied.
