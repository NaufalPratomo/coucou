// Coucou iPhone Web Companion — Animated Mochi Canvas Component

export type MochiMood = "idle" | "happy" | "thinking" | "alert";

export class MochiCanvas {
  private ctx: CanvasRenderingContext2D | null = null;
  private frame: number = 0;
  private isBouncing: boolean = false;
  private mood: MochiMood = "idle";
  private animId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    if (typeof requestAnimationFrame !== "undefined") {
      this.loop();
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setMusicPlaying(playing: boolean): void {
    this.isBouncing = playing;
  }

  public setMood(mood: MochiMood): void {
    this.mood = mood;
  }

  public getMood(): MochiMood {
    return this.mood;
  }

  public getMusicPlaying(): boolean {
    return this.isBouncing;
  }

  public destroy(): void {
    if (this.animId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private loop = (): void => {
    this.frame++;
    const ctx = this.ctx;
    if (ctx) {
      const width = this.canvas.width || 36;
      const height = this.canvas.height || 36;
      ctx.clearRect(0, 0, width, height);

      // Physics bounce & breathing
      const bounce = this.isBouncing
        ? Math.sin(this.frame * 0.18) * 2.5
        : Math.sin(this.frame * 0.05) * 0.8;

      // Body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(18, 18 + bounce, 12, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = "#111111";
      const blink = this.frame % 150 < 6;

      if (this.mood === "thinking") {
        // Thinking: glasses/curious look
        ctx.fillRect(12, 16 + bounce, 4, 2);
        ctx.fillRect(20, 16 + bounce, 4, 2);
      } else if (this.mood === "alert") {
        // Alert: wide eyes
        ctx.beginPath();
        ctx.arc(14, 16 + bounce, 2.2, 0, Math.PI * 2);
        ctx.arc(22, 16 + bounce, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (blink) {
        // Blinking
        ctx.fillRect(13, 17 + bounce, 3, 1);
        ctx.fillRect(20, 17 + bounce, 3, 1);
      } else {
        // Normal happy/idle round eyes
        ctx.beginPath();
        ctx.arc(14, 17 + bounce, 1.5, 0, Math.PI * 2);
        ctx.arc(22, 17 + bounce, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Blush
      ctx.fillStyle =
        this.mood === "alert"
          ? "rgba(255, 60, 60, 0.6)"
          : "rgba(255, 100, 150, 0.45)";
      ctx.beginPath();
      ctx.arc(10, 20 + bounce, 2, 0, Math.PI * 2);
      ctx.arc(26, 20 + bounce, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (typeof requestAnimationFrame !== "undefined") {
      this.animId = requestAnimationFrame(this.loop);
    }
  };
}
