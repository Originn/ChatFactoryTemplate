# Socket.IO to SSE Migration Guide

## Overview
This guide documents the changes made to migrate from Socket.IO to Server-Sent Events (SSE) for Vercel deployment compatibility.

## Files Created

### 1. `/pages/api/chat-stream.ts`
- SSE endpoint for chat functionality
- Replaces the Socket.IO-based streaming in `/pages/api/chat.ts`
- Streams tokens via SSE events

### 2. `/utils/makechain-sse.ts`
- Modified version of `makechain.ts` for SSE
- Uses callbacks instead of Socket.IO emissions
- Returns results instead of emitting via sockets

### 3. `/hooks/useChatSSE.tsx`
- New React hook replacing `useChat.tsx`
- Handles SSE connections and message streaming
- Manages chat state without Socket.IO

### 4. `/vercel.json`
- Vercel configuration for SSE endpoints
- Sets 60-second timeout for streaming functions

## Files Modified

### 1. `/components/core/Chat/ChatContainer.tsx`
- Changed import from `useChat` to `useChatSSE`
- Updated to use `streamChat` function for SSE
- Removed embedding mode functionality

## Migration Steps to Complete

### 1. Remove Socket.IO Dependencies
```bash
npm uninstall socket.io socket.io-client
```

### 2. Remove Socket.IO Files
- Delete `/socketServer.cjs`
- Delete `/socketManager.js`

### 3. Update Server Initialization
Remove Socket.IO initialization from your server startup code (likely in `pages/api/[...].ts` or custom server file).

### 4. Test the Implementation
1. Start the development server: `npm run dev`
2. Test chat functionality
3. Test image uploads
4. Verify token streaming works correctly

### 5. Deploy to Vercel
```bash
vercel --prod
```

## Key Differences

### Socket.IO Approach
- Bidirectional WebSocket connection
- Room-based communication
- Event-based messaging
- Persistent connection

### SSE Approach
- Unidirectional server-to-client streaming
- HTTP-based (works with serverless)
- Event stream format
- Auto-reconnection built-in

## Troubleshooting

### Issue: Tokens not streaming
- Check browser console for SSE connection errors
- Verify SSE headers are set correctly
- Ensure Vercel function timeout is sufficient

### Issue: Connection drops
- SSE automatically reconnects
- Check for client-side errors
- Verify server is sending keep-alive messages

### Issue: CORS errors
- Ensure `Access-Control-Allow-Origin` header is set
- Check Vercel deployment settings

## Rollback Plan

If you need to rollback to Socket.IO:
1. Restore original files from git
2. Reinstall Socket.IO dependencies
3. Remove SSE-related files
4. Revert ChatContainer.tsx changes

## Performance Considerations

- SSE is more efficient for one-way streaming
- Lower overhead than WebSockets
- Better compatibility with CDNs and proxies
- Works seamlessly with Vercel's serverless architecture

## Future Enhancements

1. Add request queuing for multiple concurrent chats
2. Implement message compression
3. Add telemetry for monitoring streaming performance
4. Consider implementing fallback to polling for older browsers