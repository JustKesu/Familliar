import { useRef, useState, type ReactNode } from 'react'
import type { RollMode } from '../dice/roll'
import { addRollHistoryEntry, RollHistory, type RollHistoryEntry, type RollReport } from '../dice/RollHistory'
import { RollModeContext, RollModeSwitch, RollReportContext, RollToast } from '../dice/RollUi'
import type { DmRoute, DmTab } from '../navigation/route'
import type { Navigate } from '../navigation/useRoute'
import { Drawer } from '../sheet/Drawer'
import { Bestiary } from './Bestiary'
import { EncounterList } from './EncounterList'
import { EncounterRun } from './EncounterRun'
import { EncounterSetup } from './EncounterSetup'

const TABS: { tab: DmTab; label: string }[] = [
	{ tab: 'encounters', label: 'Encounters' },
	{ tab: 'bestiary', label: 'Bestiary' },
	{ tab: 'npcs', label: 'NPCs' },
]

/** D437: `npcs` is the NPCs tab's panel, handed in because it lives on the character store; `sheet` is an NPC's full sheet for a running encounter (D438). */
export function DmPage({ route, navigate, npcs, sheet }: { route: DmRoute; navigate: Navigate; npcs?: ReactNode; sheet?: (characterId: string) => ReactNode }): ReactNode {
	const { tab, encounter } = route
	/* D436: like the sheet (D165) — in memory only, shared by Bestiary and encounters while the DM page is open. */
	const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([])
	const nextRollId = useRef(0)
	const [rollMode, setRollMode] = useState<RollMode>('normal')
	const [historyOpen, setHistoryOpen] = useState(false)
	const toastRef = useRef<((report: RollReport) => void) | null>(null)
	function recordRoll(report: RollReport): void {
		const entry = { ...report, id: nextRollId.current++ }
		setRollHistory((history) => addRollHistoryEntry(history, entry))
		toastRef.current?.(report)
	}

	const panel =
		tab === 'bestiary' ? (
			<Bestiary />
		) : tab === 'npcs' ? (
			npcs
		) : encounter && encounter !== 'new' && encounter.run ? (
			<EncounterRun key={`run-${encounter.id}`} id={encounter.id} navigate={navigate} renderSheet={sheet} />
		) : encounter ? (
			<EncounterSetup key={encounter === 'new' ? 'new' : encounter.id} id={encounter === 'new' ? null : encounter.id} navigate={navigate} />
		) : (
			<EncounterList navigate={navigate} />
		)
	return (
		<RollModeContext.Provider value={{ mode: rollMode, setMode: setRollMode }}>
			<RollReportContext.Provider value={recordRoll}>
				<main className="dm">
					<div className="dm__tabs">
						<div className="dm__tablist" role="tablist" aria-label="DM views">
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
						<div className="dm__rolls">
							<RollModeSwitch mode={rollMode} onChange={setRollMode} />
							<button type="button" className="dm__rolls-button" onClick={() => setHistoryOpen(true)}>
								Rolls
							</button>
						</div>
					</div>
					<div role="tabpanel">{panel}</div>
					{historyOpen && (
						<Drawer title="Roll history" onClose={() => setHistoryOpen(false)}>
							<RollHistory entries={rollHistory} />
						</Drawer>
					)}
					<RollToast showRef={toastRef} />
				</main>
			</RollReportContext.Provider>
		</RollModeContext.Provider>
	)
}
