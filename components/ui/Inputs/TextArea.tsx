import * as React from 'react';
import TextField, { TextFieldProps } from '@mui/material/TextField';


/**
 * Wrapper component around MUI's {@link TextField} in multiline mode.
 * This mirrors the previous TextArea API but uses Material UI styling.
 */
export type TextAreaProps = TextFieldProps;


const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (props, ref) => (
    <TextField
      multiline
      fullWidth
      variant="outlined"
      inputRef={ref}
      {...props}
    />
  ),
);

TextArea.displayName = 'TextArea';

export default TextArea;
