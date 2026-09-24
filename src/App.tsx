import { useState } from 'react'
import CharacterManager from './CharacterManager'
import { RollsNavSlot } from './dice/RollUi'
import MarkupDemo from './MarkupDemo'
import ThemeToggle from './ThemeToggle'
import { useRoute } from './navigation/useRoute'
import type { CharacterRoute } from './navigation/route'

function App() {
	const [route, navigate] = useRoute()
	const [rollsSlot, setRollsSlot] = useState<HTMLElement | null>(null)
	const onMarkupDemo = route.view === 'markup-demo'
	/* Every other route belongs to CharacterManager — it never sees 'markup-demo' (D151). */
	const characterRoute: CharacterRoute = onMarkupDemo ? { view: 'list' } : route

	return (
		<>
			<nav className="tabs">
				<button
					type="button"
					className={onMarkupDemo ? 'tabs__button' : 'tabs__button tabs__button--active'}
					onClick={() => navigate({ view: 'list' })}
				>
					Characters
				</button>
				<button
					type="button"
					className={onMarkupDemo ? 'tabs__button tabs__button--active' : 'tabs__button'}
					onClick={() => navigate({ view: 'markup-demo' })}
				>
					Markup demo
				</button>
				{/* D165: CharacterSheet portals its "Rolls" button in here, so it exists only while a sheet is open. */}
			<span ref={setRollsSlot} className="tabs__slot" />
			<ThemeToggle />
			</nav>

			<RollsNavSlot.Provider value={rollsSlot}>
				{onMarkupDemo ? <MarkupDemo /> : <CharacterManager route={characterRoute} navigate={navigate} />}
			</RollsNavSlot.Provider>
		</>
	)
}

export default App
