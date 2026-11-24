#!/usr/bin/env node
/**
 * 第1フェーズ CDK 転写の入口。
 * deploy せず、synth でテンプレートを確認する。
 */
import * as cdk from 'aws-cdk-lib';
import { Phase1Stack } from '../lib/phase1-stack';

const app = new cdk.App();

new Phase1Stack(app, 'InfralabPhase1Stack', {
  // 合成用。既存アカウントへの deploy は想定しない
  env: {
    region: 'ap-southeast-2',
  },
  description: '第1フェーズ構成の転写（学習用・synth のみ）',
});

app.synth();
