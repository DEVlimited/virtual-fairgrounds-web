import * as THREE from 'three';

/**
 * Manages material modes including monochromatic visualization
 */
export class MaterialModeManager {
    constructor() {
        this.originalMaterials = new Map();
        this.isMonochromatic = false;
        this.monochromaticMaterial = null;
        this.shaderModifier = null; // Store it for later use
    }
    
    createMonochromaticMaterial() {
        const material = new THREE.MeshStandardMaterial({
            color: 0xf0f0f0,
            roughness: 0.9,
            metalness: 0.0,
            fog: true
        });
        
        // Apply shader modifier if it's been set
        if (this.shaderModifier) {
            material.onBeforeCompile = this.shaderModifier;
        }
        
        return material;
    }
    
    // Method to set the shader modifier after LOD manager is created
    setShaderModifier(shaderModifier) {
        this.shaderModifier = shaderModifier;
        // If monochromatic material already exists, update it
        if (this.monochromaticMaterial) {
            this.monochromaticMaterial.onBeforeCompile = shaderModifier;
        }
    }
    
    storeMaterialsFromMesh(mesh) {
        if (!mesh.material || this.originalMaterials.has(mesh.uuid)) return;
        
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        this.originalMaterials.set(mesh.uuid, {
            materials: materials.map(m => m),  // Store references, not clones
            isArray: Array.isArray(mesh.material)
        });
    }
    
    toggleMonochromatic(scene) {
        this.isMonochromatic = !this.isMonochromatic;
        
        if (!this.monochromaticMaterial) {
            this.monochromaticMaterial = this.createMonochromaticMaterial();
        }
        
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                // Skip the skybox
                if (child.geometry?.type === 'SphereGeometry' && 
                    child.material?.side === THREE.BackSide) {
                    return;
                }
                // Skip wireframe objects
                if (child.material.wireframe) {
                    return;
                }
                
                // Store original materials on first run
                this.storeMaterialsFromMesh(child);
                
                const materialData = this.originalMaterials.get(child.uuid);
                if (!materialData) return;
                
                if (this.isMonochromatic) {
                    // Apply monochromatic material
                    if (materialData.isArray) {
                        child.material = new Array(materialData.materials.length).fill(this.monochromaticMaterial);
                    } else {
                        child.material = this.monochromaticMaterial;
                    }
                } else {
                    // Restore original materials
                    child.material = materialData.isArray ? materialData.materials : materialData.materials[0];
                }
            }
        });
    }
}