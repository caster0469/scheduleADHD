# scheduleADHD (MVP)

モック画像優先で、ADHD向け予定管理アプリを monorepo 構成で実装しています。

## 構成

- `frontend/`: Vite + React + TypeScript
- `backend/`: Express + TypeScript
- `prisma/`: SQLite schema

## セットアップ

1. 依存関係インストール

```bash
npm install
```

2. 環境変数作成

```bash
cp .env.example .env
```

3. Prismaクライアント生成 & マイグレーション

```bash
npm run db:generate
npm run db:migrate
```

4. （任意）初期データ投入

```bash
npm run db:seed
```

5. 開発サーバー起動（frontend + backend 同時起動）

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## API

- `GET /api/items?date=YYYY-MM-DD`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`
- `GET /api/todos`
- `POST /api/todos`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`

## 主なUIコンポーネント

- Home（今日のフロー）
  - 一本道の縦フローレール
  - NOWカード、タイプ別3Dブロック、時刻表示
  - 「5分だけ」ミニタイマー（遷移なし）
- Calendar
  - 月グリッド + 日付の予定一覧（PCは2カラム）
- TODO
  - チェックリスト + フィルタ（未完了/今日/今週）
- 追加UI
  - スマホ: Bottom Sheet
  - PC: ダイアログ風シート

## 今後の拡張前提

- 認証なしMVPのため、ユーザー概念は未導入
- DBはSQLiteだがPrisma採用でPostgresへ移行しやすい構成
