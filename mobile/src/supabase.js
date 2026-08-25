import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  'https://wanhnbpirnohzfszpjh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbmhuYnBpcm5vaHpmenN6cGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE4OTAsImV4cCI6MjA5Mjk2Nzg5MH0.mp9Sr6oFY-m-cybo_ZygbBN7fShswGii2FM1YigJJgE',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionFromUrl: false,
    },
    realtime: {
      transport: global.WebSocket,
    },
  }
);
