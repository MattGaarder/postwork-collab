import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
// import { requireAuth, AuthReq } from '../middleware/requireAuth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

const Register = z.object({
    email: z.string().email(),
    password: z.string(),
    name: z.string().optional()
})

authRouter.post('/register', async (req, res) => {
    const parsed = Register.safeParse(req.body);
    if(!parsed.success) return res.status(400).json(parsed.error.flatten());
    const { email, password, name } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { email, passwordHash, name: name ?? null }
    });

    const token = jwt.sign({ id: user.id },
        process.env.JWT_SECRET! 
    );
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }});
});

const Login = z.object({
    email: z.string().email(),
    password: z.string(),
});

authRouter.post('/login', async(req, res) => {
    const parsed = Login.safeParse(req.body);
    if(!parsed.success) return res.status(400).json(parsed.error.flatten());
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }});
    if(!user) return res.status(401).json({
        error: 'Invalid email'
    });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({
        error: 'Wrong password'
    });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }});
})
