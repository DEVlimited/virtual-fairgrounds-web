# Virtual Fairgrounds Refactor Notes

## Project Overview
The Virtual Fairgrounds is a WebGL-based 3D interactive experience that preserves Oklahoma City's historic Fairgrounds District (Deep Deuce) circa 1955. Built with Three.js.

---

## Architecture Refactor (Completed June 2025)

### The Problem: Old Architecture
The original system used a `UnifiedPerformanceManager` with:
- **Material Swapping**: Dynamically changed materials on meshes based on camera distance
- **Runtime Texture Switching**: Swapped texture quality at runtime
- **Single Mesh per Object**: One mesh with materials changed dynamically
- **Issues**: Material mutation caused rendering artifacts and increased complexity

### The Solution: New Architecture
Refactored to `AdvancedCullingLODManager` with:
- **Mesh Cloning**: Creates THREE separate mesh instances per object (high, medium, low)
- **Visibility Toggling**: Shows/hides entire meshes instead of swapping materials
- **Static Materials**: Each LOD level has its own simplified material from initialization
- **Benefits**: Cleaner separation, no runtime material mutation, more predictable performance

### Key Classes

#### `AdvancedCullingLODManager` (lines 193-404)
- Manages Level-of-Detail (LOD) system using mesh visibility
- Automatically registers objects from GLTF scene
- Provides distance-based LOD switching: high → medium → low → culled
- Integrates frustum culling for objects outside camera view
- **GUI Controls**: Now connected! Adjust distances in "Performance Optimization" folder

#### `SafeTextureLODManager` (lines 409-520)
- Handles texture optimization at load time
- Creates low-resolution texture variants
- Provides distance-based texture quality updates via `updateTextureQuality()`
- **Status**: Fully functional, called every 3 frames in render loop

#### `popUpCircle` (lines 698-810)
- Manages proximity detection zones for interactive locations
- **New Feature**: Optional raycast-based directional detection
- Can now detect when player is both nearby AND facing a location
- Toggle in GUI: "Popup Circles" → "Directional Detection"

---

## Fixes Applied (November 2025)

### Critical Content Fixes

#### 1. Melody Records Location
**Issue**: Entire `/public/images/records/` folder was missing
**Fix**: Created folder with placeholder images for all 4 referenced images

#### 2. Domino Parlor Images
**Issue**: Manifest referenced non-existent files (`714_interior_2.jpg`, `714_patrons.png`)
**Fix**: Updated manifest to use actual files (`714 Interior 2.tif`, `714 Interior 3.tif`, `714 Interior 4.tif`)

#### 3. Bill's Cleaners Images
**Issue**: Case sensitivity mismatches (`interior` vs `Interior`)
**Fix**: Updated all references to match actual filenames with proper capitalization

#### 4. Eastside Theater Images
**Issue**: Referenced 7 images but only 4 existed
**Fix**: Removed references to missing `BlackDis1.png`, `BlackDis3.jpg`, `BlackDis5.jpg`

#### 5. North/South End Locations
**Issue**: Empty location definitions with no content
**Fix**: Added full content including:
- Welcome text explaining the Fairgrounds history
- Aerial images from carousel collection
- 4 oral history audio clips that were previously unused

### Feature Enhancements

#### 6. LOD GUI Controls
**Issue**: GUI controls existed but didn't do anything
**Fix**: Connected all LOD distance sliders to the `AdvancedCullingLODManager`
- High Detail Distance: 10-100 units
- Medium Detail Distance: 50-200 units
- Low Detail Distance: 100-400 units
- Cull Distance: 200-800 units
- Toggles for Frustum Culling and LOD System

#### 7. Raycast Proximity Detection
**Issue**: Mentioned in commits but not implemented
**Fix**: Implemented full directional detection system
- Added `checkWithRaycast()` method to `popUpCircle` class
- Checks both distance AND viewing angle (default 45°)
- GUI controls: Enable/disable + angle threshold adjustment
- Automatically falls back to distance-only detection when disabled

#### 8. Carousel Slide Transitions
**Issue**: Slide transition CSS was incomplete
**Fix**: Enhanced CSS with proper bidirectional sliding
- Smooth cubic-bezier easing
- Proper z-index layering
- Classes for all directions: `slide-in-left`, `slide-in-right`, `slide-out-left`, `slide-out-right`

