const CONCENTRATION_TEXT = 'Advantage on Constitution saves to maintain Concentration'

// D373: a text line only, the save roll itself is left alone.
const INVOCATION_SOURCES = [{ name: 'Eldritch Mind', source: 'XPHB' }] as const
const FEAT_SOURCES = [{ name: 'War Caster', source: 'XPHB' }] as const

/** "Advantage on Constitution saves to maintain Concentration (Eldritch Mind)" — one line per invocation or feat that grants it. */
export function concentrationSaveAdvantageLines(
	invocations: readonly { name: string; source?: string }[],
	feats: readonly { name: string; source: string }[],
): string[] {
	const hasInvocation = (entry: { name: string; source: string }) =>
		invocations.some((invocation) => invocation.name === entry.name && (invocation.source ?? 'XPHB') === entry.source)
	const hasFeat = (entry: { name: string; source: string }) => feats.some((feat) => feat.name === entry.name && feat.source === entry.source)
	return [...INVOCATION_SOURCES.filter(hasInvocation), ...FEAT_SOURCES.filter(hasFeat)].map((entry) => `${CONCENTRATION_TEXT} (${entry.name})`)
}
