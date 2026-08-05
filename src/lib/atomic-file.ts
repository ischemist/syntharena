import * as fs from 'fs/promises'

/**
 * Publishes a file without replacing a destination that appeared after an
 * earlier existence check. The temporary file must be in the destination
 * directory, so a hard link is an atomic, same-filesystem no-replace commit.
 */
export async function promoteFileNoReplace(partialPath: string, outputPath: string): Promise<void> {
    await fs.link(partialPath, outputPath)
    try {
        await fs.unlink(partialPath)
    } catch (error) {
        // Roll back only the link created above. The original partial remains
        // available for the caller's normal failure cleanup.
        await fs.unlink(outputPath).catch(() => undefined)
        throw error
    }
}
