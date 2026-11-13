#!/bin/bash
# NOMA GPS Tracker - Development & Deployment Commands

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  NOMA GPS Activity Tracker - Command Reference             ║"
echo "║  Premium Lifestyle Running App                             ║"
echo "╚════════════════════════════════════════════════════════════╝"

# ============================================================================
# DEVELOPMENT COMMANDS
# ============================================================================

echo ""
echo "📦 SETUP & INSTALLATION"
echo "─────────────────────────────────────────────────────────────"
echo "npm install          # Install dependencies"
echo "npm install -g expo-cli  # Install Expo CLI globally"
echo ""

echo "🚀 RUNNING THE APP"
echo "─────────────────────────────────────────────────────────────"
echo "npm start            # Start Expo server"
echo "npm run ios          # Run on iOS Simulator (Mac only)"
echo "npm run android      # Run on Android Emulator"
echo "npm run web          # Run web version"
echo ""

echo "🔧 DEVELOPMENT"
echo "─────────────────────────────────────────────────────────────"
echo "npm start -- --clear # Clear cache and restart"
echo "npm run lint         # Run ESLint"
echo "npm test             # Run tests (when available)"
echo ""

echo "🎮 KEYBOARD SHORTCUTS (while npm start running)"
echo "─────────────────────────────────────────────────────────────"
echo "i                    # Open iOS Simulator"
echo "a                    # Open Android Emulator"
echo "w                    # Open web version"
echo "r                    # Reload app"
echo "c                    # Clear cache"
echo "q                    # Quit server"
echo ""

# ============================================================================
# BUILD & DEPLOYMENT
# ============================================================================

echo "🏗️  BUILD FOR DISTRIBUTION"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "iOS (requires Mac and Apple developer account):"
echo "  expo build:ios"
echo "  # Follow prompts, wait for build to complete"
echo "  # Download .ipa file"
echo "  # Upload to TestFlight via App Store Connect"
echo ""

echo "Android:"
echo "  expo build:android"
echo "  # Follow prompts, wait for build to complete"
echo "  # Download .apk or .aab file"
echo "  # Upload to Google Play Console"
echo ""

echo "APK (for direct installation on Android):"
echo "  expo build:android --type apk"
echo "  # Download .apk and transfer to device"
echo "  adb install app.apk"
echo ""

# ============================================================================
# TESTING COMMANDS
# ============================================================================

echo "✅ TESTING"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Simulate GPS on iOS Simulator:"
echo "  Debug → Location → City Bicycle Ride (or others)"
echo ""
echo "Simulate GPS on Android Emulator:"
echo "  Extended controls → Location → Custom location"
echo ""
echo "Run a test activity (step-by-step):"
echo "  1. npm start"
echo "  2. Press 'i' (iOS) or 'a' (Android)"
echo "  3. Wait for app to load"
echo "  4. Tap 'Live Track'"
echo "  5. Enter activity name"
echo "  6. Tap 'Start Activity'"
echo "  7. Allow location permissions"
echo "  8. Walk/run for 2-5 minutes"
echo "  9. Tap 'Pause' then 'Resume'"
echo "  10. Tap 'Finish' to see summary"
echo ""

# ============================================================================
# DEBUGGING
# ============================================================================

echo "🐛 DEBUGGING"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "View console logs:"
echo "  npm start  # Check terminal output"
echo ""
echo "iOS Simulator logs:"
echo "  xcrun simctl spawn booted log stream --predicate 'process == \"noma\"'"
echo ""
echo "Android Emulator logs:"
echo "  adb logcat | grep noma"
echo ""
echo "React Native debugger:"
echo "  In Expo app: shake device → Debug remote JS"
echo ""

# ============================================================================
# CONFIGURATION
# ============================================================================

echo "⚙️  CONFIGURATION"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Edit GPS tracking settings:"
echo "  vim app/services/GPSTrackingService.ts  # Line ~20"
echo "  updateInterval: 1000    # 1 second (decrease for faster)"
echo "  minAccuracy: 20         # 20 meters (decrease for stricter)"
echo "  distanceFilter: 5       # 5 meters (decrease for more points)"
echo ""
echo "Change UI colors:"
echo "  vim app/components/UIComponents.tsx  # Line ~20-50"
echo "  primary: '#00FF00'  # Lime green (change hex code)"
echo ""
echo "Adjust elevation filtering:"
echo "  vim app/services/StatisticsService.ts  # Line ~50"
echo "  minAltitudeChange: 2  # 2 meters threshold"
echo ""

# ============================================================================
# DOCUMENTATION
# ============================================================================

echo "📚 DOCUMENTATION"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Quick Start:"
echo "  cat QUICKSTART.md"
echo ""
echo "Full Documentation:"
echo "  cat README.md"
echo ""
echo "Architecture Details:"
echo "  cat ARCHITECTURE.md"
echo ""
echo "Testing Guide:"
echo "  cat TESTING.md"
echo ""
echo "Implementation Notes:"
echo "  cat IMPLEMENTATION_NOTES.md"
echo ""
echo "Project Summary:"
echo "  cat PROJECT_SUMMARY.md"
echo ""

