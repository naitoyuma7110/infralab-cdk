import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

export interface DatabaseProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
}

/**
 * コンソール対応:
 * - RDS infralab-db（PostgreSQL、db.t4g.micro、シングル AZ）
 * - サブネットグループ infralab-db-subnets（公開 2a / 2b）
 * - バックアップ 1 日、パブリックアクセスなし、削除保護オン
 *
 * パスワードはコードに書かない。合成用に生成シークレットを使う。
 * 既存インスタンスの手入力パスワードとは別物。
 */
export class Database extends Construct {
  readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      instanceIdentifier: 'infralab-db',
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      // コンソールでは 18 系だった。synth 对照用に無料プランで使いやすい系を置く。
      // 正確なマイナーはコンソールのエンジン版と突き合わせる。
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [props.securityGroup],
      publiclyAccessible: false,
      multiAz: false,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      storageEncrypted: true,
      databaseName: 'infralab',
      credentials: rds.Credentials.fromGeneratedSecret('infralab', {
        secretName: 'infralab/phase1-cdk/db',
      }),
      backupRetention: Duration.days(1),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cloudwatchLogsExports: [],
    });
  }
}
