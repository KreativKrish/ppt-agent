/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[_\s-]+/g, ' ')  // Replace underscores, hyphens, and multiple spaces with single space
        .replace(/ppt|tracker|links?/gi, '')  // Remove common suffixes
        .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = normalizeString(str1);
    const normalized2 = normalizeString(str2);

    const maxLength = Math.max(normalized1.length, normalized2.length);
    if (maxLength === 0) return 1.0;

    const distance = levenshteinDistance(normalized1, normalized2);
    return 1 - distance / maxLength;
}

/**
 * Find a sheet name that matches the target name with fuzzy matching
 * @param targetName The subject name to search for
 * @param existingSheets Array of existing sheet objects with id and name
 * @param threshold Similarity threshold (default 0.75)
 * @returns The matching sheet object or null
 */
export function findSimilarSheet(
    targetName: string,
    existingSheets: Array<{ id: string; name: string }>,
    threshold: number = 0.75
): { id: string; name: string; similarity: number } | null {
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    let highestSimilarity = 0;

    for (const sheet of existingSheets) {
        const similarity = calculateSimilarity(targetName, sheet.name);

        if (similarity > highestSimilarity && similarity >= threshold) {
            highestSimilarity = similarity;
            bestMatch = {
                id: sheet.id,
                name: sheet.name,
                similarity: similarity,
            };
        }
    }

    return bestMatch;
}
