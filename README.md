# LostLink AI

LostLink AI is a Java Android application for RV University's campus lost-and-found workflow. The interface is built with HTML, CSS, and JavaScript in a constrained Android WebView, while Java provides SQLite persistence, photo selection, directions, and deterministic report matching.

## Current milestone

- RVU-themed responsive dashboard
- Lost and found report forms
- Android photo picker
- Local SQLite report storage
- Searchable campus landmark list using verified coordinates
- RVU Admin Block collection point
- Demonstration matching by category, color, brand, description, and location
- Directions handoff to Google Maps
- RVU-only login screen with profile capture for name, email, mobile, branch, and semester
- Native Google account picker for RVU email selection without Firebase keys
- In-app match notifications that show both reporters' contact details
- Full supplied campus landmark list rendered as searchable locations and map pins

## Open in Android Studio

1. Open this repository as an existing Android Studio project.
2. Allow Gradle sync to complete.
3. Select an Android 8.0 or newer emulator/device.
4. Run the `app` configuration.

The generated debug APK is at `app/build/outputs/apk/debug/app-debug.apk` after running:

```powershell
.\gradlew.bat :app:assembleDebug
```

## Production integrations still required

- Firebase project and `google-services.json`
- Google sign-in restricted to the confirmed RVU email domain
- Google/Firebase OAuth must handle Google passwords. The app must not collect real Google passwords directly.
- The current direct Google picker is suitable for demo and campus prototype validation. For production server-backed authentication, connect Firebase Auth and verify ID tokens.
- Cloud Firestore and Storage security rules
- Firebase Cloud Messaging
- Restricted Google Maps API key and native map screen
- Staff role provisioning and ownership verification policy

Do not commit private API keys or service-account credentials.
