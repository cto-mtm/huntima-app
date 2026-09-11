/**
 * Cloud Functions entry point.
 *
 * Every exported symbol here becomes a deployed function, so keep this file
 * a pure re-export list — anything else runs on every cold start of every
 * function in the codebase.
 */
export { api } from './api'
