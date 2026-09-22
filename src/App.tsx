import CharacterManager from './CharacterManager'
import MarkupDemo from './MarkupDemo'
import ThemeToggle from './ThemeToggle'
import { useRoute } from './navigation/useRoute'
import type { CharacterRoute } from './navigation/route'

function App() {
	const [route, navigate] = useRoute()
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
				<ThemeToggle />
			</nav>

			{onMarkupDemo ? <MarkupDemo /> : <CharacterManager route={characterRoute} navigate={navigate} />}
		</>
	)
}

export default App
