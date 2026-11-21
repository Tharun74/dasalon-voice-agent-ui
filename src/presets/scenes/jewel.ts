import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, PlaneGeometry, Points, ShaderMaterial } from 'three';
import { DampedSpring } from '../../motion.js';
import { randomFor, tilt } from '../runtime.js';
import type { BuiltScene } from '../runtime.js';
import { feed, PARAMS, uniformsFor } from './shading.js';

type Corner = [number, number, number];
const TAU = Math.PI * 2;
function cutGem(seed: number) {
  const rand=randomFor(seed);
  const ring=(y: number, radius: number, turn: number) => Array.from({length:8},(_,i): Corner => {
    const a=i*TAU/8+turn;
    return [Math.cos(a)*radius,y,Math.sin(a)*radius*.78];
  });
  const crown=ring(.92,.43,TAU/16), girdle=ring(.25,.97,0), pavilion=ring(-.38,.62,TAU/16);
  const table: Corner=[0,.92,0], tip: Corner=[0,-1.10,0];
  const vertices: number[]=[], centers: number[]=[], edges: number[]=[], chips: number[]=[];
  function face(a:Corner,b:Corner,c:Corner) {
    const x=(a[0]+b[0]+c[0])/3,y=(a[1]+b[1]+c[1])/3,z=(a[2]+b[2]+c[2])/3;
    const chip=rand();
    vertices.push(...a,...b,...c);
    centers.push(x,y,z,x,y,z,x,y,z);
    edges.push(1,0,0,0,1,0,0,0,1);
    chips.push(chip,chip,chip);
  }
  for(let i=0;i<8;i++) {
    const j=(i+1)%8;
    face(table,crown[j],crown[i]);
    face(crown[i],crown[j],girdle[j]);
    face(crown[i],girdle[j],girdle[i]);
    face(girdle[i],girdle[j],pavilion[i]);
    face(girdle[j],pavilion[j],pavilion[i]);
    face(pavilion[i],pavilion[j],tip);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));
  geometry.setAttribute('center',new BufferAttribute(new Float32Array(centers),3));
  geometry.setAttribute('edgeMark',new BufferAttribute(new Float32Array(edges),3));
  geometry.setAttribute('chip',new BufferAttribute(new Float32Array(chips),1));
  return geometry;
}

const facetVertex=`${PARAMS}
  uniform float fracture, lowEnd;
  attribute vec3 center,edgeMark;
  attribute float chip;
  varying vec3 eyeSpace, bary, origin;
  varying float indexMark;
  void main(){
    vec3 p=position-center;
    float twist=fracture*(chip-.51)*1.65 + lowEnd*.034*sin(chip*21.0);
    float c=cos(twist),s=sin(twist);
    p.xz=mat2(c,s,-s,c)*p.xz;
    vec3 direction=normalize(center*vec3(1,.57,1)+vec3(chip-.5,.12,fract(chip*27.0)-.5)*.27);
    vec3 w=p+center+direction*fracture*(.36+chip*.48);
    w*=1.0-intake*.20+release*.155+breath*.027+abs(bodyWeight)*.045;
    vec4 mv=modelViewMatrix*vec4(w,1);
    eyeSpace=mv.xyz;origin=center;bary=edgeMark;indexMark=chip;
    gl_Position=projectionMatrix*mv;
  }
`;

