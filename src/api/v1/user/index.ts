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

interface JWTPayload {
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

	try {
		const user = await db
			.select()
			.from(User)
			.where(or(eq(User.email, email), eq(User.username, username)))

		logger.info(user)

		if (user.length > 0) return res.status(400).json({ message: 'Username or Email already taken!' })

		const hashedPassword = await Bcrypt.hash(password, 10)

		const data = await db
			.insert(User)
			.values({
				email,
				username,
				password: hashedPassword,
			})
			.returning({ id: User.id, name: User.username, email: User.email })

		logger.info(data)

		const tokenPayload = {
			id: data[0].id,
			name: data[0].name,
			email: data[0].email,
		}

		const accessToken = signTokenForUser(tokenPayload, SPARKUI_CORE_JWT_SECRET, SPARKUI_CORE_JWT_EXPIRES)
		const refreshToken = signTokenForUser(tokenPayload, SPARKUI_CORE_JWT_REFRESH_SECRET, SPARKUI_CORE_JWT_REFRESH_EXPIRES)

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

export default router
