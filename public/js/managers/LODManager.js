import * as THREE from 'three';

// Advanced Frustum Culling and LOD System for Three.js
// This is another LODManager section of code that I found online,
// It helps keep only objects in the frustrum loaded and unloads objects that are too far away
// REFACTORED: Advanced LOD system with NO MATERIAL SWAPPING
// Uses separate LOD mesh instances with visibility toggling
export class AdvancedCullingLODManager {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        this.objectCache = new Map();
        this.frameCount = 0;
        this.trackedShaders = [];
    }

    registerObjectGroupFromGLTF(originalMesh, lodOptions = {}) {
        const baseName = originalMesh.name;

        const group = new THREE.Group();
        group.name = `${baseName}_LODGroup`;

        const high = originalMesh.clone();
        high.name = 'high';
        this.prepareMaterialWithFog(high.material);

        const medium = originalMesh.clone();
        medium.name = 'medium';
        medium.material = this.simplifyMaterial(medium.material, 'medium');
        this.prepareMaterialWithFog(medium.material);

        const low = originalMesh.clone();
        low.name = 'low';
        low.material = this.simplifyMaterial(low.material, 'low');
        this.prepareMaterialWithFog(low.material);

        group.add(high, medium, low);
        originalMesh.parent.add(group);
        originalMesh.parent.remove(originalMesh);

        return this.registerObject(group, lodOptions);
    }

    prepareMaterialWithFog(material) {
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((mat) => {
            if (typeof isFogCompatibleMaterial === 'function' && isFogCompatibleMaterial(mat)) {
                mat.fog = true;
                mat.needsUpdate = true;
                this.trackedShaders.push(mat);
            }
        });
    }

    updateFogTimeUniforms(totalTime) {
        for (let s of this.trackedShaders) {
            try {
                if (s.uniforms && s.uniforms.fogTime) {
                    s.uniforms.fogTime.value = totalTime;
                }
            } catch (error) {
                console.warn('Error updating shader uniform:', error);
            }
        }
    }

    simplifyMaterial(material, level) {
        if (!material || typeof material.clone !== 'function') return material;

        const simplified = material.clone();

        // Preserve key visual features
        simplified.map = material.map;
        simplified.color = material.color?.clone?.() ?? new THREE.Color(0xffffff);

        if (level === 'medium' || level === 'low') {
            simplified.flatShading = true;
        } else if (level == 'low') {
            const simplifiedLow = new THREE.MeshLambertMaterial({
                map: material.map,
                color: material.color,
                flatShading: true,
            });
            simplifiedLow.needsUpdate = true;
            return simplifiedLow;
        }

        simplified.needsUpdate = true;
        return simplified;

    }

    injectIntoGLTFScene(gltfScene, defaultLODOptions = {}) {
        gltfScene.traverse((child) => {
            if (!child.isMesh || child.name.endsWith('_LODGroup') || child.parent?.name.endsWith('_LODGroup')) return;

            const name = child.name.toLowerCase();
            let lodOptions = { ...defaultLODOptions };

            if (name.includes('roads') || name.includes('plane') || (child.material.name && child.material.name.toLowerCase().includes('road'))) {
                lodOptions = {
                    allowCulling: false,
                    lodDistances: { high: 200, medium: 500, low: 1000, cull: 2000 }
                };
            } else if (name.includes('building') || name.includes('structure') || name.includes('house') || name.includes('tower')) {
                lodOptions = {
                    lodDistances: { high: 40, medium: 100, low: 200, cull: 400 }
                };
            } else if (name.includes('detail') || name.includes('decoration') || name.includes('prop') || name.includes('ornament')) {
                lodOptions = {
                    lodDistances: { high: 30, medium: 80, low: 150, cull: 300 }
                };
            } else if (name.includes('ground') || name.includes('terrain') || name.includes('landscape')) {
                lodOptions = {
                    allowCulling: false,
                    lodDistances: { high: 100, medium: 300, low: 600, cull: 1200 }
                };
            }

            try {
                this.registerObjectGroupFromGLTF(child, lodOptions);
            } catch (error) {
                console.warn(`LOD registration failed for ${child.name}:`, error);
            }
        });
    }

    registerObject(objectGroup, options = {}) {
        const id = objectGroup.uuid;

        const lodData = {
            group: objectGroup,
            meshes: {
                high: objectGroup.getObjectByName('high'),
                medium: objectGroup.getObjectByName('medium'),
                low: objectGroup.getObjectByName('low'),
            },
            lodDistances: options.lodDistances || {
                high: 25,
                medium: 75,
                low: 150,
                cull: 300
            },
            currentLOD: null,
            allowCulling: options.allowCulling !== false
        };

        this.objectCache.set(id, lodData);
        return id;
    }

    update() {
        this.updateCameraFrustum();

        for (const [id, lodData] of this.objectCache) {
            this.processLODGroup(lodData);
        }
    }

    updateCameraFrustum() {
        this.cameraMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }

    processLODGroup(lodData) {
        const group = lodData.group;
        const position = new THREE.Vector3();
        group.getWorldPosition(position);

        const distance = this.camera.position.distanceTo(position);

        let lod = 'high';
        if (distance > lodData.lodDistances.cull) {
            group.visible = false;
            return;
        } else if (distance > lodData.lodDistances.low) {
            lod = 'low';
        } else if (distance > lodData.lodDistances.medium) {
            lod = 'medium';
        }

        const currentMesh = lodData.meshes[lod];
        if (!currentMesh) return;

        if (lodData.allowCulling && !this.frustum.intersectsObject(currentMesh)) {
            group.visible = false;
            return;
        }

        group.visible = true;

        if (lod !== lodData.currentLOD) {
            this.applyLODVisibility(lodData, lod);
            lodData.currentLOD = lod;
        }
    }

    applyLODVisibility(lodData, targetLOD) {
        const meshes = lodData.meshes;
        for (const level in meshes) {
            if (meshes[level]) {
                meshes[level].visible = (level === targetLOD);
            }
        }
    }

    unregisterObject(objectGroup) {
        this.objectCache.delete(objectGroup.uuid);
    }

    dispose() {
        this.objectCache.clear();
    }
}

