# Virtual Fairgrounds - Browser Version
[Head to the Virtual Fairgrounds](http://mls.devlimited.org/)

At the heart of the Virtual Fairgrounds project lies a profound commitment to preserving the essence of Oklahoma City's historic Fairgrounds District, an area once teeming with life and culture, now remembered only through scattered narratives and memories. This initiative leverages immersive virtual reality technology platforms designed by Drone’s Eye View (DEV) to resurrect a neighborhood once vibrant with culture and community, but lost to the tides of urban renewal. The project, inspired by the visionary guidance of Librarian Judith Matthews, is not merely a technical feat; it is a heartfelt tribute to an Oklahoma City treasure tragically lost. By weaving archival recordings and oral histories into the fabric of the virtual environment, DEV aims to offer an immersive educational experience that honors the district's legacy. The urgency of this mission is underscored by the dwindling number of individuals who experienced Deep Deuce firsthand, making this project a crucial bridge between past and present generations.

If you are looking for the VR Virtual Fairgrounds, here is [its repo](https://github.com/DEVlimited/VirtualDeepDeuce).

## Use Instructions
### Image Carousel
#### Features
- ✅ Dynamic image loading from JSON manifest
- ✅ TIFF support via CDN library
- ✅ No build steps required
- ✅ Works directly from GitHub Pages
- ✅ GUI controls for carousel settings
- ✅ Multiple transition effects
- ✅ Autoplay with configurable speed
- ✅ Thumbnail navigation

#### File Structure
```
virtual-fairgrounds-web/
├── public/
│   ├── images/
│   │   ├── eastside/     # Theater images
│   │   ├── 718/          # Bill's Cleaners images
│   │   ├── 714/          # Domino Parlor images
│   │   ├── records/      # Record shop images
│   │   └── placeholder.jpg
│   ├── js/
│   │   ├── pointerLockTest.js
│   │   └── imageManifest.json  # Your image registry
│   └── css/
│       └── carousel.css
└── pages/
    ├── mainModel.html
    └── featureTesting.html
```

#### Adding New Images
1. Add your image files to the appropriate folder in `/public/images/`
2. Update `imageManifest.json` with the new image information:
```json
{
  "src": "../public/images/eastside/new-image.jpg",
  "alt": "Description of the image",
  "caption": "Caption that appears below the image"
}
```
3. For TIFF files, add `"type": "tiff"`:
```json
{
  "src": "../public/images/eastside/archive-photo.tif",
  "alt": "Historical archive photo",
  "caption": "From the archives, circa 1950",
  "type": "tiff"
}
```
4. Commit and push to GitHub - changes will be live immediately!

#### Adding New Locations
1. Create a new folder in `/public/images/` for your location
2. Add a new location object to `imageManifest.json`:
```json
{
  "id": "newlocation",
  "title": "New Location Name",
  "description": "Brief description of the location",
  "html": "<p><strong>Additional formatted information</strong></p>",
  "images": [
    {
      "src": "../public/images/newlocation/image1.jpg",
      "alt": "Image description",
      "caption": "Image caption"
    }
  ]
}
```
3. Add corresponding popup sphere and interaction code in your main JavaScript

#### Image Guidelines

##### Supported Formats
- **JPG/JPEG** - Best for photographs
- **PNG** - Best for images with transparency
- **GIF** - For simple animations
- **WebP** - Modern format with good compression
- **SVG** - For vector graphics
- **TIFF/TIF** - Supported via client-side conversion

##### Optimization Tips
1. **Image Size**: Keep images under 2MB for faster loading
2. **Dimensions**: 1920x1080 maximum is usually sufficient
3. **TIFF Files**: These are converted client-side, which may be slow for large files
4. **Naming**: Use descriptive filenames without special characters

##### TIFF Performance Considerations

TIFF files are converted in the browser, which means:
- Initial loading may be slower than other formats
- Large TIFF files (>10MB) may cause noticeable delays
- Consider pre-converting to JPG if performance is an issue

To pre-convert TIFF files:
1. Use any image editor (GIMP, Photoshop, Preview on Mac)
2. Open the TIFF file
3. Export as JPG with 90% quality
4. Update `imageManifest.json` to point to the JPG version

#### Troubleshooting

##### Images Not Showing
1. Check the browser console (F12) for errors
2. Verify image paths in `imageManifest.json` are correct
3. Ensure `placeholder.jpg` exists
4. Check that image files are committed to GitHub

##### TIFF Images Not Loading
1. Verify UTIF.js script is included in HTML
2. Check console for TIFF conversion errors
3. Try with a smaller TIFF file to test
4. Consider pre-converting to JPG

#### Example Workflow

1. Take new photos of historical locations
2. Save them to appropriate folders in `/public/images/`
3. Update `imageManifest.json` with image details and historical captions
4. Commit and push to GitHub
5. Visit your GitHub Pages site - new images appear automatically!

#### Advanced Customization

##### Custom Popup Content
You can add rich HTML content to any location:
```json
"html": "<h3>Historical Timeline</h3><ul><li>1946 - Theater opens</li><li>1955 - Peak attendance</li></ul>"
```

##### Image Metadata
Consider adding more metadata to your manifest:
```json
{
  "src": "../public/images/eastside/photo.jpg",
  "alt": "East Side Theater marquee",
  "caption": "Saturday night crowd, 1952",
  "photographer": "John Smith",
  "date": "1952-06-15",
  "copyright": "OKC Historical Society"
}
```

Then display this in your HTML template as needed.

#### Contributing

To contribute new historical images:
1. Fork the repository
2. Add your images to the appropriate folders
3. Update `imageManifest.json`
4. Submit a pull request with image descriptions

Remember: This is a historical preservation project - image accuracy and proper attribution are important!

## Classes integrated
This repo has been used in various classes at [Oklahoma City University](www.okcu.edu) to teach students real world software concepts while putting work into the great community project sponsored by the [Metropolitan Library System](https://www.metrolibrary.org/).

### Software Engineering
This repo will be used to teach software engineering practices to undergraduate students enrolled in a Introduction to Software Engineering course at [Oklahoma City University](www.okcu.edu).

### Undergraduate Internship
With resources provided by the [Metropolitan Library System](https://www.metrolibrary.org/) and management provided by [DEV](https://devlimited.org/) undergraduate internships to further this project have official started in the Summer of 2025!

#### Undergraduate Interns
- [xDarthx](https://github.com/xDarthx) - Summer 2025 
