'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

// ============================================================================
// Design 1: Underline Tabs (Clean, minimal with animated underline)
// ============================================================================

function UnderlineTabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

function UnderlineTabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('border-border inline-flex gap-6 border-b', className)}
            {...props}
        />
    )
}

function UnderlineTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'text-muted-foreground relative pb-3 text-sm font-medium transition-colors',
                'hover:text-foreground',
                'data-[state=active]:text-foreground',
                'after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5',
                'after:bg-primary after:scale-x-0 after:transition-transform after:duration-200',
                'data-[state=active]:after:scale-x-100',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                'disabled:pointer-events-none disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

// ============================================================================
// Design 2: Pill Tabs (Colorful pills with smooth background transition)
// ============================================================================

function PillTabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

function PillTabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('bg-muted/50 inline-flex gap-2 rounded-full p-1', className)}
            {...props}
        />
    )
}

function PillTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                'text-muted-foreground hover:text-foreground',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
                'data-[state=active]:shadow-md',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                'disabled:pointer-events-none disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

// ============================================================================
// Design 3: Folder Tabs (Classic folder/browser style)
// ============================================================================

function FolderTabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col', className)} {...props} />
}

function FolderTabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List data-slot="tabs-list" className={cn('inline-flex items-end gap-1', className)} {...props} />
    )
}

function FolderTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'px-5 py-2.5 text-sm font-medium transition-all duration-150',
                'rounded-t-lg border border-b-0 border-transparent',
                'text-muted-foreground bg-muted/30 hover:bg-muted/60',
                'data-[state=active]:bg-background data-[state=active]:text-foreground',
                'data-[state=active]:border-border data-[state=active]:relative data-[state=active]:z-10',
                'data-[state=active]:shadow-[0_-2px_4px_rgba(0,0,0,0.05)]',
                'data-[state=inactive]:translate-y-px',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                'disabled:pointer-events-none disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

function FolderTabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn(
                'border-border bg-background flex-1 rounded-tr-lg rounded-b-lg border p-4 outline-none',
                className
            )}
            {...props}
        />
    )
}

// ============================================================================
// Design 4: Vertical Sidebar Tabs (Stacked vertically with indicator bar)
// ============================================================================

function VerticalTabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex gap-6', className)} {...props} />
}

function VerticalTabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('border-border flex min-w-[180px] flex-col gap-1 border-r pr-4', className)}
            {...props}
        />
    )
}

function VerticalTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'relative px-4 py-2.5 text-left text-sm font-medium transition-all duration-200',
                'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                'rounded-l-md',
                'before:absolute before:top-0 before:right-0 before:bottom-0 before:w-0.5',
                'before:bg-primary before:scale-y-0 before:transition-transform before:duration-200',
                'before:-mr-[17px]',
                'data-[state=active]:text-foreground data-[state=active]:bg-accent',
                'data-[state=active]:before:scale-y-100',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                'disabled:pointer-events-none disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

function VerticalTabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />
    )
}

// ============================================================================
// Design 5: Segmented Control (iOS-style with sliding background)
// ============================================================================

function SegmentedTabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

function SegmentedTabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('bg-muted border-border inline-flex rounded-lg border p-1', 'shadow-inner', className)}
            {...props}
        />
    )
}

function SegmentedTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'px-4 py-1.5 text-sm font-medium transition-all duration-200',
                'rounded-md',
                'text-muted-foreground hover:text-foreground',
                'data-[state=active]:bg-background data-[state=active]:text-foreground',
                'data-[state=active]:border-border/50 data-[state=active]:border data-[state=active]:shadow-sm',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
                'disabled:pointer-events-none disabled:opacity-50',
                className
            )}
            {...props}
        />
    )
}

// ============================================================================
// Shared TabsContent (for designs that don't need custom content styling)
// ============================================================================

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />
    )
}

// ============================================================================
// Demo Page
// ============================================================================

