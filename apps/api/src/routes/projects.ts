import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';
// import { error } from 'console';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req: AuthReq, res) => {
    // Non-null assertion (OK if your middleware always sets req.user)
    const projects = await prisma.project.findMany({ where: { ownerId: req.user!.id } });
    res.json(projects);
})

const CreateProject = z.object({
    name: z.string().min(1),
    description: z.string().optional()
});

projectsRouter.post('/', async (req: AuthReq, res) => {
    const parsedProject = CreateProject.safeParse(req.body);
    if(!parsedProject.success) return res.status(400).json(parsedProject.error.flatten());
    const { name, description } = parsedProject.data;
    const project = await prisma.project.create({
        data: {
            // Non-null assertion (OK if your middleware always sets req.user)
            ownerId: req.user!.id,
            name,
            description: description ?? null,
        }
    });
    res.status(201).json(project);
});

projectsRouter.delete('/:id', async (req: AuthReq, res) => {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id }});
        if(!project || project.ownerId !== req.user!.id ) return res.status(404).json({ error: 'Project not found' });
            await prisma.project.delete({ where: { id }});
            res.status(204).send();
});