import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const imported = process.env.VOICEKIT_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.VOICEKIT_PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(imported);
const origin = process.argv[2] || 'http://localhost:3127';
const screenshots = process.argv[3] ? resolve(process.argv[3]) : await mkdtemp(join(tmpdir(),'voicekit-liquid-glass-'));
await mkdir(screenshots,{recursive:true});

for(const fallback of [false,true]){
  const renderer = fallback ? 'canvas' : 'webgl';
  const browser = await chromium.launch({
    channel:'chrome',
    args:fallback?['--disable-webgl']:['--enable-gpu','--enable-unsafe-swiftshader'],
  });
  try {
    const page=await browser.newPage({viewport:{width:1440,height:920},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(/invalid|THREE.WebGLProgram|feedback loop/i.test(message.text()))errors.push(message.text());});
    const response=await page.goto(origin+'/components/liquid-glass',{waitUntil:'domcontentloaded',timeout:90000});
    assert.equal(response?.status(),200);
    const stage=page.locator('#preview .voice-canvas');
    const capsule=stage.locator('canvas[data-liquid-glass-capsule]');
    await capsule.and(stage.locator('[data-renderer="'+renderer+'"]')).waitFor({timeout:35000});
    assert.equal(await stage.locator('canvas').count(),1);
    assert.equal(await capsule.count(),1);
    assert.equal(await stage.locator('[style*="backdrop-filter"], feDisplacementMap').count(),0);
    const runs=await capsule.evaluate(canvas=>{
      const ctx=canvas.getContext('2d');
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const y=Math.floor(canvas.height*.5);
      let starts=0, inside=false, count=0;
      for(let x=0;x<canvas.width;x++){
        const solid=pixels[(y*canvas.width+x)*4+3]>55;
        if(solid)count++;
        if(solid&&!inside)starts++;
        inside=solid;
      }
      return {starts,coverage:count/canvas.width};
    });
    assert.equal(runs.starts,1,'Expected a continuous, single capsule silhouette');
    assert.ok(runs.coverage>.65&&runs.coverage<.97,'Unexpected capsule width');
    assert.deepEqual(errors,[]);
    const target=join(screenshots,'liquid-glass-'+renderer+'-single-capsule.png');
    await stage.screenshot({path:target});
    console.log(renderer,runs,target);
  } finally { await browser.close(); }
}
