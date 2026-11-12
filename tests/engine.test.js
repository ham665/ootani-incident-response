import test from "node:test";
import assert from "node:assert/strict";
import { newGame, advance, applyCommand, view, SCENARIO } from "../src/engine.js";

const start = 1_000_000;
test("one incident is created and orders remain conserved", () => {
  const state = newGame("easy", start);
  advance(state, start + 25_000);
  assert.equal(state.incident.phase, "alerting");
  const screen = view(state, start + 25_000);
  assert.equal(screen.orders.arrived, screen.orders.completed + screen.orders.pending);
});

test("choice starts mitigation and recovery only happens once", () => {
  const state = newGame("easy", start);
  advance(state, start + 21_000);
  applyCommand(state, "ack", start + 21_000);
  applyCommand(state, "investigate", start + 21_000);
  advance(state, start + 30_000);
  applyCommand(state, "quick", start + 30_000);
  advance(state, start + 39_000);
  assert.equal(state.incident.phase, "resolved");
  assert.equal(state.events.filter((event) => event.type === "service_recovered").length, 1);
});

test("paused game time does not advance", () => {
  const state = newGame("easy", start);
  applyCommand(state, "pause", start + 10_000);
  advance(state, start + 110_000);
  assert.equal(view(state, start + 110_000).elapsedSeconds, 10);
  applyCommand(state, "resume", start + 110_000);
  advance(state, start + 111_000);
  assert.equal(view(state, start + 111_000).elapsedSeconds, 11);
});

test("responder proposals describe the Redis incident and their effects", () => {
  assert.match(SCENARIO.diagnosis, /Redisキャッシュ.*メモリ/);
  assert.match(SCENARIO.options.quick.label, /Redisコンテナ.*再起動/);
  assert.match(SCENARIO.options.quick.caution, /原因は残/);
  assert.match(SCENARIO.options.permanent.description, /maxmemory-policy/);
  assert.ok(SCENARIO.options.quick.seconds < SCENARIO.options.permanent.seconds);
});

test("technical and business reports have different content and persist the selected recipients", () => {
  const state = newGame("easy", start);
  advance(state, start + 21_000);
  const snapshot = view(state, start + 21_000);
  assert.match(snapshot.reportTemplates.technical, /原因は調査中/);
  assert.doesNotMatch(snapshot.reportTemplates.technical, /逼迫.*確認/);
  assert.match(snapshot.reportTemplates.business, /お客様.*売上/);
  applyCommand(state, "report", start + 21_000, { category: "technical", recipient: "cto" });
  applyCommand(state, "report", start + 21_000, { category: "business", recipient: "cs" });
  assert.deepEqual(state.incident.reports.map(r => [r.category, r.recipients]), [["technical", ["cto"]], ["business", ["cs"]]]);
  assert.match(state.events.at(-1).message, /CSへビジネス的/);
  assert.equal(view(state, start + 21_000).score.communication, 10);
  assert.throws(() => applyCommand(state, "report", start + 21_000, { category: "business", recipient: "cs" }), /送信済み/);
  assert.throws(() => applyCommand(state, "report", start + 21_000, { category: "unknown", recipient: "both" }), /不正/);
  assert.equal(state.incident.reports.length, 2);
});

test("recovery allows a new report, uses current facts and retains earlier sent messages", () => {
  const state = newGame("normal", start);
  applyCommand(state, "report", start + 21_000, { category: "business", recipient: "both" });
  const originalMessage = state.incident.reports[0].message;
  applyCommand(state, "ack", start + 21_000);
  applyCommand(state, "investigate", start + 21_000);
  advance(state, start + 30_000);
  assert.match(view(state, start + 30_000).reportTemplates.technical, /メモリ逼迫.*確認/);
  applyCommand(state, "permanent", start + 30_000);
  assert.match(view(state, start + 35_000).reportTemplates.technical, /約13秒後/);
  advance(state, start + 49_000);
  applyCommand(state, "report", start + 49_000, { category: "business", recipient: "both" });
  assert.equal(state.incident.reports[1].stage, "recovery");
  assert.match(state.incident.reports[1].message, /注文処理は復旧/);
  assert.equal(state.incident.reports[0].message, originalMessage);
  assert.match(view(state, start + 49_000).reportTemplates.technical, /Redisのメモリ設定を修正/);
  assert.equal(view(state, start + 49_000).score.communication, 10);
});

test("finished play retains final score and cannot send new reports", () => {
  const state = newGame("easy", start);
  advance(state, start + 200_000);
  assert.equal(view(state, start + 200_000).elapsedSeconds, 180);
  const previousEvents = state.events.length;
  assert.throws(() => applyCommand(state, "report", start + 200_000), /営業は終了/);
  assert.equal(state.events.length, previousEvents);
});
