import React from 'react';

interface InitialDisclaimerModalProps {
  onAccept: () => void;
}

const InitialDisclaimerModal: React.FC<InitialDisclaimerModalProps> = ({ onAccept }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-[90%] max-w-md p-6 shadow-xl animate-fade-in">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Important Notice
          </h2>
          
          <p className="text-sm text-gray-700 dark:text-gray-300">
            The SolidCAM ChatBot provides guidance only and is not a substitute for professional judgment.
            By using this service, you acknowledge that:
          </p>

          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>All recommendations must be verified before implementation</li>
            <li>SolidCAM is not liable for any damages resulting from ChatBot use</li>
            <li>Official documentation should be consulted for final validation</li>
          </ul>

          <button
            onClick={onAccept}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors duration-200 font-medium"
          >
            I Understand and Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default InitialDisclaimerModal;