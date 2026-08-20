import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as api from './api';

// Cómo mostrar la notificación cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // En Android hace falta crear el canal de notificaciones
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 'cec9edb6-bcf2-43d4-ad01-6fd0ae26e66f';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await api.registerPushToken(token);
    return token;
  } catch (e) {
    console.warn('[Push] No se pudo registrar el token:', e.message);
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.unregisterPushToken(tokenData.data);
  } catch (_) {}
}
