const API = window.OOTANI_API_URL || "http://localhost:8787";
const stored = JSON.parse(localStorage.getItem("ootani-session") || "null");
let session = stored, current;
const $ = (id) => document.getElementById(id);
const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session.token}` } : {}), ...options.headers } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "通信に失敗しました"); return { data, response };
};
function modal() {
  if (document.querySelector(".dialog")) return;
  const node = $("setup").content.cloneNode(true);
  document.body.append(node);
  document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => start(button.dataset.mode));
  $("api-url").textContent = API;
}
async function start(mode) { const { data, response } = await request("/sessions", { method: "POST", body: JSON.stringify({ mode }) }); session = { id: response.headers.get("x-session-id"), token: response.headers.get("x-access-token") }; localStorage.setItem("ootani-session", JSON.stringify(session)); document.querySelectorAll(".dialog").forEach((dialog) => dialog.remove()); render(data); }
function label(incident) { return incident ? `${incident.phase}: Redisのメモリ逼迫` : "アラートはありません"; }
function render(state) { current = state; $("timer").textContent = `${String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0")}:${String(state.elapsedSeconds % 60).padStart(2, "0")}`; $("revenue").textContent = `¥${state.orders.revenue.toLocaleString()}`; $("pending").textContent = state.orders.pending; $("completed").textContent = state.orders.completed; const active = state.incident && state.incident.phase !== "resolved"; $("service-status").textContent = active ? "注文処理停止中" : "正常"; $("service-status").className = `status ${active ? "bad" : "good"}`; $("alert").textContent = label(state.incident); $("technical").textContent = state.incident ? `レスポンダー: ${state.incident.phase}` : "サービスは正常です"; $("events").innerHTML = state.events.slice(-8).reverse().map((event) => `<li><time>${event.at}s</time>${event.message}</li>`).join(""); $("score").textContent = `暫定スコア ${state.score.revenue + state.score.recovery + state.score.communication}/100`; $("pause").textContent = state.pausedAt ? "再開" : "一時停止"; }
async function refresh() { if (!session) return modal(); try { render((await request(`/sessions/${session.id}`)).data); } catch { localStorage.removeItem("ootani-session"); session = null; modal(); } }
async function command(command) { if (!session) return; try { render((await request(`/sessions/${session.id}/command`, { method: "POST", body: JSON.stringify({ command, operationId: crypto.randomUUID() }) })).data); } catch (error) { window.alert(error.message); } }
document.querySelectorAll("[data-command]").forEach((button) => button.onclick = () => command(button.dataset.command)); $("pause").onclick = () => command(current?.pausedAt ? "resume" : "pause"); $("restart").onclick = () => { localStorage.removeItem("ootani-session"); session = null; modal(); };
refresh(); setInterval(refresh, 1000);
