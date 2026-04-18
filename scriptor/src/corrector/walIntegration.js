/**
 * Brique 5 × Brique 2 : toute correction acceptée doit marquer le projet dirty (autosave 5 s, WAL disque).
 */
import { markStorageDirty } from '../storageAdapter.js'

export function notifyCorrectionAccepted() {
  markStorageDirty()
}
