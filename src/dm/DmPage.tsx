import type { ReactNode } from 'react'
import type { DmTab } from '../navigation/route'
import type { Navigate } from '../navigation/useRoute'
import { Bestiary } from './Bestiary'

const TABS: { tab: DmTab; label: string }[] = [
	{ tab: 'encounters', label: 'Encounters' },
	{ tab: 'bestiary', label: 'Bestiary' },
]

export function DmPage({ tab, navigate }: { tab: DmTab; navigate: Navigate }): ReactNode {
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
			<div role="tabpanel">{tab === 'bestiary' ? <Bestiary /> : <p className="dm__status">Encounters come in the next update.</p>}</div>
		</main>
	)
}
