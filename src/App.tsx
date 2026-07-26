import { useState } from 'react'
import CharacterManager from './CharacterManager'
import MarkupDemo from './MarkupDemo'

type Tab = 'characters' | 'markup-demo'

function App() {
	const [tab, setTab] = useState<Tab>('characters')

	return (
		<>
			<nav className="tabs">
				<button
					type="button"
					className={tab === 'characters' ? 'tabs__button tabs__button--active' : 'tabs__button'}
					onClick={() => setTab('characters')}
				>
					Characters
				</button>
				<button
					type="button"
					className={tab === 'markup-demo' ? 'tabs__button tabs__button--active' : 'tabs__button'}
					onClick={() => setTab('markup-demo')}
				>
					Markup demo
				</button>
			</nav>

			{tab === 'characters' ? <CharacterManager /> : <MarkupDemo />}
		</>
	)
}

export default App
