import { Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DampedSpring } from '../../motion.js';
import { tilt } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

const pressure = `
  float passage(float at, float age) {
    float travel = (at - .16 - age * 1.74) * 5.2;
    return exp(-travel * travel - age * 3.1) * smoothstep(0.0, .058, age);
  }
  float pressureAt(vec3 p) {
    float at = .62 + dot(p, vec3(.20,.47,-.16));
    return passage(at,beatAges.x)*beatStrengths.x + passage(at,beatAges.y)*beatStrengths.y
      + passage(at,beatAges.z)*beatStrengths.z;
  }
`;

const vertex = `
  ${PARAMS}
  ${pressure}
  varying vec3 viewNormal, viewPoint;
  varying float compression;
  void main() {
    compression = pressureAt(normalize(position)) * release;
    float scale = 1.0 + breath * .012 - intake * .037 + release * .018 + pulse * .032 + springBack * .075;
    vec4 view = modelViewMatrix * vec4(position * (scale + compression * .016),1.0);
    viewPoint = view.xyz;
    viewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * view;
  }
`;

const fragment = `
  ${PARAMS}
  uniform vec3 heart;
  uniform float radius, radiance;
  varying vec3 viewNormal, viewPoint;
  varying float compression;

  float windowLight(vec3 ray, vec3 center, vec2 halfSize, float feather) {
    vec3 right = normalize(cross(vec3(0,1,0),center));
    vec3 up = cross(center,right);
    float front = dot(ray,center);
    vec2 onWindow = vec2(dot(ray,right),dot(ray,up)) / max(front,.1);
    vec2 edge = abs(onWindow) - halfSize + .09;
    float sdf = length(max(edge,0.0))+min(max(edge.x,edge.y),0.0)-.09;
    return (1.0-smoothstep(-feather,feather,sdf))*smoothstep(.15,.7,front);
  }

  vec3 studio(vec3 ray, vec3 key, vec3 fill) {
    float roof = smoothstep(-.58,.8,ray.y);
    float side = smoothstep(-.70,.82,ray.x);
    vec3 field = mix(vec3(.023,.016,.039),vec3(.096,.121,.184),roof);
    field += vec3(.115,.061,.054)*side*smoothstep(.10,.92,-ray.y);
    field += vec3(.65,.77,.91)*windowLight(ray,key,vec2(.33,.46),.18);
    field += vec3(.43,.22,.15)*windowLight(ray,fill,vec2(.30,.12),.23);
    return field;
  }

  vec3 exitRay(vec3 incident, vec3 normal, float ior) {
    vec3 ray = refract(incident,normal,1.0/ior);
    vec3 exitNormal = normalize(normal - 2.0*dot(normal,ray)*ray);
    return refract(ray,-exitNormal,ior);
  }

  void main() {
    vec3 view = normalize(-viewPoint);
    vec3 normal = normalize(viewNormal + compression * vec3(-.044,.058,0));
    float facing = clamp(dot(normal,view),0.0,1.0);
    float grazing = 1.0-facing;
    float fresnel = .0337 + .9663 * pow(grazing,5.0);
    vec3 key = normalize(vec3(-.65+pointer.x*.14,.57+pointer.y*.10,.69));
    vec3 fill = normalize(vec3(.78,-.51,.51));
    vec3 reflection = reflect(-view,normal);
    float keyWindow = windowLight(reflection,key,vec2(.37,.49),.105);
    float keyHalo = windowLight(reflection,key,vec2(.49,.63),.27);
    float counter = windowLight(reflection,fill,vec2(.34,.118),.21);
    vec3 r = exitRay(-view,normal,1.442);
    vec3 g = exitRay(-view,normal,1.450);
    vec3 b = exitRay(-view,normal,1.459);
    vec3 transmitted = vec3(studio(r,key,fill).r,studio(g,key,fill).g,studio(b,key,fill).b);
    vec3 ray = refract(-view,normal,1.0/1.450);
    float through = max(0.0,-2.0*dot(normal,ray));

    vec3 nearest = normal + ray*clamp(dot(heart-normal,ray),0.0,through);
    vec3 gap = nearest-heart;
    vec2 projection = normal.xy-heart.xy;
    float opticalDistance = dot(gap,gap)+dot(projection,projection)*.42;
    float density = exp(-opticalDistance/(radius*radius));
    float bloom = exp(-opticalDistance/(radius*radius*2.5));
    vec3 caustic = (normal-vec3(.10,-.60,.54))*vec3(1.75,3.8,1.08);
    float floorGlow = exp(-dot(caustic,caustic))*smoothstep(.09,.8,facing);

    vec3 warm = mix(glow,foil,.62);
    vec3 cool = mix(glow,vec3(.34,.70,1.0),.58);
    vec3 light = mix(warm,cool,clamp(intake*.92 + .16 - release*.20, 0.0, .87));
    float core = radiance*(density*.98+bloom*.19);
    vec3 color = transmitted * (1.0-fresnel) * vec3(.79,.83,.99) * (.38+.31*facing);
    color += mix(shade,vec3(.058,.083,.16),.60) * (.19+.55*grazing);
    color += light*core + mix(light,vec3(.95,.94,1.0),.50)*density*density*radiance*.45;
    color += warm*floorGlow*(.15 + release*.18);
    color += vec3(.94,.97,1.0)*(keyWindow*.81+keyHalo*.13)*(1.0+fresnel*.84);
    color += mix(vec3(.43,.58,.82),foil,.25)*counter*.36;

    vec3 film = .5+.5*cos(vec3(.45,2.48,4.45)+grazing*8.2+spectralSheen*.28);
    float filmEdge = smoothstep(.68,.97,grazing)*pow(grazing,2.1);
    color += (vec3(.13,.23,.40)+film*.53+foil*(.09+listenRim*.31))*filmEdge;
    color += mix(studio(reflection,key,fill),glow,.22)*fresnel*.51;
    color += (glow*.36+foil*.11)*compression*fresnel;
    color *= 1.0-quiet*.68;
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = {
    ...uniformsFor(seed), heart: { value: new Vector3() }, radius: { value: .26 }, radiance: { value: .56 },
  };
  const object = new Group();
  const shell = new Mesh(new SphereGeometry(1.04,72,50), new ShaderMaterial({ uniforms,vertexShader:vertex,fragmentShader:fragment }));
  object.add(aura(uniforms,3.8,3.3,.59),shell);
  const radius = new DampedSpring(.26);
  const light = new DampedSpring(.56);
  return { object, update(inputs) {
    feed(uniforms,inputs);
    const { motion } = inputs;
    const { release, intake, thought, connect } = uniforms;
    const time = motion.phase;
    uniforms.radius.value = radius.step(.26 + release.value*.13 - intake.value*.15 + motion.breath*.016, motion.delta,106,18);
    uniforms.radiance.value = light.step(.56 + release.value*.31 - intake.value*.10 + connect.value*.12, motion.delta,122,20);
    uniforms.heart.value.set(Math.sin(time*.73+uniforms.seedKey.value)*(.075+thought.value*.11)+motion.x*.11,
      -.16+Math.cos(time*.88)*(.065+thought.value*.10)-motion.y*.10,.06);
    tilt(shell,motion,Math.sin(motion.time*.41)*.09-intake.value*.084,-.08,-.16+motion.features.recoil*.12);
  } };
}
