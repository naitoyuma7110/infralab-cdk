import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface PipelineProps {
  repository: ecr.IRepository;
  service: ecs.FargateService;
  /**
   * コンソールの接続 infralab-github の ARN。
   * ここに本物を書くとノートに秘密・識別情報が載るので、synth 時はダミーのままでよい。
   */
  codestarConnectionArn?: string;
}

/**
 * コンソール対応:
 * - CodePipeline infralab-be（V2）
 * - Source（GitHub main）→ Build（CodeBuild + buildspec.yml）→ Deploy（ECS）
 *
 * GitHub 接続のブラウザ承認はコード化できない。ARN は外から渡す。
 */
export class Pipeline extends Construct {
  readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);

    const sourceOutput = new codepipeline.Artifact('SourceArtifact');
    const buildOutput = new codepipeline.Artifact('BuildArtifact');

    const project = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'infralab-be',
      // コンソール: amazonlinux-aarch64-standard:3.0 / privileged / arm
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL,
      },
      // リポジトリの buildspec.yml を使う（ファイル指定）
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });

    props.repository.grantPullPush(project);

    // パイプラインロール相当: タスク定義登録とサービス更新
    const pipelineRole = new iam.Role(this, 'PipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'infralab-be',
      pipelineType: codepipeline.PipelineType.V2,
      executionMode: codepipeline.ExecutionMode.SUPERSEDED,
      role: pipelineRole,
      // 学習用。既存の artifact バケットとは別物になる
      restartExecutionOnUpdate: false,
    });

    const connectionArn =
      props.codestarConnectionArn ??
      'arn:aws:codeconnections:ap-southeast-2:000000000000:connection/replace-me';

    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'Source',
          owner: 'naitoyuma7110',
          repo: 'infralab-be',
          branch: 'main',
          connectionArn,
          output: sourceOutput,
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'Deploy',
          service: props.service,
          input: buildOutput,
        }),
      ],
    });
  }
}
