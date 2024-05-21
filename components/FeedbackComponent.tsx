//components/FeedbackComponent.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import Tooltip from './Tooltip';
import RemarksModal from './RemarksModal';


let thumbUpIcon = '/icons8-thumbs-up-30.png'
let thumbDownIcon = '/icons8-thumbs-down-30.png'
let commentIcon = '/icons8-message-30.png';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
const PRODUCTION_ENV = 'production';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
    thumbUpIcon = `${PRODUCTION_URL}icons8-thumbs-up-30.png`
    thumbDownIcon = `${PRODUCTION_URL}icons8-thumbs-down-30.png`
    commentIcon = `${PRODUCTION_URL}icons8-message-30.png`
  }

  interface FeedbackComponentProps {
    messageIndex: number;
    qaId: string | undefined;
    roomId: string | null;  // Ensure this prop is added and handled
  }

// FeedbackComponent.tsx
const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ messageIndex, qaId, roomId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [feedbackType, setFeedbackType] = useState('');
  
    const handleOpenModal = (type: string) => {
      setFeedbackType(type);
      setIsModalOpen(true);
    };
  
    const handleCloseModal = () => {
      setIsModalOpen(false);
    };
  
    const handleSubmitFeedback = async (remark : string) => { // Modify to take remark as an argument
      if (!qaId) {
        console.error("No qaId found for message index " + messageIndex);
        return;
      }
      if (!roomId) {
        console.error("No roomId found for feedback submission");
        return;
      }
  
      try {
        const response = await fetch('/api/submit-feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            qaId,
            thumb: feedbackType,
            comment: remark, // Use the remark passed directly
            roomId,
          }),
        });
  
        if (response.ok) {
          //console.log("Feedback submitted successfully for messageIndex:", messageIndex);
          handleCloseModal();
        } else {
          const errorText = await response.text();
          console.error('Failed to submit feedback:', errorText);
        }
      } catch (error) {
        console.error('Network error when submitting feedback:', error);
      }
    };
  
    return (
      <div className="feedback-container">
        {/* Buttons to open the modal with different feedback types */}
        <div className="tooltip-container up">
          <Tooltip message="Give positive feedback">
            <button onClick={() => handleOpenModal('up')}>
              <Image src={thumbUpIcon} alt="Thumb Up" width={20} height={20} />
            </button>
          </Tooltip>
        </div>
        <div className="tooltip-container down">
          <Tooltip message="Give negative feedback">
            <button onClick={() => handleOpenModal('down')}>
              <Image src={thumbDownIcon} alt="Thumb Down" width={20} height={20} />
            </button>
          </Tooltip>
        </div>
        <div className="tooltip-container comment">
          <Tooltip message="Add a comment">
            <button onClick={() => handleOpenModal('comment')}>
              <Image src={commentIcon} alt="Comment" width={20} height={20} />
            </button>
          </Tooltip>
        </div>
  
        {/* Remarks Modal for feedback submission */}
        {isModalOpen && (
          <RemarksModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            messageIndex={messageIndex}
            onSubmit={(msgIndex, remarkValue) => {
              handleSubmitFeedback(remarkValue); // Pass remark directly to the submission function
            }}
            feedbackType={feedbackType}
          />
        )}
      </div>
    );  
  };
  
export default FeedbackComponent;
