import JWT, { JsonWebTokenError } from 'jsonwebtoken'
import db from '@db'
import * as Table from '@db/schema'
import * as Env from '@env'

import bcrypt from 'bcrypt'
import { eq, or } from 'drizzle-orm'

import Express, { Router, type NextFunction, type Request, type Response, RequestHandler } from 'express'

export type TokenPair = {
	access: string
	refresh: string
}

export type JWTPayload = {
	sub: string
	name: string
	role: string | null | undefined
}
export type JWTRPayload = {
	sub: string
}

function signToken(payload: object, secret: string, expires: string) {
	return JWT.sign(payload, secret, { expiresIn: expires })
}
function signAccessToken(payload: JWTPayload) {
	return signToken(payload, Env.SPARKUI_CORE_JWT_SECRET, Env.SPARKUI_CORE_JWT_EXPIRES)
}
function signRefreshToken(payload: JWTRPayload) {
	return signToken(payload, Env.SPARKUI_CORE_JWT_REFRESH_SECRET, Env.SPARKUI_CORE_JWT_REFRESH_EXPIRES)
}

function verifyToken(token: string, secret: string) {
	return JWT.verify(token, secret)
}
function verifyAccessToken(token: string) {
	return verifyToken(token, Env.SPARKUI_CORE_JWT_SECRET)
}
function verifyRefreshToken(token: string) {
	return verifyToken(token, Env.SPARKUI_CORE_JWT_REFRESH_SECRET)
}

function decodeAccessPayload(token: string) {
	return JWT.decode(token) as JWTPayload
}
function decodeRefreshPayload(token: string) {
	return JWT.decode(token) as JWTRPayload
}

function hashPassword(password: string) {
	return bcrypt.hash(password, 10)
}

async function updateRefreshToken(sub: string, token: string) {
	await db.update(Table.User).set({ refreshToken: token }).where(eq(Table.User.id, sub))
}

function createTokenPair(payload: JWTPayload, rPayload: JWTRPayload) {
	return {
		access: signAccessToken(payload),
		refresh: signRefreshToken(rPayload),
	}
}

async function setAccessTokenCookie(res: Response, token: string) {
	res.cookie(Env.SPARKUI_CORE_JWT_COOKIE, token, {
		signed: true,
		secure: !Env.SPARKUI_CORE_DEBUG,
		httpOnly: true,
		sameSite: Env.SPARKUI_CORE_DB_HOST ? 'none' : 'strict',
	})
}
async function setRefreshTokenCookie(res: Response, token: string) {
	res.cookie(Env.SPARKUI_CORE_JWT_REFRESH_COOKIE, token, {
		signed: true,
		secure: !Env.SPARKUI_CORE_DEBUG,
		httpOnly: true,
		sameSite: Env.SPARKUI_CORE_DB_HOST ? 'none' : 'strict',
	})
}
export async function setTokenCookies(res: Response, tokens: TokenPair) {
	await setAccessTokenCookie(res, tokens.access)
	await setRefreshTokenCookie(res, tokens.refresh)
}
async function getTokenCookies(req: Request): Promise<{ access?: string; refresh?: string }> {
	return {
		access: req.signedCookies[Env.SPARKUI_CORE_JWT_COOKIE] as string | undefined,
		refresh: req.signedCookies[Env.SPARKUI_CORE_JWT_REFRESH_COOKIE] as string | undefined,
	}
}

export const authMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
	console.log('Auth Middleware')
	let { access, refresh } = await getTokenCookies(req)
	let userPayload: JWTPayload | null = null

	console.log({ access, refresh })

	if (access) {
		try {
			userPayload = authenticate(access)

			next()
			return
		} catch (e) {
			if (refresh) {
				try {
					const tokens = await refreshTokens(refresh)
					await setTokenCookies(res, tokens)
					userPayload = authenticate(tokens.access)

					next()
					return
				} catch (e) {
					res.clearCookie(Env.SPARKUI_CORE_JWT_COOKIE)
					res.clearCookie(Env.SPARKUI_CORE_JWT_REFRESH_COOKIE)

					res.status(401).json({ error: e.message })
					return
				}
			}

			res.status(401).json({ error: e.message })
			return
		}
	}

	res.status(401).json({ error: 'Unautherized' })
	return
}

export async function createSession(email: string, password: string): Promise<TokenPair> {
	const user = (
		await db
			.select({ id: Table.User.id, name: Table.User.name, password: Table.User.password })
			.from(Table.User)
			.where(eq(Table.User.email, email))
			.limit(1)
	)[0]

	if (!user) throw new Error('User not found')
	if (!bcrypt.compare(password, user.password)) throw new Error('Invalid password')

	const tokens = createTokenPair({ sub: user.id, name: user.name, role: undefined }, { sub: user.id })

	await updateRefreshToken(user.id, tokens.refresh)
	return tokens
}

export function authenticate(accessToken: string): JWTPayload {
	if (!verifyAccessToken(accessToken)) throw new Error('Invalid access token')
	return decodeAccessPayload(accessToken)
}
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
	if (!verifyRefreshToken(refreshToken)) throw new Error('Invalid refresh token')
	const { sub } = decodeRefreshPayload(refreshToken)

	const user = (
		await db
			.select({ id: Table.User.id, name: Table.User.name, refreshToken: Table.User.refreshToken })
			.from(Table.User)
			.where(eq(Table.User.id, sub))
			.limit(1)
	)[0]

	if (!refreshToken || user.refreshToken !== refreshToken) throw new Error('Invalid refresh token')

	const tokens = createTokenPair({ sub: user.id, name: user.name, role: undefined }, { sub: user.id })
	await updateRefreshToken(user.id, tokens.refresh)

	return tokens
}
export async function revokeRefreshToken(refreshToken: string) {
	await db.update(Table.User).set({ refreshToken: null }).where(eq(Table.User.refreshToken, refreshToken))
}

export async function createUser(email: string, name: string, password: string): Promise<TokenPair> {
	const users = await db
		.select({ id: Table.User.id, email: Table.User.email, name: Table.User.name })
		.from(Table.User)
		.where(or(eq(Table.User.email, email), eq(Table.User.name, name)))
		.limit(1)

	if (users.length > 0) throw new Error('User already exists')

	const user = (
		await db
			.insert(Table.User)
			.values({
				email: email,
				name: name,
				password: await hashPassword(password),
			})
			.returning()
	)[0]

	const tokens = createTokenPair({ sub: user.id, name: user.name, role: undefined }, { sub: user.id })

	await db.update(Table.User).set({ refreshToken: tokens.refresh }).where(eq(Table.User.id, user.id))
	return tokens
}
