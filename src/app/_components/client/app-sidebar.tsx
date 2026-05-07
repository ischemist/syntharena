'use client'

import * as React from 'react'
import {
    BarChart3,
    Beaker,
    BookOpen,
    Cpu,
    Activity,
    FlaskConical,
    History,
    LayoutDashboard,
    Lightbulb,
    Mail,
    Map,
    Trophy,
    Upload,
    Zap,
} from 'lucide-react'

import { ModeToggle } from '@/components/mode-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar'

import { NavDropdowns } from './nav-dropdowns'
import { NavLinks } from './nav-links'
import { NavSecondary } from './nav-secondary'

const data = {
    user: {
        name: 'Guest',
        email: 'local@synth.com',
        avatar: '/avatars/shadcn.jpg',
    },
    navLinks: [
        {
            title: 'Home',
            url: '/',
            icon: LayoutDashboard,
        },
        {
            title: 'Stocks',
            url: '/stocks',
            icon: Beaker,
        },
        {
            title: 'Benchmarks',
            url: '/benchmarks',
            icon: FlaskConical,
        },
        {
            title: 'Runs',
            url: '/runs',
            icon: Zap,
        },
        {
            title: 'Leaderboard',
            url: '/leaderboard',
            icon: BarChart3,
        },
        {
            title: 'Algorithms',
            url: '/algorithms',
            icon: Cpu,
        },
    ],
    navDropdowns: [
        {
            title: 'Docs',
            url: '/docs',
            icon: BookOpen,
            isActive: true,
            items: [
                {
                    title: 'How It Works',
                    url: '/docs/how-it-works',
                },
                {
                    title: 'Benchmarks',
                    url: '/docs/benchmarks',
                },
                {
                    title: 'Metrics',
                    url: '/docs/metrics',
                },
            ],
        },
    ],
    navSecondary: [
        {
            title: 'Why This Exists?',
            url: '/thesis',
            icon: Lightbulb,
        },
        {
            title: 'Changelog',
            url: '/changelog',
            icon: History,
        },
        {
            title: 'Roadmap',
            url: '/roadmap',
            icon: Map,
        },
        {
            title: 'Submit Results',
            url: '/submit-results',
            icon: Upload,
        },
        // {
        //     title: 'Feedback',
        //     url: '#',
        //     icon: Send,
        // },
    ],
}

const appVersion = `v${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}`

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                            <Trophy className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">SynthArena</span>
                            <span className="truncate text-xs">{appVersion}</span>
                        </div>
                    </div>
                    <ModeToggle />
                </div>
            </SidebarHeader>
            <SidebarContent>
                <NavLinks items={data.navLinks} />
                <NavDropdowns items={data.navDropdowns} />
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <div className="group-data-[collapsible=icon]:hidden">
                    <div className="border-sidebar-border text-sidebar-foreground/70 space-y-2 border-t px-2 pt-3 text-xs">
                        <p className="font-medium text-sidebar-foreground">From isChemist</p>
                        <p className="leading-snug">
                            Software, essays, and tools that make better scientific questions possible.
                        </p>
                        <div className="flex items-center gap-3">
                            <a
                                href="https://ischemist.com/newsletter"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-sidebar-foreground inline-flex items-center gap-1 transition-colors"
                            >
                                <Mail className="size-3" />
                                Newsletter
                            </a>
                            <a
                                href="https://status.ischemist.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-sidebar-foreground inline-flex items-center gap-1 transition-colors"
                            >
                                <Activity className="size-3" />
                                Status
                            </a>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
