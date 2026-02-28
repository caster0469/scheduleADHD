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
- `PATCH /api/items/:id` (done の更新を含む)
- `DELETE /api/items/:id`
- `GET /api/todos`
- `POST /api/todos`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`

## 主な変更点（UI修正 + 不具合修正 + 軽機能追加）

- CategoryObject を追加し、絵文字カテゴリを背景オブジェクトとして大型化（sm/md/lg でサイズ制御、ラベルは太字ピル+blur）。
- Homeフローで完了トグルを実装（完了→未完了に戻せる）。done は削除扱いにせず時刻順を維持。
- カレンダーの月送り・選択日・曜日グリッド生成をローカル日付ベース (`YYYY-MM-DD`) で再実装し、日付ずれを回避。
- 予定ドット色を種別に合わせて修正（move=緑、deadline=黄、その他=モノクロ）。
- TODO追加フォームを実装し、空文字追加・二重追加・入力クリア漏れを防止。
- TODO/Item の更新は optimistic update + 再取得で不整合を減らし、削除/完了切替の反映遅延を解消。
- モバイルでタップ要素を 44px 以上に統一し、横はみ出しやスクロール不能が起きにくいレイアウトへ調整。
- タイマー/開始/後で/集中関連UIを削除し、予定入力・可視化・完了状態切替に機能を限定。
- Prisma マイグレーションを追加し、`Item.done` を永続化対象として維持しつつ `memo` ベースのモデルへ整理。

## データモデル

`Item`: `id, type, category, title, date, time, memo, done, createdAt, updatedAt`

