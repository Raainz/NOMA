# NOMA GPS Tracker - Deployment & Testing Guide

## Quick Start

### Development Environment

```bash
# Install Node.js 16+ (check: node --version)
# Install Expo CLI
npm install -g expo-cli

# Clone project
cd noma_tesst

# Install dependencies
npm install

# Start Expo server
npm start
```

### Run on Emulator

**iOS Simulator (Mac only):**
```bash
npm start
# Press 'i' to open iOS Simulator
```

**Android Emulator:**
```bash
# First, ensure Android Studio is installed
npm start
# Press 'a' to open Android Emulator
```

### Run on Real Device

**Option 1: Expo App (Easiest)**
1. Install Expo app from App Store / Play Store
2. Run `npm start` in project directory
3. Scan QR code with Expo app
4. App loads on your device
5. Grant location permissions when prompted

**Option 2: Native Build (Better Performance)**
```bash
# Build for iOS (requires Apple developer account)
expo build:ios

# Build for Android
expo build:android

# Download .ipa (iOS) or .apk (Android)
# Install via TestFlight (iOS) or sideload (Android)
```

---

## Testing Checklist

### Pre-Launch Checklist

- [ ] Dependencies installed: `npm install`
- [ ] No TypeScript errors: Check console
- [ ] Permissions configured in `app.json`
- [ ] Google Maps API key added (if using maps)
- [ ] Tested on real device with GPS

### GPS Functionality

- [ ] **Permission Request**
  - Foreground location requested on app start
  - Background permission requested when needed
  - User can see permission status

- [ ] **Signal Acquisition**
  - GPS signal acquired within 30-60 seconds
  - "Acquiring GPS..." message shown initially
  - Status updates once GPS lock obtained

- [ ] **Tracking Accuracy**
  - Distance matches actual route (±5%)
  - Pace calculation matches distance/time
  - No sudden jumps or spikes
  - Elevation gain shows reasonable values

### Activity Controls

- [ ] **Start Activity**
  - Activity name input works
  - Start button initiates tracking
  - GPS updates begin immediately

- [ ] **Pause Activity**
  - Pause button stops tracking
  - Stats freeze on display
  - Activity state saved to storage

- [ ] **Resume Activity**
  - Resume button restarts GPS tracking
  - Statistics continue from pause point
  - No data loss between pause/resume

- [ ] **Finish Activity**
  - Confirmation dialog appears
  - Activity saved to history
  - Summary screen shows correct stats
  - Can access activity from history tab

### Statistics Accuracy

#### Distance Testing
```
Method: Walk/run known distance, compare app to actual
Expected accuracy: ±5% (GPS limitation)

Test Case 1: 1 km flat route
  - App should show 0.95-1.05 km

Test Case 2: 5 km route with elevation
  - App should show 4.75-5.25 km
  - Elevation gain should be visible
```

#### Pace Testing
```
Formula: Pace = 60 / Speed (km/h)

Test Case: 6 min/km pace
  - Distance: 5 km
  - Time: 30 minutes
  - Expected pace: 6'00"
  - Tolerance: ±10 seconds average
```

#### Moving Time
```
Test Case: 30 min activity with 5 min pause
  - Total duration: 35 minutes
  - Moving time: ~30 minutes
  - Moving time < Total duration (shows pause was tracked)
```

### Data Persistence

- [ ] **Activity Saves**
  - Activities appear in History tab
  - Activity count increases
  - Tapping activity shows correct summary

- [ ] **Recovery from Crash**
  - Close app (kill process) during tracking
  - Reopen app
  - "Resume interrupted activity?" dialog appears
  - Accept resume and verify data intact

- [ ] **History Persistence**
  - Close and reopen app multiple times
  - History still shows all activities
  - No activities lost

### UI/UX Testing

- [ ] **Responsive Design**
  - UI adapts to phone screen size
  - Text is readable
  - Buttons are easily tappable (>44pt)
  - No layout overflow or clipping

