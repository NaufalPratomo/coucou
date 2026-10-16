// Synced Lyrics engine using LRCLIB API and LRC parser

export interface ParsedLyric {
  time: number; // in seconds
  text: string;
}

export function parseLRC(lrcText: string): ParsedLyric[] {
  const lines = lrcText.split("\n");
  const result: ParsedLyric[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let match;
    const timestamps: number[] = [];
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3];
      const ms = parseInt(msStr.length === 2 ? msStr + "0" : msStr, 10);
      timestamps.push(min * 60 + sec + ms / 1000);
    }

    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
    if (text) {
      for (const t of timestamps) {
        result.push({ time: t, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

const lyricsCache = new Map<string, ParsedLyric[] | null>();
const pendingFetches = new Map<string, Promise<ParsedLyric[] | null>>();

function cacheKey(title: string, artist: string): string {
  return `${title.toLowerCase().trim()}:::${artist.toLowerCase().trim()}`;
}

export async function fetchLyrics(title: string, artist: string): Promise<ParsedLyric[] | null> {
  if (!title) return null;
  const key = cacheKey(title, artist);
  if (lyricsCache.has(key)) {
    return lyricsCache.get(key) ?? null;
  }
  if (pendingFetches.has(key)) {
    return pendingFetches.get(key)!;
  }

  const promise = (async () => {
    try {
      // Clean title: remove parentheticals like (Official Audio), feat., etc.
      const cleanTitle = title
        .replace(/\(official.*?\)/gi, "")
        .replace(/\[official.*?\]/gi, "")
        .replace(/\(feat.*?\)/gi, "")
        .replace(/- .*remastered.*/gi, "")
        .trim();

      const cleanArtist = artist.split(/[,&]/)[0].trim();
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;

      const res = await fetch(url);
      if (!res.ok) {
        lyricsCache.set(key, null);
        return null;
      }
      const data = await res.json();
      if (data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        lyricsCache.set(key, parsed);
        return parsed;
      } else if (data.plainLyrics) {
        const plain = data.plainLyrics
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((text: string, i: number) => ({ time: i * 5, text }));
        lyricsCache.set(key, plain);
        return plain;
      }
      lyricsCache.set(key, null);
      return null;
    } catch {
      lyricsCache.set(key, null);
      return null;
    } finally {
      pendingFetches.delete(key);
    }
  })();

  pendingFetches.set(key, promise);
  return promise;
}

export function getActiveLyricIndex(lyrics: ParsedLyric[] | null, currentTime: number): number {
  if (!lyrics || lyrics.length === 0) return -1;
  let active = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

export function getCurrentLyric(lyrics: ParsedLyric[] | null, currentTime: number): string | null {
  const index = getActiveLyricIndex(lyrics, currentTime);
  if (index >= 0 && lyrics && index < lyrics.length) {
    return lyrics[index].text;
  }
  return null;
}
