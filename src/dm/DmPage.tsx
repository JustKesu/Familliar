import type { ReactNode } from 'react'
import type { DmRoute, DmTab } from '../navigation/route'
import type { Navigate } from '../navigation/useRoute'
import { Bestiary } from './Bestiary'
import { EncounterList } from './EncounterList'
import { EncounterSetup } from './EncounterSetup'

const TABS: { tab: DmTab; label: string }[] = [
	{ tab: 'encounters', label: 'Encounters' },
	{ tab: 'bestiary', label: 'Bestiary' },
]

export function DmPage({ route, navigate }: { route: DmRoute; navigate: Navigate }): ReactNode {
	const { tab, encounter } = route
	const panel =
		tab === 'bestiary' ? (
			<Bestiary />
		) : encounter ? (
			<EncounterSetup key={encounter === 'new' ? 'new' : encounter.id} id={encounter === 'new' ? null : encounter.id} navigate={navigate} />
		) : (
			<EncounterList navigate={navigate} />
		)
	return (
		<main className="dm">
			<div className="dm__tabs" role="tablist" aria-label="DM views">
				{TABS.map((entry) => (
					<button
						key={entry.tab}
						type="button"
						role="tab"
						aria-selected={entry.tab === tab}
						className={entry.tab === tab ? 'dm__tab dm__tab--active' : 'dm__tab'}
						onClick={() => navigate({ view: 'dm', tab: entry.tab })}
					>
						{entry.label}
					</button>
				))}
			</div>
			<div role="tabpanel">{panel}</div>
		</main>
	)
}
