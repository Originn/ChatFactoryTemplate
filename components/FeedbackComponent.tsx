// Import necessary React and Next.js components
import React from 'react';
import Image from 'next/image';
import Tooltip from './Tooltip'; // Adjust the import path according to your directory structure
import styles from '@/styles/Home.module.css';

// Import types
import { FeedbackComponentProps } from '@/types/index'; // Ensure you have exported this type from your types directory

// Image URLs or import them appropriately if defined elsewhere
const thumbUpIcon = '/icons8-thumb-up-50.png';
const thumbDownIcon = '/icons8-thumbs-down-50.png';
const commentIcon = '/icons8-message-50.png';

const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ messageIndex, handleOpenModal }) => {
  return (
    <div className="feedback-container">
      <div className="submit-feedback-label">Submit Feedback</div>
      <div className="tooltip-container up">
        <Tooltip message="Give positive feedback">
          <button onClick={() => handleOpenModal('up', messageIndex)}>
            <Image src={thumbUpIcon} alt="Thumb Up" width={20} height={20} />
          </button>
        </Tooltip>
      </div>
      <div className="tooltip-container down">
        <Tooltip message="Give negative feedback">
          <button onClick={() => handleOpenModal('down', messageIndex)}>
            <Image src={thumbDownIcon} alt="Thumb Down" width={20} height={20} />
          </button>
        </Tooltip>
      </div>
      <div className="tooltip-container comment">
        <Tooltip message="Add a comment">
          <button onClick={() => handleOpenModal('comment', messageIndex)}>
            <Image src={commentIcon} alt="Comment" width={20} height={20} />
          </button>
        </Tooltip>
      </div>
      <div className={styles.lineSeparator}></div> {/* Line Separator */}
    </div>
  );
};

export default FeedbackComponent;
