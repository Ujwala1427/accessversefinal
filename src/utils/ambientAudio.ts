/**
 * Web Audio API based ambient oceanic/atmospheric soundscape synthesizer
 * Inspired by The Sea We Breathe / Journeys ambient sound design.
 */

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private filterNode: BiquadFilterNode | null = null;
  private lfoNode: OscillatorNode | null = null;

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public start() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, now);
      // Gentle fade in
      this.gainNode.gain.linearRampToValueAtTime(0.08, now + 2);
      this.gainNode.connect(this.ctx.destination);

      // Low pass filter simulating deep underwater oceanic acoustics
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(260, now);
      this.filterNode.Q.setValueAtTime(2.5, now);
      this.filterNode.connect(this.gainNode);

      // LFO for ocean wave swell effect
      this.lfoNode = this.ctx.createOscillator();
      this.lfoNode.frequency.setValueAtTime(0.12, now); // slow wave period ~8s
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(140, now);
      this.lfoNode.connect(lfoGain);
      lfoGain.connect(this.filterNode.frequency);
      this.lfoNode.start();

      // Atmospheric harmonic chords (deep sea fundamental + soft fifths)
      const freqs = [55, 110, 164.8, 220]; // A1, A2, E3, A3
      this.oscillators = freqs.map((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        // Subtle detuning for atmospheric warmth
        osc.detune.setValueAtTime((idx - 1.5) * 4, now);

        const subGain = this.ctx!.createGain();
        subGain.gain.setValueAtTime(0.25 / (idx + 1), now);

        osc.connect(subGain);
        subGain.connect(this.filterNode!);
        osc.start();
        return osc;
      });

      this.isPlaying = true;
    } catch (e) {
      console.warn('Ambient audio context init deferred:', e);
      this.isPlaying = false;
    }
  }

  public stop() {
    if (!this.ctx || !this.isPlaying) return;
    try {
      const now = this.ctx.currentTime;
      if (this.gainNode) {
        this.gainNode.gain.linearRampToValueAtTime(0, now + 1);
        setTimeout(() => {
          this.oscillators.forEach((osc) => {
            try {
              osc.stop();
              osc.disconnect();
            } catch {
              // ignore
            }
          });
          this.oscillators = [];
          if (this.lfoNode) {
            try {
              this.lfoNode.stop();
              this.lfoNode.disconnect();
            } catch {
              // ignore
            }
          }
          this.isPlaying = false;
        }, 1100);
      } else {
        this.isPlaying = false;
      }
    } catch {
      this.isPlaying = false;
    }
  }
}

export const ambientAudio = new AmbientAudioEngine();
