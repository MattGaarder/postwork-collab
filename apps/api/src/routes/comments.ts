import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
import { ensureVersionAccess } from '../middleware/guards';







export const commentsRouter = Router();
commentsRouter.use(requireAuth);


commentsRouter.get('/v/:versionId/comments', async (req: AuthReq, res) => {
    const versionId = Number(req.params.versionId);
    const access = await ensureVersionAccess(req.user!.id, versionId);
    if(!access.ok) return res.status(access.status).json({error: access.msg});

    const roots = await prisma.comment.findMany({
        where: { versionId, parentId: null },
        orderBy: [{ line: 'asc'}, { createdAt: 'asc' }],
        include: {
            author: {
                select: { id: true, name: true, email: true }
            },
            children: {
                orderBy: { createdAt: 'asc' },
                include: {
                    author: {
                        select: { id: true, name: true, email: true}
                    }
                }
            }
        }
    });
    res.json(roots)
});

const CreateComment = z.object({
    line: z.number().int().positive(),
    body: z.string(),
    parentId: z.number().int().optional(),
});

commentsRouter.post('/v/:versionId/comments', async (req: AuthReq, res) => {
    const versionId = Number(req.params.versionId);
    const parsed = CreateComment.safeParse(req.body);
    if(!parsed.success) return res.status(400).json(parsed.error.flatten());

    const access = await ensureVersionAccess(req.user!.id, versionId);
    if(!access.ok) return res.status(access.status).json({error: access.msg});

    if(parsed.data.parentId) {
        const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId }});
        if(!parent || parent.versionId !== versionId) {
            return res.status(400).json({ error: 'invalid parentId for this version'});
        }
    }
})