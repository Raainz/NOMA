# NOMA GPS Tracker - Technical Architecture

## Overview

NOMA GPS Activity Tracker is a cross-platform React Native application built with Expo. It provides real-time GPS tracking, live statistics calculations, and persistent activity storage for running sessions.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface Layer                  │
├─────────────────────────────────────────────────────────┤
│  LiveTrackingScreen │ SummaryScreen │ HistoryScreen     │
└────────────────────────┬────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│               State Management Layer                     │
├─────────────────────────────────────────────────────────┤
│  TrackingContext (React Context)                        │
│  - Maintains current activity state                     │
│  - Orchestrates service calls                          │
│  - Provides actions to UI components                   │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
┌──────────────▼────────┐  ┌──────────────▼──────────────┐
│ Service Layer         │  │ Storage Layer              │
├───────────────────────┤  ├───────────────────────────┤
│GPSTrackingService     │  │ActivityStorageService     │
│- Permissions         │  │- AsyncStorage operations   │
│- Location updates    │  │- Recovery mechanism       │
│- GPS filtering       │  │- Index management         │
│                      │  │                           │
│StatisticsService     │  │                           │
│- Distance calc       │  │                           │
│- Pace/speed calc     │  │                           │
│- Elevation gain      │  │                           │
│- Formatting          │  │                           │
└──────────────────────┘  └───────────────────────────┘
        │                           │
        ▼                           ▼
   ┌─────────────────────────────────────┐
   │    Native APIs                      │
   ├─────────────────────────────────────┤
   │ • expo-location (GPS)               │
   │ • @react-native-async-storage       │
   │ • React Navigation                  │
   │ • React Native Maps (future)        │
   └─────────────────────────────────────┘
        │                           │
        ▼                           ▼
   ┌─────────────────────────────────────┐
   │    iOS/Android Native APIs          │
   ├─────────────────────────────────────┤
   │ • CoreLocation (iOS)                │
   │ • LocationManager (Android)         │
   │ • SharedPreferences (Android)       │
   │ • Keychain (iOS)                    │
   └─────────────────────────────────────┘
```

## Component Hierarchy

```
App (navigation setup)
├── TrackingProvider (context provider)
│   ├── Tab.Navigator
│   │   ├── Live Stack
│   │   │   ├── LiveTrackingScreen
│   │   │   │   ├── StatDisplay (multiple instances)
│   │   │   │   ├── Card (stats container)
│   │   │   │   ├── Button (control buttons)
│   │   │   │   └── Divider
│   │   │   └── ActivitySummaryScreen
│   │   │       ├── Card (multiple)
│   │   │       ├── StatDisplay
│   │   │       ├── Badge
│   │   │       └── Button
│   │   └── History Stack
│   │       ├── ActivityHistoryScreen
│   │       │   ├── FlatList (activities)
│   │       │   ├── Card (per activity)
│   │       │   ├── Badge
│   │       │   └── Button (sort)
│   │       └── ActivitySummaryScreen
```

## Data Flow

### Starting an Activity

```
User taps "Start"
         │
         ▼
LiveTrackingScreen.handleStart()
         │
         ├─► startActivity() action (TrackingContext)
         │
         ├─► GPSTrackingService.requestPermissions()
         │
         ├─► GPSTrackingService.requestBackgroundPermissions()
         │
         ├─► Create new Activity object
         │
         ├─► activityStorageService.saveCurrentActivity()
         │   (for crash recovery)
         │
         └─► GPSTrackingService.startTracking()
             (register callback for GPS updates)
```

### GPS Update Flow

```
Native Location Update
         │
         ▼
expo-location callback
         │
         ▼
GPSTrackingService.filterGPSPoint()
         │
         ├─► Check GPS accuracy
         ├─► Check distance threshold
         └─► Return filtered GPSPoint or null
                    │
                    ▼
              handleGPSUpdate() callback
                    │
                    ▼
    TrackingContext updates activity
                    │
                    ├─► Add point to gpsPoints array
                    ├─► Update lastGPSPoint
                    └─► Auto-save current activity
                            │
                            ▼
                    StatisticsService.computeActivityStats()
                            │
                            └─► Update currentStats in context
                                    │
                                    ▼
                    Screens re-render with new stats
```

### Finishing an Activity

```
User taps "Finish"
         │
         ▼
handleFinish() confirmation
         │
         ▼
finishActivity() action (TrackingContext)
         │
         ├─► GPSTrackingService.stopTracking()
         │
         ├─► Set endTime and status='finished'
         │
         ├─► StatisticsService.computeActivityStats()
         │   (final calculation)
         │
         ├─► activityStorageService.saveActivity()
         │   (permanent storage)
         │
         ├─► activityStorageService.saveCurrentActivity(null)
         │   (clear recovery data)
         │
         └─► Navigate to ActivitySummaryScreen
             (display results)
