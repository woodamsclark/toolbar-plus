import { test } from "node:test";
import assert from "node:assert/strict";
import { SettingsWriter } from "../src/settings-writer.ts";
import { defaults } from "../src/model.ts";

test("rapid changes keep only the latest pending snapshot, never parallel writes", async () => {
  const saves: number[] = [];
  const releases: (() => void)[] = [];
  const writer = new SettingsWriter(
    (snapshot) => {
      saves.push(snapshot.threshold);
      return new Promise<void>((resolve) => releases.push(resolve));
    },
    () => assert.fail("save should succeed"),
  );
  const config = defaults();
  writer.enqueue(config);
  for (let n = 30; n <= 80; n++) {
    config.threshold = n;
    writer.enqueue(config);
  }
  assert.deepEqual(saves, [28]);
  releases.shift()!();
  await Promise.resolve();
  assert.deepEqual(saves, [28, 80]);
  config.threshold = 40;
  releases.shift()!();
  await Promise.resolve();
  assert.deepEqual(saves, [28, 80]);
});

test("a failed save does not prevent the next edit being saved", async () => {
  let failures = 0,
    attempts = 0;
  const writer = new SettingsWriter(
    async () => {
      if (++attempts === 1) throw Error("offline");
    },
    () => {
      failures++;
    },
  );
  writer.enqueue(defaults());
  await Promise.resolve();
  await Promise.resolve();
  writer.enqueue(defaults());
  await Promise.resolve();
  assert.equal(failures, 1);
  assert.equal(attempts, 2);
});

test("closing drops pending and future writes", async () => {
  let release!: () => void;
  const saved: number[] = [];
  const writer = new SettingsWriter(
    async (snapshot) => {
      saved.push(snapshot.holdMs);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    () => {},
  );
  const first = defaults();
  first.holdMs = 400;
  const pending = defaults();
  pending.holdMs = 500;
  const afterClose = defaults();
  afterClose.holdMs = 600;
  writer.enqueue(first);
  writer.enqueue(pending);
  writer.close();
  writer.enqueue(afterClose);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(saved, [400]);
});
