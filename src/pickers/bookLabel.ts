// D367: display only; the stored source key stays as the data has it.
const BOOK_LABELS: Record<string, string> = { GriffonsSaddlebag2: 'TGS2' }

export function bookLabel(source: string): string {
	return BOOK_LABELS[source] ?? source
}
