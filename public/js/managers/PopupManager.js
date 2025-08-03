/**
 * Manages all popup interactions, image carousels, and location information
 * @class PopupManager
 */
export class PopupManager {
    constructor() {
        this.overlay = document.getElementById('popup');
        this.container = document.querySelector('.popup-container');
        this.title = document.getElementById('popup-title');
        this.content = document.getElementById('popup-content');
        this.currentTab = 'instructions';

        this.popUpActive = false;
        this.currentImageIndex = 0;
        this.currentImages = [];
        this.currentLocation = null;
        this.autoplayInterval = null;
        this.autoplayEnabled = false;
        this.autoplayDuration = 3000;
        this.showThumbnails = false;
        this.transitionType = 'fade';

        this.imageManifest = null;
        this.tiffCache = new Map();

        this.audio = new Audio();
    }
    async init() {
        try {
            const response = await fetch('../public/js/imageManifest.json');
            this.imageManifest = await response.json();
            console.log('Image manifest loaded:', this.imageManifest);
            console.log(`Version: ${this.imageManifest.version}, Updated: ${this.imageManifest.updated}`);
        } catch (error) {
            console.error('Could not load image manifest:', error);
            this.imageManifest = { locations: [] };
        }
    }
    
    getLocationData(locationId) {
        if (this.imageManifest && this.imageManifest.locations) {
            return this.imageManifest.locations.find(loc => loc.id === locationId);
        }
        return null;
    }
    
