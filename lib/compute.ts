import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

export interface ComputeProps {
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  taskSecurityGroup: ec2.ISecurityGroup;
}

/**
 * コンソール対応:
 * - ECR infralab-be
 * - クラスター infralab / サービス infralab / タスク定義・コンテナ infralab-be
 * - ALB infralab-alb、TG infralab-be、HTTP 80 → 3000、/health
 */
export class Compute extends Construct {
  readonly repository: ecr.Repository;
  readonly cluster: ecs.Cluster;
  readonly service: ecs.FargateService;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: 'infralab-be',
      imageTagMutability: ecr.TagMutability.MUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: 'Expire untagged after 1 day',
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: Duration.days(1),
        },
        {
          description: 'Keep newest 5 images',
          tagStatus: ecr.TagStatus.ANY,
          maxImageCount: 5,
        },
      ],
    });

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'infralab',
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/ecs/infralab-be',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: 'infralab-be',
      cpu: 256,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // 転写用のタグ。実際の実行中タグはパイプラインが差し替える
    const container = taskDefinition.addContainer('infralab-be', {
      containerName: 'infralab-be',
      image: ecs.ContainerImage.fromEcrRepository(this.repository, 'd1f8216a'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup,
      }),
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: 'infralab-alb',
      vpc: props.vpc,
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: false,
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: 'infralab-be',
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 5,
        unhealthyThresholdCount: 2,
      },
    });

    this.loadBalancer.addListener('Http', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([this.targetGroup]),
    });

    this.service = new ecs.FargateService(this, 'Service', {
      serviceName: 'infralab',
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [props.taskSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: Duration.seconds(120),
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // コンテナ参照を残し、未使用警告を避ける
    void container;
  }
}
