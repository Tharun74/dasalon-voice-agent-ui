import {
  CanvasTexture, Group, LinearFilter, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Texture, Vector2, VideoTexture,
} from 'three';
import { DampedSpring } from '../../motion.js';
import { feed, PARAMS, uniformsFor } from './shading.js';
import { lensHeight, lensPitch, lensStretch } from './glass-form.js';
import type { BuiltScene, SceneInputs } from '../runtime.js';

const vertex = `
  varying vec2 ndc;
  void main(){ndc=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}
`;
const fragment = `${PARAMS}
  uniform vec2 extent,screen,mediaCover,blur;
  uniform float pitch,hasMedia,detail;
  uniform sampler2D backdrop;
  varying vec2 ndc;

  float capsule(vec2 p,vec2 outer) {
    vec2 radial=vec2(sign(p.x)*max(0.0,abs(p.x)-outer.x+outer.y),p.y);
    return length(radial)-outer.y;
  }

  vec3 studio(vec2 uv) {
    vec2 p=(uv-.5)*vec2(2.15,1.0);
    vec3 field=mix(shade*.34+vec3(.021,.026,.044),vec3(.058,.092,.151),smoothstep(-.5,.5,p.y));
    float key=pow(max(0.0,1.0-length((p-vec2(-.36,.14))*vec2(2.5,4.2))),2.1);
    float fill=exp(-dot((p-vec2(.30,-.12))*vec2(2.1,4.4),(p-vec2(.30,-.12))*vec2(2.1,4.4)));
    float panel=exp(-pow((p.y + .14*sin(p.x*2.7)+.09)*9.2,2.0));
    return field + foil*key*.33 + vec3(.14,.23,.38)*fill*.69+glow*panel*.12;
  }

  vec3 readPlate(vec2 uv) {
    return texture2D(backdrop,.5+(uv-.5)*mediaCover).rgb;
  }

  vec3 refractPlate(vec2 uv,vec2 bend,float fringe) {
    vec2 at=uv-bend;
    vec2 split=bend*fringe;
    vec3 result=vec3(0.0);
    if(hasMedia>.5) {
      vec3 field=readPlate(at)*.28;
      vec2 nearPlate=blur*.49;
      field+=(readPlate(at+vec2(nearPlate.x,0))+readPlate(at-vec2(nearPlate.x,0))
        +readPlate(at+vec2(0,nearPlate.y))+readPlate(at-vec2(0,nearPlate.y)))*.12;
      if(detail>.5) {
        field+=(readPlate(at+blur*.72)+readPlate(at-blur*.72)
          +readPlate(at+blur*vec2(.72,-.72))+readPlate(at+blur*vec2(-.72,.72)))*.06;
      } else field/= .76;
      vec3 separated=vec3(readPlate(at-split).r,field.g,readPlate(at+split).b);
      field=mix(field,separated,clamp(fringe*3.1,0.0,.77));
      float light=dot(field,vec3(.2126,.7152,.0722));
      result=max(vec3(0),mix(vec3(light),field,1.38));
    } else {
      result=vec3(studio(at-split).r,studio(at).g,studio(at+split).b);
    }
    return result;
  }

  void main(){
    vec2 p=ndc*screen-vec2(pointer.x,-pointer.y)*.024*screen;
    float s=sin(pitch),c=cos(pitch);
    p=mat2(c,-s,s,c)*p;
    float sd=capsule(p,extent);
    float aa=max(.0008,fwidth(sd));
    if(sd>aa*2.1)discard;
    float fill=1.0-smoothstep(-aa*.68,aa*.87,sd);
    vec2 radial=vec2(sign(p.x)*max(0.0,abs(p.x)-extent.x+extent.y),p.y);
    vec2 normal=normalize(radial+vec2(0,.00001));
    float profile=length(radial)/extent.y;
    float rim=1.0-smoothstep(.0,.18,-sd/extent.y);
    float primary=1.0-smoothstep(.001,aa*1.55+.004,abs(sd+.0025));
    float reflectTop=pow(max(0.0,dot(normal,vec2(-.47,.88))),2.65);
    float reflectBottom=pow(max(0.0,dot(normal,vec2(.34,-.94))),3.4);
    float polish=(.13+.66*reflectTop+.31*reflectBottom)*rim*rim;
    float innerShade=exp(-pow((sd/extent.y+.23)*7.0,2.0))*(.20+.31*max(0.0,-normal.y));
    vec2 shifted=vec2(c*normal.x-s*normal.y,s*normal.x+c*normal.y);
    float lens=.050*profile+pow(rim,1.45)*(.28+release*.047+pulse*.055);
    vec2 bend=shifted*(extent.y*lens)/(screen*2.0);
    vec3 seen=refractPlate(ndc*.5+.5,bend,(.14+spectralSheen*.057)*rim);
    vec3 frost=mix(vec3(.21,.31,.49),glow,.32);
    vec3 split=.5+.5*cos(vec3(.25,2.43,4.47)+normal.x*4.4+normal.y*2.9+spectralSheen*.51);
    vec3 surface=seen*(.94-innerShade*.38)+frost*(.078+.061*innerShade);
    surface+=mix(foil,vec3(.79,.92,1.0),.47)*(polish*(.77+listenRim*.26)+primary*.18);
    surface+=split*rim*rim*(.093+primary*.11)*(.63+reflectBottom*.55);
    float breathLight=exp(-pow((p.x/extent.x-beatAges.x*5.1+.69)*3.8,2.0))*beatStrengths.x*release;
    surface+=foil*breathLight*rim*.14;
    surface*=1.0-quiet*.42;
    float opacity=fill*(hasMedia>.5?.94:.79)+primary*.045;
    gl_FragColor=vec4(surface,clamp(opacity,0.0,1.0));
    #include <colorspace_fragment>
  }
`;