    async convertTiffToCanvas(url) {
        if (this.tiffCache.has(url)) {
            return this.tiffCache.get(url);
        }
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            const ifds = UTIF.decode(arrayBuffer);
            if (ifds.length === 0) throw new Error('No images found in TIFF');
            
            const ifd = ifds[0];
            UTIF.decodeImage(arrayBuffer, ifd);
            
            const canvas = document.createElement('canvas');
            canvas.width = ifd.width;
            canvas.height = ifd.height;
            const ctx = canvas.getContext('2d');
            
            const rgba = UTIF.toRGBA8(ifd);
            
            const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer), ifd.width, ifd.height);
            ctx.putImageData(imageData, 0, 0);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            
            this.tiffCache.set(url, dataUrl);
            
            return dataUrl;
        } catch (error) {
            console.error('Error converting TIFF:', error);
            return '../public/images/placeholder.png';
        }
    }
    
    async processImageSource(imageData) {
        if (imageData.type === 'tiff' || imageData.src.toLowerCase().endsWith('.tif') || imageData.src.toLowerCase().endsWith('.tiff')) {
            return await this.convertTiffToCanvas(imageData.src);
        }
        return imageData.src;
    }
    
    show(title = 'Popup', content = '') {
        this.title.textContent = title;
        this.content.innerHTML = content;
        
        this.overlay.style.display = 'block';
        setTimeout(() => {
            this.overlay.classList.add('show');
            this.container.classList.add('show');
        }, 10);
        
        document.body.style.overflow = 'hidden';
        document.body.style.cursor = 'default';
        
        this.initializeCarousel();
        this.initializeAudio();
        
        if (this.autoplayEnabled && this.currentImages.length > 1) {
            this.startAutoplay();
        }
    }
    
    hide() {
        this.overlay.classList.remove('show');
        this.container.classList.remove('show');
        
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 300);
        
        document.body.style.overflow = 'auto';
        document.body.style.cursor = 'none';
        
        this.stopAutoplay();

        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        
        this.currentImageIndex = 0;
        this.currentImages = [];
        this.currentLocation = null;
        this.removeCarouselListeners();
    }
        
    initializeAudio() {

            const locationData = this.getLocationData(this.currentLocation);

            if (!locationData || !locationData.audio) {
                console.log('No audio data found for location');
                return;
            }

            const audioContainer = this.content.querySelector('.audio-player-container');
            console.log('Audio container found:', !!audioContainer);

            if (!audioContainer) {
                console.log('Audio container not found in DOM');
                return;
            }

            this.audio.src = locationData.audio[0].src;

            const playButton = audioContainer.querySelector('.audio-controls.play');
            const pauseButton = audioContainer.querySelector('.audio-controls.pause');

            if (playButton && pauseButton) {

                playButton.removeEventListener('click', this.playAudio);
                pauseButton.removeEventListener('click', this.pauseAudio);

                this.playAudio = () => {
                    console.log('Play button clicked');
                    console.log('Audio src:', this.audio.src);
                    console.log('Audio readyState:', this.audio.readyState);

                    if (!this.audio.src) {
                        console.error('No audio source set');
                        return;
                    }

                    const playPromise = this.audio.play();

                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log('Audio playing successfully');
                                playButton.style.display = 'none';
                                pauseButton.style.display = 'inline-block';
                            })
                            .catch(error => {
                                console.error('Error playing audio:', error);
                            });
                    }
                };

                this.pauseAudio = () => {
                    console.log('Pause button clicked');
                    this.audio.pause();

                    playButton.style.display = 'inline-block';
                    pauseButton.style.display = 'none';
                };

                playButton.addEventListener('click', this.playAudio);
                pauseButton.addEventListener('click', this.pauseAudio);

                playButton.style.display = 'inline-block';
                pauseButton.style.display = 'none';

                this.audio.addEventListener('play', () => {
                    playButton.style.display = 'none';
                    pauseButton.style.display = 'inline-block';
                });

                this.audio.addEventListener('pause', () => {
                    playButton.style.display = 'inline-block';
                    pauseButton.style.display = 'none';
                });

                this.audio.addEventListener('ended', () => {
                    playButton.style.display = 'inline-block';
                    pauseButton.style.display = 'none';
                });
            }
        }

        generateAudioHTML(locationData) {
            if (!locationData.audio) return '';

            return `
                <div class="audio-player-container">
                    <div class="audio-info">
                        <span class="audio-title">${locationData.audio[0].title || 'Audio'}</span>
                    </div>
                    <div class="audio-controls-wrapper">
                        <button class="audio-controls play" title="Play">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        <button class="audio-controls pause" title="Pause" style="display: none;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }

        initializeCarousel() {
            const carouselContainer = this.content.querySelector('.carousel-container');
            if (!carouselContainer) return;

            carouselContainer.classList.toggle('slide-transition', this.transitionType === 'slide');

            this.currentImages = Array.from(carouselContainer.querySelectorAll('.carousel-image'));
            if (this.currentImages.length <= 1) return;

            const prevBtn = carouselContainer.querySelector('.carousel-nav.prev');
            const nextBtn = carouselContainer.querySelector('.carousel-nav.next');

            if (prevBtn && nextBtn) {
                this.prevBtnHandler = () => this.previousImage();
                this.nextBtnHandler = () => this.nextImage();

                prevBtn.addEventListener('click', this.prevBtnHandler);
                nextBtn.addEventListener('click', this.nextBtnHandler);
            }

            const indicators = carouselContainer.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, index) => {
                indicator.addEventListener('click', () => this.showImage(index));
            });

            this.keyboardHandler = (e) => {
                if (e.key === 'ArrowLeft') this.previousImage();
                if (e.key === 'ArrowRight') this.nextImage();
            };
            document.addEventListener('keydown', this.keyboardHandler);

            if (this.showThumbnails) {
                this.setupThumbnails();
            }

            this.loadTiffImages();

            this.showImage(0);
        }

        async loadTiffImages() {
            if (!this.currentLocation || !window.UTIF) return;

            const locationData = this.getLocationData(this.currentLocation);
            if (!locationData || !locationData.images) return;

            for (let i = 0; i < locationData.images.length; i++) {
                const imageData = locationData.images[i];
                const imgElement = this.currentImages[i];

                if (!imgElement) continue;

                if (imageData.type === 'tiff' || imageData.src.toLowerCase().match(/\.tiff?$/)) {
                    imgElement.style.opacity = '0.5';

                    try {
                        const processedSrc = await this.processImageSource(imageData);
                        imgElement.src = processedSrc;
                        imgElement.style.opacity = '';
                    } catch (error) {
                        console.error('Error loading TIFF:', error);
                        imgElement.src = '../public/images/placeholder.png';
                    }
                }
            }
        }

        setupThumbnails() {
            const carouselContainer = this.content.querySelector('.carousel-container');
            if (!carouselContainer) return;

            const thumbnailContainer = carouselContainer.querySelector('.carousel-thumbnails');
            if (thumbnailContainer) {
                thumbnailContainer.classList.toggle('active', this.showThumbnails);

                const thumbnails = thumbnailContainer.querySelectorAll('.carousel-thumbnail');
                thumbnails.forEach((thumb, index) => {
                    thumb.addEventListener('click', () => this.showImage(index));
                });
            }
        }

        startAutoplay() {
            if (!this.autoplayEnabled || this.currentImages.length <= 1) return;

            this.stopAutoplay();

            const progressBar = this.content.querySelector('.carousel-progress');
            if (progressBar) {
                progressBar.style.transitionDuration = `${this.autoplayDuration}ms`;
                progressBar.classList.add('active');
            }

            this.autoplayInterval = setInterval(() => {
                if (this.currentImageIndex < this.currentImages.length - 1) {
                    this.nextImage();
                } else {
                    this.showImage(0);
                }
            }, this.autoplayDuration);
        }

        stopAutoplay() {
            if (this.autoplayInterval) {
                clearInterval(this.autoplayInterval);
                this.autoplayInterval = null;
            }

            const progressBar = this.content.querySelector('.carousel-progress');
            if (progressBar) {
                progressBar.classList.remove('active');
                progressBar.style.transitionDuration = '0ms';
            }
        }

        removeCarouselListeners() {
            if (this.keyboardHandler) {
                document.removeEventListener('keydown', this.keyboardHandler);
                this.keyboardHandler = null;
            }

            const carouselContainer = this.content.querySelector('.carousel-container');
            if (carouselContainer) {
                const prevBtn = carouselContainer.querySelector('.carousel-nav.prev');
                const nextBtn = carouselContainer.querySelector('.carousel-nav.next');

                if (prevBtn && this.prevBtnHandler) {
                    prevBtn.removeEventListener('click', this.prevBtnHandler);
                }
                if (nextBtn && this.nextBtnHandler) {
                    nextBtn.removeEventListener('click', this.nextBtnHandler);
                }
            }
        }

        showImage(index) {
            if (!this.currentImages.length) return;

            if (this.autoplayEnabled) {
                this.startAutoplay();
            }

            if (this.transitionType === 'slide') {
                this.currentImages.forEach((img, i) => {
                    img.classList.remove('active', 'prev');
                    if (i < index) img.classList.add('prev');
                    else if (i === index) img.classList.add('active');
                });
            } else {
                this.currentImages.forEach((img, i) => {
                    img.classList.toggle('active', i === index);
                });
            }

            const indicators = this.content.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === index);
            });

            const thumbnails = this.content.querySelectorAll('.carousel-thumbnail');
            thumbnails.forEach((thumb, i) => {
                thumb.classList.toggle('active', i === index);
            });

            const captionElement = this.content.querySelector('.carousel-caption');
            if (captionElement) {
                const activeImage = this.currentImages[index];
                const caption = activeImage.dataset.caption || '';
                captionElement.textContent = caption;
            }

            const prevBtn = this.content.querySelector('.carousel-nav.prev');
            const nextBtn = this.content.querySelector('.carousel-nav.next');

            if (prevBtn) prevBtn.disabled = index === 0;
            if (nextBtn) nextBtn.disabled = index === this.currentImages.length - 1;

            this.currentImageIndex = index;
        }

        nextImage() {
            if (this.currentImageIndex < this.currentImages.length - 1) {
                this.showImage(this.currentImageIndex + 1);
            }
        }

        previousImage() {
            if (this.currentImageIndex > 0) {
                this.showImage(this.currentImageIndex - 1);
            }
        }

        async generatePopupFromLocation(locationId) {
            const locationData = this.getLocationData(locationId);

            if (!locationData) {
                console.warn(`No data found for location: ${locationId}`);
                this.show('Information', '<p>No information available for this location.</p>');
                return;
            }

            this.currentLocation = locationId;
            let content = '';

            if (locationData.description) {
                content += `<p>${locationData.description}</p>`;
            }

            if (locationData.images && locationData.images.length > 0) {
                content += '<div class="carousel-container">';

                content += '<div class="carousel-loading">Loading images...</div>';

                content += '<div class="carousel-image-wrapper">';

                if (locationData.images.length > 1) {
                    content += '<button class="carousel-nav prev" aria-label="Previous image"></button>';
                    content += '<button class="carousel-nav next" aria-label="Next image"></button>';
                }

                for (let i = 0; i < locationData.images.length; i++) {
                    const img = locationData.images[i];
                    const isActive = i === 0 ? 'active' : '';

                    const isTiff = img.type === 'tiff' || img.src.toLowerCase().match(/\.tiff?$/);
                    const initialSrc = isTiff ? '../public/images/placeholder.png' : img.src;

                    content += `<img class="carousel-image ${isActive}" 
                        src="${initialSrc}" 
                        alt="${img.alt || ''}"
                        data-caption="${img.caption || ''}"
                        data-index="${i}"
                        onerror="this.src='../public/images/placeholder.png'"
                        onload="this.parentElement.parentElement.querySelector('.carousel-loading').style.display='none'">`;
                }

                content += '</div>';

                if (locationData.images.length > 1) {
                    content += '<div class="carousel-indicators">';
                    for (let i = 0; i < locationData.images.length; i++) {
                        const isActive = i === 0 ? 'active' : '';
                        content += `<span class="carousel-indicator ${isActive}" data-index="${i}"></span>`;
                    }
                    content += '</div>';

                    content += '<div class="carousel-progress"></div>';
                }

                if (locationData.images.length > 1) {
                    content += '<div class="carousel-thumbnails">';
                    for (let i = 0; i < locationData.images.length; i++) {
                        const img = locationData.images[i];
                        const isActive = i === 0 ? 'active' : '';
                        content += `<div class="carousel-thumbnail ${isActive}" data-index="${i}">
                            <img src="${img.src}" alt="${img.alt || ''}">
                        </div>`;
                    }
                    content += '</div>';
                }

                content += '<div class="carousel-caption"></div>';

                content += '</div>';
            }

            if (locationData.html) {
                content += locationData.html;
            }

            if (locationData.audio) {
                content += this.generateAudioHTML(locationData);
            }

            this.show(locationData.title, content);
        }

        switchTab(tabName) {
            this.currentTab = tabName;

            // Update tab buttons
            const tabs = document.querySelectorAll('.popup-tab');
            tabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });

            // Update tab content
            const contents = document.querySelectorAll('.popup-tab-content');
            contents.forEach(content => {
                content.classList.toggle('active', content.dataset.tab === tabName);
            });
        }

        showLoadingPopup() {
            this.loadingPopupActive = true;

            const loadingContent = `
                    <div class="popup-tabs">
                        <button class="popup-tab active" data-tab="instructions" onclick="PopupManager.switchTab('instructions')">
                            Instructions
                        </button>
                        <button class="popup-tab" data-tab="history" onclick="PopupManager.switchTab('history')">
                            History
                        </button>
                        <button class="popup-tab" data-tab="credits" onclick="PopupManager.switchTab('credits')">
                            Credits
                        </button>
                    </div>
                    
                    <div class="loading-progress">
                        <div>Loading Virtual Fairgrounds Model...</div>
                        <div class="loading-bar">
                            <div class="loading-bar-fill" id="loading-bar-fill"></div>
                        </div>
                        <div class="loading-percentage" id="loading-percentage">0%</div>
                    </div>
                    
                    <div class="popup-tab-content active" data-tab="instructions">
                        <h3>How to Navigate the Virtual Fairgrounds</h3>
                        <p><strong>Movement Controls:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li><strong>W, A, S, D</strong> or <strong>Arrow Keys</strong> - Move forward, left, backward, and right</li>
                            <li><strong>Mouse</strong> - Look around and change your view direction</li>
                            <li><strong>Q & E</strong> - Rotate camera when in GUI mode</li>
                            <li><strong>F</strong> - Interact with locations when you see the prompt</li>
                            <li><strong>ESC</strong> - Pause and show menu</li>
                            <li><strong>M</strong> - Toggle monochromatic mode</li>
                            <li><strong>Middle Mouse Button</strong> - Toggle GUI mode for settings</li>
                        </ul>
                        
                        <p><strong>Exploration Tips:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li>Look for the green interaction prompts near historic buildings</li>
                            <li>Stay within the green boundary markers</li>
                            <li>Visit the East Side Theater ticket booth to learn more about the neighborhood</li>
                            <li>Each location has historical photos and audio recordings to discover</li>
                        </ul>
                    </div>
                    
                    <div class="popup-tab-content" data-tab="history">
                        <h3>The Fairgrounds Neighborhood (1955)</h3>
                        <p>Welcome to a digital recreation of Oklahoma City's historic Fairgrounds District, a vibrant African American community that thrived in the mid-20th century.</p>
                        
                        <p><strong>About the Neighborhood:</strong></p>
                        <p>The Fairgrounds neighborhood, also known as part of Deep Deuce, was bounded by NE 8th Street to the north and the Rock Island railroad tracks to the south. This densely populated area was home to a thriving Black community, with Bath Avenue serving as its commercial heart.</p>
                        
                        <p><strong>Key Locations You'll Explore:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li><strong>East Side Theater (720-722 Bath Avenue)</strong> - The crown jewel of the district, opened in 1946</li>
                            <li><strong>Bill's Cleaners (718 Bath)</strong> - A long-running business that operated until 1973</li>
                            <li><strong>Domino Parlor (714 Bath)</strong> - A popular social gathering spot for men</li>
                            <li><strong>Melody Records (710B Bath)</strong> - The heart of the local music scene</li>
                        </ul>
                        
                        <p><strong>Urban Renewal Impact:</strong></p>
                        <p>This virtual preservation captures the neighborhood before urban renewal programs of the 1960s-70s led to widespread demolition. Today, this 3D environment serves as a bridge between past and present, preserving the memories and stories of a community that was physically erased but lives on in the hearts of those who remember.</p>
                    </div>
                    
                    <div class="popup-tab-content" data-tab="credits">
                        <h3>Virtual Fairgrounds Project Credits</h3>
                        
                        <p><strong>A Collaboration Between:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li>Metropolitan Library System</li>
                            <li>Drone's Eye View (DEV) Limited</li>
                        </ul>
                        
                        <p><strong>Project Team:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li><strong>Bobby Reed</strong> - Lead Developer & Technical Director</li>
                            <li><strong>Judith Matthews</strong> - Project Visionary & Historical Consultant</li>
                            <li><strong>Metropolitan Library System Special Collections</strong> - Archival Materials</li>
                        </ul>
                        
                        <p><strong>Special Thanks To:</strong></p>
                        <p>Sandra Richards, JW Sanford and family, Avis Franklin, Melba Holt, Kimberly Francisco, Kasey Jones-Matrona, George Melvin Richardson and family, Eloise Carbajal, Hobert Sutton, Huretta Walker Dobbs, Anita Arnold, Melva Franklin, and all the families, business owners, and patrons of the Fairgrounds Neighborhood.</p>
                        
                        <p><strong>Student Contributors:</strong></p>
                        <ul style="line-height: 1.8;">
                            <li><strong>xDarthx</strong> - Summer 2025 Intern</li>
                            <li>Oklahoma City University Software Engineering Students</li>
                        </ul>
                        
                        <p><strong>Technical Framework:</strong></p>
                        <p>Built with Three.js, WebGL, and modern web technologies to ensure preservation and accessibility for future generations.</p>
                        
                        <p style="margin-top: 20px; font-style: italic; text-align: center;">
                            "Preserving Oklahoma City's cultural heritage through immersive technology"
                        </p>
                    </div>
                `;

            // Modify the overlay to add loading-popup class
            this.overlay.classList.add('loading-popup');

            // Don't allow closing during loading
            const originalCloseBtn = document.getElementById('popup-close-btn');
            if (originalCloseBtn) {
                originalCloseBtn.style.display = 'none';
            }

            // Update header for loading popup
            this.show('Virtual Fairgrounds', loadingContent);

            // Add subtitle to header
            const header = document.querySelector('.popup-header');
            if (header && !header.querySelector('.popup-subtitle')) {
                const subtitle = document.createElement('p');
                subtitle.className = 'popup-subtitle';
                subtitle.textContent = 'Preserving Oklahoma City\'s Historic Fairgrounds Neighborhood';
                header.appendChild(subtitle);
            }
        }

        // Add this method to update loading progress
        updateLoadingProgress(percentage) {
            const fillBar = document.getElementById('loading-bar-fill');
            const percentText = document.getElementById('loading-percentage');

            if (fillBar) {
                fillBar.style.width = percentage + '%';
            }
            if (percentText) {
                percentText.textContent = percentage + '%';
            }
        }

        // Add this method to hide loading popup
        hideLoadingPopup() {
            this.loadingPopupActive = false;
            this.overlay.classList.remove('loading-popup');

            // Restore close button
            const closeBtn = document.getElementById('popup-close-btn');
            if (closeBtn) {
                closeBtn.style.display = '';
            }

            this.hide();
        }
    };

export const popupManager = new PopupManager();

