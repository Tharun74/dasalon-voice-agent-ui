import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoAdapter, LiquidGlass } from '../dist/index.js';

test('Liquid Glass emits one capsule canvas for inline and floating layouts at either tier', () => {
  for(const floating of [false,true]){
    for(const quality of ['preview','full']){
      const html=renderToStaticMarkup(React.createElement(LiquidGlass,{adapter:new DemoAdapter(),floating,quality}));
      assert.equal((html.match(/data-liquid-glass-capsule=/g)??[]).length,1);
      assert.equal((html.match(/<canvas\b/g)??[]).length,1);
      assert.doesNotMatch(html,/<svg\b|backdrop-filter|feDisplacementMap/i);
    }
  }
});
