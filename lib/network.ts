import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * コンソール対応:
 * - VPC infralab-vpc（10.0.0.0/16）
 * - 公開サブネット 2a / 2b（NAT なし）
 * - SG: infralab-alb / infralab-task / infralab-db
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc;
  readonly albSecurityGroup: ec2.SecurityGroup;
  readonly taskSecurityGroup: ec2.SecurityGroup;
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // パブリックのみ。natGateways: 0 が無いと NAT が作られ時間課金になる
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'infralab-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: 'infralab-alb',
      description: 'ALB HTTP 80 from browsers',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from browsers',
    );

    this.taskSecurityGroup = new ec2.SecurityGroup(this, 'TaskSg', {
      vpc: this.vpc,
      securityGroupName: 'infralab-task',
      description: 'Task port 3000 from ALB only',
      allowAllOutbound: true,
    });
    this.taskSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'Nest from ALB',
    );

    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: 'infralab-db',
      description: 'PostgreSQL 5432 from tasks only',
      allowAllOutbound: true,
    });
    this.dbSecurityGroup.addIngressRule(
      this.taskSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from tasks',
    );
  }
}
