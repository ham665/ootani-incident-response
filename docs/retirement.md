# 審査用デモの公開終了・再公開手順

作業日：2026-11-16。対象：`ootani-incident-api` と、このリポジトリのGitHub Pages。

## 保存した成果物

- 最終プレイ版：[demo-final-2026-11-16](https://github.com/ham665/ootani-incident-response/tree/demo-final-2026-11-16)（`04ae3de`）。審査用に公開していたソースと設定を保存。
- [構成・レスポンダーの提案画面](../web/assets/gameplay-proposals.png)
- [CTO・CSへの連絡画面](../web/assets/gameplay-report.png)
- [Normal終了画面](../web/assets/gameplay-finished.png)
- [Easyの操作動画](../web/assets/demo-playthrough.webm)：実ブラウザで、開始から障害対応、連絡・復旧報告、営業終了まで収録。音声なし。

## 構成と停止方法

公開時は、GitHub Pagesの静的画面 → Cloudflare Worker API → SQLite-backed Durable ObjectsのGameSession、という構成。Redis等はゲーム内の模擬システムであり、実際のRedisコンテナやKubernetesクラスタを契約していない。

公開終了後はGitHub Pagesの静的な紹介ページだけを残す。JavaScriptを読み込まず、API通信・定期ポーリング・解析タグは使用しない。動画も再生操作まで読み込まない。

Worker設定は `workers_dev: false`、`preview_urls: false`、`DEMO_RETIRED: true`、`LLM_ENABLED: false`。別経路で呼ばれた場合も、公開終了ガードで410を返し、新しいセッション作成・保存データへのアクセスは行わない。

Pagesのworkflowは紹介用HTML・CSSと `web/assets/` のみを配布する。ゲーム用JS、API接続設定、旧CSSはソースとして残すが、新しいPages成果物には含めない。

Worker自体とDurable Objectsの保存データは削除しない。データ削除・アカウント全体の契約変更は今回の作業範囲に含めない。

## 費用・権限の確認

2026-11-16にCloudflare管理APIとGitHub CLIで確認した内容：

| 項目 | 確認結果 |
|---|---|
| Worker登録Secret | 0件。OpenRouterキーなし |
| GitHubリポジトリSecrets | 0件 |
| LLM | 公開中のWorker設定でも無効 |
| Cron | 設定なし |
| 独自ドメイン | 設定なし |
| Durable Objects | この作品のSQLite-backed GameSessionを保持 |
| 有料契約一覧・請求履歴・今期課金額 | Wrangler OAuthでは403。請求情報の閲覧権限不足のため、所有者のBilling画面での確認が必要 |
| OpenRouterアカウント | 所有者の指示で今回の確認対象外 |

`usage_model: standard` は料金プランが無料である証拠にはならない。契約月額・今期の利用料金・未払い額が確認できるまでは「料金0円を確認済み」と扱わない。

公開停止は過去の利用料金やアカウント契約の月額を取り消さない。有料契約で保存データが課金対象になる場合、Durable Objectsを残している間は保存料金が残り得る。無料契約が確認でき、無料枠内であればその範囲で利用できる。

請求の最終確認はCloudflareのBillingで、(1) SubscriptionsのWorkersプランと月額、(2) Billable Usageの今期利用額、(3) Invoicesの未払い額を確認する。アカウント共通の有料契約は他作品にも影響するため、無断で解約・ダウングレードしない。

既存のCloudflare OAuth認証とGitHub認証は他の作業にも使えるため失効させていない。キー・パスワード・認証トークンの値をこの文書やリポジトリに保存しない。

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
