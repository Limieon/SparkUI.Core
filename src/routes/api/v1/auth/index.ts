import { authMiddleware } from '$/service/Auth'

import * as Auth from '$/service/Auth'

import z from 'zod'
import { Router, Request, Response } from 'express'

const router = Router()
router.post('/register', async (req: Request, res: Response) => {
	const querySchema = z.object({
		email: z.string(),
		name: z.string(),
		password: z.string(),
	})

	const body = req.body
	try {
		const { email, name, password } = querySchema.parse(body)
		const tokens = await Auth.createUser(email, name, password)
		await Auth.setTokenCookies(res, tokens)
		res.status(200).json({ message: 'User Created!' })
	} catch (e) {
		if (e instanceof z.ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}
		if (e instanceof Error) {
			res.status(500).json({ error: e.message })
		}
		console.log(e)
	}
})
router.post('/login', async (req: Request, res: Response) => {
	const querySchema = z.object({
		email: z.string(),
		password: z.string(),
	})

	const body = req.body
	try {
		const { email, password } = querySchema.parse(body)
		const tokens = await Auth.createSession(email, password)
		await Auth.setTokenCookies(res, tokens)
		res.status(200).json({ message: 'Authenticated!' })
	} catch (e) {
		if (e instanceof z.ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}
		if (e instanceof Error) {
			res.status(500).json({ error: e.message })
		}
		console.log(e)
	}
})

export default router
