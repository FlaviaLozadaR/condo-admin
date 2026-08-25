import { useEffect, useRef } from 'react';
import { Slot, useRouter } from 'expo-router';
import { Text, TextInput } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../src/context/AuthContext';
import { CondoProvider } from '../src/context/CondoContext';
import { ThemeProvider } from '../src/context/ThemeContext';

// Disable Android system font scaling across the entire app
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;

export default function RootLayout() {
  const notifListener    = useRef();
  const responseListener = useRef();
  const router = useRouter();

  useEffect(() => {
    // Notificación recibida mientras la app está abierta (foreground)
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] recibida:', notification.request.content.title);
    });

    // Usuario tocó una notificación → navegar a la pantalla correspondiente
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data ?? {};
      if (data.type === 'panic')    router.push('/(app)/panico');
      else if (data.type === 'reserva') router.push('/(app)/mis-reservas');
      else if (data.type === 'anuncio') router.push('/(app)/anuncios');
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
