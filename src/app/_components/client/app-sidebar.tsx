'use client'

import * as React from 'react'
import { LayoutDashboard, LifeBuoy, Send, Settings2, Trophy } from 'lucide-react'

import { ModeToggle } from '@/components/mode-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar'

import { NavDropdowns } from './nav-dropdowns'
import { NavLinks } from './nav-links'
import { NavSecondary } from './nav-secondary'
import { NavUser } from './nav-user'

const data = {
    user: {
        name: 'Guest',
        email: 'local@argus.dev',
        avatar: '/avatars/shadcn.jpg',
    },
    navLinks: [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: LayoutDashboard,
        },
    ],
    navDropdowns: [
        {
            title: 'Dev',
            url: '#',
            icon: Settings2,
            items: [
                {
                    title: 'Badges',
                    url: '/design/badges',
                },
            ],
        },
    ],
    navSecondary: [
        {
            title: 'Support',
            url: '#',
            icon: LifeBuoy,
        },
        {
            title: 'Feedback',
            url: '#',
            icon: Send,
        },
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
                            <span className="truncate font-medium">Synth Arena</span>
                            <span className="truncate text-xs">v0.1.0</span>
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
                <NavUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}
