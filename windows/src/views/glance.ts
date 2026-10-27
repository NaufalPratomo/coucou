import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { State } from "../core/state";
import { invoke } from "../core/bridge";

export interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  icon: keyof typeof ICONS;
  isPrecise: boolean;
}

let cachedWeather: WeatherData | null = null;
let lastWeatherFetch = 0;
const WEATHER_CACHE_MS = 20 * 60 * 1000; // 20 minutes

const CUSTOM_CITY_KEY = "coucou_weather_city";
let inMemoryCustomCity: string | null = null;

export function getCustomCity(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(CUSTOM_CITY_KEY) || inMemoryCustomCity;
    }
  } catch (_) {}
  return inMemoryCustomCity;
}

export function setCustomCity(city: string | null) {
  inMemoryCustomCity = city && city.trim() ? city.trim() : null;
  try {
    if (typeof localStorage !== "undefined") {
      if (inMemoryCustomCity) {
        localStorage.setItem(CUSTOM_CITY_KEY, inMemoryCustomCity);
      } else {
        localStorage.removeItem(CUSTOM_CITY_KEY);
      }
    }
  } catch (_) {}
}

function weatherCodeToCondition(code: number): { condition: string; icon: keyof typeof ICONS } {
  if (code === 0) return { condition: "Cerah", icon: "sun" };
  if (code === 1 || code === 2) return { condition: "Cerah Berawan", icon: "cloudSun" };
  if (code === 3) return { condition: "Berawan", icon: "cloud" };
  if (code === 45 || code === 48) return { condition: "Berkabut", icon: "cloud" };
  if (code >= 51 && code <= 55) return { condition: "Gerimis", icon: "cloudRain" };
  if (code >= 61 && code <= 65) return { condition: "Hujan", icon: "cloudRain" };
  if (code >= 80 && code <= 82) return { condition: "Hujan Deras", icon: "cloudRain" };
  if (code >= 95) return { condition: "Badai Petir", icon: "cloudRain" };
  return { condition: "Cerah Berawan", icon: "cloudSun" };
}

