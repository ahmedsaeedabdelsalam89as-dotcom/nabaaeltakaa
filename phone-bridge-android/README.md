# Naba Phone Bridge 1.4.0

Android companion app for hands-free calls from Naba Fleet.

- Local network only. Desktop Rust bridge rejects public/non-IP hosts.
- AES-256-GCM payload encryption with a 32-byte pairing secret.
- Foreground service keeps the bridge available while the phone is locked.
- CALL_PHONE is requested once by the user.
- Bluetooth remains the hands-free audio path; command transport uses the local LAN for reliability.

Build with Android Studio / Gradle, install APK, grant Call Phone, start bridge, then copy endpoint + pairing key into Naba Fleet > AI Assistant > Naba Phone Bridge.
