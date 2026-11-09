# おおたに食堂：開発・公開の準備手順書

作成日：2026-11-06  
対象：プロジェクト所有者・実装担当者  
目的：GitHub Pages＋Cloudflare Workers＋OpenRouterで、インシデントレスポンス体験を公開するための準備。

この資料は準備手順であり、アカウント作成・課金・リポジトリ作成・デプロイはまだ実施していない。URLや名前の例は実際の値に置き換える。既存アカウントがあれば再利用する。

## 1. 最初に用意するもの

**今は「3サービスのアカウント」と「GitHubの公開リポジトリ」まであれば、実装を開始できる。** GitHub Pagesの公開とWorkerの作成は、実装コードが用意できてから行う。

| 対象 | 今すること | 実装後にすること |
|---|---|---|
| GitHub | アカウント準備、公開リポジトリ作成 | PagesをGitHub Actions経由で公開 |
| Cloudflare | アカウント準備、ダッシュボードにログイン | Worker・Durable Objectをコードから作成、Secret登録 |
| OpenRouter | アカウント準備、無料運用か予算ありか選ぶ | 専用APIキー発行、Workerへ登録、疎通確認 |
| 開発PC | WSL内でGit・Node.js・npmが動くことを確認 | リポジトリ取得、依存関係導入、ローカル起動 |

不要なもの：独自ドメイン、AWSアカウント、実物のKubernetes・Redis・MySQL、PagerDuty、Slack、ゲーム利用者用のログイン基盤。

ゲーム内のシステムやチャットは模擬である。開発者がサービスにログインすることと、ゲーム利用者にログインを要求することは別であり、後者は不要。

## 2. 公開構成と名前

| 用途 | 採用先 | 名前・URLの例 |
|---|---|---|
| ソースコード・設計資料 | GitHub | `https://github.com/<username>/ootani-incident` |
| プレイ画面 | GitHub Pages | `https://<username>.github.io/ootani-incident/` |
| ゲームAPI・LLM呼び出し | Cloudflare Worker | Worker名：`ootani-incident-api` |
| API公開URL | workers.dev | デプロイ後に表示されるURLを使用 |
| プレイごとの状態 | SQLite-backed Durable Objects | 実装担当がWorker設定に定義 |
| LLM | OpenRouter | 専用キー名：`ootani-incident-dev` など |

`<username>.github.io`という名前のリポジトリを新しく作る必要はない。今回は通常のリポジトリから公開する「プロジェクトサイト」を使用する。[1][2]

初期構成ではD1・R2などの追加サービスは準備しない。Durable Objectsを採用する場合は無料プランで利用可能なSQLiteバックエンドを使う。無料枠には上限があるため、公開規模に合わせて確認する。[5]

## 3. GitHub：今やる作業

### 3.1 アカウント

