# NOMA GPS Tracker - Setup Guide (Disk Space Issue)

## ⚠️ Important: Disk Space Alert

Your system is running low on disk space (ENOSPC error). Before proceeding with npm installation, you need to free up space.

### Quick Disk Cleanup

**Option 1: Quick Cleanup (Recommended First)**
```powershell
# Navigate to Windows Temp
cd $env:TEMP
# Remove old npm cache
Remove-Item -Path $env:APPDATA\npm-cache -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path .\.npm -Recurse -Force -ErrorAction SilentlyContinue
# Run disk cleanup utility
cleanmgr
```

**Option 2: Check Disk Space**
```powershell
# See disk usage
Get-Volume | Select-Object DriveLetter, Size, SizeRemaining
# Or with more detail
Get-PSDrive | Where-Object {$_.Provider -like '*FileSystem*'} | Select-Object Name, Used, Free
```

**Option 3: Clear npm Cache**
```powershell
npm cache clean --force
```

---

## 📦 Setup Instructions (Using npx - No Global Install Required)

After freeing up disk space, follow these steps:

### 1. Install Dependencies
```powershell
cd d:\noma_tesst
npm install --no-save
```

**Why `--no-save`?** This installs dependencies without saving to package-lock.json, saving disk space.

### 2. Run the Application
```powershell
# Start Expo server (uses local npx)
npm start
```

Or use one of the shortcut commands:
```powershell
npm run start:ios      # iOS Simulator
npm run start:android  # Android Emulator
npm run start:web      # Web version
```

### 3. Connect Your Device
When you see the Expo QR code in terminal:
- **Option A:** Scan with Expo app on your phone
- **Option B:** Press 'i' for iOS Simulator or 'a' for Android Emulator
- **Option C:** Press 'w' for web version

---

## 🛠️ Alternative: Minimal Installation

If disk space is critically low, use this minimal approach:

```powershell
# 1. Install only core dependencies
npm install --production --no-save

# 2. Run directly via npx (downloads on-demand)
npx expo start
```

---

## 🔍 Troubleshooting

### "ENOSPC: no space left on device"
**Solution:**
1. Free up disk space using the cleanup commands above
2. Clear npm cache: `npm cache clean --force`
3. Try installation again: `npm install`

### "expo is not recognized"
**Solution:** This is expected! Use `npm start` or `npx expo start` instead.

### "ERESOLVE unable to resolve dependency tree"
**Solution:** Already fixed in package.json. Try:
```powershell
npm install --legacy-peer-deps --no-save
```

### Installation keeps failing
**Solution:** Clean everything and try fresh:
```powershell
# Remove node_modules
Remove-Item -Path node_modules -Recurse -Force
# Clear npm cache
npm cache clean --force
# Fresh install
npm install --no-save
```

---

## 📊 Disk Space Requirements

| Component | Size |
|-----------|------|
| node_modules | ~500-600 MB |
| Project source | <1 MB |
| Expo cache | ~200-300 MB |
| **Total needed** | **~1-2 GB** |

**Recommended:** At least 2-3 GB free space before installation.

---

## ✅ Verification

After installation completes successfully:

```powershell
# Verify npm is working
npm --version

# Verify expo works
npx expo --version

# Check project structure
ls app/

# Try running the app
npm start
```

Expected output:
```
Starting Metro Bundler
Expo server started at http://localhost:19000
Scan the QR code...
```

---

## 🚀 Next Steps (After Successful Installation)

1. **Run the app:**
   ```powershell
   npm start
   ```

2. **Scan QR code** with Expo app or press 'a'/'i' for emulator

3. **Test the app:**
   - Navigate to "Live Track"
   - Enter activity name
   - Start activity (grant GPS permissions)
   - Walk/run for 2-5 minutes
   - Finish and view summary

---

## 💡 Pro Tips

### Save More Disk Space
```powershell
# Remove optional dependencies
npm install --no-optional --no-save

# Remove devDependencies if not developing
npm install --production --no-save
```

### Monitor Disk Space
```powershell
# Check how much space npm is using
((Get-ChildItem C:\Users\YourUsername\AppData\Roaming\npm -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB)
```

### Use Different npm Cache Location
```powershell
# Set custom cache directory (e.g., external drive)
npm config set cache D:\npm-cache

# Verify
npm config get cache
```

---

## 📞 Still Having Issues?

### Check System Requirements
```powershell
# Check Node.js version
node --version
# Should be 14+ for this project

# Check npm version
npm --version
# Should be 6+

# Check if git is installed (may be needed)
git --version
```

### Get Detailed Error Info
```powershell
# Run npm install with verbose output
npm install --verbose --no-save

# Check npm logs
cat $env:APPDATA\npm-debug.log
```

### Contact Support
If issues persist:
1. Check [Expo documentation](https://docs.expo.dev)
2. Review error message in detail
3. Check available disk space
4. Try on a different drive with more space

---

## 📋 Checklist Before Running

- [ ] Freed up at least 2-3 GB of disk space
- [ ] Ran `npm install --no-save`
- [ ] Installation completed without ENOSPC errors
- [ ] `npm --version` works
- [ ] `npx expo --version` works
- [ ] `npm start` displays Expo server started message

---

**Good luck with your NOMA GPS Activity Tracker!** 🏃‍♂️🟢

If you get stuck, refer back to this guide or check the QUICKSTART.md for more info.