- [ ] **Color & Branding**
  - Lime green (#00FF00) is visible on stats
  - Dark background (navy #0A0E27) is evident
  - Contrast is sufficient for legibility

- [ ] **Navigation**
  - Tab bar appears at bottom
  - Switching between tabs is smooth
  - Summary screen accessible from history
  - Back button works correctly

### Performance

- [ ] **Battery Usage**
  - 1-hour run uses ~10-15% battery
  - No excessive draining during pause
  - Background location doesn't drain rapidly

- [ ] **Memory**
  - No memory leaks during long tracking
  - App doesn't crash after several hours
  - Smooth scrolling through activity list

- [ ] **Speed**
  - Stats update within 1 second of GPS update
  - History loads instantly (<2 seconds)
  - No lag when switching tabs

### Error Handling

- [ ] **No GPS Signal**
  - App shows "Acquiring GPS..." message
  - Doesn't crash if signal is slow
  - Continues trying to acquire signal
  - Shows error after reasonable timeout

- [ ] **Denied Permissions**
  - Clear error message displayed
  - Settings link shown (if available)
  - Can retry permission request

- [ ] **Storage Full**
  - App handles gracefully
  - Error message shown to user
  - Suggests deleting old activities

- [ ] **Network Issues** (if sharing)
  - Share fails gracefully
  - Error message displayed
  - Can retry sharing

---

## Testing Scenarios

### Scenario 1: Complete Run Session
**Duration:** 15 minutes  
**Expected:** Distance 1-2 km, 10-12 min/km pace

Steps:
1. [ ] Open app, tap "Live Track"
2. [ ] Enter activity name "Test Run"
3. [ ] Tap "Start Activity"
4. [ ] Wait for GPS lock ("Acquiring..." phase)
5. [ ] Walk/run for 10-15 minutes
6. [ ] Tap "Pause" midway (after 5 min)
7. [ ] Wait 30 seconds (activity paused)
8. [ ] Tap "Resume"
9. [ ] Continue for remaining 5 minutes
10. [ ] Tap "Finish"
11. [ ] Verify summary shows correct stats
12. [ ] Check history - new activity appears

### Scenario 2: Crash Recovery
**Duration:** 5 minutes

Steps:
1. [ ] Start activity as above
2. [ ] Let tracking run for 3 minutes
3. [ ] Force close app (settings → app info → force stop)
4. [ ] Reopen app immediately
5. [ ] Alert should ask to resume
6. [ ] Tap "Resume"
7. [ ] Verify GPS points are intact
8. [ ] Continue tracking for 2 more minutes
9. [ ] Finish normally
10. [ ] Check summary - all points included

### Scenario 3: Background Tracking
**Duration:** 10 minutes

Steps:
1. [ ] Start activity
2. [ ] Let GPS lock for 30 seconds
3. [ ] Press home button (lock screen)
4. [ ] Activity continues in background
5. [ ] Walk/run for ~5 minutes
6. [ ] Unlock phone and open app
7. [ ] Stats should continue updating
8. [ ] Finish activity
9. [ ] Verify all GPS points recorded

### Scenario 4: Elevation Tracking
**Duration:** 20 minutes  
**Environment:** Hill or stairs

Steps:
1. [ ] Start activity on flat ground
2. [ ] Climb stairs or hill for 10 minutes
3. [ ] Return to starting elevation
4. [ ] Finish activity
5. [ ] Summary should show elevation gain > 0
6. [ ] Elevation gain should be reasonable
   - Stairs: ~3-5m per flight
   - Hill: 30-50m per 5-10 min climb

---

## Debugging

### Enable Console Logs
```bash
# Run with debug output
npm start

# Watch for errors in terminal
```

### Check Phone Logs
**iOS (Xcode):**
```bash
xcrun simctl spawn booted log stream --predicate 'process == "noma-gps-tracker"' --level debug
```

**Android (adb):**
```bash
adb logcat
# Filter for app logs
adb logcat | grep noma
```

### Common Issues & Solutions

#### Issue: "GPS permission denied"
**Solution:**
- iOS: Settings → NOMA → Location → Always
- Android: Settings → Apps → NOMA → Permissions → Location → Allow all the time

#### Issue: "GPS signal not acquired"
**Solution:**
- Move to open area (away from buildings)
- Ensure Location Services is on
- Try rebooting phone
- Check if other GPS apps work

#### Issue: "Distance appears wrong"
**Solution:**
- Verify GPS accuracy in stats (should be < 20m)
- Run on clear path (not weaving)
- Try again in different location
- Check if you're actually walking/running

#### Issue: "App crashes on start"
**Solution:**
```bash
# Clear cache and rebuild
npm start -- --clear
# Or reinstall app
expo install
npm start
```

#### Issue: "History not persisting"
**Solution:**
- Check AsyncStorage permissions
- Verify app has storage permission
- Try deleting and reinstalling app
- Check device storage isn't full

---

## Performance Testing

### Stress Test: Long Run
**Duration:** 2+ hours

Steps:
1. [ ] Start activity
2. [ ] Run for 2+ hours continuously
3. [ ] Periodically check stats update
4. [ ] Verify no memory leaks (app doesn't slow down)
5. [ ] Finish and check summary
6. [ ] Should have 7000+ GPS points

Expected results:
- App remains responsive
- Stats calculate correctly
- No crashes or freezes
- Battery drain reasonable (~15-20%)

### Stress Test: Multiple Activities
**Duration:** 1 week

Steps:
1. [ ] Complete 5-10 activities
2. [ ] Each activity 20-60 minutes
3. [ ] Test history viewing
4. [ ] Test filtering/sorting
5. [ ] Check app performance

Expected results:
- History loads quickly
- Sorting works smoothly
- No crashes with multiple activities

---

## Distribution

### TestFlight (iOS)
```bash
# Build for iOS
expo build:ios

# Wait for build to complete
# Download .ipa file

# Upload to TestFlight via App Store Connect
# Invite testers via email
# Testers download via TestFlight app
```

### Google Play Internal Testing (Android)
```bash
# Build for Android
expo build:android

# Wait for build to complete
# Download .aab file

# Upload to Google Play Console
# Create internal test track
# Invite testers via Google accounts
```

### Ad-hoc Distribution
```bash
# For immediate testing without app store

# iOS (requires provisioning profile)
expo build:ios -t archive
# Sideload via Xcode/Instruments

# Android (APK format)
expo build:android --type apk
# Transfer .apk to device and install
adb install app.apk
```

---

## Monitoring & Analytics (Future)

### Metrics to Track
```
Once cloud sync is added:
- Average run duration
- Average run distance
- Most common run times
- Common routes
- User retention
- Crash reports
```

### Error Tracking
```
Setup Sentry or similar for:
- GPS failures
- Storage errors
- Crash stack traces
- Performance metrics
```

---

## Compliance & Permissions

### iOS (app.json)
```json
"NSLocationWhenInUseUsageDescription": "NOMA needs access to your location to track your running activity."
"NSLocationAlwaysAndWhenInUseUsageDescription": "NOMA needs background location access to continue tracking when your screen is locked."
```

### Android (AndroidManifest.xml via app.json)
```json
"permissions": [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION"
]
```

---

## Release Checklist

Before production release:

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Tested on real device (iOS and Android)
- [ ] Battery drain acceptable
- [ ] Permissions clear and necessary
- [ ] Privacy policy drafted
- [ ] Terms of service created
- [ ] Version bumped (0.1.0 → 0.2.0)
- [ ] Release notes written
- [ ] Screenshots taken for app stores
- [ ] App description written
- [ ] Keywords/tags defined

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Status**: Ready for testing
