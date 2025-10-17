import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthReq extends Request{ user?: { id: number }}

export function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer', '');
    if(!token) return res.status(401).json({
        error: 'No Token'
    });
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number };
        req.user = { id: payload.id };
        next();
    } catch {
        res.status(401).json({
            error: 'Invalid Token'
        });
    }
}