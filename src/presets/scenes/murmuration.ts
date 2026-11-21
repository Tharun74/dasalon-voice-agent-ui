import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points, ShaderMaterial, Vector2 } from 'three';
import type { Texture, WebGLRenderer } from 'three';
import type { BuiltScene } from '../runtime.js';
import { tilt } from '../runtime.js';
import { ComputePass, computeTarget, computeVertex } from './compute.js';
import { PARAMS, feed, uniformsFor } from './shading.js';

const flock = `
  ${PARAMS}
  varying vec2 coord;
  uniform sampler2D positions, velocities;
  uniform vec2 gridSize;
  uniform float tick, shape;
  uniform int pass;
  float hash(float p) { return fract(sin(p*113.197+seedKey)*43758.54); }
  vec3 goal(vec2 uv) {
    float id=floor(uv.y*gridSize.y)*gridSize.x+floor(uv.x*gridSize.x);
    float a=uv.x*6.283185+motionPhase*.48;
    float j=uv.y-.5, spread=hash(id+.31)-.5;
    float radius=1.02+j*.42+spread*.20;
    float current=a+.24*sin(3.0*a+clock*.42+j*7.0);
    vec3 ring=vec3(cos(current)*radius,sin(current)*radius,.40*sin(a*2.0)+j*.83);
    ring.y*=.63;
    ring.y+=ring.z*.49;
    vec3 vortex=vec3(cos(a+j*7.0)*radius*.57,sin(a+j*7.0)*radius*.57,j*.98);
    float latitude=uv.y*2.0-1.0;
    vec3 sphere=vec3(cos(a)*sqrt(max(0.0,1.0-latitude*latitude)),latitude,sin(a)*sqrt(max(0.0,1.0-latitude*latitude)));
    vec3 wave=vec3((uv.x-.5)*2.5,sin((uv.x-.5)*9.0-motionPhase*.7)*.47+j*.71,sin(a+j*7.0)*.41);
    vec3 heart=vec3(pow(abs(sin(a)),3.0)*sign(sin(a))*1.10,
      (13.0*cos(a)-5.0*cos(2.0*a)-2.0*cos(3.0*a)-cos(4.0*a))*.065,
      j*.92)*(1.0+j*.29);
    float spiralAngle=uv.x*16.0+motionPhase*.66;
    vec3 spiral=vec3(cos(spiralAngle)*uv.x*1.24,sin(spiralAngle)*uv.x*.93,j*.66+uv.x*.35);
    float m=fract(shape);
    m=m*m*(3.0-2.0*m);
    float n=mod(floor(shape),4.0);
    vec3 form=n<1.0?mix(sphere,wave,m):n<2.0?mix(wave,heart,m):n<3.0?mix(heart,spiral,m):mix(spiral,sphere,m);
    vec3 target=mix(ring,mix(form,ring,.12),clamp(release*.94,0.0,.95));
    target=mix(target,vortex,thought*.95);
    target*=1.0-intake*.40+release*.21+springBack*.32+breath*.038;
    return target;
  }
  void main() {
    vec3 target=goal(coord);
    if(pass==2) {gl_FragColor=vec4(target,1.0);return;}
    if(pass==3) {gl_FragColor=vec4(0);return;}
    vec3 p=texture2D(positions,coord).xyz;
    vec3 v=texture2D(velocities,coord).xyz;
    if(pass==1){gl_FragColor=vec4(p+v*tick,1);return;}
    vec3 separation=vec3(0), alignment=vec3(0), center=vec3(0);
    float count=0.0;
    for(int neighbor=0;neighbor<6;neighbor++) {
      float i=float(neighbor);
      vec2 offset=vec2((mod(i,3.0)-1.0)*(1.0+floor(clock*.73)),(i<3.0?-1.0:1.0)*(1.0+mod(floor(clock*.82),5.0)));
      vec2 at=fract(coord+offset/gridSize);
      vec3 other=texture2D(positions,at).xyz;
      vec3 d=other-p;
      float distanceToNeighbor=length(d);
      float local=1.0-smoothstep(.11,.34,distanceToNeighbor);
      separation-=d*local/max(.013,distanceToNeighbor*distanceToNeighbor);
      alignment+=texture2D(velocities,at).xyz*local;
      center+=other*local;
      count+=local;
    }
    vec3 field=sin(p.yzx*vec3(5.1,7.2,4.0)+vec3(clock*.56,coord.x*8.0,coord.y*7.0));
    vec3 acceleration=(target-p)*(7.0+intake*12.0+thought*8.0);
    if(count>.01) acceleration+=(center/count-p)*(2.4+intake*3.1)+(alignment/count-v)*.84+separation*(.022+release*.04);
    acceleration+=field*(.13+release*.82)*(1.0-quiet*.68);
    acceleration+=normalize(p+vec3(.0001))*(beatStrengths.x*exp(-beatAges.x*11.0)*release*4.0+springBack*7.3);
    acceleration+=vec3(pointer.x,-pointer.y,.0)*listenRim*.78;
    v=(v+acceleration*tick)*exp(-tick*(3.7-intake*.75));
    gl_FragColor=vec4(v,1);
  }
`;

