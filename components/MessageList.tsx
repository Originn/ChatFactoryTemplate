import React, { ComponentProps, FC } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/types/chat';
import { ImagePreviewData } from './ImagePreview';
import FeedbackComponent from './FeedbackComponent';
import styles from '@/styles/Home.module.css';
import { handleWebinarClick, handleDocumentClick } from '@/utils/tracking';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

interface CustomLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
}

const CustomLink: FC<CustomLinkProps> = ({ href, children, ...props }) => (
  <a href={href} {...props} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  answerStartRef: React.RefObject<HTMLDivElement>;
  setEnlargedImage: (image: ImagePreviewData) => void;
  botimageIcon: string;
  imageUrlUserIcon: string;
  roomId: string | null;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  answerStartRef,
  setEnlargedImage,
  botimageIcon,
  imageUrlUserIcon,
  roomId,
}) => {
  return (
    <>
      {messages.map((message, index) => {
        let icon;
        let className;

        if (message.type === 'apiMessage') {
          icon = (
            <Image
              key={index}
              src={botimageIcon}
              alt="AI"
              width={40}
              height={40}
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
              width={30}
              height={30}
              className={styles.usericon}
              priority
            />
          );
          className =
            loading && index === messages.length - 1
              ? styles.usermessagewaiting
              : styles.usermessage;
        }

        let formattedMessage = '';
        if (typeof message.message === 'string') {
          formattedMessage = message.message
            .replace(/\[Image model answer:[\s\S]*?\]/g, '')
            .trim();
        }

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
          <React.Fragment key={`chatMessageFragment-${index}`}>
            <div className={className}>
              {icon}
              <div className={styles.markdownanswer} ref={answerStartRef}>
                {images.length > 0 && (
                  <div
                    className="image-container"
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      justifyContent: 'start',
                    }}
                  >
                    {images.map((image, imgIndex) => (
                      <div key={imgIndex}>
                        <img
                          src={image.url}
                          alt={`User uploaded: ${image.fileName}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            cursor: 'pointer',
                          }}
                          onClick={() => setEnlargedImage(image)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <ReactMarkdown
                  components={{
                    a: (props: ComponentProps<'a'>) => <CustomLink {...props} />,
                  }}
                >
                  {formattedMessage}
                </ReactMarkdown>
              </div>
            </div>

            {message.sourceDocs && message.sourceDocs.length > 0 && (
              <div key={`sourceDocsAccordion-${index}`}>
                <Accordion type="single" collapsible className="flex-col">
                  {(() => {
                    let webinarCount = 0;
                    let documentCount = 0;
                    const webinarTimestamps = new Set();

                    return message.sourceDocs.map((doc, docIndex) => {
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
                        <AccordionItem key={`messageSourceDocs-${docIndex}`} value={`item-${docIndex}`}>
                          <AccordionTrigger>
                            <h3>{title}</h3>
                          </AccordionTrigger>
                          <AccordionContent>
                            {(() => {
                              if (doc.metadata.type === 'youtube' || doc.metadata.type === 'vimeo') {
                                return (
                                  <p>
                                    <b>Source:</b>
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
                                    <b>Source:</b>
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
                                      components={{ a: (props: ComponentProps<'a'>) => <CustomLink {...props} /> }}
                                    >
                                      {doc.pageContent.split('\n')[0]}
                                    </ReactMarkdown>
                                    <p className="mt-2">
                                      <b>Source:</b>
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
            )}

            {message.type === 'apiMessage' && message.isComplete && (
              <FeedbackComponent
                key={index}
                messageIndex={index}
                qaId={message.qaId}
                roomId={roomId}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default MessageList;
