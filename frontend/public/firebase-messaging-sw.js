importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyALDp0F5ApX45XsfQyH4l-srHFDlADrn8g",
  authDomain: "sevilla-real.firebaseapp.com",
  projectId: "sevilla-real",
  storageBucket: "sevilla-real.firebasestorage.app",
  messagingSenderId: "931745235629",
  appId: "1:931745235629:web:b2d2ed67d6f4ee0fd67c24"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Sevilla Real';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
});
