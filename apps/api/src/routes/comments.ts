import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';

export const commentsRouter = Router({ mergeParams: true });
commentsRouter.use(requireAuth);

async function assertProjectMember(projectId: number, userId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return false;
    if(project.ownerId === userId) return true;
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId } })
    return !!member;
}

const CreateComment = z.object({
    line: z.number().int().positive(),
    endLine: z.number().int().positive().optional(),
    body: z.string(),
    yAnchor: z.string().optional(),
    // parentId: z.number().int().optional(),
});

// GET /projects/:projectId/comments
// Get comments relevant to a specific version (persists across versions)
commentsRouter.get('/comments', async (req: AuthReq, res) => {
    const projectId = Number(req.params.projectId);
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;

    if (!(await assertProjectMember(projectId, req.user!.id))) {
        return res.status(403).json({ error: 'No permissions' });
    }

    try {
        const where: any = { projectId };
        
        // If versionId is provided, filter comments that:
        // 1. Were created on or before this version
        // 2. Are not yet resolved, OR were resolved on or after this version
        if (versionId) {
            where.versionId = { lte: versionId };
            where.OR = [
                { resolvedVersionId: null },
                { resolvedVersionId: { gte: versionId } }
            ];
        }

        const comments = await prisma.comment.findMany({
            where,
            orderBy: [{ versionId: 'desc' }, { line: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                projectId: true,
                versionId: true,
                resolvedVersionId: true,
                line: true,
                endLine: true,
                content: true,
                originalCode: true,
                yAnchor: true,
                createdAt: true,
                author: { select: { id: true, name: true, email: true } }
            }
        });

        res.json(comments);
    } catch (error) {
        console.error('Error fetching project comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// GET /projects/:projectId/v/:versionId/comments
// Get comments for a specific version (for inline decorations on that version's code)
commentsRouter.get('/v/:versionId/comments', async (req: AuthReq, res) => {
    const projectId = Number(req.params.projectId);
    const versionId = Number(req.params.versionId);

    if (!(await assertProjectMember(projectId, req.user!.id))) {
        return res.status(403).json({ error: 'No permissions' });
    }

    try {
        // Return comments that were active during this version
        const comments = await prisma.comment.findMany({
            where: { 
                projectId,
                versionId: { lte: versionId },
                OR: [
                    { resolvedVersionId: null },
                    { resolvedVersionId: { gte: versionId } }
                ]
            },
            orderBy: [{ line: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                projectId: true,
                versionId: true,
                resolvedVersionId: true,
                line: true,
                endLine: true,
                content: true,
                originalCode: true,
                yAnchor: true,
                createdAt: true,
                author: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(comments);
    } catch (error) {
        console.error('Error fetching version comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// POST /projects/:projectId/v/:versionId/comments
// Create a comment linked to the project (and optionally the version for context)
commentsRouter.post('/v/:versionId/comments', async (req: AuthReq, res) => {
    const projectId = Number(req.params.projectId);
    const versionId = Number(req.params.versionId);

    if (!(await assertProjectMember(projectId, req.user!.id))) {
        return res.status(403).json({ error: 'No permissions' });
    }

    const parsed = CreateComment.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    // Fetch the version to extract original code for context
    let originalCode: string | null = null;
    try {
        const version = await prisma.version.findUnique({
            where: { id: versionId },
            select: { code: true }
        });

        if (version && version.code) {
            const lines = version.code.split('\n');
            const startLine = parsed.data.line - 1; // 0-indexed
            const endLine = (parsed.data.endLine || parsed.data.line) - 1;
            originalCode = lines.slice(startLine, endLine + 1).join('\n');
        }
    } catch (err) {
        console.error('Failed to extract original code:', err);
    }

    try {
        const created = await prisma.comment.create({
            data: {
                projectId,           // Primary link - persists across versions
                versionId,           // Optional reference - which version it was created on
                line: parsed.data.line,
                endLine: parsed.data.endLine,
                content: parsed.data.body,
                originalCode,
                yAnchor: parsed.data.yAnchor,
                authorId: req.user!.id,
            },
            select: {
                id: true,
                projectId: true,
                versionId: true,
                resolvedVersionId: true,
                line: true,
                endLine: true,
                content: true,
                originalCode: true,
                yAnchor: true,
                createdAt: true,
                author: { select: { id: true, name: true, email: true } }
            }
        });
        res.status(201).json(created);
    } catch (error) {
        console.error('Failed to create comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// DELETE /projects/:projectId/v/:versionId/comments/:commentId
// Resolve/delete a comment
commentsRouter.delete('/v/:versionId/comments/:commentId', async (req: AuthReq, res) => {
    const commentId = Number(req.params.commentId);
    const versionId = Number(req.params.versionId);
    const projectId = Number(req.params.projectId);

    if (!(await assertProjectMember(projectId, req.user!.id))) {
        return res.status(403).json({ error: 'No permissions' });
    }

    try {
       await prisma.comment.update({
            where: { id: commentId },
            data: {
                resolvedVersionId: versionId
            }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Failed to resolve comment:', error);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});