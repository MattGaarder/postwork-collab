import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', asyncHandler(async (req: any, res: any) => {
    const projects = await prisma.project.findMany({ where: { ownerId: req.user.id } });
    res.json(projects);
}));

projectsRouter.get('/:id/code', asyncHandler(async (req: any, res: any) => {
    const id = Number(req.params.id);
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

