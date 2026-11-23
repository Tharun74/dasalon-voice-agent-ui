import {
  CanvasTexture, Group, LinearFilter, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace,
  Texture, Vector2, Vector3, Vector4, VideoTexture,
} from 'three';
import type { BuiltScene, SceneInputs } from '../runtime.js';
import { ribbonMaskShader } from '../glass-ribbon-timeline.js';
import type { GlassRibbonBackdrop, RibbonStage } from '../glass-ribbon-timeline.js';

export type RibbonSceneInputs = SceneInputs & { ribbon: RibbonStage };

const vertex = `
  varying vec2 point;
  void main() {
    point = vec2(uv.x, 1.0-uv.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const glass = `
  varying vec2 point;
  uniform vec2 viewport, sourceAspect;
  uniform vec4 shape, arrival, emission, accents;
  uniform float phase, tilt, hasBackdrop, extra, tint;
  uniform vec3 inks[5];
  uniform sampler2D plate;
  ${ribbonMaskShader}

  float shell(vec2 q, float order) {
    vec2 a = pow(abs(q), vec2(order));
    return pow(a.x+a.y, 1.0/order) - 1.0;
  }
  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 ab=b-a;
    return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));
  }
  float joined(float a,float b,float k) {
    float h=max(k-abs(a-b),0.0)/k;
    return min(a,b)-.25*h*h*k;
  }
  float ridge(float x, float spread) { return exp(-abs(x)*spread); }
  vec2 cover(vec2 uv) { return vec2(.5)+(uv-.5)*sourceAspect; }
  vec3 stagedBackdrop(vec2 uv) {
    vec3 ink=mix(vec3(.039,.076,.075),vec3(.117,.086,.065),smoothstep(.36,.98,uv.y));
    ink+=exp(-abs(uv.x+uv.y*.54-.91)*18.0)*vec3(.079,.101,.093);
    return ink;
  }
  vec3 refraction(vec2 at,vec2 normal,float amount,float chroma) {
    if(hasBackdrop<.5) return stagedBackdrop(at+normal*amount);
    vec2 d=normal*amount;
    vec3 center=texture2D(plate,cover(at+d)).rgb;
    if(extra<.5) return center;
    vec3 result=vec3(texture2D(plate,cover(at+d*(1.0+chroma))).r,center.g,
      texture2D(plate,cover(at+d*(1.0-chroma))).b);
    return result;
  }
  void main() {
    vec2 pixel=point*viewport;
    vec2 aperture=(pixel-shape.xy)/shape.zw;
    float c=cos(tilt), s=sin(tilt);
    vec2 p=mat2(c,-s,s,c)*aperture;
    const float order=2.22;
    float edge=shell(p,order);
    float neck=arrival.y;
    if(neck>.001 && point.y<shape.y/viewport.y) {
      vec2 start=vec2(0,-max(1.05,shape.y/shape.w));
      float tether=segment(p,start,vec2(.02,-.20))-(.09+neck*.45);
      edge=joined(edge,tether,neck*.63);
    }
    float aa=max(fwidth(edge),.004);
    float inside=1.0-smoothstep(-aa*.52,aa*.62,edge);
    float haze=exp(-max(0.0,edge)*12.0)*(1.0-inside)*(.09+emission.x*.075);
    if (inside+haze < .005 || arrival.x < .0001) discard;
    float border=clamp(1.0+edge/.30,0.0,1.0);
    vec2 n=normalize(sign(p)*pow(abs(p),vec2(order-1.0))+vec2(.00001));
    float floorLine=apertureHorizon+.102*sin(2.6*p.x+.68)+.056*p.x*p.x*p.x;
    float y=aperture.y-apertureHorizon;
    float bottom=smoothstep(-.055,.11,p.y-floorLine);
    float plank=pow(border,2.6);
    vec2 pixelRadius=shape.zw/viewport;
    vec2 opticalNormal=n*pixelRadius;
    float curvature=1.0-clamp(dot(aperture,aperture),0.0,1.0);
    vec2 magnified=point-aperture*pixelRadius*(.103*curvature+.022);
    float dispersion=.24+emission.w*.12;
    vec3 through=refraction(magnified,opticalNormal,-(.61*plank+.044)*1.12,dispersion);
    vec3 petrol=mix(vec3(.011,.026,.030),vec3(.037,.064,.057),smoothstep(-1.0,0.1,p.y));
    vec3 bronze=mix(vec3(.009,.012,.014),through*.56+vec3(.046,.024,.015),smoothstep(-.025,.84,y));
    vec3 face=mix(petrol,bronze,bottom);
    face=mix(through*.74+vec3(.043,.058,.051),face,arrival.z);
    vec2 pane=p-vec2(-.32,-.52);
    pane=mat2(.93,-.37,.37,.93)*pane;
    float windowEdge=shell(pane/vec2(.34,.177),3.3);
    float softbox=(1.0-smoothstep(-.81,.50,windowEdge))*(1.0-.42*smoothstep(-.13,.06,pane.y));
    face+=softbox*vec3(.066,.076,.083);
    float arc=length((p-vec2(.12,.16))*vec2(1.03,1.50));
    float caustic=exp(-pow((arc-.75)*15.0,2.0))*smoothstep(.26,.91,dot(p,vec2(.54,.87)));
    face+=caustic*vec3(.091,.065,.041)*(.74+.26*arrival.z);
    face*=1.0-plank*.15;
    if(extra>.5){
      vec2 grid=p*24.0;
      vec2 cell=floor(grid);
      float grain=fract(sin(dot(cell,vec2(81.142,127.72)))*13757.238);
      vec2 mote=fract(grid)-vec2(.22+grain*.56,.81-grain*.61);
      float dust=(1.0-smoothstep(.030,.16,length(mote)))*step(.93,grain);
      face+=vec3(.12,.14,.16)*dust*(.18+softbox*.29);
    }

    float reach=ribbonReach(emission.y);
    float x=aperture.x/reach;
    float bus=ribbonBump(x);
    float laneMask=ribbonCoverage(bus,y,emission.z,arrival.w,max(.012,aa*.77));
    float edgeBands = extra>.5?1.0:.75;
    vec3 light=vec3(0);
    float hot=0.0;
    for(int i=0;i<5;i++){
      float lane=float(i);
      float wave=sin(phase*(1.11+lane*.103)+lane*2.399 + tint);
      float drift=.61*wave+.16*cos(phase*.77+lane*3.1);
      float local=x-drift;
      float weight=exp(-local*local*(3.9+lane*.21));
      float coloredFold=y+(.068*sin(phase*.81+lane+2.8*x)+mix(-.073,.076,lane*.25))*bus*arrival.w;
      float slash=ridge(coloredFold+emission.z*.14*bus,42.0);
      float fastGlow=exp(-abs(y)*11.5)*bus*weight;
      float height=.023+emission.z*.20*bus;
      float stratum=coloredFold/height-.56*sin(lane*2.303+phase*.82);
      float chroma=.39+.61*exp(-stratum*stratum*2.1);
      vec3 ink=inks[i];
      light+=ink * weight * (laneMask*chroma*(.27+emission.x*1.32+slash*.52*edgeBands)+fastGlow*.17);
      hot+=weight*laneMask*chroma;
    }
    float sliver=exp(-abs(y)*132.0)*exp(-pow(aperture.x/.389,4.0));
    vec3 needle=mix(vec3(.16,.65,1.0),vec3(1.0,.58,.24),smoothstep(.03,.76,p.x));
    float laser=(.12+emission.x*.42)*ridge(y,87.0)*exp(-pow(aperture.x/.94,8.0));
    float etched=exp(-pow((abs(p.x)-.72)*46.0,2.0))*ridge(y-.108,65.0);
    float fire=pow(clamp(hot*.52,0.0,1.0),2.0)*emission.w;
    light=(light*arrival.w + needle*sliver*(.44+arrival.w*.39)+needle*laser+vec3(.85,.97,1.0)*fire*.84)*accents.x;
    light*=1.0-accents.y*.83;
    vec3 mapped=1.0-exp(-light*1.35);
    float ar=atan(n.y,n.x);
    float facet = .53+.37*pow(abs(cos(ar*3.0+.58)),8.0);
    float polished = ridge(edge+(.018+emission.w*.012),105.0)*facet;
    float bevel = ridge(edge+.094,48.0)*(.26+.55*max(0.0,n.y));
    float marks=pow(max(0.0,cos(ar*15.0+.21)),25.0)*smoothstep(.45,.9,abs(n.x))*ridge(edge+.10,63.0);
    vec3 metal=mix(vec3(.21,.49,.49),vec3(.87,.59,.34),smoothstep(-.75,.86,n.y));
    vec3 prismatic=mix(metal,needle,.35+emission.w*.33);
    float rim= (polished*(.43+emission.w*.49+accents.z*.33)+bevel*.31+marks*.19);
    vec3 rgb=face+mapped*.86+prismatic*(rim+etched*.07*arrival.z);
    rgb+=vec3(.51,.60,.74)*ridge(edge+.015,91.0)*(.14+emission.w*.30);
    rgb=mix(rgb,vec3(.65,.44,.32),haze*.08)*(1.0-accents.y*.36);
    float alpha=arrival.x*(inside*(mix(.62,.97,arrival.z))+haze);
    gl_FragColor=vec4(rgb,clamp(alpha,0.0,1.0));
    #include <colorspace_fragment>
  }
