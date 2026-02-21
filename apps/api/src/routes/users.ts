import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /users/me/points
usersRouter.get('/me/points', async (req: AuthReq, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: {
                name: true,
                email: true,
                points: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!user) {
             return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user points:', error);
        res.status(500).json({ error: 'Failed to fetch points' });
    }
});
