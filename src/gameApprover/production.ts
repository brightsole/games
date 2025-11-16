import { model } from 'dynamoose';
import type { DBGame, ModelType } from '../types';
import GameSchema from '../Game.schema';
import env from '../env';

export const scheduleGamesHandler = async (GameModel: ModelType) => {
  // Query for ready games with READY- prefix (unscheduled)
  const readyGames = await GameModel.query({
    status: { eq: 'ready', using: 'status' },
    publishMonth: { beginsWith: 'READY-' },
    looksNaughty: { eq: false },
  }).exec();

  console.log('Unscheduled ready games:', readyGames);

  if (readyGames.length === 0) {
    return {
      statusCode: 200,
      scheduled: 0,
      message: 'No games need scheduling',
    };
  }

  const [latestGame] = await GameModel.query({ status: { eq: 'published' } })
    .sort('descending')
    .limit(1)
    .attributes(['publishDate'])
    .using('status')
    .exec();

  const now = new Date();
  const latestPublishDate = latestGame
    ? new Date(latestGame.publishDate!)
    : /* should only ever run once */ new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

  const scheduledGames = await Promise.all(
    readyGames.map(async (game, i) => {
      const publishDate = new Date(
        Date.UTC(
          latestPublishDate.getUTCFullYear(),
          latestPublishDate.getUTCMonth(),
          latestPublishDate.getUTCDate() + i + 1,
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

  console.log(`Successfully scheduled ${scheduledGames.length} games`);

  return {
    statusCode: 200,
    scheduled: scheduledGames.length,
    gameIds: scheduledGames,
    message: `Scheduled ${scheduledGames.length} games`,
  };
};

export const handler = async () => {
  const gameModel = model<DBGame>(env.tableName, GameSchema);
  return scheduleGamesHandler(gameModel);
};
