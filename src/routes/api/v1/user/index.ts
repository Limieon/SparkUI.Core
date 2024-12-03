import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response } from 'express'
import z from 'zod'
import multer from 'multer'
import Sharp from 'sharp'

import { hashPassword } from '$/service/Auth'
import db from '$/db'
import { User } from '$/db/Schema'
import { eq } from 'drizzle-orm'
import Logger from '@log'

import * as Schemas from './Schemas'

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 8 * 1024 * 1024 },
})

const router = Router()

router.get('/avatar', async (req: Request, res: Response) => {
	if (!req.user) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	let userID = req.user.sub

	if (req.query.userid) {
		userID = req.query.userid as string
	}

	Logger.info(userID)
	res.setHeader('Content-Type', 'image/webp')
	res.send((await db.select({ avatar: User.avatar }).from(User).where(eq(User.id, userID)))[0].avatar)
})
router.patch('/update', upload.single('avatar'), async (req: Request, res: Response) => {
	if (!req.user) {
		res.status(401).json({ error: 'Unauthorized' })
		return
	}

	const querySchema = z.object({
		name: z.string().optional(),
		email: z.string().email().optional(),
		passsword: z.string().optional(),
	})

	try {
		const body = querySchema.parse(req.body)
		const file = req.file

		let avatarBuffer: Buffer | undefined = undefined
		if (file) {
			avatarBuffer = await Sharp(file.buffer).resize(768, 768).webp({ quality: 90 }).toBuffer()
		}

		if (body.passsword) body.passsword = await hashPassword(body.passsword)

		await db
			.update(User)
			.set({ ...body, avatar: avatarBuffer, updatedAt: new Date() })
			.where(eq(User.id, req.user.sub))
			.execute()

		res.status(200).json({ message: 'User Updated' })
	} catch (e) {
		if (e instanceof z.ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}
		if (e instanceof Error) {
			res.status(500).json({ error: e.message })
		}
	}
})
router.patch('/update/avatar', async (req: Request, res: Response) => {})

export default router
