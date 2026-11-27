import { useState } from 'react'
import CharacterManager from './CharacterManager'
import { RollsNavSlot } from './dice/RollUi'
import MarkupDemo from './MarkupDemo'
import FlameBackground from './app/FlameBackground'
import IntroOverlay from './app/IntroOverlay'
import { AppHeader } from './app/AppHeader'
import { DmPage } from './dm/DmPage'
import { useRoute } from './navigation/useRoute'
import type { CharacterRoute } from './navigation/route'

function App() {
	const [route, navigate] = useRoute()
	const [rollsSlot, setRollsSlot] = useState<HTMLElement | null>(null)
	/* Every other route belongs to CharacterManager — it never sees 'markup-demo' (D151) or 'dm' (D432). */
	const characterRoute: CharacterRoute = route.view === 'markup-demo' || route.view === 'dm' ? { view: 'list' } : route

	return (
		<>
			<FlameBackground />
			<AppHeader navigate={navigate} rollsSlotRef={setRollsSlot} />

			<RollsNavSlot.Provider value={rollsSlot}>
				{route.view === 'markup-demo' ? (
					<MarkupDemo />
				) : route.view === 'dm' ? (
					<DmPage tab={route.tab} navigate={navigate} />
				) : (
					<CharacterManager route={characterRoute} navigate={navigate} />
				)}
			</RollsNavSlot.Provider>
			<IntroOverlay />
		</>
	)
}

export default App
