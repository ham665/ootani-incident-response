# 審査用デモの公開終了・再公開手順

作業日：2026-11-16。対象：`ootani-incident-api` と、このリポジトリのGitHub Pages。

## 現在の状況

2026-11-16時点で、審査終了後の成果物保存と公開停止は完了。今後の方針は、GitHubのソース・紹介ページ・無料サブドメインを残し、ゲームAPIは停止したままにすること。

- [紹介ページ](https://ham665.github.io/ootani-incident-response/)：公開継続。画面・操作動画・ソースへのリンクを掲載。ゲーム開始操作は提供しない。
- Cloudflare Worker：通常URL・プレビューURLとも無効。公開APIの停止を確認済み。
- Worker本体とDurable Objects：再開用に保持。プレイデータは削除していない。
- Workers契約：所有者が共有したBilling画面で **Workers Free / Active** を確認。支払い方法は **No payment method on file**。
- サブドメイン：無料の `ootani-incident.workers.dev` を保持する。今回、独自ドメインの購入は行っていない。
- 現時点で、有料契約の解約・ドメインの削除・保存データの削除は実施しない。請求履歴・今期利用額の数値は未確認として区別する。

公開停止に関する変更はコミット `56a6b04`、最終プレイ版は `04ae3de`。元の作業フォルダにある未コミット変更には手を加えていない。

## 保存した成果物

- 最終プレイ版：[demo-final-2026-11-16](https://github.com/ham665/ootani-incident-response/tree/demo-final-2026-11-16)（`04ae3de`）。審査用に公開していたソースと設定を保存。
- [GitHub Release](https://github.com/ham665/ootani-incident-response/releases/tag/demo-final-2026-11-16)：最終ソースZIPと操作動画を添付。ZIPは最終プレイ版タグから生成。
- [構成・レスポンダーの提案画面](../web/assets/gameplay-proposals.png)
- [CTO・CSへの連絡画面](../web/assets/gameplay-report.png)
- [Normal終了画面](../web/assets/gameplay-finished.png)
- [Easyの操作動画](../web/assets/demo-playthrough.webm)：実ブラウザで、開始から障害対応、連絡・復旧報告、営業終了まで収録。音声なし、約184秒。

## 構成と停止方法

公開時は、GitHub Pagesの静的画面 → Cloudflare Worker API → SQLite-backed Durable ObjectsのGameSession、という構成。Redis等はゲーム内の模擬システムであり、実際のRedisコンテナやKubernetesクラスタを契約していない。

公開終了後はGitHub Pagesの静的な紹介ページだけを残す。JavaScriptを読み込まず、API通信・定期ポーリング・解析タグは使用しない。動画も再生操作まで読み込まない。

Worker設定は `workers_dev: false`、`preview_urls: false`、`DEMO_RETIRED: true`、`LLM_ENABLED: false`。別経路で呼ばれた場合も、公開終了ガードで410を返し、新しいセッション作成・保存データへのアクセスは行わない。

Pagesのworkflowは紹介用HTML・CSSと `web/assets/` のみを配布する。ゲーム用JS、API接続設定、旧CSSはソースとして残すが、新しいPages成果物には含めない。

Worker自体とDurable Objectsの保存データは削除しない。データ削除・アカウント全体の契約変更は今回の作業範囲に含めない。

## 実施後の検証結果

2026-11-16に確認：

| 検証 | 結果 |
|---|---|
| Worker管理APIの公開経路 | `enabled: false`、`previews_enabled: false` |
| Worker管理APIの設定 | `DEMO_RETIRED: true`、`LLM_ENABLED: false` |
| 公開URLの `GET /health` | HTTP 404。公開経路を無効化しているためWorkerへ到達しない |
| 公開URLの `POST /sessions` | HTTP 404。公開URLからゲームを作成できない |
| 公開終了ガードのテスト | 別経路で呼ばれても410を返し、セッションを作成・参照しない |
| GitHub Pagesの配布 | Actions成功。紹介ページへ切り替え済み |
| 公開紹介ページの実ブラウザ検証 | JavaScript 0件、API通信0件、画面エラーなし |
| 動画 | 再生操作前は読み込まれず、操作後に再生できることを確認 |
| スマートフォン表示 | 幅390pxで横方向のはみ出しなし |
| データ保持 | SQLite-backed GameSessionの名前空間が残っていることを管理APIで確認 |

停止前には最終プレイ版のEasyを実ブラウザで操作し、営業終了・最終スコア100点・連絡履歴保持を確認して動画を保存した。

## 費用・権限の確認

2026-11-16にCloudflare管理API・GitHub CLI・所有者が共有したBilling画面で確認した内容：

| 項目 | 確認結果 |
|---|---|
| Worker登録Secret | 0件。OpenRouterキーなし |
| GitHubリポジトリSecrets | 0件 |
| LLM | 公開中のWorker設定でも無効 |
| Cron | 設定なし |
| 独自ドメイン | 設定なし |
| Durable Objects | この作品のSQLite-backed GameSessionを保持 |
| Workers契約 | 所有者から「Workers Freeのみ利用」と申告。続いて共有されたSubscriptions画面でも `Workers Free / Active` を確認 |
| 支払い方法 | 同じ画面で `No payment method on file` を確認 |
| 契約・請求APIの制約 | 契約一覧・請求履歴・今期利用額はWrangler OAuthでは403。未払い請求のAPIは404で取得できず |
| 請求履歴・今期利用額・未払い額 | 数値は未確認。Freeの契約確認や支払い方法未登録と、過去分の請求額確認は別として扱う |
| OpenRouterアカウント | 所有者の指示で今回の確認対象外 |

`usage_model: standard` は料金プランが無料である証拠にはならない。今回のFree判定の根拠は所有者の申告と共有されたSubscriptions画面であり、APIのusage modelではない。請求履歴・今期利用額の数値を取得していないため、「請求額0円を確認済み」とは扱わない。

公開停止は過去の利用料金やアカウント契約の月額を取り消さない。有料契約で保存データが課金対象になる場合、Durable Objectsを残している間は保存料金が残り得る。無料契約が確認でき、無料枠内であればその範囲で利用できる。

Workers Freeのため、この作品についてWorkersの有料契約を解約する必要はないと整理した。過去分も含めた請求額を確認したい場合は、所有者がCloudflare BillingのBillable UsageとInvoicesを確認する。アカウント共通の契約は他作品にも影響するため、無断で解約・ダウングレードしない。

既存のCloudflare OAuth認証とGitHub認証は他の作業にも使えるため失効させていない。キー・パスワード・認証トークンの値をこの文書やリポジトリに保存しない。

## ドメインの確認と保持方針

2026-11-16に読み取り確認した結果：

| 項目 | 結果 |
|---|---|
| アカウントのWorkersサブドメイン | `ootani-incident`。`ootani-incident.workers.dev` を保持 |
| この作品の公開時のAPI URL | `https://ootani-incident-api.ootani-incident.workers.dev`。現在は公開停止 |
| Workersの独自ドメイン接続 | 0件 |
| 対象アカウントのDNSゾーン | 0件。全件取得の結果を確認 |
| Registrarの購入ドメイン一覧 | 旧・現行の両APIとも403。購入履歴全体は直接確認できていない |

今回設定したものはCloudflare提供の無料 `workers.dev` サブドメインであり、購入した独自ドメインではない。名前を保持するための独自ドメイン登録料・更新料は不要。APIの公開は無効化したまま、名前は削除せず残す。

この確認は「この作品で使用した無料サブドメイン」の扱いを確定したもので、別サービス・別アカウントを含むドメイン購入履歴がすべて存在しないことを証明するものではない。

## 再公開する場合

1. まず契約・利用上限と再公開する意図を確認する。
2. 作業中の編集がない別作業ツリーで、タグ `demo-final-2026-11-16` のソースと現在の構成を比較する。タグを強制的にmainへ戻さない。
3. `web/index.html` をタグのプレイ画面へ復元する。Pagesのworkflowもゲーム用 `app.js`、`config.js`、`style.css` が配布されるよう戻す。紹介ページと動画は必要に応じて保存する。
4. Worker名・配置先アカウント・許可Originを確認し、`DEMO_RETIRED` を `false`、`workers_dev` を `true` に変更する。`preview_urls` は必要な場合だけ有効化し、`LLM_ENABLED` は `false` のままにする。
5. `npx wrangler whoami` で配置先を確認して `npx wrangler deploy` を実行する。保存データのマイグレーションや削除は不要。
6. Pagesをデプロイし、ブラウザで開始・停止／再開・連絡・対処・復旧・営業終了まで確認する。CORSの `x-session-id` と `x-access-token` の公開設定を維持する。

## 参考資料

- [workers.devの無効化](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [バージョンURLの無効化](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
- [Durable Objectsの料金](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [請求対象の利用状況](https://developers.cloudflare.com/billing/manage/billable-usage/)
