import * as React from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
/* RUNTIME */
/* DATA */
type Props = Partial<AvatarSettings> & { style?: React.CSSProperties };
/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 180
 * @framerIntrinsicHeight 180
 */
export default function AvatarMotion(props: Props) {
  const root = React.useRef<HTMLButtonElement>(null);
  const instance = React.useRef<Awaited<ReturnType<typeof mountAvatar>> | null>(
    null,
  );
  const options = validateSettings({
    ...EXPORTED_CONFIG,
    ...Object.fromEntries(
      Object.keys(DEFAULTS)
        .filter((k) => props[k as keyof AvatarSettings] !== undefined)
        .map((k) => [k, props[k as keyof AvatarSettings]]),
    ),
  });
  const latest = React.useRef(options);
  latest.current = options;
  React.useEffect(() => {
    if (!root.current) return;
    let disposed = false;
    const host = root.current;
    mountAvatar(host, PORTRAIT, RIG, {
      ...latest.current,
      autoplay: false,
      paused: RenderTarget.current() === RenderTarget.canvas,
    })
      .then((rig) => {
        if (disposed) {
          rig.destroy();
          return;
        }
        instance.current = rig;
        rig.neutral(RenderTarget.current() === RenderTarget.canvas);
        rig.update({
          ...latest.current,
          autoplay: false,
          paused: RenderTarget.current() === RenderTarget.canvas,
        });
      })
      .catch((error) => {
        if (disposed) return;
        const image = new Image();
        image.src = PORTRAIT;
        image.alt = "Avatar";
        image.style.cssText =
          "display:block;width:100%;height:100%;object-fit:contain";
        host.replaceChildren(image);
        host.title = String(error.message || error);
      });
    return () => {
      disposed = true;
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);
  React.useEffect(() => {
    const canvas = RenderTarget.current() === RenderTarget.canvas;
    instance.current?.neutral(canvas);
    instance.current?.update({ ...options, autoplay: false, paused: canvas });
  }, [
    options.eyes,
    options.head,
    options.hair,
    options.breath,
    options.radius,
    options.tracking,
    options.blinkEvery,
    options.straightBottom,
  ]);
  return (
    <button
      ref={root}
      type="button"
      aria-label="Animated avatar. Click to change expression."
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        padding: 0,
        margin: 0,
        background: "transparent",
        overflow: "hidden",
        cursor: "pointer",
        touchAction: "manipulation",
        ...props.style,
      }}
    />
  );
}
AvatarMotion.defaultProps = EXPORTED_CONFIG;
addPropertyControls(AvatarMotion, {
  eyes: {
    type: ControlType.Number,
    title: "Eye travel",
    min: 0,
    max: 1.5,
    step: 0.05,
    defaultValue: EXPORTED_CONFIG.eyes,
  },
  head: {
    type: ControlType.Number,
    title: "Head turn",
    min: 0,
    max: 1.5,
    step: 0.05,
    defaultValue: EXPORTED_CONFIG.head,
  },
  hair: {
    type: ControlType.Number,
    title: "Hair tips",
    min: 0,
    max: 1.5,
    step: 0.05,
    defaultValue: EXPORTED_CONFIG.hair,
  },
  breath: {
    type: ControlType.Number,
    title: "Breathing",
    min: 0,
    max: 1.5,
    step: 0.05,
    defaultValue: EXPORTED_CONFIG.breath,
  },
  tracking: {
    type: ControlType.Enum,
    title: "Tracking",
    options: ["Page", "Nearby"],
    defaultValue: EXPORTED_CONFIG.tracking,
  },
  radius: {
    type: ControlType.Number,
    title: "Radius",
    min: 100,
    max: 3000,
    step: 50,
    unit: "px",
    defaultValue: EXPORTED_CONFIG.radius,
    hidden: (p: Props) => p.tracking !== "Nearby",
  },
  blinkEvery: {
    type: ControlType.Number,
    title: "Blink interval",
    min: 2,
    max: 20,
    step: 0.5,
    unit: "s",
    defaultValue: EXPORTED_CONFIG.blinkEvery,
  },
  straightBottom: {
    type: ControlType.Boolean,
    title: "Straight crop",
    defaultValue: EXPORTED_CONFIG.straightBottom,
    hidden: () => !RIG.cropY,
  },
});
