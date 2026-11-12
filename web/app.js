const API = window.OOTANI_API_URL || "http://localhost:8787";
const stored = JSON.parse(localStorage.getItem("ootani-session") || "null");
let session = stored, current, sendingReport = false;
const $ = (id) => document.getElementById(id);
const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session.token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "通信に失敗しました");
    error.status = response.status;
    throw error;
  }
  return { data, response };
};
function modal() {
  if (document.querySelector(".dialog")) return;
  const node = $("setup").content.cloneNode(true);
  document.body.append(node);
  document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => start(button.dataset.mode));
  $("api-url").textContent = API;
}
async function start(mode) {
  try {
    const { data, response } = await request("/sessions", { method: "POST", body: JSON.stringify({ mode }) });
    const id = response.headers.get("x-session-id"), token = response.headers.get("x-access-token");
    if (!id || !token) throw new Error("ゲームの接続情報を取得できませんでした。再度開始してください。");
    session = { id, token };
    localStorage.setItem("ootani-session", JSON.stringify(session));
    document.querySelectorAll(".dialog").forEach(dialog => dialog.remove());
    render(data);
  } catch (error) { window.alert(error.message); }
}
const phaseLabels = { alerting: "未確認", acknowledged: "確認済み", investigating: "調査中", awaiting_choice: "対応案を選択", mitigating: "対処中", resolved: "復旧済み" };
function renderMap(state) {
  const active = state.incident && state.incident.phase !== "resolved";
  const nodes = {
    alb: ["healthy", "正常"],
    frontend: active ? ["impacted", "影響：注文待機"] : ["healthy", "正常"],
    backend: active ? ["impacted", "影響：処理停止"] : ["healthy", "正常"],
    redis: active ? ["fault", "障害：応答遅延"] : ["healthy", "正常"],
    mysql: ["healthy", "正常・正本保持"]
  };
  for (const [id, [status, label]] of Object.entries(nodes)) {
    $(`node-${id}`).setAttribute("class", `system-node ${status}`);
    $(`node-${id}`).querySelector(".node-status").textContent = label;
  }
  $("frontend-backend").classList.toggle("impacted", !!active);
  $("backend-redis").classList.toggle("fault", !!active);
  const summary = active
    ? "Redisの応答遅延 → backendの注文処理停止 → frontendの注文待機。ALB・WAFとMySQL自体は正常です。"
    : state.incident ? `Redisと注文処理は復旧しました。未処理の注文要求は${state.orders.pending}件です。` : "注文処理は正常です。Redisはキャッシュ、MySQLは注文データの正本を保持します。";
  $("impact-summary").textContent = summary;
  $("diagram-description").textContent = summary;
}
function renderResponder(state) {
  const incident = state.incident, phase = incident?.phase;
  const diagnosed = ["awaiting_choice", "mitigating", "resolved"].includes(phase);
  const option = state.scenario.options[incident?.choice];
  const messages = {
    alerting: "Redisの応答遅延を検知しました。まずAcknowledgeし、調査を依頼してください。原因はまだ確定していません。",
    acknowledged: "アラート確認済みです。調査を依頼すると、Redisの状態と対応案を報告します。",
    investigating: `Redisのメモリ使用量と接続状況を調査しています（調査時間：約${state.scenario.investigateSeconds}秒）。`,
    awaiting_choice: `調査結果：${state.scenario.diagnosis}`,
    mitigating: `${option?.label || "復旧対応"}を実施中です。復旧まで約${Math.max(0, (incident?.mitigationDoneAt || 0) - state.elapsedSeconds)}秒です。`,
    resolved: `${option?.label || "復旧対応"}が完了し、Redisへのアクセスと注文処理が復旧しました。関係者へ復旧報告し、アラートをresolveしてください。`
  };
  $("technical").textContent = messages[phase] || "サービスは正常です。障害発生後、調査を依頼してください。";
  $("remediation-options").hidden = !diagnosed;
  if (diagnosed && !$("proposal-cards").children.length) {
    for (const [id, proposal] of Object.entries(state.scenario.options)) {
      const card = document.createElement("article"); card.className = "proposal";
      const heading = document.createElement("h4"); heading.textContent = proposal.label;
      const description = document.createElement("p"); description.textContent = proposal.description;
      const caution = document.createElement("p"); caution.className = "hint"; caution.textContent = proposal.caution;
      const button = document.createElement("button"); button.dataset.command = id; button.textContent = `${proposal.label}（${proposal.seconds}秒）`; button.onclick = () => command(id);
      card.append(heading, description, caution, button); $("proposal-cards").append(card);
    }
  }
  document.querySelectorAll("[data-command]").forEach(button => {
    const allowed = { ack: phase === "alerting", investigate: phase === "acknowledged", record: !!incident && !incident.recorded, quick: phase === "awaiting_choice", permanent: phase === "awaiting_choice", resolve: phase === "resolved" && !incident.alertResolved };
    button.disabled = !allowed[button.dataset.command] || state.status === "finished";
  });
}
function reportSelection() {
  return { category: document.querySelector('[name="report-category"]:checked').value, recipient: $("report-recipient").value };
}
function renderReportPreview() {
  if (!current) return;
  const { category, recipient } = reportSelection();
  $("report-preview").textContent = current.reportTemplates?.[category] || "インシデント発生後に連絡できます。";
  const stage = current.incident?.phase === "resolved" ? "recovery" : "incident";
  const targets = recipient === "both" ? ["cto", "cs"] : [recipient];
  const sent = targets.every(target => (current.incident?.reports || []).some(report => report.stage === stage && report.category === category && report.recipients.includes(target)));
  $("send-report").disabled = sendingReport || !current.incident || current.status === "finished" || sent;
  $("send-report").textContent = sendingReport ? "連絡中…" : sent ? "この内容は送信済み" : "選んだ内容で連絡する";
}
function renderReports(state) {
  const reports = state.incident?.reports || [];
  $("reports").replaceChildren();
  if (!reports.length) {
    const li = document.createElement("li"); li.textContent = "まだ連絡していません"; $("reports").append(li);
  }
  for (const report of reports.slice().reverse()) {
    const li = document.createElement("li"), label = document.createElement("strong");
    label.textContent = `${report.at}s · ${report.recipients.map(r => r.toUpperCase()).join("・")} · ${report.category === "technical" ? "技術" : "ビジネス"} · ${report.stage === "recovery" ? "復旧" : "状況"}報告`;
    const p = document.createElement("p"); p.textContent = report.message; li.append(label, p); $("reports").append(li);
  }
  $("open-report").disabled = !state.incident || state.status === "finished";
  renderReportPreview();
}
function render(state) {
  current = state;
  $("timer").textContent = `${String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0")}:${String(state.elapsedSeconds % 60).padStart(2, "0")}`;
  $("revenue").textContent = `¥${state.orders.revenue.toLocaleString()}`;
  $("pending").textContent = state.orders.pending; $("completed").textContent = state.orders.completed;
  const active = state.incident && state.incident.phase !== "resolved";
  $("service-status").textContent = state.status === "finished" ? "営業終了" : active ? "注文処理停止中" : "正常";
  $("service-status").className = `status ${active ? "bad" : "good"}`;
  $("alert").textContent = state.incident ? `${phaseLabels[state.incident.phase]}：${state.scenario.title}${state.incident.alertResolved ? "（クローズ済み）" : ""}` : "アラートはありません";
  $("events").replaceChildren();
  for (const event of state.events.slice(-8).reverse()) {
    const li = document.createElement("li"), time = document.createElement("time"); time.textContent = `${event.at}s`; li.append(time, document.createTextNode(event.message)); $("events").append(li);
  }
  $("score").textContent = `${state.status === "finished" ? "最終" : "暫定"}スコア ${state.score.revenue + state.score.recovery + state.score.communication}/100`;
  $("pause").textContent = state.pausedAt ? "再開" : "一時停止"; $("pause").disabled = state.status === "finished";
  renderMap(state); renderResponder(state); renderReports(state);
}
async function refresh() {
  if (!session) return modal();
  const activeSession = session;
  try {
    const { data } = await request(`/sessions/${activeSession.id}`);
    if (session === activeSession) render(data);
  } catch (error) {
    if (session !== activeSession) return;
    if (error.status === 401 || error.status === 404) {
      localStorage.removeItem("ootani-session");
      session = null;
      modal();
      return;
    }
    console.warn("ゲーム状態の更新に失敗しました。次回更新時に再試行します。", error);
  }
}
async function command(name, report) {
  if (!session) return false;
  try {
    const { data } = await request(`/sessions/${session.id}/command`, { method: "POST", body: JSON.stringify({ command: name, report, operationId: crypto.randomUUID() }) });
    render(data); return true;
  } catch (error) {
    if (name === "report") $("report-feedback").textContent = error.message;
    else window.alert(error.message);
    return false;
  }
}
document.querySelectorAll("[data-command]").forEach(button => button.onclick = () => command(button.dataset.command));
$("pause").onclick = () => command(current?.pausedAt ? "resume" : "pause");
function closeReport() { $("report-composer").hidden = true; $("open-report").setAttribute("aria-expanded", "false"); }
$("restart").onclick = () => {
  localStorage.removeItem("ootani-session"); session = null; current = null;
  closeReport(); $("report-feedback").textContent = ""; $("proposal-cards").replaceChildren(); modal();
};
$("open-report").onclick = () => {
  $("report-composer").hidden = false; $("open-report").setAttribute("aria-expanded", "true");
  $("report-feedback").textContent = ""; renderReportPreview(); $("report-recipient").focus();
};
$("cancel-report").onclick = closeReport;
$("report-composer").onchange = () => { $("report-feedback").textContent = ""; renderReportPreview(); };
$("report-composer").onsubmit = async event => {
  event.preventDefault(); if (sendingReport || $("send-report").disabled) return;
  sendingReport = true; renderReportPreview();
  try { if (await command("report", reportSelection())) $("report-feedback").textContent = "選んだ内容で連絡しました。履歴に保存されています。"; }
  finally { sendingReport = false; renderReportPreview(); }
};
refresh(); setInterval(refresh, 1000);
