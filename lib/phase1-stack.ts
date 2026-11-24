import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Network } from './network';
import { Database } from './database';
import { Compute } from './compute';
import { Pipeline } from './pipeline';

/**
 * 第1フェーズ全体の転写。
 * コンソールで作った順（ネットワーク → DB → 実行基盤 → パイプライン）に近い組み立て。
 */
export class Phase1Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'Network');

    new Database(this, 'Database', {
      vpc: network.vpc,
      securityGroup: network.dbSecurityGroup,
    });

    const compute = new Compute(this, 'Compute', {
      vpc: network.vpc,
      albSecurityGroup: network.albSecurityGroup,
      taskSecurityGroup: network.taskSecurityGroup,
    });

    new Pipeline(this, 'Pipeline', {
      repository: compute.repository,
      service: compute.service,
    });
  }
}