export default function TabsDesignPage() {
    return (
        <div className="container mx-auto max-w-4xl space-y-16 px-4 py-12">
            <div>
                <h1 className="mb-2 text-3xl font-bold">Tab Designs</h1>
                <p className="text-muted-foreground">5 different tab component styles to choose from</p>
            </div>

            {/* Design 1: Underline Tabs */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">1. Underline Tabs</h2>
                    <p className="text-muted-foreground text-sm">
                        Clean and minimal with an animated underline indicator
                    </p>
                </div>
                <div className="border-border bg-card rounded-lg border p-6">
                    <UnderlineTabs defaultValue="overview">
                        <UnderlineTabsList>
                            <UnderlineTabsTrigger value="overview">Overview</UnderlineTabsTrigger>
                            <UnderlineTabsTrigger value="analytics">Analytics</UnderlineTabsTrigger>
                            <UnderlineTabsTrigger value="reports">Reports</UnderlineTabsTrigger>
                            <UnderlineTabsTrigger value="settings">Settings</UnderlineTabsTrigger>
                        </UnderlineTabsList>
                        <TabsContent value="overview" className="pt-4">
                            <p className="text-muted-foreground">Overview content goes here.</p>
                        </TabsContent>
                        <TabsContent value="analytics" className="pt-4">
                            <p className="text-muted-foreground">Analytics content goes here.</p>
                        </TabsContent>
                        <TabsContent value="reports" className="pt-4">
                            <p className="text-muted-foreground">Reports content goes here.</p>
                        </TabsContent>
                        <TabsContent value="settings" className="pt-4">
                            <p className="text-muted-foreground">Settings content goes here.</p>
                        </TabsContent>
                    </UnderlineTabs>
                </div>
            </section>

            {/* Design 2: Pill Tabs */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">2. Pill Tabs</h2>
                    <p className="text-muted-foreground text-sm">Rounded pills with bold active state and shadow</p>
                </div>
                <div className="border-border bg-card rounded-lg border p-6">
                    <PillTabs defaultValue="all">
                        <PillTabsList>
                            <PillTabsTrigger value="all">All</PillTabsTrigger>
                            <PillTabsTrigger value="active">Active</PillTabsTrigger>
                            <PillTabsTrigger value="draft">Draft</PillTabsTrigger>
                            <PillTabsTrigger value="archived">Archived</PillTabsTrigger>
                        </PillTabsList>
                        <TabsContent value="all" className="pt-4">
                            <p className="text-muted-foreground">All items displayed here.</p>
                        </TabsContent>
                        <TabsContent value="active" className="pt-4">
                            <p className="text-muted-foreground">Active items displayed here.</p>
                        </TabsContent>
                        <TabsContent value="draft" className="pt-4">
                            <p className="text-muted-foreground">Draft items displayed here.</p>
                        </TabsContent>
                        <TabsContent value="archived" className="pt-4">
                            <p className="text-muted-foreground">Archived items displayed here.</p>
                        </TabsContent>
                    </PillTabs>
                </div>
            </section>

            {/* Design 3: Folder Tabs */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">3. Folder Tabs</h2>
                    <p className="text-muted-foreground text-sm">Classic browser/folder style with raised active tab</p>
                </div>
                <div className="border-border bg-muted/30 rounded-lg border p-6">
                    <FolderTabs defaultValue="documents">
                        <FolderTabsList>
                            <FolderTabsTrigger value="documents">Documents</FolderTabsTrigger>
                            <FolderTabsTrigger value="images">Images</FolderTabsTrigger>
                            <FolderTabsTrigger value="videos">Videos</FolderTabsTrigger>
                        </FolderTabsList>
                        <FolderTabsContent value="documents">
                            <p className="text-muted-foreground">Your documents will appear here.</p>
                        </FolderTabsContent>
                        <FolderTabsContent value="images">
                            <p className="text-muted-foreground">Your images will appear here.</p>
                        </FolderTabsContent>
                        <FolderTabsContent value="videos">
                            <p className="text-muted-foreground">Your videos will appear here.</p>
                        </FolderTabsContent>
                    </FolderTabs>
                </div>
            </section>

            {/* Design 4: Vertical Sidebar Tabs */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">4. Vertical Sidebar Tabs</h2>
                    <p className="text-muted-foreground text-sm">Side navigation with animated indicator bar</p>
                </div>
                <div className="border-border bg-card rounded-lg border p-6">
                    <VerticalTabs defaultValue="profile">
                        <VerticalTabsList>
                            <VerticalTabsTrigger value="profile">Profile</VerticalTabsTrigger>
                            <VerticalTabsTrigger value="account">Account</VerticalTabsTrigger>
                            <VerticalTabsTrigger value="notifications">Notifications</VerticalTabsTrigger>
                            <VerticalTabsTrigger value="security">Security</VerticalTabsTrigger>
                        </VerticalTabsList>
                        <VerticalTabsContent value="profile">
                            <div>
                                <h3 className="mb-2 font-medium">Profile Settings</h3>
                                <p className="text-muted-foreground">
                                    Manage your profile information and preferences.
                                </p>
                            </div>
                        </VerticalTabsContent>
                        <VerticalTabsContent value="account">
                            <div>
                                <h3 className="mb-2 font-medium">Account Settings</h3>
                                <p className="text-muted-foreground">Update your account details and billing.</p>
                            </div>
                        </VerticalTabsContent>
                        <VerticalTabsContent value="notifications">
                            <div>
                                <h3 className="mb-2 font-medium">Notification Preferences</h3>
                                <p className="text-muted-foreground">Control how you receive notifications.</p>
                            </div>
                        </VerticalTabsContent>
                        <VerticalTabsContent value="security">
                            <div>
                                <h3 className="mb-2 font-medium">Security Settings</h3>
                                <p className="text-muted-foreground">Manage your password and security options.</p>
                            </div>
                        </VerticalTabsContent>
                    </VerticalTabs>
                </div>
            </section>

            {/* Design 5: Segmented Control */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">5. Segmented Control</h2>
                    <p className="text-muted-foreground text-sm">iOS-style segmented control with inset background</p>
                </div>
                <div className="border-border bg-card rounded-lg border p-6">
                    <SegmentedTabs defaultValue="day">
                        <SegmentedTabsList>
                            <SegmentedTabsTrigger value="day">Day</SegmentedTabsTrigger>
                            <SegmentedTabsTrigger value="week">Week</SegmentedTabsTrigger>
                            <SegmentedTabsTrigger value="month">Month</SegmentedTabsTrigger>
                            <SegmentedTabsTrigger value="year">Year</SegmentedTabsTrigger>
                        </SegmentedTabsList>
                        <TabsContent value="day" className="pt-4">
                            <p className="text-muted-foreground">Daily view content.</p>
                        </TabsContent>
                        <TabsContent value="week" className="pt-4">
                            <p className="text-muted-foreground">Weekly view content.</p>
                        </TabsContent>
                        <TabsContent value="month" className="pt-4">
                            <p className="text-muted-foreground">Monthly view content.</p>
                        </TabsContent>
                        <TabsContent value="year" className="pt-4">
                            <p className="text-muted-foreground">Yearly view content.</p>
                        </TabsContent>
                    </SegmentedTabs>
                </div>
            </section>

            {/* Usage Notes */}
            <section className="space-y-4 pb-8">
                <h2 className="text-xl font-semibold">Usage Notes</h2>
                <div className="border-border bg-card space-y-3 rounded-lg border p-6 text-sm">
                    <p>
                        <strong>Underline Tabs:</strong> Best for primary navigation within content areas. Works well
                        with dense layouts where space is at a premium.
                    </p>
                    <p>
                        <strong>Pill Tabs:</strong> Great for filtering/toggling between states. The bold primary color
                        draws attention to the active selection.
                    </p>
                    <p>
                        <strong>Folder Tabs:</strong> Classic pattern for document-like interfaces or when content areas
                        need clear visual separation.
                    </p>
                    <p>
                        <strong>Vertical Tabs:</strong> Ideal for settings pages or when you have many tabs. Scales
                        better than horizontal tabs for long labels.
                    </p>
                    <p>
                        <strong>Segmented Control:</strong> Perfect for view toggles (list/grid) or time period
                        selection. Compact and familiar from mobile UI patterns.
                    </p>
                </div>
            </section>
        </div>
    )
}
