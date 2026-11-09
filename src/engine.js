export const SCENARIO = {
  id: "redis-memory-pressure",
  title: "Redisのメモリ逼迫",
  startsAt: 20,
  investigateSeconds: 8,
  options: {
    quick: { label: "応急処置：Redisを再起動", seconds: 8, recurrence: true },
    permanent: { label: "根本対応：上限設定を修正", seconds: 18, recurrence: false }
  }
};

export function newGame(mode = "easy", now = Date.now()) {
  return {
    mode,
    durationSeconds: mode === "normal" ? 300 : 180,
    createdAt: now,
    lastAdvancedAt: now,
    pausedAt: null,
    pausedMs: 0,
    status: "running",
    version: 1,
    orders: { arrived: 0, completed: 0, revenue: 0, price: 900 },
    incident: null,
    events: [{ at: 0, type: "game_started", message: "営業開始。注文を受け付けています。" }]
  };
}

export function elapsedSeconds(state, now = Date.now()) {
  const effectiveNow = state.pausedAt ?? now;
  return Math.max(0, Math.floor((effectiveNow - state.createdAt - state.pausedMs) / 1000));
}

function log(state, at, type, message) { state.events.push({ at, type, message }); }

export function advance(state, now = Date.now()) {
  if (state.status === "finished" || state.pausedAt) return state;
  const before = elapsedSeconds(state, state.lastAdvancedAt);
  const until = Math.min(elapsedSeconds(state, now), state.durationSeconds);
  for (let second = before + 1; second <= until; second++) {
    state.orders.arrived += 1;
    const blocked = state.incident && state.incident.phase !== "resolved";
    const capacity = blocked ? 0 : 1;
    const pending = state.orders.arrived - state.orders.completed;
    const processed = Math.min(capacity, pending);
    state.orders.completed += processed;
    state.orders.revenue += processed * state.orders.price;
    if (!state.incident && second === SCENARIO.startsAt) {
      state.incident = { id: "incident-1", phase: "alerting", startedAt: second, recorded: false, reported: false };
      log(state, second, "alert", "Redis遅延アラート：注文処理が停止しています。");
    }
    if (state.incident?.phase === "investigating" && second >= state.incident.investigationDoneAt) {
      state.incident.phase = "awaiting_choice";
      log(state, second, "investigation_complete", "調査完了。対応案を選択してください。");
    }
    if (state.incident?.phase === "mitigating" && second >= state.incident.mitigationDoneAt) {
      state.incident.phase = "resolved";
      state.incident.resolvedAt = second;
      log(state, second, "service_recovered", "注文処理が復旧しました。CTO・CSへ復旧を報告し、resolveしてください。");
    }
  }
  state.lastAdvancedAt = now;
  if (until >= state.durationSeconds) { state.status = "finished"; log(state, until, "game_finished", "営業終了。結果を確認してください。"); }
  return state;
}

export function applyCommand(state, command, now = Date.now()) {
  advance(state, now);
  const at = elapsedSeconds(state, now);
  const incident = state.incident;
  if (command === "pause" && !state.pausedAt) { state.pausedAt = now; log(state, at, "paused", "ゲームを一時停止しました。"); return state; }
  if (command === "resume" && state.pausedAt) { state.pausedMs += now - state.pausedAt; state.pausedAt = null; state.lastAdvancedAt = now; log(state, at, "resumed", "ゲームを再開しました。"); return state; }
  if (!incident) throw new Error("現在実行できるインシデント操作はありません。");
  if (command === "ack" && incident.phase === "alerting") { incident.phase = "acknowledged"; log(state, at, "acknowledged", "アラートをacknowledgeしました。"); }
  else if (command === "investigate" && incident.phase === "acknowledged") { incident.phase = "investigating"; incident.investigationDoneAt = at + SCENARIO.investigateSeconds; log(state, at, "investigation_started", "レスポンダーに調査を依頼しました。"); }
  else if (command === "record" && !incident.recorded) { incident.recorded = true; log(state, at, "recording_started", "スクライブが記録を開始しました。"); }
  else if (command === "report" && !incident.reported) { incident.reported = true; log(state, at, "reported", "CTO・CSへ状況を報告しました。"); }
  else if ((command === "quick" || command === "permanent") && incident.phase === "awaiting_choice") { const option = SCENARIO.options[command]; incident.phase = "mitigating"; incident.choice = command; incident.mitigationDoneAt = at + option.seconds; log(state, at, "mitigation_started", `${option.label}を開始しました。`); }
  else if (command === "resolve" && incident.phase === "resolved" && !incident.alertResolved) { incident.alertResolved = true; log(state, at, "alert_resolved", "アラートをresolveしました。"); }
  else throw new Error("この状態ではその操作を実行できません。");
  return state;
}

export function view(state, now = Date.now()) {
  advance(state, now);
  const pending = state.orders.arrived - state.orders.completed;
  const incident = state.incident;
  return { ...state, elapsedSeconds: elapsedSeconds(state, now), orders: { ...state.orders, pending }, scenario: SCENARIO, score: { revenue: Math.min(40, Math.round(state.orders.revenue / 2700)), recovery: incident?.alertResolved ? 30 : 0, communication: (incident?.recorded ? 10 : 0) + (incident?.reported ? 10 : 0) + (incident?.alertResolved ? 10 : 0) } };
}
