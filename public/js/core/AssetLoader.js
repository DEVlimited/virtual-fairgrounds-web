import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MODEL_URL } from '../config/constants.js';

/**
 * Handles loading of 3D models and textures
 */
export class AssetLoader {
    constructor() {
        this.gltfLoader = null;
        this.dracoLoader = null;
        this.textureLoader = new THREE.TextureLoader();
        this.setupLoaders();
    }
    
    setupLoaders() {
        // Setup DRACO loader for compressed models
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        this.dracoLoader.setDecoderConfig({ type: 'js' });
        this.dracoLoader.preload();
        
        // Setup GLTF loader
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
    }
    
    /**
     * Load the main fairgrounds model
     * @param {Function} onProgress - Progress callback (percentage)
     * @param {Function} onLoad - Success callback
     * @param {Function} onError - Error callback
     * @returns {Promise<THREE.Group>} The loaded model
     */
    async loadMainModel(onProgress = () => {}, onLoad = () => {}, onError = () => {}) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                MODEL_URL + 'fairgrounds.glb',
                (glb) => {
                    try {
                        const root = glb.scene;
                        onLoad(root);
                        resolve(root);
                    } catch (error) {
                        console.error('Error processing loaded model:', error);
                        onError(error);
                        reject(error);
                    }
                },
                (xhr) => {
                    if (xhr.lengthComputable) {
                        const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                        onProgress(percentComplete);
                    }
                },
                (error) => {
                    console.error('Error loading model:', error);
                    onError(error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Load skybox textures
     * @returns {Object} Object containing loaded skybox textures
     */
    loadSkyboxTextures() {
        const skyboxPaths = {
            okcSunset: '../public/skybox/oklahoma_sunset.png',
            pinkSky: '../public/skybox/pink_sunset.png',
            blueSky: '../public/skybox/blue_sky.png',
            nightSky: '../public/skybox/night_sky.png'
        };
        
        const skyBoxTextures = {};
        
        // Load all skybox textures
        for (const [name, path] of Object.entries(skyboxPaths)) {
            skyBoxTextures[name] = this.textureLoader.load(path);
        }
        
        return skyBoxTextures;
    }
    
    /**
     * Load a single skybox texture
     * @param {string} path - Path to the texture
     * @returns {Promise<THREE.Texture>} The loaded texture
     */
    async loadSkyboxTexture(path) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    texture.colorSpace = THREE.SRGBColorSpace;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Error loading skybox texture:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Load skybox from file input
     * @param {File} file - The file to load
     * @returns {Promise<THREE.Texture>} The loaded texture
     */
    async loadSkyboxFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                this.textureLoader.load(
                    e.target.result,
                    (texture) => {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        texture.colorSpace = THREE.SRGBColorSpace;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        reject(error);
                    }
                );
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Load any texture
     * @param {string} path - Path to the texture
     * @returns {Promise<THREE.Texture>} The loaded texture
     */
    async loadTexture(path) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                resolve,
                undefined,
                reject
            );
        });
    }
    
    /**
     * Dispose of loaders to free memory
     */
    dispose() {
        if (this.dracoLoader) {
            this.dracoLoader.dispose();
        }
    }
}