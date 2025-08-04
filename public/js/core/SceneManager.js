import * as THREE from 'three';
import { FOG_CONFIG } from '../config/constants.js';

/**
 * Manages Three.js scene setup and configuration
 */
export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.setupFog();
        this.setupLighting();
    }
    
    setupFog() {
        this.scene.fog = new THREE.FogExp2(FOG_CONFIG.COLOR, FOG_CONFIG.DENSITY);
    }
    
    setupLighting() {
        // Hemisphere light for ambient lighting
        const skyColor = 0xB1E1FF;
        const groundColor = 0xB97A20;
        const intensity = 2;
        this.hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        this.scene.add(this.hemisphereLight);

        // Directional light for sun
        const dirColor = 0xFFFFFF;
        const dirIntensity = 5;
        this.directionalLight = new THREE.DirectionalLight(dirColor, dirIntensity);
        this.directionalLight.position.set(5, 10, 2);
        this.scene.add(this.directionalLight);
        this.scene.add(this.directionalLight.target);
    }
    
    setupSkybox(panoramaTexture) {
        const skySphereGeometry = new THREE.SphereGeometry(500, 60, 60);
        
        panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;
        panoramaTexture.colorSpace = THREE.SRGBColorSpace;
        
        const skySphereMaterial = new THREE.MeshBasicMaterial({
            map: panoramaTexture,
            side: THREE.BackSide
        });
        
        this.skySphereMesh = new THREE.Mesh(skySphereGeometry, skySphereMaterial);
        this.scene.add(this.skySphereMesh);
        
        return this.skySphereMesh;
    }
    
    updateSkyboxTexture(texture) {
        if (this.skySphereMesh && texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            this.skySphereMesh.material.map = texture;
            this.skySphereMesh.material.needsUpdate = true;
        }
    }
    
    getLights() {
        return {
            hemisphere: this.hemisphereLight,
            directional: this.directionalLight
        };
    }
    
    getSkybox() {
        return this.skySphereMesh;
    }
    
    getScene() {
        return this.scene;
    }
    
    // Helper method for adjusting fog density (for monochromatic mode)
    setFogDensity(density) {
        if (this.scene.fog) {
            this.scene.fog.density = density;
        }
    }
}