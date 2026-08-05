import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyALDp0F5ApX45XsfQyH4l-srHFDlADrn8g",
  authDomain: "sevilla-real.firebaseapp.com",
  projectId: "sevilla-real",
  storageBucket: "sevilla-real.firebasestorage.app",
  messagingSenderId: "931745235629",
  appId: "1:931745235629:web:b2d2ed67d6f4ee0fd67c24"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
export const VAPID_KEY = 'BMB5VfrFcGaamQj1KMjeSJQRgg7-0dhJDh8a94gHhFsrmkzn5xPdU1GpsK_HJck28-moHjRPy79ReHtM7tphr9Y';
export { getToken, onMessage };
