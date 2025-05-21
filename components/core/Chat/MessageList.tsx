import React, { memo } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import {
  List,
  ListItem,
  Card,
  CardContent,
  Box,
} from '@mui/material';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import FeedbackComponent from './FeedbackComponent';
import { ImagePreviewData } from '@/components/core/Media';
import { handleWebinarClick, handleDocumentClick } from '@/utils/tracking';
import { ChatMessage } from './types';

interface CustomLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
}

const CustomLink: React.FC<CustomLinkProps> = ({ href, children, ...props }) => (
  <a href={href} {...props} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  answerStartRef: React.RefObject<HTMLDivElement>;
  setEnlargedImage: (image: ImagePreviewData) => void;
  botimageIcon: string;
  imageUrlUserIcon: string;
  roomId: string | null;
  theme: 'light' | 'dark';
}

// User message component
const UserMessage = memo(({
  message,
  icon,
  loading,
  setEnlargedImage,
  backgroundColor = '#f5f5f5',
  borderColor = '#eeeeee',
  theme
}: {
  message: ChatMessage;
  icon: JSX.Element;
  loading: boolean;
  setEnlargedImage: (image: ImagePreviewData) => void;
  backgroundColor?: string;
  borderColor?: string;
  theme: 'light' | 'dark';
}) => {
  
  const formattedMessage = typeof message.message === 'string' 
    ? message.message.replace(/\[Image model answer:[\s\S]*?\]/g, '').trim()
    : '';

  const images = message.imageUrls
    ? message.imageUrls.map((url: string, imgIndex: number) => ({
        url,
        fileName: `Uploaded Image ${imgIndex + 1}`,
      }))
    : message.images
    ? message.images.map((image, imgIndex) => ({
        url: image.url,
        fileName: image.fileName,
      }))
    : [];

  return (
    <ListItem 
      disableGutters 
      alignItems="flex-start"
      sx={{
        backgroundColor: backgroundColor,
        padding: '15px',
        borderBottom: `1px solid ${borderColor}`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        color: theme === 'dark' ? '#ffffff' : '#000000'
      }}
    >
      {icon}
      <Box sx={{ flex: 1 }}>
        {images.length > 0 && (
          <Box
            sx={{
              mb: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'start',
            }}
          >
            {images.map((image, imgIndex) => (
              <Box key={imgIndex} onClick={() => setEnlargedImage(image)} sx={{ cursor: 'pointer' }}>
                <img src={image.url} alt={`User uploaded: ${image.fileName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            ))}
          </Box>
        )}

        <ReactMarkdown components={{ a: (props: React.ComponentProps<'a'>) => <CustomLink {...props} /> }}>
          {formattedMessage}
        </ReactMarkdown>
      </Box>
    </ListItem>
  );
});// API message component
const ApiMessage = memo(({
  message,
  icon,
  answerStartRef,
  setEnlargedImage,
  backgroundColor = '#ffffff',
  borderColor = '#eeeeee',
  theme
}: {
  message: ChatMessage;
  icon: JSX.Element;
  answerStartRef: React.RefObject<HTMLDivElement>;
  setEnlargedImage: (image: ImagePreviewData) => void;
  backgroundColor?: string;
  borderColor?: string;
  theme: 'light' | 'dark';
}) => {
  const formattedMessage = typeof message.message === 'string'
    ? message.message.replace(/\[Image model answer:[\s\S]*?\]/g, '').trim()
    : '';

  const images = message.imageUrls
    ? message.imageUrls.map((url: string, imgIndex: number) => ({
        url,
        fileName: `Uploaded Image ${imgIndex + 1}`,
      }))
    : message.images
    ? message.images.map((image, imgIndex) => ({
        url: image.url,
        fileName: image.fileName,
      }))
    : [];

  return (
    <ListItem 
      disableGutters 
      alignItems="flex-start"
      sx={{
        backgroundColor: backgroundColor,
        padding: '15px',
        borderBottom: `1px solid ${borderColor}`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        color: theme === 'dark' ? '#ffffff' : '#000000'
      }}
    >
      {icon}
      <Box sx={{ flex: 1 }}>
        <Box ref={answerStartRef}>
          {images.length > 0 && (
            <Box
              sx={{
                mb: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'start',
              }}
            >
              {images.map((image, imgIndex) => (
                <Box key={imgIndex} onClick={() => setEnlargedImage(image)} sx={{ cursor: 'pointer' }}>
                  <img src={image.url} alt={`AI response: ${image.fileName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ))}
            </Box>
          )}

          <ReactMarkdown components={{ a: (props: React.ComponentProps<'a'>) => <CustomLink {...props} /> }}>
            {formattedMessage}
          </ReactMarkdown>
        </Box>
      </Box>
    </ListItem>
  );
});

// Source Documents component
const SourceDocuments = memo(({ 
  sourceDocs, 
  index,
  theme
}: { 
  sourceDocs: any[]; 
  index: number;
  theme: 'light' | 'dark';
}) => {
  if (!sourceDocs || sourceDocs.length === 0) return null;
  
  // Check if dark mode is enabled
  const isDarkMode = document.body.classList.contains('dark');

  return (
    <div 
      key={`sourceDocsAccordion-${index}`}
      style={{
        backgroundColor: theme === 'dark' ? '#222222' : '#f5f5f5',
        padding: '0 15px 15px 75px',  // Increased left padding to match
        borderBottom: `1px solid ${theme === 'dark' ? '#444444' : '#eeeeee'}`,
        color: theme === 'dark' ? '#ffffff' : '#000000'
      }}
    >
      <Accordion type="single" collapsible className="flex-col">
        {(() => {
          let webinarCount = 0;
          let documentCount = 0;
          const webinarTimestamps = new Set();

          return sourceDocs.map((doc, docIndex) => {
            let title;
            if (doc.metadata.type === 'youtube' || doc.metadata.type === 'vimeo') {
              if (!webinarTimestamps.has(doc.metadata.timestamp)) {
                webinarCount++;
                webinarTimestamps.add(doc.metadata.timestamp);
                title = `Webinar ${webinarCount}`;
              } else {
                return null;
              }
            } else {
              documentCount++;
              title = `Document ${documentCount}`;
            }

            if (!title) return null;            return (
              <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
                <AccordionTrigger>
                  <h3>{title}</h3>
                </AccordionTrigger>
                <AccordionContent>
                  {(() => {
                    if (doc.metadata.type === 'youtube' || doc.metadata.type === 'vimeo') {
                      return (
                        <p>
                          <b>Source:</b>{' '}
                          {doc.metadata.source ? (
                            <a
                              href={doc.metadata.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleWebinarClick(doc.metadata.source)}
                            >
                              View Webinar
                            </a>
                          ) : (
                            'Unavailable'
                          )}
                        </p>
                      );
                    } else if (doc.metadata.type === 'sentinel') {
                      return (
                        <p>
                          <b>Source:</b>{' '}
                          {doc.metadata.source ? (
                            <a
                              href={doc.metadata.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleDocumentClick(doc.metadata.source)}
                            >
                              View
                            </a>
                          ) : (
                            'Unavailable'
                          )}
                        </p>
                      );
                    } else {
                      return (
                        <>
                          <ReactMarkdown
                            components={{ a: (props: React.ComponentProps<'a'>) => <CustomLink {...props} /> }}
                          >
                            {doc.pageContent.split('\n')[0]}
                          </ReactMarkdown>
                          <p className="mt-2">
                            <b>Source:</b>{' '}
                            {doc.metadata && doc.metadata.source
                              ? (() => {
                                  const pageNumbers = Array.from(
                                    doc.pageContent.matchAll(/\((\d+)\)/g),
                                    m => parseInt(m[1], 10)
                                  );
                                  const largestPageNumber =
                                    pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;
                                  let candidateNumbers =
                                    largestPageNumber !== null
                                      ? pageNumbers.filter(n => largestPageNumber - n <= 2)
                                      : [];
                                  let smallestPageNumberInRange =
                                    candidateNumbers.length > 0 ? Math.min(...candidateNumbers) : null;
                                  if (smallestPageNumberInRange === null && largestPageNumber !== null) {
                                    smallestPageNumberInRange = largestPageNumber;
                                  }
                                  const pageLink =
                                    smallestPageNumberInRange !== null
                                      ? `${doc.metadata.source}#page=${smallestPageNumberInRange}`
                                      : doc.metadata.source;
                                  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                                  const iosPageLink = isiOS ? pageLink.replace('#page=', '#page') : pageLink;
                                  return (
                                    <a
                                      href={iosPageLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => handleDocumentClick(pageLink)}
                                    >
                                      View Page
                                    </a>
                                  );
                                })()
                              : 'Unavailable'}
                          </p>
                        </>
                      );
                    }
                  })()}
                </AccordionContent>
              </AccordionItem>
            );
          });
        })()}
      </Accordion>
    </div>
  );
});// Main MessageList component
const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  answerStartRef,
  setEnlargedImage,
  botimageIcon,
  imageUrlUserIcon,
  roomId,
  theme
}) => {
  // Define theme-based colors
  const userMessageBg = theme === 'dark' ? '#333333' : '#ffffff';
  const apiMessageBg = theme === 'dark' ? '#222222' : '#f5f5f5';
  const borderColor = theme === 'dark' ? '#444444' : '#eeeeee';

  return (
    <List sx={{ padding: 0, width: '100%' }}>
      {messages.map((message, index) => {
        let icon;
        
        if (message.type === 'apiMessage') {
          icon = (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              position: 'relative',
              top: '10px', // Drop icon by 10px
              mr: 1
            }}>
              <Image key={index} src={botimageIcon} alt="AI" width={30} height={30} priority />
            </Box>
          );
        } else {
          icon = (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              position: 'relative',
              top: '10px', // Drop icon by 10px
              mr: 1
            }}>
              <Image key={index} src={imageUrlUserIcon} alt="Me" width={28} height={28} priority />
            </Box>
          );
        }

        return (
          <React.Fragment key={`chatMessageFragment-${index}`}>
            {message.type === 'apiMessage' ? (
              <ApiMessage
                message={message}
                icon={icon}
                answerStartRef={answerStartRef}
                setEnlargedImage={setEnlargedImage}
                backgroundColor={apiMessageBg}
                borderColor={borderColor}
                theme={theme}
              />
            ) : (
              <UserMessage
                message={message}
                icon={icon}
                loading={loading && index === messages.length - 1}
                setEnlargedImage={setEnlargedImage}
                backgroundColor={userMessageBg}
                borderColor={borderColor}
                theme={theme}
              />
            )}

            {message.sourceDocs && message.sourceDocs.length > 0 && (
              <SourceDocuments sourceDocs={message.sourceDocs} index={index} theme={theme} />
            )}

            {message.type === 'apiMessage' && message.isComplete && (
              <FeedbackComponent
                key={index}
                messageIndex={index}
                qaId={message.qaId}
                roomId={roomId}
                theme={theme}
              />
            )}
          </React.Fragment>
        );
      })}
    </List>
  );
};

UserMessage.displayName = 'UserMessage';
ApiMessage.displayName = 'ApiMessage';
SourceDocuments.displayName = 'SourceDocuments';

export default memo(MessageList);