```

## Type System

### Core Types

```typescript
// GPS Point - represents a single location reading
interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;    // May not be available
  accuracy: number | null;     // Horizontal accuracy in meters
  timestamp: number;           // Unix timestamp (ms)
  speed: number | null;        // m/s if available
}

// Activity Statistics - calculated metrics
interface ActivityStats {
  totalDistance: number;       // km
  totalDuration: number;       // ms
  movingTime: number;          // ms (excludes pauses)
  averagePace: number;         // min/km
  currentPace: number | null;  // min/km
  averageSpeed: number;        // km/h
  currentSpeed: number | null; // km/h
  elevationGain: number;       // meters
  maxSpeed: number;            // km/h
}

// Complete Activity Record
interface Activity {
  id: string;                  // Unique identifier
  name: string;                // User-friendly name
  gpsPoints: GPSPoint[];       // Array of location readings
  stats: ActivityStats;        // Current statistics
  startTime: number;           // Session start
  endTime: number | null;      // Session end (null if active)
  status: 'started'|'paused'|'finished';
  notes?: string;              // Optional user notes
}
```

## Service Details

### GPSTrackingService

**Responsibilities:**
- Manage location permissions (foreground and background)
- Filter GPS points for accuracy and distance
- Coordinate with native location APIs
- Error handling and recovery

**Key Methods:**
```typescript
async requestPermissions(): Promise<LocationPermission>
async requestBackgroundPermissions(): Promise<LocationPermission>
async startTracking(onLocationUpdate, onError): Promise<void>
async stopTracking(): Promise<void>
async getCurrentLocation(): Promise<GPSPoint | null>
private filterGPSPoint(location): GPSPoint | null
resetFilter(): void
```

**Filtering Logic:**
```
GPS Point Received
    ↓
[Accuracy Check]
  If accuracy > 20m → Skip point
    ↓
[Distance Check]
  If distance from last point < 5m → Skip point
    ↓
[Valid Point]
  Store as lastFilteredPoint
  Return GPSPoint object
  Invoke callback
```

### StatisticsService

**Responsibilities:**
- Calculate all running metrics
- Format values for display
- Handle missing data gracefully

**Key Calculations:**

**Distance:**
```
Haversine Formula (geolib library):
- Input: Two GPS points
- Output: Great-circle distance
- Implementation: Used for each consecutive point pair
- Accuracy: ±0.5% for typical running
```

**Pace:**
```
Pace = 60 / Speed (km/h)
Speed = Distance (km) / Time (hours)

Example:
- 5 km in 30 minutes
- Speed = 5 / 0.5 = 10 km/h
- Pace = 60 / 10 = 6 min/km
```

**Elevation Gain:**
```
For each GPS point:
  If altitude_current - altitude_previous > 2m
    elevation_gain += difference
  Else
    Skip (noise filtering)

Result: Total meters of uphill climbing
```

**Moving Time:**
```
Moving time includes only periods where:
- Speed > 0.1 m/s (or distance > 0 between points)
- Pauses and stops excluded from this metric
```

### ActivityStorageService

**Responsibilities:**
- Persist activities to AsyncStorage
- Manage activity index for fast retrieval
- Provide recovery mechanism for crashes
- Batch operations for performance

**Storage Structure:**
```
AsyncStorage (device local)
├── NOMA_ACTIVITIES_INDEX (array of activity IDs)
├── NOMA_CURRENT_ACTIVITY (Activity | null)
├── NOMA_ACTIVITY_<ID1> (Activity JSON)
├── NOMA_ACTIVITY_<ID2> (Activity JSON)
└── ...

Typical size per activity:
- 10 km run: ~25-50 KB
- 1 hour run: ~100-150 KB
- Storage limit: Device dependent (iOS: usually 10+ MB available)
```

## State Management

### TrackingContext

**State:**
```typescript
interface TrackingContextType {
  // Activity State
  currentActivity: Activity | null;
  isTracking: boolean;
  isPaused: boolean;
  lastGPSPoint: GPSPoint | null;
  error: string | null;

  // Computed State
  currentStats: ActivityStats | null;

  // History
  activities: Activity[];

  // Actions
  startActivity(name: string): Promise<void>;
  pauseActivity(): Promise<void>;
  resumeActivity(): Promise<void>;
  finishActivity(): Promise<Activity | null>;
  discardActivity(): Promise<void>;
  loadActivities(): Promise<void>;
}
```

**Lifecycle:**
1. **Initialization**: Load recovered activity from storage
2. **Active Tracking**: Update GPS points, calculate stats
3. **Pause**: Save state, stop GPS updates
4. **Resume**: Restart GPS tracking
5. **Finish**: Save permanently, clear current activity

**Auto-Save Mechanism:**
```
Every 5 seconds (while tracking):
  activityStorageService.saveCurrentActivity(currentActivity)
  
Purpose:
  - Recover if app crashes
  - Persist partial runs
  - Smooth user experience
