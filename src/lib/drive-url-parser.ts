/**
 * Extract file/folder ID from Google Drive URL
 * Supports multiple URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/drive/folders/FOLDER_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - Direct ID input (returns as-is)
 */
export function extractDriveId(urlOrId: string): string {
    if (!urlOrId || urlOrId.trim() === '') {
        return '';
    }

    const trimmed = urlOrId.trim();

    // If it doesn't look like a URL, assume it's already an ID
    if (!trimmed.includes('drive.google.com') && !trimmed.includes('docs.google.com') && !trimmed.includes('http')) {
        return trimmed;
    }

    try {
        // Pattern 1: Generic /d/FILE_ID (covers /file/d/, /spreadsheets/d/, /presentation/d/, /document/d/)
        const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (dMatch) {
            return dMatch[1];
        }

        // Pattern 2: /folders/FOLDER_ID
        const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (folderMatch) {
            return folderMatch[1];
        }

        // Pattern 3: /open?id=FILE_ID or ?id=FILE_ID
        const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) {
            return idMatch[1];
        }

        // If no pattern matches, return original (might be a direct ID)
        return trimmed;
    } catch (error) {
        console.error('Error extracting Drive ID:', error);
        return trimmed;
    }
}
