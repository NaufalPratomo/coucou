import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';

installFakeDom();

import { State } from '../src/core/state.ts';
import { PHONE_ID, MESSAGES_ID } from '../src/core/pills.ts';
import { buildMessagesCard, buildMessagesPill } from '../src/views/messages.ts';
import { buildHeader } from '../src/views/views.ts';
import { handlePhoneBatteryUpdate } from '../src/core/battery.ts';
import {
  phoneNotificationHistory,
  activeNotifBanner,
  dismissNotificationBanner,
  isPhoneNotification,
} from '../src/core/notifications.ts';
import { createMiniBot, syncMiniBotStates } from '../src/mochi/minibots.ts';

test('1. Real-time battery percentage and SVG vector icon in pill and header', () => {
  State.phoneBattery = {
    deviceId: 'iPhone-15-Pro',
    level: 88,
    connected: true,
  };

  const pill = buildMessagesPill('phone', () => {});
  pill.sync();
  assert.ok(pill.el.textContent.includes('NOFFF'), 'pill includes NOFFF');
  assert.ok(pill.el.textContent.includes('88%'), 'pill includes 88%');
  assert.doesNotMatch(pill.el.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'zero unicode emojis in pill');

  // Verify header tab when focused
  State.tasks = [
    { id: PHONE_ID, name: 'NOFFF', color: '#0A84FF', state: 'idle', steps: [] },
  ];
  State.focusId = PHONE_ID;
  State.view = 'overview';

  const header = buildHeader({
    setView: () => {},
    setFocus: () => {},
    blip: () => {},
    toggleSound: () => {},
    cancelDrop: () => {},
    collapse: () => {},
    foldApproval: () => {},
    openTerminal: () => {},
    openTarget: () => {},
    openUrl: () => {},
    decide: () => {},
    answer: () => {},
    answerInTerminal: () => {},
    setVolume: () => {},
    setAutoClose: () => {},
    openSettingsWindow: () => {},
    chooseOutfit: () => {},
    previewOutfit: () => {},
  });
  header.sync();
  assert.ok(header.el.textContent.includes('NOFFF'), 'header has NOFFF');
  assert.ok(header.el.textContent.includes('88%'), 'header displays 88%');
  assert.doesNotMatch(header.el.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'zero unicode emojis in header');
});

test('2. Proximity and live connection status indicator in card and pill', () => {
  // Connected state
  State.phoneBattery = {
    deviceId: 'iPhone-15-Pro',
    level: 95,
    connected: true,
  };
  const cardConnected = buildMessagesCard('phone');
  cardConnected.sync();
  assert.ok(cardConnected.el.textContent.includes('iPhone Connected'), 'card shows iPhone Connected');
  assert.ok(cardConnected.el.textContent.includes('95%'), 'card shows 95%');

  // Disconnected / out of range state
  State.phoneBattery = {
    deviceId: 'iPhone-15-Pro',
    level: 95,
    connected: false,
  };
  const cardDisconnected = buildMessagesCard('phone');
  cardDisconnected.sync();
  assert.ok(cardDisconnected.el.textContent.includes('Disconnected'), 'card shows Disconnected when out of range');

  const pillDisconnected = buildMessagesPill('phone', () => {});
  pillDisconnected.sync();
  assert.ok(pillDisconnected.el.textContent.includes('Disconnected'), 'pill shows Disconnected when out of range');
});

