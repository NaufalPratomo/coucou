use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Deserialize)]
struct LrcLibItem {
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

fn sanitize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .to_lowercase()
}

fn find_local_lrc_in_dir(dir: &Path, clean_title: &str, depth: usize) -> Option<String> {
    if depth > 4 {
        return None;
    }
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(content) = find_local_lrc_in_dir(&path, clean_title, depth + 1) {
                return Some(content);
            }
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("lrc"))
            .unwrap_or(false)
        {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                let clean_stem = sanitize(file_stem);
                if clean_stem.contains(clean_title) || clean_title.contains(&clean_stem) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        return Some(content);
                    }
                }
            }
        }
    }
    None
}

fn search_local_lrc(title: &str) -> Option<String> {
    let clean = sanitize(title);
    if clean.is_empty() {
        return None;
    }

    if let Ok(profile) = std::env::var("USERPROFILE") {
        let music = PathBuf::from(profile).join("Music");
        if music.exists() {
            if let Some(content) = find_local_lrc_in_dir(&music, &clean, 0) {
                return Some(content);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn get_lyrics(title: String, artist: String) -> Option<String> {
    // 1. Try local LRC first (instant, works for MusicGit)
    if let Some(local_lrc) = search_local_lrc(&title) {
        return Some(local_lrc);
    }

    // 2. Fetch from LRCLIB (for Spotify, YouTube, Comet, etc.)
    let client = reqwest::Client::builder()
        .user_agent("Coucou/0.6.0 (https://github.com/NaufalPratomo/coucou)")
        .timeout(Duration::from_secs(5))
        .build()
        .ok()?;

    let clean_title = title
        .split('(')
        .next()
        .unwrap_or(&title)
        .split('[')
        .next()
        .unwrap_or(&title)
        .trim();

    let clean_artist = artist
        .split(',')
        .next()
        .unwrap_or(&artist)
        .split('&')
        .next()
        .unwrap_or(&artist)
        .trim();

    // Try exact get first
    let get_resp = client
        .get("https://lrclib.net/api/get")
        .query(&[("track_name", clean_title), ("artist_name", clean_artist)])
        .send()
        .await;

    if let Ok(resp) = get_resp {
        if resp.status().is_success() {
            if let Ok(item) = resp.json::<LrcLibItem>().await {
                if let Some(synced) = item.synced_lyrics {
                    return Some(synced);
                }
                if let Some(plain) = item.plain_lyrics {
                    return Some(plain);
                }
            }
        }
    }

    // Search fallback if exact get not found (e.g. YouTube video titles)
    let query = format!("{} {}", clean_title, clean_artist).trim().to_string();
    let search_resp = client
        .get("https://lrclib.net/api/search")
        .query(&[("q", &query)])
        .send()
        .await;

    if let Ok(resp) = search_resp {
        if resp.status().is_success() {
            if let Ok(items) = resp.json::<Vec<LrcLibItem>>().await {
                for item in items {
                    if let Some(synced) = item.synced_lyrics {
                        return Some(synced);
                    }
                }
            }
        }
    }

    None
}