```

## Performance Considerations

### GPS Update Frequency
- **Default**: 1 update per second
- **Configurable**: TrackingConfig.updateInterval
- **Accuracy vs Battery**: 1s is optimal for running (25m spacing)

### Point Filtering
- **Accuracy threshold**: 20m (configurable)
- **Distance filter**: 5m minimum between points
- **Result**: ~60-120 points per hour of running (instead of 3600)
- **Benefit**: 95% storage reduction, no visible quality loss

### Memory Usage
```
Typical 1-hour run:
  GPS Points: ~100 points × 200 bytes = 20 KB
  Activity object: ~10 KB
  Total in memory: ~30-40 KB
  
After serialization to storage:
  JSON format: ~50-80 KB per activity
  Index overhead: <1 KB per activity
```

### Calculation Optimization
- **Lazy evaluation**: Stats computed only when needed
- **Incremental updates**: Only compute delta since last update
- **Memoization**: Recent points cached for moving time/pace

## Error Handling

### GPS-Related Errors
```
Error: Location permission denied
  → Show permission request UI
  → Guide user to settings
  → Fallback: Cannot track without permission

Error: GPS timeout (no fix for 30s)
  → Show "Acquiring GPS signal" message
  → Continue retrying
  → After 5 minutes, suggest better location

Error: Network timeout during sharing
  → Show retry dialog
  → Cache for later sharing
  → Continue activity normally
```

### Storage Errors
```
Error: AsyncStorage write failed
  → Retry with exponential backoff
  → Show error to user
  → Data loss is prevented by multiple saves

Error: Corrupt activity data
  → Load fallback from index
  → Skip corrupted record
  → Log error for debugging
```

### Recovery Mechanisms
```
App Crash During Tracking:
  1. User reopens app
  2. On mount, try recover current activity
  3. If found: Show "Resume?" dialog
  4. If accepted: Continue from last GPS point
  5. If declined: Activity automatically saved to history
```

## Testing Strategy

### Unit Tests
- **StatisticsService**: Test distance, pace, speed calculations
- **GPSTrackingService**: Test filtering logic
- **ActivityStorageService**: Test persistence operations

### Integration Tests
- **Tracking Flow**: Start → GPS updates → Pause → Resume → Finish
- **Recovery**: Simulate crash and recovery
- **Concurrent Updates**: Multiple GPS points while calculating stats

### UI Tests
- **Navigation**: Tab switching, screen transitions
- **State Sync**: UI reflects context changes immediately
- **Error States**: Proper error messages displayed

### Real Device Testing
- **GPS Accuracy**: Compare with Strava/MapMyRun
- **Battery Impact**: Monitor power usage during long runs
- **Background Tracking**: Verify location updates when screen off
- **Crash Recovery**: Force kill app during run, verify recovery

## Security Considerations

### Permissions
- **Foreground Location**: Required for active tracking
- **Background Location**: Requested for continuous tracking
- **Storage Access**: Only AsyncStorage (no filesystem)

### Data Privacy
- **Local Only**: No data sent to servers (MVP)
- **Device Storage**: Encrypted by OS (iOS Keychain option)
- **No Analytics**: No tracking user behavior
- **No Third-party SDKs**: Minimal dependencies

### Future Considerations
- Token-based auth for cloud sync
- HTTPS-only backend communication
- User data export/deletion functionality
- GDPR compliance when adding cloud sync

## Known Limitations

### GPS
1. **Cold start**: Up to 60 seconds for first GPS fix
2. **Urban canyons**: Reduced accuracy in dense buildings
3. **Indoor**: GPS typically unavailable
4. **Multipath errors**: Reflections can cause drift
5. **Battery drain**: Continuous GPS uses ~10-15% battery/hour

### Features
1. **No live map**: Route visualization not implemented
2. **No voice guidance**: No turn-by-turn directions
3. **No wearable sync**: Smartwatch integration planned
4. **No cloud backup**: Only local device storage
5. **No social features**: No sharing/leaderboards in MVP

### Performance
1. **Large activity sets**: >1000 activities may slow history
2. **Long runs**: Activities with >2000 GPS points may be slower
3. **Device storage**: Limited by device's AsyncStorage allocation
4. **Animation**: Smooth animations depend on device capability

## Future Improvements

### Short Term (v0.2)
- [ ] Live map with MapBox
- [ ] Voice notifications
- [ ] Interval tracking templates
- [ ] Better error messages
- [ ] Dark/light theme toggle

### Medium Term (v0.3)
- [ ] Cloud sync with backend API
- [ ] Social sharing enhancements
- [ ] Apple Watch companion app
- [ ] Health app integration
- [ ] Advanced analytics

### Long Term (v0.4+)
- [ ] Machine learning predictions
- [ ] Coaching algorithms
- [ ] Community features
- [ ] Monetization (premium)
- [ ] Platform expansion (web, desktop)

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Status**: Current for v0.1.0
