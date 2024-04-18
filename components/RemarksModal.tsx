//components/RemarksModal.tsx
import React, { useState } from 'react';
import Image from 'next/image';

interface RemarksModalProps {
  isOpen: boolean,
  onClose: () => void,
  messageIndex: number | null,
  onSubmit: (messageIndex: number | null, remark: string) => void,
  feedbackType: string,
}

let thumbUpIcon = '/icons8-thumb-up-50.png'
let thumbDownIcon = '/icons8-thumbs-down-50.png'
let commentIcon = '/icons8-message-50.png';
const PRODUCTION_URL = 'https://solidcam.herokuapp.com/';
const PRODUCTION_ENV = 'production';

if (process.env.NODE_ENV === PRODUCTION_ENV) {
    thumbUpIcon = `${PRODUCTION_URL}icons8-thumb-up-50.png`
    thumbDownIcon = `${PRODUCTION_URL}icons8-thumbs-down-50.png`
    commentIcon = `${PRODUCTION_URL}icons8-message-50.png`
  }


const RemarksModal: React.FC<RemarksModalProps> = ({
  isOpen,
  onClose,
  messageIndex,
  onSubmit,
  feedbackType
}) => {
  const [remark, setRemark] = useState('');

  let modalText = "What do you like about the response?";
  if (feedbackType === 'down') {
    modalText = "What didn't you like about the response?";
  } else if (feedbackType === 'comment') {
    modalText = "Please leave your comment:";
  }

  let iconSrc;
  switch (feedbackType) {
    case 'up':
      iconSrc = thumbUpIcon; // Update these paths as needed
      break;
    case 'down':
      iconSrc = thumbDownIcon;
      break;
    case 'comment':
      iconSrc = commentIcon;
      break;
    default:
      iconSrc = ''; // default case, no icon
  }

  const submitRemark = () => {
    if (messageIndex != null) {
      onSubmit(messageIndex, remark);
      setRemark('');  // Clear the remark
    }
    onClose(); // Close the modal after submission
  };

  if (!isOpen) return null;

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

export default RemarksModal;
