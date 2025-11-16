import { model } from 'dynamoose';
import type { DBGame, ModelType } from '../types';
import GameSchema from '../Game.schema';
import env from '../env';

export const scheduleGamesHandler = async (GameModel: ModelType) => {
  const allGames = await GameModel.scan().exec();

  if (allGames.length === 0) {
    return {
      statusCode: 200,
      scheduled: 0,
      message: 'No games found in preview table',
    };
  }

  // Start from today and publish backwards in time
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const scheduledGames = await Promise.all(
    allGames.map(async (game, i) => {
      // Publish backwards: today, yesterday, day before, etc.
      const publishDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - i,
        ),
      );

      const publishMonth = `${publishDate.getUTCFullYear()}-${String(publishDate.getUTCMonth() + 1).padStart(2, '0')}`;

      await GameModel.update(
        { id: game.id },
        { publishDate, publishMonth, status: 'published' },
      );

      return game.id;
    }),
  );

  console.log(
    `Successfully scheduled ${scheduledGames.length} games backwards from today`,
  );

  return {
    statusCode: 200,
    scheduled: scheduledGames.length,
    gameIds: scheduledGames,
    message: `Scheduled ${scheduledGames.length} games backwards in time`,
  };
};

export const handler = async () => {
  const gameModel = model<DBGame>(env.tableName, GameSchema);
  return scheduleGamesHandler(gameModel);
};