async function resolveLocation(): Promise<{ lat: number; lon: number; city: string; isPrecise: boolean }> {
  // 1. Manual custom city if set by user
  const manual = getCustomCity();
  if (manual) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(manual)}&count=1&language=id&format=json`;
      const res = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json.results && json.results.length > 0) {
          const r = json.results[0];
          return { lat: r.latitude, lon: r.longitude, city: r.name || manual, isPrecise: true };
        }
      }
    } catch (_) {}
  }

  // 2. High-precision Windows WinRT Wi-Fi / GPS Geolocation
  try {
    const coords = await invoke<[number, number] | null>("get_device_coordinates").catch(() => null);
    if (coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      const lat = coords[0];
      const lon = coords[1];
      let city = "Pasuruan";
      try {
        const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
        const revRes = await fetch(revUrl, { signal: AbortSignal.timeout(4000) });
        if (revRes.ok) {
          const rev = await revRes.json();
          if (rev.localityInfo?.administrative) {
            const admin = rev.localityInfo.administrative as Array<{ adminLevel?: number; name?: string; description?: string }>;
            const regency = admin.find((a) => a.adminLevel === 5 || (a.description && (a.description.includes("kabupaten") || a.description.includes("kota"))));
            if (regency?.name) {
              city = regency.name;
            } else if (rev.city) {
              city = rev.city;
            }
          } else if (rev.city) {
            city = rev.city;
          }
        }
      } catch (_) {}
      return { lat, lon, city, isPrecise: true };
    }
  } catch (_) {}

  // 3. Browser navigator.geolocation fallback
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { timeout: 3000, enableHighAccuracy: true },
        );
      });
      if (pos?.coords) {
        return { lat: pos.coords.latitude, lon: pos.coords.longitude, city: "Lokal", isPrecise: true };
      }
    } catch (_) {}
  }

  // 4. IP-based fallback (GeoJS)
  const geoRes = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: AbortSignal.timeout(4000) });
  if (!geoRes.ok) throw new Error("Geo fetch failed");
  const geo = await geoRes.json();
  const city = geo.city || geo.region || "Lokal";
  return { lat: geo.latitude, lon: geo.longitude, city, isPrecise: false };
}

export async function fetchLiveWeather(force = false): Promise<WeatherData | null> {
  const now = Date.now();
  if (!force && cachedWeather && now - lastWeatherFetch < WEATHER_CACHE_MS) {
    return cachedWeather;
  }

  try {
    const { lat, lon, city, isPrecise } = await resolveLocation();

    // Fetch live weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
    if (!weatherRes.ok) throw new Error("Weather fetch failed");
    const weatherJson = await weatherRes.json();
    const current = weatherJson.current;

    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const { condition, icon } = weatherCodeToCondition(current.weather_code);

    cachedWeather = { city, temp, condition, humidity, icon, isPrecise };
    lastWeatherFetch = now;
    return cachedWeather;
  } catch (_) {
    if (cachedWeather) return cachedWeather;
    return null;
  }
}

export interface GlanceCardHost {
  el: HTMLElement;
  sync(): void;
  tick(nowMs: number): boolean;
  setSlide(slide: 1 | 2): void;
}

let activeSlide: 1 | 2 = 1;
export function getActiveGlanceSlide(): 1 | 2 {
  return activeSlide;
}

export function setActiveGlanceSlide(slide: 1 | 2) {
  activeSlide = slide;
  State.notify();
}

export function buildGlanceCard(): GlanceCardHost {
  const root = h("div", { class: "glance-root" });
  let calendarMonth = new Date();

  const slideContent = h("div", { class: "glance-content" });
  root.append(slideContent);

  // Weather pre-fetch
  void fetchLiveWeather().then(() => {
    if (activeSlide === 1) updateWeatherUI();
  });

  // Slide 1 elements: Two columns (Left: Time & Date, Right: Location & Weather)
  const timeRow = h("div", { class: "glance-time-row" });
  const clockEl = h("span", { class: "glance-clock" });
  const secEl = h("span", { class: "glance-sec" });
  timeRow.append(clockEl, secEl);

  const dateRow = h("div", { class: "glance-date-row" });
  const dateEl = h("span", { class: "glance-date" });
  dateRow.append(dateEl);

  const timeCol = h("div", { class: "glance-time-col" }, timeRow, dateRow);

  const divider = h("div", { class: "glance-divider" });

  const pinIcon = svg(ICONS.pin, 12);
  pinIcon.classList.add("glance-pin-icon");
  const locNameEl = h("span", { class: "glance-loc-name", text: "Memuat lokasi..." });
  const locBadgeEl = h("span", { class: "glance-loc-badge", text: "GPS" });
  const locRow = h(
    "div",
    {
      class: "glance-loc-row",
      title: "Klik untuk ubah kota / lokasi",
      onclick: () => {
        const cur = getCustomCity() || "";
        const next = typeof window !== "undefined" && window.prompt
          ? window.prompt("Ubah kota cuaca (contoh: Pasuruan, Surabaya, Malang, atau kosongkan untuk GPS otomatis):", cur)
          : null;
        if (next !== null) {
          setCustomCity(next.trim() ? next.trim() : null);
          lastWeatherKey = "";
          cachedWeather = null;
          updateWeatherUI();
          void fetchLiveWeather(true).then(() => updateWeatherUI());
        }
      },
    },
    pinIcon,
    locNameEl,
    locBadgeEl,
  );

  const weatherMain = h("div", { class: "glance-weather-main" });
  const weatherSub = h("div", { class: "glance-weather-sub" });

  const weatherCol = h("div", { class: "glance-weather-col" }, locRow, weatherMain, weatherSub);

  const slide1Card = h("div", { class: "glance-slide slide-glance" }, timeCol, divider, weatherCol);

  let currentRenderedSlide: 1 | 2 | 0 = 0;
  let lastSecond = -1;
  let lastDayNum = -1;
  let lastWeatherKey = "";

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  function updateWeatherUI() {
    const key = cachedWeather
      ? `${cachedWeather.city}:${cachedWeather.temp}:${cachedWeather.condition}:${cachedWeather.humidity}:${cachedWeather.isPrecise}`
      : "loading";
    if (key === lastWeatherKey) return;
    lastWeatherKey = key;
    clear(weatherMain);
    clear(weatherSub);

    if (cachedWeather) {
      locNameEl.textContent = cachedWeather.city;
      locBadgeEl.textContent = getCustomCity() ? "Kustom" : (cachedWeather.isPrecise ? "Presisi" : "IP");
      locBadgeEl.style.display = "";

      const wIcon = svg(ICONS[cachedWeather.icon] || ICONS.cloudSun, 18);
      wIcon.classList.add("glance-weather-icon");
      const tempEl = h("span", { class: "glance-temp", text: `${cachedWeather.temp}°C` });
      const dotEl = h("span", { class: "glance-dot", text: " · " });
      const condEl = h("span", { class: "glance-cond", text: cachedWeather.condition });
      weatherMain.append(wIcon, tempEl, dotEl, condEl);

      const subText = h("span", { class: "glance-sub-text", text: `Kelembapan ${cachedWeather.humidity}%` });
      weatherSub.append(subText);
    } else {
      locNameEl.textContent = getCustomCity() || "Mencari lokasi...";
      locBadgeEl.style.display = "none";
      const loadIcon = svg(ICONS.cloudSun, 16);
      loadIcon.classList.add("glance-weather-icon");
      const loadText = h("span", { class: "glance-cond", text: "Memuat cuaca..." });
      weatherMain.append(loadIcon, loadText);
    }
  }

  function updateClockAndDate(now: Date, force = false) {
    const sec = now.getSeconds();
    if (sec !== lastSecond || force) {
      lastSecond = sec;
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      clockEl.textContent = `${hours}:${minutes}`;
      secEl.textContent = `:${String(sec).padStart(2, "0")}`;
    }

    const dayNum = now.getDate();
    if (dayNum !== lastDayNum || force) {
      lastDayNum = dayNum;
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const yearNum = now.getFullYear();
      dateEl.textContent = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;
    }
  }

  function renderSlide1(now: Date) {
    if (currentRenderedSlide !== 1) {
      clear(slideContent);
      slideContent.append(slide1Card);
      currentRenderedSlide = 1;
      updateWeatherUI();
      updateClockAndDate(now, true);
    } else {
      updateWeatherUI();
      updateClockAndDate(now, false);
    }
  }

  function renderSlide2() {
    clear(slideContent);
    currentRenderedSlide = 2;

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    // Calendar Header: Month Year + [<] [>]
    const titleBtn = h(
      "button",
      {
        class: "cal-month-title",
        title: "Kembali ke Bulan Sekarang",
        onclick: (e: Event) => {
          e.stopPropagation();
          calendarMonth = new Date();
          renderSlide2();
        },
      },
      `${months[month]} ${year}`,
    );

    const prevBtn = h(
      "button",
      {
        class: "cal-nav-btn",
        title: "Bulan Sebelumnya",
        onclick: (e: Event) => {
          e.stopPropagation();
          calendarMonth = new Date(year, month - 1, 1);
          renderSlide2();
        },
      },
      svg(ICONS.chevronLeft, 11),
    );

    const nextBtn = h(
      "button",
      {
        class: "cal-nav-btn",
        title: "Bulan Berikutnya",
        onclick: (e: Event) => {
          e.stopPropagation();
          calendarMonth = new Date(year, month + 1, 1);
          renderSlide2();
        },
      },
      svg(ICONS.chevronRight, 11),
    );

    const calNav = h("div", { class: "cal-nav" }, prevBtn, nextBtn);
    const calHeader = h("div", { class: "cal-header" }, titleBtn, calNav);

    // Weekday column labels (Sun to Sat)
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const gridHeader = h("div", { class: "cal-grid-header" });
    for (const d of dayNames) {
      gridHeader.append(h("span", { class: "cal-day-label", text: d }));
    }

    // Days grid
    const gridDays = h("div", { class: "cal-grid-days" });
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Blank cells before the 1st
    for (let i = 0; i < firstDay; i++) {
      gridDays.append(h("span", { class: "cal-cell empty" }));
    }

    // Days 1..totalDays
    const today = new Date();
    const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= totalDays; day++) {
      const isToday = isThisMonth && today.getDate() === day;
      const cell = h(
        "span",
        {
          class: isToday ? "cal-cell today" : "cal-cell",
          title: `${day} ${months[month]} ${year}${isToday ? " (Hari Ini)" : ""}`,
        },
        String(day),
      );
      gridDays.append(cell);
    }

    const slide2Card = h("div", { class: "glance-slide slide-calendar" }, calHeader, gridHeader, gridDays);
    slideContent.append(slide2Card);
  }

  function render() {
    const now = new Date();
    if (activeSlide === 1) {
      renderSlide1(now);
    } else {
      renderSlide2();
    }
  }

  render();

  return {
    el: root,
    sync() {
      render();
    },
    tick(_nowMs: number): boolean {
      if (activeSlide !== 1) return false;
      const now = new Date();
      updateClockAndDate(now, false);
      return false;
    },
    setSlide(slide: 1 | 2) {
      if (activeSlide !== slide) {
        activeSlide = slide;
        render();
      }
    },
  };
}
