import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';


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


// REQUESTS FOR REAL
// GET /projects/:projectId/v

versionsRouter.get('/:projectId/v', async (req: any, res) => {
    try {
        const projectId =+ req.params.projectId;

        // const allowed = await assertProjectMember(projectId, req.user.id);
        // if(!allowed) return res.status(403).json({ error: 'Forbidden '});

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

versionsRouter.get('/:projectId/v/:versionId', async (req: any, res) => {
    try {
        const projectId = +req.params.projectId;
        const versionId = +req.params.versionId;

        // if (!(await assertProjectMember(projectId, req.user.id))) {
        //     return res.status(403).json({ error: 'No persmissions'})
        // }
    
        const version = await prisma.version.findFirst({ where: { id: versionId, projectId}})
        if(!version) return res.status(404).json({error: 'not found'});
        res.json(version);
    } catch (error) {
        res.status(500).json({ error: 'Server error'});
    }
})

versionsRouter.post('/:projectId/v', async (req: any, res) => {
    const projectId = +req.params.projectId;
    
    // if (!(await assertProjectMember(projectId, req.user.id))) {
    //     return res.status(403).json({ error: 'No persmissions'})
    // }

    const { code, language } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId }});
    if(!project) return res.status(404).json({ error: 'Project not found'});

    const version = await prisma.version.create({
        data: {
            projectId,
            authorId: req.user.id,
            language: language ?? project.language,
            code,
        }
    })

    res.status(201).json(version);
})

export default versionsRouter;