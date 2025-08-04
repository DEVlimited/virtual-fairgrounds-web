# Virtual Fairgrounds - Browser Version
[Head to the Virtual Fairgrounds](http://mls.devlimited.org/)

At the heart of the Virtual Fairgrounds project lies a profound commitment to preserving the essence of Oklahoma City's historic Fairgrounds District, an area once teeming with life and culture, now remembered only through scattered narratives and memories. This initiative leverages immersive virtual reality technology platforms designed by Drone's Eye View (DEV) to resurrect a neighborhood once vibrant with culture and community, but lost to the tides of urban renewal. The project, inspired by the visionary guidance of Librarian Judith Matthews, is not merely a technical feat; it is a heartfelt tribute to an Oklahoma City treasure tragically lost. By weaving archival recordings and oral histories into the fabric of the virtual environment, DEV aims to offer an immersive educational experience that honors the district's legacy. The urgency of this mission is underscored by the dwindling number of individuals who experienced Deep Deuce firsthand, making this project a crucial bridge between past and present generations.

If you are looking for the VR Virtual Fairgrounds, here is [its repo](https://github.com/DEVlimited/VirtualDeepDeuce).

## How to Add Historical Images and New Locations

This guide will walk you through adding new historical images and locations to the Virtual Fairgrounds project. No programming knowledge required!

### Quick Overview
The Virtual Fairgrounds displays historical images when you interact with different locations (like the Theater or Bill's Cleaners). These images are organized in folders and listed in a special file that tells the program what to show.

### 🖼️ Adding New Images to Existing Locations

#### Step 1: Prepare Your Images
Before adding images to the project:
1. **Name your files clearly** - Use simple names like `theater-front-1955.jpg` instead of `IMG_12345.jpg`
   - ✅ Good: `bills-cleaners-interior.jpg`
   - ❌ Bad: `DSC_0042(1).JPG`
2. **Avoid special characters** - Don't use symbols like #, &, @, or spaces in filenames
   - ✅ Good: `main-street-view.jpg`
   - ❌ Bad: `main street & bath.jpg`
3. **Keep file sizes reasonable** - Images should be under 5MB (resize in any photo app if needed)

**Supported image types:**
- JPG or JPEG (best for photographs)
- PNG (for images with text or graphics)
- GIF (for simple animations)
- TIF or TIFF (historical archives - these load slower)

#### Step 2: Find the Right Folder
Navigate to your project folder, then find these locations:
```
virtual-fairgrounds-web/
  └── public/
      └── images/
          ├── eastside/     ← Theater images go here
          ├── 718/          ← Bill's Cleaners images go here
          ├── 714/          ← Domino Parlor images go here
          └── records/      ← Record Shop images go here
```

**Using GitHub.com (easier for beginners):**
1. Go to your repository on GitHub.com
2. Click on `public` folder
3. Click on `images` folder
4. Click on the location folder (like `eastside`)
5. Click "Upload files" button
6. Drag your images or click "choose your files"

#### Step 3: Update the Image List
Now we need to tell the website about your new images.

**Using GitHub.com:**
1. Navigate back to the main repository page
2. Go to `public` → `js` → click on `imageManifest.json`
3. Click the pencil icon (✏️) to edit
4. Find your location section (search for "theater", "cleaners", etc.)
5. Add your image information

**What to add - Copy this template:**
```json
{
  "src": "../public/images/FOLDERNAME/YOUR-IMAGE.jpg",
  "alt": "Brief description of what's in the image",
  "caption": "Caption that appears below the image when viewing"
},
```

**Real example (copy and modify this):**
```json
{
  "src": "../public/images/eastside/theater-marquee-1955.jpg",
  "alt": "East Side Theater marquee showing movie titles",
  "caption": "The marquee advertises 'Rebel Without a Cause' - October 1955"
},
```

**Where exactly to add it:**
Look for your location and add the new image after the last image but before the closing `]`:
```json
"images": [
  {
    "src": "../public/images/eastside/existing-image.jpg",
    "alt": "An existing image",
    "caption": "Existing caption"
  },
  {
    "src": "../public/images/eastside/YOUR-NEW-IMAGE.jpg",
    "alt": "Your description",
    "caption": "Your caption"
  }
]
```

⚠️ **Common mistakes to avoid:**
- **Forgetting the comma** - Every `}` needs a comma after it, EXCEPT the very last one
- **Wrong quotes** - Use straight quotes `"` (hold Shift and press the key next to Enter)
- **Typos in the path** - The filename must match EXACTLY (including capital letters)

#### Step 4: Save and Check Your Work
1. Scroll to the bottom of the page
2. In "Commit changes" box, type: "Added new images for [location name]"
3. Click "Commit changes" button
4. Wait 5-10 minutes for the website to update
5. Visit the live site and test your images!

### 📍 Adding a Completely New Location

This is more complex and requires help from a developer for the final step.

#### Step 1: Create Your Location Folder
**Using GitHub.com:**
1. Go to `public` → `images`
2. Click "Create new file"
3. Type: `yourlocationname/placeholder.txt` (this creates a folder)
4. Click "Commit new file"
5. Go back and upload your images to this new folder

#### Step 2: Add Your Location Information
Edit `imageManifest.json` and add this template at the end (but before the final `]`):

```json
,
{
  "id": "yourlocationid",
  "title": "Name That Appears in Popup",
  "description": "One sentence about this location",
  "html": "<p><strong>Additional historical details here</strong></p>",
  "images": [
    {
      "src": "../public/images/yourfolder/first-image.jpg",
      "alt": "Description of image",
      "caption": "Historical caption with date"
    }
  ]
}
```

#### Step 3: Contact Development Team
New locations need to be made interactive in the 3D world. Email the team with:
- Your new location ID
- Description of where it should be in the virtual neighborhood
- Any historical details about its original location

### 🔍 How to Check If It's Working

**The JSON Checker:**
1. Copy all the content from `imageManifest.json`
2. Go to https://jsonlint.com/
3. Paste your content and click "Validate JSON"
4. If it shows errors, it will tell you which line has a problem

**Common Error Messages and Fixes:**

| What You See | What It Means | How to Fix |
|--------------|---------------|------------|
| "Expecting comma" | Missing comma after a `}` | Add a comma |
| "Unexpected token" | Wrong type of quotes or extra character | Check your quotes are straight `"` |
| "Expecting string" | Missing quotes around text | Add quotes around your text |

### 🆘 When to Ask for Help

Contact the development team if:
- The website shows an error page
- Your images won't appear after 30 minutes
- You need to add a new interactive location
- You're unsure about any step

### 📝 Quick Reference Card

**File naming rules:**
- No spaces (use hyphens: `bill-store-front.jpg`)
- No special characters (#&@!*)
- Keep it short and descriptive

**Image list format** (the pattern to follow):
```
comma → {
quote → "src": "../public/images/folder/filename.jpg" ← comma
quote → "alt": "What the image shows" ← comma
quote → "caption": "Historical description and date" ← quote
} ← comma (except if it's the last one)
```

**Testing checklist:**
- [ ] File names have no spaces or special characters
- [ ] Images uploaded to correct folder
- [ ] Image paths in JSON match exactly
- [ ] All commas in the right places
- [ ] Waited 10 minutes after saving
- [ ] Cleared browser cache (Ctrl+F5 or Cmd+Shift+R)

### 💡 Pro Tips for Beginners

1. **Make a backup first** - Before editing, copy the entire contents of `imageManifest.json` to a text file on your computer
2. **Add one image at a time** - It's easier to find mistakes this way
3. **Use the browser's incognito/private mode** - This ensures you see the latest version. YOu can also disable the cache in your browser tools. Google it or ask an AI if you need assistance. 
4. **Take screenshots** - If something goes wrong, screenshots help developers help you

# Virtual Fairgrounds Architecture

## Overview
The Virtual Fairgrounds is a browser-based 3D experience that recreates Oklahoma City's historic Fairgrounds District. This document outlines the modular architecture implemented in the refactor.

## Architecture Diagram
```
main.js (Entry Point)
    └── VirtualFairgrounds (Core Application)
        ├── SceneManager (3D Scene Setup)
        ├── AssetLoader (Resource Management)
        ├── MovementController (Player Movement)
        ├── GUIModeHandler (GUI Interaction)
        ├── InteractionController (World Interactions)
        ├── PopupManager (Information Displays)
        ├── MaterialModeManager (Visual Modes)
        └── AdvancedCullingLODManager (Performance)
```

## Core Systems

### VirtualFairgrounds (`/core/VirtualFairgrounds.js`)
Main application orchestrator that initializes and coordinates all subsystems.
- Manages initialization flow
- Handles render loop
- Coordinates between subsystems
- Manages application lifecycle

### SceneManager (`/core/SceneManager.js`)
Handles Three.js scene setup and configuration.
- Scene creation and configuration
- Lighting setup (hemisphere & directional)
- Fog configuration
- Skybox management

### AssetLoader (`/core/AssetLoader.js`)
Manages loading of 3D models and textures.
- GLTF/GLB model loading with Draco compression
- Skybox texture loading
- Progress tracking
- Error handling

## Control Systems

### MovementController (`/controls/MovementController.js`)
Handles player movement and camera rotation.
- WASD/Arrow key movement
- Mouse look (via PointerLockControls)
- Q/E rotation in GUI mode
- Velocity-based movement physics

### GUIModeHandler (`/controls/GUIModeHandler.js`)
Manages GUI interaction mode toggling.
- Middle mouse button toggles GUI mode
- Handles focus management
- Controls pointer lock state
- Updates GUI visibility

### InteractionController (`/controls/InteractionController.js`)
Manages F-key interactions with world objects.
- Zone-based interaction detection
- Popup triggering
- Interaction UI updates

## Manager Systems

### PopupManager (`/managers/PopupManager.js`)
Handles information popups and image carousels.
- Location-based content display
- Image carousel with TIFF support
- Audio playback
- Loading screens
- Tab navigation

### MaterialModeManager (`/managers/MaterialManager.js`)
Manages visual modes like monochromatic rendering.
- Material storage and restoration
- Monochromatic mode toggle
- Shader integration
- LOD material updates

### LODManager (`/managers/LODManager.js`)
Optimization system for performance.
- Frustum culling
- Level-of-detail (LOD) management
- Texture quality optimization
- Distance-based rendering

## Utility Systems

### BoundaryBox (`/utils/BoundaryBox.js`)
Spatial boundaries for camera movement.
- Rotatable boundary volumes
- Camera constraint enforcement
- Debug visualization
- Matrix transformations

### PopupCircle (`/utils/PopupCircle.js`)
Interactive zones that trigger popups.
- Spherical interaction volumes
- Camera intersection detection
- Debug visualization

### GUIHelpers (`/utils/GUIHelpers.js`)
Helper classes for GUI controls.
- MinMaxGUIHelper (camera near/far)
- ColorGUIHelper (light colors)
- FogGUIHelper (fog parameters)

## Shader Systems

### FogShaderSetup (`/shaders/FogShaderSetup.js`)
Custom fog implementation with noise.
- Simplex noise integration
- Performance-optimized fog
- Time-based animation

### NoiseShader (`/shaders/NoiseShader.js`)
GLSL noise functions for atmospheric effects.

## Configuration

### Constants (`/config/constants.js`)
Centralized configuration values.
```javascript
- CAMERA_CONFIG (FOV, near/far, initial position)
- MOVEMENT (speed, deceleration, rotation)
- FOG_CONFIG (color, density)
- BOUNDARIES (spatial limits)
- MODEL_URL (asset locations)
```

### Locations (`/config/locations.js`)
Interactive zone definitions.
```javascript
- Position and radius for each zone
- Location IDs for content mapping
- Theater, cleaners, dominos, records, etc.
```

## Data Flow

### Initialization Flow
1. `main.js` creates `VirtualFairgrounds` instance
2. Custom fog shaders are initialized
3. PopupManager loads manifest data
4. Renderer, scene, camera are created
5. Control systems are initialized
6. Interaction zones are created
7. GUI is built
8. Assets are loaded
9. Boundaries are established
10. Render loop begins

### Render Loop
1. Calculate delta time
2. Update fog animation
3. Check player interactions
4. Update movement if active
5. Update LOD system
6. Update texture quality
7. Render scene

### Interaction Flow
1. Player enters interaction zone
2. InteractionController detects proximity
3. UI prompt appears
4. Player presses F key
5. PopupManager displays location content
6. Controls unlock for popup interaction

## Key Features

### Performance Optimizations
- Frustum culling (objects outside view are skipped)
- LOD system (distant objects use simpler models)
- Texture quality scaling (based on distance)
- Conditional fog calculations

### Visual Modes
- Full color mode (default textures)
- Monochromatic mode (architectural focus)
- Adjustable brightness
- Custom skybox support

### User Controls
- First-person navigation
- GUI mode for settings adjustment
- Keyboard shortcuts (M for monochrome)
- Mouse-based camera control

## Adding New Features

### Adding a New Location
1. Add zone definition to `/config/locations.js`
2. Add content to `/public/js/imageManifest.json`
3. Zone will automatically be interactive

### Adding a New Visual Mode
1. Extend `MaterialModeManager`
2. Add GUI controls in `VirtualFairgrounds.setupVisualizationGUI()`
3. Implement material swapping logic

### Adding a New Control Scheme
1. Extend `MovementController`
2. Add input handling
3. Update GUI mode handler if needed

## Dependencies
- Three.js (3D rendering)
- PointerLockControls (first-person controls)
- lil-gui (settings interface)
- GLTFLoader (3D model loading)
- DRACOLoader (model compression)

## Development Guidelines

### Code Style
- ES6 modules with explicit imports/exports
- Class-based architecture
- JSDoc comments for public methods
- Descriptive variable names

### Best Practices
- Single responsibility per module
- Dependency injection over globals
- Event-driven communication
- Proper resource disposal

### Testing Approach
- Module isolation enables unit testing
- Mock Three.js objects for logic tests
- Integration tests for subsystem interaction
- Performance profiling for optimizations

## Troubleshooting

### Common Issues
1. **Popup not working**: Check INTERACTION_ZONES import
2. **Movement stuck**: Verify GUI mode state
3. **Performance issues**: Adjust LOD distances
4. **Textures not loading**: Check asset paths

### Debug Tools
- `window.app` - Access main application instance
- GUI panels - Real-time parameter adjustment
- Boundary visualization - Toggle in Debug panel
- Console logging - Detailed error messages

## Classes integrated
This repo has been used in various classes at [Oklahoma City University](www.okcu.edu) to teach students real world software concepts while putting work into the great community project sponsored by the [Metropolitan Library System](https://www.metrolibrary.org/).

### Software Engineering
This repo will be used to teach software engineering practices to undergraduate students enrolled in a Introduction to Software Engineering course at [Oklahoma City University](www.okcu.edu).

### Undergraduate Internship
With resources provided by the [Metropolitan Library System](https://www.metrolibrary.org/) and management provided by [DEV](https://devlimited.org/) undergraduate internships to further this project have official started in the Summer of 2025!

#### Undergraduate Interns
- [xDarthx](https://github.com/xDarthx) - Summer 2025
