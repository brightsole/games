import type { Model } from 'dynamoose/dist/Model';
import type { Item as DynamooseItem } from 'dynamoose/dist/Item';
import type {
  Context as LambdaContext,
  APIGatewayProxyEventV2,
  APIGatewayProxyEvent,
} from 'aws-lambda';
import { createGameController } from './gameController';

export type GatewayEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;

export interface LambdaContextFunctionArgument {
  event: GatewayEvent;
  context: LambdaContext;
}

export type DBGame = DynamooseItem & {
  id: string;
  ownerIds: string;
  wordsKey: string;
  words: string[];
  isDraft: boolean;
  looksNaughty: boolean;
  publishDate?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ModelType = Model<DBGame>;

export type Context = {
  gameController: ReturnType<typeof createGameController>;
  ownerId?: string;
  event: unknown;
};
