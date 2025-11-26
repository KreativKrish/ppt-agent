import * as XLSX from 'xlsx';

export interface Unit {
    unitName: string;
    level1Topics: string[];
    level2Topics: string[];
    level3Topics: string[];
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
    // data[0] is the first row, data[0][0] is the first cell
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

    // Group rows by unit
    const unitsMap = new Map<string, { level1: string[]; level2: string[]; level3: string[] }>();

    // Start from row 4 (index 3)
    let currentUnitName = '';

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
            unitsMap.set(currentUnitName, { level1: [], level2: [], level3: [] });
        }

        const unit = unitsMap.get(currentUnitName)!;

        if (level1Content && !unit.level1.includes(level1Content)) {
            unit.level1.push(level1Content);
        }

        if (level2Content && !unit.level2.includes(level2Content)) {
            unit.level2.push(level2Content);
        }

        // Level-3 topics can have multiple bullet points, parse them
        if (level3Content) {
            // Split by bullet points or newlines
            const level3Items = level3Content
                .split(/[•\n]/)
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0);

            level3Items.forEach((item: string) => {
                if (!unit.level3.includes(item)) {
                    unit.level3.push(item);
                }
            });
        }
    }

    // Convert map to array of Unit objects
    const units: Unit[] = [];
    unitsMap.forEach((content, unitName) => {
        units.push({
            unitName,
            level1Topics: content.level1,
            level2Topics: content.level2,
            level3Topics: content.level3,
        });
    });

    return { units, subjectName };
}
