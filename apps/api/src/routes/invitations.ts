import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const invitationsRouter = Router();
invitationsRouter.use(requireAuth);

// Get all pending invitations for the current user
invitationsRouter.get('/', asyncHandler(async (req: any, res: any) => {
    const invitations = await prisma.projectMember.findMany({
        where: {
            userId: req.user.id,
            status: 'PENDING'
        },
        include: {
            project: {
                include: {
                    owner: { select: { id: true, name: true, email: true } }
                }
            }
        }
    });
    res.json(invitations);
}));

// Accept an invitation
invitationsRouter.put('/:projectId/accept', asyncHandler(async (req: any, res: any) => {
    const projectId = Number(req.params.projectId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId: req.user.id
            }
        }
    });

    if (!membership) return res.status(404).json({ error: 'Invitation not found' });
    if (membership.status === 'ACCEPTED') return res.status(400).json({ error: 'Invitation already accepted' });

    const updated = await prisma.$transaction(async (tx) => {
        const up = await tx.projectMember.update({
            where: { id: membership.id },
            data: { status: 'ACCEPTED' }
        });

        // Event for the Invitee (the one who accepted)
        await tx.pointsTransaction.create({
            data: {
                userId: req.user.id,
                actionType: 'INVITATION_ACCEPTED',
                points: 5, // Reward for joining
                projectId,
                performerId: req.user.id
            }
        });

        // Event for the Inviter (the project owner)
        await tx.pointsTransaction.create({
            data: {
                userId: project.ownerId,
                actionType: 'INVITATION_ACCEPTED',
                points: 10, // Reward for successfully collaborating
                projectId,
                performerId: req.user.id
            }
        });

        await tx.user.update({ where: { id: req.user.id }, data: { points: { increment: 5 } } });
        await tx.user.update({ where: { id: project.ownerId }, data: { points: { increment: 10 } } });

        return up;
    });

    res.json(updated);
}));

// Decline/Cancel an invitation
invitationsRouter.delete('/:projectId/decline', asyncHandler(async (req: any, res: any) => {
    const projectId = Number(req.params.projectId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId: req.user.id
            }
        }
    });

    if (!membership) return res.status(404).json({ error: 'Invitation not found' });

    await prisma.$transaction(async (tx) => {
        await tx.projectMember.delete({ where: { id: membership.id } });

        // Event for the Inviter (so they know it was declined)
        await tx.pointsTransaction.create({
            data: {
                userId: project.ownerId,
                actionType: 'INVITATION_DECLINED',
                points: 0,
                projectId,
                performerId: req.user.id
            }
        });
    });
    res.status(204).send();
}));
