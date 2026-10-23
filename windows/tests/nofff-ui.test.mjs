import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';

installFakeDom();

import { State } from '../src/core/state.ts';
import { MESSAGES_ID, PHONE_ID } from '../src/core/pills.ts';
import { buildHeader } from '../src/views/views.ts';

test('island header displays NOFFF tab and Messages tab without unicode emojis', () => {
  State.tasks = [
    { id: PHONE_ID, name: 'NOFFF', color: '#0A84FF', state: 'idle', steps: [] },
    { id: MESSAGES_ID, name: 'Messages', color: '#38BDF8', state: 'idle', steps: [] },
  ];
  const header = buildHeader({
    setView: () => {},
    setFocus: () => {},
    blip: () => {},
  });
  header.sync();
  assert.ok(header.el.childNodes.length > 0, 'header elements exist');
  assert.doesNotMatch(header.el.textContent, /[\u{1F300}-\u{1FAFF}]/u, 'no unicode emojis');
});
