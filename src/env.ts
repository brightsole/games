import { cleanEnv, str } from 'envalid';

const env = cleanEnv(process.env, {
  TABLE_NAME: str({
    desc: 'DynamoDB table name for games',
    default: 'ABJECT_FAILURE', // keep it from hard erroring if you screw up env vars
  }),
  AWS_REGION: str({ default: 'ap-southeast-2' }),
  HOPS_API_URL: str({
    desc: 'URL for the Hops words service API',
  }),
  ADMIN_USER_ID: str({
    desc: 'Used to auth gate admin/bot actions, like setting pub date',
    default: '', // still falsy so we don't accidentally give admin powers
  }),
  NODE_ENV: str({
    choices: ['development', 'test', 'production', 'staging'],
    default: 'development',
  }),
});

export default {
  region: env.AWS_REGION,
  tableName: env.TABLE_NAME,
  hopsApiUrl: env.HOPS_API_URL,
  adminUserId: process.env.ADMIN_USER_ID,
  isProduction: env.NODE_ENV === 'production',
};
