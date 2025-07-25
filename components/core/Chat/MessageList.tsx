import React, { memo } from 'react';
import { keyframes } from '@mui/system';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import {
  List,
  ListItem,
  Card,
  CardContent,
  Box,
  Avatar,
} from '@mui/material';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import FeedbackComponent from './FeedbackComponent';
import { ImagePreviewData } from '@/components/core/Media';
import { handleWebinarClick, handleDocumentClick } from '@/utils/tracking';
import { ChatMessage } from './types';
import PdfSourceLink from './PdfSourceLink';
import { auth } from '@/utils/firebase';

interface CustomLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
}

const CustomLink: React.FC<CustomLinkProps> = ({ href, children, ...props }) => (
  <a href={href} {...props} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

// User Avatar component that shows Google profile image with fallback to static icon
const UserAvatar = memo(({ fallbackIconSrc }: { fallbackIconSrc: string }) => {
  const [userPhotoURL, setUserPhotoURL] = React.useState<string | null>(null);
  const [photoLoadError, setPhotoLoadError] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user?.photoURL) {
        // Normalize Google Photos URL for consistent loading
        let photoUrl = user.photoURL;
        if (photoUrl.includes('googleusercontent.com')) {
          photoUrl = photoUrl.replace(/=s\d+-c$/, '=s96-c');
        }
        setUserPhotoURL(photoUrl);
        setPhotoLoadError(false);
      } else {
        setUserPhotoURL(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // If we have a profile photo and it hasn't failed to load, use Avatar
  if (userPhotoURL && !photoLoadError) {
    return (
      <Avatar
        src={userPhotoURL}
        imgProps={{
          crossOrigin: 'anonymous',
          referrerPolicy: 'no-referrer'
        }}
        onError={() => setPhotoLoadError(true)}
        sx={{
          width: { xs: 24, sm: 28 },
          height: { xs: 24, sm: 28 },
        }}
      />
    );
  }

  // Fallback to static icon
  return <Image src={fallbackIconSrc} alt="Me" width={24} height={24} priority style={{ width: 'clamp(20px, 4vw, 28px)', height: 'clamp(20px, 4vw, 28px)' }} />;
});

UserAvatar.displayName = 'UserAvatar';

const shine = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  answerStartRef: React.RefObject<HTMLDivElement>;
  setEnlargedImage: (image: ImagePreviewData) => void;
  botimageIcon: string;
  imageUrlUserIcon: string;
  roomId: string | null;
  theme: 'light' | 'dark';
  highlightLastUserMessage?: boolean;
}

// User message component
const UserMessage = memo(({
  message,
  icon,
  loading,
  setEnlargedImage,
  backgroundColor = '#f5f5f5',
  borderColor = '#eeeeee',
  theme,
  highlight = false
}: {
  message: ChatMessage;
  icon: JSX.Element;
  loading: boolean;
  setEnlargedImage: (image: ImagePreviewData) => void;
  backgroundColor?: string;
  borderColor?: string;
  theme: 'light' | 'dark';
  highlight?: boolean;
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
        padding: { xs: '10px', sm: '15px' },
        borderBottom: `1px solid ${borderColor}`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        color: theme === 'dark' ? '#ffffff' : '#000000',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: { xs: '0.875rem', sm: '1rem' },
        ...(highlight && {
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${
              theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
            }, transparent)`,
            backgroundSize: '200% 100%',
            animation: `${shine} 1.5s linear infinite alternate`,
            pointerEvents: 'none',
          },
        })
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

        <Box 
          sx={{ 
            '& *': { 
              fontSize: { xs: '0.875rem !important', sm: '1rem !important' } 
            },
            '& ul, & ol': {
              paddingLeft: { xs: '16px', sm: '24px' },
              marginTop: { xs: '4px', sm: '8px' },
              marginBottom: { xs: '4px', sm: '8px' }
            },
            '& li': {
              marginBottom: { xs: '2px', sm: '4px' },
              lineHeight: { xs: 1.4, sm: 1.6 }
            },
            '& p': {
              marginTop: { xs: '4px', sm: '8px' },
              marginBottom: { xs: '4px', sm: '8px' },
              lineHeight: { xs: 1.4, sm: 1.6 }
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              fontSize: { xs: '1rem !important', sm: '1.125rem !important' },
              marginTop: { xs: '8px', sm: '12px' },
              marginBottom: { xs: '4px', sm: '8px' }
            }
          }}
        >
          <ReactMarkdown components={{ a: (props: React.ComponentProps<'a'>) => <CustomLink {...props} /> }}>
            {formattedMessage}
          </ReactMarkdown>
        </Box>
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
        padding: { xs: '10px', sm: '15px' },
        borderBottom: `1px solid ${borderColor}`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        color: theme === 'dark' ? '#ffffff' : '#000000',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: { xs: '0.875rem', sm: '1rem' },
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

          <Box 
            sx={{ 
              '& *': { 
                fontSize: { xs: '0.875rem !important', sm: '1rem !important' } 
              },
              '& ul, & ol': {
                paddingLeft: { xs: '16px', sm: '24px' },
                marginTop: { xs: '4px', sm: '8px' },
                marginBottom: { xs: '4px', sm: '8px' }
              },
              '& li': {
                marginBottom: { xs: '2px', sm: '4px' },
                lineHeight: { xs: 1.4, sm: 1.6 }
              },
              '& p': {
                marginTop: { xs: '4px', sm: '8px' },
                marginBottom: { xs: '4px', sm: '8px' },
                lineHeight: { xs: 1.4, sm: 1.6 }
              },
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                fontSize: { xs: '1rem !important', sm: '1.125rem !important' },
                marginTop: { xs: '8px', sm: '12px' },
                marginBottom: { xs: '4px', sm: '8px' }
              }
            }}
          >
            <ReactMarkdown components={{ a: (props: React.ComponentProps<'a'>) => <CustomLink {...props} /> }}>
              {formattedMessage}
            </ReactMarkdown>
          </Box>
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
        backgroundColor: 'transparent',
        padding: '0',
        borderBottom: 'none',
        color: theme === 'dark' ? '#ffffff' : '#000000',
        marginTop: '0', // Remove gap above first box
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ 
        width: '100%', 
        maxWidth: '100%', 
        boxSizing: 'border-box',
        margin: 0,
        padding: 0 
      }}>
        <Accordion 
          type="single" 
          collapsible 
          className="w-full" 
          style={{ 
            margin: 0, 
            padding: 0, 
            width: '100%',
            boxSizing: 'border-box'
          }}>
          {(() => {
            let webinarCount = 0;
            let documentCount = 0;
            const webinarTimestamps = new Set();

            return sourceDocs
              .filter(doc => doc.metadata.type !== 'image') // Filter out image sources
              .filter(doc => (doc.metadata.score || 0) > 0.5348) // Filter by score threshold
              .map((doc, docIndex) => {
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

              if (!title) return null;
              
              return (
                <div key={`accordion-item-wrapper-${docIndex}`} style={{ 
                  width: '100%', 
                  maxWidth: '100%', 
                  boxSizing: 'border-box',
                  marginBottom: 0, // Remove gap between accordion items
                }}>
                  <AccordionItem 
                    key={`messageSourceDocs-${docIndex}`} 
                    value={`item-${docIndex}`}
                    className="w-full outline-none focus:outline-none border-0 border-t border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:ring-offset-0"
                    style={{ 
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      border: 'none',
                      borderTop: `1px solid ${theme === 'dark' ? '#444444' : '#dddddd'}`,
                      borderBottom: `1px solid ${theme === 'dark' ? '#444444' : '#dddddd'}`,
                      marginTop: docIndex === 0 ? 0 : '-1px', // Collapse borders
                      marginBottom: 0,
                      background: 'transparent',
                      outline: 'none',
                      boxShadow: 'none'
                    }}
                  >
                  <AccordionTrigger 
                    className="w-full outline-none focus:outline-none accordion-trigger"
                    style={{ 
                      width: '100%', 
                      maxWidth: '100%', 
                      boxSizing: 'border-box',
                      paddingLeft: '15px',
                      paddingRight: '15px',
                      minHeight: '34px',
                      background: 'transparent',
                      outline: 'none',
                      boxShadow: 'none',
                      border: 'none',
                      color: theme === 'dark' ? '#ffffff' : '#000000',
                      cursor: 'pointer' // Change cursor to pointing hand on hover
                    }}
                  >
                    <strong style={{ 
                      letterSpacing: '0.01em',
                      fontWeight: '600',
                      fontSize: '15px',
                      color: theme === 'dark' ? '#ffffff' : '#000000'
                    }}>{title}</strong>
                  </AccordionTrigger>
                  <AccordionContent 
                    className="w-full outline-none focus:outline-none"
                    style={{ 
                      width: '100%', 
                      maxWidth: '100%', 
                      boxSizing: 'border-box',
                      outline: 'none',
                      boxShadow: 'none',
                      border: 'none'
                    }}
                  >
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
                            {doc.metadata && (doc.metadata.pdf_source || doc.metadata.source)
                              ? (() => {
                                  // Prioritize pdf_source + page_number/page_numbers combination
                                  if (doc.metadata.pdf_source && (doc.metadata.page_number || doc.metadata.page_numbers)) {
                                    // Use page_number if available, otherwise use first page from page_numbers array
                                    const pageNumber = doc.metadata.page_number || 
                                      (doc.metadata.page_numbers && doc.metadata.page_numbers.length > 0 ? doc.metadata.page_numbers[0] : null);
                                    
                                    if (pageNumber) {
                                      return (
                                        <PdfSourceLink
                                          pdfSource={doc.metadata.pdf_source}
                                          pageNumber={pageNumber}
                                          onDocumentClick={handleDocumentClick}
                                        />
                                      );
                                    }
                                  }
                                  
                                  // Fallback to original logic for legacy documents
                                  const sourceUrl = doc.metadata.source;
                                  if (!sourceUrl) return 'Unavailable';
                                  
                                  const pageNumbers = Array.from(
                                    doc.pageContent.matchAll(/\((\d+)\)/g),
                                    (m: RegExpMatchArray) => parseInt(m[1], 10)
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
                                      ? `${sourceUrl}#page=${smallestPageNumberInRange}`
                                      : sourceUrl;
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
                </div>
              );
            });
          })()}
        </Accordion>
      </div>
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
  theme,
  highlightLastUserMessage = false
}) => {
  // Define theme-based colors
  const userMessageBg = theme === 'dark' ? '#333333' : '#ffffff';
  const apiMessageBg = theme === 'dark' ? '#000000' : '#f5f5f5';
  const borderColor = theme === 'dark' ? '#444444' : '#eeeeee';

  return (
    <List sx={{ 
      padding: 0, 
      width: '100%', 
      maxWidth: '100%', 
      boxSizing: 'border-box',
      height: '100%',
      overflow: 'visible', // Allow natural flow within container
      margin: 0,
    }} className="chat-message-list">
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
              <Image key={index} src={botimageIcon} alt="AI" width={30} height={30} priority style={{ width: 'clamp(24px, 4vw, 30px)', height: 'clamp(24px, 4vw, 30px)' }} />
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
              <UserAvatar fallbackIconSrc={imageUrlUserIcon} />
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
                highlight={highlightLastUserMessage && index === messages.length - 1}
              />
            )}

            {message.sourceDocs && message.sourceDocs.length > 0 && (
              <SourceDocuments sourceDocs={message.sourceDocs} index={index} theme={theme} />
            )}

            {message.type === 'apiMessage' && message.isComplete && (
              <div style={{ 
                position: 'relative', 
                width: '100%', 
                zIndex: 1,
                marginBottom: '10px',
                paddingBottom: '10px'
              }}>
                <FeedbackComponent
                  key={index}
                  messageIndex={index}
                  qaId={message.qaId}
                  roomId={roomId}
                  theme={theme}
                />
              </div>
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