import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';

installFakeDom();

import { buildMessagesCard, buildMessagesPill } from '../src/views/messages.ts';

test('buildMessagesPill renders NOFFF and unread status without unicode emojis', () => {
  const pill = buildMessagesPill(() => {});
  pill.sync();
  assert.ok(pill.el.textContent.includes('NOFFF'), 'pill includes NOFFF');
  assert.doesNotMatch(pill.el.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'no unicode emojis');
});

test('buildMessagesCard renders NOFFF header and empty state without unicode emojis', () => {
  const card = buildMessagesCard();
  card.sync();
  assert.ok(card.el.textContent.includes('NOFFF'), 'card header includes NOFFF');
  assert.ok(card.el.textContent.includes('iPhone Connected'), 'card subtitle includes iPhone Connected');
  assert.doesNotMatch(card.el.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'no unicode emojis');
});

test('buildMessagesCard renders Laptop Messages header and empty state', () => {
  const card = buildMessagesCard('laptop');
  card.sync();
  assert.ok(card.el.textContent.includes('Messages'), 'card header includes Messages');
  assert.ok(card.el.textContent.includes('Notifications'), 'card subtitle includes Notifications');
});

test('buildMessagesPill renders Laptop Messages pill', () => {
  const pill = buildMessagesPill('laptop', () => {});
  pill.sync();
  assert.ok(pill.el.textContent.includes('Messages'), 'pill includes Messages');
});
