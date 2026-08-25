// Shim for 'ws' package in React Native.
// Supabase realtime-js imports 'ws' but React Native already has WebSocket as a global.
module.exports = global.WebSocket;
