// FeedbackModal.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import { ModalProps } from '@/types'; // Define and export this from your types directory


const FeedbackModal: React.FC<ModalProps> = ({ isOpen, onClose, messageIndex, onSubmit, feedbackType }) => {
  const [remark, setRemark] = useState('');

  const submitRemark = () => {
    if (messageIndex != null) {
      onSubmit(messageIndex, remark);
      setRemark('');
    }
    onClose();
  };

  if (!isOpen) return null;

  let modalText = "What do you like about the response?";
  let iconSrc = '';
  
  switch (feedbackType) {
    case 'up':
      iconSrc = '/icons8-thumb-up-50.png';
      break;
    case 'down':
      iconSrc = '/icons8-thumbs-down-50.png';
      break;
    case 'comment':
      modalText = "Please leave your comment:";
      iconSrc = '/icons8-message-50.png';
      break;
    default:
      break; // default case
  }

  const iconStyle = {
    filter: 'brightness(0) invert(1)',
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          {iconSrc && (
            <span style={{ marginRight: '10px' }}>
              <Image src={iconSrc} alt="Feedback Icon" width={24} height={24} style={iconStyle}/>
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

export default FeedbackModal;