export class SafeTextureLODManager {
    constructor() {
        this.processedTextures = new Set();
        this.currentLOD = 'high';
    }

    // More conservative texture processing
    async processGLTFTextures(gltfScene, options = {}) {
        const {
            enableLODs = true,
            maxTextureSize = 1024, // Can be changed to 512 for less memory pressure
            compressionQuality = 0.8
        } = options;

        console.log('Processing GLTF textures...');

        // Process materials more safely
        gltfScene.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach(material => {
                    // Process ALL material types that support textures
                    if (this.isSupportedMaterial(material)) {
                        this.optimizeMaterial(material, maxTextureSize, compressionQuality);
                    }
                });
            }
        });

        console.log('Texture processing complete');
    }

    // Check if material type supports texture optimization
    isSupportedMaterial(material) {
        return (
            material.isMeshStandardMaterial ||
            material.isMeshBasicMaterial ||
            material.isMeshPhysicalMaterial ||
            material.isMeshLambertMaterial ||
            material.isMeshPhongMaterial
        );
    }

    optimizeMaterial(material, maxSize, quality) {
        // Extended list of texture properties for different material types
        const textureProperties = [
            'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
            'bumpMap', 'displacementMap', 'aoMap', 'lightMap', 'envMap',
            // MeshPhysicalMaterial specific properties
            'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
            'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
            'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap'
        ];

        textureProperties.forEach(prop => {
            if (material[prop] && !this.processedTextures.has(material[prop])) {
                try {
                    material[prop] = this.optimizeTexture(material[prop], maxSize, quality);
                    this.processedTextures.add(material[prop]);
                } catch (error) {
                    console.warn(`Failed to optimize ${prop} texture:`, error);
                }
            }
        });
    }

    optimizeTexture(texture, maxSize, quality) {
        if (!texture.image || !texture.image.width) {
            return texture;
        }

        const { width, height } = texture.image;

        // Only resize if texture is larger than maxSize
        if (width <= maxSize && height <= maxSize) {
            return texture;
        }

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scale = Math.min(maxSize / width, maxSize / height);
            canvas.width = Math.floor(width * scale);
            canvas.height = Math.floor(height * scale);

            ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);

            const optimizedTexture = new THREE.CanvasTexture(canvas);

            // Copy all texture properties to maintain compatibility
            this.copyTextureProperties(texture, optimizedTexture);

            return optimizedTexture;
        } catch (error) {
            console.warn('Texture optimization failed, using original:', error);
            return texture;
        }
    }

    copyTextureProperties(source, target) {
        const propertiesToCopy = [
            'wrapS', 'wrapT', 'minFilter', 'magFilter', 'colorSpace',
            'flipY', 'premultiplyAlpha', 'unpackAlignment', 'encoding',
            'generateMipmaps', 'anisotropy', 'offset', 'repeat', 'center', 'rotation'
        ];

        propertiesToCopy.forEach(prop => {
            if (source[prop] !== undefined) {
                try {
                    target[prop] = source[prop];
                } catch (error) {
                    console.warn(`Failed to copy texture property ${prop}:`, error);
                }
            }
        });

        // Handle Vector2 properties separately
        if (source.offset) target.offset.copy(source.offset);
        if (source.repeat) target.repeat.copy(source.repeat);
        if (source.center) target.center.copy(source.center);
    }
}