const birdVertex = `${PARAMS}
  uniform sampler2D positions,velocities;
  uniform float pointScale;
  attribute vec2 address;
  varying vec3 bird;
  varying vec2 heading;
  void main(){
    vec3 p=texture2D(positions,address).xyz;
    vec3 v=texture2D(velocities,address).xyz+vec3(-p.y,p.x,0)*.25;
    vec4 mv=modelViewMatrix*vec4(p,1);
    heading=normalize((mat3(modelViewMatrix)*v).xy+vec2(.00001,0));
    bird=vec3(0.53+p.z*.44,address.y,fract(address.x*127.0+address.y*41.0));
    gl_Position=projectionMatrix*mv;
    gl_PointSize=max(1.7,(2.8+bird.z*3.1)*pointScale*4.6/-mv.z);
  }`;

const birdFragment = `${PARAMS}
  varying vec3 bird;
  varying vec2 heading;
  void main(){
    vec2 q=gl_PointCoord-.5;
    vec2 p=vec2(dot(q,heading),dot(q,vec2(-heading.y,heading.x)));
    float wing=abs(p.x+.05+abs(p.y)*.62);
    float birdShape=(1.0-smoothstep(.035,.19,wing))*(1.0-smoothstep(.16,.48,abs(p.y)));
    float body=(1.0-smoothstep(.035,.17,abs(p.y)))*(1.0-smoothstep(.11,.46,abs(p.x)));
    float a=max(birdShape,body*.72);
    if(a<.025)discard;
    vec3 warm=mix(shade,glow,clamp(.30+bird.x*.57+.15*sin(bird.y*12.0),.12,.97));
    vec3 cool=mix(glow,vec3(.13,.41,.82),.51);
    vec3 color=mix(warm,cool,smoothstep(.35,.89,bird.y)*.67);
    color=mix(color,foil,clamp(.09+bird.x*.37+sparkle*.16+listenRim*.24,0.0,.75));
    gl_FragColor=vec4(color,a*(.37+max(.0,bird.x)*.34+connect*.13)*(1.0-quiet*.54));
    #include <colorspace_fragment>
  }`;

function textureSlot() { return { value: null as Texture | null }; }
class FlockTargets {
  p0; p1; v0; v1;
  constructor(readonly width: number, readonly height: number) {
    this.p0 = computeTarget(width, height, false);
    this.p1 = computeTarget(width, height, false);
    this.v0 = computeTarget(width, height, false);
    this.v1 = computeTarget(width, height, false);
  }
  swap() {
    const position = this.p0, velocity = this.v0;
    this.p0 = this.p1;
    this.p1 = position;
    this.v0 = this.v1;
    this.v1 = velocity;
  }
  dispose() { this.p0.dispose(); this.p1.dispose(); this.v0.dispose(); this.v1.dispose(); }
}

