# infralab-cdk

インフラ学習ラボの AWS 構成（第1以降）を AWS CDK（TypeScript）で管理するリポジトリです。

## 方針

- **このリポジトリがインフラの正本**
- 変更はコード → `cdk diff` → `cdk deploy`（プロファイル `infralab`、リージョン `ap-southeast-2`）
- デプロイ結果の確認はコンソール
- 学習ノート（`infra-lab` の journal など）は含めない
- アプリ本体は別リポジトリ `infralab-be`

## 初回（既存コンソール資源を片付けたあと）

```bash
aws login --profile infralab
npm install
npx cdk bootstrap aws://ACCOUNT/ap-southeast-2 --profile infralab
# GitHub 接続 ARN を渡せるようにしてから
npx cdk diff --profile infralab
npx cdk deploy --profile infralab
```

アカウント ID や接続 ARN はチャットや README に書かない。

## 構成

| パス | 内容 |
|---|---|
| `bin/phase1.ts` | 入口 |
| `lib/phase1-stack.ts` | スタック |
| `lib/network.ts` | VPC・SG |
| `lib/compute.ts` | ECR・ECS・ALB |
| `lib/database.ts` | RDS |
| `lib/pipeline.ts` | CodePipeline |

## 注意

- ALB は deploy すると時間課金が始まる（停止不可。不要なら削除）
- DB パスワードは生成シークレット。値はコンソールで確認
- GitHub 接続はコンソールの一度きり承認。ARN はコードに直書きしない
