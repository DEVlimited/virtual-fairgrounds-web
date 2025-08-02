import * as THREE from 'three';

export class MaterialModeManager {
    constructor() {
        this.originalMaterials = new Map();
        this.isMonochromatic = false;
        this.monochromaticMaterial = null;
    }

    createMonochromaticMaterial() {
        const material = new THREE.MeshStandardMaterial({
            color: 0xf0f0f0,
            roughness: 0.9,
            metalness: 0.0,
            fog: true
        });

        // Apply the same shader modification as other materials
        material.onBeforeCompile = shaderModifier;

        return material;
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