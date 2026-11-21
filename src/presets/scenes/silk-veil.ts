import { DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import type { Texture, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { BuiltScene } from '../runtime.js';
import { tilt } from '../runtime.js';
import { ComputePass, computeTarget, computeVertex } from './compute.js';
import { feed, PARAMS, uniformsFor } from './shading.js';

const shape = `
  vec3 restShape(vec2 uv, float seed) {
    float u = uv.x-.5;
    float v = uv.y;
    float skew = .49*v*v - .25*v;
    return vec3(u*(2.12 + .17*v) + skew, (.47-v)*1.94 + u*.40 + .14*sin(uv.x*3.14159)*v,
      .16*cos(uv.x*11.0+seed*.38)*(0.33+.80*v) + u*v*.28);
  }
`;

const verlet = `
  varying vec2 coord;
  uniform sampler2D positionNow, positionLast;
  uniform vec2 cell, hand;
  uniform float delta, clock, phase, seed, listening, speaking, recoil, attention, pulse, thought, muted;
  uniform int mode;
  ${shape}
  vec3 pos(vec2 uv) { return texture2D(positionNow,uv).xyz; }
  vec3 link(vec3 point,vec3 start,vec2 offset,float stiffness) {
    vec2 at=coord+offset;
    if (min(at.x,at.y)<0.0 || max(at.x,at.y)>1.0) return vec3(0);
    vec3 span=pos(at)-point;
    float distance=max(.00005,length(span));
    float rest=length(restShape(at,seed)-start);
    return span * ((distance-rest)/distance) * stiffness;
  }
  void main() {
    vec3 rest=restShape(coord,seed);
    if(mode==1) {gl_FragColor=vec4(rest,1.0);return;}
    if(mode==2) {gl_FragColor=vec4(pos(coord),1.0);return;}
    vec3 point=pos(coord);
    vec3 previous=texture2D(positionLast,coord).xyz;
    float v=coord.y;
    vec3 anchor=rest;
    anchor.x*=1.0-listening*.28+speaking*.11;
    anchor.y+=sin(clock*.87+coord.x*5.0)*.041*v;
    anchor.z+=sin(phase*3.7+coord.x*6.0-v*5.1) * (.13+speaking*.22)*(v+.2);
    vec3 offset=anchor-point;
    vec3 wind=vec3(.43+sin(phase*3.0+v*5.0)*.6,-.58,.45)
      + vec3(rest.x*1.54,.21,sin(v*7.0-clock*3.0)*3.5+.8)*speaking;
    wind.x -= rest.x*listening*2.1;
    wind.z += thought*cos(v*12.0-clock*1.2+coord.x*6.0)*1.85;
    wind += vec3(rest.x*.27, .31, -2.15)*recoil*3.2;
    vec2 d=coord-hand;
    float touch=exp(-dot(d,d)*28.0)*(attention*4.5+pulse*5.3);
    wind += vec3(d.x,d.y,.69)*touch;
    vec2 x=vec2(cell.x,0),y=vec2(0,cell.y);
    vec3 tension=link(point,rest,x,.20)+link(point,rest,-x,.20)
      +link(point,rest,y,.20)+link(point,rest,-y,.20);
    tension+=link(point,rest,x+y,.085)+link(point,rest,-x-y,.085)+link(point,rest,x-y,.085)+link(point,rest,y-x,.085);
    tension+=link(point,rest,2.0*x,.037)+link(point,rest,-2.0*x,.037)+link(point,rest,2.0*y,.037)+link(point,rest,-2.0*y,.037);
    vec3 inertia=clamp((point-previous)*(.975-.055*muted),-.034,.034);
    vec3 next=point+inertia+tension+(offset*(11.2+listening*6.0)+wind)*delta*delta;
    float tether=1.0-smoothstep(cell.y*.6,cell.y*3.4,v);
    next=mix(next,anchor,tether);
    gl_FragColor=vec4(next,1.0);
  }
`;

const vertex = `${PARAMS}
  uniform sampler2D cloth;
  uniform vec2 cell;
  varying vec2 textile;
  varying vec3 face, warp, view;
  vec3 weave(vec2 uv) { return texture2D(cloth,uv).xyz; }
  void main() {
    textile=uv;
    vec3 p=weave(uv);
    vec3 tangent=weave(uv+vec2(cell.x,0))-weave(uv-vec2(cell.x,0));
    vec3 down=weave(uv+vec2(0,cell.y))-weave(uv-vec2(0,cell.y));
    face=normalize(normalMatrix*cross(down,tangent));
    warp=normalize(normalMatrix*down);
    p.x *= 1.0 - intake*.10 + release*.07 + springBack*.12;
    p.z += springBack * pow(uv.y,1.5)*.33;
    vec4 projected=modelViewMatrix*vec4(p,1.0);
    view=-projected.xyz;
    gl_Position=projectionMatrix*projected;
  }
`;

const satin = `${PARAMS}
  varying vec2 textile;
  varying vec3 face, warp, view;
  void main() {
    vec3 n=normalize(face);
    vec3 eye=normalize(view);
    n*=sign(dot(n,eye));
    vec3 key=normalize(vec3(-.45,.70,.68));
    vec3 halfVector=normalize(key+eye);
    float along=dot(normalize(warp),halfVector);
    float threadSheen=exp(-along*along*13.0) * pow(max(0.0,dot(n,halfVector)),7.0);
    float rim=pow(1.0-clamp(dot(n,eye),0.0,1.0),2.5);
    float lambert=.31+.69*max(0.0,dot(n,key));
    float stripes=.72+.28*cos(textile.x*9.0+textile.y*4.0+seedKey*.55);
    vec3 base=mix(shade*.56+vec3(.042,.023,.085),glow*.78,stripes)*lambert;
    base+=mix(foil,vec3(.69,.83,1.0),.25)*threadSheen*(.57+sparkle*.23);
    base+=foil*rim*.21;
    vec2 edge=min(textile,1.0-textile);
    float seam=exp(-pow((min(edge.x,edge.y)-.014)*158.0,2.0));
    float border=1.0-smoothstep(.003,.019,min(edge.x,edge.y));
    float weave=.5+.5*sin(textile.x*850.0);
    weave=mix(weave,.5,smoothstep(.002,.012,fwidth(textile.x)));
    base+=foil*(seam*.20+border*(.23+listenRim*.46)+weave*.026);
    base+=foil*thought*sin(textile.y*7.0-clock*1.44)*.065+glow*connect*.11;
    gl_FragColor=vec4(base*(1.0-quiet*.52), .96);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class ClothGrid {
  previous: WebGLRenderTarget;
  current: WebGLRenderTarget;
  next: WebGLRenderTarget;
  constructor(readonly width: number, readonly height: number) {
    this.previous=computeTarget(width,height);
    this.current=computeTarget(width,height);
    this.next=computeTarget(width,height);
  }
  advance() {
    const old=this.previous;
    this.previous=this.current;
    this.current=this.next;
    this.next=old;
  }
  dispose() {
    this.previous.dispose();
    this.current.dispose();
    this.next.dispose();
  }
}

export function createScene(seed: number, renderer: WebGLRenderer): BuiltScene {
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    throw new Error('Floating-point color targets are unavailable');
  }
  const uniforms={...uniformsFor(seed),cloth:{value:null as Texture|null},cell:{value:new Vector2()}};
  const simulation={
    positionNow:{value:null as Texture|null},positionLast:{value:null as Texture|null},
    cell:{value:new Vector2()},hand:{value:new Vector2()}, delta:{value:1/62},clock:{value:0}, phase:{value:0},
    seed:{value:Math.trunc(seed)%127*.33},listening:{value:0},speaking:{value:0},recoil:{value:0},attention:{value:0},pulse:{value:0},
    thought:{value:0},muted:{value:0}, mode:{value:1},
  };
  const pass=new ComputePass(new ShaderMaterial({uniforms:simulation,vertexShader:computeVertex,fragmentShader:verlet,depthTest:false,depthWrite:false}));
  const object=new Group();
  const sheet=new Mesh(new PlaneGeometry(1,1,46,58),new ShaderMaterial({
    uniforms, vertexShader:vertex,fragmentShader:satin, side:DoubleSide,transparent:true,depthWrite:true,
  }));
  sheet.frustumCulled=false;
  object.add(sheet);
  let cloth: ClothGrid|undefined;
  let accumulator=0, resizing=0;
  function setCloth(width: number) {
    const previous=cloth;
    const height=Math.round(width*1.19);
    const next=new ClothGrid(width,height);
    simulation.cell.value.set(1/width,1/height);
    uniforms.cell.value.copy(simulation.cell.value);
    simulation.mode.value=previous?2:1;
    simulation.positionNow.value=previous?.current.texture??null;
    pass.draw(renderer,next.previous);
    pass.draw(renderer,next.current);
    previous?.dispose();
    cloth=next;
  }
  return { object, update(inputs) {
    const {motion}=inputs;
    const q=inputs.quality??1;
    const width=motion.reducedMotion||inputs.tier!=='full'||q<.67?27:q<.89?36:46;
    const tick=inputs.tier==='preview'?1/28:width<=27?1/42:1/62;
    feed(uniforms,inputs);
    const target=renderer.getRenderTarget();
    try {
      resizing=Math.max(0,resizing-motion.delta);
      if(!cloth||(resizing===0 && cloth.width!==width)) {
        setCloth(width);
        resizing=.6;
      }
      simulation.clock.value=motion.time;
      simulation.phase.value=motion.phase;
      simulation.hand.value.set(.5+motion.x*.45,.5+motion.y*.45);
      simulation.listening.value=uniforms.intake.value;
      simulation.speaking.value=uniforms.release.value;
      simulation.recoil.value = motion.features.recoil * (motion.reducedMotion ? .35 : 1);
      simulation.attention.value=motion.attention;
      simulation.pulse.value=motion.pulse;
      simulation.thought.value=motion.weights.thinking;
      simulation.muted.value=motion.weights.muted+motion.weights.error;
      simulation.mode.value=0;
      simulation.delta.value=tick;
      accumulator = Math.min(tick * 2, accumulator + motion.delta * (motion.reducedMotion ? .32 : 1));
      while(accumulator>=tick) {
        simulation.positionNow.value=cloth!.current.texture;
        simulation.positionLast.value=cloth!.previous.texture;
        pass.draw(renderer,cloth!.next);
        cloth!.advance();
        accumulator-=tick;
      }
      uniforms.cloth.value=cloth!.current.texture;
    } finally { renderer.setRenderTarget(target); }
    tilt(sheet,motion,-.26+Math.sin(motion.time*.60)*.16,.34+Math.cos(motion.phase*.44)*.20,-.22+motion.features.recoil*.39);
  }, dispose() {cloth?.dispose();pass.dispose();} };
}