#### 9. Error Handling
**Issue**: Silent failures when media files missing
**Fix**: Added comprehensive error handling:
- **Images**: Console warnings with original path, fallback to placeholder
- **Audio**: Error event handler, visual indication in UI, disable controls
- **TIFF**: Already had error handling, maintained

---

## File Changes Summary

### Modified Files
1. `public/js/imageManifest.json` - Fixed all image/audio references, added northEnd/southEnd content
2. `public/js/pointerLockTest.js` - Added LOD controls, raycast detection, error handling
3. `public/css/carousel.css` - Enhanced slide transition CSS

### Created Files/Folders
1. `public/images/records/` - New folder with 4 placeholder images
2. `REFACTOR_NOTES.md` - This documentation

---

## Audio Files Status

### Currently Used
- `eastsideTheatre1.mp3` - Eastside Theater location
- `eastsideTheatre2.mp3` - Eastside Theater location
- `bills1.mp3` - Bill's Cleaners location
- `dominosBilliardHall.mp3` - Domino Parlor location
- `melodyRecords1.mp3` - Melody Records location
- `melodyRecords2.mp3` - Melody Records location
- `AvisMelvaFranklin-edited.mp3` - North End location
- `HobertSutton-edited.mp3` - North End location
- `EloiseCarbajal-edited1.mp3` - South End location
- `JWSanford1-edited2.mp3` - South End location

### Unused (Available for Future Content)
- `JWSanford2-edited.mp3`
- `SandraRichards-edited.mp3`

---

## Testing Recommendations

### Critical Tests
1. **Load all 6 locations** and verify images appear correctly
2. **Test audio playback** at each location
3. **Toggle LOD settings** in GUI and observe performance changes
4. **Enable raycast mode** and verify you must face buildings to trigger popups
5. **Test carousel transitions** with slide mode enabled

### Performance Tests
1. Walk through entire scene and monitor FPS
2. Adjust LOD distances and measure impact
3. Check memory usage with texture quality system active

### Error Handling Tests
1. Remove an image file temporarily - should show placeholder
2. Remove an audio file temporarily - should show "Audio unavailable"
3. Check browser console for appropriate error messages

---

## Future Enhancement Opportunities

### Content
- Add actual historical images for Melody Records (currently using placeholders)
- Create more interaction points beyond the 6 current locations
- Add minimap for user orientation

### Features
- Implement mesh-based raycasting (currently uses angle calculation)
- Add distance-based audio attenuation
- Create admin UI for adjusting popup circle positions without GUI
- Add VR support

### Performance
- Implement object pooling for frequently created elements
- Add progressive texture loading for initial load optimization
- Consider implementing geometry LOD (currently only material/visibility LOD)

---

## Technical Notes

### Render Loop Order
1. Update LOD system (`cullingLODManager.update()`)
2. Update fog uniforms for shaders
3. Check proximity circles (with optional raycast)
4. Update texture quality (every 3 frames)
5. Render scene

### GUI Structure
```
Camera
Performance Optimization
  └─ LOD Distances
      ├─ High Detail
      ├─ Medium Detail
      ├─ Low Detail
      └─ Cull Distance
  ├─ Enable Frustum Culling
  ├─ Enable LOD System
  └─ Apply Settings
Camera Boundaries
Popup Circles
  ├─ Directional Detection
  ├─ Detection Angle
  └─ [Individual circle folders]
```

---

## Known Limitations

1. **Placeholder Images**: Melody Records location uses placeholders until actual historical images are sourced
2. **Raycast Method**: Current implementation uses angle calculation; true mesh raycasting would be more accurate but more expensive
3. **Slide Transitions**: JavaScript carousel logic would need updates to fully utilize the enhanced CSS classes
4. **Texture LOD**: Operates independently of mesh LOD; could be more tightly integrated

---

## Documentation References

- Three.js LOD System: https://threejs.org/docs/#api/en/objects/LOD
- WebGL Performance Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Frustum Culling: https://en.wikipedia.org/wiki/Hidden-surface_determination#Viewing-frustum_culling

---

*Last Updated: November 19, 2025*
*Refactor Completed: June 2025*
*Project: Virtual Fairgrounds - Oklahoma City Fairgrounds District Historical Experience*
