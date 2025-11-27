import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
];

export class GoogleDriveService {
    private oauth2Client: OAuth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    getAuthUrl(): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent', // Force consent screen to always get refresh token
        });
    }

    async setCredentials(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        return tokens;
    }

    setTokens(tokens: any) {
        this.oauth2Client.setCredentials(tokens);
    }

    async fetchFileFromDrive(fileId: string): Promise<Buffer> {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        try {
            // First, check if it's a Google Sheets file
            const metadata = await drive.files.get({
                fileId: fileId,
                fields: 'mimeType, name',
            });

            console.log(`File type: ${metadata.data.mimeType}`);

            // If it's a Google Sheets file, export it as Excel
            if (metadata.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
                console.log('Detected Google Sheets file, exporting as Excel...');
                const response = await drive.files.export(
                    {
                        fileId: fileId,
                        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                    { responseType: 'arraybuffer' }
                );
                return Buffer.from(response.data as ArrayBuffer);
            } else {
                // Regular file download
                const response = await drive.files.get(
                    {
                        fileId: fileId,
                        alt: 'media',
                    },
                    { responseType: 'arraybuffer' }
                );
                return Buffer.from(response.data as ArrayBuffer);
            }
        } catch (error: any) {
            console.error('Error fetching file from Drive:', error.message);
            throw new Error(`Failed to fetch file: ${error.message}`);
        }
    }

    async uploadFileToDrive(
        folderId: string,
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string = 'application/pdf'
    ): Promise<string> {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: mimeType,
            body: require('stream').Readable.from(fileBuffer),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return response.data.webViewLink || '';
    }

    async getFileMetadata(fileId: string) {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        const response = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType',
        });

        return response.data;
    }

    async listFilesInFolder(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        try {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType)',
                pageSize: 100,
            });

            return response.data.files as Array<{ id: string; name: string; mimeType: string }>;
        } catch (error: any) {
            console.error('Error listing files in folder:', error.message);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    async createSpreadsheet(title: string, folderId: string): Promise<string> {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        try {
            // Create spreadsheet
            const createResponse = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: title,
                    },
                    sheets: [{
                        properties: {
                            title: 'PPT Links',
                        },
                    }],
                },
            });

            const spreadsheetId = createResponse.data.spreadsheetId!;

            // Move to specified folder
            await drive.files.update({
                fileId: spreadsheetId,
                addParents: folderId,
                fields: 'id, parents',
            });

            console.log(`Created spreadsheet: ${spreadsheetId} in folder: ${folderId}`);
            return spreadsheetId;
        } catch (error: any) {
            console.error('Error creating spreadsheet:', error.message);
            throw new Error(`Failed to create spreadsheet: ${error.message}`);
        }
    }

    async appendRowsToSheet(spreadsheetId: string, values: any[][]): Promise<void> {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });

        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: 'PPT Links!A:B',
                valueInputOption: 'RAW',
                requestBody: {
                    values: values,
                },
            });

            console.log(`Appended ${values.length} rows to spreadsheet ${spreadsheetId}`);
        } catch (error: any) {
            console.error('Error appending rows to sheet:', error.message);
            throw new Error(`Failed to append rows: ${error.message}`);
        }
    }

    async getSheetData(spreadsheetId: string, range: string = 'PPT Links!A:B'): Promise<any[][]> {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });

        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: range,
            });

            return response.data.values || [];
        } catch (error: any) {
            console.error('Error getting sheet data:', error.message);
            throw new Error(`Failed to get sheet data: ${error.message}`);
        }
    }

    async getSheetRows(spreadsheetId: string): Promise<string[][]> {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });

        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'PPT Links!A2:E', // Skip header, get all data columns
            });

            return (response.data.values || []) as string[][];
        } catch (error: any) {
            console.error('Error getting sheet rows:', error.message);
            throw new Error(`Failed to get sheet rows: ${error.message}`);
        }
    }

    async updateSheetRows(spreadsheetId: string, updates: Array<{
        rowIndex: number;
        pptName: string;
        status: string;
        url: string;
        timestamp: string;
    }>): Promise<void> {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });

        try {
            for (const update of updates) {
                const range = `PPT Links!A${update.rowIndex}:E${update.rowIndex}`;
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [[
                            update.pptName,
                            update.status,
                            update.url,
                            '-', // Clear generation ID
                            update.timestamp
                        ]]
                    }
                });
            }

            console.log(`Updated ${updates.length} rows in spreadsheet ${spreadsheetId}`);
        } catch (error: any) {
            console.error('Error updating sheet rows:', error.message);
            throw new Error(`Failed to update sheet rows: ${error.message}`);
        }
    }
}

export const driveService = new GoogleDriveService();
