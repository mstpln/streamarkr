import { BackendRequestError } from './backend-client.js';

export type BackendActivationStage = 'bootstrap' | 'verify-session' | 'migration';

/** Convert backend activation failures into user-facing diagnostics without exposing tokens,
 * response bodies, request details, or other sensitive runtime data. */
export function backendActivationFailureMessage(stage: BackendActivationStage, error: unknown): string {
  if (error instanceof BackendRequestError) {
    if (stage === 'bootstrap' && error.status === 401 && error.code === 'unauthorized') {
      return 'Device access token was rejected. Check the token and try again.';
    }
    if (error.status === 403 && error.code === 'origin_not_allowed') {
      return 'This browser origin was rejected by the Worker. The production origin configuration needs attention.';
    }
    if (stage === 'bootstrap' && error.status === 500 && error.code === 'session_creation_failed') {
      return 'The token was accepted, but the Worker could not create the secure session. Local data is unchanged.';
    }
    if (stage === 'verify-session' && error.status === 401 && error.code === 'unauthorized') {
      return 'The token was accepted, but Chrome did not retain the secure session cookie. Local data is unchanged.';
    }
    if (stage === 'migration' && error.status === 409 && error.code === 'migration_conflict') {
      return 'Secure session works, but Worker/D1 migration was blocked because backend state changed or is not pristine. Local data is unchanged.';
    }
    if (stage === 'migration' && error.status === 400 && error.code === 'invalid_migration_payload') {
      return 'Secure session works, but local data did not pass migration validation. Local data is unchanged.';
    }
  }

  if (stage === 'bootstrap') return 'Could not create the secure browser session. Local data is unchanged.';
  if (stage === 'verify-session') return 'The token exchange completed, but the secure browser session could not be verified. Local data is unchanged.';
  return 'Secure session works, but migration failed. Local data is unchanged; you can safely retry.';
}
