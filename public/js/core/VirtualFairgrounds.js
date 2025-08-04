import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { MovementController } from '../controls/MovementController.js';
import { GUIModeHandler } from '../controls/GUIModeHandler.js';
import { InteractionController } from '../controls/InteractionController.js';
import { MaterialModeManager } from '../managers/MaterialManager.js';
import { AdvancedCullingLODManager, setupOptimizedTextureSystem } from '../managers/LODManager.js';
import { popupManager as PopupManager } from '../managers/PopupManager.js';
import { PopupCircle } from '../utils/PopupCircle.js';
import { setupCameraBoundaries } from '../utils/BoundaryBox.js';
import { MinMaxGUIHelper, ColorGUIHelper, FogGUIHelper } from '../utils/GUIHelpers.js';
import { setupCustomFogShaders, createShaderModifier } from '../shaders/FogShaderSetup.js';
import { CAMERA_CONFIG, MOVEMENT, FOG_CONFIG, BOUNDARIES, MODEL_URL } from '../config/constants.js';
import { INTERACTION_ZONES } from '../config/locations.js';

/**
 * Main application class for Virtual Fairgrounds
 */
export class VirtualFairgrounds {
    constructor() {
        // Core Three.js components
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        
        // Managers
        this.sceneManager = null;
        this.assetLoader = null;
        this.cullingLODManager = null;
        this.materialModeManager = null;
        this.movementController = null;
        this.guiModeHandler = null;
        this.interactionController = null;
        
        // GUI
        this.gui = null;
        
        // State
        this.isInitialized = false;
        this.instructionsActive = true;
        
        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
        this.totalTime = 0;
        
        // Interaction zones
        this.interactionZones = {};
        
        // Initialize the application
        this.init();
    }
    
    async init() {
        try {
            // Setup custom fog shaders first
            setupCustomFogShaders();
            
            // Initialize popup manager
            await PopupManager.init();
            PopupManager.showLoadingPopup();
            
            // Setup renderer
            this.setupRenderer();
            
            // Setup scene
            this.sceneManager = new SceneManager();
            
            // Setup camera
            this.setupCamera();
            
            // Setup controls
            this.setupControls();
            
            // Setup managers
            this.setupManagers();
            
            // Setup GUI
            this.setupGUI();
            
            // Setup interaction zones
            this.setupInteractionZones();
            
            // Load assets
            await this.loadAssets();
            
            // Setup boundaries after model loads
            this.setupBoundaries();
            
            // Hide loading popup
            PopupManager.hideLoadingPopup();
            
            // Show instructions
            this.showInstructions();
            
            // Start render loop
            this.animate();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Failed to initialize Virtual Fairgrounds:', error);
            this.handleInitError(error);
        }
    }
    
