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
    md.block.ruler.before('fence', 'front_matter', (state: StateBlock, startLine: number, endLine: number, silent: boolean) => {
        const start = state.bMarks[startLine] + state.tShift[startLine]
        const max = state.eMarks[startLine]
        const line = state.src.slice(start, max).trim()

        // Only accept --- or *** or ___ as front matter fences
        if (!/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
            return false
        }

        // Must be at top of document
        if (startLine !== 0) {
            return false
        }

        let nextLine = startLine + 1
        let contentLines: string[] = []

        for (; nextLine < endLine; nextLine++) {
            const s = state.bMarks[nextLine] + state.tShift[nextLine]
            const e = state.eMarks[nextLine]
            const text = state.src.slice(s, e).trim()

            if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) {
                break
            }

            if (text.length > 0) {
                contentLines.push(text)
            }
        }

        // No closing fence → not front matter
        if (nextLine >= endLine) {
            return false
        }

        const content = contentLines.join('\n')

        // Reject checkboxes, lists, etc.
        if (
            content.match(/^[-*]\s+

\[.\]

/m) ||
            content.match(/^[-*]\s+/m) ||
            content.match(/^\d+\.\s+/m)
        ) {
            return false
        }

        // Validate YAML
        try {
            yaml.load(content)
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
    })
}
