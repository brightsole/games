/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'games-service',
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
        publishMonth: 'string',
        status: 'string',
      },
      primaryIndex: { hashKey: 'id' },
      globalIndexes: {
        ownerIds: { hashKey: 'ownerIds' },
        wordsKey: { hashKey: 'wordsKey' },
        publishMonth: { hashKey: 'publishMonth' },
        status: { hashKey: 'status', rangeKey: 'publishMonth' },
      },
      deletionProtection: $app.stage === 'production',
    });

    const api = new sst.aws.ApiGatewayV2('Api', {
      link: [gamesTable],
    });

    // Daily cron job to schedule unpublished games
    new sst.aws.Cron('PublishGames', {
      // Run at 2am UTC daily
      schedule: 'cron(0 2 * * ? *)',
      job: {
        handler:
          $app.stage === 'production'
            ? 'src/gameApprover/production.handler'
            : 'src/gameApprover/preview.handler',
        runtime: 'nodejs22.x',
        timeout: '5 minutes',
        memory: '512 MB',
        nodejs: {
          format: 'esm',
        },
        environment: {
          TABLE_NAME: gamesTable.name,
        },
      },
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

    const internalAuth = await aws.secretsmanager.getSecretVersionOutput({
      secretId: `jumpingbeen/${$app.stage}/internal-lockdown`,
    });

    const authSecrets = internalAuth.secretString.apply((s) => JSON.parse(s!));

    const functionConfig = {
      runtime: 'nodejs22.x' as const,
      timeout: '20 seconds' as const,
      memory: '1024 MB' as const,
      nodejs: {
        format: 'esm' as const,
      },
      environment: {
        TABLE_NAME: gamesTable.name,
        HOPS_API_URL: hopsApiUrl.value,
        INTERNAL_SECRET_HEADER_NAME: authSecrets.apply(
          (v) => v.INTERNAL_SECRET_HEADER_NAME,
        ),
        INTERNAL_SECRET_HEADER_VALUE: authSecrets.apply(
          (v) => v.INTERNAL_SECRET_HEADER_VALUE,
        ),
      },
    };

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
      graphApiUrl: api.url.apply((api) => `${api}/graphql`),
      restApiUrl: api.url.apply((api) => `${api}/games`),
      usersTableName: gamesTable.name,
    };
  },
});
