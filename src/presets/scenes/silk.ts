import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, ShaderMaterial } from 'three';
import { DampedSpring } from '../../motion.js';
import { tilt } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

const STRANDS = 180;

function ribbons(sections: number) {
  const configuration = new Float32Array(STRANDS * (sections+1) * 6);
  const faces = new Uint16Array(STRANDS * sections * 6);
  let vertex = 0, face = 0;
  for(let strand=0;strand<STRANDS;strand++){
    const lane=(strand+.5)*2/STRANDS-1;
    for(let s=0;s<=sections;s++){
      const top=vertex/3;
      configuration[vertex++]=s/sections; configuration[vertex++]=lane; configuration[vertex++]=-1;
      configuration[vertex++]=s/sections; configuration[vertex++]=lane; configuration[vertex++]=1;
      if(s<sections){
        faces[face++]=top; faces[face++]=top+1; faces[face++]=top+2;
        faces[face++]=top+1; faces[face++]=top+3; faces[face++]=top+2;
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(configuration,3));
  geometry.setIndex(new BufferAttribute(faces,1));
  return geometry;
}

const vertex=`
  ${PARAMS}
  uniform float phaseAdvance, waveLift, rowWidth;
  varying vec3 T,N,V;
  varying vec4 fiber;
  varying float viewDepth;

  vec2 curl(vec2 p) {
    // Take the curl of a seeded, low-frequency scalar sine field.
    vec2 q=p*vec2(3.9,.62)+vec2(seedKey,phaseAdvance*.61);
    return vec2(.62*sin(q.x)*cos(q.y),-3.9*cos(q.x)*sin(q.y));
  }

  vec3 centerline(float u,float lane) {
    float x=(u-.5)*3.61;
    float roll = lane + .014*sin(lane*9.424778);
    float mouth = sin(3.141593*u);
    float shoulder = .46 + .12*mouth;
    float taper = .56+.44*smoothstep(.0,.22,min(u,1.0-u));
    float draw = shoulder*taper*(1.0-.46*intake+.18*release);
    float p = u*6.06 - phaseAdvance*1.44 + roll*.41 - .76;
    float q = u*3.16 - phaseAdvance*.73 - roll*.20 + 1.04;
    float r = u*8.83 - phaseAdvance*1.91 + roll*.29 + .19;
    vec2 turbulence=curl(vec2(u,lane));
    float y = roll*draw + (0.34+waveLift*.18)*sin(p) + .115*sin(q) + .047*sin(r);
    y += (u-.5)*.22 + turbulence.x*.023 + breath*.020;
    float z = .30*cos(p) + .10*cos(q) + .056*cos(r) + roll*taper*.18;
    z += turbulence.y*.010 + .10*waveLift*sin(p+.53);
    y += springBack*mouth*.14;
    z += pulse*mouth*.09;
    return vec3(x,y,z);
  }

  void main() {
    float u=position.x, lane=position.y, side=position.z;
    float v=lane+side*rowWidth;
    vec3 point=centerline(u,v);
    vec3 du=centerline(u+.004,v)-point;
    vec3 dv=centerline(u,v+.006)-point;
    vec4 pos=modelViewMatrix*vec4(point,1.0);
    T=normalize(normalMatrix*du);
    N=normalize(normalMatrix*cross(du,dv));
    V=-pos.xyz;
    viewDepth=pos.z;
    fiber=vec4(u,v,side,lane);
    gl_Position=projectionMatrix*pos;
  }
`;

const fragment=`
  ${PARAMS}
  varying vec3 T,N,V;
  varying vec4 fiber;
  varying float viewDepth;

  float satin(vec3 t,vec3 normal,vec3 view,vec3 lamp,float power) {
    vec3 halfway=normalize(lamp+view);
    float axis=dot(t,halfway);
    return pow(sqrt(max(0.0,1.0-axis*axis)),power)*(.22+.78*max(0.0,dot(normal,halfway)));
  }

  void main() {
    float u=fiber.x,lane=fiber.y,edge=fiber.z;
    vec3 view=normalize(V), along=normalize(T);
    vec3 normal=normalize(N)*(gl_FrontFacing?1.0:-1.0);
    vec3 softbox=normalize(vec3(-.46,.74,.70));
    vec3 bounce=normalize(vec3(.88,-.43,.48));
    float key=satin(along,normal,view,softbox,24.0);
    float fill=satin(along,normal,view,bounce,51.0);
    float wrapped=clamp(dot(softbox,normal)*.54+.46,.0,1.0);
    float shift=.5+.5*sin(lane*10.9+.24);
    float bundle=.63+.37*smoothstep(-.85,.80,cos(lane*6.6-u*.95));
    float resolution=1.0-smoothstep(.63,1.35,fwidth(edge));
    float crossThread=(1.0-abs(edge))*.23*resolution;
    vec3 copper=mix(shade*.54+vec3(.11,.045,.026),glow,.29+shift*.24);
    vec3 color=copper*(.20+wrapped*.63)*bundle;
    color+=foil*(key*.77+fill*.24+crossThread + .16*spectralSheen);
    color+=vec3(.28,.14,.064)*fill*.31;
    float border=exp(-pow((1.0-abs(lane))*6.6,2.0));
    color+=foil*border*listenRim*.24;
    float softDepth=smoothstep(-6.20,-4.45,viewDepth);
    color*=.72+softDepth*.28;
    float feather=smoothstep(.0,.17,u)*smoothstep(.0,.17,1.0-u);
    float edgeFade=1.0-smoothstep(.87,1.0,abs(lane));
    gl_FragColor=vec4(color*(1.0-quiet*.60),clamp(feather*edgeFade,0.0,1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms={ ...uniformsFor(seed), phaseAdvance:{value:0}, waveLift:{value:0}, rowWidth:{value:1/STRANDS} };
  const object=new Group();
  const preview=ribbons(24), full=ribbons(34);
  const cloth=new Mesh(preview,new ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,
    side:DoubleSide,transparent:true,depthWrite:false}));
  cloth.frustumCulled=false;
  object.add(aura(uniforms,4.7,3.0,.55),cloth);
  const amplitude=new DampedSpring(), speed=new DampedSpring(.62);
  return { object, update(inputs){
    feed(uniforms,inputs);
    const {motion}=inputs;
    const dt=motion.delta*(motion.reducedMotion?.34:1);
    cloth.geometry=inputs.tier==='full'?full:preview;
    uniforms.waveLift.value=amplitude.step(Math.max(0,.53*uniforms.release.value+.24*uniforms.bodyWeight.value),dt,67,15);
    uniforms.phaseAdvance.value+=speed.step(.62+uniforms.release.value*.75-uniforms.intake.value*.13+uniforms.thought.value*.14,dt,51,14)*dt;
    tilt(cloth,motion,-.15-uniforms.intake.value*.10,Math.sin(motion.time*.39)*.080,.15+motion.features.recoil*.091);
  },dispose(){
    // The scene host disposes the mesh's current geometry.
    (cloth.geometry===preview?full:preview).dispose();
  }};
}
