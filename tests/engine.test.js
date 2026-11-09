import test from "node:test";
import assert from "node:assert/strict";
import { newGame, advance, applyCommand, view } from "../src/engine.js";

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
