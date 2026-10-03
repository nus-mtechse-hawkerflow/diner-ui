const fs = require('fs');

const envConfigFile = `export const environment = {
  cognito: {
    userPoolId: '${process.env.COGNITO_USER_POOL_ID}',
    userPoolClientId: '${process.env.COGNITO_CLIENT_ID}',
    region: '${process.env.AWS_REGION}',
    endpoint: '${process.env.COGNITO_ENDPOINT}'
  },
  api: {
    hawkerStallsUrl: '${process.env.HAWKER_STALLS_URL}',
    orderSubmitUrl: '${process.env.ORDER_SUBMIT_URL}',
    orderQueueUrl: '${process.env.ORDER_QUEUE_URL}',
    customerRegisterUrl: '${process.env.CUSTOMER_REGISTER_URL}',
    customerCheckAccountUrl: '${process.env.CUSTOMER_CHECK_ACCOUNT_URL}',
    customerUserBaseUrl: '${process.env.CUSTOMER_USER_BASE_URL}',
    customerUpdateOrderUrl: '${process.env.CUSTOMER_UPDATE_ORDER_URL}'
  },
  sns: {
    orderStatusTopicArn: '${process.env.ORDER_STATUS_TOPIC_ARN}'
  }
};
`;

fs.writeFileSync('./src/environments/environment.ts', envConfigFile);