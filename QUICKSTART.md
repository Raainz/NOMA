npm start -- --offline# NOMA GPS Tracker - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
- Node.js 16+ installed (`node --version`)
- npm or yarn (`npm --version`)
- Expo CLI: `npm install -g expo-cli`

### 2. Installation

```bash
# Navigate to project
cd noma_tesst

# Install dependencies
npm install

# Verify installation
npm start
```

You should see:
```
Expo server started at http://localhost:19000
Scan QR code with Expo app or press 'i' (iOS) / 'a' (Android)
```

### 3. Run on Device

**Option A: Expo App (Easiest)**
1. Install "Expo" app on your phone (App Store / Play Store)
2. Scan QR code in terminal
3. App loads on your phone

**Option B: iOS Simulator (Mac)**
```bash
npm start
# Press 'i' in terminal
# Simulator opens automatically
```

**Option C: Android Emulator**
```bash
npm start
# Press 'a' in terminal
# Emulator opens automatically (if running)
```

### 4. Test the App

1. **Allow GPS permissions** when prompted
2. Tap "Live Track" tab
3. Enter activity name (e.g., "Test Run")
4. Tap "Start Activity"
5. Walk or run for 1-2 minutes
6. Tap "Pause" → "Resume" → "Finish"
7. See activity summary

---

## 📱 Testing GPS (Important!)

⚠️ **GPS doesn't work well in emulator!** Test on real device for accurate tracking.

### Real Device Testing
```bash
npm start
# Scan QR code with Expo app on your phone
# Grant location permissions
# Run outdoors for best GPS signal
```

### Expected Performance
- **GPS Acquisition**: 30-60 seconds to lock signal
- **Distance Accuracy**: Within ±5% of actual route
- **Pace Calculation**: Within ±10 seconds per km
- **Battery Usage**: ~12-15% per hour of tracking

---

## 📂 Project Structure

```
noma_tesst/
├── app/
│   ├── services/            ← GPS, Statistics, Storage
│   ├── screens/             ← UI Screens
│   ├── components/          ← Reusable UI Components
│   ├── context/             ← State Management
│   └── App.tsx              ← Main App
├── package.json             ← Dependencies
├── app.json                 ← Expo Config
├── tsconfig.json            ← TypeScript Config
└── README.md                ← Full Documentation
```

---

## 🎮 Control Commands

While running `npm start`:

| Key | Action |
|-----|--------|
| `i` | Open iOS Simulator |
| `a` | Open Android Emulator |
| `w` | Open web version |
| `c` | Clear Expo cache |
| `r` | Reload app |
| `q` | Quit server |

---

## ⚙️ Configuration

### Change GPS Update Frequency
Edit `app/services/GPSTrackingService.ts`, line ~20:

```typescript
updateInterval: 1000,   // Change to 500 for faster updates
```

### Change UI Theme Color
Edit `app/components/UIComponents.tsx`, line ~20:

```typescript
primary: '#00FF00',     // Lime green (change to any hex color)
```

### Change Elevation Noise Filter
Edit `app/services/StatisticsService.ts`, line ~50:

```typescript
minAltitudeChange: 2,   // Change to 1 for more sensitivity
```

---

## 🐛 Common Issues

### "GPS permission denied"
**Solution:**
- iOS: Settings → NOMA → Location → Always
- Android: Settings → Apps → NOMA → Permissions → Location

### "GPS signal not acquired"
**Solution:**
- Move to open area (away from buildings)
- Enable Location Services on device
- Try different location
- Run outside for best results

### "App crashes on start"
**Solution:**
```bash
npm start -- --clear
```

### "Activities not saving"
**Solution:**
- Check device storage isn't full
- Try reinstalling: `expo install`
- Check AsyncStorage permissions

### "Emulator GPS is fake"
**Solution:**
- This is normal! Emulator simulates GPS
- Test on real phone for accurate GPS
- Use Emulator's "Extended controls" to set fake location

---

## 📊 Real Activity Example

**30-minute run:**
- Distance: ~3 km
- Duration: 30 minutes
- Pace: 10 min/km
- Speed: 6 km/h
- GPS Points: ~60-100 (depending on accuracy)
- Storage: ~15-30 KB

---

## 🔄 Development Workflow

### Add a New Feature
```bash
# 1. Edit the service (e.g., StatisticsService)
# 2. Update the context (TrackingContext)
# 3. Update the UI (LiveTrackingScreen)
# 4. Test in app

# Restart app for changes
npm start
# Press 'r' to reload
```

### Debug GPS Data
Add to `app/context/TrackingContext.tsx`:
```typescript
console.log('[GPS Update]', point);
```

Watch terminal output for GPS points.

### Check What's Stored
Add to `app/screens/ActivityHistoryScreen.tsx`:
```typescript
console.log('All activities:', activities);
```

---

## 📖 Documentation Files

Full documentation available in:
- `README.md` - Overview & setup
- `ARCHITECTURE.md` - System design
- `TESTING.md` - Testing guide
- `IMPLEMENTATION_NOTES.md` - Technical details

---

## 🎯 Next Steps

1. **Test on Real Device**
   - Run actual running session
   - Compare distance to known route
   - Check if stats seem reasonable

2. **Explore Code**
   - Open `app/services/GPSTrackingService.ts`
   - Review filtering logic
   - Understand GPS point selection

3. **Customize**
   - Change colors in `app/components/UIComponents.tsx`
   - Adjust thresholds in services
   - Add new stats/screens

4. **Deploy**
   - Build for iOS: `expo build:ios`
   - Build for Android: `expo build:android`
   - Test on TestFlight / Google Play

---

## ✅ Checklist: First Run

- [ ] Installed Node.js 16+
- [ ] Installed Expo CLI
- [ ] Ran `npm install`
- [ ] Ran `npm start`
- [ ] Opened app on device/emulator
- [ ] Allowed GPS permissions
- [ ] Tested "Start Activity"
- [ ] Walked/ran for 1+ minute
- [ ] Finished activity
- [ ] Saw summary with stats
- [ ] Checked history tab

**All checked? Great! You're ready to develop.** 🎉

---

## 💡 Pro Tips

- **Battery**: Use 5-second GPS intervals for long runs
- **Accuracy**: Run outdoors, away from buildings
- **Storage**: Each activity ~30-50 KB per 30 minutes
- **Testing**: Use real device, not emulator, for GPS
- **Debugging**: Check console output with `npm start`

---

## 🆘 Need Help?

1. **Check TESTING.md** for comprehensive troubleshooting
2. **Read ARCHITECTURE.md** for system design
3. **Review IMPLEMENTATION_NOTES.md** for technical details
4. **Check console output** for error messages

---

**Ready to build?** Start with `npm start` and scan the QR code! 🏃‍♂️

---

**Version**: 1.0  
**Last Updated**: November 2024
