import test from "node:test";
import assert from "node:assert/strict";
import worker, { GameSession } from "../src/worker.js";
import { newGame, advance } from "../src/engine.js";

test("Pages can read the session credentials returned by the Worker", async () => {
  const origin = "https://ham665.github.io";
  const env = {
    ALLOWED_ORIGINS: origin,
    GAME_SESSION: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ status: "running" }) })
    }
  };
  const response = await worker.fetch(new Request("https://worker.test/sessions", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ mode: "easy" })
  }), env);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  const exposed = response.headers.get("access-control-expose-headers")?.split(/,\s*/) || [];
  for (const header of ["x-session-id", "x-access-token"]) {
    assert.ok(response.headers.get(header), `${header} must have a value`);
    assert.ok(exposed.includes(header), `${header} must be readable by cross-origin browser fetch`);
  }
});

test("report choices pass through the public router and persist idempotently", async () => {
  const now = Date.now();
  const state = newGame("easy", now - 21_000);
  advance(state, now);
  const values = new Map([["state", state], ["accessToken", "test-token"], ["commands", {}]]);
  const storage = {
    async get(keys) { return new Map(keys.map(key => [key, structuredClone(values.get(key))])); },
    async put(key, value) {
      if (typeof key === "string") values.set(key, structuredClone(value));
      else for (const [name, data] of Object.entries(key)) values.set(name, structuredClone(data));
    }
  };
  const session = new GameSession({ storage });
  const env = { ALLOWED_ORIGINS: "https://ham665.github.io", GAME_SESSION: { idFromName: id => id, get: () => session } };
  const command = () => new Request("https://worker.test/sessions/test-id/command", {
    method: "POST",
    headers: { origin: env.ALLOWED_ORIGINS, authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ command: "report", operationId: "report-1", report: { category: "technical", recipient: "cto" } })
  });
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(command(), env);
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.incident.reports.length, 1);
    assert.equal(snapshot.incident.reports[0].category, "technical");
    assert.deepEqual(snapshot.incident.reports[0].recipients, ["cto"]);
    assert.match(snapshot.incident.reports[0].message, /Redis/);
  }
  assert.equal(values.get("state").incident.reports.length, 1);
});
