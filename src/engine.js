export const SCENARIO = {
  id: "redis-memory-pressure",
  title: "Redisのメモリ逼迫",
  startsAt: 20,
  investigateSeconds: 8,
  diagnosis: "Redisキャッシュのメモリが逼迫し、キャッシュへのアクセスがタイムアウトしています。Redisに依存するbackendの注文処理が停止し、frontendで注文が待機しています。MySQLの注文データ自体には障害はありません。",
  options: {
    quick: { label: "応急処置：Redisコンテナを再起動", seconds: 8, recurrence: true, description: "Redisコンテナを再起動してキャッシュのメモリを解放し、注文処理を再開します。", caution: "キャッシュを再構築する必要があり、メモリ設定の原因は残ります。この最小シナリオでは再発は模擬しません。" },
    permanent: { label: "根本対応：Redisのメモリ設定を修正", seconds: 18, recurrence: false, description: "Redisのmaxmemoryをコンテナの上限内に設定し、キャッシュの退避設定（maxmemory-policy）を見直します。", caution: "応急処置より時間がかかりますが、キャッシュのメモリ逼迫の原因を解消します。" }
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

export function reportMessage(state, category = "business") {
  const incident = state.incident;
  if (!incident) return "現在、インシデントは発生していません。";
  const recovered = incident.phase === "resolved";
  const pending = state.orders.arrived - state.orders.completed;
  const diagnosed = ["awaiting_choice", "mitigating", "resolved"].includes(incident.phase);
  const estimate = incident.phase === "mitigating"
    ? `復旧見込みは約${Math.max(0, incident.mitigationDoneAt - elapsedSeconds(state, state.lastAdvancedAt))}秒後です。`
    : "復旧時刻は未定です。調査・対応の進捗が分かり次第、続報します。";
  if (category === "technical") {
    if (recovered) return `Redisへのアクセスとbackendの注文処理が復旧しました。実施した対応：${SCENARIO.options[incident.choice]?.label || "復旧対応"}。MySQLの注文データは保持されています。`;
    return `${diagnosed ? "Redisキャッシュのメモリ逼迫によるタイムアウトを確認しました。" : "Redis遅延アラートを検知しました。原因は調査中です。"} backendの注文処理が停止し、frontendに影響しています。MySQLの注文データは保持されています。${estimate}`;
  }
  return `${recovered ? "注文処理は復旧しました。" : "お客様の注文処理が停止し、売上の計上が止まっています。"} 未処理の注文要求は${pending}件、処理済みは${state.orders.completed}件、累計売上は${state.orders.revenue.toLocaleString("ja-JP")}円です。${recovered ? "復旧前の待ち注文が残っています。CSはお待ちのお客様へご案内ください。" : `${estimate} CSは注文の遅延をご案内ください。`}`;
}

export function applyCommand(state, command, now = Date.now(), details = {}) {
  advance(state, now);
  if (state.status === "finished") throw new Error("営業は終了しました。新しいゲームを開始してください。");
  const at = elapsedSeconds(state, now);
  const incident = state.incident;
  if (command === "pause" && !state.pausedAt) { state.pausedAt = now; log(state, at, "paused", "ゲームを一時停止しました。"); return state; }
  if (command === "resume" && state.pausedAt) { state.pausedMs += now - state.pausedAt; state.pausedAt = null; state.lastAdvancedAt = now; log(state, at, "resumed", "ゲームを再開しました。"); return state; }
  if (!incident) throw new Error("現在実行できるインシデント操作はありません。");
  if (command === "ack" && incident.phase === "alerting") { incident.phase = "acknowledged"; log(state, at, "acknowledged", "アラートをacknowledgeしました。"); }
  else if (command === "investigate" && incident.phase === "acknowledged") { incident.phase = "investigating"; incident.investigationDoneAt = at + SCENARIO.investigateSeconds; log(state, at, "investigation_started", "レスポンダーに調査を依頼しました。"); }
  else if (command === "record" && !incident.recorded) { incident.recorded = true; log(state, at, "recording_started", "スクライブが記録を開始しました。"); }
  else if (command === "report") {
    const { category = "business", recipient = "both" } = details;
    if (!["technical", "business"].includes(category) || !["cto", "cs", "both"].includes(recipient)) throw new Error("報告の種類または宛先が不正です。");
    const stage = incident.phase === "resolved" ? "recovery" : "incident";
    const recipients = recipient === "both" ? ["cto", "cs"] : [recipient];
    const reports = incident.reports || [];
    const alreadySent = recipients.every(target => reports.some(report => report.stage === stage && report.category === category && report.recipients.includes(target)));
    if (alreadySent) throw new Error("この宛先には同じ種類・段階の報告を送信済みです。");
    const message = reportMessage(state, category);
    incident.reports = [...reports, { at, category, recipients, stage, message }];
    incident.reported = true;
    log(state, at, "reported", `${recipient === "both" ? "CTO・CS" : recipient.toUpperCase()}へ${category === "technical" ? "技術的" : "ビジネス的"}な${stage === "recovery" ? "復旧報告" : "状況報告"}：${message}`);
  }
  else if ((command === "quick" || command === "permanent") && incident.phase === "awaiting_choice") { const option = SCENARIO.options[command]; incident.phase = "mitigating"; incident.choice = command; incident.mitigationDoneAt = at + option.seconds; log(state, at, "mitigation_started", `${option.label}を開始しました。`); }
  else if (command === "resolve" && incident.phase === "resolved" && !incident.alertResolved) { incident.alertResolved = true; log(state, at, "alert_resolved", "アラートをresolveしました。"); }
  else throw new Error("この状態ではその操作を実行できません。");
  return state;
}

export function view(state, now = Date.now()) {
  advance(state, now);
  const pending = state.orders.arrived - state.orders.completed;
  const incident = state.incident;
  return { ...state, elapsedSeconds: Math.min(elapsedSeconds(state, now), state.durationSeconds), orders: { ...state.orders, pending }, scenario: SCENARIO, reportTemplates: { technical: reportMessage(state, "technical"), business: reportMessage(state, "business") }, score: { revenue: Math.min(40, Math.round(state.orders.revenue / 2700)), recovery: incident?.alertResolved ? 30 : 0, communication: (incident?.recorded ? 10 : 0) + (incident?.reported ? 10 : 0) + (incident?.alertResolved ? 10 : 0) } };
}
