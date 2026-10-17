import type { LyricLine } from "../ws";

export class KaraokeLyrics {
  private activeIndex: number = -1;
  private lines: LyricLine[] = [];
  private container: HTMLElement;
  private onSeek: (timeMs: number) => void;

  constructor(container: HTMLElement, onSeek: (timeMs: number) => void) {
    this.container = container;
    this.onSeek = onSeek;
  }

  public setLyrics(lines: LyricLine[]): void {
    if (!this.container) return;

    if (
      this.lines.length === lines.length &&
      this.lines.length > 0 &&
      this.lines.every((l, i) => l.timeMs === lines[i]?.timeMs && l.text === lines[i]?.text)
    ) {
      return;
    }

    this.lines = lines;
    this.activeIndex = -1;
    this.container.innerHTML = "";
    if (lines.length === 0) {
      this.container.innerHTML = '<p class="text-neutral-600 text-sm italic">No synced lyrics available</p>';
      return;
    }

    lines.forEach((line, index) => {
      const p = document.createElement("p");
      p.className = "lyric-line transition-all duration-300 text-base font-medium text-neutral-500 cursor-pointer py-1";
      p.textContent = line.text;
      p.dataset.index = String(index);
      p.onclick = () => {
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(10);
          }
        } catch (_) {}
        this.onSeek(line.timeMs);
      };
      this.container.appendChild(p);
    });
  }

  public updateTime(currentMs: number): void {
    if (!this.container || this.lines.length === 0) return;

    let index = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].timeMs <= currentMs) {
        index = i;
      } else {
        break;
      }
    }

    if (index !== this.activeIndex && index >= 0) {
      this.activeIndex = index;
      const elements = this.container.querySelectorAll(".lyric-line");
      elements.forEach((el, i) => {
        if (i === index) {
          el.className = "lyric-line transition-all duration-300 text-xl font-bold text-white scale-105 py-2";
          try {
            if (typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (_) {
            if (typeof el.scrollIntoView === "function") {
              el.scrollIntoView();
            }
          }
        } else {
          el.className = "lyric-line transition-all duration-300 text-base font-medium text-neutral-500 opacity-40 py-1";
        }
      });
    }
  }
}
