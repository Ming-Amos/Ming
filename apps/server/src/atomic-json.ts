import fs from "node:fs";
import { randomUUID } from "node:crypto";

const transientRenameErrors = new Set(["EPERM", "EACCES", "EBUSY"]);
const retryDelaysMs = [20, 40, 80, 160, 200, 250, 300, 400];
const retryWait = new Int32Array(new SharedArrayBuffer(4));

/** Replace a complete JSON record without exposing a truncated destination.
 * Windows scanners/readers can briefly deny rename. Keep the existing record
 * intact while retrying for at most 1,450 ms; permanent failures still surface.
 */
export function writeJsonAtomicSync(filename: string, value: unknown): void {
  const serialized = JSON.stringify(value, null, 2);
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let created = false;
  try {
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    created = true;
    try { fs.writeFileSync(descriptor, serialized, "utf8"); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
    for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(temporary, filename); return; }
      catch (error) {
        if (!transientRenameErrors.has((error as NodeJS.ErrnoException).code ?? "") || attempt >= retryDelaysMs.length) throw error;
        // The surrounding file store is synchronous. Waiting here preserves
        // write order while the external process releases its Windows handle.
        Atomics.wait(retryWait, 0, 0, retryDelaysMs[attempt]);
      }
    }
  } finally {
    // Never remove or overwrite the old destination to get around a lock.
    if (created) { try { fs.unlinkSync(temporary); } catch { /* Renamed, or still externally locked. */ } }
  }
}