const facetFragment=`${PARAMS}
  uniform float fracture, lowEnd;
  varying vec3 eyeSpace,bary,origin;
  varying float indexMark;
  vec3 environment(vec3 r){
    float panel=exp(-abs(r.x+.42)*5.3)*smoothstep(-.16,.71,r.y);
    float strip=exp(-abs(r.y+r.z*.4+.42)*14.0)*smoothstep(-.84,-.12,r.x);
    float fill=exp(-abs(r.z-r.x*.42+.34)*5.8)*smoothstep(.20,.83,-r.y);
    vec3 studio=vec3(.10,.055,.15)+panel*vec3(1.9,1.55,1.51)+strip*vec3(.37,.71,2.4)+fill*vec3(1.38,.29,.52);
    return studio;
  }
  void main(){
    vec3 view=-normalize(eyeSpace);
    vec3 n=normalize(cross(dFdx(eyeSpace),dFdy(eyeSpace)));
    if(dot(n,view)<.0)n=-n;
    float cosI=max(0.02,dot(view,n));
    float fresnel=.08+.92*pow(1.0-cosI,4.4);
    vec3 reflectDir=reflect(-view,n);
    vec3 red=refract(-view,n,1.0/1.60), green=refract(-view,n,1.0/1.65), blue=refract(-view,n,1.0/1.72);
    vec3 caustic=vec3(environment(red).r,environment(green).g,environment(blue).b);
    float facetShift=sin(indexMark*36.0+lowEnd*2.2+motionPhase*.54);
    float internal=.30+.70*pow(abs(facetShift),1.3);
    vec3 wine=mix(shade,glow,.11+indexMark*.37)*(.09+internal*.34);
    vec3 tint=mix(vec3(.20,.31,.63),foil,.29);
    float optics=.24+cosI*.49+internal*.20;
    vec3 color=wine+caustic*tint*optics+environment(reflectDir)*mix(glow,foil,.57)*fresnel;
    float prism=pow(.5+.5*sin(eyeSpace.y*12.0-eyeSpace.x*6.0+dot(blue,vec3(4.0,3.0,1.0))),12.0);
    color+=prism*pow(max(.0,dot(n,normalize(vec3(.26,.66,.74)))),2.0)*vec3(.23,.41,.91)*(internal*.59);
    vec3 edgeWeight=smoothstep(vec3(0),max(vec3(.001),fwidth(bary)*(1.17+listenRim*.75)),bary);
    float edge=1.0-min(min(edgeWeight.x,edgeWeight.y),edgeWeight.z);
    float pointLight=pow(max(.0,dot(reflectDir,normalize(vec3(-.38,.52,.8)))),40.0);
    color+=pointLight*(.48+sparkle*.75)*foil+edge*mix(glow,foil,.36)*(.18+listenRim*.42+fracture*.42);
    color+=glow*(.15+spectralSheen*.24)*exp(-length(origin.xy)*1.3);
    color*=1.0-quiet*.60;
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const groundVertex=`varying vec2 coords;void main(){coords=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const caustics=`${PARAMS}
  varying vec2 coords;
  void main(){
    vec2 q=coords*vec2(1.12,1.7);
    float r=length(q);
    float a=atan(q.y,q.x);
    float trace=sin(r*26.0+a*6.0+motionPhase*.5)+sin(r*18.0-a*4.0-motionPhase*.8);
    float rib=pow(clamp((trace+.34)*.42,0.0,1.0),3.2);
    float rays=pow(.5+.5*cos(a*8.0+r*6.0+motionPhase*.35),5.0);
    float density=exp(-r*r*3.5)*(rib*.63+rays*.27);
    float spectrum=.5+.5*sin(a*3.0+r*9.0+spectralSheen);
    vec3 rainbow=mix(vec3(.25,.44,1.0),vec3(1.0,.28,.22),spectrum);
    vec3 color=mix(glow,rainbow,.51);
    gl_FragColor=vec4(color,density*(.59+release*.28-intake*.21)*(1.0-quiet*.60));
    #include <colorspace_fragment>
  }`;

const glintVertex=`${PARAMS}
  attribute float glitterId;
  varying float value;
  void main(){
    vec3 p=position*(1.0+release*.31-intake*.25+springBack*.22);
    vec4 mv=modelViewMatrix*vec4(p,1.0);
    value=pow(.5+.5*sin(clock*.91+glitterId*56.0),14.0)*(.45+sparkle*.67);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=3.5+10.0*value;
  }`;
const glintFragment=`${PARAMS}
  varying float value;
  void main(){
    vec2 p=abs(gl_PointCoord-.5);
    float cross=(exp(-p.x*24.0)*exp(-p.y*5.1)+exp(-p.y*24.0)*exp(-p.x*5.1))*(1.0-smoothstep(.25,.49,length(p)));
    if(cross<.01)discard;
    gl_FragColor=vec4(foil,cross*value*(1.0-quiet*.56));
    #include <colorspace_fragment>
  }`;

export function createScene(seed: number): BuiltScene {
  const uniforms={...uniformsFor(seed),fracture:{value:0},lowEnd:{value:0}};
  const object=new Group();
  const gem=new Mesh(cutGem(seed),new ShaderMaterial({ uniforms,vertexShader:facetVertex,fragmentShader:facetFragment,side:DoubleSide }));
  const caustic=new Mesh(new PlaneGeometry(3.45,2.8),new ShaderMaterial({
    uniforms,vertexShader:groundVertex,fragmentShader:caustics,transparent:true,blending:AdditiveBlending,depthWrite:false,side:DoubleSide,
  }));
  caustic.rotation.x=-1.24;
  caustic.position.set(0,-1.20,-.22);
  const rand=randomFor(seed+52);
  const geometry=new BufferGeometry();
  const positions=new Float32Array(75*3), ids=new Float32Array(75);
  for(let i=0;i<ids.length;i++){
    const a=rand()*TAU,r=.76+rand()*.66;
    positions.set([Math.cos(a)*r,(rand()-.5)*2.20,Math.sin(a)*r*.76],i*3);
    ids[i]=rand();
  }
  geometry.setAttribute('position',new BufferAttribute(positions,3));
  geometry.setAttribute('glitterId',new BufferAttribute(ids,1));
  const glints=new Points(geometry,new ShaderMaterial({uniforms,vertexShader:glintVertex,fragmentShader:glintFragment,transparent:true,depthWrite:false,blending:AdditiveBlending}));
  const fracture=new DampedSpring();
  object.add(caustic,gem,glints);
  return {object,update(inputs){
    feed(uniforms,inputs);
    const { motion }=inputs;
    uniforms.lowEnd.value = (motion.audio.input.bass * motion.weights.listening + motion.audio.output.bass * motion.weights.speaking) * (motion.reducedMotion ? .30 : 1);
    const fragment=Math.max(motion.weights.interrupted*.74,Math.max(0,-motion.features.recoil)*1.64);
    uniforms.fracture.value=Math.max(0,fracture.step(fragment,motion.delta,75,13))*(motion.reducedMotion?.30:1);
    const turn=motion.phase*(motion.reducedMotion?.08:.39);
    tilt(gem,motion,.14+uniforms.bodyWeight.value*.035,turn,-.13+Math.sin(turn*.8)*.14);
    tilt(glints,motion,.08,turn*.71,0);
    geometry.setDrawRange(0,inputs.tier==='full'&&(inputs.quality??1)>.75?75:36);
    caustic.scale.setScalar(1+uniforms.release.value*.18-uniforms.intake.value*.12);
  }};
}
