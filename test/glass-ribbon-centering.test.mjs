import test from 'node:test';
import assert from 'node:assert/strict';
import { createRibbonPose, frameTime, glassSpectrum, LENS_DETAILS, REFERENCE_LAST, ribbonMaskAlpha, updateRibbon } from '../dist/presets/glass-ribbon-timeline.js';

test('Glass Ribbon keeps the replay mask centered through the complete source clip', () => {
  const { diameter } = LENS_DETAILS;
  const stage = { pose:createRibbonPose(), width:112, height:112, originX:56, originY:60, diameter, spectrum:glassSpectrum(), full:true };
  let worst=0, visibleFrames=0;
  for(let frame=1;frame<=REFERENCE_LAST;frame++){
    const time=frameTime(frame);
    updateRibbon(stage,time,time,'replay',undefined,1,false,42);
    const { cx,cy,rx,ry,flare,ramp,amount }=stage.pose;
    let area=0, moment=0;
    for(let col=0;col<224;col++){
      const x=(col+.5)/2;
      for(let row=56;row<192;row++){
        const y=(row+.5)/2;
        const mask=ribbonMaskAlpha((x-cx)/rx,(y-cy)/ry,stage.pose)*flare*ramp*amount;
        area+=mask;
        moment+=mask*x;
      }
    }
    if(area>.0001){
      visibleFrames++;
      const offset=Math.abs(moment/area-cx)/diameter;
      assert.ok(offset<.01, 'Frame '+frame+' drifted '+(offset*100).toFixed(4)+'% of lens diameter');
      worst=Math.max(worst,offset);
    }
  }
  assert.ok(visibleFrames>200,'Expected a visible mask across the replay');
  console.log('Glass Ribbon max horizontal mask deviation '+(worst*100).toFixed(8)+'% across '+visibleFrames+' visible frames');
});
