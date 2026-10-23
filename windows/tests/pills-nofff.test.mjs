import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pillDefinition, sessionSubtitle, MESSAGES_ID } from '../src/core/pills.ts';

test('integration_messages is named NOFFF with iOS Blue color', () => {
  const def = pillDefinition(MESSAGES_ID);
  assert.ok(def, 'pill definition exists');
  assert.equal(def.name, 'NOFFF');
  assert.equal(def.color, '#0A84FF');
  assert.equal(def.subtitle, 'iPhone Connected');
  assert.equal(sessionSubtitle(MESSAGES_ID), 'NOFFF');
});
