'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { VoiceAgentAdapter } from '../types.js';
import type { PresetProps } from './catalog.js';
import { createPreset } from './preset.js';
import { renderKineticType } from './scenes/kinetic-type.js';

const Surface = /* @__PURE__ */ createPreset('kinetic-type', undefined, renderKineticType);

function CaptionAnnouncement({ adapter }: { adapter: VoiceAgentAdapter }) {
  const subscribe=useCallback((listener: () => void) => adapter.subscribe(listener),[adapter]);
  const read=useCallback(() => {
    const entry=adapter.getSnapshot().transcript.at(-1);
    return entry?.final ? entry.text : '';
  },[adapter]);
  const caption=useSyncExternalStore(subscribe,read,read);
  return <span role="status" aria-label="Voice caption" style={{
    position:'absolute',width:1,height:1,overflow:'hidden',whiteSpace:'nowrap',clipPath:'inset(50%)',
  }}>{caption}</span>;
}

export function KineticType(props: PresetProps) {
  return <><Surface {...props} />{props.interactive !== false ? <CaptionAnnouncement adapter={props.adapter} /> : null}</>;
}
