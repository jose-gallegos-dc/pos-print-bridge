import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';

export interface Message {
  type: 'success' | 'error';
  text: string;
}

export default function InlineMessage({ message }: { message: Message | null }) {
  return (
    <Collapse in={message !== null} sx={{ mt: message ? 1 : 0 }}>
      {message && (
        <Alert severity={message.type} variant="outlined" sx={{ py: 0 }}>
          {message.text}
        </Alert>
      )}
    </Collapse>
  );
}
