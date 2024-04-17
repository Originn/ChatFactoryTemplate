//components/MessageList.tsx
import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import FeedbackComponent from '@/components/FeedbackComponent';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  userHasScrolled: boolean;
  setUserHasScrolled: (value: boolean) => void;
  imageUrlUserIcon: string;
  botimageIcon: string;
  handleOpenModal: (type: string, index: number) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  userHasScrolled,
  setUserHasScrolled,
  imageUrlUserIcon,
  botimageIcon,
  handleOpenModal,
}) => {
  const answerStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current && !userHasScrolled) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, userHasScrolled]);

  useEffect(() => {
    const handleScroll = () => {
      if (messageListRef.current) {
        const isAtBottom =
          messageListRef.current.scrollHeight - messageListRef.current.scrollTop ===
          messageListRef.current.clientHeight;
        if (!isAtBottom) {
          setUserHasScrolled(true);
        }
      }
    };

    const messageListElement = messageListRef.current;
    messageListElement?.addEventListener('scroll', handleScroll);

    return () => messageListElement?.removeEventListener('scroll', handleScroll);
  }, [setUserHasScrolled]);

  return (
    <div ref={messageListRef} className={styles.messagelist}>
      {messages.map((message, index) => {
        let webinarCount = 1;
        let documentCount = 1;
        let icon;
        let className;
        if (message.type === 'apiMessage') {
          icon = (
            <Image
              key={index}
              src={botimageIcon}
              alt="AI"
              width="40"
              height="40"
              className={styles.boticon}
              priority
            />
          );
          className = styles.apimessage;
        } else {
          icon = (
            <Image
              key={index}
              src={imageUrlUserIcon}
              alt="Me"
              width="30"
              height="30"
              className={styles.usericon}
              priority
            />
          );
          className =
            loading && index === messages.length - 1
              ? styles.usermessagewaiting
              : styles.usermessage;
        }
        const hasSources = message.sourceDocs && message.sourceDocs.length > 0;
        // Preprocess documents to update counts based on type
  const totalWebinars = message.sourceDocs?.filter(doc => doc.metadata.type === 'youtube').length ?? 0;
  const totalDocuments = message.sourceDocs?.length ?? 0 - totalWebinars; // Assuming other types are documents
  return (
    <React.Fragment key={`chatMessageFragment-${index}`}>
      <div className={className}>
        {icon}
        <div className={styles.markdownanswer} ref={answerStartRef}>
          <ReactMarkdown
            rehypePlugins={[rehypeRaw as any]}
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
            }}
          >
            {message.message}
          </ReactMarkdown>
        </div>
      </div>
      {message.sourceDocs && (
      <div key={`sourceDocsAccordion-${index}`}>
      <Accordion type="single" collapsible className="flex-col">
        {message.sourceDocs.map((doc, docIndex) => {
          let title;
          let currentCount;
          if (doc.metadata.type === 'youtube') {
            title = 'Webinar';
            currentCount = webinarCount++; // Increment count for webinar
          } else { // 'PDF' and 'sentinel' are treated as documents
            title = 'Document';
            currentCount = documentCount++; // Increment count for document
          }

          return (
            <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
              <AccordionTrigger>
                <h3>{`${title} ${currentCount}`}</h3>
              </AccordionTrigger>
                  <AccordionContent>
                  {
                    doc.metadata.type === 'youtube' ? (
                        // YouTube link handling
                        <p>
                            <b>Source:</b>
                            {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View Webinar</a> : 'Unavailable'}
                        </p>
                    ) : doc.metadata.type === 'sentinel' ? (
                        // Sentinel link handling
                        <p>
                            <b>Source:</b>
                            {doc.metadata.source ? <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer">View</a> : 'Unavailable'}
                        </p>
                        
                    ) : (
                        // Default handling
                        <>
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw as any]}
                            components={{
                              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                            }}
                          >
                            {doc.pageContent.split('\n')[0]}
                          </ReactMarkdown>
                          <p className="mt-2">
                            <b>Source:</b>
                            {
                              doc.metadata && doc.metadata.source
                              ? (() => {
                                // Extract all page numbers from the content
                                const pageNumbers = Array.from(doc.pageContent.matchAll(/\((\d+)\)/g), m => parseInt(m[1], 10));

                                // Find the largest page number mentioned
                                const largestPageNumber = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;

                                // Filter for numbers within 2 pages of the largest number, if it exists
                                let candidateNumbers = largestPageNumber !== null ? pageNumbers.filter(n => largestPageNumber - n <= 2) : [];

                                // From the filtered numbers, find the smallest one to use in the link
                                let smallestPageNumberInRange = candidateNumbers.length > 0 ? Math.min(...candidateNumbers) : null;

                                // If no suitable number is found within 2 pages of the largest, decide on fallback strategy
                                // For example, using the largest number or another logic
                                if (smallestPageNumberInRange === null && largestPageNumber !== null) {
                                    // Fallback strategy here
                                    // This example simply uses the largest number
                                    smallestPageNumberInRange = largestPageNumber;
                                }

                                const pageLink = smallestPageNumberInRange !== null ? `${doc.metadata.source}#page=${smallestPageNumberInRange}` : doc.metadata.source;

                                  return <a href={pageLink} target="_blank" rel="noopener noreferrer">View Page</a>;
                                })()
                              : 'Unavailable'
                            }
                          </p>
                        </>
                      )
                    }
                  </AccordionContent>
                </AccordionItem>
                );
              })}
          </Accordion>
        </div>
      )}
      {message.isComplete && (<FeedbackComponent messageIndex={index} handleOpenModal={handleOpenModal}/>)}
    </React.Fragment>
  );
})}

</div>
);
};

export default MessageList;