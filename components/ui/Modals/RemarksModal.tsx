import React, { useState } from 'react';
import Image from 'next/image';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageIndex: number | null;
  onSubmit: (messageIndex: number | null, remark: string) => void;
  feedbackType: 'up' | 'down' | 'comment';
}

const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
const PRODUCTION_ENV = 'production';

// Define icon paths with environment awareness
const getIconPaths = () => {
  const basePath = process.env.NODE_ENV === PRODUCTION_ENV ? PRODUCTION_URL : '/';
  return {
    thumbUpIcon: `${basePath}icons8-thumb-up-50.png`,
    thumbDownIcon: `${basePath}icons8-thumbs-down-50.png`,
    commentIcon: `${basePath}icons8-message-50.png`,
  };
};

const RemarksModal: React.FC<RemarksModalProps> = ({
  isOpen,
  onClose,
  messageIndex,
  onSubmit,
  feedbackType
}) => {
  const [remark, setRemark] = useState('');
  const { thumbUpIcon, thumbDownIcon, commentIcon } = getIconPaths();

  // Determine text based on feedback type
  const modalText = {
    up: "What do you like about the response?",
    down: "What didn't you like about the response?",
    comment: "Please leave your comment:"
  }[feedbackType];

  // Determine icon based on feedback type
  const iconSrc = {
    up: thumbUpIcon,
    down: thumbDownIcon,
    comment: commentIcon
  }[feedbackType];

  const submitRemark = () => {
    if (messageIndex !== null) {
      onSubmit(messageIndex, remark);
      setRemark('');  // Clear the remark
    }
    onClose(); // Close the modal after submission
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          {iconSrc && (
            <span style={{ marginRight: '10px' }}>
              <Image 
                src={iconSrc} 
                alt="Feedback Icon" 
                width={24} 
                height={24} 
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </span>
          )}
          <h2>Provide additional feedback</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <p>{modalText}</p>
          <textarea
            placeholder="Your remarks..."
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          ></textarea>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={submitRemark}>Submit feedback</button>
        </div>
      </div>
    </div>
  );
};

export default RemarksModal;