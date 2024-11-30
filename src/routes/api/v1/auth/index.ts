import * as Auth from '$/service/Auth'

import z from 'zod'
import { Router, Request, Response } from 'express'
import Logger from '@log'
import { valiadteSchema } from '$/Router'

const router = Router()
router.post(
	'/register',
	valiadteSchema(z.object({}), z.object({ email: z.string(), name: z.string(), password: z.string() })),
	async (req: Request, res: Response) => {
		try {
			const { email, name, password } = req.body
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
			Logger.error(e)
		}
	}
)
router.post(
	'/login',
	valiadteSchema(z.object({}), z.object({ email: z.string(), password: z.string() })),
	async (req: Request, res: Response) => {
		try {
			const { email, password } = req.body
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
			Logger.error(e)
		}
	}
)

export default router