function createPlate(source: NonNullable<SceneInputs['backdrop']>) {
  const texture=source.tagName==='VIDEO'?new VideoTexture(source as HTMLVideoElement)
    :source.tagName==='CANVAS'?new CanvasTexture(source as HTMLCanvasElement)
    :new Texture(source);
  texture.colorSpace=SRGBColorSpace;
  texture.minFilter=texture.magFilter=LinearFilter;
  texture.generateMipmaps=false;
  return texture;
}

export function createScene(seed: number): BuiltScene {
  const uniforms={...uniformsFor(seed),extent:{value:new Vector2()},screen:{value:new Vector2()},pitch:{value:0},
    mediaCover:{value:new Vector2(1,1)},blur:{value:new Vector2()},hasMedia:{value:0},detail:{value:0},
    backdrop:{value:null as Texture|null}};
  const material=new ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new Mesh(new PlaneGeometry(2,2),material);
  mesh.frustumCulled=false;
  const object=new Group();
  object.add(mesh);
  const stretch=new DampedSpring(1), height=new DampedSpring(1), twist=new DampedSpring();
  let source:SceneInputs['backdrop'],plate:Texture|undefined,imageUrl='';
  return {object,update(inputs){
    feed(uniforms,inputs);
    const { motion }=inputs;
    const dt=motion.delta;
    const aspect=inputs.aspect??1.28;
    const half=Math.min(.407*aspect,.752);
    const press=motion.pulse*(motion.reducedMotion?.32:1);
    const x=stretch.step(lensStretch(motion)+press*.14,dt,111,14);
    const y=height.step(lensHeight(motion)-press*.19,dt,137,16);
    uniforms.screen.value.set(aspect*.5,.5);
    uniforms.extent.value.set(half*x,half/3.3*y);
    uniforms.pitch.value=twist.step(lensPitch(motion)+press*.063,dt,88,12);
    uniforms.blur.value.set(10/Math.max(1,inputs.cssWidth??300),10/Math.max(1,inputs.cssHeight??234));
    uniforms.detail.value=inputs.tier==='full'&&(inputs.quality??1)>.68?1:0;
    const backdrop=inputs.backdrop;
    if(source!==backdrop){
      plate?.dispose();
      source=backdrop;
      imageUrl='';
      plate=source?createPlate(source):undefined;
      uniforms.backdrop.value=plate??null;
    }
    const video=source?.tagName==='VIDEO'?source as HTMLVideoElement:undefined;
    const image=source?.tagName==='IMG'?source as HTMLImageElement:undefined;
    const w=video?.videoWidth??image?.naturalWidth??source?.width??0;
    const h=video?.videoHeight??image?.naturalHeight??source?.height??0;
    const ready=w>0&&h>0&&(!video||video.readyState>=2);
    uniforms.hasMedia.value=Number(ready);
    if(ready&&plate){
      const mediaAspect=w/h;
      uniforms.mediaCover.value.set(Math.min(1,aspect/mediaAspect),Math.min(1,mediaAspect/aspect));
      if(!video&&(!image||imageUrl!==image.currentSrc||plate.version===0))plate.needsUpdate=true;
      if(image)imageUrl=image.currentSrc;
    }
  },dispose(){plate?.dispose();}};
}
