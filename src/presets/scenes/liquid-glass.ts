import { Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { feed, PARAMS, uniformsFor } from './shading.js';
import { lensHeight, lensPitch, lensStretch } from './glass-form.js';
import type { BuiltScene } from '../runtime.js';

const vertex = `
  varying vec2 ndc;
  void main(){ndc=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}
`;
const fragment = `${PARAMS}
  uniform vec2 extent, screen;
  uniform float pitch, background;
  varying vec2 ndc;
  float capsule(vec2 p,vec2 outer){
    vec2 line=vec2(max(0.0,abs(p.x)-outer.x+outer.y),p.y);
    return length(line)-outer.y;
  }
  float studio(vec2 q, float n) {
    float projected = dot(q,vec2(.68,.44)) + n;
    float glassLines = exp(-abs(projected+.11)*9.0)*.38 + exp(-abs(projected-.135)*22.0)*.67;
    float feather = exp(-abs(q.y+sin(q.x*2.9)*.2)*12.0)*.53;
    return glassLines+feather;
  }
  void main(){
    vec2 p=ndc*screen;
    p-=vec2(pointer.x,-pointer.y)*.026*screen;
    float a=sin(pitch), b=cos(pitch);
    p=mat2(b,-a,a,b)*p;
    float sd=capsule(p,extent);
    float pixel=max(.0015,fwidth(sd));
    float fill=1.0-smoothstep(-pixel,pixel,sd);
    float edge=exp(-abs(sd)*55.0);
    float halo=exp(-abs(sd)*26.0)*.145;
    if(fill+halo<.004)discard;
    vec2 q=p/extent.y;
    vec2 gradient=normalize(vec2(sign(p.x)*max(.0,abs(p.x)-extent.x+extent.y),p.y)+vec2(0,.00001));
    float bevel=clamp(1.0+sd/(extent.y*.57),.0,1.0);
    float rim=pow(bevel,3.2);
    float fresnel=pow(bevel,1.8);
    float reflected=pow(max(.0,dot(gradient,vec2(-.52,.85))),3.5);
    float reflectedBottom=pow(max(.0,dot(gradient,vec2(.38,-.92))),3.0);
    vec2 bent=q*.58+gradient*fresnel*(.24+release*.11)+vec2(.13*sin(motionPhase+q.x*2.0),0.0);
    float dispersion=.024+bevel*.076+spectralSheen*.018;
    vec3 split=vec3(studio(bent,dispersion),studio(bent,0.0),studio(bent,-dispersion));
    vec3 surface=mix(shade*.52+vec3(.034,.042,.065),glow*.52,.37+.18*sin(bent.x*2.3+clock*.52));
    surface+=split*mix(vec3(.55,.77,1.0),foil,.37)*(.23+background*.49);
    surface+=glow*(fresnel*.56+edge*.38);
    surface+=mix(foil,vec3(.62,.88,1.0),.27)*reflected*rim*(.75+listenRim*.65);
    surface+=vec3(.54,.40,.92)*reflectedBottom*rim*.76;
    float pulseEdge=exp(-abs(q.x-beatAges.x*8.0+1.8)*6.0)*beatStrengths.x*release;
    surface+=foil*(pulseEdge*.25+edge*(sparkle*.24+connect*.21));
    surface*=1.0-quiet*.37;
    float alpha=(fill*(.095+.62*fresnel+dot(split,vec3(.043))+background*.43)+halo)*(.95-quiet*.18);
    gl_FragColor=vec4(surface,clamp(alpha,.0,.98));
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms={...uniformsFor(seed), extent:{value:new Vector2()},screen:{value:new Vector2()},pitch:{value:0},background:{value:0}};
  const material=new ShaderMaterial({ uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:false,depthWrite:false });
  const mesh=new Mesh(new PlaneGeometry(2,2),material);
  mesh.frustumCulled=false;
  const object=new Group();
  object.add(mesh);
  return { object, update(inputs){
    feed(uniforms,inputs);
    const aspect=inputs.aspect??1.28;
    const half=Math.min(.43*aspect,.7826);
    uniforms.screen.value.set(aspect*.5,.5);
    uniforms.extent.value.set(half*lensStretch(inputs.motion),half/3.3*lensHeight(inputs.motion));
    uniforms.pitch.value=lensPitch(inputs.motion);
    // The compact tier paints more of its optical studio so the poster also reads on a plain background.
    uniforms.background.value=inputs.tier==='full'?.25:.60;
  }};
}
