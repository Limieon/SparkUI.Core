import * as Auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (e) => {
	if (!e.locals.user || !e.locals.session) {
		return redirect(302, '/auth/login');
	}

	if (!(await Auth.invalidateUserRefreshToken(e.locals.user.sub))) {
		return fail(500, { message: 'Failed to invalidate refresh token' });
	}
	e.cookies.delete(Auth.accessCookieName, { path: '/' });
	e.cookies.delete(Auth.refreshCookieName, { path: '/' });

	return redirect(302, '/auth/login');
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) return fail(401);
	}
};
