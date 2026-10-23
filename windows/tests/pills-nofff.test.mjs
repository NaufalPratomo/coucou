import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pillDefinition, sessionSubtitle, MESSAGES_ID, PHONE_ID } from '../src/core/pills.ts';

test('integration_phone is named NOFFF with iOS Blue color', () => {
  const def = pillDefinition(PHONE_ID);
  assert.ok(def, 'phone pill definition exists');
  assert.equal(def.name, 'NOFFF');
  assert.equal(def.color, '#0A84FF');
  assert.equal(def.subtitle, 'iPhone Connected');
  assert.equal(sessionSubtitle(PHONE_ID), 'NOFFF');
});

test('integration_messages is named Messages with Sky Blue color', () => {
  const def = pillDefinition(MESSAGES_ID);
  assert.ok(def, 'messages pill definition exists');
  assert.equal(def.name, 'Messages');
  assert.equal(def.color, '#38BDF8');
  assert.equal(def.subtitle, 'Notifications');
  assert.equal(sessionSubtitle(MESSAGES_ID), 'Messages');
});
