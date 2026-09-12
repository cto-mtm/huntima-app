import { useTenantStore } from '../stores/tenant'
import { distanceMeters } from '../lib/geo'

/**
 * The stadium geofence check, used by the capture flow.
 *
 * A SOFT gate on purpose. A concourse is one of the worst places a phone will
 * ever try to get a GPS fix — concrete bowl, thousands of radios — so this only
 * ever returns 'out-of-range' when it has a CONFIDENT fix that is CLEARLY
 * outside. No venue configured, geolocation unsupported, permission denied, a
 * timeout, or a low-accuracy fix all resolve to 'ok': we never strand a real fan
 * over our uncertainty. The photo match is the real gate; this is a courtesy
 * "you have to be here" nudge.
 *
 * The location is read, compared to the venue, and discarded — never stored,
 * never sent anywhere. See the note on `venueSchema`.
 */
export type GeofenceVerdict = 'ok' | 'out-of-range'

export function useGeofence() {
  const tenant = useTenantStore()

  function check(): Promise<GeofenceVerdict> {
    const venue = tenant.settings.venue
    if (!venue) return Promise.resolve('ok') // no restriction configured
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return Promise.resolve('ok')
    }

    return new Promise<GeofenceVerdict>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords
          // Too fuzzy to trust for a block. `accuracy` is the fix's own error
          // radius; if it rivals the geofence, we can't be confident either way.
          if (accuracy > Math.max(venue.radiusMeters, 500)) return resolve('ok')

          const distance = distanceMeters({ lat: latitude, lng: longitude }, venue)
          // Give the fan the fix's error radius as slack, so a fuzzy-but-close
          // reading isn't punished.
          resolve(distance - accuracy <= venue.radiusMeters ? 'ok' : 'out-of-range')
        },
        // Denied, unavailable, or timed out → allow. Never our failure's cost.
        () => resolve('ok'),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      )
    })
  }

  return { check }
}