export function createScene(seed: number, renderer: WebGLRenderer): BuiltScene {
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    throw new Error('Floating-point color targets are unavailable');
  }
  const uniforms = uniformsFor(seed);
  const numbers = { ...uniforms, gridSize: { value: new Vector2() }, shape: { value: 0 }, tick: { value: 0 }, pass: { value: 0 }, positions: textureSlot(), velocities: textureSlot() };
  const paint = { ...uniforms, positions: textureSlot(), velocities: textureSlot(), pointScale: { value: 1 } };
  const compute = new ComputePass(new ShaderMaterial({ uniforms: numbers, vertexShader: computeVertex, fragmentShader: flock, depthTest: false, depthWrite: false }));
  const geometry = new BufferGeometry();
  const material = new ShaderMaterial({ uniforms: paint, vertexShader: birdVertex, fragmentShader: birdFragment, depthWrite: false, transparent: true, blending: AdditiveBlending });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const object = new Group();
  object.add(points);
  let buffers: FlockTargets | undefined;
  let accumulated = 0, cooldown = 0;
  function initialize(width: number, height: number) {
    buffers?.dispose();
    buffers = new FlockTargets(width, height);
    numbers.gridSize.value.set(width,height);
    numbers.positions.value = numbers.velocities.value = null;
    numbers.pass.value = 2;
    compute.draw(renderer,buffers.p0);
    numbers.pass.value = 3;
    compute.draw(renderer,buffers.v0);
    const addresses = new Float32Array(width*height*2);
    for (let i=0; i<width*height; i++) {
      addresses[i*2] = (i%width+.5)/width;
      addresses[i*2+1] = (Math.floor(i/width)+.5)/height;
    }
    // Replacing attributes on one live geometry retains the old buffers in Three.
    points.geometry.dispose();
    points.geometry = new BufferGeometry();
    points.geometry.setAttribute('position',new BufferAttribute(new Float32Array(width*height*3),3));
    points.geometry.setAttribute('address',new BufferAttribute(addresses,2));
  }
  return { object, update(inputs) {
    feed(uniforms,inputs);
    const { motion }=inputs;
    const q=inputs.quality??1;
    const full=inputs.tier==='full'&&!motion.reducedMotion;
    const width=full?(q>.79?128:96):64;
    const height=full?128:motion.reducedMotion||q<.68?32:48;
    const dt=full?1/56:1/28;
    numbers.shape.value=motion.phase*.21;
    numbers.tick.value=dt;
    paint.pointScale.value=full?1.08:q<.7?.86:.97;
    cooldown=Math.max(0,cooldown-motion.delta);
    const target=renderer.getRenderTarget();
    try {
      if(!buffers||(cooldown===0&&(buffers.width!==width||buffers.height!==height))) {
        initialize(width,height);
        cooldown=.65;
      }
      const grid=buffers!;
      accumulated=Math.min(dt*2,accumulated+motion.delta*(motion.reducedMotion?.36:1));
      while(accumulated>=dt) {
        numbers.positions.value=grid.p0.texture;
        numbers.velocities.value=grid.v0.texture;
        numbers.pass.value=0;
        compute.draw(renderer,grid.v1);
        numbers.velocities.value=grid.v1.texture;
        numbers.pass.value=1;
        compute.draw(renderer,grid.p1);
        grid.swap();
        accumulated-=dt;
      }
      paint.positions.value=grid.p0.texture;
      paint.velocities.value=grid.v0.texture;
    } finally { renderer.setRenderTarget(target); }
    tilt(points,motion,-.10,.12,.14+Math.sin(motion.time*.35)*.09);
  }, dispose() { buffers?.dispose(); compute.dispose(); } };
}
