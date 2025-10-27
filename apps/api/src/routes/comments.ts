import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
// import { ensureVersionAccess } from '../middleware/guards';


export const commentsRouter = Router({ mergeParams: true });
commentsRouter.use(requireAuth);


const CreateComment = z.object({
    line: z.number().int().positive(),
    body: z.string(),
    // parentId: z.number().int().optional(),
});

commentsRouter.get('/v/:versionId/comments', async (req: AuthReq, res) => {
    const versionId = Number(req.params.versionId);
    // const access = await ensureVersionAccess(req.user!.id, versionId);
    // if(!access.ok) return res.status(access.status).json({error: access.msg});

    const roots = await prisma.comment.findMany({
        where: { versionId },
        orderBy: [{ line: 'asc'}, { createdAt: 'asc' }],
        select: {
            id: true,
            versionId: true,
            line: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true }}
        }
    });
    res.json(roots)
});



commentsRouter.post('/v/:versionId/comments', async (req: AuthReq, res) => {
    const versionId = Number(req.params.versionId);
    const parsed = CreateComment.safeParse(req.body);
    if(!parsed.success) return res.status(400).json(parsed.error.flatten());
    
    const created = await prisma.comment.create({
        data: {
            versionId,
            line: parsed.data.line,
            content: parsed.data.body,
            authorId: req.user!.id,
        },
        select: {
            id: true,
            versionId: true,
            line: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true }}
        }
    });
    res.status(201).json(created);
});