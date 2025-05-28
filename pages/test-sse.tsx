// pages/test-sse.tsx
import { useState } from 'react';

export default function TestSSE() {
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  const testBasicSSE = () => {
    const eventSource = new EventSource('/api/test-sse');
    
    eventSource.onmessage = (event) => {
      setMessages(prev => [...prev, `Message: ${event.data}`]);
    };
    
    eventSource.addEventListener('test', (event) => {
      setMessages(prev => [...prev, `Test event: ${event.data}`]);
    });
    
    eventSource.addEventListener('done', (event) => {
      setMessages(prev => [...prev, `Done event: ${event.data}`]);
      eventSource.close();
    });
    
    eventSource.onerror = (err) => {
      setError('SSE connection error');
      eventSource.close();
    };
  };

  const testChatStream = async () => {
    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: 'Hello, how are you?',
          history: [],
          roomId: 'test-room-123',
          imageUrls: [],
          userEmail: 'test@example.com',
        }),
      });

      setMessages(prev => [...prev, `Response status: ${response.status}`]);
      setMessages(prev => [...prev, `Content-Type: ${response.headers.get('content-type')}`]);

      if (!response.ok) {
        const text = await response.text();
        setError(`Error: ${text}`);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          setMessages(prev => [...prev, `Chunk: ${chunk}`]);
        }
      }
    } catch (err:any) {
      setError(`Fetch error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>SSE Test Page</h1>
      
      <div>
        <button onClick={testBasicSSE}>Test Basic SSE</button>
        <button onClick={testChatStream} style={{ marginLeft: 10 }}>Test Chat Stream</button>
      </div>
      
      {error && <div style={{ color: 'red', marginTop: 10 }}>Error: {error}</div>}
      
      <div style={{ marginTop: 20 }}>
        <h3>Messages:</h3>
        {messages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
    </div>
  );
}