# ============================================================================
# USEFUL EXPO COMMANDS
# ============================================================================

echo "🎯 EXPO COMMANDS"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Check Expo version:"
echo "  expo --version"
echo ""
echo "Update Expo:"
echo "  npm install expo@latest"
echo ""
echo "Eject from Expo (not recommended for MVP):"
echo "  expo eject"
echo ""
echo "Check app status:"
echo "  expo status"
echo ""
echo "Publish to Expo (share link):"
echo "  expo publish  # (optional for sharing during dev)"
echo ""

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

echo "🚨 TROUBLESHOOTING"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "App won't start:"
echo "  npm start -- --clear && npm install"
echo ""
echo "Port already in use:"
echo "  npm start -- --port 19001"
echo ""
echo "GPS not acquiring signal:"
echo "  - Move to open area (away from buildings)"
echo "  - Enable Location Services on device"
echo "  - On emulator: use Extended controls to set location"
echo ""
echo "Permission denied errors:"
echo "  - iOS: Settings → NOMA → Location → Always"
echo "  - Android: Settings → Apps → NOMA → Permissions → Allow all"
echo ""
echo "Storage/persistence issues:"
echo "  - Clear app cache"
echo "  - Check device storage isn't full"
echo "  - Reinstall app: npm start && clear cache"
echo ""
echo "Memory/performance issues:"
echo "  - Close other apps"
echo "  - Run on device with more RAM"
echo "  - Reduce GPS update frequency"
echo ""

# ============================================================================
# PERFORMANCE TUNING
# ============================================================================

echo "⚡ PERFORMANCE TUNING"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Reduce battery drain:"
echo "  • Increase updateInterval to 2000-5000 ms"
echo "  • Decrease logging in console"
echo "  • Disable location during pauses"
echo ""
echo "Improve GPS accuracy:"
echo "  • Decrease minAccuracy to 5-10 meters"
echo "  • Decrease distanceFilter to 2-3 meters"
echo "  • Run in open area away from buildings"
echo ""
echo "Speed up app:"
echo "  • Clear app cache: npm start -- --clear"
echo "  • Reduce number of activities in history"
echo "  • Use faster device with more RAM"
echo ""

# ============================================================================
# RELEASE CHECKLIST
# ============================================================================

echo "📋 RELEASE CHECKLIST"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Before releasing to beta:"
echo "  [ ] npm start -- --clear (verify no errors)"
echo "  [ ] npm run lint (check for linting issues)"
echo "  [ ] Test on iOS device (10+ min run)"
echo "  [ ] Test on Android device (10+ min run)"
echo "  [ ] Test GPS accuracy vs Strava"
echo "  [ ] Test crash recovery (force kill app)"
echo "  [ ] Test history persistence (multiple runs)"
echo "  [ ] Verify permissions are clearly requested"
echo "  [ ] Check battery usage during 1-hour run"
echo "  [ ] Draft privacy policy"
echo "  [ ] Write app description and keywords"
echo ""
echo "Build for beta:"
echo "  expo build:ios       # Create iOS TestFlight build"
echo "  expo build:android   # Create Android Play Store build"
echo ""
echo "Submit to testers:"
echo "  TestFlight → iOS (Apple)"
echo "  Google Play → Internal Testing (Android)"
echo ""

# ============================================================================
# USEFUL LINKS
# ============================================================================

echo "🔗 USEFUL LINKS"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Expo Documentation:"
echo "  https://docs.expo.dev/"
echo ""
echo "React Native Documentation:"
echo "  https://reactnative.dev/docs/getting-started"
echo ""
echo "React Navigation:"
echo "  https://reactnavigation.org/docs/getting-started"
echo ""
echo "expo-location API:"
echo "  https://docs.expo.dev/versions/latest/sdk/location/"
echo ""
echo "GPS Haversine Formula:"
echo "  https://en.wikipedia.org/wiki/Haversine_formula"
echo ""

# ============================================================================
# QUICK REFERENCE
# ============================================================================

echo "💡 QUICK REFERENCE"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Start development:"
echo "  cd noma_tesst && npm install && npm start"
echo ""
echo "Test on iOS Simulator (Mac):"
echo "  npm start  →  press 'i'"
echo ""
echo "Test on Android Emulator:"
echo "  npm start  →  press 'a'"
echo ""
echo "Build for iOS:"
echo "  expo build:ios"
echo ""
echo "Build for Android:"
echo "  expo build:android"
echo ""
echo "Clear everything and restart:"
echo "  npm start -- --clear"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Ready to develop? Start with: npm start                   ║"
echo "║  Questions? Check: QUICKSTART.md, README.md, TESTING.md    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
