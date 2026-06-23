/**
 * Demande les permissions natives au démarrage (Android 6+ / iOS).
 * Les WebViews ne déclenchent pas toujours les dialogues sans pré-autorisation.
 */
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

export async function requestNativePermissions(): Promise<void> {
  try {
    await Geolocation.requestPermissions();
  } catch {
    /* utilisateur peut refuser — fonctionnalités carte limitées */
  }
  try {
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  } catch {
    /* lives / profil photo limités */
  }
}
