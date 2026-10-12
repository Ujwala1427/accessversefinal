// Voice guidance utility using browser SpeechSynthesis API with graceful degradation

class SpeechService {
  private isMuted: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getSupported(): boolean {
    return this.isSupported;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public stop(): void {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public speak(text: string, onEnd?: () => void): boolean {
    if (!this.isSupported || this.isMuted || !text.trim()) {
      return false;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly slower, clear pace for accessible mobility
      utterance.pitch = 1.0;
      utterance.lang = 'en-IN'; // Indian English or fallback

      utterance.onend = () => {
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('[SpeechService] Voice synthesis error:', e);
        this.currentUtterance = null;
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      console.warn('[SpeechService] Speech synthesis failed:', e);
      return false;
    }
  }

  public cancel() {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
