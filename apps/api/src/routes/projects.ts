import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

async function assertProjectMember(projectId: number, userId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return false;
    if(project.ownerId === userId) return true;
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId } })
    return !!member;
}

projectsRouter.get('/', asyncHandler(async (req: any, res: any) => {
    const projects = await prisma.project.findMany({ 
        where: { 
            OR: [
                { ownerId: req.user.id },
                { members: { some: { userId: req.user.id } } }
            ]
        },
        include: {
            owner: { select: { id: true, name: true, email: true } }
        }
    });
    res.json(projects);
}));

projectsRouter.get('/:id/code', asyncHandler(async (req: any, res: any) => {
    const id = Number(req.params.id);
    
    if (!(await assertProjectMember(id, req.user.id))) {
        return res.status(403).json({ error: 'No permissions'});
    }

    const project = await prisma.project.findUnique({ where: { id }});
    if(!project) return res.status(404).json({ error: 'Not found'});
    
    res.json({
        code: project.code ?? '',
        language: project.language ?? 'JavaScript',
    })
}));

projectsRouter.put('/:id/code', asyncHandler(async (req: any, res: any) => {
    const id = Number(req.params.id);
    const { code, language } = req.body;

    if (!(await assertProjectMember(id, req.user.id))) {
        return res.status(403).json({ error: 'No permissions'});
    }

    const project = await prisma.project.findUnique({ where: { id }});
    if(!project) return res.status(404).json({ error: 'Not found'});
    
    const updated = await prisma.project.update({
        where: { id },
        data: {
            code,
            language: language ?? project.language,
            updatedAt: new Date(),
        }
    });
    
    req.app.get('io').to(`project${id}`).emit('code:replace', {
        code: updated.code,
    })
    res.json({ code: updated.code, language: updated.language });
}));

projectsRouter.post('/', asyncHandler(async (req: any, res: any) => {
    const { name, description, code, language } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const project = await prisma.project.create({
        data: {
            owner: { connect: { id: req.user.id }},
            name,
            description: description ?? null,
            code: code ?? '',
            language: language ?? 'javascript',
        }
    });
    res.status(201).json(project);
}));

projectsRouter.delete('/:id', asyncHandler(async (req: any, res: any) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id }});
    
    if(!project || project.ownerId !== req.user.id ) return res.status(404).json({ error: 'Project not found' });
    
    await prisma.project.delete({ where: { id }});
    res.status(204).send();
}));

projectsRouter.post('/:id/members', asyncHandler(async (req: any, res: any) => {
    const projectId = Number(req.params.id);
    const { emailOrName } = req.body;

    if (!emailOrName) return res.status(400).json({ error: 'Email or name is required' });

    // 1. Verify project ownership
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Only owners can invite members' });
    }

    // 2. Find the user to invite
    const userToInvite = await prisma.user.findFirst({
        where: {
            OR: [
                { email: emailOrName },
                { name: emailOrName }
            ]
        }
    });

    if (!userToInvite) return res.status(404).json({ error: 'User not found' });
    if (userToInvite.id === req.user.id) return res.status(400).json({ error: 'You cannot invite yourself' });

    // 3. Create or update membership
    try {
        const membership = await prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId,
                    userId: userToInvite.id
                }
            },
            update: { role: 'MAINTAINER' },
            create: {
                projectId,
                userId: userToInvite.id,
                role: 'MAINTAINER'
            }
        });
        res.status(201).json(membership);
    } catch (error) {
        console.error('Failed to invite member:', error);
        res.status(500).json({ error: 'Failed to invite member' });
    }
}));
