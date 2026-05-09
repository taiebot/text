/**
 * Custom front matter plugin for Nextcloud Text
 * Fixes incorrect detection of blocks like:
 *
 * ***
 * [] one
 * [] two
 * ***
 */

import type MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import yaml from 'js-yaml'

export default function frontmatter(md: MarkdownIt) {
	md.block.ruler.before(
		'fence',
		'front_matter',
		(
			state: StateBlock,
			startLine: number,
			endLine: number,
			silent: boolean,
		) => {
			// Front matter must start at top of document
			if (startLine !== 0) {
				return false
			}

			const start = state.bMarks[startLine] + state.tShift[startLine]
			const max = state.eMarks[startLine]
			const line = state.src.slice(start, max).trim()

			// Only allow YAML-style fences
			if (!/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
				return false
			}

			let nextLine = startLine + 1
			const contentLines: string[] = []

			for (; nextLine < endLine; nextLine++) {
				const s = state.bMarks[nextLine] + state.tShift[nextLine]
				const e = state.eMarks[nextLine]
				const text = state.src.slice(s, e)

				// Closing fence
				if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(text.trim())) {
					break
				}

				contentLines.push(text)
			}

			// No closing fence
			if (nextLine >= endLine) {
				return false
			}

			const content = contentLines.join('\n').trim()

			// Reject markdown lists / task lists
			const hasMarkdownLists =
				/^[-*]\s+\[[ xX]\]\s+/m.test(content) || // task list
				/^[-*]\s+/m.test(content) || // bullet list
				/^\d+\.\s+/m.test(content) // numbered list

			if (hasMarkdownLists) {
				return false
			}

			// Validate YAML
			try {
				const parsed = yaml.load(content)

				// Require actual object-like YAML front matter
				if (
					parsed === null ||
					typeof parsed !== 'object' ||
					Array.isArray(parsed)
				) {
					return false
				}
			} catch {
				return false
			}

			if (silent) {
				return true
			}

			const token = state.push('front_matter', '', 0)
			token.meta = content
			token.map = [startLine, nextLine + 1]

			state.line = nextLine + 1

			return true
		},
	)
}
