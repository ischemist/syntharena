import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { BreadcrumbNavigation } from '@/components/breadcrumbs'
import { ThemeProvider } from '@/components/theme-provider'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

import { AppSidebar } from './_components/client/app-sidebar'

import './globals.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: {
        template: '%s | SynthArena by isChemist Group',
        default: 'Evaluating MultiStep Retrosynthetic Solutions | SynthArena by isChemist Group',
    },
    description:
        'SynthArena is an open source platform for comparing different end-to-end multistep retrosynthetic solutions.',
    authors: [{ name: 'isChemist Group' }],
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                            <header className="flex h-16 shrink-0 items-center gap-2">
                                <div className="flex items-center gap-2 px-4">
                                    <SidebarTrigger className="-ml-1" />
                                    <Separator orientation="vertical" className="mr-2 h-4" />
                                    <BreadcrumbNavigation />
                                </div>
                            </header>
                            <div className="flex max-w-[1600px] flex-1 flex-col gap-4 pr-8 pl-6">{children}</div>
                        </SidebarInset>
                    </SidebarProvider>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    )
}
