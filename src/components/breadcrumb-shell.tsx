import { Fragment } from 'react'

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export interface Crumb {
    label: string
    href?: string
}

export function BreadcrumbShell({ items }: { items: Crumb[] }) {
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1
                    return (
                        <Fragment key={index}>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className={index === 0 ? 'hidden md:block' : ''}>
                                {isLast || !item.href ? (
                                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
