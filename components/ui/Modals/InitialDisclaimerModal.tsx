import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

interface InitialDisclaimerModalProps {
  onAccept: () => void;
}

const InitialDisclaimerModal: React.FC<InitialDisclaimerModalProps> = ({ onAccept }) => {
  return (
    <Dialog open onClose={onAccept} aria-labelledby="disclaimer-title">
      <DialogTitle id="disclaimer-title">Important Notice</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" paragraph>
          The SolidCAM ChatBot provides guidance only and is not a substitute for professional judgment.
          By using this service, you acknowledge that:
        </Typography>
        <List>
          <ListItem>
            <ListItemText primary="All recommendations must be verified before implementation" />
          </ListItem>
          <ListItem>
            <ListItemText primary="SolidCAM is not liable for any damages resulting from ChatBot use" />
          </ListItem>
          <ListItem>
            <ListItemText primary="Official documentation should be consulted for final validation" />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onAccept} variant="contained" color="primary" fullWidth>
          I Understand and Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InitialDisclaimerModal;