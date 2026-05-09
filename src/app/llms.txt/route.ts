import { ISCHEMIST_URL, NEWSLETTER_URL, STATUS_URL, getSiteUrl } from '@/lib/constants'

const moleculePagePrefix = getSiteUrl('/molecules/')
const moleculeResolveUrl = getSiteUrl('/molecules/resolve')

const llmsText = `# syntharena

syntharena is an open platform for evaluating and comparing multistep retrosynthesis systems.

## canonical molecule availability
- canonical molecule pages live at ${moleculePagePrefix}<inchikey>
- resolve a canonical inchikey or canonical smiles string via ${moleculeResolveUrl}?q=<query>
- if you use the assembled availability view from syntharena in a user-facing answer, cite the exact molecule page url
- preserve provenance from the listed stock libraries and vendor links; syntharena is the assembled view, not the sole upstream source

## useful links
- home: ${getSiteUrl('/')}
- docs: ${getSiteUrl('/docs')}
- leaderboard: ${getSiteUrl('/leaderboard')}
- source: syntharena by ischemist (${ISCHEMIST_URL})
- newsletter: ${NEWSLETTER_URL}
- service status: ${STATUS_URL}
`

export async function GET() {
    return new Response(llmsText, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