test('3. App category filtering in NOFFF overview card', () => {
  phoneNotificationHistory.length = 0;
  phoneNotificationHistory.push(
    { id: 1, appName: 'Phone Link', title: 'WhatsApp: Alice', body: 'Hey there!', timestampMs: Date.now() },
    { id: 2, appName: 'Phone Link', title: 'Tokopedia: Promo', body: 'Flash sale now!', timestampMs: Date.now() },
    { id: 3, appName: 'Phone Link', title: 'Gmail: Work', body: 'Meeting at 2pm', timestampMs: Date.now() },
  );

  const card = buildMessagesCard('phone');
  card.sync();

  // Check category chips exist
  const chips = card.el.find('.nofff-cat-chip');
  assert.ok(chips.length >= 4, 'at least 4 category chips (All, Chat, Shop, Mail)');

  const allChip = chips.find((c) => c.textContent.includes('All'));
  const chatChip = chips.find((c) => c.textContent.includes('Chat'));
  const shopChip = chips.find((c) => c.textContent.includes('Shop'));
  const mailChip = chips.find((c) => c.textContent.includes('Mail'));

  assert.ok(allChip, 'All chip exists');
  assert.ok(chatChip, 'Chat chip exists');
  assert.ok(shopChip, 'Shop chip exists');
  assert.ok(mailChip, 'Mail chip exists');

  // Initially All shows all 3
  assert.ok(card.el.textContent.includes('Alice'));
  assert.ok(card.el.textContent.includes('Promo'));
  assert.ok(card.el.textContent.includes('Work'));

  // Click Chat chip
  chatChip.fire('click');
  assert.ok(card.el.textContent.includes('Alice'), 'Chat filter shows WhatsApp');
  assert.ok(!card.el.textContent.includes('Promo'), 'Chat filter hides Tokopedia');
  assert.ok(!card.el.textContent.includes('Work'), 'Chat filter hides Gmail');

  // Click Shop chip
  shopChip.fire('click');
  assert.ok(card.el.textContent.includes('Promo'), 'Shop filter shows Tokopedia');
  assert.ok(!card.el.textContent.includes('Alice'), 'Shop filter hides WhatsApp');

  // Click Mail chip
  mailChip.fire('click');
  assert.ok(card.el.textContent.includes('Work'), 'Mail filter shows Gmail');
  assert.ok(!card.el.textContent.includes('Promo'), 'Mail filter hides Tokopedia');

  // Reset
  phoneNotificationHistory.length = 0;
});

test('4. Low battery warning triggers worried emote and island alert banner', () => {
  dismissNotificationBanner();
  State.tasks = [
    {
      id: 'integration_phone',
      name: 'NOFFF',
      color: '#0A84FF',
      state: 'idle',
      emote: null,
      stepIndex: 0,
      steps: [],
      source: 'service',
      isIntegration: true,
    },
  ];

  // Battery drops to 14%
  handlePhoneBatteryUpdate({
    device_id: 'iPhone-15-Pro',
    level: 14,
    connected: true,
  });

  const phoneTask = State.tasks.find((t) => t.id === 'integration_phone');
  assert.equal(phoneTask?.emote, 'worried', 'Mochi emote set to worried');
  assert.equal(phoneTask?.pillBadge, 'approval', 'Pill badge set to alert');
  assert.ok(activeNotifBanner != null, 'Subtle island alert banner triggered');
  assert.equal(activeNotifBanner?.title, 'Low Battery');
  assert.ok(activeNotifBanner?.body.includes('14%'), 'Banner body mentions 14%');

  // Battery charges to 60%
  handlePhoneBatteryUpdate({
    device_id: 'iPhone-15-Pro',
    level: 60,
    connected: true,
  });

  assert.equal(phoneTask?.emote, 'idle', 'Emote restored to idle once charged');
  assert.equal(phoneTask?.pillBadge, null, 'Pill badge cleared once charged');
  dismissNotificationBanner();
});

test('5. Coucou Web Companion pairing action in NOFFF card', () => {
  const card = buildMessagesCard('phone');
  card.sync();

  const pairBtn = card.el.querySelector('.nofff-pair-btn');
  assert.ok(pairBtn, 'Pair iPhone Companion button exists');
  assert.ok(pairBtn.textContent.includes('Pair iPhone Companion'), 'Button has correct label');
  assert.doesNotMatch(pairBtn.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'no unicode emojis in pair button');

  // Clicking pair button opens pairing modal
  pairBtn.fire('click');
  card.sync();

  const modal = card.el.querySelector('.nofff-qr-modal');
  assert.ok(modal, 'QR pairing modal opened');
  assert.ok(modal.textContent.includes('Pair iPhone Companion'), 'Modal title present');
  assert.doesNotMatch(modal.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'no unicode emojis in modal');

  // Close modal via close button
  const closeBtn = modal.querySelector('.nofff-qr-close');
  assert.ok(closeBtn, 'Close button exists');
  closeBtn.fire('click');
  card.sync();

  assert.equal(card.el.querySelector('.nofff-qr-modal'), null, 'Modal dismissed');
});

