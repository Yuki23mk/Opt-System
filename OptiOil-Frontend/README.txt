# OptiOil プロジェクト

## 構成概要

本プロジェクトはフロントエンドとバックエンドを分離した構成で運用しています。

C:\Users\sayu0\OptiOil-API → バックエンド (Prisma, SQLite, API) 
C:\Users\sayu0\OptiOil-Frontend → フロントエンド (Next.js App Router)
-----------------------------
## 📂 ディレクトリ構成

OptiOil-API 
├─ prisma │ 
├─ schema.prisma 
│ └─ seed.js 
├─ .env 
├─ package.json 
└─ その他設定ファイル

OptiOil-Frontend 
├─ app │ 
├─ products 
│ └─ page.tsx 
├─ orders 
│ ├─ page.tsx
│ │ └─ [orderId] │
 │ └─ page.tsx 
 │ └─ api
 │ └─ orders 
 │ ├─ route.ts
 │ └─ [orderId]
 │ └─ route.ts
 ├─ components
 │ └─ ui (shadcn/ui)
 ├─ next.config.js
      └─ その他設定ファイル
      
      

----------------------

## 🚀 セットアップ方法

### ① バックエンド (OptiOil-API)

```bash
cd C:\Users\sayu0\OptiOil-API

# 依存パッケージインストール
npm install

# データベースマイグレーション & seed実行
npx prisma migrate dev --name init
npx prisma db seed

# APIサーバー起動
npm run dev
-------------------------
②フロントエンド
cd C:\Users\sayu0\OptiOil-Frontend

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm run dev
----------------------
🌐 アクセス方法
機能	URL
ログイン画面	http://localhost:3000/login
製品一覧ページ	http://localhost:3000/products
注文履歴ページ	http://localhost:3000/orders
注文履歴詳細ページ	http://localhost:3000/orders/[orderId]
