import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

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
