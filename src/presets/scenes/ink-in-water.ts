import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import type { Texture, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { BuiltScene } from '../runtime.js';
import { ComputePass, computeTarget, computeVertex } from './compute.js';
import { feed, PARAMS, uniformsFor } from './shading.js';

const solver = `
  varying vec2 coord;
  uniform sampler2D flow, pigment, scalarField, pressure;
  uniform vec2 pixel, pointerAt, pointerForce;
  uniform float delta, seconds, seed, squeeze, burst, attention, impulse;
  uniform int operation;
  float bell(vec2 p, float radius) { return exp(-dot(p,p) / (radius * radius)); }
  vec2 roll(vec2 p,float strength,float width) { return vec2(-p.y,p.x) * strength * bell(p,width); }
  vec2 readFlow(vec2 p) { return texture2D(flow, clamp(p, pixel * .5, 1.0 - pixel * .5)).xy; }
  float readPressure(vec2 p) { return texture2D(pressure, p).r; }
  void main() {
    vec2 uv = coord;
    vec2 x = vec2(pixel.x,0), y = vec2(0,pixel.y);
    vec2 r = uv - .5;
    vec2 origin = vec2(.5 + .058 * sin(seconds * .64 + seed), .43 + .037 * cos(seconds * .47));
    vec2 d = uv - origin;
    if (operation == 0) {
      vec2 velocity = readFlow(uv);
      velocity = readFlow(uv - velocity * delta) * exp(-delta * .72);
      vec2 curl = roll(d,1.8 + burst * 2.4,.27);
      curl += roll(d-vec2(.128,.127+.05*sin(seconds)),5.1,.19);
      curl += roll(d+vec2(.115,-.21),-4.5,.185);
      curl += vec2(.17 * sin(uv.y * 12.0 + seconds), .10) * bell(d,.42);
      curl += vec2(-r.y,r.x) * cos(r.x * 22.0 - seconds * 1.8) * bell(r,.33) * burst * 1.8;
      vec2 hand = uv - pointerAt;
      curl += (vec2(-hand.y,hand.x) * 4.4 * attention + pointerForce * 3.0) * bell(hand,.127);
      curl += d * (burst * 2.6 - squeeze * 2.9) * bell(d,.19);
      velocity += curl * delta;
      velocity += d * impulse * bell(d,.19) * .12;
      velocity *= smoothstep(.002,.065,min(uv.x,1.0-uv.x)) * smoothstep(.002,.065,min(uv.y,1.0-uv.y));
      gl_FragColor = vec4(clamp(velocity,-.65,.65),0,1);
    } else if (operation == 1) {
      vec2 l=readFlow(uv-x), rr=readFlow(uv+x), b=readFlow(uv-y), t=readFlow(uv+y);
      gl_FragColor = vec4(.5 * (rr.x-l.x+t.y-b.y),.5*(rr.y-l.y-t.x+b.x),0,1);
    } else if (operation == 2) {
      float div = texture2D(scalarField,uv).r;
      float sum = readPressure(uv-x)+readPressure(uv+x)+readPressure(uv-y)+readPressure(uv+y);
      gl_FragColor = vec4((sum-div)*.25,0,0,1);
    } else if (operation == 3) {
      vec2 gradient = vec2(readPressure(uv+x)-readPressure(uv-x),readPressure(uv+y)-readPressure(uv-y))*.5;
      vec2 winding = .5 * vec2(abs(texture2D(scalarField,uv+x).g)-abs(texture2D(scalarField,uv-x).g),
        abs(texture2D(scalarField,uv+y).g)-abs(texture2D(scalarField,uv-y).g));
      winding /= max(.001,length(winding));
      vec2 eddy = vec2(winding.y,-winding.x) * texture2D(scalarField,uv).g * delta * 14.0;
      gl_FragColor = vec4(readFlow(uv)-gradient+eddy,0,1);
    } else if (operation == 4) {
      vec2 dye = texture2D(pigment, uv - readFlow(uv) * delta).rg * exp(-delta * (.75+squeeze*.95));
      float dotA = bell(d + vec2(.049,-.021+.04*sin(seconds*2.3)), .025 + burst * .037);
      float dotB = bell(d - vec2(.029+.028*cos(seconds*1.9),.033), .029 + burst * .032);
      float feeder = .87 + burst * 3.15 + impulse * .46;
      dye += vec2(dotA, dotB) * feeder * delta;
      dye += vec2(.16,.43) * bell(uv - pointerAt, .044) * attention * delta;
      gl_FragColor = vec4(min(dye,vec2(2.2)),0,1);
    } else if (operation == 5) {
      float a = atan(r.y,r.x);
      float radius = length(r);
      float fold = a*3.0-radius*35.0+seed+sin(a*2.0)*.87;
      float envelope = smoothstep(.05,.16,radius)*(1.0-smoothstep(.26,.43,radius));
      float warm = pow(.5+.5*cos(fold-.63),8.0);
      float cold = pow(.5+.5*cos(fold+1.24),5.0);
      vec2 dye = envelope*vec2(.68*warm,.73*cold);
      dye += vec2(.47,.14)*bell(r+vec2(.048,.094),.068);
      gl_FragColor = vec4(dye,0,1);
    } else if (operation == 6) {
      gl_FragColor = texture2D(pigment,uv);
    } else {
      gl_FragColor = vec4(0,0,0,1);
    }
  }
`;

const vertex = `
  varying vec2 coord;
  void main() { coord=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;

const shadeInk = `${PARAMS}
  varying vec2 coord;
  uniform sampler2D ink;
  uniform vec2 sampleSize;
  vec2 readInk(vec2 p) { return texture2D(ink,p).rg; }
  void main() {
    vec2 uv = .5+(coord-.5)/(1.0-intake*.35+release*.20+springBack*.19);
    vec2 dye=readInk(uv);
    float density=dye.r+dye.g;
    float grad=length(vec2(length(readInk(uv+vec2(sampleSize.x,0)))-length(dye),length(readInk(uv+vec2(0,sampleSize.y)))-length(dye)));
    float alpha=(1.0-exp(-density*2.35)) * (1.0-smoothstep(.29,.51,length(coord-.5))) * (1.0-quiet*.59);
    if(alpha<.013) discard;
    float split=dye.r/max(.001,density);
    vec3 teal=mix(vec3(.006,.52,.64),glow,.12);
    vec3 wine=mix(vec3(.61,.026,.23),glow,.22);
    vec3 color=mix(teal,wine,smoothstep(.25,.75,split))*(.33+.65*exp(-density*.92));
    color += mix(foil,vec3(.19,.61,.71),.59) * min(.39,grad*3.4) * (.65+listenRim*.39+sparkle*.35);
    color += foil * density * .025*(1.0+connect*.5+thought*.4);
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class Pair {
  a: WebGLRenderTarget;
  b: WebGLRenderTarget;
  constructor(size: number) { this.a = computeTarget(size); this.b = computeTarget(size); }
  swap() {
    const front = this.a;
    this.a = this.b;
    this.b = front;
  }
  dispose() { this.a.dispose(); this.b.dispose(); }
}

class FluidGrid {
  readonly flow: Pair;
  readonly ink: Pair;
  readonly pressure: Pair;
  readonly divergence: WebGLRenderTarget;
  constructor(readonly size: number) {
    this.flow = new Pair(size);
    this.ink = new Pair(size);
    this.pressure = new Pair(size);
    this.divergence = computeTarget(size);
  }
  dispose() {
    this.flow.dispose(); this.ink.dispose(); this.pressure.dispose(); this.divergence.dispose();
  }
}

export function createScene(seed: number, renderer: WebGLRenderer): BuiltScene {
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    throw new Error('Floating-point color targets are unavailable');
  }
  const uniforms = { ...uniformsFor(seed), ink: { value: null as Texture | null }, sampleSize: { value: new Vector2() } };
  const io = {
    flow: { value: null as Texture | null }, pigment: { value: null as Texture | null },
    scalarField: { value: null as Texture | null }, pressure: { value: null as Texture | null },
    pixel: { value: new Vector2() }, pointerAt: { value: new Vector2() }, pointerForce: { value: new Vector2() },
    operation: { value: 0 }, delta: { value: 1 / 45 }, seconds: { value: 0 }, seed: { value: Math.trunc(seed) % 1021 * .14 },
    squeeze: { value: 0 }, burst: { value: 0 }, attention: { value: 0 }, impulse: { value: 0 },
  };
  const pass = new ComputePass(new ShaderMaterial({ uniforms: io, vertexShader: computeVertex, fragmentShader: solver, depthTest: false, depthWrite: false }));
  const object = new Group();
  object.add(new Mesh(new PlaneGeometry(3.92,3.05), new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: shadeInk, transparent: true, depthWrite: false, toneMapped: false,
  })));
  let grid: FluidGrid | undefined;
  let elapsed = 0, accumulator = 0, oldX = 0, oldY = 0, resizing = 0;
  function run(operation: number, target: WebGLRenderTarget) {
    io.operation.value = operation;
    pass.draw(renderer, target);
  }
  function setGrid(size: number) {
    const last = grid;
    const next = new FluidGrid(size);
    io.pixel.value.setScalar(1 / size);
    run(7,next.flow.a);
    run(7,next.pressure.a);
    if (last) {
      io.pigment.value = last.ink.a.texture;
      run(6,next.ink.a);
      io.pigment.value = last.flow.a.texture;
      run(6,next.flow.a);
      last.dispose();
    } else run(5,next.ink.a);
    grid = next;
    uniforms.sampleSize.value.setScalar(1 / size);
  }
  function step(grid: FluidGrid, dt: number, iterations: number) {
    elapsed += dt;
    io.seconds.value = elapsed;
    io.delta.value = dt;
    io.flow.value = grid.flow.a.texture;
    run(0,grid.flow.b); grid.flow.swap();
    io.flow.value = grid.flow.a.texture;
    run(1,grid.divergence);
    io.scalarField.value = grid.divergence.texture;
    for (let i = 0; i < iterations; i++) {
      io.pressure.value = grid.pressure.a.texture;
      run(2,grid.pressure.b); grid.pressure.swap();
    }
    io.pressure.value = grid.pressure.a.texture;
    run(3,grid.flow.b); grid.flow.swap();
    io.flow.value = grid.flow.a.texture;
    io.pigment.value = grid.ink.a.texture;
    run(4,grid.ink.b); grid.ink.swap();
  }
  return { object, update(inputs) {
    feed(uniforms,inputs);
    const { motion } = inputs;
    const quality = inputs.quality ?? 1;
    const size = motion.reducedMotion || quality < .67 ? 64 : quality < .88 ? 88 : 116;
    const dt = motion.reducedMotion ? 1 / 28 : quality < .74 ? 1 / 38 : 1 / 50;
    const oldTarget = renderer.getRenderTarget();
    try {
      resizing = Math.max(0,resizing - motion.delta);
      if (!grid || (resizing === 0 && grid.size !== size)) {
        setGrid(size);
        resizing = .65;
      }
      io.squeeze.value = uniforms.intake.value;
      io.burst.value = uniforms.release.value;
      io.impulse.value = Math.max(0, -motion.features.recoil) + motion.pulse;
      io.attention.value = motion.attention;
      io.pointerAt.value.set(.5 + motion.x * .42,.5 - motion.y * .42);
      io.pointerForce.value.set(motion.x-oldX,oldY-motion.y).multiplyScalar(17).clampScalar(-.85,.85);
      oldX = motion.x; oldY = motion.y;
      accumulator = Math.min(2 * dt, accumulator + motion.delta * (motion.reducedMotion ? .3 : 1));
      while (accumulator >= dt) {
        step(grid!,dt,size >= 88 ? 10 : 7);
        accumulator -= dt;
      }
      uniforms.ink.value = grid!.ink.a.texture;
    } finally {
      renderer.setRenderTarget(oldTarget);
    }
  }, dispose() { grid?.dispose(); pass.dispose(); } };
}

