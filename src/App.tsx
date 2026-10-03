import { useState } from 'react'
import CharacterManager from './CharacterManager'
import { RollsNavSlot } from './dice/RollUi'
import MarkupDemo from './MarkupDemo'
import FlameBackground from './app/FlameBackground'
import { AppHeader } from './app/AppHeader'
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
			<FlameBackground />
			<AppHeader navigate={navigate} rollsSlotRef={setRollsSlot} />

			<RollsNavSlot.Provider value={rollsSlot}>
				{onMarkupDemo ? <MarkupDemo /> : <CharacterManager route={characterRoute} navigate={navigate} />}
			</RollsNavSlot.Provider>
		</>
	)
}

export default App