export function setupOptimizedTextureSystem(gltfScene, scene, camera) {
    const safeTextureLOD = new SafeTextureLODManager();

    // Store references for distance-based optimization
    const meshes = [];
    const originalTextures = new Map();
    const lowResTextures = new Map();

    // Collect all meshes and store texture references
    gltfScene.traverse((child) => {
        if (child.isMesh && child.material) {
            meshes.push({ mesh: child, position: child.getWorldPosition(new THREE.Vector3()) });

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
                if (safeTextureLOD.isSupportedMaterial(material)) {
                    // Store original textures
                    const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];
                    textureProps.forEach(prop => {
                        if (material[prop] && !originalTextures.has(material[prop])) {
                            originalTextures.set(material[prop], material[prop]);
                            // Create low-res version
                            const lowRes = safeTextureLOD.optimizeTexture(material[prop], 256, 0.6);
                            lowResTextures.set(material[prop], lowRes);
                        }
                    });
                }
            });
        }
    });

    // Process textures with error handling
    safeTextureLOD.processGLTFTextures(gltfScene, {
        enableLODs: true,
        maxTextureSize: 1024,
        compressionQuality: 0.8
    }).catch(error => {
        console.error('Texture processing error:', error);
    });

    // Return distance-based quality update function
    return function updateTextureQuality() {
        const cameraPosition = camera.position;
        const HIGH_QUALITY_DISTANCE = 25;
        const LOW_QUALITY_DISTANCE = 100;

        meshes.forEach(({ mesh }) => {
            try {
                // Get current world position
                const meshPosition = mesh.getWorldPosition(new THREE.Vector3());
                const distance = cameraPosition.distanceTo(meshPosition);

                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach(material => {
                    if (safeTextureLOD.isSupportedMaterial(material)) {
                        const useHighRes = distance < HIGH_QUALITY_DISTANCE;
                        const useLowRes = distance > LOW_QUALITY_DISTANCE;

                        const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];
                        textureProps.forEach(prop => {
                            if (material[prop]) {
                                const original = originalTextures.get(material[prop]);
                                const lowRes = lowResTextures.get(material[prop]);

                                if (useHighRes && original) {
                                    material[prop] = original;
                                } else if (useLowRes && lowRes) {
                                    material[prop] = lowRes;
                                }
                            }
                        });
                    }
                });
            } catch (error) {
                console.warn('Error updating mesh texture quality:', error);
            }
        });
    };
}

export function isFogCompatibleMaterial(material) {
    return (
        material.isMeshStandardMaterial ||
        material.isMeshBasicMaterial ||
        material.isMeshPhysicalMaterial ||
        material.isMeshLambertMaterial ||
        material.isMeshPhongMaterial
    );
}