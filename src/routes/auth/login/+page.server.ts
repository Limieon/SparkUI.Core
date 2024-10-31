import { hash, verify } from '@node-rs/argon2';
import { generateRandomString } from '@oslojs/crypto/random';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import * as Auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as Table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) return redirect(302, '/app/home');

	return {};
};

function setCookies(e, accessToken: string, refreshToken: string | null | undefined) {
	e.cookies.set(Auth.accessCookieName, accessToken, {
		path: '/',
		sameSite: 'lax',
		httpOnly: true,
		secure: !dev
	});

	if (refreshToken)
		e.cookies.set(Auth.refreshCookieName, refreshToken!, {
			path: '/',
			sameSite: 'lax',
			httpOnly: true,
			secure: !dev
		});
}

export const actions: Actions = {
	login: async (e) => {
		const formData = await e.request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (!validateEmail(email)) return fail(400, { message: 'Invalid email' });
		if (!validatePassword(password)) return fail(400, { message: 'Invalid password' });

		const result = await Auth.validateCredentials(email, password);
		if (result == undefined) return fail(400, { message: 'Warum ist die Banane krumm?' });

		setCookies(e, result.access, result.refresh);
		redirect(302, '/app/home');
	},

	register: async (e) => {
		const formData = await e.request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		const username = formData.get('username');

		if (!validateEmail(email)) return fail(400, { message: 'Invalid email' });
		if (!validatePassword(password)) return fail(400, { message: 'Invalid password' });
		if (!validateUsername(username)) return fail(400, { message: 'Invalid username' });

		await Auth.createUser(username, email, password);
		const tokens = await Auth.validateCredentials(email, password);
		if (tokens == undefined) fail(400, { message: 'Invalid credentials' });
		setCookies(e, tokens.access, tokens.refresh);

		redirect(302, '/app/home');
	}
};

function validateEmail(email: unknown): email is string {
	return (
		typeof email === 'string' &&
		email.length >= 3 &&
		email.length <= 31 &&
		/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email)
	);
}
function validateUsername(username: unknown): username is string {
	return (
		typeof username === 'string' &&
		username.length >= 3 &&
		username.length <= 31 &&
		/^[A-Za-z0-9_-]+$/.test(username)
	);
}
function validatePassword(password: unknown): password is string {
	return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}
