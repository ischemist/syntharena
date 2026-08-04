import { describe, expect, it } from 'vitest'

import { parseEvaluationLabelOption, resolveEvaluationLabel } from '@/lib/evaluation-label'

describe('evaluation-label export selection', () => {
    it('defaults only when the benchmark has one exact label', () => {
        expect(resolveEvaluationLabel(undefined, ['stock', 'stock'], 'benchmark')).toBe('stock')
    })

    it('refuses to mix multiple labels without an explicit selection', () => {
        expect(() => resolveEvaluationLabel(undefined, ['stock+leaf', 'stock'], 'benchmark')).toThrow(
            'has multiple evaluation labels (stock, stock+leaf)'
        )
    })

    it('validates an explicit label against the benchmark evaluations', () => {
        expect(resolveEvaluationLabel('stock+leaf', ['stock', 'stock+leaf'], 'benchmark')).toBe('stock+leaf')
        expect(() => resolveEvaluationLabel('task', ['stock'], 'benchmark')).toThrow(
            'Evaluation label "task" is not available'
        )
    })

    it('parses both supported CLI forms without consuming exporter flags', () => {
        expect(parseEvaluationLabelOption(['benchmark', '--evaluation-label', 'stock+leaf', '-t'])).toEqual({
            evaluationLabel: 'stock+leaf',
            remainingArgs: ['benchmark', '-t'],
        })
        expect(parseEvaluationLabelOption(['--evaluation-label=task', 'benchmark', '-noci'])).toEqual({
            evaluationLabel: 'task',
            remainingArgs: ['benchmark', '-noci'],
        })
    })
})
