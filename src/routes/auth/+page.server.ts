import * as Auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/auth/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) return fail(401);

		if (!(await Auth.invalidateUserRefreshToken(event.locals.user.sub))) {
			return fail(500, { message: 'Failed to invalidate refresh token' });
		}
		event.cookies.delete(Auth.accessCookieName, { path: '/' });
		event.cookies.delete(Auth.refreshCookieName, { path: '/' });

		return redirect(302, '/auth/login');
	}
};
