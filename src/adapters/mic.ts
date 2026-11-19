import type { AgentSnapshot } from '../types.js';
import { MediaStreamAdapter } from './media-stream.js';
import type { MediaStreams } from './media-stream.js';

export class MicAdapter extends MediaStreamAdapter {
  constructor(private readonly constraints: MediaTrackConstraints = {
    echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  }) {
    super();
    this.update({ permission: 'prompt' });
  }

  protected async acquire() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access requires a secure page and browser support.');
    }
    const input = await navigator.mediaDevices.getUserMedia({ audio: this.constraints });
    return { input, release: () => input.getTracks().forEach(track => track.stop()) };
  }

  protected beforeAcquire(): Partial<AgentSnapshot> {
    return { permission: this.permission === 'granted' ? 'granted' : 'prompt' };
  }

  protected connected(): Partial<AgentSnapshot> { return { permission: 'granted' }; }

  protected onFailure(error: unknown): Partial<AgentSnapshot> {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { permission: 'denied', error: 'Microphone access was denied. Check this site’s permissions and try again.' };
    }
    return { permission: 'unavailable' };
  }

  protected applyMute(streams: MediaStreams, muted: boolean) {
    streams.input?.getAudioTracks().forEach(track => { track.enabled = !muted; });
  }

  protected watchEnded(streams: MediaStreams, onEnded: () => void) {
    const tracks = streams.input?.getAudioTracks() ?? [];
    const check = () => {
      if (tracks.every(track => track.readyState === 'ended')) onEnded();
    };
    tracks.forEach(track => track.addEventListener('ended', check));
    if (tracks.every(track => track.readyState === 'ended')) queueMicrotask(check);
    return () => tracks.forEach(track => track.removeEventListener('ended', check));
  }
}
