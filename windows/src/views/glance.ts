import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { State } from "../core/state";

export interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  icon: keyof typeof ICONS;
}

let cachedWeather: WeatherData | null = null;
let lastWeatherFetch = 0;
const WEATHER_CACHE_MS = 20 * 60 * 1000; // 20 minutes

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

export async function fetchLiveWeather(): Promise<WeatherData | null> {
  const now = Date.now();
  if (cachedWeather && now - lastWeatherFetch < WEATHER_CACHE_MS) {
    return cachedWeather;
  }

  try {
    // 1. Get user city and coordinates via free GeoJS IP API
    const geoRes = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: AbortSignal.timeout(4000) });
    if (!geoRes.ok) throw new Error("Geo fetch failed");
    const geo = await geoRes.json();
    const city = geo.city || geo.region || "Lokal";
    const lat = geo.latitude;
    const lon = geo.longitude;

    // 2. Fetch live weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
    if (!weatherRes.ok) throw new Error("Weather fetch failed");
    const weatherJson = await weatherRes.json();
    const current = weatherJson.current;

    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const { condition, icon } = weatherCodeToCondition(current.weather_code);

    cachedWeather = { city, temp, condition, humidity, icon };
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

  // Slide 1 elements (built once, reused smoothly)
  const weatherRow = h("div", { class: "glance-weather-row" });
  const timeRow = h("div", { class: "glance-time-row" });
  const clockEl = h("span", { class: "glance-clock" });
  const secEl = h("span", { class: "glance-sec" });
  timeRow.append(clockEl, secEl);

  const dateRow = h("div", { class: "glance-date-row" });
  const dateEl = h("span", { class: "glance-date" });
  dateRow.append(dateEl);

  const slide1Card = h("div", { class: "glance-slide slide-glance" }, weatherRow, timeRow, dateRow);

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
    const key = cachedWeather ? `${cachedWeather.city}:${cachedWeather.temp}:${cachedWeather.condition}` : "loading";
    if (key === lastWeatherKey) return;
    lastWeatherKey = key;
    clear(weatherRow);
    if (cachedWeather) {
      const wIcon = svg(ICONS[cachedWeather.icon] || ICONS.cloudSun, 14);
      wIcon.classList.add("weather-svg-icon");
      const cityEl = h("span", { class: "weather-city", text: cachedWeather.city });
      const dotEl1 = h("span", { class: "glance-dot", text: " · " });
      const tempEl = h("span", { class: "weather-temp", text: `${cachedWeather.temp}°C` });
      const dotEl2 = h("span", { class: "glance-dot", text: " · " });
      const condEl = h("span", { class: "weather-cond", text: cachedWeather.condition });
      weatherRow.append(wIcon, cityEl, dotEl1, tempEl, dotEl2, condEl);
    } else {
      const loadIcon = svg(ICONS.cloudSun, 14);
      loadIcon.classList.add("weather-svg-icon");
      weatherRow.append(loadIcon, h("span", { class: "weather-city", text: "Memuat cuaca..." }));
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