`;

function newTexture(backdrop: GlassRibbonBackdrop) {
  let texture: Texture;
  if (backdrop.tagName === 'VIDEO') texture = new VideoTexture(backdrop as HTMLVideoElement);
  else if (backdrop.tagName === 'CANVAS') texture = new CanvasTexture(backdrop as HTMLCanvasElement);
  else texture = new Texture(backdrop);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function createScene(): BuiltScene {
  const uniforms = {
    shape: { value: new Vector4() }, arrival: { value: new Vector4() }, emission: { value: new Vector4() },
    accents: { value: new Vector4() }, viewport: { value: new Vector2() }, sourceAspect: { value: new Vector2(1,1) },
    phase: { value: 0 }, tint: { value: 0 },
    tilt: { value: 0 }, hasBackdrop: { value: 0 }, extra: { value: 1 },
    plate: { value: null as Texture | null }, inks: { value: Array.from({ length: 5 }, () => new Vector3()) },
  };
  const geometry = new PlaneGeometry(2,2);
  const material = new ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: glass,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(geometry,material);
  mesh.frustumCulled = false;
  const object = new Group();
  object.add(mesh);
  let source: GlassRibbonBackdrop | undefined;
  let texture: Texture | undefined;
  let imageUrl = '';
  return { object, update(base) {
    const { ribbon } = base as RibbonSceneInputs;
    const { pose: p, width, height, backdrop, spectrum } = ribbon;
    uniforms.viewport.value.set(width,height);
    uniforms.shape.value.set(p.cx,p.cy,p.rx,p.ry);
    uniforms.arrival.value.set(p.amount,p.neck,p.dark,p.ramp);
    uniforms.emission.value.set(p.energy,p.span,p.lift,p.heat);
    uniforms.accents.value.set(p.flare,p.quiet,p.rim,p.breath);
    uniforms.phase.value=p.phase;
    uniforms.tilt.value=p.pitch;
    uniforms.tint.value=p.tint;
    uniforms.extra.value=ribbon.full && (base.quality ?? 1) > .68 ? 1 : 0;
    for (let index=0; index<spectrum.length; index++) uniforms.inks.value[index].set(...spectrum[index]);
    if (source !== backdrop) {
      texture?.dispose();
      source = backdrop;
      imageUrl = '';
      texture = backdrop ? newTexture(backdrop) : undefined;
      uniforms.plate.value = texture ?? null;
    }
    const video = backdrop?.tagName === 'VIDEO' ? backdrop as HTMLVideoElement : undefined;
    const image = backdrop?.tagName === 'IMG' ? backdrop as HTMLImageElement : undefined;
    const w = video?.videoWidth ?? image?.naturalWidth ?? backdrop?.width ?? 0;
    const h = video?.videoHeight ?? image?.naturalHeight ?? backdrop?.height ?? 0;
    const ready = w > 0 && h > 0 && (!video || video.readyState >= 2);
    uniforms.hasBackdrop.value = ready ? 1 : 0;
    if (texture && ready && !video) {
      if (image ? image.currentSrc !== imageUrl || texture.version === 0 : true) texture.needsUpdate = true;
      if (image) imageUrl = image.currentSrc;
    }
    if (ready) {
      const ar = w/h, display = width/height;
      uniforms.sourceAspect.value.set(Math.min(1,display/ar), Math.min(1,ar/display));
    }
  }, dispose() { texture?.dispose(); } };
}
