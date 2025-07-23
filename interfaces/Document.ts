export interface DocumentInput<Metadata extends { videoLink?: string; score?: number; file?: string; uploadDate?: Date; pdf_source?: string; page_number?: string; page_numbers?: string[] } = Record<string, any>> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata?: Metadata;
}

export class MyDocument<Metadata extends { videoLink?: string; score?: number; file?: string; uploadDate?: Date; pdf_source?: string; page_number?: string; page_numbers?: string[] } = Record<string, any>> implements DocumentInput<Metadata> {
    pageNumber?: number;
    pageHeader?: string;
    pageContent: string;
    metadata: Metadata;

    constructor(fields: DocumentInput<Metadata>) {
        this.pageNumber = fields.pageNumber;
        this.pageHeader = fields.pageHeader;
        this.pageContent = fields.pageContent;
        // Ensure metadata is initialized properly
        this.metadata = fields.metadata || {} as Metadata;
        // If score is provided, add it to metadata
        if (fields.metadata?.score !== undefined) {
            this.metadata.score = fields.metadata.score;
        }
    }
}