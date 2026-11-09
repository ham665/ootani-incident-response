import { newGame, applyCommand, view } from "./engine.js";

const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) } });
const cors = (origin) => origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "authorization, content-type", vary: "Origin" } : {};
function allowedOrigin(request, env) { const origin = request.headers.get("origin"); return origin && (env.ALLOWED_ORIGINS || "").split(",").includes(origin) ? origin : ""; }
function bearer(request) { const match = request.headers.get("authorization")?.match(/^Bearer (.+)$/); return match?.[1] || ""; }
function token() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }

export class GameSession {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/initialize") {
      const { mode = "easy", accessToken } = await request.json();
      const state = newGame(mode);
      await this.ctx.storage.put({ state, accessToken, commands: {} });
      return json(view(state));
    }
    const stored = await this.ctx.storage.get(["state", "accessToken", "commands"]);
    if (!stored.state) return json({ error: "session_not_found" }, 404);
    if (bearer(request) !== stored.accessToken) return json({ error: "unauthorized" }, 401);
    if (request.method === "GET") { await this.ctx.storage.put("state", stored.state); return json(view(stored.state)); }
    if (request.method === "POST" && url.pathname === "/command") {
      const { command, operationId } = await request.json();
      if (!operationId) return json({ error: "operation_id_required" }, 400);
      if (stored.commands[operationId]) return json(view(stored.state));
      try { applyCommand(stored.state, command); stored.commands[operationId] = true; await this.ctx.storage.put({ state: stored.state, commands: stored.commands }); return json(view(stored.state)); }
      catch (error) { return json({ error: error.message }, 409); }
    }
    return json({ error: "not_found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ status: "ok", llmEnabled: env.LLM_ENABLED === "true" }, 200, origin);
    if (url.pathname === "/sessions" && request.method === "POST") {
      const { mode = "easy" } = await request.json().catch(() => ({}));
      if (!["easy", "normal"].includes(mode)) return json({ error: "invalid_mode" }, 400, origin);
      const id = crypto.randomUUID(); const accessToken = token();
      const stub = env.GAME_SESSION.get(env.GAME_SESSION.idFromName(id));
      const response = await stub.fetch("https://session/initialize", { method: "POST", body: JSON.stringify({ mode, accessToken }) });
      return new Response(response.body, { status: 201, headers: { "content-type": "application/json; charset=utf-8", ...cors(origin), "x-session-id": id, "x-access-token": accessToken } });
    }
    const match = url.pathname.match(/^\/sessions\/([\w-]+)(?:\/(command))?$/);
    if (match) {
      const stub = env.GAME_SESSION.get(env.GAME_SESSION.idFromName(match[1]));
      const target = match[2] ? "https://session/command" : "https://session/";
      const response = await stub.fetch(target, request);
      return new Response(response.body, { status: response.status, headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) } });
    }
    return json({ error: "not_found" }, 404, origin);
  }
};
