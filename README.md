# 🎤 VoiceTel Phone

A mobile WebRTC SIP phone built with Capacitor for VoiceTel communications (Android and iOS). Make and receive calls directly on your device with a modern, touch‑first interface.

![Version](https://img.shields.io/badge/version-3.5.6.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey)

## 📚 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Screenshots](#-screenshots)
- [API Documentation](#-api-documentation)
- [Privacy](#-privacy)
- [Contributors](#-contributors)
- [Sponsors](#-sponsors)
- [License](#-license)

## ✨ Features

### 📞 Core Telephony
- **WebRTC/SIP Integration** - Full SIP over WebSocket support using SIP.js 0.15.11
- **Outgoing Calls** - Dial any number with automatic number sanitization
- **Incoming Calls** - Native call notifications with caller ID display
- **Call Controls** - Mute, hold/resume, hang up, call duration timer
- **DTMF Support** - Send touch-tone digits during calls via dialpad or keyboard (RFC 2833 with SIP INFO fallback)
- **Ringing Handling** - Local ringback on 180/183; early media muted until answer
- **Hold Functionality** - Proper SIP hold/unhold with re-INVITE and modified SDP (a=sendonly/inactive)

### 📱 Native Platform Integration
- **iOS CallKit Support** - Native iOS call interface with system call screen
  - Incoming calls appear on lock screen and as system notifications
  - Outgoing calls integrate with native dialer interface
  - Proper call state reporting (ringing, connecting, connected)
  - Automatic audio routing and Bluetooth support
  - Native hold/resume integration
- **Android Foreground Service** - Background call continuity with persistent notification
  - Real-time call state display (dialing, ringing, connecting, connected, on hold)
  - Interactive notification with Mute/Unmute and Hold/Resume buttons
  - Live call duration display (MM:SS format)
  - Bidirectional sync between app UI and notification actions
  - Prevents system from killing app during active calls

### 🔐 Security & Privacy
- **Local Storage** - Credentials stored locally using LocalForage
- **Hide Caller ID** - Optional privacy mode for outgoing calls (*67 prefix)
- **No External Dependencies** - All data processing happens locally
- **No Analytics or Tracking** - Zero third-party data collection

### 🎨 User Interface
- **Tabbed Mobile UI**
  - 📞 Phone - Touch-optimized dialpad and active call screen
  - 👥 Contacts - Device contacts integration with search (permission required)
  - 🕘 History - Recent calls list with integrated recording playback
  - 📋 Log - Real-time SIP event log with troubleshooting tips
  - ⚙️ Settings - SIP configuration, credentials, and preferences
- **Visual Call Indicators** - Real-time ringing status, call duration, and state display
- **Responsive Design** - Optimized for mobile screens with touch-first controls

### 🔧 Advanced Features
- **Call Recording** - Automatic recording when enabled (starts on answer, not during ringing)
- **Recording Playback** - Native audio player with platform-specific implementations
  - iOS: Uses cordova-plugin-iosrtc for WebM playback
  - Android: Native MediaPlayer via CallService plugin
  - Proper MIME type detection (WebM, OGG, WAV)
- **Caller ID Customization** - Set custom display name and 10-digit North American caller ID
- **Smart Number Handling** - Accepts any format, automatically sanitizes to digits
- **Auto-Rejection** - Busy signal for incoming calls when already on a call
- **30-Second Timeout** - Auto-decline unanswered incoming calls
- **WebRTC Diagnostics** - Built-in troubleshooting tips and connection monitoring
- **Automatic Re-Registration** - Intelligent SIP registration management
  - Queue-based system prevents concurrent registration attempts
  - Skips re-registration during active calls
  - Automatic recovery from connection failures
  - 180-second registration expiry for faster failure detection

### 🏗️ Architecture
- **Modular JavaScript Design** - 16 separate modules for maintainability
  - `loader.js` - Dynamic module loading with dependency management
  - `config.js` - Centralized configuration and constants
  - `globals.js` - Shared state management
  - `sip-manager.js` - SIP registration and connection handling
  - `call-handler.js` - Call session management
  - `call-controls.js` - Mute, hold, hangup functionality
  - `audio.js` - Audio device and stream management
  - `native-integration.js` - Platform-specific native bridge
  - `contacts.js` - Device contacts integration
  - `history.js` - Call history persistence
  - `recording.js` - Call recording functionality
  - `ui-manager.js` - UI state and transitions
  - `event-handlers.js` - DOM event bindings
  - `storage.js` - LocalForage wrapper for persistence
  - `helpers.js` - Utility functions
  - `app.js` - Application initialization
  - `iosrtc-init.js` - iOS WebRTC initialization
- **Native Plugins** - Unified CallService plugin for iOS and Android
  - iOS: Swift implementation with CallKit integration
  - Android: Java implementation with foreground service
  - Consistent API across both platforms

## 🚀 Installation

### Download Pre-built Binaries
Download the latest release for your platform from the [Releases](https://github.com/voicetel/voicetel-phone-mobile/releases).

### Build from Source

#### Prerequisites
- Common
  - Node.js 16+ and npm
  - Git
- Android
  - Java JDK 17 (compatible with current Android Gradle Plugin)
  - Android Studio (or Android SDK + commandline tools)
  - Android SDK Platform 34 and Build-Tools 34.x
  - adb (Android Debug Bridge)
  - A device with USB debugging enabled or an Android emulator
  - Release keystore and passwords for Play Store AAB signing
- iOS
  - macOS with Xcode 15+
  - CocoaPods installed (`sudo gem install cocoapods`)
  - Apple Developer account (Team access)
  - Provisioning profiles and signing certificates
  - An iOS device or Simulator

#### Steps
```bash
# Clone the repository
git clone https://github.com/voicetel/voicetel-phone-mobile.git
cd voicetel-phone-mobile

# Install dependencies
npm install

# Android: prepare Capacitor project
npx cap sync android

# Build a debug APK
(cd android && ./gradlew assembleDebug)

# Install debug APK to a device/emulator
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Build a release AAB for Play Store
(cd android && ./gradlew bundleRelease)
# Output: android/app/build/outputs/bundle/release/app-release.aab

# Optional: iOS (on macOS)
npx cap sync ios
open ios/App/App.xcworkspace
# Build/run from Xcode
```

## 📱 Screenshots

<p align="center">
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/iPhone_dialpad.png" alt="iPhone — Dialer" width="240" />
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/iPhone_contacts.png" alt="iPhone — Contacts" width="240" />
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/iPhone_callhistory.png" alt="iPhone — Call History" width="240" />
</p>

<p align="center">
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/android_dialer.png" alt="Android — Dialer" width="240" />
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/android_contacts.png" alt="Android — Contacts" width="240" />
  <img src="https://voicetel-phone.s3.us-east-1.amazonaws.com/images/android_settings.png" alt="Android — Settings" width="240" />
</p>

## 📖 API Documentation

For developers looking to understand or extend the codebase, comprehensive API documentation is available:

**[JavaScript API Documentation](API.md)** - Complete reference for all functions, modules, and architecture

The API documentation includes:
- Architecture overview and module loading system
- Detailed function references for all 16 JavaScript modules
- Parameter descriptions and return types
- Usage examples and best practices
- Platform-specific considerations
- Troubleshooting guide

## 🔒 Privacy

All SIP signaling and media negotiation occur directly between your device and your SIP server. No analytics or third‑party tracking are embedded. Credentials are stored locally on the device.

## 🙌 Contributors

We welcome contributions! Thanks to these awesome people:

- [Michael Mavroudis](https://github.com/mavroudis) - Lead Developer & Architect

## 💖 Sponsors

Proudly supported by:

| Sponsor | Contribution |
|---------|--------------|
| [VoiceTel Communications](https://www.voicetel.com) | Primary development and testing infrastructure |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📋 Version History

### v3.5.6.2 (2024-11-11)
- **Fixed hold functionality** - Now uses proper SIP.js hold/unhold with re-INVITE
- **Enhanced iOS CallKit** - Added proper state reporting for outgoing calls (ringing, connecting, connected)
- **Android notification enhancements** - Added Mute/Unmute and Hold/Resume action buttons with real-time state display
- **Bidirectional sync** - Native notification actions sync with app UI state

### v3.5.6.1 (2024-11-10)
- Fixed iOS compilation warnings in CallServicePlugin
- Removed excessive logging from CallKit integration

### v3.5.6 (2024-11-10)
- **CRITICAL FIX** - Resolved calls dropping during re-registration
- Fixed registration race conditions with promise-based queue system
- Improved re-registration logic to skip during active calls
- Reduced registration expiry to 180 seconds for faster recovery

For complete changelog, see [CHANGELOG.md](CHANGELOG.md) and the [Releases](https://github.com/voicetel/voicetel-phone-mobile/releases) page.
