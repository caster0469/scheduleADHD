# YANREPHOUSE (Node/Express セキュア寄りスターター)

公開ページ + 管理者ログイン + 管理画面から更新（SQLite保存）までの最小構成。

## できること
- 公開ページ
  - `/` トップ + 商品一覧
  - `/product/:id` 商品詳細
- 管理ページ（ログイン必須）
  - `/admin` ダッシュボード
  - `/admin/page/home` トップ編集
  - `/admin/products` 商品CRUD
  - 画像はURL or アップロード（2MB / magic-bytesチェック）

## セキュリティ（最低限）
- パスワード: bcryptハッシュ（DBに平文保存しない）
- セッション: httpOnly / sameSite=lax / productionでsecure
- セッションストア: SQLite（connect-sqlite3）で永続化
- CSRF: セッションに保存したトークンでフォームPOSTを検証（自前）
- ログイン総当たり対策: rate-limit（/admin/login POST）

> まだ“本番完成”ではないです。運用するなら:
> - HTTPS (Nginx/Cloudflare)
> - CSPの導入（必要なら）
> - 管理者の2FA
> - バックアップ（data.sqlite / uploads）
> - 画像のウイルススキャンやS3移行
> などを追加推奨。

## セットアップ
```bash
npm install
cp .env.example .env
# .env を編集（ADMIN_PASS / SESSION_SECRET を必ず変える）
npm run dev
```

起動: http://localhost:3000  
管理: http://localhost:3000/admin/login

## .env
- ADMIN_USER / ADMIN_PASS: 初回起動時にDBへ作成
- SESSION_SECRET: 強いランダム文字列にする（必須）

## メモ
- DBファイル: `data.sqlite`
- セッションDB: `sessions.sqlite`
- アップロード: `public/uploads`
