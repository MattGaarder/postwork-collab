import { Router } from 'express';
import { prisma } from '../services/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
    console.log('Register attempt:', req.body);
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: { email, passwordHash, name: name ?? null }
        });

        const token = jwt.sign({ id: user.id },
            process.env.JWT! 
        );
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }});
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

authRouter.post('/login', async(req, res) => {
    console.log('Login attempt:', req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email }});
    if(!user) return res.status(401).json({
        error: 'Invalid email'
    });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({
        error: 'Wrong password'
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT!);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }});
})
