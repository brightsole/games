import type { BaseContext, ContextFunction } from '@apollo/server';
import type { LambdaContextFunctionArgument, Context } from './types';
import { startController } from './gameController';

export const setContext: ContextFunction<
  [LambdaContextFunctionArgument],
  BaseContext
> = async ({ event, context }): Promise<Context> => {
  const userId = event.headers['x-user-id'];
  const gameController = startController();

  return {
    ...context,
    ownerId: userId,
    event,
    gameController,
  };
};

export default setContext;
