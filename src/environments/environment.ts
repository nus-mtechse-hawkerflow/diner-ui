// Per-developer settings. Each LocalStack creates its own Cognito pool with its
// own IDs: put yours here, then keep them out of commits with
//   git update-index --skip-worktree src/environments/environment.ts
export const environment = {
  cognito: {
    userPoolId: 'userpoolid',
    userPoolClientId: 'userpoolclientid',
    region: 'ap-southeast-1',
    endpoint: 'localhost:4566'
  },
  sns: {
    orderStatusTopicArn: 'arn:aws:sns:ap-southeast-1:000000000000:order_status'
  },
  api: {
    hawkerStallsUrl: 'http://localhost:8080/hawker/v1/hawker/stalls',
    orderSubmitUrl: 'http://localhost:8082/order/v1/order/orders',
    orderQueueUrl: 'http://localhost:8082/order/v1/order/orders/queue',
    customerRegisterUrl: 'http://localhost:8081/customer/v1/customer/register',
    customerCheckAccountUrl: 'http://localhost:8081/customer/v1/customer/check_account_exist',
    customerUserBaseUrl: 'http://localhost:8081/customer/v1/customer/user',
    customerUpdateOrderUrl: 'http://localhost:8081/customer/v1/customer/user/update_order'
  }
};
