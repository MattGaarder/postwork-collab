// import { Router } from 'express';
// import { z } from 'zod';
// import { prisma } from '../services/prisma';
// import { requireAuth, AuthReq } from '../middleware/requireAuth';

// import { emitToSubmission } from '../server';

// export const submissionsRouter = Router();

// submissionsRouter.use(requireAuth);

// const CreateSubmission = z.object({
//     projectId: z.number(),
//     title: z.string().min(1),
//     language: z.string().min(1),
//     code: z.string().min(1),
// });

// submissionsRouter.post('/', async (req: AuthReq, res) => {
//     const parsed = CreateSubmission.safeParse(req.body);
//     if(!parsed.success) return res.status(400).json(parsed.error.flatten());
//     const { projectId, language, title, code } = parsed.data;

//     const project = await prisma.project.findUnique({ where: { id:projectId }});

//     if(!project || project.ownerId !== req.user!.id) {
//         return res.status(403).json({ error: "You do not have access to this project" })
//     }

//     const sub = await prisma.submission.create({
//         data: {
//             projectId,
//             authorId: req.user!.id,
//             language,
//             title,
//             code,
//         },
//     });

// // export function emitToSubmission(submissionId: number, event: string, payload: any) {
// //   io.to(`submission:$submissionId`).emit(event, payload);
// // }
//     emitToSubmission(sub.id, 'submission:created', sub); res.status(201).json(sub);
// });

