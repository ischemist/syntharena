'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import type { RouteVisualizationData } from '@/types'
import { Button } from '@/components/ui/button'

interface RouteJsonViewerProps {
    routeData: RouteVisualizationData
}

/**
 * Client component that displays route data as formatted JSON.
 * Includes copy-to-clipboard functionality.
 * For MVP: simple JSON display. Future: interactive tree visualization.
 */
export function RouteJsonViewer({ routeData }: RouteJsonViewerProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(routeData, null, 2))
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">Route tree structure (JSON format)</p>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                    {copied ? (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-4 w-4" />
                            Copy JSON
                        </>
                    )}
                </Button>
            </div>

            <div className="bg-muted max-h-[600px] overflow-x-auto overflow-y-auto rounded-lg p-4">
                <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                    {JSON.stringify(routeData, null, 2)}
                </pre>
            </div>
        </div>
    )
}
