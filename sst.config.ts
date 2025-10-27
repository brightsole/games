/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'games',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: input?.stage === 'production',
      home: 'aws',
    };
  },
  async run() {
    const gamesTable = new sst.aws.Dynamo('Games', {
      fields: {
        id: 'string',
        ownerIds: 'string',
        wordsKey: 'string',
      },
      primaryIndex: { hashKey: 'id' },
      globalIndexes: {
        ownerIds: { hashKey: 'ownerIds' },
        wordsKey: { hashKey: 'wordsKey' },
      },
      deletionProtection: $app.stage === 'production',
    });

    const api = new sst.aws.ApiGatewayV2('Api', {
      link: [gamesTable],
    });

    // new sst.aws.Cron('KeepWarmCron', {
    //   // every 5 minutes, roughly 8am to 6pm, Mon-Fri, Australia/Sydney time
    //   // keeps it warm at all times during business hours
    //   schedule: 'cron(*/5 21-23,0-8 ? * SUN-FRI *)',
    //   job: {
    //     handler: 'src/keepWarm.handler',
    //     environment: {
    //       PING_URL: api.url,
    //     },
    //   },
    // });

    // Store the API URL as a CloudFormation output for federation lookup
    new aws.ssm.Parameter('GamesApiUrl', {
      name: `/sst/${$app.name}/${$app.stage}/api-url`,
      type: 'String',
      value: api.url,
      description: `API Gateway URL for ${$app.name} ${$app.stage}`,
    });
    const hopsApiUrl = await aws.ssm.getParameter({
      name: `/sst/words-service/${$app.stage}/api-url`,
    });

    const functionConfig = {
      runtime: 'nodejs22.x',
      timeout: '20 seconds',
      memory: '1024 MB',
      nodejs: {
        format: 'esm',
      },
      environment: {
        TABLE_NAME: gamesTable.name,
        HOPS_API_URL: hopsApiUrl.value,
      },
    } as const;

    api.route('ANY /graphql', {
      ...functionConfig,
      handler: 'src/graphqlHandler.handler',
    });

    api.route('ANY /games', {
      ...functionConfig,
      handler: 'src/restHandler.handler',
    });

    api.route('ANY /games/{proxy+}', {
      ...functionConfig,
      handler: 'src/restHandler.handler',
    });

    return {
      apiUrl: api.url,
      usersTableName: gamesTable.name,
    };
  },
});
