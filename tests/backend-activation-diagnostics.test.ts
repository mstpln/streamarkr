import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendActivationFailureMessage } from '../src/lib/backend-activation-diagnostics.js';
import { BackendRequestError } from '../src/lib/backend-client.js';

test('activation diagnostics distinguish token rejection, cookie retention and migration conflicts', () => {
  assert.equal(
    backendActivationFailureMessage('bootstrap', new BackendRequestError(401, 'unauthorized')),
    'Device access token was rejected. Check the token and try again.'
  );
  assert.equal(
    backendActivationFailureMessage('verify-session', new BackendRequestError(401, 'unauthorized')),
    'The token was accepted, but Chrome did not retain the secure session cookie. Local data is unchanged.'
  );
  assert.equal(
    backendActivationFailureMessage('migration', new BackendRequestError(409, 'migration_conflict')),
    'Secure session works, but Worker/D1 migration was blocked because backend state changed or is not pristine. Local data is unchanged.'
  );
});

test('activation diagnostics do not surface arbitrary backend or network details', () => {
  const secretBearingError = new Error('Bearer super-secret-token');
  assert.equal(
    backendActivationFailureMessage('bootstrap', secretBearingError),
    'Could not create the secure browser session. Local data is unchanged.'
  );
  assert.doesNotMatch(backendActivationFailureMessage('bootstrap', secretBearingError), /super-secret-token/);
});
