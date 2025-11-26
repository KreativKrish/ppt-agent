import * as XLSX from 'xlsx';

export interface Level2Topic {
    name: string;
    level3Topics: string[];
}

export interface Level1Topic {
    name: string;
    level2Topics: Level2Topic[];
}

export interface Unit {
    unitName: string;
    level1Topics: string[];  // Keep for backward compatibility
    level2Topics: string[];  // Keep for backward compatibility
    level3Topics: string[];  // Keep for backward compatibility
    hierarchicalTopics: Level1Topic[];  // New: structured hierarchy
}

export function parseExcelToC(buffer: Buffer): { units: Unit[], subjectName: string } {
    // Read the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get the TOC sheet (3rd sheet or by name)
    const tocSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'toc') || workbook.SheetNames[2];

    if (!tocSheetName) {
        throw new Error('Could not find TOC sheet. Please ensure the Excel file has a sheet named "TOC" or at least 3 sheets.');
    }

    const worksheet = workbook.Sheets[tocSheetName];
    console.log(`Reading from sheet: ${tocSheetName}`);

    // Convert to JSON (array of arrays)
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 4) {
        throw new Error('Excel file must have at least 4 rows');
    }

    // Extract Subject Name from Row 1, Column A (merged A-D)
    const subjectName = data[0]?.[0]?.toString().trim() || "Unknown Subject";
    console.log(`Extracted Subject Name: ${subjectName}`);

    // Find "Unit" column in row 3 (index 2)
    const headerRow = data[2];
    const unitColumnIndex = headerRow.findIndex(
        (cell: any) => cell && cell.toString().toLowerCase().includes('unit')
    );

    if (unitColumnIndex === -1) {
        throw new Error('Could not find "Unit" column in row 3');
    }

    // Column B is index 1, Column C is index 2, Column D is index 3
    const level1ColumnIndex = 1; // Column B
    const level2ColumnIndex = 2; // Column C
    const level3ColumnIndex = 3; // Column D

    // Group rows by unit with hierarchy
    const unitsMap = new Map<string, {
        level1Flat: string[];
        level2Flat: string[];
        level3Flat: string[];
        hierarchical: Level1Topic[];
    }>();

    // Start from row 4 (index 3)
    let currentUnitName = '';
    let currentLevel1: Level1Topic | null = null;
    let currentLevel2: Level2Topic | null = null;

    for (let i = 3; i < data.length; i++) {
        const row = data[i];
        const unitValue = row[unitColumnIndex];

        // Handle merged cells: if unitValue is empty, use the last valid unit name
        if (unitValue) {
            currentUnitName = unitValue.toString().trim();
        }

        // Skip rows where we don't have a unit name at all
        if (!currentUnitName) continue;

        const level1Content = row[level1ColumnIndex]?.toString().trim() || '';
        const level2Content = row[level2ColumnIndex]?.toString().trim() || '';
        const level3Content = row[level3ColumnIndex]?.toString().trim() || '';

        // Skip rows that have no content in any level
        if (!level1Content && !level2Content && !level3Content) continue;

        if (!unitsMap.has(currentUnitName)) {
            unitsMap.set(currentUnitName, {
                level1Flat: [],
                level2Flat: [],
                level3Flat: [],
                hierarchical: []
            });
        }

        const unit = unitsMap.get(currentUnitName)!;

        // Build hierarchical structure
        if (level1Content) {
            // New Level-1 topic
            if (!unit.level1Flat.includes(level1Content)) {
                unit.level1Flat.push(level1Content);
            }

            currentLevel1 = {
                name: level1Content,
                level2Topics: []
            };
            unit.hierarchical.push(currentLevel1);
            currentLevel2 = null; // Reset Level-2 when new Level-1 starts
        }

        if (level2Content && currentLevel1) {
            // New Level-2 topic under current Level-1
            if (!unit.level2Flat.includes(level2Content)) {
                unit.level2Flat.push(level2Content);
            }

            currentLevel2 = {
                name: level2Content,
                level3Topics: []
            };
            currentLevel1.level2Topics.push(currentLevel2);
        }

        // Level-3 topics can have multiple bullet points, parse them
        if (level3Content) {
            // Split by bullet points or newlines
            const level3Items = level3Content
                .split(/[•\n]/)
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0);

            level3Items.forEach((item: string) => {
                if (!unit.level3Flat.includes(item)) {
                    unit.level3Flat.push(item);
                }

                // Add to current Level-2 if it exists
                if (currentLevel2 && !currentLevel2.level3Topics.includes(item)) {
                    currentLevel2.level3Topics.push(item);
                }
            });
        }
    }

    // Convert map to array of Unit objects
    const units: Unit[] = [];
    unitsMap.forEach((content, unitName) => {
        units.push({
            unitName,
            level1Topics: content.level1Flat,
            level2Topics: content.level2Flat,
            level3Topics: content.level3Flat,
            hierarchicalTopics: content.hierarchical
        });
    });

    return { units, subjectName };
}