    setupRenderer() {
        const canvas = document.querySelector('#c');
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            canvas 
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            CAMERA_CONFIG.FOV,
            window.innerWidth / window.innerHeight,
            CAMERA_CONFIG.NEAR,
            CAMERA_CONFIG.FAR
        );
        this.camera.position.set(
            CAMERA_CONFIG.INITIAL_POSITION.x,
            CAMERA_CONFIG.INITIAL_POSITION.y,
            CAMERA_CONFIG.INITIAL_POSITION.z
        );
    }
    
    setupControls() {
        const canvas = this.renderer.domElement;
        
        // Pointer lock controls
        this.controls = new PointerLockControls(this.camera, canvas);
        this.controls.maxPolarAngle = (120 * Math.PI) / 180;
        this.controls.minPolarAngle = (60 * Math.PI) / 180;
        
        // Setup control event listeners
        this.setupControlListeners();
    }
    
    setupControlListeners() {
        const blocker = document.getElementById('blocker');
        const instructions = document.getElementById('instructions');
        
        // Click to start
        instructions.addEventListener('click', () => {
            if (!this.guiModeHandler.getIsGUIMode() && !PopupManager.popUpActive) {
                this.controls.lock();
                this.instructionsActive = false;
                instructions.style.display = 'none';
                blocker.style.display = 'none';
            }
        });
        
        // Lock/unlock events
        this.controls.addEventListener('lock', () => {
            console.log('Controls locked');
        });
        
        this.controls.addEventListener('unlock', () => {
            console.log('Controls unlocked');
            if (!this.guiModeHandler.getIsGUIMode() && !PopupManager.popUpActive) {
                this.instructionsActive = true;
                instructions.style.display = '';
                blocker.style.display = '';
                document.getElementById('interactionBlocker').style.display = 'none';
                document.getElementById('interactDesc').style.display = 'none';
            }
        });
        
        // Popup close listeners
        document.getElementById('popup').addEventListener('click', (e) => {
            if (e.target === e.currentTarget && !PopupManager.loadingPopupActive) {
                this.closePopup();
            }
        });
        
        document.getElementById('popup-close-btn').addEventListener('click', (e) => {
            if (!PopupManager.loadingPopupActive) {
                this.closePopup();
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupManagers() {
        const canvas = this.renderer.domElement;
        
        // Material manager
        this.materialModeManager = new MaterialModeManager();
        
        // LOD/Culling manager
        this.cullingLODManager = new AdvancedCullingLODManager(this.camera, this.renderer);
        const shaderModifier = createShaderModifier(this.cullingLODManager);
        this.materialModeManager.setShaderModifier(shaderModifier);
        
        // Movement controller
        this.movementController = new MovementController(this.camera, this.controls);
        
        // GUI mode handler
        this.guiModeHandler = new GUIModeHandler(this.controls, canvas);
        
        // Asset loader
        this.assetLoader = new AssetLoader();
    }
    
    setupGUI() {
        this.gui = new GUI({ title: 'Settings' });
        this.gui.close();
        
        // Camera controls
        this.setupCameraGUI();
        
        // Light controls
        this.setupLightingGUI();
        
        // Fog controls
        this.setupFogGUI();
        
        // Skybox controls (move this here from loadAssets)
        // We'll set it up but populate it after loading
        this.skyBoxFolder = this.gui.addFolder('SkyBox');
        
        // Visualization controls
        this.setupVisualizationGUI();
        
        // Carousel controls - ADD THIS
        this.setupCarouselGUI();
        
        // Performance controls - ADD THIS
        this.setupPerformanceGUI();
        
        // Debug controls
        this.setupDebugGUI();
        
        // Popup circles controls - ADD THIS
        this.setupPopupCirclesGUI();
        
        // Update GUI visibility
        this.guiModeHandler.updateGUIVisibility();
    }

    setupCarouselGUI() {
    const carouselFolder = this.gui.addFolder('Carousel Controls');
    
    const carouselSettings = {
        autoplay: false,
        autoplayDuration: 3,
        showThumbnails: false,
        transitionType: 'fade',
        
        toggleAutoplay: function() {
            PopupManager.autoplayEnabled = this.autoplay;
            if (PopupManager.popUpActive) {
                if (this.autoplay) {
                    PopupManager.startAutoplay();
                } else {
                    PopupManager.stopAutoplay();
                }
            }
        },
        
        updateAutoplaySpeed: function() {
            PopupManager.autoplayDuration = this.autoplayDuration * 1000;
            if (PopupManager.autoplayEnabled && PopupManager.popUpActive) {
                PopupManager.startAutoplay();
            }
        },
        
        toggleThumbnails: function() {
            PopupManager.showThumbnails = this.showThumbnails;
            if (PopupManager.popUpActive) {
                PopupManager.setupThumbnails();
            }
        },
        
        updateTransition: function() {
            PopupManager.transitionType = this.transitionType;
            const container = document.querySelector('.carousel-container');
            if (container) {
                container.classList.toggle('slide-transition', this.transitionType === 'slide');
            }
        },
        
        reloadManifest: async function() {
            await PopupManager.init();
            console.log('Image manifest reloaded');
            alert('Image manifest reloaded successfully!');
        },
        
        checkTiffSupport: function() {
            if (window.UTIF) {
                console.log('✅ TIFF support is loaded');
                alert('TIFF support is available!');
            } else {
                console.log('❌ TIFF support not found');
                alert('TIFF support not loaded. Please add UTIF.js script to your HTML.');
            }
        }
    };
    
    carouselFolder.add(carouselSettings, 'autoplay')
        .name('Enable Autoplay')
        .onChange(() => carouselSettings.toggleAutoplay());
    
    carouselFolder.add(carouselSettings, 'autoplayDuration', 1, 10, 0.5)
        .name('Autoplay Speed (sec)')
        .onChange(() => carouselSettings.updateAutoplaySpeed());
    
    carouselFolder.add(carouselSettings, 'showThumbnails')
        .name('Show Thumbnails')
        .onChange(() => carouselSettings.toggleThumbnails());
    
    carouselFolder.add(carouselSettings, 'transitionType', ['fade', 'slide'])
        .name('Transition Type')
        .onChange(() => carouselSettings.updateTransition());
    
    carouselFolder.add(carouselSettings, 'reloadManifest').name('Reload Images');
    carouselFolder.add(carouselSettings, 'checkTiffSupport').name('Check TIFF Support');
}

setupPerformanceGUI() {
        const optimizationFolder = this.gui.addFolder('Performance Optimization');
        
        const lodControls = {
            lodDistances: { high: 40, medium: 100, low: 150, cull: 200 },
            enableCulling: true,
            enableLOD: true
        };
        
        // You can add LOD distance controls here if needed
        optimizationFolder.add(lodControls, 'enableCulling').name('Enable Culling');
        optimizationFolder.add(lodControls, 'enableLOD').name('Enable LOD');
    }

setupPopupCirclesGUI() {
    const popCirclesGUI = this.gui.addFolder('Popup Circles');
    
    // Create subfolders for each zone
    Object.entries(INTERACTION_ZONES).forEach(([key, config]) => {
        const zoneFolder = popCirclesGUI.addFolder(`${key.charAt(0).toUpperCase() + key.slice(1)} Circle`);
        const zone = this.interactionZones[key];
        
        zoneFolder.add(zone.position, 'x', -80, 50, 0.1).onChange((value) => {
            if (zone.circleObject) {
                zone.circleObject.position.x = value;
            }
        });
        
        zoneFolder.add(zone.position, 'z', -100, 100, 0.1).onChange((value) => {
            if (zone.circleObject) {
                zone.circleObject.position.z = value;
            }
        });
    });
}
    
    setupCameraGUI() {
        const cameraFolder = this.gui.addFolder('Camera');
        
        // FOV control
        cameraFolder.add(this.camera, 'fov', 1, 180).onChange(() => {
            this.camera.updateProjectionMatrix();
        });
        
        // Near/Far controls
        const minMaxHelper = new MinMaxGUIHelper(this.camera, 'near', 'far', 0.1);
        cameraFolder.add(minMaxHelper, 'min', 0.1, 50, 0.1).name('near');
        cameraFolder.add(minMaxHelper, 'max', 0.1, 650, 0.1).name('far');
        
        // Reset button
        cameraFolder.add({
            reset_position: () => {
                this.camera.position.set(
                    CAMERA_CONFIG.INITIAL_POSITION.x,
                    CAMERA_CONFIG.INITIAL_POSITION.y,
                    CAMERA_CONFIG.INITIAL_POSITION.z
                );
            }
        }, 'reset_position');
    }
    
    setupLightingGUI() {
        const lights = this.sceneManager.getLights();
        const lightFolder = this.gui.addFolder('Light');
        
        lightFolder.addColor(new ColorGUIHelper(lights.directional, 'color'), 'value').name('color');
        lightFolder.add(lights.directional, 'intensity', 0, 10, 0.01);
    }
    
    setupFogGUI() {
        const fogFolder = this.gui.addFolder('Fog');
        const fogHelper = new FogGUIHelper(this.sceneManager.scene.fog, this.camera);
        
        fogFolder.add(fogHelper, 'density', 0, 0.05, 0.0001);
        fogFolder.addColor(fogHelper, 'color');
    }
    
    setupVisualizationGUI() {
        const visualizationFolder = this.gui.addFolder('Visualization Modes');
        
        const visualizationSettings = {
            monochromaticMode: true,
            brightness: 0.95,
            
            toggleMonochromatic: () => {
                this.materialModeManager.toggleMonochromatic(this.sceneManager.scene);
                this.updateLightingForMode();
            },
            
            adjustBrightness: function() {
                if (this.materialModeManager.isMonochromatic && 
                    this.materialModeManager.monochromaticMaterial) {
                    const brightness = this.brightness;
                    const baseColor = 0.5 + (brightness * 0.5);
                    this.materialModeManager.monochromaticMaterial.color.setRGB(
                        baseColor, baseColor, baseColor
                    );
                }
            }.bind(this)
        };
        
        visualizationFolder.add(visualizationSettings, 'monochromaticMode')
            .name('Monochromatic Mode')
            .onChange(() => visualizationSettings.toggleMonochromatic());
            
        visualizationFolder.add(visualizationSettings, 'brightness', 0.5, 1.0, 0.05)
            .name('Brightness')
            .onChange(() => visualizationSettings.adjustBrightness());
    }
    
    setupDebugGUI() {
        const debugFolder = this.gui.addFolder('Debug Visuals');
        
        const debugSettings = {
            showBoundaryBox: false,
            showPopupCircles: false,
            
            toggleBoundaryBox: () => {
                if (debugSettings.showBoundaryBox && this.cameraBoundarySystem) {
                    this.cameraBoundarySystem.createVisualization(this.sceneManager.scene);
                } else if (this.cameraBoundarySystem?.boundaryBox) {
                    this.sceneManager.scene.remove(this.cameraBoundarySystem.boundaryBox);
                }
            },
            
            togglePopupCircles: () => {
                Object.values(this.interactionZones).forEach(zone => {
                    if (debugSettings.showPopupCircles) {
                        zone.createSphereRadius(this.sceneManager.scene);
                    } else if (zone.circleObject) {
                        this.sceneManager.scene.remove(zone.circleObject);
                    }
                });
            }
        };
        
        debugFolder.add(debugSettings, 'showBoundaryBox')
            .name('Show Boundary Box')
            .onChange(() => debugSettings.toggleBoundaryBox());
            
        debugFolder.add(debugSettings, 'showPopupCircles')
            .name('Show Popup Circles')
            .onChange(() => debugSettings.togglePopupCircles());
    }
    
    setupInteractionZones() {
        // Create interaction zones from config
        Object.entries(INTERACTION_ZONES).forEach(([key, config]) => {
            this.interactionZones[key] = new PopupCircle(
                config.position.x,
                config.position.y,
                config.position.z,
                config.radius
            );
        });
        
        // Setup interaction controller
        this.interactionController = new InteractionController(
            this.interactionZones,
            PopupManager,
            this.controls
        );
    }

    setupVisualizationGUI() {
    const visualizationFolder = this.gui.addFolder('Visualization Modes');
    
    // Store settings on the instance
    this.visualizationSettings = {
        monochromaticMode: true,  // Start as true
        brightness: 0.95,
        
        toggleMonochromatic: () => {
            this.materialModeManager.toggleMonochromatic(this.sceneManager.scene);
            this.updateLightingForMode();
            
            // Update LOD materials if they exist
            if (this.cullingLODManager) {
                this.updateLODMaterials();
            }
        },
        
        adjustBrightness: () => {
            if (this.materialModeManager.isMonochromatic && 
                this.materialModeManager.monochromaticMaterial) {
                const brightness = this.visualizationSettings.brightness;
                const baseColor = 0.5 + (brightness * 0.5);
                this.materialModeManager.monochromaticMaterial.color.setRGB(
                    baseColor, baseColor, baseColor
                );
            }
        }
    };
    
    visualizationFolder.add(this.visualizationSettings, 'monochromaticMode')
        .name('Monochromatic Mode')
        .onChange(() => this.visualizationSettings.toggleMonochromatic());
        
    visualizationFolder.add(this.visualizationSettings, 'brightness', 0.5, 1.0, 0.05)
        .name('Brightness')
        .onChange(() => this.visualizationSettings.adjustBrightness());
}
    
    async loadAssets() {
        try {
            // Load skybox textures
            const skyboxTextures = this.assetLoader.loadSkyboxTextures();
            
            // Setup initial skybox
            const initialSkybox = await this.assetLoader.loadSkyboxTexture(
                '../public/skybox/oklahoma_sunset.png'
            );
            this.sceneManager.setupSkybox(initialSkybox);
            
            // Setup skybox GUI after loading
            this.setupSkyboxGUI(skyboxTextures);
            
            // Load main model
            const model = await this.assetLoader.loadMainModel(
                (progress) => PopupManager.updateLoadingProgress(progress),
                (model) => {
                    // Process the loaded model
                    this.processLoadedModel(model);
                },
                (error) => {
                    console.error('Model loading error:', error);
                    this.handleLoadError(error);
                }
            );
            
        } catch (error) {
            console.error('Asset loading failed:', error);
            this.handleLoadError(error);
        }
    }
    
    processLoadedModel(model) {
        // Setup texture optimization
        const updateTextureQuality = setupOptimizedTextureSystem(
            model, 
            this.sceneManager.scene, 
            this.camera
        );
        window.updateTextureQuality = updateTextureQuality;
        
        // Inject LOD system
        this.cullingLODManager.injectIntoGLTFScene(model, {
            lodDistances: { high: 40, medium: 100, low: 150, cull: 200 }
        });
        
        // Add to scene
        this.sceneManager.scene.add(model);
        
        // Apply monochromatic mode if enabled
        if (this.visualizationSettings && this.visualizationSettings.monochromaticMode) {
        setTimeout(() => {
            this.visualizationSettings.toggleMonochromatic();
        }, 100);
    }
    }

    updateLODMaterials() {
    this.cullingLODManager.objectCache.forEach((lodData) => {
        const meshes = lodData.meshes;
        for (const level in meshes) {
            if (meshes[level]) {
                this.materialModeManager.storeMaterialsFromMesh(meshes[level]);
                
                const materialData = this.materialModeManager.originalMaterials.get(meshes[level].uuid);
                if (materialData) {
                    if (this.materialModeManager.isMonochromatic) {
                        meshes[level].material = materialData.isArray
                            ? new Array(materialData.materials.length).fill(this.materialModeManager.monochromaticMaterial)
                            : this.materialModeManager.monochromaticMaterial;
                    } else {
                        meshes[level].material = materialData.isArray
                            ? materialData.materials
                            : materialData.materials[0];
                    }
                }
            }
        }
    });
}
    
    setupSkyboxGUI(skyboxTextures) {
        const skyBoxFolder = this.gui.addFolder('SkyBox');
        
        const skyboxController = {
            currentSkybox: 'okcSunset',
            
            changeSkyBox: (textureName) => {
                const texture = skyboxTextures[textureName];
                if (texture) {
                    this.sceneManager.updateSkyboxTexture(texture);
                }
            },
            
            uploadSkybox: () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const texture = await this.assetLoader.loadSkyboxFromFile(file);
                        this.sceneManager.updateSkyboxTexture(texture);
                    }
                };
                input.click();
            }
        };
        
        skyBoxFolder.add(skyboxController, 'currentSkybox', 
            ['okcSunset', 'blueSky', 'nightSky', 'pinkSky'])
            .name('Select Skybox')
            .onChange((value) => skyboxController.changeSkyBox(value));
            
        skyBoxFolder.add(skyboxController, 'uploadSkybox').name('Upload Skybox');
    }
    
    setupBoundaries() {
        this.cameraBoundarySystem = setupCameraBoundaries(
            this.sceneManager.scene,
            this.camera,
            this.controls
        );
        
        // Add boundary GUI controls
        const boundaryFolder = this.gui.addFolder('Camera Boundaries');
        
        boundaryFolder.add(this.cameraBoundarySystem.min, 'x', -150, 0).name('Min X');
        boundaryFolder.add(this.cameraBoundarySystem.max, 'x', -100, 0).name('Max X');
        boundaryFolder.add(this.cameraBoundarySystem.min, 'z', -150, 0).name('Min Z');
        boundaryFolder.add(this.cameraBoundarySystem.max, 'z', 0, 150).name('Max Z');
    }
    
    updateLightingForMode() {
        const lights = this.sceneManager.getLights();
        
        if (this.materialModeManager.isMonochromatic) {
            lights.hemisphere.intensity = 3.5;
            lights.directional.intensity = 2.5;
            this.sceneManager.setFogDensity(0.003);
        } else {
            lights.hemisphere.intensity = 2;
            lights.directional.intensity = 5;
            this.sceneManager.setFogDensity(0.005);
        }
    }
    
    showInstructions() {
        const blocker = document.getElementById('blocker');
        const instructions = document.getElementById('instructions');
        
        blocker.style.display = '';
        instructions.style.display = '';
    }
    
    closePopup() {
        setTimeout(() => {
            PopupManager.hide();
        }, 300);
        PopupManager.popUpActive = false;
        this.controls.lock();
    }
    
    handleInitError(error) {
        const progressDiv = document.querySelector('.loading-progress');
        if (progressDiv) {
            progressDiv.innerHTML = '<div style="color: #d32f2f;">Error initializing application. Please refresh the page.</div>';
        }
    }
    
    handleLoadError(error) {
        const progressDiv = document.querySelector('.loading-progress');
        if (progressDiv) {
            progressDiv.innerHTML = '<div style="color: #d32f2f;">Error loading model. Please check your connection and refresh.</div>';
        }
        this.assetLoader.dispose();
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    checkInteractions() {
        if (!this.controls.isLocked || this.guiModeHandler.getIsGUIMode()) return;
        
        // Check all interaction zones
        let anyInside = false;
        Object.values(this.interactionZones).forEach(zone => {
            zone.checkForIntersection(this.camera);
            if (zone.cameraInside) anyInside = true;
        });
        
        // Update interaction UI
        const interactionBlocker = document.getElementById('interactionBlocker');
        const interactDesc = document.getElementById('interactDesc');
        
        if (anyInside) {
            interactionBlocker.style.display = 'block';
            interactDesc.style.display = 'flex';
        } else if (interactionBlocker.style.display === 'block') {
            interactionBlocker.style.display = 'none';
            interactDesc.style.display = 'none';
        }
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const delta = this.clock.getDelta();
        this.totalTime += delta;
        
        // Skip if controls aren't ready
        if (!this.controls.isLocked && !this.guiModeHandler.getIsGUIMode()) {
            this.movementController.resetMovementState();
            this.render();
            return;
        }
        
        // Update fog time
        this.cullingLODManager.updateFogTimeUniforms(this.totalTime);
        
        // Check interactions
        this.checkInteractions();
        
        // Update movement
        if ((this.controls.isLocked || this.guiModeHandler.getIsGUIMode()) && 
            !PopupManager.popUpActive && 
            !this.guiModeHandler.getGuiFocused()) {
            this.movementController.update(delta, this.guiModeHandler.getIsGUIMode());
        }
        
        // Update LOD system
        if (this.cullingLODManager) {
            this.cullingLODManager.update();
        }
        
        // Update texture quality periodically
        if (this.totalTime % 3 < delta && window.updateTextureQuality) {
            try {
                window.updateTextureQuality();
            } catch (error) {
                console.warn('Error updating texture quality:', error);
            }
        }
        
        // Render the scene
        this.render();
    }
    
    render() {
        // Resize if needed
        const canvas = this.renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width = canvas.clientWidth * pixelRatio | 0;
        const height = canvas.clientHeight * pixelRatio | 0;
        
        if (canvas.width !== width || canvas.height !== height) {
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        
        // Render the scene
        this.renderer.render(this.sceneManager.scene, this.camera);
    }
    
    dispose() {
        // Cancel animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Dispose of resources
        this.assetLoader?.dispose();
        this.cullingLODManager?.dispose();
        
        // Dispose of renderer
        this.renderer?.dispose();
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
    }
}