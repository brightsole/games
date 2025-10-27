import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { startController } from './gameController';

export const createRestApp = () => {
  const app = express();
  const gameController = startController();

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());

  app.get('/games/:id', async (req, res) => {
    const game = await gameController.getById(req.params.id);
    res.json(game);
  });

  app.get('/games', async (req, res) => {
    const ownerId = req.query.ownerId || req.header('x-user-id');

    const games = await gameController.listByOwner(ownerId as string);
    res.json(games);
  });

  app.post('/games', async (req, res) => {
    const game = await gameController.create(req.body, req.header('x-user-id'));
    res.status(201).json(game);
  });

  app.put('/games/:id', async (req, res) => {
    const game = await gameController.update(
      req.params.id,
      req.body,
      req.header('x-user-id'),
    );
    res.json(game);
  });

  // deleting would be dumb; people could just put it back
  // and unpublishing is also bad, because then people lose their games

  return app;
};

export const handler = serverlessExpress({ app: createRestApp() });
