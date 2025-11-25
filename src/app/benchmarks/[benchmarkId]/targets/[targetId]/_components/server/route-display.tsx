import * as benchmarkService from '@/lib/services/benchmark.service'
import * as routeService from '@/lib/services/route.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { RouteJsonViewer } from '../client/route-json-viewer'

interface RouteDisplayProps {
    targetId: string
}

/**
 * Server component that fetches and displays route information.
 * Shows the ground truth route as formatted JSON for MVP.
 */
export async function RouteDisplay({ targetId }: RouteDisplayProps) {
    const target = await benchmarkService.getTargetById(targetId)

    // Check if target has ground truth route
    if (!target.groundTruthRouteId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Route Information</CardTitle>
                    <CardDescription>No ground truth route available for this target</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    // Fetch the complete route tree
    const routeData = await routeService.getRouteTreeData(target.groundTruthRouteId)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ground Truth Route</CardTitle>
                <CardDescription>
                    Synthesis route with {routeData.route.length} steps
                    {routeData.route.isConvergent && ' (convergent)'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RouteJsonViewer routeData={routeData} />
            </CardContent>
        </Card>
    )
}
