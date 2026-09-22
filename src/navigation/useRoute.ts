import { useCallback, useEffect, useState } from 'react'
import { formatRoute, parseRoute, type Route } from './route'

export type Navigate = (route: Route, options?: { replace?: boolean }) => void

function currentRoute(): Route {
	return parseRoute(window.location.hash)
}

/**
 * Single source of truth for "what view is open" (D151). Lives once at App
 * level; views receive the route and this navigate function as props rather
 * than each calling the hook themselves, so there is exactly one hashchange
 * listener and nothing re-renders because of it except on an actual
 * navigation (push, replace, or the browser's own Back/Forward).
 */
export function useRoute(): [Route, Navigate] {
	const [route, setRoute] = useState<Route>(currentRoute)

	useEffect(() => {
		const onHashChange = () => setRoute(currentRoute())
		window.addEventListener('hashchange', onHashChange)
		return () => window.removeEventListener('hashchange', onHashChange)
	}, [])

	const navigate = useCallback<Navigate>((next, options) => {
		const hash = formatRoute(next)
		if (options?.replace) {
			window.history.replaceState(null, '', hash)
		} else {
			window.location.hash = hash
		}
		setRoute(next)
	}, [])

	return [route, navigate]
}
