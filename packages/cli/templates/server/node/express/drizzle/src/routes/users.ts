import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

export const usersRouter = Router()

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
})

usersRouter.get('/', async (_req, res) => {
  const allUsers = await db.select().from(users).orderBy(users.id)
  res.json(allUsers)
})

usersRouter.post('/', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: z.prettifyError(parsed.error) })
  }
  try {
    const [user] = await db.insert(users).values(parsed.data).returning()
    res.status(201).json(user)
  } catch (err) {
    // 23505: PostgreSQL unique_violation — the users.email unique constraint.
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Email already in use' })
    }
    throw err
  }
})

usersRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid user id' })
  }
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning()
  if (!deleted) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json(deleted)
})
