// Simple test script to verify the endpoint
async function testChatStream() {
  try {
    console.log('Testing chat-stream endpoint...');
    
    const response = await fetch('http://localhost:3000/api/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'Hello',
        roomId: 'test-room',
        userEmail: 'test@example.com',
        history: [],
        imageUrls: []
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const text = await response.text();
      console.error('Error response:', text);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      console.log('Reading stream...');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        console.log('Chunk:', chunk);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
if (typeof window !== 'undefined') {
  window.testChatStream = testChatStream;
  console.log('Test function available. Run: testChatStream()');
} else {
  testChatStream();
}