/** Avatar Motion — fitted raster/SVG portrait animation, MIT. No third-party runtime. */
export type Vec2 = [number, number];
export type Bounds = [number, number, number, number];
export type Eye = {
  center: Vec2;
  radius: Vec2;
  pupilCenter: Vec2;
  pupilRadius: Vec2;
  travel: [number, number, number, number];
  whiteSample: Vec2;
  skinSample: Vec2;
  lidInset?: number;
  lashDepth?: number;
};
export type Brow = {
  bounds: Bounds;
  lift: number;
  lowerLimit: number;
  color?: [number, number, number];
};
export type AvatarSettings = {
  eyes: number;
  head: number;
  hair: number;
  breath: number;
  radius: number;
  tracking: "Page" | "Nearby";
  blinkEvery: number;
  paused: boolean;
  autoplay: boolean;
  straightBottom: boolean;
};
export type AvatarRig = {
  version: 1;
  size: Vec2;
  lookOrigin: Vec2;
  head: {
    pivot: Vec2;
    fullUntil: number;
    fadeUntil: number;
    maxTilt: number;
    travel: Vec2;
  };
  eyes: Eye[];
  hair: {
    root: Vec2;
    tip: Vec2;
    width: number;
    angle: number;
    phase: number;
    follow?: number;
  }[];
  breath: {
    centerX: number;
    start: number;
    full: number;
    hem: number;
    width: number;
    rise: number;
    rate: number;
  };
  brows?: Brow[];
  mouth?: { center: Vec2; radius: Vec2; gain: Vec2 };
  cropY?: number;
  defaults?: Partial<AvatarSettings>;
};
export const DEFAULTS: AvatarSettings = {
  eyes: 1,
  head: 0.85,
  hair: 1,
  breath: 0.85,
  radius: 900,
  tracking: "Page",
  blinkEvery: 5,
  paused: false,
  autoplay: false,
  straightBottom: false,
};
export function validateSettings(
  input: Partial<AvatarSettings>,
): AvatarSettings {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Settings must be an object");
  const result = { ...DEFAULTS, ...input };
  for (const key of Object.keys(input))
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key))
      throw Error(`Unknown setting: ${key}`);
  for (const key of ["eyes", "head", "hair", "breath"] as const)
    if (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > 1.5)
      throw Error(`${key} must be between 0 and 1.5`);
  if (
    !Number.isFinite(result.radius) ||
    result.radius < 100 ||
    result.radius > 3000
  )
    throw Error("radius must be 100–3000 pixels");
  if (
    !Number.isFinite(result.blinkEvery) ||
    result.blinkEvery < 2 ||
    result.blinkEvery > 20
  )
    throw Error("blinkEvery must be 2–20 seconds");
  if (!["Page", "Nearby"].includes(result.tracking))
    throw Error("tracking must be Page or Nearby");
  for (const key of ["paused", "autoplay", "straightBottom"] as const)
    if (typeof result[key] !== "boolean") throw Error(`${key} must be boolean`);
  return result;
}
export function withSettings(
  source: string,
  options: Partial<AvatarSettings>,
): string {
  const config = validateSettings(options);
  const pattern = /(const EXPORTED_CONFIG(?:\s*:\s*AvatarSettings)? = ).*?;\n/;
  if (!pattern.test(source))
    throw Error("Export has no compatible configuration block");
  return source.replace(
    pattern,
    (_match, prefix: string) => prefix + JSON.stringify(config) + ";\n",
  );
}
export function validateRig(value: unknown): asserts value is AvatarRig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Rig must be an object");
  const r = value as AvatarRig;
  const number = (
    v: unknown,
    label: string,
    min: number,
    max: number,
  ): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      throw Error(`${label} must be a finite number in ${min}…${max}`);
    return v;
  };
  const pair = (v: unknown, label: string): Vec2 => {
    if (!Array.isArray(v) || v.length !== 2)
      throw Error(`${label} needs two numbers`);
    return [number(v[0], label, 0, 8192), number(v[1], label, 0, 8192)];
  };
  if (r.version !== 1) throw Error("Unsupported rig version; expected 1");
  pair(r.size, "size");
  if (r.size.some((n) => n < 64 || n > 4096 || !Number.isInteger(n)))
    throw Error("size must contain integer dimensions, 64–4096");
  const point = (v: unknown, label: string) => {
    const p = pair(v, label);
    if (p[0] > r.size[0] || p[1] > r.size[1])
      throw Error(`${label} is outside image bounds`);
    return p;
  };
  const radii = (v: unknown, label: string) => {
    const p = pair(v, label);
    if (p.some((n) => n < 1) || p[0] > r.size[0] / 2 || p[1] > r.size[1] / 2)
      throw Error(`${label} must be positive and fit the image`);
    return p;
  };
  point(r.lookOrigin, "lookOrigin");
  if (!r.head || !r.breath) throw Error("head and breath are required");
  point(r.head.pivot, "head.pivot");
  number(r.head.fullUntil, "head.fullUntil", 0, r.size[1]);
  number(r.head.fadeUntil, "head.fadeUntil", 0, r.size[1]);
  if (r.head.fadeUntil <= r.head.fullUntil)
    throw Error("head.fadeUntil must exceed fullUntil");
  number(r.head.maxTilt, "head.maxTilt", 0, 12);
  pair(r.head.travel, "head.travel");
  if (r.head.travel[0] > r.size[0] * 0.1 || r.head.travel[1] > r.size[1] * 0.1)
    throw Error("Head travel exceeds 10% of the image");
  if (!Array.isArray(r.eyes) || r.eyes.length !== 2)
    throw Error("Provide exactly two fitted eyes");
  for (const [i, e] of r.eyes.entries()) {
    if (!e || typeof e !== "object") throw Error(`Invalid eye ${i}`);
    point(e.center, `eyes.${i}.center`);
    radii(e.radius, `eyes.${i}.radius`);
    point(e.pupilCenter, `eyes.${i}.pupilCenter`);
    radii(e.pupilRadius, `eyes.${i}.pupilRadius`);
    point(e.whiteSample, `eyes.${i}.whiteSample`);
    point(e.skinSample, `eyes.${i}.skinSample`);
    if (!Array.isArray(e.travel) || e.travel.length !== 4)
      throw Error(`eyes.${i}.travel needs left/right/up/down`);
    for (const n of e.travel) number(n, "eye travel", 0, Math.max(...e.radius));
    if (e.pupilRadius[0] >= e.radius[0] || e.pupilRadius[1] >= e.radius[1])
      throw Error("Pupil radius must be smaller than its socket");
    if (
      e.center[0] - e.radius[0] < 0 ||
      e.center[0] + e.radius[0] > r.size[0] ||
      e.center[1] - e.radius[1] < 0 ||
      e.center[1] + e.radius[1] > r.size[1]
    )
      throw Error("Eye socket exceeds image bounds");
    if (e.lidInset !== undefined)
      number(e.lidInset, "lidInset", 0, e.radius[1] / 2);
    if (e.lashDepth !== undefined)
      number(e.lashDepth, "lashDepth", 1, e.radius[1]);
  }
  if (!Array.isArray(r.hair) || r.hair.length > 8)
    throw Error("hair must contain 0–8 isolated tips");
  for (const h of r.hair) {
    point(h.root, "hair.root");
    point(h.tip, "hair.tip");
    if (Math.hypot(h.root[0] - h.tip[0], h.root[1] - h.tip[1]) < 2)
      throw Error("Hair root and tip must be distinct");
    number(h.width, "hair.width", 1, Math.max(...r.size) / 3);
    number(h.angle, "hair.angle", 0, 0.3);
    number(h.phase, "hair.phase", -100, 100);
    if (h.follow !== undefined) number(h.follow, "hair.follow", 0, 0.3);
  }
  const b = r.breath;
  number(b.centerX, "breath.centerX", 0, r.size[0]);
  for (const k of ["start", "full", "hem"] as const)
    number(b[k], `breath.${k}`, 0, r.size[1]);
  if (!(b.start < b.full && b.full < b.hem))
    throw Error("Breathing requires start < full < hem");
  number(b.width, "breath.width", 0, 0.05);
  number(b.rise, "breath.rise", 0, r.size[1] * 0.025);
  number(b.rate, "breath.rate", 0.5, 3);
  if (r.brows !== undefined && !Array.isArray(r.brows))
    throw Error("brows must be an array");
  if ((r.brows?.length || 0) > 2) throw Error("At most two brows");
  for (const b of r.brows || []) {
    if (!Array.isArray(b.bounds) || b.bounds.length !== 4)
      throw Error("brow.bounds needs x0/y0/x1/y1");
    point(b.bounds.slice(0, 2), "brow bounds");
    point(b.bounds.slice(2), "brow bounds");
    if (b.bounds[0] >= b.bounds[2] || b.bounds[1] >= b.bounds[3])
      throw Error("Brow bounds must have positive area");
    number(b.lift, "brow.lift", 0, r.size[1] * 0.03);
    number(b.lowerLimit, "brow.lowerLimit", b.bounds[3] + 3, r.size[1]);
    if (b.lowerLimit - (b.bounds[3] + 2 - b.lift) < 1.6 * b.lift)
      throw Error("Insufficient room to translate brow without folding");
    if (b.color) {
      if (!Array.isArray(b.color) || b.color.length !== 3)
        throw Error("brow.color needs RGB");
      b.color.forEach((n) => number(n, "brow.color", 0, 1));
    }
  }
  if (r.mouth) {
    point(r.mouth.center, "mouth.center");
    radii(r.mouth.radius, "mouth.radius");
    pair(r.mouth.gain, "mouth.gain");
    r.mouth.gain.forEach((n) => number(n, "mouth.gain", 0, 0.2));
  }
  if (r.cropY !== undefined)
    number(r.cropY, "cropY", r.breath.full + 1, r.size[1]);
  validateSettings(r.defaults || {});
}
export function createFragment(r: AvatarRig): string {
  validateRig(r);
  const n = (x: number) => {
    const s = Number(x.toFixed(6)).toString();
    return s.includes(".") ? s : s + ".0";
  };
  const v = (p: number[]) => `vec2(${p.map(n).join(",")})`;
  const recolor = (r.brows || [])
    .filter((b) => b.color)
    .map(
      (b) =>
        `{float mask=rect(p,${v(b.bounds.slice(0, 2))},${v(b.bounds.slice(2))})*(1.0-smoothstep(0.28,0.48,art.g));art.rgb=mix(art.rgb,vec3(${b.color!.map(n).join(",")}),mask);}`,
    )
    .join("\n");
  const tips = r.hair
    .map(
      (h) =>
        `q=bendTip(q,${v(h.root)},${v(h.tip)},${n(h.width)},(sin(uTime*1.8+${n(h.phase)})*${n(h.angle)}+inertia*${n(h.follow || 0)})*uHair);`,
    )
    .join("\n");
  const brows = (r.brows || [])
    .map((b) => {
      const [x0, y0, x1, y1] = b.bounds,
        m = Math.max(10, b.lift * 2 + 6);
      return `{float w=smoothstep(${n(x0 - m)},${n(x0 - 2)},q.x)*(1.0-smoothstep(${n(x1 + 2)},${n(x1 + m)},q.x));w*=smoothstep(${n(y0 - b.lift - m)},${n(y0 - b.lift - 2)},q.y)*(1.0-smoothstep(${n(y1 + 2)}-${n(b.lift)}*uExpression.y,${n(b.lowerLimit)},q.y));q.y+=${n(b.lift)}*uExpression.y*w;}`;
    })
    .join("\n");
  const eyes = r.eyes
    .map(
      (e) =>
        `color=eye(color,q,${v(e.center)},${v(e.radius)},${v(e.pupilCenter)},${v(e.pupilRadius)},vec4(${e.travel.map(n).join(",")}),${v(e.whiteSample)},${v(e.skinSample)},${n(e.lidInset ?? e.radius[1] * 0.1)},${n(e.lashDepth ?? e.radius[1] * 0.35)});`,
    )
    .join("\n");
  const mouth = r.mouth
    ? `vec2 md=q-${v(r.mouth.center)};float mw=exp(-dot(md/${v(r.mouth.radius)},md/${v(r.mouth.radius)})*1.5);q-=md*${v(r.mouth.gain)}*uExpression.x*mw;`
    : "";
  return `precision highp float;
varying vec2 vUV;uniform sampler2D uArt;uniform vec2 uSize,uGaze,uFollow;uniform vec3 uExpression;uniform float uTime,uEyes,uHead,uHair,uBreath,uBlink,uCrop;
float rect(vec2 p,vec2 lo,vec2 hi){return step(lo.x,p.x)*step(p.x,hi.x)*step(lo.y,p.y)*step(p.y,hi.y);}
vec4 sampleArt(vec2 p){vec4 art=texture2D(uArt,clamp(p/uSize,vec2(0.00001),vec2(0.99999)));${recolor}return art;}
vec2 turn(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c)*p;}
vec2 bendTip(vec2 p,vec2 root,vec2 tip,float width,float angle){vec2 axis=tip-root;float along=dot(p-root,axis)/dot(axis,axis);float across=abs(dot(p-root,vec2(-axis.y,axis.x)))/length(axis);float w=smoothstep(0.08,0.92,along)*(1.0-smoothstep(1.08,1.42,along));w*=1.0-smoothstep(width*0.55,width,across);return root+turn(p-root,-angle*w);}
float pupil(vec2 p,vec2 c,vec2 radius){return 1.0-smoothstep(1.04,1.12,length((p-c)/radius));}
vec4 eye(vec4 base,vec2 p,vec2 c,vec2 radius,vec2 iris,vec2 irisRadius,vec4 travel,vec2 whitePoint,vec2 skinPoint,float inset,float lashDepth){
 vec2 gaze=clamp(uGaze*uEyes,vec2(-1.0),vec2(1.0));float close=uBlink;if(close<0.00001&&length(gaze)<0.00001)return base;vec2 d=(p-c)/radius;if(abs(d.x)>1.3||abs(d.y)>1.4)return base;
 float arc=sqrt(max(0.0,1.0-d.x*d.x));float top=c.y-(radius.y-inset)*arc;float bottom=c.y+radius.y*arc;float shut=c.y+radius.y*(0.3-0.12*d.x*d.x);float upper=mix(top,shut,close),lower=mix(bottom,shut,close);
 float oldPupil=pupil(p,iris,irisRadius);vec2 shift=vec2(gaze.x*(gaze.x<0.0?travel.x:travel.y),gaze.y*(gaze.y<0.0?travel.z:travel.w));vec2 source=p-shift;float newPupil=1.0-smoothstep(0.975,1.015,length((source-iris)/irisRadius));vec3 ivory=sampleArt(whitePoint).rgb;
 float white=smoothstep(0.68,0.81,base.g)*smoothstep(0.80,0.93,base.r);float mask=max(white,oldPupil);vec4 tracked=base;tracked.rgb+=oldPupil*(ivory-base.rgb);tracked.rgb+=newPupil*(sampleArt(source).rgb-ivory)*mask;tracked.rgb=mix(base.rgb,tracked.rgb,smoothstep(0.0,0.12,length(gaze)));base=tracked;if(close<0.00001)return base;
 vec3 skin=sampleArt(skinPoint).rgb;float patch=1.0-smoothstep(0.93,1.03,length((p-c)/(radius+vec2(radius.x*0.22,radius.y*0.25))));float aperture=smoothstep(upper-0.7,upper+0.7,p.y)*(1.0-smoothstep(lower-0.7,lower+0.7,p.y));aperture*=1.0-smoothstep(0.98,1.0,abs(d.x));vec3 blinking=mix(skin,tracked.rgb,aperture);
 float lashY=top+(p.y-upper)/mix(1.0,0.14,close);vec3 ink=sampleArt(vec2(p.x,lashY)).rgb;float pen=(1.0-smoothstep(0.30,0.48,max(ink.r,max(ink.g,ink.b))))*(1.0-smoothstep(lashDepth,lashDepth+2.0,top-lashY));pen*=1.0-smoothstep(upper-0.4,upper+0.5,p.y);pen*=1.0-smoothstep(0.96,1.03,abs(d.x));blinking=mix(blinking,ink,pen);base.rgb=mix(base.rgb,blinking,patch*smoothstep(0.0,0.15,close));return base;
}
void main(){vec2 p=vec2(vUV.x*uSize.x,vUV.y*mix(uSize.y,${n(r.cropY || r.size[1])},uCrop));float hw=1.0-smoothstep(${n(r.head.fullUntil)},${n(r.head.fadeUntil)},p.y);vec2 pivot=${v(r.head.pivot)};vec2 moved=turn(p-pivot,-uFollow.x*uHead*${n((r.head.maxTilt * Math.PI) / 180)})+pivot-uFollow*uHead*${v(r.head.travel)};vec2 q=mix(p,moved,hw);
 float inhale=sin(uTime*${n(r.breath.rate)})*uBreath;float torso=smoothstep(${n(r.breath.start)},${n(r.breath.full)},p.y);float hem=mix(${n(r.breath.hem)},${n(r.cropY || r.breath.hem)},uCrop);float lift=1.0-smoothstep(${n(r.breath.full)},hem,p.y);q.x=${n(r.breath.centerX)}+(q.x-${n(r.breath.centerX)})/(1.0+inhale*${n(r.breath.width)}*torso);q.y+=inhale*${n(r.breath.rise)}*lift;
 float inertia=clamp(uGaze.x-uFollow.x,-0.5,0.5);${tips}${brows}${mouth}vec4 color=sampleArt(q);${eyes}gl_FragColor=color;}`;
}
export async function mountAvatar(
  host: HTMLElement,
  imageURL: string,
  rig: AvatarRig,
  options: Partial<AvatarSettings> = {},
) {
  validateRig(rig);
  let config = validateSettings({ ...rig.defaults, ...options });
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageURL;
  await image.decode();
  if (image.naturalWidth !== rig.size[0] || image.naturalHeight !== rig.size[1])
    throw Error(
      `Image is ${image.naturalWidth}×${image.naturalHeight}; rig expects ${rig.size.join("×")}`,
    );
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;";
  host.replaceChildren(canvas);
  const context = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!context) {
    canvas.remove();
    throw Error("WebGL unavailable; use the supplied static portrait fallback");
  }
  const gl = context;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null,
    texture: WebGLTexture | null = null;
  function release() {
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
    canvas.remove();
  }
  const compile = (kind: number, source: string) => {
    const s = gl.createShader(kind);
    if (!s) throw Error("Could not allocate shader");
    shaders.push(s);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(s) || "Shader compilation failed");
    return s;
  };
  try {
    program = gl.createProgram();
    if (!program) throw Error("Could not allocate program");
    gl.attachShader(
      program,
      compile(
        gl.VERTEX_SHADER,
        "attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=vec2((aPosition.x+1.0)*0.5,1.0-(aPosition.y+1.0)*0.5);gl_Position=vec4(aPosition,0.0,1.0);}",
      ),
    );
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, createFragment(rig)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(program) || "Shader link failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw Error("Could not allocate buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const attribute = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture();
    if (!texture) throw Error("Could not allocate texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
  } catch (error) {
    release();
    throw error;
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const n of [
    "uArt",
    "uSize",
    "uGaze",
    "uFollow",
    "uTime",
    "uHead",
    "uHair",
    "uBreath",
    "uBlink",
    "uCrop",
    "uEyes",
    "uExpression",
  ])
    uniforms[n] = gl.getUniformLocation(program!, n);
  gl.uniform1i(uniforms.uArt, 0);
  gl.uniform2f(uniforms.uSize, ...rig.size);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)"),
    fine = matchMedia("(hover:hover) and (pointer:fine)");
  let destroyed = false,
    contextLost = false,
    visible = true,
    raf = 0,
    bounds = host.getBoundingClientRect(),
    last = performance.now(),
    t = 0,
    x = 0,
    y = 0,
    vx = 0,
    vy = 0,
    hx = 0,
    hy = 0,
    neutral = false,
    expression = 0,
    smile = 0,
    brow = 0;
  let pointer: Vec2 | null = null,
    blinkStart = -10,
    nextBlink = 3,
    slow = 1,
    scrub: number | null = null;
  const clamp = (n: number, a = -1, b = 1) => Math.max(a, Math.min(b, n));
  const smooth = (n: number) => {
    n = clamp(n, 0, 1);
    return n * n * (3 - 2 * n);
  };
  function closure() {
    if (scrub !== null) return scrub;
    const p = (t - blinkStart) / slow;
    if (p < 0 || p > 0.29) return 0;
    return p < 0.09
      ? smooth(p / 0.09)
      : p < 0.12
        ? 1
        : 1 - smooth((p - 0.12) / 0.17);
  }
  function viewport(forceNeutral = false) {
    const height =
      !forceNeutral && config.straightBottom && rig.cropY
        ? rig.cropY
        : rig.size[1];
    const aspect = rig.size[0] / height;
    let w = canvas.width,
      h = w / aspect;
    if (h > canvas.height) {
      h = canvas.height;
      w = h * aspect;
    }
    return {
      w: Math.round(w),
      h: Math.round(h),
      left: Math.round((canvas.width - w) / 2),
      bottom: Math.round((canvas.height - h) / 2),
      height,
    };
  }
  function draw(forceNeutral = false) {
    if (contextLost || destroyed) return;
    const still = forceNeutral || neutral || reduce.matches;
    const view = viewport(forceNeutral);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(view.left, view.bottom, view.w, view.h);
    gl.uniform2f(uniforms.uGaze, still ? 0 : x, still ? 0 : y);
    gl.uniform2f(uniforms.uFollow, still ? 0 : hx, still ? 0 : hy);
    gl.uniform3f(uniforms.uExpression, still ? 0 : smile, still ? 0 : brow, 0);
    for (const [name, value] of [
      ["uTime", still ? 0 : t],
      ["uEyes", config.eyes],
      ["uHead", still ? 0 : config.head],
      ["uHair", still ? 0 : config.hair],
      ["uBreath", still ? 0 : config.breath],
      ["uBlink", still ? 0 : closure()],
      [
        "uCrop",
        forceNeutral ? 0 : Number(config.straightBottom && !!rig.cropY),
      ],
    ] as [string, number][])
      gl.uniform1f(uniforms[name], value);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function resize() {
    bounds = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    draw();
  }
  function scroll() {
    bounds = host.getBoundingClientRect();
  }
  function move(e: PointerEvent) {
    if (fine.matches) pointer = [e.clientX, e.clientY];
  }
  function leave() {
    pointer = null;
  }
  function cycle() {
    const choices = [
      0,
      ...(rig.mouth ? [1] : []),
      ...(rig.brows?.length ? [2] : []),
    ];
    expression = choices[(choices.indexOf(expression) + 1) % choices.length];
    host.dispatchEvent(
      new CustomEvent("avatar-expression", {
        detail: ["Original", "Smile", "Curious"][expression],
      }),
    );
  }
  function lost(e: Event) {
    e.preventDefault();
    contextLost = true;
    canvas.style.visibility = "hidden";
    const fallback = document.createElement("img");
    fallback.src = imageURL;
    fallback.alt = "Avatar";
    fallback.dataset.avatarFallback = "true";
    fallback.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:contain";
    host.append(fallback);
    host.dispatchEvent(
      new CustomEvent("avatar-error", {
        detail:
          "Graphics context lost. Static portrait shown; reload to restore animation.",
      }),
    );
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  io.observe(host);
  host.addEventListener("click", cycle);
  canvas.addEventListener("webglcontextlost", lost);
  window.addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  window.addEventListener("scroll", scroll, { capture: true, passive: true });
  window.addEventListener("resize", resize, { passive: true });
  reduce.addEventListener("change", resize);
  resize();
  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (
      visible &&
      !document.hidden &&
      !config.paused &&
      !neutral &&
      !reduce.matches &&
      !contextLost
    ) {
      t += dt;
      let tx = 0,
        ty = 0;
      if (config.autoplay) {
        tx = Math.sin(t * 0.85) * 0.95;
        ty = Math.sin(t * 0.63) * 0.8;
      } else if (pointer) {
        const view = viewport(),
          scale = bounds.width / canvas.width,
          cssW = view.w * scale,
          cssH = view.h * scale;
        const dx =
          pointer[0] -
          bounds.left -
          view.left * scale -
          (cssW * rig.lookOrigin[0]) / rig.size[0];
        const dy =
          pointer[1] -
          bounds.top -
          (canvas.height - view.h - view.bottom) * scale -
          (cssH * rig.lookOrigin[1]) / view.height;
        if (config.tracking === "Nearby") {
          const fade =
            1 - smooth((Math.hypot(dx, dy) / config.radius - 0.65) / 0.35);
          tx = clamp(dx / (config.radius * 0.6)) * fade;
          ty = clamp(dy / (config.radius * 0.6)) * fade;
        } else {
          tx = clamp(dx / Math.max(cssW * 0.65, 100));
          ty = clamp(dy / Math.max(cssH * 0.65, 100));
        }
      }
      const steps = Math.max(1, Math.ceil(dt * 120)),
        step = dt / steps;
      for (let i = 0; i < steps; i++) {
        vx += (180 * (tx - x) - 22 * vx) * step;
        vy += (180 * (ty - y) - 22 * vy) * step;
        x += vx * step;
        y += vy * step;
      }
      hx += (x - hx) * (1 - Math.exp(-dt * 6));
      hy += (y - hy) * (1 - Math.exp(-dt * 6));
      smile += ((expression === 1 ? 1 : 0) - smile) * (1 - Math.exp(-dt * 12));
      brow += ((expression === 2 ? 1 : 0) - brow) * (1 - Math.exp(-dt * 12));
      if (t > nextBlink) {
        slow = 1;
        blinkStart = t;
        nextBlink = t + config.blinkEvery * (0.85 + Math.random() * 0.3);
      }
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  draw(true);
  raf = requestAnimationFrame(frame);
  return {
    update(next: Partial<AvatarSettings>) {
      config = validateSettings({ ...config, ...next });
      draw();
    },
    neutral(value: boolean) {
      neutral = value;
      if (value) x = y = vx = vy = hx = hy = 0;
      draw();
    },
    scrub(value: number | null) {
      scrub = value === null ? null : clamp(value, 0, 1);
      draw();
    },
    blink(slowMotion = false) {
      neutral = false;
      config.paused = false;
      scrub = null;
      slow = slowMotion ? 5 : 1;
      blinkStart = t;
      nextBlink = t + Math.max(4, config.blinkEvery);
    },
    pose(gazeX: number, gazeY: number, time = 0, blink = 0, reaction = 0) {
      config.paused = true;
      neutral = false;
      x = hx = clamp(gazeX);
      y = hy = clamp(gazeY);
      vx = vy = 0;
      t = time;
      scrub = clamp(blink, 0, 1);
      smile = Number(reaction === 1);
      brow = Number(reaction === 2);
      draw();
    },
    state() {
      return {
        x,
        y,
        t,
        blink: closure(),
        expression,
        settings: { ...config },
        reducedMotion: reduce.matches,
        glError: gl.getError(),
      };
    },
    verifyRestPose() {
      const w = rig.size[0],
        h = rig.size[1];
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      draw(true);
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const reference = document.createElement("canvas");
      reference.width = w;
      reference.height = h;
      const ctx = reference.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);
      const source = ctx.getImageData(0, 0, w, h).data;
      let changed = 0,
        max = 0;
      for (let row = 0; row < h; row++)
        for (let col = 0; col < w; col++) {
          let delta = 0;
          for (let k = 0; k < 4; k++)
            delta = Math.max(
              delta,
              Math.abs(
                pixels[((h - 1 - row) * w + col) * 4 + k] -
                  source[(row * w + col) * 4 + k],
              ),
            );
          max = Math.max(max, delta);
          if (delta > 1) changed++;
        }
      const report = {
        width: w,
        height: h,
        changedPixelsAboveOneLevel: changed,
        maxChannelDifference: max,
        glError: gl.getError(),
        note: rig.brows?.some((b) => b.color)
          ? "Brow recolouring is enabled; differences in those regions are intentional."
          : "Neutral source comparison",
      };
      resize();
      draw();
      return report;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("click", cycle);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
      reduce.removeEventListener("change", resize);
      host.querySelector("[data-avatar-fallback]")?.remove();
      release();
    },
  };
}
