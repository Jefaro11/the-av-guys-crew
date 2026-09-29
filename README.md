# The AV Guys Crew

The AV Guys Crew is the iPhone Home Screen web app for crew schedules and notifications.

The web client uses the Supabase public browser key for Auth/database access and obtains the separate Web Push VAPID public key from the `crew-web-config` Edge Function.

To use on iPhone: open the deployed HTTPS site in Safari, choose Share → Add to Home Screen, open the new Home Screen app, sign in, then enable notifications.

The Mac desktop app v1.3.6 sends crew event payloads to the Supabase notification backend, which can deliver Web Push to registered crew devices.

