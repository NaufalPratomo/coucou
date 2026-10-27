// SVG paths standing in for the SF Symbols used by the macOS island.
// Drawn on a 24×24 grid so they read at the same optical size.

export const ICONS = {
  // house.fill
  house: "M12 3.2 2.8 10.6V21h6.6v-5.4h5.2V21h6.6V10.6L12 3.2z",
  // bubble.left.fill
  bubble: "M12 3.6c-5 0-9 3.3-9 7.4 0 2.3 1.3 4.4 3.3 5.7-.2 1.2-.8 2.4-1.7 3.4 1.9-.2 3.6-.9 4.9-1.9 .8.2 1.6.3 2.5.3 5 0 9-3.3 9-7.5s-4-7.4-9-7.4z",
  // plus
  plus: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z",
  // gearshape
  gear: "M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm0 1.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM10.9 2h2.2l.35 2.1c.6.17 1.16.4 1.67.71l1.9-1 1.55 1.55-1 1.9c.3.5.54 1.07.7 1.67l2.13.35v2.2l-2.12.35c-.17.6-.4 1.16-.71 1.67l1 1.9-1.55 1.55-1.9-1c-.5.3-1.07.54-1.67.7L13.1 22h-2.2l-.35-2.12c-.6-.17-1.16-.4-1.67-.71l-1.9 1L5.43 18.6l1-1.9c-.3-.5-.54-1.07-.7-1.67L3.6 14.7v-2.2l2.12-.35c.17-.6.4-1.16.71-1.67l-1-1.9 1.55-1.55 1.9 1c.5-.3 1.07-.54 1.67-.7L10.9 2z",
  gearFill: "M10.9 2h2.2l.35 2.1c.6.17 1.16.4 1.67.71l1.9-1 1.55 1.55-1 1.9c.3.5.54 1.07.7 1.67l2.13.35v2.2l-2.12.35c-.17.6-.4 1.16-.71 1.67l1 1.9-1.55 1.55-1.9-1c-.5.3-1.07.54-1.67.7L13.1 22h-2.2l-.35-2.12c-.6-.17-1.16-.4-1.67-.71l-1.9 1L5.43 18.6l1-1.9c-.3-.5-.54-1.07-.7-1.67L3.6 14.7v-2.2l2.12-.35c.17-.6.4-1.16.71-1.67l-1-1.9 1.55-1.55 1.9 1c.5-.3 1.07-.54 1.67-.7L10.9 2zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z",
  // speaker.wave.2
  speakerOn: "M11 4.5 6.5 8.2H3.4v7.6h3.1L11 19.5v-15zm3.2 3a5.3 5.3 0 0 1 0 9 .9.9 0 0 0 .9 1.55 7.1 7.1 0 0 0 0-12.1.9.9 0 0 0-.9 1.55zm2.6-3.1a8.9 8.9 0 0 1 0 15.2.9.9 0 0 0 .92 1.55 10.7 10.7 0 0 0 0-18.3.9.9 0 0 0-.92 1.55z",
  // speaker.slash
  speakerOff: "M11 4.5 6.5 8.2H3.4v7.6h3.1L11 19.5v-15zm3.6 4.1 1.27-1.27 2.33 2.33 2.33-2.33 1.27 1.27L19.47 11l2.33 2.33-1.27 1.27-2.33-2.33-2.33 2.33-1.27-1.27L16.93 11 14.6 8.6z",
  // arrow.up.right
  arrowUpRight: "M8.5 7h8.5v8.5h-2V10.4l-7.1 7.1-1.4-1.4 7.1-7.1H8.5V7z",
  // arrow.clockwise (stroke)
  arrowClockwise: "M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5",
  // chevron.right
  chevronRight: "M9 5.5 15.5 12 9 18.5",
  chevronLeft: "M15 5.5 8.5 12 15 18.5",
  // chevron.up
  chevronUp: "M5.5 15 12 8.5 18.5 15",
  // checkmark
  check: "M5 12.5 9.5 17 19 7.5",
  // arrow.up (send)
  arrowUp: "M12 4.5 5.5 11l1.5 1.5 4-4V19.5h2V8.5l4 4L18.5 11 12 4.5z",
  // exclamationmark
  bang: "M11 4h2v10h-2V4zm0 12.2h2v2.2h-2v-2.2z",
  // xmark
  xmark: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5z",
  // timer
  timer: "M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6zm0 1.9a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8zm-.95 2.3v4.2l3.3 2 .95-1.55-2.4-1.45V8.4h-1.85zM9.2 2h5.6v1.7H9.2V2z",
  // ellipsis
  ellipsis: "M6 10.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm6 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm6 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z",
  // star.fill
  star: "M12 3.2l2.6 5.55 5.9.82-4.3 4.3 1.05 6.13L12 17.1l-5.25 2.9L7.8 13.87 3.5 9.57l5.9-.82L12 3.2z",
  // square.stack.fill
  stack: "M5 8h14v11.5H5V8zm1.8-3h10.4v1.6H6.8V5zm1.6-2.6h7.2V4H8.4V2.4z",
  // doc.on.doc (copy)
  copy: "M9 3.5h8.5L21 7v10.5H9v-14zm1.8 1.8v10.4h8.4V7.8l-2.5-2.5h-5.9zM3 7.5h4.2v1.8H4.8v10.4h8.4v-2.2H15v4H3v-14z",
  // chevron.up.chevron.down
  chevronUpDown: "M8 9.5 12 5.5l4 4M8 14.5l4 4 4-4",
  // arrow.triangle.pull (stroked)
  pull: "M6 3a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 6 3zM6 7.4v9.2M6 16.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM18 16.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM18 16.6V9a3 3 0 0 0-3-3h-4.5M13 3.5 10.5 6 13 8.5",
  // eye (stroked)
  eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  // iphone (device)
  iphone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  // bell (notifications)
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9zm-4.27 13a2 2 0 0 1-3.46 0",
  // checkmark.seal.fill (even-odd)
  seal: "M12 1.8 14.23 3.69 17.1 3.17 18.08 5.92 20.83 6.9 20.31 9.77 22.2 12 20.31 14.23 20.83 17.1 18.08 18.08 17.1 20.83 14.23 20.31 12 22.2 9.77 20.31 6.9 20.83 5.92 18.08 3.17 17.1 3.69 14.23 1.8 12 3.69 9.77 3.17 6.9 5.92 5.92 6.9 3.17 9.77 3.69zM7.4 12.3 8.8 10.9 10.7 12.8 15.2 8.3 16.6 9.7 10.7 15.6z",
  // xmark.octagon.fill (even-odd)
  octagonX: "M21.61 15.98 15.98 21.61 8.02 21.61 2.39 15.98 2.39 8.02 8.02 2.39 15.98 2.39 21.61 8.02zM8.53 7.66 12 11.13 15.47 7.66 16.34 8.53 12.87 12 16.34 15.47 15.47 16.34 12 12.87 8.53 16.34 7.66 15.47 11.13 12 7.66 8.53z",
  // doc.text
  doc: "M6.5 2.6h7l4 4v14.8h-11V2.6zm6.6 1.6v3.3h3.3l-3.3-3.3zM8.6 11h6.8v1.5H8.6V11zm0 3.4h6.8v1.5H8.6v-1.5z",
  // ── Now playing (the Spotify pill and card) ──
  // play.fill
  play: "M7 4.6c0-.8.9-1.3 1.6-.9l11 6.9c.6.4.6 1.4 0 1.8l-11 6.9c-.7.4-1.6-.1-1.6-.9V4.6z",
  // pause.fill
  pause: "M6 4.5h4v15H6zM14 4.5h4v15h-4z",
  // forward.fill
  forward: "M2.5 6.2c0-.7.8-1.1 1.4-.7l7.6 5.8c.5.4.5 1 0 1.4l-7.6 5.8c-.6.4-1.4 0-1.4-.7V6.2zm10 0c0-.7.8-1.1 1.4-.7l7.6 5.8c.5.4.5 1 0 1.4l-7.6 5.8c-.6.4-1.4 0-1.4-.7V6.2z",
  // backward.fill
  backward: "M21.5 6.2c0-.7-.8-1.1-1.4-.7l-7.6 5.8c-.5.4-.5 1 0 1.4l7.6 5.8c.6.4 1.4 0 1.4-.7V6.2zm-10 0c0-.7-.8-1.1-1.4-.7l-7.6 5.8c-.5.4-.5 1 0 1.4l7.6 5.8c.6.4 1.4 0 1.4-.7V6.2z",
  // shuffle (stroked)
  shuffle: "M3 7h3.2c1.9 0 3.1.9 4.1 2.5l3.4 5c1 1.6 2.2 2.5 4.1 2.5H21M3 17h3.2c1.6 0 2.7-.6 3.6-1.8M14.2 8.8C15.1 7.6 16.2 7 17.8 7H21M18.6 4.6 21 7l-2.4 2.4M18.6 14.6 21 17l-2.4 2.4",
  // repeat (stroked)
  repeat: "M4 11.5V10a3 3 0 0 1 3-3h13.5M17.6 4.1 20.5 7l-2.9 2.9M20 12.5V14a3 3 0 0 1-3 3H3.5M6.4 19.9 3.5 17l2.9-2.9",
  // music.note
  musicNote: "M12.2 3.6h1.7c.3 2.3 1.8 3.5 4.2 4.6l-.6 1.6c-1.4-.5-2.7-1.2-3.6-2.1v9.5a3.3 3.3 0 1 1-1.7-2.88V3.6z",
  // speaker.slash.fill / speaker.wave.1-3.fill (stroked, the body outlined round)
  volume0: "M3.5 9.5h3L11 5.8v12.4l-4.5-3.7h-3zM15 9.5l5 5M20 9.5l-5 5",
  volume1: "M3.5 9.5h3L11 5.8v12.4l-4.5-3.7h-3zM14.5 9.6a3.4 3.4 0 0 1 0 4.8",
  volume2: "M3.5 9.5h3L11 5.8v12.4l-4.5-3.7h-3zM14.5 9.6a3.4 3.4 0 0 1 0 4.8M17 7.2a6.8 6.8 0 0 1 0 9.6",
  volume3: "M3.5 9.5h3L11 5.8v12.4l-4.5-3.7h-3zM14.5 9.6a3.4 3.4 0 0 1 0 4.8M17 7.2a6.8 6.8 0 0 1 0 9.6M19.4 4.8a10.2 10.2 0 0 1 0 14.4",
  // qrcode
  qrcode: "M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v3h-3v-3zm0 5h3v3h-3v-3zm-5-5h3v3h-3v-3zm0 5h3v3h-3v-3z",
  // calendar
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z",
  // clock
  clock: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z",
  // sun
  sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
  // cloud
  cloud: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
  // cloud.sun
  cloudSun: "M8.25 11.25A4.5 4.5 0 0 1 12 6.75a4.5 4.5 0 0 1 4.5 4.5c.28 0 .55.03.82.09A5.25 5.25 0 0 1 21 16.5a5.25 5.25 0 0 1-5.25 5.25H6.75A4.75 4.75 0 0 1 2 17a4.75 4.75 0 0 1 4.25-4.72c.57-.63 1.25-1.12 2-1.03z",
  // cloud.rain
  cloudRain: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM8 21.5 6.5 23.5M12 21.5 10.5 23.5M16 21.5 14.5 23.5",
  // map pin
  pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
} as const;


