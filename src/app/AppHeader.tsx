import type { ReactNode } from 'react'
import FlameToggle from '../FlameToggle'
import ThemeToggle from '../ThemeToggle'
import type { Navigate } from '../navigation/useRoute'

export function AppHeader({ navigate, rollsSlotRef }: { navigate: Navigate; rollsSlotRef: (element: HTMLElement | null) => void }): ReactNode {
	return (
		<header className="app-header">
			<button type="button" className="app-header__wordmark" aria-label="Familliar — your characters" onClick={() => navigate({ view: 'list' })}>
				FAMILLIAR
			</button>
			{/* D165: CharacterSheet portals its "Rolls" button in here, so it exists only while a sheet is open. */}
			<span ref={rollsSlotRef} className="app-header__slot" />
			<FlameToggle />
			<ThemeToggle />
		</header>
	)
}
