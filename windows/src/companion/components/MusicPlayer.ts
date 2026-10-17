import type { CompanionClient, MediaState } from "../ws";
import { KaraokeLyrics } from "./KaraokeLyrics";

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
}

export function setupMusicPlayer(client: CompanionClient) {
  const titleEl = document.getElementById("track-title")!;
  const artistEl = document.getElementById("track-artist")!;
  const albumArtEl = document.getElementById("album-art") as HTMLImageElement;
  const albumArtPlaceholder = document.getElementById("album-art-placeholder");
  const btnPlay = document.getElementById("btn-play")!;
  const btnPrev = document.getElementById("btn-prev")!;
  const btnNext = document.getElementById("btn-next")!;
  const iconPlay = document.getElementById("icon-play");
  const iconPause = document.getElementById("icon-pause");
  const lyricsContainer = document.getElementById("lyrics-container")!;

  // Scrubber & Volume elements
  const scrubber = document.getElementById("track-scrubber") as HTMLInputElement | null;
  const timeCurrent = document.getElementById("time-current");
  const timeDuration = document.getElementById("time-duration");
  const volumeSlider = document.getElementById("volume-slider") as HTMLInputElement | null;
  const volumeLabel = document.getElementById("volume-level-label");
  const btnMute = document.getElementById("btn-mute");
  const volumeIcon = document.getElementById("volume-icon");
  const volumeMuteIcon = document.getElementById("volume-mute-icon");

  let durationSecs = 0;
  let isDraggingScrubber = false;
  let lastVolume = 50;
  let isMuted = false;

  const triggerHaptic = (ms: number) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  };

  const updateVolumeIcons = (vol: number) => {
    if (vol <= 0) {
      volumeIcon?.classList.add("hidden");
      volumeMuteIcon?.classList.remove("hidden");
    } else {
      volumeIcon?.classList.remove("hidden");
      volumeMuteIcon?.classList.add("hidden");
    }
  };

  const lyrics = new KaraokeLyrics(lyricsContainer, (timeMs) => {
    // Windows spotify_control seeks in seconds (f64)
    client.sendMediaAction("seek", timeMs / 1000);
  });

  // Track scrubber seeking
  if (scrubber) {
    scrubber.addEventListener("input", () => {
      isDraggingScrubber = true;
      const pct = parseFloat(scrubber.value);
      const targetSecs = (pct / 100) * durationSecs;
      if (timeCurrent) {
        timeCurrent.textContent = formatTime(targetSecs);
      }
    });

    const commitSeek = () => {
      if (!isDraggingScrubber) return;
      const pct = parseFloat(scrubber.value);
      const targetSecs = (pct / 100) * durationSecs;
      triggerHaptic(10);
      client.sendMediaAction("seek", targetSecs);
      setTimeout(() => {
        isDraggingScrubber = false;
      }, 200);
    };

    scrubber.addEventListener("change", commitSeek);
    scrubber.addEventListener("touchend", commitSeek);
    scrubber.addEventListener("pointerup", commitSeek);
  }

  // Volume slider control
  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      const val = parseInt(volumeSlider.value, 10);
      if (volumeLabel) {
        volumeLabel.textContent = `${val}%`;
      }
      updateVolumeIcons(val);
    });

    volumeSlider.addEventListener("change", () => {
      const val = parseInt(volumeSlider.value, 10);
      lastVolume = val > 0 ? val : lastVolume;
      isMuted = val === 0;
      updateVolumeIcons(val);
      client.sendMediaAction("volume", val);
    });
  }

  // Mute button
  if (btnMute && volumeSlider) {
    btnMute.addEventListener("click", () => {
      triggerHaptic(10);
      if (isMuted) {
        const restore = lastVolume > 0 ? lastVolume : 50;
        volumeSlider.value = String(restore);
        if (volumeLabel) volumeLabel.textContent = `${restore}%`;
        client.sendMediaAction("volume", restore);
        isMuted = false;
        updateVolumeIcons(restore);
      } else {
        lastVolume = parseInt(volumeSlider.value, 10) || 50;
        volumeSlider.value = "0";
        if (volumeLabel) volumeLabel.textContent = "0%";
        client.sendMediaAction("volume", 0);
        isMuted = true;
        updateVolumeIcons(0);
      }
    });
  }

  btnPlay.onclick = () => {
    triggerHaptic(15);
    client.sendMediaAction("playPause");
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
    update(media?: MediaState | null) {
      if (!media) {
        titleEl.textContent = "No Track Playing";
        artistEl.textContent = "Connect to Coucou";
        albumArtEl.classList.add("hidden");
        albumArtPlaceholder?.classList.remove("hidden");
        iconPlay?.classList.remove("hidden");
        iconPause?.classList.add("hidden");
        durationSecs = 0;
        if (timeCurrent) timeCurrent.textContent = "0:00";
        if (timeDuration) timeDuration.textContent = "0:00";
        if (scrubber) scrubber.value = "0";
        lyrics.setLyrics([]);
        return;
      }

      titleEl.textContent = media.title || "No Track Playing";
      artistEl.textContent = media.artist || "Connect to Coucou";

      if (media.albumArt) {
        albumArtEl.src = media.albumArt;
        albumArtEl.classList.remove("hidden");
        albumArtPlaceholder?.classList.add("hidden");
      } else {
        albumArtEl.classList.add("hidden");
        albumArtPlaceholder?.classList.remove("hidden");
      }

      if (media.isPlaying) {
        iconPlay?.classList.add("hidden");
        iconPause?.classList.remove("hidden");
      } else {
        iconPlay?.classList.remove("hidden");
        iconPause?.classList.add("hidden");
      }

      durationSecs = (media.durationMs || 0) / 1000;
      const posSecs = (media.positionMs || 0) / 1000;

      if (timeDuration) {
        timeDuration.textContent = formatTime(durationSecs);
      }

      if (!isDraggingScrubber) {
        if (timeCurrent) {
          timeCurrent.textContent = formatTime(posSecs);
        }
        if (scrubber) {
          scrubber.value = durationSecs > 0 ? String(Math.min(100, (posSecs / durationSecs) * 100)) : "0";
        }
      }

      if (media.volume !== undefined && media.volume !== null && volumeSlider) {
        volumeSlider.value = String(media.volume);
        if (volumeLabel) {
          volumeLabel.textContent = `${media.volume}%`;
        }
        updateVolumeIcons(media.volume);
      }

      lyrics.setLyrics(media.lyrics || []);
    },
    tick(posMs: number) {
      lyrics.updateTime(posMs);
      const secs = posMs / 1000;
      if (!isDraggingScrubber && durationSecs > 0) {
        if (timeCurrent) {
          timeCurrent.textContent = formatTime(secs);
        }
        if (scrubber) {
          scrubber.value = String(Math.min(100, (secs / durationSecs) * 100));
        }
      }
    },
  };
}
