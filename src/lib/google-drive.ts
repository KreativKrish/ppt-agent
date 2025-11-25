import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
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
}

export const driveService = new GoogleDriveService();
