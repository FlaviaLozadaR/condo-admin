import { useEffect, useRef } from 'react';
import { Slot } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../src/context/AuthContext';
import { CondoProvider } from '../src/context/CondoContext';
import { ThemeProvider } from '../src/context/ThemeContext';

export default function RootLayout() {
  const notifListener    = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Notificación recibida mientras la app está abierta (foreground)
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      // expo-notifications ya la muestra como banner (configurado en setNotificationHandler)
      console.log('[Push] recibida:', notification.request.content.title);
    });

    // Usuario tocó una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] tocada:', response.notification.request.content.data);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <CondoProvider>
          <Slot />
        </CondoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
