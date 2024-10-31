import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import * as Auth from '$lib/server/auth.js';

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

const handleAuth: Handle = async ({ event: e, resolve }) => {
	let accessToken = e.cookies.get(Auth.accessCookieName);
	const refreshToken = e.cookies.get(Auth.refreshCookieName);

	if (accessToken == undefined) accessToken = 'INVALID_ACCESS_TOKEN';

	let user = Auth.validate(accessToken);
	if (user == undefined) {
		if (!refreshToken) {
			e.locals.user = null;
			return resolve(e);
		}

		const res = await Auth.refreshAccessToken(refreshToken);
		if (res == undefined) {
			e.locals.user = null;
			return resolve(e);
		}

		setCookies(e, res.tokens.access, res.tokens.refresh);
	}

	e.locals.user = user;
	e.locals.session = accessToken;

	return resolve(e);
};

export const handle: Handle = handleAuth;