export function getBatteryColor(level: number, connected: boolean): string {
  if (!connected) return "#64748B";
  if (level > 40) return "#22C55E";
  if (level > 20) return "#F59E0B";
  return "#EF4444";
}

export function getBatteryFillWidth(level: number): number {
  const clamped = Math.max(0, Math.min(100, level));
  return Math.max(1, Math.min(10, Math.round((clamped / 100) * 10)));
}

export function batteryIcon(level: number, connected: boolean, size = 16): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("width", `${size}`);
  el.setAttribute("height", `${size}`);
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "currentColor");
  el.setAttribute("stroke-width", "1.5");
  el.classList.add("battery-svg");

  const color = getBatteryColor(level, connected);
  const fillWidth = getBatteryFillWidth(level);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "2");
  rect.setAttribute("y", "7");
  rect.setAttribute("width", "16");
  rect.setAttribute("height", "10");
  rect.setAttribute("rx", "2.5");
  rect.setAttribute("stroke", "currentColor");
  rect.setAttribute("stroke-width", "1.5");
  rect.setAttribute("fill", "none");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 10v4");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");

  const fill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  fill.setAttribute("x", "4");
  fill.setAttribute("y", "9");
  fill.setAttribute("width", `${fillWidth}`);
  fill.setAttribute("height", "6");
  fill.setAttribute("rx", "1");
  fill.setAttribute("fill", color);
  fill.setAttribute("stroke", "none");

  el.append(rect, path, fill);
  return el;
}
