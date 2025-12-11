import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SubmissionWorkflowsSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-semibold">How to Submit</h2>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Public Submission */}
                <Card variant="bordered">
                    <CardHeader>
                        <CardTitle>Public Submission</CardTitle>
                        <CardDescription>For published papers or public models</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            If your paper is public or you don&apos;t care about anonymity:
                        </p>

                        <ol className="text-muted-foreground space-y-3 text-sm">
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    1
                                </span>
                                <span>
                                    Run your model through RetroCast:{' '}
                                    <code className="bg-muted rounded px-1 py-0.5 text-xs">retrocast ingest</code>,{' '}
                                    <code className="bg-muted rounded px-1 py-0.5 text-xs">retrocast score</code>, and{' '}
                                    <code className="bg-muted rounded px-1 py-0.5 text-xs">retrocast analyze</code>
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    2
                                </span>
                                <span>
                                    Upload the <code className="bg-muted rounded px-1 py-0.5 text-xs">data/</code>{' '}
                                    artifact (including{' '}
                                    <code className="bg-muted rounded px-1 py-0.5 text-xs">manifest.json</code>) to a
                                    public URL (Zenodo, S3, Google Drive, etc.)
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    3
                                </span>
                                <span>
                                    Open a{' '}
                                    <Link
                                        href="https://github.com/ischemist/syntharena/issues/new?template=model-submission.md"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground underline hover:no-underline"
                                    >
                                        Model Submission Issue
                                    </Link>{' '}
                                    on GitHub with the link and required metadata
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    4
                                </span>
                                <span>We will audit the manifest and merge it into the main database</span>
                            </li>
                        </ol>

                        <div className="text-muted-foreground space-y-2 text-xs">
                            <p className="font-semibold">Required Metadata:</p>
                            <ul className="list-inside list-disc space-y-1">
                                <li>Model name and version</li>
                                <li>Paper link (arXiv, DOI, or GitHub)</li>
                                <li>Runtime statistics (see RetroCast examples)</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Stealth Submission */}
                <Card variant="bordered">
                    <CardHeader>
                        <CardTitle>Stealth Mode (Blind Review)</CardTitle>
                        <CardDescription>For double-blind conference submissions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertDescription className="text-xs">
                                If you are submitting to a double-blind conference (NeurIPS, ICLR) or journal and need
                                to claim SOTA without revealing your identity.
                            </AlertDescription>
                        </Alert>

                        <ol className="text-muted-foreground space-y-3 text-sm">
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    1
                                </span>
                                <span>Run the RetroCast pipeline as described in the public workflow</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    2
                                </span>
                                <span>
                                    Email the artifact to{' '}
                                    <a
                                        href="mailto:syntharena@ischemist.com"
                                        className="text-foreground underline hover:no-underline"
                                    >
                                        syntharena@ischemist.com
                                    </a>{' '}
                                    with the subject <strong>&ldquo;STEALTH SUBMISSION&rdquo;</strong>
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    3
                                </span>
                                <span>
                                    We will assign your model a permanent random codename (e.g.,{' '}
                                    <em>Project-Blue-Falcon</em>)
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    4
                                </span>
                                <span>
                                    The model appears on the leaderboard immediately with verified metrics, but no
                                    author/institution data
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                    5
                                </span>
                                <span>
                                    <strong>Unmasking:</strong> When your paper is published, email us to link the
                                    codename to your real identity
                                </span>
                            </li>
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <div className="text-muted-foreground space-y-3 text-sm">
                <p>
                    <strong className="text-foreground">Technical Documentation:</strong> For detailed instructions on
                    running RetroCast, see the{' '}
                    <a
                        href="https://retrocast.ischemist.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline hover:no-underline"
                    >
                        RetroCast documentation
                    </a>
                    . Example runtime configurations can be found in the{' '}
                    <a
                        href="https://github.com/ischemist/project-procrustes/tree/main/scripts"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline hover:no-underline"
                    >
                        RetroCast repository scripts
                    </a>
                    .
                </p>

                <p>
                    <strong className="text-foreground">Licensing:</strong> By submitting routes to SynthArena, you
                    agree to provide them under the{' '}
                    <a
                        href="https://creativecommons.org/licenses/by/4.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline hover:no-underline"
                    >
                        CC-BY 4.0 license
                    </a>
                    , allowing the community to inspect and learn from your model&apos;s predictions.
                </p>
            </div>
        </section>
    )
}
