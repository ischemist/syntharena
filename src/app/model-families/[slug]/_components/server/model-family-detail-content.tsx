import * as modelFamilyView from '@/lib/services/view/model-family.view'
import { ModelInstanceTable } from '@/app/algorithms/[slug]/_components/server/model-instance-table'

import { ModelFamilyDetailHeader } from './model-family-detail-header'

interface ModelFamilyDetailContentProps {
    slug: string
}

export async function ModelFamilyDetailContent({ slug }: ModelFamilyDetailContentProps) {
    const { family, instances } = await modelFamilyView.getModelFamilyDetailPageData(slug)

    return (
        <div className="flex flex-col gap-8">
            <ModelFamilyDetailHeader family={family} />
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">model versions</h2>
                <ModelInstanceTable instances={instances} />
            </div>
        </div>
    )
}
