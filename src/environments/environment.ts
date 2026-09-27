// Per-developer settings. Each LocalStack creates its own Cognito pool with its
// own IDs: put yours here, then keep them out of commits with
//   git update-index --skip-worktree src/environments/environment.ts
export const environment = {
  cognito: {
    userPoolId: 'us-east-1_d76416bbbdc340c693bde36dac569975',
    userPoolClientId: 'customer_client',
    region: 'us-east-1',
    endpoint: 'http://localhost:4566'
  }
};
