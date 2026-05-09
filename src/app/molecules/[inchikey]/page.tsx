import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { VENDOR_NAMES } from '@/types'
import { BuyableMetadataStrip } from '@/components/badges/buyables'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ISCHEMIST_URL, getSiteUrl } from '@/lib/constants'
import { normalizeInchiKeyCandidate } from '@/lib/domains/molecules/logic/molecule-query.logic'
import { getMoleculeDetailPageData } from '@/lib/domains/molecules/view/molecule.view'

type PageProps = {
    params: Promise<{ inchikey: string }>
}

function buildMoleculeDescription(stockCount: number, buyableStockCount: number, inchikey: string): string {
    if (stockCount === 0) {
        return `${inchikey} is a known SynthArena molecule, but it is not currently present in any indexed stock library.`
    }

    const libraryLabel = stockCount === 1 ? 'stock library' : 'stock libraries'
    const buyableClause =
        buyableStockCount === 0
            ? 'no vendor metadata loaded yet'
            : `${buyableStockCount.toLocaleString()} with vendor metadata`

    return `${inchikey} appears in ${stockCount.toLocaleString()} ${libraryLabel} on SynthArena, with ${buyableClause}.`
}

function getNormalizedInchiKeyOr404(rawInchikey: string): string {
    const normalizedInchikey = normalizeInchiKeyCandidate(rawInchikey)
    if (!normalizedInchikey) {
        notFound()
    }

    return normalizedInchikey
}

function getSafeExternalHref(value: string | null | undefined): string | null {
    if (!value) {
        return null
    }

    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
        return null
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = normalizeInchiKeyCandidate(rawInchikey)

    if (!normalizedInchikey) {
        return {
            title: 'Molecule Not Found',
            description: 'The requested molecule could not be found in SynthArena.',
        }
    }

    try {
        const molecule = await getMoleculeDetailPageData(normalizedInchikey)

        return {
            title: normalizedInchikey,
            description: buildMoleculeDescription(molecule.stockCount, molecule.buyableStockCount, normalizedInchikey),
            alternates: {
                canonical: `/molecules/${normalizedInchikey}`,
            },
        }
    } catch (error) {
        console.error('molecule page metadata: failed to load molecule details', {
            normalizedInchikey,
            error,
        })
        return {
            title: 'Molecule Not Found',
            description: 'The requested molecule could not be found in SynthArena.',
        }
    }
}

export default async function MoleculeDetailPage({ params }: PageProps) {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = getNormalizedInchiKeyOr404(rawInchikey)

    if (normalizedInchikey !== rawInchikey) {
        redirect(`/molecules/${normalizedInchikey}`)
    }

    let molecule
    try {
        molecule = await getMoleculeDetailPageData(normalizedInchikey)
    } catch (error) {
        console.error('molecule page: failed to load molecule details', {
            normalizedInchikey,
            error,
        })
        notFound()
    }

    const canonicalUrl = getSiteUrl(`/molecules/${molecule.inchikey}`)

    return (
        <div className="container mx-auto max-w-7xl space-y-6 pb-8">
            <div className="space-y-2">
                <h1 className="font-mono text-3xl font-semibold tracking-tight">{molecule.inchikey}</h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
                    {buildMoleculeDescription(molecule.stockCount, molecule.buyableStockCount, molecule.inchikey)}
                </p>
            </div>

            <Card variant="bordered">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
                            <SmileDrawerSvg smilesStr={molecule.smiles} width={220} height={220} />
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge>{`${molecule.stockCount.toLocaleString()} stock ${molecule.stockCount === 1 ? 'library' : 'libraries'}`}</Badge>
                                <Badge variant="secondary">
                                    {`${molecule.buyableStockCount.toLocaleString()} with vendor metadata`}
                                </Badge>
                                <Badge variant="outline">
                                    {`${molecule.benchmarkTargetCount.toLocaleString()} benchmark ${
                                        molecule.benchmarkTargetCount === 1 ? 'target' : 'targets'
                                    }`}
                                </Badge>
                                <Badge variant="outline">
                                    {`${molecule.routeNodeCount.toLocaleString()} route ${
                                        molecule.routeNodeCount === 1 ? 'node' : 'nodes'
                                    }`}
                                </Badge>
                            </div>

                            <IdentifierBlock label="InChIKey" value={molecule.inchikey} />
                            <IdentifierBlock label="SMILES" value={molecule.smiles} />

                            <div className="space-y-2 border-t pt-4">
                                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                    Canonical URL
                                </p>
                                <div className="flex items-start gap-2">
                                    <p className="font-mono text-xs break-all">{canonicalUrl}</p>
                                    <CopyButton text={canonicalUrl} className="h-7 w-7 shrink-0" />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card variant="bordered">
                <CardHeader>
                    <CardTitle>Stock Availability</CardTitle>
                    <CardDescription>
                        Indexed stock memberships for this exact molecule, keyed by canonical InChIKey.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {molecule.stockEntries.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No stock items currently reference this molecule.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Availability</TableHead>
                                    <TableHead>Lead Time</TableHead>
                                    <TableHead>Vendor Link</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {molecule.stockEntries.map((stockEntry) => (
                                    <StockEntryRow key={stockEntry.id} stockEntry={stockEntry} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <p className="text-muted-foreground border-t pt-2 text-xs leading-relaxed">
                This page assembles availability data from the indexed stock libraries listed above, including
                third-party sources such as ASKCOS Buyables where applicable. SynthArena by{' '}
                <a
                    href={ISCHEMIST_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium underline-offset-2 hover:underline"
                >
                    isChemist
                </a>{' '}
                provides the canonical citation surface for this assembled view. If you cite this page, prefer the
                canonical URL above and preserve the provenance implied by the listed stock libraries and vendor links.
            </p>
        </div>
    )
}

function IdentifierBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{label}</p>
                <CopyButton text={value} className="h-7 w-7" />
            </div>
            <p className="font-mono text-xs break-all">{value}</p>
        </div>
    )
}

function StockEntryRow({
    stockEntry,
}: {
    stockEntry: Awaited<ReturnType<typeof getMoleculeDetailPageData>>['stockEntries'][number]
}) {
    const safeVendorHref = getSafeExternalHref(stockEntry.link)

    return (
        <TableRow key={stockEntry.id}>
            <TableCell className="align-top">
                <div className="space-y-1">
                    <Link
                        href={`/stocks/${stockEntry.stock.id}`}
                        className="text-foreground font-medium underline-offset-2 hover:underline"
                    >
                        {stockEntry.stock.name}
                    </Link>
                    {stockEntry.stock.description && (
                        <p className="text-muted-foreground text-xs leading-relaxed">{stockEntry.stock.description}</p>
                    )}
                </div>
            </TableCell>
            <TableCell className="align-top">
                {stockEntry.source != null && stockEntry.ppg != null ? (
                    <BuyableMetadataStrip source={stockEntry.source} ppg={stockEntry.ppg} badgeStyle="outline" />
                ) : (
                    <Badge variant="outline">Indexed, vendor metadata unavailable</Badge>
                )}
            </TableCell>
            <TableCell className="text-muted-foreground align-top text-sm">{stockEntry.leadTime ?? '—'}</TableCell>
            <TableCell className="align-top">
                {safeVendorHref && stockEntry.source ? (
                    <a
                        href={safeVendorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm font-medium underline-offset-2 hover:underline"
                    >
                        {`View on ${VENDOR_NAMES[stockEntry.source]}`}
                    </a>
                ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                )}
            </TableCell>
        </TableRow>
    )
}
