import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';

installFakeDom();

import { State } from '../src/core/state.ts';
import { MESSAGES_ID } from '../src/core/pills.ts';
import { buildHeader } from '../src/views/views.ts';

test('island header displays NOFFF tab for MESSAGES_ID without unicode emojis', () => {
  State.tasks = [
    { id: MESSAGES_ID, name: 'NOFFF', color: '#0A84FF', state: 'idle', steps: [] },
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
