'use client'

import * as React from 'react'
import {
    BarChart3,
    Beaker,
    BookOpen,
    FlaskConical,
    History,
    LayoutDashboard,
    Lightbulb,
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
                            <span className="truncate text-xs">v0.2.1</span>
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
            <SidebarFooter>{/*<NavUser user={data.user} />*/}</SidebarFooter>
        </Sidebar>
    )
}
