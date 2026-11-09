# おおたに食堂 Incident Room

インシデントコマンダーの判断を短時間で体験するブラウザゲームです。最初の実装はRedisメモリ逼迫の1シナリオ、LLMなしで動作します。

## 開発

```bash
npm install
npm run dev
```

`http://localhost:8787/health` でWorkerを確認し、`web/index.html` は任意の静的サーバーで開きます。ローカルAPIの既定値は `http://localhost:8787` です。

```bash
npm test
```

## デプロイ前の確認

`wrangler.jsonc` のWorker名は `ootani-incident-api` です。これは初回デプロイで作成される新規Workerです。既存Workerを更新しないこと、`npx wrangler whoami` で配置先アカウントを確認することを確認してから、所有者の明示的な了承を得て `npm run deploy` を実行します。

LLMは `LLM_ENABLED=false` が既定です。OpenRouterキーは実装・デプロイ後に `wrangler secret put OPENROUTER_API_KEY` で登録します。キー値をファイルやチャットに書き込まないでください。

## GitHub Pages

`.github/workflows/deploy-pages.yml` は `main` へのpush時、`web/` をGitHub Pagesへデプロイします。GitHubでリポジトリを作成・pushしたら、**Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。

Pagesでは `web/config.js` が公開Worker URLを使います。公開前に `wrangler.jsonc` の `ALLOWED_ORIGINS` へPagesのOrigin（例: `https://<github-user>.github.io`。パスは含めない）を追加してWorkerを再デプロイしてください。APIキーなどの秘密情報をPagesのファイル・Actions変数へ置かないでください。
