import type { CompanionClient, MediaState } from "../ws";
import { KaraokeLyrics } from "./KaraokeLyrics";

export function setupMusicPlayer(client: CompanionClient) {
  const titleEl = document.getElementById("track-title")!;
  const artistEl = document.getElementById("track-artist")!;
  const albumArtEl = document.getElementById("album-art") as HTMLImageElement;
  const btnPlay = document.getElementById("btn-play")!;
  const btnPrev = document.getElementById("btn-prev")!;
  const btnNext = document.getElementById("btn-next")!;
  const lyricsContainer = document.getElementById("lyrics-container")!;

  const lyrics = new KaraokeLyrics(lyricsContainer, (timeMs) => {
    client.sendMediaAction("seek", timeMs);
  });

  const triggerHaptic = (ms: number) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  };

  btnPlay.onclick = () => {
    triggerHaptic(15);
    client.sendMediaAction("playpause");
  };

  btnPrev.onclick = () => {
    triggerHaptic(15);
    client.sendMediaAction("previous");
  };

  btnNext.onclick = () => {
    triggerHaptic(15);
    client.sendMediaAction("next");
  };

  return {
    lyrics,
    update(media?: MediaState) {
      if (!media) return;
      titleEl.textContent = media.title || "No Track Playing";
      artistEl.textContent = media.artist || "Connect to Coucou";
      if (media.albumArt) {
        albumArtEl.src = media.albumArt;
        albumArtEl.classList.remove("hidden");
      }
      btnPlay.textContent = media.isPlaying ? "⏸" : "▶";
      lyrics.setLyrics(media.lyrics || []);
    },
    tick(posMs: number) {
      lyrics.updateTime(posMs);
    },
  };
}
