import { AGENT_STATES } from './types.js';
import type { AgentState } from './types.js';
import { deltaSeconds } from './audio.js';

export const STATE_LABELS: Readonly<Record<AgentState, string>> = {
  idle: 'Ready',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  interrupted: 'Interrupted',
  muted: 'Muted',
  error: 'Offline',
};

export type StateWeights = Readonly<Record<AgentState, number>>;

export class StateMixer {
  private readonly from = Object.fromEntries(AGENT_STATES.map(state => [state, 0])) as Record<AgentState, number>;
  private readonly weights = { ...this.from };
  private target: AgentState;
  private candidate: AgentState;
  private candidateAge = 0;
  private dwell = 1;
  private elapsed = 0;
  private duration = 0;

  constructor(initial: AgentState = 'idle') {
    this.target = initial;
    this.candidate = initial;
    this.weights[initial] = 1;
  }

  /** Returns a reused view. Retargets from the current blend, including mid-transition. */
  sample(target: AgentState, delta: number): StateWeights {
    const dt = deltaSeconds(delta);
    if (target === this.candidate) this.candidateAge += dt;
    else {
      this.candidate = target;
      this.candidateAge = dt;
    }
    this.dwell += dt;
    const urgent = target === 'interrupted' || target === 'error' || target === 'muted';
    if (this.target !== target && (urgent || (this.candidateAge >= 0.058 && this.dwell >= 0.115))) {
      Object.assign(this.from, this.weights);
      this.target = target;
      this.elapsed = 0;
      this.dwell = 0;
      this.duration = target === 'interrupted' ? 0.31 : target === 'error' || target === 'muted' ? 0.49 : 0.38;
    }

    if (this.elapsed < this.duration) {
      this.elapsed = Math.min(this.elapsed + dt, this.duration);
      const t = 5.3 * this.elapsed / this.duration;
      // Critically damped step response, normalized to reach the target at the end of the blend.
      const blend = (1 - (1 + t) * Math.exp(-t)) / (1 - 6.3 * Math.exp(-5.3));
      for (const state of AGENT_STATES) {
        this.weights[state] = this.from[state] * (1 - blend) + (state === this.target ? blend : 0);
      }
    }
    return this.weights;
  }
}
