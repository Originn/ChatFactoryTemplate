//ranking.ts

import { TfIdf } from 'natural';
import { Document } from 'langchain/document';

function getTfIdfVector(text: string, tfidf: TfIdf, vocabulary: string[], documentIndices: { [doc: string]: number }): number[] {
    const index = documentIndices[text];
    if (index === undefined) {
        console.warn("Document not found in TF-IDF documents:", text);
        return Array(vocabulary.length).fill(0);
    }
    
    return vocabulary.map(term => tfidf.tfidf(term, index));
}

export function rankDocumentsByRelevance(question: string, documents: Document[]): Document[] {
    const tfidf = new TfIdf();

    // Normalize text by converting to lowercase
    const normalizedQuestion = question.toLowerCase();
    const questionTerms = normalizedQuestion.split(/\W+/);
    
    
    // Extract the pageContent from each document and normalize it
    const normalizedDocs = documents.map(doc => doc.pageContent.toLowerCase());

    // Change the type of documentIndices
    const documentIndices: { [doc: string]: number } = {};

    normalizedDocs.forEach((doc, index) => {
        tfidf.addDocument(doc, String(index));
        documentIndices[doc] = index;
    });

    // Create a vocabulary of all unique terms in all documents
    const vocabulary: string[] = Array.from(new Set(normalizedDocs.join(' ').split(/\W+/)));

    const questionVector = vocabulary.map(term => questionTerms.includes(term) ? 1 : 0);

    documents.forEach((document, index) => {
        const docVector = getTfIdfVector(normalizedDocs[index], tfidf, vocabulary, documentIndices);

        document.score = cosineSimilarity(questionVector, docVector);
    });

    return documents.sort((a, b) => (b.score || 0) - (a.score || 0));
}



export function filterDocumentsByScore(rankedResults: { doc: string, score: number }[], threshold: number = 0.05): string[] {
    return rankedResults
        .filter(result => result.score > threshold)
        .map(result => result.doc);
}


export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, index) => sum + a * vecB[index], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;  // or another default value
    }
    return dotProduct / (magnitudeA * magnitudeB);
}