test('6. Disconnecting phone resets worried emote and clears badge', () => {
  State.tasks = [
    {
      id: 'integration_phone',
      name: 'NOFFF',
      color: '#0A84FF',
      state: 'idle',
      emote: null,
      stepIndex: 0,
      steps: [],
      source: 'service',
      isIntegration: true,
    },
  ];

  // Connected with low battery
  handlePhoneBatteryUpdate({
    device_id: 'iPhone-15-Pro',
    level: 10,
    connected: true,
  });
  const phoneTask = State.tasks.find((t) => t.id === 'integration_phone');
  assert.equal(phoneTask?.emote, 'worried');
  assert.equal(phoneTask?.pillBadge, 'approval');

  // Disconnected (e.g. out of range)
  handlePhoneBatteryUpdate({
    device_id: 'iPhone-15-Pro',
    level: 10,
    connected: false,
  });
  assert.equal(phoneTask?.emote, 'idle', 'Emote restored to idle when disconnected');
  assert.equal(phoneTask?.pillBadge, null, 'Pill badge cleared when disconnected');
});

test('7. Clearing notifications preserves low battery worried emote when battery is low', () => {
  State.phoneBattery = {
    deviceId: 'iPhone-15-Pro',
    level: 15,
    connected: true,
  };
  State.tasks = [
    {
      id: 'integration_phone',
      name: 'NOFFF',
      color: '#0A84FF',
      state: 'idle',
      emote: 'worried',
      pillBadge: 'approval',
      stepIndex: 0,
      steps: [],
      source: 'service',
      isIntegration: true,
    },
  ];

  phoneNotificationHistory.length = 0;
  phoneNotificationHistory.push({
    id: 99,
    appName: 'NOFFF',
    title: 'Test',
    body: 'Sample notification',
    timestampMs: Date.now(),
  });

  const card = buildMessagesCard('phone');
  card.sync();

  const clearBtn = card.el.querySelector('.msg-clear-all-btn');
  assert.ok(clearBtn);
  clearBtn.fire('click');

  const phoneTask = State.tasks.find((t) => t.id === 'integration_phone');
  assert.equal(phoneTask?.emote, 'worried', 'Worried emote preserved after clearing notifications while battery <= 20');
  assert.equal(phoneTask?.pillBadge, 'approval', 'Approval badge preserved after clearing notifications while battery <= 20');

  phoneNotificationHistory.length = 0;
});

test('8. Initial phone state without battery defaults to iPhone Connected', () => {
  State.phoneBattery = null;
  const card = buildMessagesCard('phone');
  card.sync();
  assert.ok(card.el.textContent.includes('iPhone Connected'), 'Card defaults to iPhone Connected when battery is null');

  const pill = buildMessagesPill('phone', () => {});
  pill.sync();
  assert.ok(pill.el.textContent.includes('NOFFF'), 'Pill defaults to NOFFF when battery is null');
  assert.ok(pill.el.textContent.includes('Connected'), 'Pill defaults to Connected when battery is null');
});

test('9. Mini bots receive emote updates via syncMiniBotStates', () => {
  const task = {
    id: 'integration_phone',
    name: 'NOFFF',
    color: '#0A84FF',
    state: 'idle',
    emote: 'idle',
    stepIndex: 0,
    steps: [],
    source: 'service',
    isIntegration: true,
  };

  createMiniBot(task, 16);
  task.emote = 'worried';
  syncMiniBotStates([task]);
  assert.equal(task.emote, 'worried');
});

