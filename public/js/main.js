import * as THREE from 'three';
import { 
    AdvancedCullingLODManager, 
    SafeTextureLODManager, 
    setupOptimizedTextureSystem,
    isFogCompatibleMaterial 
} from './managers/LODManager.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Euler } from 'three';
import { BoundaryBox, setupCameraBoundaries } from './utils/BoundaryBox.js';
import { PopupCircle } from './utils/PopupCircle.js';
import { MinMaxGUIHelper, ColorGUIHelper, FogGUIHelper } from './utils/GUIHelpers.js';
import { CAMERA_CONFIG, MOVEMENT, FOG_CONFIG, BOUNDARIES, MODEL_URL } from './config/constants.js';
import { INTERACTION_ZONES } from './config/locations.js';
import { setupCustomFogShaders, createShaderModifier } from './shaders/FogShaderSetup.js';
import { popupManager as PopupManager } from './managers/PopupManager.js';
import { MaterialModeManager } from './managers/MaterialManager.js';

function main() {
    setupCustomFogShaders();

    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    const baseURL = 'https://storage.googleapis.com/fairgrounds-model/';

    const guiModeHandler = new GUIModeHandler(controls, canvas);

    let skyBoxTextures;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    let rotateLeft = false;
    let rotateRight = false;

    let cameraEuler = new Euler(0, 0, 0, 'YXZ');

    PopupManager.init().catch(console.error);

    PopupManager.showLoadingPopup();

    const materialModeManager = new MaterialModeManager();

    const testAudio = new Audio('../public/audio/eastsideTheatre1.mp3');
    testAudio.addEventListener('canplay', () => console.log('File is playable'));
    testAudio.addEventListener('error', (e) => console.error('File error:', e));

    let cameraBoundarySystem;
    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // Loading UI setup
    // const loadingDiv = document.createElement('div');
    // loadingDiv.style.position = 'absolute';
    // loadingDiv.style.top = '50%';
    // loadingDiv.style.left = '50%';
    // loadingDiv.style.transform = 'translate(-50%, -50%)';
    // loadingDiv.style.padding = '20px';
    // loadingDiv.style.background = 'rgba(0,0,0,0.7)';
    // loadingDiv.style.color = 'white';
    // loadingDiv.style.borderRadius = '5px';
    // loadingDiv.style.zIndex = '1000';
    // loadingDiv.textContent = 'Loading model (0%)...';
    // document.body.appendChild(loadingDiv);
    PopupManager.showLoadingPopup();

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');
    let instructionsActive = true;

    // Camera setup
    const fov = 55;
    const aspect = 2;
    const near = 0.1;
    const far = 650;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(-53.35, 32, 4.64);

    const scene = new THREE.Scene();
    const gui = new GUI({ title: 'Settings' });
    gui.close();

    const debugFolder = gui.addFolder('Debug Visuals');
    const debugSettings = {
        showBoundaryBox: false,
        showPopupCircles: false,

        toggleBoundaryBox: function () {
            if (this.showBoundaryBox) {
                cameraBoundarySystem.createVisualization(scene);
            } else {
                if (cameraBoundarySystem.boundaryBox) {
                    scene.remove(cameraBoundarySystem.boundaryBox);
                }
            }
        },

        togglePopupCircles: function () {
            if (this.showPopupCircles) {
                theaterSphere.createSphereRadius(scene);
                cleanersSphere.createSphereRadius(scene);
                dominosSphere.createSphereRadius(scene);
                recordsSphere.createSphereRadius(scene);
            } else {
                scene.remove(theaterSphere.circleObject);
                scene.remove(cleanersSphere.circleObject);
                scene.remove(dominosSphere.circleObject);
                scene.remove(recordsSphere.circleObject);
            }
        }
    };

    debugFolder.add(debugSettings, 'showBoundaryBox')
        .name('Show Boundary Box')
        .onChange(() => debugSettings.toggleBoundaryBox());

    debugFolder.add(debugSettings, 'showPopupCircles')
        .name('Show Popup Circles')
        .onChange(() => debugSettings.togglePopupCircles());


    const visualizationFolder = gui.addFolder('Visualization Modes');
    const visualizationSettings = {
        monochromaticMode: true,
        brightness: 0.95,

        toggleMonochromatic() {
            materialModeManager.toggleMonochromatic(scene);

            // Adjust lighting for monochromatic mode
            if (materialModeManager.isMonochromatic) {
                scene.children.forEach(child => {
                    if (child.isHemisphereLight) {
                        child.intensity = 3.5;
                    } else if (child.isDirectionalLight) {
                        child.intensity = 2.5;
                    }
                });
                scene.fog.density = 0.003;
            } else {
                scene.children.forEach(child => {
                    if (child.isHemisphereLight) {
                        child.intensity = 2;
                    } else if (child.isDirectionalLight) {
                        child.intensity = 5;
                    }
                });
                scene.fog.density = 0.005;
            }

            // Update LOD materials if they exist
            if (window.cullingLODManager) {
                window.cullingLODManager.objectCache.forEach((lodData) => {
                    const meshes = lodData.meshes;
                    for (const level in meshes) {
                        if (meshes[level]) {
                            materialModeManager.storeMaterialsFromMesh(meshes[level]);

                            const materialData = materialModeManager.originalMaterials.get(meshes[level].uuid);
                            if (materialData) {
                                if (materialModeManager.isMonochromatic) {
                                    meshes[level].material = materialData.isArray
                                        ? new Array(materialData.materials.length).fill(materialModeManager.monochromaticMaterial)
                                        : materialModeManager.monochromaticMaterial;
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
        },

        adjustBrightness: function () {
            if (materialModeManager.isMonochromatic && materialModeManager.monochromaticMaterial) {
                const brightness = this.brightness;
                const baseColor = 0.5 + (brightness * 0.5);
                materialModeManager.monochromaticMaterial.color.setRGB(baseColor, baseColor, baseColor);
            }
        }
    };

    visualizationFolder.add(visualizationSettings, 'monochromaticMode')
        .name('Monochromatic Mode')
        .onChange(() => visualizationSettings.toggleMonochromatic());

    visualizationFolder.add(visualizationSettings, 'brightness', 0.5, 1.0, 0.05)
        .name('Brightness')
        .onChange(() => visualizationSettings.adjustBrightness());


    setupCarouselGUI(gui);

    // Initialize popup manager
    PopupManager.init().catch(console.error);

    // GUI Controls for the carousel (place this INSIDE main() after PopupManager)
    function setupCarouselGUI(gui) {
        const carouselFolder = gui.addFolder('Carousel Controls');

        const carouselSettings = {
            autoplay: false,
            autoplayDuration: 3,
            showThumbnails: false,
            transitionType: 'fade',

            toggleAutoplay: function () {
                PopupManager.autoplayEnabled = this.autoplay;
                if (PopupManager.popUpActive) {
                    if (this.autoplay) {
                        PopupManager.startAutoplay();
                    } else {
                        PopupManager.stopAutoplay();
                    }
                }
            },

            updateAutoplaySpeed: function () {
                PopupManager.autoplayDuration = this.autoplayDuration * 1000;
                if (PopupManager.autoplayEnabled && PopupManager.popUpActive) {
                    PopupManager.startAutoplay();
                }
            },

            toggleThumbnails: function () {
                PopupManager.showThumbnails = this.showThumbnails;
                if (PopupManager.popUpActive) {
                    PopupManager.setupThumbnails();
                }
            },

            updateTransition: function () {
                PopupManager.transitionType = this.transitionType;
                const container = document.querySelector('.carousel-container');
                if (container) {
                    container.classList.toggle('slide-transition', this.transitionType === 'slide');
                }
            },

            reloadManifest: async function () {
                await PopupManager.init();
                console.log('Image manifest reloaded');
                alert('Image manifest reloaded successfully!');
            },

            checkTiffSupport: function () {
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

        //carouselFolder.open();
    }

    // Close popup function (if not already defined)
    function closePopup() {
        setTimeout(() => {
            PopupManager.hide();
        }, 300);
        PopupManager.popUpActive = false;
    }

    function setupOptimizedRendering(scene, camera, renderer) {
        // Create the culling/LOD manager
        const cullingLODManager = new AdvancedCullingLODManager(camera, renderer);

        // Store reference globally so we can use it after model loads
        window.cullingLODManager = cullingLODManager;

        return cullingLODManager;
    }

    // Camera GUI controls
    const cameraResetButton = {
        reset_position: function () {
            camera.position.set(-53.35, 32, 4.64);
        }
    };
    const cameraFolder = gui.addFolder('Camera');
    cameraFolder.add(camera, 'fov', 1, 180).onChange(() => {
        camera.updateProjectionMatrix();
    });
    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    cameraFolder.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near');
    cameraFolder.add(minMaxGUIHelper, 'max', 0.1, 650, 0.1).name('far');
    cameraFolder.add(cameraResetButton, 'reset_position');
    //cameraFolder.open();

    // Pointer lock controls
    const controls = new PointerLockControls(camera, canvas);
    controls.maxPolarAngle = (120 * Math.PI) / 180;
    controls.minPolarAngle = (60 * Math.PI) / 180;

    // Starter instructions/fully locked
    instructions.addEventListener('click', function () {
        if (!guiModeHandler.getIsGUIMode() && !PopupManager.popUpActive) {
            controls.lock();
            instructionsActive = false;
            instructions.style.display = 'none';
            blocker.style.display = 'none';
        }
    });

    // Close popup listener
    document.getElementById('popup').addEventListener('click', function (e) {
        if (e.target === this && !PopupManager.loadingPopupActive) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // The X on the popup listener
    document.getElementById('popup-close-btn').addEventListener('click', function (e) {
        if (e.target === this && !PopupManager.loadingPopupActive) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // Unlock listener that checks if instructions needs to be activated
    controls.addEventListener('unlock', function () {
        controls.unlock();
        console.log('Controls have been unlocked');
        if (!guiModeHandler.getIsGUIMode() && !PopupManager.popUpActive) {
            instructionsActive = true;
            instructions.style.display = '';
            blocker.style.display = '';
            document.getElementById('interactionBlocker').style.display = 'none';
            document.getElementById('interactDesc').style.display = 'none';
        }
    });

    // Just for debugging purposes to let me know controls were locked
    controls.addEventListener('lock', function () {
        console.log('controls have been locked');
    })
    //Really can't remember. Maybe xDarthx Knows. Commenting the line below because itis flagging an error and I'm not sure it is necessary.
    //scene.add(controls.object)

    document.addEventListener('focusout', (event) => {
        console.log('Unfocus target:', event.target);

        if (isGUIElement(event.target)) {
            console.log('GUI element unfocused');

            setTimeout(() => {
                if (!guiModeHandler.getGuiFocused()) {
                    resetMovementState();
                    console.log('Movement state reset after GUI unfocus');
                }
            }, 50);
        }
    });

    document.addEventListener('focusin', (event) => {
        console.log('Focus target:', event.target);

        if (isGUIElement(event.target)) {
            console.log('GUI element focused - stopping movement');

            // Reset all movement
            resetMovementState();
        }
    });

    /*
    const rotateTheCamera = function (event) {
        if (guiModeHandler.getGuiFocused()) return;

        switch (event.code) {
            case guiModeHandler.getIsGUIMode() && 'KeyQ':
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= -0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;

            case guiModeHandler.getIsGUIMode() && 'KeyE':
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= 0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;
        }
    }
        */

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    //document.addEventListener('keydown', rotateTheCamera);

    document.addEventListener('mousedown', (event) => {
        if (event.button === 1) {
            event.preventDefault();
            guiModeHandler.toggleGUIMode(instructionsActive, PopupManager.popUpActive);;
            return;
        }

        if (isGUIElement(event.target)) {
            console.log('GUI element clicked:', event.target);
            resetMovementState();
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (event.target === canvas || !isGUIElement(event.target)) {
            if (guiModeHandler.getGuiFocused()) {
                console.log('Clicked outside GUI - clearing focus state');
                resetMovementState();
            }
        }
    });

    const cullingLODManager = setupOptimizedRendering(scene, camera, renderer);

    // Add GUI controls for the culling system
    const optimizationFolder = gui.addFolder('Performance Optimization');

    // LOD distance controls
    const lodControls = {
        lodDistances: { high: 40, medium: 100, low: 150, cull: 200 },
        enableCulling: true,
        enableLOD: true
    };

    // Scene graph dump function
    function dumpObject(obj, lines = [], isLast = true, prefix = '') {
        const localPrefix = isLast ? '└─' : '├─';
        lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
        const newPrefix = prefix + (isLast ? '  ' : '│ ');
        const lastNdx = obj.children.length - 1;
        obj.children.forEach((child, ndx) => {
            const isLast = ndx === lastNdx;
            dumpObject(child, lines, isLast, newPrefix);
        });
        return lines;
    }

    function setupBoundaries() {
        cameraBoundarySystem = setupCameraBoundaries(scene, camera, controls);

        const boundaryFolder = gui.addFolder('Camera Boundaries');
        boundaryFolder.add(cameraBoundarySystem.min, 'x', -150, 0).name('Min X');
        boundaryFolder.add(cameraBoundarySystem.max, 'x', -100, 0).name('Max X');
        boundaryFolder.add(cameraBoundarySystem.min, 'z', -150, 0).name('Min Z');
        boundaryFolder.add(cameraBoundarySystem.max, 'z', 0, 150).name('Max Z');
        // This is what claude created to setup the rotation GUI
        // Add rotation controls using degrees (more user-friendly)
        // The key insight here is that we're directly manipulating the object's properties
        // and then calling updateRotation() whenever a value changes
        boundaryFolder.add(cameraBoundarySystem.rotationParams, 'xDegrees', -180, 180, 1)
            .name('X Rotation (°)')
            .onChange((value) => {
                // Convert degrees to radians and update the object
                cameraBoundarySystem.rotationParams.x = (value * Math.PI) / 180;
                cameraBoundarySystem.updateRotation();
            });

        boundaryFolder.add(cameraBoundarySystem.rotationParams, 'yDegrees', -180, 180, 1)
            .name('Y Rotation (°)')
            .onChange((value) => {
                cameraBoundarySystem.rotationParams.y = (value * Math.PI) / 180;
                cameraBoundarySystem.updateRotation();
            });

        boundaryFolder.add(cameraBoundarySystem.rotationParams, 'zDegrees', -180, 180, 1)
            .name('Z Rotation (°)')
            .onChange((value) => {
                cameraBoundarySystem.rotationParams.z = (value * Math.PI) / 180;
                cameraBoundarySystem.updateRotation();
            });
        // boundaryFolder.open();
    }

    // Intersection pop Circles!
    const popCirclesGUI = gui.addFolder('Popup Circles');
    const theaterGUI = popCirclesGUI.addFolder('Theater Circle');
    const cleanersGUI = popCirclesGUI.addFolder('Bills Circle');
    const dominosGUI = popCirclesGUI.addFolder('Dominos Circle');
    const recordsGUI = popCirclesGUI.addFolder('Records Circle');
    const northEndGUI = popCirclesGUI.addFolder('NorthEnd Circle');
    const southEndGUI = popCirclesGUI.addFolder('SouthEnd Circle');

    // Theater circle Intersection popup
    const theaterSphere = new PopupCircle(-32, 31, 7, 8);
    //theaterSphere.createSphereRadius(scene);
    theaterGUI.add(theaterSphere.position, 'x', -50, 50, 1).onChange((value) => {
        if (theaterSphere.circleObject) {
            theaterSphere.circleObject.position.x = value;
        }
    });
    theaterGUI.add(theaterSphere.position, 'z', -20, 20, 1).onChange((value) => {
        if (theaterSphere.circleObject) {
            theaterSphere.circleObject.position.z = value;
        }
    });
    // Bills Cleaners
    const cleanersSphere = new PopupCircle(-35, 31, 32, 4);
    //cleanersSphere.createSphereRadius(scene);
    cleanersGUI.add(cleanersSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if (cleanersSphere.circleObject) {
            cleanersSphere.circleObject.position.x = value;
        }
    });
    cleanersGUI.add(cleanersSphere.position, 'z', -20, 60, 0.1).onChange((value) => {
        if (cleanersSphere.circleObject) {
            cleanersSphere.circleObject.position.z = value;
        }
    });
    // Dominos place with THE FAN
    const dominosSphere = new PopupCircle(-35.2, 31, 57.8, 3);
    //dominosSphere.createSphereRadius(scene);
    dominosGUI.add(dominosSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if (dominosSphere.circleObject) {
            dominosSphere.circleObject.position.x = value;
        }
    });
    dominosGUI.add(dominosSphere.position, 'z', -20, 60, 0.1).onChange((value) => {
        if (dominosSphere.circleObject) {
            dominosSphere.circleObject.position.z = value;
        }
    });
    // Records Shop, good music bruh
    const recordsSphere = new PopupCircle(-36, 31, 63, 2);
    //recordsSphere.createSphereRadius(scene);
    recordsGUI.add(recordsSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if (recordsSphere.circleObject) {
            recordsSphere.circleObject.position.x = value;
        }
    });
    recordsGUI.add(recordsSphere.position, 'z', -20, 100, 0.1).onChange((value) => {
        if (recordsSphere.circleObject) {
            recordsSphere.circleObject.position.z = value;
        }
    });
    // North End
    const northEndSphere = new PopupCircle(-50, 31, -28, 11);
    //northEndSphere.createSphereRadius(scene);
    northEndGUI.add(northEndSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if (northEndSphere.circleObject) {
            northEndSphere.circleObject.position.x = value;
        }
    });
    northEndGUI.add(northEndSphere.position, 'z', -20, 100, 0.1).onChange((value) => {
        if (northEndSphere.circleObject) {
            northEndSphere.circleObject.position.z = value;
        }
    });
    // South End
    const southEndSphere = new PopupCircle(-52, 31, 86, 11);
    //southEndSphere.createSphereRadius(scene);
    southEndGUI.add(southEndSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if (southEndSphere.circleObject) {
            southEndSphere.circleObject.position.x = value;
        }
    });
    southEndGUI.add(southEndSphere.position, 'z', -20, 100, 0.1).onChange((value) => {
        if (southEndSphere.circleObject) {
            southEndSphere.circleObject.position.z = value;
        }
    });

    //popCirclesGUI.open();

    {
        const skyColor = 0xB1E1FF;
        const groundColor = 0xB97A20;
        const intensity = 2;
        const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        scene.add(light);
    }

    {
        const color = 0xFFFFFF;
        const intensity = 5;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(5, 10, 2);
        scene.add(light);
        scene.add(light.target);

        const lightFolder = gui.addFolder('Light');
        lightFolder.addColor(new ColorGUIHelper(light, 'color'), 'value').name('color');
        lightFolder.add(light, 'intensity', 0, 10, 0.01);
        // lightFolder.open();

    }

    // Add skybox and GUI Controls
    // I had claude help me figure out what was going wrong. 
    // For some reason even though my code is almost the exact same as his
    // Mine couldnt read the currentSkybox variable, and the min I pasted his into the
    // code it worked perfectly fine.
    let skySphereMesh;
    let skyboxDropdown;
    {
        let loader = new THREE.TextureLoader();
        skyBoxTextures = {
            okcSunset: loader.load('../public/skybox/oklahoma_sunset.png'),
            pinkSky: loader.load('../public/skybox/pink_sunset.png'),
            blueSky: loader.load('../public/skybox/blue_sky.png'),
            nightSky: loader.load('../public/skybox/night_sky.png')
        }
        const imagePath = '../public/skybox/oklahoma_sunset.png';
        loader.load(imagePath, (panoramaTexture) => {
            const skySphereGeometry = new THREE.SphereGeometry(500, 60, 60);

            panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;
            panoramaTexture.colorSpace = THREE.SRGBColorSpace;
            let skySphereMaterial = new THREE.MeshBasicMaterial({
                map: panoramaTexture,
            });

            skySphereMaterial.side = THREE.BackSide;
            skySphereMesh = new THREE.Mesh(skySphereGeometry, skySphereMaterial);
            scene.add(skySphereMesh);

            // Now that the skybox is loaded, set up the GUI control
            setupSkyboxGUI();
        });

    }

    // Function to add a new skybox from file
    function addSkyboxFromFile(file) {
        const fileName = file.name.split('.')[0];
        const customName = `custom_${fileName}_${Date.now()}`;

        const reader = new FileReader();
        reader.onload = function (e) {
            const loader = new THREE.TextureLoader();
            loader.load(e.target.result, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.colorSpace = THREE.SRGBColorSpace;

                skyBoxTextures[customName] = texture;

                updateSkyboxDropdown();

                console.log(`Added custom skybox: ${customName}`);
            });
        };
        reader.readAsDataURL(file);
    }

    // Function to update the dropdown with new options
    function updateSkyboxDropdown() {
        if (skyboxDropdown) {
            const availableOptions = Object.keys(skyBoxTextures);

            skyboxDropdown.destroy();

            const skyBoxFolder = gui.folders.find(folder => folder._title === 'SkyBox');
            skyboxDropdown = skyBoxFolder.add(skyboxController, 'currentSkybox', availableOptions)
                .name('Select Skybox');

            skyboxDropdown.onChange(function (value) {
                skyboxController.changeSkyBox(value);
            });
        }
    }

    // Create the skybox control object with a proper property that holds the current selection
    var skyboxController = {
        // This property will hold the current skybox selection
        currentSkybox: 'pinkSky', // Set the initial value to match what we load by default

        // This function handles changing the skybox
        changeSkyBox: function (newTextureName) {
            if (skySphereMesh && skyBoxTextures[newTextureName]) {
                controls.disconnect();
                resetMovementState();
                setTimeout(() => {
                    skySphereMesh.material.map = skyBoxTextures[newTextureName];
                    skySphereMesh.material.needsUpdate = true;
                }, 100);
                controls.connect(canvas);
                resetMovementState();
                controls.object.position.copy(camera.position);
                console.log('Skybox changed to:', newTextureName);
            }
        }
    };
    //monochromatic filter
    skyboxController.applyMonochromaticFilter = function () {
        if (skySphereMesh && materialModeManager.isMonochromatic) {
            // Create a desaturated version of the skybox
            const monoSkyMaterial = new THREE.MeshBasicMaterial({
                color: 0xe8e8e8,
                side: THREE.BackSide,
                fog: false
            });
            skySphereMesh.material = monoSkyMaterial;
        }
    };

    // Separate function to set up the GUI control after the skybox is loaded
    function setupSkyboxGUI() {
        const skyBoxFolder = gui.addFolder('SkyBox');

        // Create the dropdown control
        skyboxDropdown = skyBoxFolder.add(skyboxController, 'currentSkybox', ['okcSunset', 'blueSky', 'nightSky', 'pinkSky'])
            .name('Select Skybox');

        // Set up the onChange listener to actually change the skybox
        skyboxDropdown.onChange(function (value) {
            skyboxController.changeSkyBox(value);
        });

        const fileController = {
            uploadSkybox: function () {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,.hdr';
                input.multiple = true;

                input.onchange = function (e) {
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                        if (file.type.startsWith('image/')) {
                            addSkyboxFromFile(file);
                        }
                    });
                };

                input.click();
            }
        };

        skyBoxFolder.add(fileController, 'uploadSkybox').name('Upload Skybox');

        //skyBoxFolder.open(); // Optional: opens the folder by default
    }


    // Fog setup
    scene.fog = new THREE.FogExp2(0xbe9fd4, 0.005);
    const fogFolder = gui.addFolder('Fog');
    const fogGUIHelper = new FogGUIHelper(scene.fog, camera);
    fogFolder.add(fogGUIHelper, 'density', 0, 0.05, 0.0001);
    fogFolder.addColor(fogGUIHelper, 'color');
    //fogFolder.open();
    updateGUIVisibility();

    // GLTF Model loading with improved error handling
    {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        dracoLoader.setDecoderConfig({ type: 'js' });
        dracoLoader.preload();

        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(
            baseURL + 'fairgrounds.glb',
            (glb) => {
                try {
                    // Hide the loading popup
                    PopupManager.hideLoadingPopup();

                    const root = glb.scene;

                    const updateTextureQuality = setupOptimizedTextureSystem(root, scene, camera);
                    window.updateTextureQuality = updateTextureQuality;

                    window.cullingLODManager.injectIntoGLTFScene(root, lodControls);
                    scene.add(root);

                    // Apply monochromatic mode after model loads if it's enabled
                    if (visualizationSettings.monochromaticMode) {
                        // Delay to ensure everything is initialized
                        setTimeout(() => {
                            materialModeManager.toggleMonochromatic(scene);
                            // Update lighting
                            scene.children.forEach(child => {
                                if (child.isHemisphereLight) {
                                    child.intensity = 3.5;
                                } else if (child.isDirectionalLight) {
                                    child.intensity = 2.5;
                                }
                            });
                            scene.fog.density = 0.003;
                        }, 100);
                    }

                    console.log(dumpObject(root).join('\n'));
                    setupBoundaries();
                    blocker.style.display = '';
                    instructions.style.display = '';
                    dracoLoader.dispose();
                } catch (error) {
                    console.error('Error processing loaded model:', error);
                    // Update the loading popup to show error
                    const progressDiv = document.querySelector('.loading-progress');
                    if (progressDiv) {
                        progressDiv.innerHTML = '<div style="color: #d32f2f;">Error loading model. Please refresh the page.</div>';
                    }
                    dracoLoader.dispose();
                }
            },
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                    PopupManager.updateLoadingProgress(percentComplete);

                    if (blocker.style.display === '' && instructions.style.display === '') {
                        instructions.style.display = 'none';
                        blocker.style.display = 'none';
                    }
                }
            },
            (error) => {
                console.error('Error loading model:', error);
                // Update the loading popup to show error
                const progressDiv = document.querySelector('.loading-progress');
                if (progressDiv) {
                    progressDiv.innerHTML = '<div style="color: #d32f2f;">Error loading model. Please check your connection and refresh.</div>';
                }
                dracoLoader.dispose();
            }
        );
    }

    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
        return needResize;
    }

    // Animation/rendering variables
    let totalTime = 0.0;
    let previousTime = null;

    function render(time) {
        try {
            if (!controls.isLocked && !guiModeHandler.getIsGUIMode()) {
                velocity.set(0, 0, 0);
                direction.set(0, 0, 0);
                requestAnimationFrame(render);
                return;
            }

            // Update fog time for shaders
            if (previousTime === null) {
                previousTime = time;
            }
            const timeElapsed = (time - previousTime) * 0.001;
            totalTime += timeElapsed;
            previousTime = time;
            cullingLODManager.updateFogTimeUniforms(totalTime);

            const pointLockTime = performance.now();

            if (controls.isLocked === true && !guiModeHandler.getIsGUIMode()) {
                theaterSphere.checkForIntersection(camera);
                cleanersSphere.checkForIntersection(camera);
                dominosSphere.checkForIntersection(camera);
                recordsSphere.checkForIntersection(camera);
                northEndSphere.checkForIntersection(camera);
                southEndSphere.checkForIntersection(camera);
                let theCameraInside = (theaterSphere.cameraInside || cleanersSphere.cameraInside || dominosSphere.cameraInside || recordsSphere.cameraInside || northEndSphere.cameraInside || southEndSphere.cameraInside) ? true : false;
                if (theCameraInside) {
                    document.getElementById('interactionBlocker').style.display = 'block';
                    document.getElementById('interactDesc').style.display = 'flex';
                } else if (document.getElementById('interactionBlocker').style.display === 'block' && !theCameraInside) {
                    document.getElementById('interactionBlocker').style.display = 'none';
                    document.getElementById('interactDesc').style.display = 'none';
                }
            }

            if (controls.isLocked === true || guiModeHandler.getIsGUIMode() && !PopupManager.popUpActive && !guiModeHandler.getGuiFocused()) {
                movementController.update(delta, guiModeHandler.getIsGUIMode());
            } else {
                movementController.reset(); // This calls the reset method to stop all movement
            }

            if (window.cullingLODManager) {
                window.cullingLODManager.update();
            }

            if (time % 3 === 0) {
                if (window.updateTextureQuality) {
                    try {
                        window.updateTextureQuality();
                    } catch (error) {
                        console.warn('Error updating texture quality:', error);
                    }
                }
            }

            prevTime = pointLockTime;

            if (resizeRendererToDisplaySize(renderer)) {
                const canvas = renderer.domElement;
                camera.aspect = canvas.clientWidth / canvas.clientHeight;
                camera.updateProjectionMatrix();
            }

            renderer.render(scene, camera);
        } catch (error) {
            console.error('Render loop error:', error);
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main();