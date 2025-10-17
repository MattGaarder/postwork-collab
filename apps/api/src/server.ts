import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';

import { prisma } from './services/prisma'
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:9000', credentials: true }));
app.use(express.json());
app.use(pino());

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);

app.get('/health', async (_, res) => {
    // make a test user array in prisma seed in a sec
    const users = await prisma.user.findMany();
    res.json({ ok: true, userCount: users.length })
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running at localhost:${PORT}`))