test('10. isPhoneNotification matches NOFFF', () => {
  assert.equal(isPhoneNotification('NOFFF'), true);
  assert.equal(isPhoneNotification('Phone Link'), true);
  assert.equal(isPhoneNotification('Telepon'), true);
  assert.equal(isPhoneNotification('Link to Windows'), true);
  assert.equal(isPhoneNotification('Chrome'), false);
});

test('11. Modal dismisses on backdrop click', () => {
  const card = buildMessagesCard('phone');
  card.sync();

  const pairBtn = card.el.querySelector('.nofff-pair-btn');
  pairBtn.fire('click');
  card.sync();

  const modal = card.el.querySelector('.nofff-qr-modal');
  assert.ok(modal);

  // Click on modal backdrop itself
  modal.fire('click');
  card.sync();

  assert.equal(card.el.querySelector('.nofff-qr-modal'), null, 'Modal dismissed on backdrop click');
});

test('12. Antislop compact layout & styling prevents Mochi and mini bot overlap', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  // Verify notif-banner has clearance on left (clearing Mochi) and right (clearing mini bots)
  assert.match(css, /\.notif-banner\s*\{[^}]*left:\s*62px;/s, 'notif-banner clears Mochi at left: 62px');
  assert.match(css, /\.notif-banner\s*\{[^}]*right:\s*64px;/s, 'notif-banner clears mini bots at right: 64px');

  // Verify compact-lyrics has clearance on left and right
  assert.match(css, /\.compact-lyrics\s*\{[^}]*left:\s*62px;/s, 'compact-lyrics clears Mochi at left: 62px');
  assert.match(css, /\.compact-lyrics\s*\{[^}]*right:\s*64px;/s, 'compact-lyrics clears mini bots at right: 64px');

  // Verify refined active lyric line
  assert.match(css, /\.lyric-line\.active\s*\{[^}]*font-size:\s*12\.5px;/s, 'active lyric has refined 12.5px font');
});

test('13. Compact island target width expands for notifications and lyrics', async () => {
  const fs = await import('node:fs');
  const islandCode = fs.readFileSync(new URL('../src/island/island.ts', import.meta.url), 'utf8');

  // Notification target width expands smoothly between 460 and 540px
  assert.ok(islandCode.includes('w = Math.min(540, Math.max(460,'), 'notif banner dynamically expands to 460-540px');

  // Lyrics target width expands smoothly between 440 and 540px
  assert.ok(islandCode.includes('w = Math.min(540, Math.max(440,'), 'compact lyrics dynamically expands to 440-540px');
});

test('14. Lyric lines render clean single text without duplicate word repetitions', async () => {
  const fs = await import('node:fs');
  const spotifyCode = fs.readFileSync(new URL('../src/views/spotify.ts', import.meta.url), 'utf8');

  // Verify lineEl does not duplicate text via attrs.text and children
  assert.doesNotMatch(
    spotifyCode,
    /class:\s*"lyric-line",\s*text:\s*line\.text/s,
    'lyric-line does not pass duplicate text in attributes',
  );
});

test('15. Daily Glance (Slide 1: Time, Date & Weather) renders in overview', async () => {
  const { buildGlanceCard, setActiveGlanceSlide, getActiveGlanceSlide } = await import('../src/views/glance.ts');
  const glance = buildGlanceCard();
  glance.setSlide(1);
  assert.equal(getActiveGlanceSlide(), 1);
  assert.ok(glance.el.querySelector('.glance-time-col'), 'Time column is rendered');
  assert.ok(glance.el.querySelector('.glance-clock'), 'Digital clock is rendered');
  assert.ok(glance.el.querySelector('.glance-date'), 'Date is rendered');
  assert.ok(glance.el.querySelector('.glance-weather-col'), 'Weather column is rendered');
  assert.ok(glance.el.querySelector('.glance-loc-row'), 'Location row is rendered');
});

