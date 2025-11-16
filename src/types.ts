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
  status: 'draft' | 'ready' | 'published';
  ownerIds: string;
  wordsKey: string;
  words: string[];
  looksNaughty: boolean;
  publishDate?: Date;
  publishMonth?: string; // Format: YYYY-MM
  createdAt: Date;
  updatedAt: Date;
};

export type ModelType = Model<DBGame>;

export type Context = {
  gameController: ReturnType<typeof createGameController>;
  ownerId?: string;
  event: unknown;
};
