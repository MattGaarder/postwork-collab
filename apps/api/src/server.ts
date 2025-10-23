import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';



import http from 'http';



const app = express();
import { prisma } from './services/prisma'

import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { versionsRouter } from './routes/versions';

app.use(cors({ origin: 'http://localhost:9000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(pino());

const JWT = process.env.JWT;

if (!JWT) {
  throw new Error('JWT_TOKEN not set');
}

console.log("here is the JWT", JWT);

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/projects', versionsRouter);

app.get('/health', async (_, res) => {
    // make a test user array in prisma seed in a sec
    const users = await prisma.user.findMany();
    res.json({ ok: true, userCount: users.length })
});






const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running at localhost:${PORT}`))