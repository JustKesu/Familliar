import { useEffect, useState } from 'react'

/** D428: must match the `@media (max-width: 760px)` block in index.css. */
export const MOBILE_QUERY = '(max-width: 760px)'

function matches(): boolean {
	// jsdom has no matchMedia; the sheet's unit tests run the desktop layout.
	return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches
}

export function useMobileLayout(): boolean {
	const [mobile, setMobile] = useState(matches)
	useEffect(() => {
		if (typeof window.matchMedia !== 'function') return
		const query = window.matchMedia(MOBILE_QUERY)
		const update = (): void => setMobile(query.matches)
		update()
		query.addEventListener('change', update)
		return () => query.removeEventListener('change', update)
	}, [])
	return mobile
}
