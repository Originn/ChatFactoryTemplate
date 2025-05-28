## Troubleshooting SSE Implementation

Based on the error you're seeing (405 Method Not Allowed), here are the steps to debug and fix the issue:

### 1. Test Basic SSE Functionality

First, navigate to `/test-sse` in your browser and click "Test Basic SSE". This should work if SSE is supported in your environment.

### 2. Check Console Logs

The updated code includes extensive logging. Check your server console for messages like:
- `[chat-stream] Request method: POST`
- `[chat-stream] Starting SSE stream for room: ...`

### 3. Common Issues and Solutions

#### Issue: 405 Method Not Allowed
**Cause**: The API route isn't receiving POST requests properly
**Solution**: 
- Ensure no middleware is intercepting the request
- Check if you have any custom server configuration
- Try adding this to your `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: '/api/chat-stream',
      destination: '/api/chat-stream',
    },
  ];
},
```

#### Issue: CORS Errors
**Cause**: Cross-origin requests being blocked
**Solution**: Already handled in the updated code with proper CORS headers

#### Issue: Response Not Streaming
**Cause**: Next.js or Vercel buffering the response
**Solution**: 
- Added `X-Vercel-Skip-Middleware` header
- Set `responseLimit: false` in API config
- Using `res.flush()` to force data transmission

### 4. Alternative Approach

If SSE continues to have issues, you can use a polling approach temporarily:

```typescript
// Alternative: Polling approach
const pollChat = async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    // ... rest of request
  });
  
  // Poll for updates
  const interval = setInterval(async () => {
    const statusResponse = await fetch(`/api/chat-status?roomId=${roomId}`);
    const data = await statusResponse.json();
    
    if (data.complete) {
      clearInterval(interval);
    }
  }, 500);
};
```

### 5. Verify Deployment Configuration

Make sure your `vercel.json` has the correct configuration:

```json
{
  "functions": {
    "pages/api/chat-stream.ts": {
      "maxDuration": 60,
      "streaming": true
    }
  }
}
```

### 6. Test with cURL

Test the endpoint directly:

```bash
curl -X POST http://localhost:3000/api/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"question":"test","roomId":"test-123","userEmail":"test@example.com","history":[],"imageUrls":[]}'
```

### Next Steps

1. Check the server logs for the debug messages
2. Test the `/test-sse` page to verify SSE works
3. Try the cURL command to test the endpoint directly
4. If issues persist, consider using the polling approach temporarily

The updated implementation should resolve the 405 error. If you still see issues, please share:
1. The console output from the server
2. The browser console errors
3. The network tab details for the failed request