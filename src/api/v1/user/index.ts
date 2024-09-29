import { Router } from 'express'
import Bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import { db } from '../../../db/DB'
import { logger } from '../../../Utils'
import { User } from '../../../db/Schema'
import { eq, or } from 'drizzle-orm'
import {
	SPARKUI_CORE_JWT_EXPIRES,
	SPARKUI_CORE_JWT_SECRET,
	SPARKUI_CORE_JWT_REFRESH_EXPIRES,
	SPARKUI_CORE_JWT_REFRESH_SECRET,
	SPARKUI_CORE_DEBUG,
} from '../../../Env'

import Sharp from 'sharp'
import Multer from 'multer'

import { jwtAuth } from '../../../Server'

const upload = Multer({
	storage: Multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1048576,
	},
})

const router = Router()

interface SPostRegister {
	email: string
	username: string
	password: string
}

interface SPostAuth {
	email: string
	password: string
}

export interface JWTPayload {
	id: string
	name: string
	email: string
}

function signTokenForUser(payload: JWTPayload, secret: string, expiresIn: string) {
	return JWT.sign(payload, secret, { expiresIn })
}

if (SPARKUI_CORE_DEBUG) {
	router.get('/debug/auth', async (req, res) => {
		const dbUser = await db.select().from(User).where(eq(User.id, req.user.id))
		return res.json({ payload: req.user, db: dbUser })
	})
}

router.post('/register', async (req, res) => {
	const { email, username, password }: SPostRegister = req.body
	if (!email || !username || !password) return res.status(400).json({ message: 'Bad Request' })

	try {
		const user = await db.query.User.findFirst({
			where: (i, { eq }) => or(eq(i.email, email), eq(i.username, username)),
		})
		if (user) return res.status(400).json({ message: 'Username or Email already taken!' })

		const hashedPassword = await Bcrypt.hash(password, 10)

		const data = await db
			.insert(User)
			.values({
				email,
				username,
				password: hashedPassword,
			})
			.returning({ id: User.id, name: User.username, email: User.email })

		const tokenPayload = {
			id: data[0].id,
			name: data[0].name,
			email: data[0].email,
		}

		const accessToken = signTokenForUser(tokenPayload, SPARKUI_CORE_JWT_SECRET, SPARKUI_CORE_JWT_EXPIRES)
		const refreshToken = signTokenForUser(tokenPayload, SPARKUI_CORE_JWT_REFRESH_SECRET, SPARKUI_CORE_JWT_REFRESH_EXPIRES)

		console.log('5')

		await db.update(User).set({ refreshToken }).where(eq(User.id, data[0].id))

		return res.status(201).json({ message: 'User created successfully!', accessToken, refreshToken })
	} catch (error) {
		logger.error(error)
		return res.status(500).json({ message: 'Internal Server Error' })
	}
})

router.post('/login', async (req, res) => {
	const { email, password }: SPostAuth = req.body

	try {
		const user = await db.select().from(User).where(eq(User.email, email))

		if (user.length < 1) return res.status(404).json({ message: 'User not found!' })
		if (!(await Bcrypt.compare(password, user[0].password))) return res.status(401).json({ message: 'Invalid password!' })

		const accessToken = signTokenForUser(
			{ id: user[0].id, name: user[0].username, email: user[0].email },
			SPARKUI_CORE_JWT_SECRET,
			SPARKUI_CORE_JWT_EXPIRES
		)

		return res.status(200).json({ accessToken })
	} catch (error) {
		return res.status(500).json({ message: 'Internal Server Error' })
	}
})

router.post('/token/refresh', async (req, res) => {
	const { refreshToken } = req.body

	if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required!' })

	try {
		const user = await db.select().from(User).where(eq(User.refreshToken, refreshToken))
		if (user.length < 1) return res.status(404).json({ message: 'User not found!' })

		const accessToken = signTokenForUser(
			{
				id: user[0].id,
				name: user[0].username,
				email: user[0].email,
			},
			SPARKUI_CORE_JWT_SECRET,
			SPARKUI_CORE_JWT_EXPIRES
		)

		return res.status(200).json({ accessToken })
	} catch (error) {
		return res.status(401).json({ message: 'Invalid refresh token!' })
	}
})

// Update user profile
router
	.patch('/profile', upload.single('file'), async (req, res) => {
		const jwt = req.user
		const { username, email, password } = req.body
		let profilePicture = null

		if (req.file) profilePicture = req.file.buffer

		try {
			const user = await db.select().from(User).where(eq(User.id, jwt.id))
			if (user.length < 1) return res.status(404).json({ message: 'User not found!' })

			await db.update(User).set({ username, email, profilePicture }).where(eq(User.id, jwt.id))

			if (password) {
				const hashedPassword = await Bcrypt.hash(password, 10)
				await db.update(User).set({ password: hashedPassword }).where(eq(User.id, jwt.id))
			}

			logger.info(profilePicture)

			if (profilePicture) {
				const buffer = await Sharp(profilePicture).resize(512, 512).webp().toBuffer()
				await db.update(User).set({ profilePicture: buffer }).where(eq(User.id, jwt.id))
			}

			return res.status(200).json({ message: 'Profile updated successfully!' })
		} catch (error) {
			logger.error(error)
			return res.status(500).json({ message: 'Internal Server Error' })
		}
	})
	.use(jwtAuth)

// Retrieve public user profile
router.get('/profile', async (req, res) => {
	const reqUserId = req.query.userId ? (req.query.userId as string) : req.user.id
	const qRes = await db.select().from(User).where(eq(User.id, reqUserId))
	if (qRes.length < 1) return res.status(404).json({ message: 'User not found!' })
	const user = qRes[0]

	return res.status(200).json({
		id: user.id,
		username: user.username,
		profilePicture: user.profilePicture ? `/api/v1/user/${user.id}/profile_picture` : null,
	})
})

router
	.get('/:userId/profile_picture', async (req, res) => {
		const { userId } = req.params
		const user = await db.select().from(User).where(eq(User.id, userId))
		if (user.length < 1) return res.status(404).json({ message: 'User not found!' })
		if (!user[0].profilePicture) return res.status(404).json({ message: 'Profile picture not found!' })

		return res.setHeader('Content-Type', 'image/webp').send(user[0].profilePicture)
	})
	.use(jwtAuth)

export default router
