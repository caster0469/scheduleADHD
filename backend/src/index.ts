import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { prisma } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const itemSchema = z.object({
  type: z.enum(['task', 'move', 'event', 'deadline']),
  category: z.string().min(1),
  title: z.string().trim().min(1),
  date: z.string().regex(dateRegex),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  memo: z.string().trim().nullable().optional(),
  done: z.boolean().optional()
});

const todoSchema = z.object({
  emoji: z.string().min(1),
  label: z.string().min(1),
  title: z.string().trim().min(1),
  sub: z.string().trim().nullable().optional(),
  done: z.boolean().optional()
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/items', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const items = await prisma.item.findMany({
    where: date ? { date } : undefined,
    orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }]
  });
  res.json(items);
});

app.post('/api/items', async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.item.create({
    data: {
      ...parsed.data,
      memo: parsed.data.memo || null,
      time: parsed.data.time || null
    }
  });
  res.status(201).json(item);
});

app.patch('/api/items/:id', async (req, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      memo: parsed.data.memo === undefined ? undefined : parsed.data.memo || null,
      time: parsed.data.time === undefined ? undefined : parsed.data.time || null
    }
  });
  res.json(item);
});

app.delete('/api/items/:id', async (req, res) => {
  await prisma.item.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

app.get('/api/todos', async (_req, res) => {
  const todos = await prisma.todo.findMany({ orderBy: [{ done: 'asc' }, { createdAt: 'desc' }] });
  res.json(todos);
});

app.post('/api/todos', async (req, res) => {
  const parsed = todoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const todo = await prisma.todo.create({ data: parsed.data });
  res.status(201).json(todo);
});

app.patch('/api/todos/:id', async (req, res) => {
  const parsed = todoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const todo = await prisma.todo.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(todo);
});

app.delete('/api/todos/:id', async (req, res) => {
  await prisma.todo.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on :${port}`));
