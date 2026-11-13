# NOMA GPS Activity Tracker MVP

Premium Lifestyle running app with real-time GPS tracking, similar to Strava.

## Features

### Core Functionality
- **Activity Control**: Start, Pause, Resume, Finish running sessions
- **GPS Tracking**: Real-time latitude, longitude, altitude, accuracy, and speed recording
- **Real-time Calculations**:
  - Distance (km)
  - Duration (total and moving time)
  - Current & average pace (min/km)
  - Speed (km/h)
  - Elevation gain (m)
  - Max speed
- **Live Map**: Display current position and trace route progressively
- **Activity Summary**: Post-session statistics with GPS visualization
- **Activity History**: Local storage of all sessions with filtering and sorting

### Design
- Premium Lifestyle aesthetic with signature lime green (#00FF00)
- Mobile-first responsive design
- Subtle animations and transitions
- Dark mode interface (navy #0A0E27)
- Large, visible stats display
- Intuitive control buttons

## Project Structure

```
noma_tesst/
├── app/
│   ├── services/              # Core business logic
│   │   ├── GPSTrackingService.ts      # GPS tracking & filtering
│   │   ├── StatisticsService.ts       # Calculations & formatting
│   │   └── ActivityStorageService.ts  # Local persistence
│   ├── context/               # Global state management
│   │   └── TrackingContext.tsx        # Activity tracking context
│   ├── screens/               # Screen components
│   │   ├── LiveTrackingScreen.tsx     # Active tracking UI
│   │   ├── ActivitySummaryScreen.tsx  # Post-activity summary
│   │   └── ActivityHistoryScreen.tsx  # Activity list & history
│   ├── components/            # Reusable UI components
│   │   └── UIComponents.tsx          # NOMA design system
│   ├── types/                 # TypeScript definitions
│   │   └── index.ts           # Core types
│   ├── utils/                 # Utility functions
│   ├── data/                  # Data models & constants
│   └── App.tsx                # Main app with navigation
├── package.json
├── app.json                   # Expo configuration
├── tsconfig.json              # TypeScript config
└── index.ts                   # Entry point
```

## Technical Architecture

### Tracking Engine (GPSTrackingService)
- Handles location permissions (foreground + background)
- Filters GPS points by accuracy and distance threshold
- High-accuracy location updates (1-second intervals)
- Automatic GPS restoration on app resume
- Error handling and permission management

### Statistics Service (StatisticsService)
- Calculates distance using Haversine formula
- Computes pace and speed from GPS data
- Elevation gain tracking with noise filtering
- Real-time and average metrics
- Human-readable formatting

### Storage Service (ActivityStorageService)
- AsyncStorage-based persistence
- Crash recovery mechanism
- Activity indexing for fast retrieval
- Batch operations for performance
- Storage statistics

### State Management (TrackingContext)
- React Context API for global state
- Automatic activity recovery
- Periodic auto-save during tracking
- Integrated statistics updates
- Error handling and notifications

## Setup & Installation

### Prerequisites
- Node.js 16+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Xcode) or Android Emulator
- A real smartphone for testing (recommended for GPS)

### Installation

1. **Clone or navigate to project**
```bash
cd noma_tesst
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Google Maps (optional)**
Edit `app.json` and add your Google Maps API key:
```json
"plugins": [
  ["expo-maps", { "mapsApiKey": "YOUR_KEY" }]
]
```

4. **Start Expo server**
```bash
npm start
```

5. **Run on device/emulator**
- **iOS Simulator**: Press `i`
- **Android Emulator**: Press `a`
- **Physical Device**: Scan QR code with Expo app

## GPS Permissions

### iOS
The app requires these location permissions (configured in `app.json`):
- `NSLocationWhenInUseUsageDescription` - Active tracking
- `NSLocationAlwaysAndWhenInUseUsageDescription` - Background tracking
- GPS capability required

### Android
Permissions declared in `app.json`:
- `ACCESS_FINE_LOCATION` - High-accuracy GPS
- `ACCESS_COARSE_LOCATION` - Fallback location
- `ACCESS_BACKGROUND_LOCATION` - Background tracking

**Note**: Users must grant permissions at runtime.

## Usage

### Starting an Activity
1. Navigate to **Live Track** tab
2. Enter activity name (e.g., "Morning Run")
3. Tap **Start Activity**
4. Allow location permissions when prompted
5. GPS tracking begins

### During Activity
- Real-time stats update every second
- Distance, pace, speed, and elevation displayed
- **Pause**: Temporarily stop tracking (keeps session open)
- **Resume**: Continue tracking after pause
- **Finish**: End session and view summary

### After Activity
- Summary screen shows:
  - Total distance, duration, pace, speed
  - Elevation gain and max speed
  - Number of GPS points recorded
  - Session date/time
- **Share**: Export activity details
- **Delete**: Remove activity from history

### Viewing History
- Navigate to **Activities** tab
- View all past sessions
- **Sort by**: Recent, Distance, or Duration
- **Tap activity**: View detailed summary
- **Summary statistics**: Total runs, distance, and time

## Calibration & Accuracy

### GPS Accuracy Filtering
- **Minimum accuracy threshold**: 20 meters (configurable)
- **Distance filter**: 5 meters between consecutive points
- Removes inaccurate readings and redundant data
- Prevents artificial distance inflation

### Elevation Calculations
- **Altitude threshold**: 2 meters (filters GPS noise)
- Only positive elevation changes counted
- Handles missing altitude data gracefully

### Performance Considerations
- Updates every 1 second (configurable)
- Foreground service running during tracking
- Background location updates when screen locked
- Efficient GPS point filtering to minimize storage

## Data Persistence

### Local Storage
- Activities stored in AsyncStorage (device-local)
- Automatic recovery from crashes
- Current activity saved every 5 seconds
- No data synced to cloud (design decision for MVP)

### Storage Management
```typescript
// Get storage stats
const stats = await activityStorageService.getStorageStats();
console.log(`Total activities: ${stats.totalActivities}`);
console.log(`Storage used: ${(stats.totalSize / 1024).toFixed(1)} KB`);
```

## Limitations & Known Issues

### GPS Tracking
1. **Cold start**: First GPS fix may take 30-60 seconds
2. **Urban canyons**: GPS signal loss in dense urban areas
3. **Accuracy**: Best accuracy is 5-15m under ideal conditions
4. **Background limitation**: iOS has stricter background location limits

### Features Not in MVP
- **Social features**: No sharing, segments, or leaderboards
- **Map visualization**: Live map component requires implementation
- **Cloud sync**: Backend integration planned for future
- **Wearable integration**: Smartwatch support planned
- **Advanced analytics**: Detailed metrics/trends coming soon
- **Voice guidance**: Turn-by-turn directions not included

### Testing Limitations
- Simulator GPS is simulated; test on real device for accuracy
- Background tracking limited in emulator
- Permissions testing requires physical device

## Testing on Real Device

### iOS Device
1. Build with Expo: `expo build:ios`
2. Download .ipa file
3. Install via TestFlight (Apple)
4. Grant location permissions
5. Test GPS tracking outdoors

### Android Device
1. Connect device with USB debugging
2. Run: `npm start`
3. Press `a` for Android
4. Grant location permissions
5. Test GPS tracking outdoors

### Testing Checklist
- [ ] GPS tracking starts correctly
- [ ] Distance calculations are accurate
- [ ] Pace/speed calculations correct
- [ ] Pause/resume maintains data
- [ ] Activity summary displays correctly
- [ ] History persists after app close
- [ ] Recovery works after crash
- [ ] Elevation gain calculated (if GPS has altitude)
- [ ] Background tracking works when screen locked
- [ ] Permissions requested at runtime

## Performance Optimization

### Current Optimizations
- Efficient GPS point filtering
- Periodic auto-save (5 seconds)
- Lazy loading activity history
- Memoized stat calculations
- Minimal re-renders with React.memo

### Future Optimizations
- Implement MapBox for live map rendering
- Add database layer (SQLite) for large activity sets
- Implement worker threads for calculations
- Add caching for frequently accessed activities

## Architecture Decisions

### Why React Native/Expo?
- **Cross-platform**: Single codebase for iOS and Android
- **Fast development**: Rapid prototyping and testing
- **Built-in tools**: Expo handles permissions, location, storage
- **Over-the-air updates**: Deploy without app store submission
- **Community**: Large ecosystem and libraries

### Why AsyncStorage (not SQLite)?
- **MVP scope**: AsyncStorage sufficient for single user
- **Simplicity**: No schema management required
- **Learning curve**: Lower barrier to entry
- **Future migration**: Can upgrade to SQLite if needed

### Why Context API (not Redux)?
- **Simplicity**: Sufficient for MVP scope
- **Performance**: No unnecessary re-renders
- **Bundle size**: Smaller app size
- **Future-proof**: Can migrate to Redux if complexity grows

## Future Enhancements

### Phase 2 (v0.2)
- [ ] Live map with route visualization
- [ ] Voice notifications (pace alerts, distance announcements)
- [ ] Workout templates (intervals, distances)
- [ ] Social sharing (Instagram, Facebook, etc.)
- [ ] Weather integration
- [ ] Heart rate integration (if device has capability)

### Phase 3 (v0.3)
- [ ] Backend API integration
- [ ] Cloud synchronization
- [ ] Wearable support (Apple Watch, Wear OS)
- [ ] Advanced analytics dashboard
- [ ] Segment tracking (Strava-like)
- [ ] Social feed and leaderboards

### Phase 4 (v0.4+)
- [ ] Machine learning predictions (effort levels, recovery)
- [ ] Training plans and coaching
- [ ] Nutrition tracking integration
- [ ] Body metrics (weight, HR, sleep)
- [ ] Community challenges
- [ ] Monetization (premium features)

## Troubleshooting

### GPS Not Starting
1. Check permission grants: Settings → Location
2. Ensure Location Services enabled on device
3. Try different location (more open area)
4. Restart app and device

### Distance Appears Incorrect
1. Ensure high GPS accuracy (check "Accuracy" stat)
2. Run in open area (outdoors, away from buildings)
3. Verify minimum accuracy filter (20m default)
4. Check elevation data if available

### App Crashes During Tracking
1. Check console: `npm start` shows errors
2. Verify permissions are granted
3. Ensure sufficient storage on device
4. Try closing other location-heavy apps

### Activities Not Persisting
1. Check AsyncStorage permissions
2. Verify device storage is not full
3. Look for error messages in console
4. Try clearing app cache and data

## Contributing

Guidelines for contributors:
1. Follow TypeScript strict mode
2. Use existing UI components from `UIComponents.tsx`
3. Add tests for new services
4. Document edge cases and limitations
5. Follow NOMA design system (lime green primary color)

## License

Copyright © 2024 NOMA. All rights reserved.

## Support

For issues or questions:
- Check this README first
- Review code comments in service files
- Test on real device (not emulator only)
- Enable debugging: Add `console.log` statements

---

**Version**: 0.1.0  
**Last Updated**: November 2024  
**Status**: MVP - Ready for beta testing on real devices
