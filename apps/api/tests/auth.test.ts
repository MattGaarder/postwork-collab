import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from '../src/routes/auth';
import { prisma } from '../src/services/prisma';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Mock process.env.JWT
process.env.JWT = 'test-secret';

describe('Auth Routes', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', testEmail);
  });

  it('should login the user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: testEmail,
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
  });
});
