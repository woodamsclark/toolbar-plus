import type { Config } from "./model";

// Keep at most one in-flight write and one latest snapshot. Slider changes
// cannot build an unbounded queue of obsolete iCloud writes.
export class SettingsWriter {
  private pending?: Config;
  private writing = false;
  private closed = false;
  private readonly save: (snapshot: Config) => Promise<void>;
  private readonly failed: () => void;
  constructor(save: (snapshot: Config) => Promise<void>, failed: () => void) {
    this.save = save;
    this.failed = failed;
  }
  enqueue(config: Config) {
    if (this.closed) return;
    this.pending = JSON.parse(JSON.stringify(config)) as Config;
    if (!this.writing) void this.flush();
  }
  close() {
    this.closed = true;
    this.pending = undefined;
  }
  private async flush() {
    this.writing = true;
    try {
      while (!this.closed && this.pending) {
        const snapshot = this.pending;
        this.pending = undefined;
        try {
          await this.save(snapshot);
        } catch {
          this.failed();
        }
      }
    } finally {
      this.writing = false;
    }
  }
}
