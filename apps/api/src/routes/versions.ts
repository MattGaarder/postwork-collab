import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { requireAuth, AuthReq } from '../middleware/requireAuth';


export const versionsRouter = Router();
versionsRouter.use(requireAuth);


// owner validation
async function assertProjectMember(projectId: number, userId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return false;
    if(project.ownerId === userId) return true;
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId } })
    return !!member;
}


const CreateVersion = z.object({
    // remove optional later
    code: z.string().optional(),
    language: z.enum(['JAVASCRIPT', 'PYTHON', 'JAVA']).optional()
});

versionsRouter.use((req, _res, next) => {
    console.log('url in versions routes + req.body', req.method, req.originalUrl, 'body=', req.body);
    next();
})

// REQUESTS FOR REAL
// GET /projects/:projectId/v

versionsRouter.get('/:projectId/v', async (req: AuthReq, res) => {
    try {
        // unary operator to force string to number
        const projectId = +req.params.projectId;
        console.log('projectId: (get project versions request)', req.params, 'user: ', req.user);

        if (Number.isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID'})
        }

        const allowed = await assertProjectMember(projectId, req.user!.id);

        if(!allowed) return res.status(403).json({ error: 'Forbidden '});

        const versions = await prisma.version.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                authorId: true,
                createdAt: true,
                updatedAt: true,
                language: true,
            }
        });

        res.json(versions);


    } catch (error) {
        res.status(500).json({ error: 'Server error'});
    }
})


// GET /projects/:projectId/v/:versionId 
// fetch one full version + code

versionsRouter.get('/:projectId/v/:versionId', async (req: AuthReq, res) => {
    try {
        // unary operators to force string to number
        const projectId = +req.params.projectId;
        const versionId = +req.params.versionId;

        console.log('versionId: (get one project version request)', req.params, 'user: ', req.user);

        if (Number.isNaN(projectId) || Number.isNaN(versionId)) {
            return res.status(400).json({ error: 'Invalid projectId or versionId'})
        }

        if (!(await assertProjectMember(projectId, req.user!.id))) {
            return res.status(403).json({ error: 'No persmissions'})
        }
    
        const version = await prisma.version.findFirst({ where: { id: versionId, projectId}})
        if(!version) return res.status(404).json({error: 'not found'});
        res.json(version);
    } catch (error) {
        res.status(500).json({ error: 'Server error'});
    }
})

versionsRouter.post('/:projectId/v', async (req: AuthReq, res) => {
    const projectId = +req.params.projectId;
    console.log('POST REQUEST: create version for projectId', projectId, 'payload = ', req.body);
    
    if (!(await assertProjectMember(projectId, req.user!.id))) {
        return res.status(403).json({ error: 'No persmissions'})
    }

    const parsed = CreateVersion.safeParse(req.body);
    if(!parsed.success) return res.status(400).json(parsed.error.flatten());
    const project = await prisma.project.findUnique({ where: { id: projectId }});
    if(!project) return res.status(404).json({ error: 'Project not found'});

    const language = parsed.data.language ?? project.language;

    const code = parsed.data.code;

    const version = await prisma.version.create({
        data: {
            projectId,
            authorId: req.user!.id,
            language,
            code,
        }
    })
    console.log('Created version id = ', version.id);

    res.status(201).json(version);
})

export default versionsRouter;