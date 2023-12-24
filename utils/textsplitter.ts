import * as readline from 'readline';

type HeaderType = {
    level: number;
    name: string;
    data: string;
};

type LineType = {
    content: string;
    metadata: Record<string, string>;
};

class MarkdownDocument {
    pageContent: string;
    metadata: Record<string, string>;

    constructor(pageContent: string, metadata: Record<string, string>) {
        this.pageContent = pageContent;
        this.metadata = metadata;
    }
}


export class MarkdownHeaderTextSplitter {
    headersToSplitOn: [string, string][];
    returnEachLine: boolean;

    constructor(headersToSplitOn: [string, string][], returnEachLine: boolean = false) {
        this.headersToSplitOn = headersToSplitOn.sort((a, b) => b[0].length - a[0].length);
        this.returnEachLine = returnEachLine;
    }

    aggregateLinesToChunks(lines: LineType[]): MarkdownDocument[] {
        const aggregatedChunks: LineType[] = [];
        for (const line of lines) {
            if (aggregatedChunks.length && aggregatedChunks[aggregatedChunks.length - 1].metadata === line.metadata) {
                aggregatedChunks[aggregatedChunks.length - 1].content += "  \n" + line.content;
            } else {
                aggregatedChunks.push(line);
            }
        }
        return aggregatedChunks.map(chunk => new MarkdownDocument(chunk.content, chunk.metadata));
    }

    splitText(text: string, originalMetadata: Record<string, string> = {}): MarkdownDocument[] {
        const lines = text.split("\n");
        const linesWithMetadata: LineType[] = [];
        let currentContent: string[] = [];
        let currentHeaders: string[] = [];  // Store headers here
        const headerStack: HeaderType[] = [];
        let initialMetadata: Record<string, string> = { ...originalMetadata };
    
        for (const line of lines) {
            const strippedLine = line.trim();
            let found = false;
            for (const [sep, name] of this.headersToSplitOn) {
                if (strippedLine.startsWith(sep) && (strippedLine.length === sep.length || strippedLine[sep.length] === " ")) {
                    found = true;
                    if (name) {
                        const currentHeaderLevel = sep.length;
                        while (headerStack.length && headerStack[headerStack.length - 1].level >= currentHeaderLevel) {
                            headerStack.pop();
                            currentHeaders.pop();  // Remove last header
                        }
                        const header: HeaderType = {
                            level: currentHeaderLevel,
                            name: name,
                            data: strippedLine.substr(sep.length).trim()
                        };
                        headerStack.push(header);
                        currentHeaders.push(strippedLine);  // Add the header to currentHeaders
                    }
                    if (currentContent.length) {
                        linesWithMetadata.push({
                            content: [...currentHeaders, ...currentContent].join("\n"),  // Prepend headers to content
                            metadata: { ...initialMetadata }
                        });
                        currentContent = [];
                    }
                    break;
                }
            }
            if (!found && strippedLine) {
                currentContent.push(strippedLine);
            } else if (currentContent.length) {
                linesWithMetadata.push({
                    content: [...currentHeaders, ...currentContent].join("\n"),  // Prepend headers to content
                    metadata: { ...initialMetadata }
                });
                currentContent = [];
            }
        }
        if (currentContent.length) {
            linesWithMetadata.push({
                content: [...currentHeaders, ...currentContent].join("\n"),  // Prepend headers to content
                metadata: initialMetadata
            });
        }
        if (!this.returnEachLine) {
            return this.aggregateLinesToChunks(linesWithMetadata);
        } else {
            return linesWithMetadata.map(chunk => new MarkdownDocument(chunk.content, chunk.metadata));
        }
    }
    
}

abstract class TextSplitter {
    abstract splitText(text: string): Promise<string[]>;
  }
  
  export class CustomTextSplitter extends TextSplitter {
    async splitText(text: string): Promise<string[]> {
      const chunks: string[] = [];
      const lines = text.split('\n');
      let chunk = '';
  
      lines.forEach((line, index) => {
        if (line.startsWith('**')) {
          if (chunk !== '') {
            // Finish the current chunk and push it to chunks array
            chunks.push(chunk.trim());
            chunk = '';
          }
        }
        // Add the line to the current chunk
        chunk += line + '\n';
  
        // Check if it's the last line
        if (index === lines.length - 1 && chunk !== '') {
          chunks.push(chunk.trim());
        }
      });
  
      return chunks;
    }
  }
  
  
export function extractPotentialSubHeader(chunk: string): string | null {
    const regex = /\*\*([^*]+)\*\*/g; // Matches strings wrapped with **

    let matches = chunk.match(regex); // Find all matches

    if (matches && matches.length > 0) {
        // Return the last match (nearest to the end)
        return matches[matches.length - 1].replace(/\*\*/g, ''); // Remove ** from the matched string
    }

    return null;
}

export function extractYouTubeLink(content: string): string | null {
    const youtubeMatch = content.match(/https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/);
    return youtubeMatch ? youtubeMatch[0] : null;
  }
  
  export function extractSentinalLink(content: string): string | null {
    const solidcamMatch = content.match(/https:\/\/sentinel\.solidcam\.com\/[a-zA-Z0-9\/_.-]+\.(html|pdf)/);
    return solidcamMatch ? solidcamMatch[0] : null;
}


  export function extractFirstTimestampInSeconds(content: string): number | null {
      const timestampMatch = content.match(/\((?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})\)/);
      if (!timestampMatch) {
          // Match the pattern (MM:SS)
          const minSecMatch = content.match(/\((\d{1,2}):(\d{1,2})\)/);
          if (minSecMatch) {
              const minutes = Number(minSecMatch[1]);
              const seconds = Number(minSecMatch[2]);
              return minutes * 60 + seconds;
          }
          return null;
      }
      const hours = timestampMatch[1] ? Number(timestampMatch[1]) : 0;
      const minutes = Number(timestampMatch[2]);
      const seconds = Number(timestampMatch[3]);
  
      return hours * 3600 + minutes * 60 + seconds;
  }
  
  
  
  export function extractYouTubeLinkFromSingleDoc(document: any): string | null {
    return extractYouTubeLink(document.pageHeader);
  }

  export function extractTimestamp(document: any): string | null {
    const pattern = /\((\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})\)/;
    const match = document.pageContent.match(pattern);
    
    return match ? match[1] : null;
  }
  
  export const waitForUserInput = () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Press enter to see the next item...', (answer) => {
            rl.close();
            resolve(null);
        });
    });
};