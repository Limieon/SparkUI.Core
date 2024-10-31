import { eq, or } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as Table from '$lib/server/db/schema';

import JWT from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import { env } from '$env/dynamic/private';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const accessCookieName = 'sparkui_access_token';
export const refreshCookieName = 'sparkui_refresh_token';

type JWTAccessPayload = Table.UserAuth;

type TokenPair = {
	access: string;
	refresh?: string | null;
};

function signToken(payload: object, secret: string, expiresIn: string) {
	return JWT.sign(payload, secret, { expiresIn, algorithm: 'HS256' });
}
function generateSessionToken(user: JWTAccessPayload): string {
	return signToken(user, env.SPARKUI_CORE_JWT_SECRET!, env.SPARKUI_CORE_JWT_EXPIRES!);
}
function generateRefreshToken(uuid: string): string {
	return signToken(
		{
			sub: uuid
		},
		env.SPARKUI_CORE_JWT_SECRET!,
		env.SPARKUI_CORE_JWT_REFRESH_EXPIRES!
	);
}

async function hashPassword(password: string): Promise<string> {
	const saltRounds = 12;
	const hashedPassword = await bcrypt.hash(password, saltRounds);
	return hashedPassword;
}

/**
 * Create a new user record in the database
 * @param username the username
 * @param email the email
 * @param password the password
 * @returns user record from the database
 */
export async function createUser(username: string, email: string, password: string) {
	if (
		(
			await db
				.select()
				.from(Table.User)
				.where(or(eq(Table.User.username, username), eq(Table.User.email, email)))
		).length > 0
	) {
		throw new Error('Username or Email already exists');
	}

	return (
		await db
			.insert(Table.User)
			.values({
				username,
				email,
				password: await hashPassword(password)
			})
			.returning()
	)[0];
}

/**
 * Validate a user's credentials
 * @param email the email
 * @param password the password
 * @returns access and refresh tokens
 */
export async function validateCredentials(
	email: string,
	password: string
): Promise<TokenPair | undefined> {
	const user = await db.select().from(Table.User).where(eq(Table.User.email, email));
	if (user.length === 0) return undefined;

	if (!(await bcrypt.compare(password, user[0].password))) return undefined;

	const tokens: TokenPair = {
		access: generateSessionToken({
			sub: user[0].id,
			email: user[0].email,
			username: user[0].username,
			role: user[0].roleId ? user[0].roleId : null
		}),
		refresh: generateRefreshToken(user[0].id)
	};

	await db
		.update(Table.User)
		.set({ refreshToken: tokens.refresh })
		.where(eq(Table.User.id, user[0].id));

	return tokens;
}
/**
 * Invalidate a user's refresh token
 * @param uuid user id
 */
export async function invalidateUserRefreshToken(uuid: string): Promise<boolean> {
	try {
		await db.update(Table.User).set({ refreshToken: null }).where(eq(Table.User.id, uuid));
		return true;
	} catch (e) {
		return false;
	}
}
/**
 * Validate a user's session token
 * @param accessToken access token
 * @returns the user payload
 */
export function validate(accessToken: string): JWTAccessPayload | undefined {
	try {
		return JWT.decode(accessToken) as JWTAccessPayload;
	} catch (e) {
		return undefined;
	}
}
/**
 * Create a new session token from a refresh token
 * @param refreshToken user's refresh token
 * @returns a new access and refresh token pair
 */
export async function refreshAccessToken(
	refreshToken: string
): Promise<{ tokens: TokenPair; payload: JWTAccessPayload } | undefined> {
	const jwt = JWT.decode(refreshToken) as JWTAccessPayload;
	const user = (await db.select().from(Table.User).where(eq(Table.User.id, jwt.sub)))[0];
	if (user.refreshToken !== refreshToken) {
		return undefined;
	}

	const payload: JWTAccessPayload = {
		sub: user.id,
		email: user.email,
		username: user.username,
		role: user.roleId ? user.roleId : null
	};
	const tokens: TokenPair = {
		access: generateSessionToken(payload),
		refresh: generateRefreshToken(user.id)
	};

	await db
		.update(Table.User)
		.set({ refreshToken: tokens.refresh })
		.where(eq(Table.User.id, user.id));

	return { tokens, payload };
}