1. [GitHub](https://github.com/)にサインインする。未登録ならアカウントを作成する。
2. メール認証を完了する。
3. 二要素認証を設定し、復旧コードを保管することを推奨する。
4. 使用するユーザー名を控える。

GitHub Freeでは公開リポジトリでPagesを利用できる。非公開リポジトリを使いたい場合は、契約プランとPagesの対応を別途確認する。[1]

### 3.2 リポジトリ

[新規リポジトリ作成](https://github.com/new)を開き、以下を設定する。

| 項目 | 推奨設定 |
|---|---|
| Owner | 自分のアカウント |
| Repository name | `ootani-incident` |
| Description | インシデントコマンダーを体験する、3〜5分のブラウザゲーム |
| Visibility | Public |
| README | 作成する |
| .gitignore | 初期段階では省略可。実装開始時に必ず設定 |
| License | 公開利用条件を決めてから追加。公開だけでは再利用許諾にならない |

リポジトリ作成後にURLを控える。既にローカルの実装リポジトリがある場合は、READMEなどを重複初期化せず、その履歴を公開する手順に合わせる。

**完了条件：リポジトリのトップページを開けて、URLが分かる。** Pagesがまだ404でも問題ない。

公開リポジトリにはAPIキー、認証トークン、個人情報を入れない。設計資料は将来 `docs/` に置く想定でよい。

## 4. Cloudflare：今やる作業

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)でアカウントを作成、またはサインインする。
2. メール認証を完了し、Workers & Pagesの画面に進めることを確認する。
3. 複数のCloudflareアカウントに所属している場合は、このプロジェクトを配置するアカウントを選ぶ。
4. 初期段階では無料プランを前提とし、有料プランへの変更はしない。

独自ドメインの追加・DNS移管は不要。APIはCloudflareの `workers.dev` URLを使う予定。[3]

**この段階では、ダッシュボードで空のWorkerやDurable Objectを手動作成しなくてよい。** 実装後、設定ファイルとWranglerによるデプロイで作成する方が、名前・バインディング・マイグレーションを揃えやすい。

初回の手動デプロイには `wrangler login` を使う。Cloudflare API TokenやGlobal API Keyを今から発行する必要はない。GitHub ActionsでWorkerも自動デプロイする場合に限り、後から必要範囲に限定したAPI Tokenを用意する。

**完了条件：対象アカウントのWorkers & Pages画面を開ける。**

## 5. OpenRouter：今やる作業

1. [OpenRouter](https://openrouter.ai/)でアカウントを作成、またはサインインする。
2. [API Keys](https://openrouter.ai/settings/keys)を開けることを確認する。
3. 以下の運用方針を選ぶ。APIキー自体は、Workerへ登録する直前の作成でもよい。

| 方針 | 設定・実装の方針 | 向いている段階 |
|---|---|---|
| 無料モデルのみ | 利用可能な無料モデルを明示指定。失敗時は定型文。有料モデルへ自動切替しない | 開発・個人検証 |
| 少額の予算を設定 | 専用キーの利用上限を設定し、モデルを限定。必要なクレジットだけ購入 | イベントでのデモを調整する段階 |

無料モデルの利用可能性・レート制限・応答時間は保証されない。「無料モデル」と「無制限」は異なる。現時点でモデル名を固定せず、実装時に候補の日本語品質と応答時間を確認する。[7][8]

APIキーを作る際は、このプロジェクト専用にし、表示されたキーをパスワードマネージャー等に保管する。対応する利用上限設定を確認し、有料利用する場合は予算を設定する。**キーの値をChatGPTへの返信、Issue、READMEに貼る必要はない。**

今回の構成では運営者のキーをWorkerに保管する。プレイヤーが自分のOpenRouterアカウントやAPIキーを用意する必要はない。

**完了条件：OpenRouterにログインでき、無料のみ／予算ありの方針が決まっている。** キー未発行でもゲーム本体の実装は始められる。

## 6. 開発PCの準備（Windows＋WSL想定）

以下はPowerShellではなく、開発に使うWSLのターミナルで実行する。

```bash
git --version
node --version
npm --version
```

Gitと、採用するWrangler・フロントエンドツールが対応するNode.jsのLTSを用意する。既存のfnm等がある場合はそれを使い、別の管理ツールを重ねて導入しない。実装開始時にNodeのバージョン指定とlockfileをリポジトリへ含める。

リポジトリ作成後は、`<username>`を実際のユーザー名へ置き換えて取得する。

```bash
git clone https://github.com/<username>/ootani-incident.git
cd ootani-incident
```

cloneは公開リポジトリなら認証なしで可能だが、pushにはGitHub認証が必要。既存のGitHub CLI・credential manager・SSH設定を利用する。アクセストークンをURLに埋め込まない。

依存関係のインストール・起動コマンドは実装時にREADMEへ追記する。この時点で空のリポジトリに `npm install` を実行する必要はない。

## 7. 実装後の公開手順

この節はコード・設定ファイルが揃ってから実施する。以下の名前は実装側と合わせるための提案であり、既に存在するAPIや設定ではない。

### 7.1 実装担当が先に用意するもの

- 静的フロントエンドと、GitHub Pages用のビルド・公開workflow。
- プロジェクトサイトのパス `/ootani-incident/` に対応したアセット参照。
- Workerの設定ファイル、Durable Objectのクラス・バインディング・SQLiteマイグレーション。
- APIのヘルスチェック、セッション作成、ゲーム進行、LLM呼び出し。
- 許可Origin、モデルID、LLM有効／無効を設定する仕組み。
- キーなし・タイムアウト・利用制限時に定型文へ切り替わる処理。
- 匿名公開APIのリクエスト制限、LLM呼び出し回数・入力長・出力長の上限。
- `.gitignore` に `.dev.vars`、`.env` 等の秘密情報ファイルを追加。サンプルにはダミー値だけ記載。

LLMは補助説明・振り返りなどに使い、障害発生・対応時間・復旧・採点の確定処理から切り離す。外部APIが不調でも3〜5分の体験を完走できるようにする。

### 7.2 Workerを先に公開する

Wranglerを依存関係に含むWorkerプロジェクトのディレクトリで実行する。具体的なディレクトリ名は実装後のREADMEに従う。

```bash
npx wrangler login
npx wrangler whoami
npx wrangler deploy
```

ブラウザで認証し、`whoami` で配置先が正しいことを確認してからデプロイする。WSLからブラウザが開かない場合は、Wranglerが表示する認証案内に従う。[4]

初回はLLM無効でも起動できる構成とする。デプロイで表示されるWorker URLを控え、ヘルスチェックを確認する。上記コマンドはリモートリソースを作成・更新するので、設定ファイルのWorker名とアカウントを確認して実行する。

Durable Objectは、コードから対象IDを利用した際にインスタンスが作られる。プレイヤー数分をダッシュボードで手作業作成する必要はない。

### 7.3 OpenRouterキーをSecretへ登録する

同じWorkerプロジェクトで実行し、入力を求められてからキーの値を貼り付ける。

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

キーをコマンドの引数や設定ファイルの `vars` に書かない。`secret put` はWorkerの新しいバージョンを作成・デプロイする操作でもある。環境を分ける構成では、デプロイとSecret登録に同じ `--env` を指定する。[6]

ローカル検証用は `.dev.vars` 等に保存し、Gitの追跡対象から除外する。キー設定後、モデルID・LLM有効設定を適用して疎通確認する。ログにはキーやAuthorizationヘッダーを出さない。

### 7.4 GitHub Pagesを公開する

1. GitHubリポジトリの **Settings → Pages** を開く。
2. **Build and deployment → Source** で **GitHub Actions** を選ぶ。
3. 実装担当が用意したPages用workflowとコードをpushする。
4. **Actions** でビルド・デプロイが成功することを確認する。
5. Pages画面に表示される公開URLを開く。[2]

Pages公開には標準の `GITHUB_TOKEN` を使う構成とし、個人アクセストークンを新規発行する必要はない。workflowの権限設定は実装担当が行う。

フロントエンドのAPI接続先は、先ほど控えたWorker URLとする。ビルド時の公開変数に入れてよいのはAPI URLなどの非秘密情報のみ。**フロントエンドに埋め込む変数は、名前にSecretと付けても閲覧者から読める。**

### 7.5 Originと公開APIの制限を確認する

Pagesが `https://alice.github.io/ootani-incident/` の場合、許可するOriginは `https://alice.github.io`。パス部分は含めない。ローカル開発用のOriginは別途追加する。

CORSはブラウザの制御であり、公開APIの不正利用や課金を防ぐ認証にはならない。公開前に、セッション単位・送信元単位の制限、LLMの総利用量管理、即時無効化を実装する。モデル名やプロンプト全文をクライアントから自由に指定できる汎用プロキシにはしない。

## 8. 秘密情報と設定値の置き場所

| 情報 | 置き場所 | 共有・公開の扱い |
|---|---|---|
| リポジトリURL・Pages URL・API URL | READMEや公開設定 | 公開可 |
| Cloudflare Account ID | 配置先の設定 | 認証情報ではないが必要な相手にだけ共有 |
| OpenRouter APIキー | Worker Secret／ローカルの除外済みファイル | コード・チャット・ブラウザへ出さない |
| Cloudflare API Token | 自動デプロイ導入時のGitHub Actions Secret | 必要になってから最小権限で発行 |
| モデルID・LLM有効設定 | Worker設定 | 非秘密。運営側で変更可能にする |
| 許可Origin | Worker設定 | 非秘密 |

もしキーを誤って公開したら、最初に発行元で失効・再発行し、Worker Secretを更新する。ファイルから削除するだけではGit履歴に残るキーを無効化できない。

## 9. 費用を抑える運用

- GitHub Pagesは公開リポジトリ＋GitHub Freeを初期案とする。[1]
- CloudflareはFreeから開始する。Durable ObjectsはSQLiteを使用し、WorkerとDurable Objectsそれぞれの上限を確認する。無料枠の上限到達時に正常動作し続ける前提にしない。[5]
- OpenRouter無料モデルで始め、有料モデルへの切替は明示的に行う。デモ前に利用制限・残高・応答速度を確認する。[8]
- 有料利用時は、キーの予算設定に加え、アプリ側でも呼び出し回数等を制限する。
- 課金通知は強制停止とは異なる。通知だけを予算上限として扱わない。
- LLMを止めてもゲーム本体は使えるようにし、混雑時は定型文に切り替える。

具体的な月額や無料枠の件数はプラン変更に左右されるため、この資料では固定しない。確認先は末尾の公式資料を使用する。

## 10. 公開前の確認表

| 確認 | 合格条件 |
|---|---|
| Pages | 公開URLから画面・画像・JSが読み込める |
| API | Pagesからセッション作成・プレイができる |
| セッション分離 | 別ブラウザで起動したゲームが互いに影響しない |
| ゲーム進行 | Easyで終了でき、停止中はゲーム内時計が進まない |
| LLMなし | キー未設定またはLLM無効でも完走できる |
| LLMあり | 固定のゲーム結果と矛盾しない補助説明が表示される |
| 通信失敗 | タイムアウト・利用制限でも操作不能にならない |
| キー管理 | 配信JS・Networkレスポンス・リポジトリにキーがない |
| 公開API | レート制限・LLM回数制限・無効化設定が機能する |
| デバッグ | セッションIDとイベントログで問題を追える。秘密情報はログにない |

よくある問題：

| 症状 | 最初に確認すること |
|---|---|
| Pagesが404 | workflow成功、PagesのSource、公開URLのリポジトリ名 |
| HTMLは出るが画面が空白 | `/ootani-incident/` のbase path、JS取得エラー |
| APIは直接開けるが画面から失敗 | Origin設定、OPTIONS処理、HTTPS、API URL |
| OpenRouterが401 | Secret名、対象Worker・環境、キー失効の有無 |
| OpenRouterが429 | 利用制限。繰り返し自動再試行せず定型文へ切替 |
| Durable Object関連エラー | SQLiteマイグレーション、クラス名、binding設定 |
| WSLから認証できない | Wranglerの案内、ブラウザ側の認証完了、同じWSL環境での実行 |

## 11. 実装担当への引き継ぎテンプレート

以下を埋めればよい。**APIキー・パスワード・トークンの値は記載しない。**

```text
GitHubユーザー名：
リポジトリURL：
リポジトリの公開設定：Public / Private
Cloudflareへのログイン：完了 / 未完了
Cloudflare配置先：個人 / 組織（必要なら名称）
OpenRouterへのログイン：完了 / 未完了
LLM利用方針：無料モデルのみ / 予算あり
予算ありの場合の上限希望：
開発環境：Windows + WSL / その他
Git・Node.js・npmの準備：完了 / 未完了

実装後に追記：
Pages URL：
Worker URL：
OPENROUTER_API_KEYのSecret登録：完了 / 未完了
```

ここまでのアカウント準備が終われば、次は最小のゲーム本体を実装できる。PagesやLLMが未接続でも、まずローカルで1シナリオを完走できる形から進める。

## 12. 公式資料

以下を2026-11-06時点の準備資料として参照。管理画面の文言や無料枠は変わる可能性がある。

1. [GitHub Pages Quickstart](https://docs.github.com/en/pages/quickstart) — Pagesの利用条件。
2. [GitHub Pages：公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)／[サイト作成](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) — Actionsとプロジェクトサイト。
3. [Cloudflare Workers：Getting started](https://developers.cloudflare.com/workers/get-started/guide/) — 開発・デプロイ。
4. [Wrangler：General commands](https://developers.cloudflare.com/workers/wrangler/commands/general/) — login・whoami。
5. [Durable Objects：Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)／[Limits](https://developers.cloudflare.com/durable-objects/platform/limits/) — SQLite・無料枠・制限。
6. [Workers：Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)／[Environments](https://developers.cloudflare.com/workers/wrangler/environments/) — Secretと環境別設定。
7. [OpenRouter：Quickstart](https://openrouter.ai/docs/quickstart)／[API Keys](https://openrouter.ai/settings/keys) — 接続とキー管理。
8. [OpenRouter：Limits](https://openrouter.ai/docs/api-reference/limits) — 最新の利用制限。