test('16. Mini Monthly Calendar (Slide 2) renders monthly grid with today highlighted', async () => {
  const { buildGlanceCard, getActiveGlanceSlide } = await import('../src/views/glance.ts');
  const glance = buildGlanceCard();
  glance.setSlide(2);
  assert.equal(getActiveGlanceSlide(), 2);
  assert.ok(glance.el.querySelector('.slide-calendar'), 'Calendar slide is rendered');
  assert.ok(glance.el.querySelector('.cal-month-title'), 'Month & year title exists');
  assert.ok(glance.el.querySelector('.cal-cell.today'), 'Today cell is highlighted');
});

test('17. Clicking Time / Calendar tabs switches focus to GLANCE_ID and CALENDAR_ID properly', async () => {
  const { State } = await import('../src/core/state.ts');
  const { GLANCE_ID, CALENDAR_ID } = await import('../src/core/pills.ts');

  // Set focus to GLANCE_ID
  State.setFocus(GLANCE_ID);
  assert.equal(State.focusId, GLANCE_ID);
  assert.equal(State.focusTask, null, 'focusTask returns null for virtual glance so overview renders glanceCard');

  // Set focus to CALENDAR_ID
  State.setFocus(CALENDAR_ID);
  assert.equal(State.focusId, CALENDAR_ID);
  assert.equal(State.focusTask, null, 'focusTask returns null for virtual calendar so overview renders glanceCard');

  // Load integrations does not overwrite GLANCE_ID or CALENDAR_ID
  State.loadIntegrationTasks();
  assert.equal(State.focusId, CALENDAR_ID);
});

test('18. Spotify expanded island is 690px and lyrics column has wrapping without ellipsis', async () => {
  const fs = await import('node:fs');
  const islandCode = fs.readFileSync(new URL('../src/island/island.ts', import.meta.url), 'utf8');
  const styleCss = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  // Expanded Spotify width is 690px
  assert.ok(islandCode.includes('w = 690;'), 'expanded island width for Spotify is 690px');

  // Lyric lines wrap gracefully without ellipsis
  assert.match(styleCss, /\.lyric-line\s*\{[^}]*white-space:\s*normal;/s, 'lyric line wraps with white-space: normal');
  assert.match(styleCss, /\.lyric-line\s*\{[^}]*word-break:\s*break-word;/s, 'lyric line breaks words gracefully');
  assert.doesNotMatch(styleCss, /\.lyric-line\s*\{[^}]*text-overflow:\s*ellipsis;/s, 'lyric line does not truncate with ellipsis');

  // Glance card padding leaves room for Mochi bot
  assert.match(styleCss, /\.glance-root\s*\{[^}]*padding:\s*10px\s+20px\s+12px\s+114px;/s, 'glance-root clears Mochi bot');
});

test('19. Glance and Calendar expanded island dimensions and weather CSP', async () => {
  const fs = await import('node:fs');
  const islandCode = fs.readFileSync(new URL('../src/island/island.ts', import.meta.url), 'utf8');
  const styleCss = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const tauriConf = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const { getCustomCity, setCustomCity } = await import('../src/views/glance.ts');

  // Glance and Calendar target size is 680x250
  assert.ok(islandCode.includes('w = 680;'), 'expanded island width for glance/calendar is 680px');
  assert.ok(islandCode.includes('h = 250;'), 'expanded island height for glance/calendar is 250px');

  // Side-by-side two-column flex layout
  assert.match(styleCss, /\.slide-glance\s*\{[^}]*flex-direction:\s*row;/s, 'slide-glance is row side-by-side');

  // Custom city getter and setter
  setCustomCity('Pasuruan');
  assert.equal(getCustomCity(), 'Pasuruan');
  setCustomCity(null);

  // CSP connect-src contains open-meteo, geojs, bigdatacloud
  const csp = tauriConf.app.security.csp;
  assert.ok(csp.includes('https://get.geojs.io'), 'CSP allows geojs');
  assert.ok(csp.includes('https://api.open-meteo.com'), 'CSP allows open-meteo');
  assert.ok(csp.includes('https://api.bigdatacloud.net'), 'CSP allows bigdatacloud');
  assert.ok(csp.includes('https://geocoding-api.open-meteo.com'), 'CSP allows open-meteo geocoding');
});
