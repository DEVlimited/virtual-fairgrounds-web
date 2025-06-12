import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Euler }  from 'three';

const _NOISE_GLSL = `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20201014 (stegu)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
{
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

float FBM(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 0.0;
  for (int i = 0; i < 6; ++i) {
    value += amplitude * snoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`;

// Fixed shader chunks that avoid variable redefinition conflicts
// Also had claude help me redefine the noise calculations and fog shader for overall better performance
function setupCustomFogShaders() {
    // Use a unique variable name to avoid conflicts
    THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
      varying vec3 vFogWorldPosition;
    #endif`;

    THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
      vec4 fogWorldPosition = modelMatrix * vec4(position, 1.0);
      vFogWorldPosition = fogWorldPosition.xyz;
    #endif`;

    THREE.ShaderChunk.fog_pars_fragment = _NOISE_GLSL + `
    #ifdef USE_FOG
      uniform float fogTime;
      uniform vec3 fogColor;
      varying vec3 vFogWorldPosition;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
    #endif`;

    // Basically it just checks the distance of objects and if it is too distant 
    // then the noise is much less for better performance.
    THREE.ShaderChunk.fog_fragment = `
    #ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        float fogDepth = distance(vFogWorldPosition, fogOrigin);
        
        // Simplified noise calculation for distant objects
        float noiseSample = 1.0;
        if (fogDepth < 200.0) {
            vec3 noiseSampleCoord = vFogWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
            noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
        }
        
        fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
        fogDepth *= fogDepth;
        
        float heightFactor = 0.05;
        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * 
            (1.0 - exp(-fogDepth * normalize(vFogWorldPosition - fogOrigin).y * fogDensity)) / 
            normalize(vFogWorldPosition - fogOrigin).y;
        fogFactor = saturate(fogFactor);
        
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`;
}

// Advanced Frustum Culling and LOD System for Three.js
// This is another LODManager section of code that I found online,
// It helps keep only objects in the frustrum loaded and unloads objects that are too far away
class AdvancedCullingLODManager {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        
        // Frustum culling setup
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        
        // LOD distance thresholds (in world units)
        this.lodDistances = {
            high: 25,      // Full detail within 50 units
            medium: 75,   // Medium detail from 50-150 units
            low: 100,      // Low detail from 150-300 units
            cull: 150      // Don't render beyond 500 units
        };
        
        // Performance tracking
        this.stats = {
            totalObjects: 0,
            culledObjects: 0,
            highLOD: 0,
            mediumLOD: 0,
            lowLOD: 0,
            renderCalls: 0
        };
        
        // Cache for expensive calculations
        this.objectCache = new Map();
        this.frameCount = 0;
        
        // Bounding spheres cache for faster frustum testing
        this.boundingSpheres = new Map();
    }

    // Register an object for culling and LOD management
    registerObject(mesh, options = {}) {
        const id = mesh.uuid;
        
        // Create LOD variants if they don't exist
        const lodData = {
            mesh: mesh,
            originalMaterial: mesh.material,
            
            // LOD Materials (you can customize these based on your needs)
            highLODMaterial: mesh.material, // Original material
            mediumLODMaterial: this.createMediumLODMaterial(mesh.material),
            lowLODMaterial: this.createLowLODMaterial(mesh.material),
            
            // Custom LOD distances for this object (optional)
            lodDistances: options.lodDistances || this.lodDistances,
            
            // Whether this object can be culled
            allowCulling: options.allowCulling !== false,
            
            // Whether this object uses LOD
            useLOD: options.useLOD !== false,
            
            // Current state
            currentLOD: 'high',
            isVisible: true,
            lastUpdateFrame: 0
        };
        
        this.objectCache.set(id, lodData);
        
        // Compute and cache bounding sphere for faster frustum testing
        this.computeBoundingSphere(mesh);
        
        return id;
    }

    // Compute bounding sphere for an object (more efficient than bounding box for frustum testing)
    computeBoundingSphere(mesh) {
        if (!mesh.geometry.boundingSphere) {
            mesh.geometry.computeBoundingSphere();
        }
        
        const sphere = mesh.geometry.boundingSphere.clone();
        sphere.applyMatrix4(mesh.matrixWorld);
        
        this.boundingSpheres.set(mesh.uuid, sphere);
    }

    // Create medium LOD material (simplified version of original)
    createMediumLODMaterial(originalMaterial) {
        if (!originalMaterial) return originalMaterial;
        
        // Clone the material but with some optimizations
        const mediumMaterial = originalMaterial.clone();
        
        // Reduce texture resolution if possible
        if (mediumMaterial.map) {
            // You would implement texture downscaling here
            // For now, we'll just reduce some quality settings
            mediumMaterial.map.minFilter = THREE.LinearFilter;
            mediumMaterial.map.magFilter = THREE.LinearFilter;
        }
        
        // Disable expensive features for medium LOD
        if (mediumMaterial.normalMap) {
            // Keep normal map but might reduce its influence
            mediumMaterial.normalScale = mediumMaterial.normalScale ? 
                mediumMaterial.normalScale.clone().multiplyScalar(0.7) : 
                new THREE.Vector2(0.7, 0.7);
        }
        
        return mediumMaterial;
    }

    // Create low LOD material (heavily simplified)
    createLowLODMaterial(originalMaterial) {
        if (!originalMaterial) return originalMaterial;
        
        // Create a much simpler material for distant objects
        const lowMaterial = new THREE.MeshBasicMaterial({
            color: this.getAverageColor(originalMaterial),
            transparent: originalMaterial.transparent,
            opacity: originalMaterial.opacity
        });
        
        // If original has a main texture, use it but simplified
        if (originalMaterial.map) {
            lowMaterial.map = originalMaterial.map;
            lowMaterial.map.minFilter = THREE.NearestFilter;
            lowMaterial.map.magFilter = THREE.NearestFilter;
        }
        
        return lowMaterial;
    }

    // Extract average color from material for low LOD fallback
    getAverageColor(material) {
        if (material.color) return material.color;
        if (material.emissive) return material.emissive;
        return new THREE.Color(0x888888); // Default gray
    }

    // Main update function - call this every frame
    update() {
        this.frameCount++;
        
        // Reset stats
        this.stats = {
            totalObjects: this.objectCache.size,
            culledObjects: 0,
            highLOD: 0,
            mediumLOD: 0,
            lowLOD: 0,
            renderCalls: 0
        };
        
        // Update camera frustum
        this.updateCameraFrustum();
        
        // Process each registered object
        for (const [id, lodData] of this.objectCache) {
            this.processObject(id, lodData);
        }
        
        // Log performance stats occasionally
        if (this.frameCount % 60 === 0) {
            this.logStats();
        }
    }

    // Update the camera frustum for culling tests
    updateCameraFrustum() {
        // Combine camera's projection and view matrices
        this.cameraMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        
        // Extract frustum planes from the combined matrix
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }

    // Process a single object for culling and LOD
    processObject(id, lodData) {
        const mesh = lodData.mesh;
        
        // Skip if object doesn't exist or is already hidden by user
        if (!mesh || !mesh.parent) return;
        
        // Update world matrix if needed
        if (mesh.matrixWorldNeedsUpdate) {
            mesh.updateMatrixWorld();
            this.computeBoundingSphere(mesh);
        }
        
        // 1. FRUSTUM CULLING
        const isInFrustum = this.isObjectInFrustum(mesh);
        
        if (!isInFrustum && lodData.allowCulling) {
            // Object is outside camera view - cull it
            mesh.visible = false;
            lodData.isVisible = false;
            this.stats.culledObjects++;
            return;
        }
        
        // Object is visible, make sure it's enabled
        mesh.visible = true;
        lodData.isVisible = true;
        
        // 2. LOD SELECTION
        if (lodData.useLOD) {
            this.updateObjectLOD(mesh, lodData);
        }
        
        this.stats.renderCalls++;
    }

    // Test if object is within camera frustum
    isObjectInFrustum(mesh) {
        // Get cached bounding sphere
        const boundingSphere = this.boundingSpheres.get(mesh.uuid);
        
        if (!boundingSphere) {
            // Fallback to bounding box test if sphere not available
            return this.frustum.intersectsObject(mesh);
        }
        
        // Sphere test is faster than box test
        return this.frustum.intersectsSphere(boundingSphere);
    }

    // Update LOD for a specific object
    updateObjectLOD(mesh, lodData) {
        // Calculate distance from camera to object
        const distance = this.camera.position.distanceTo(mesh.position);
        
        let newLOD = 'high';
        
        // Determine appropriate LOD level
        if (distance > lodData.lodDistances.cull) {
            // Beyond cull distance - hide completely
            mesh.visible = false;
            lodData.isVisible = false;
            this.stats.culledObjects++;
            return;
        } else if (distance > lodData.lodDistances.low) {
            newLOD = 'low';
            this.stats.lowLOD++;
        } else if (distance > lodData.lodDistances.medium) {
            newLOD = 'medium';
            this.stats.mediumLOD++;
        } else {
            newLOD = 'high';
            this.stats.highLOD++;
        }
        
        // Only update material if LOD level changed
        if (newLOD !== lodData.currentLOD) {
            this.applyLODLevel(mesh, lodData, newLOD);
            lodData.currentLOD = newLOD;
        }
    }

    // Apply the appropriate LOD level to an object
    applyLODLevel(mesh, lodData, lodLevel) {
        switch (lodLevel) {
            case 'high':
                mesh.material = lodData.highLODMaterial;
                // Enable all geometry details
                if (mesh.morphTargetInfluences) {
                    // Keep morph targets active
                }
                break;
                
            case 'medium':
                mesh.material = lodData.mediumLODMaterial;
                // Might disable some geometry features
                break;
                
            case 'low':
                mesh.material = lodData.lowLODMaterial;
                // Disable expensive geometry features
                if (mesh.morphTargetInfluences) {
                    // Disable morph targets for performance
                    mesh.morphTargetInfluences.fill(0);
                }
                break;
        }
        
        // Force material update
        mesh.material.needsUpdate = true;
    }

    // Get performance statistics
    getStats() {
        const cullingEfficiency = this.stats.totalObjects > 0 ? 
            (this.stats.culledObjects / this.stats.totalObjects * 100).toFixed(1) : 0;
        
        return {
            ...this.stats,
            cullingEfficiency: `${cullingEfficiency}%`,
            frameRate: this.getFPS()
        };
    }

    // Simple FPS calculation
    getFPS() {
        // This is a simplified version - you might want a more sophisticated FPS counter
        return Math.round(1000 / (performance.now() - (this.lastFrameTime || performance.now())));
    }

    // Log performance statistics
    logStats() {
        const stats = this.getStats();
        console.log('Culling & LOD Stats:', {
            'Total Objects': stats.totalObjects,
            'Culled': `${stats.culledObjects} (${stats.cullingEfficiency})`,
            'High LOD': stats.highLOD,
            'Medium LOD': stats.mediumLOD,
            'Low LOD': stats.lowLOD,
            'Render Calls': stats.renderCalls
        });
    }

    // Remove an object from management
    unregisterObject(meshOrId) {
        const id = typeof meshOrId === 'string' ? meshOrId : meshOrId.uuid;
        this.objectCache.delete(id);
        this.boundingSpheres.delete(id);
    }

    // Clean up resources
    dispose() {
        // Dispose of created materials
        for (const [id, lodData] of this.objectCache) {
            if (lodData.mediumLODMaterial && lodData.mediumLODMaterial !== lodData.originalMaterial) {
                lodData.mediumLODMaterial.dispose();
            }
            if (lodData.lowLODMaterial && lodData.lowLODMaterial !== lodData.originalMaterial) {
                lodData.lowLODMaterial.dispose();
            }
        }
        
        this.objectCache.clear();
        this.boundingSpheres.clear();
    }
}

class SafeTextureLODManager {
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

function setupOptimizedTextureSystem(gltfScene, scene, camera) {
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
        const HIGH_QUALITY_DISTANCE = 50;
        const LOW_QUALITY_DISTANCE = 150;
        
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

function isFogCompatibleMaterial(material) {
    return (
        material.isMeshStandardMaterial ||
        material.isMeshBasicMaterial ||
        material.isMeshPhysicalMaterial ||
        material.isMeshLambertMaterial ||
        material.isMeshPhongMaterial
    );
}

// This class helps with updating the projection matrix when changing camera near/far values
class MinMaxGUIHelper {
    constructor(obj, minProp, maxProp, minDif) {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
        this.minDif = minDif;
    }
    get min() {
        return this.obj[this.minProp];
    }
    set min(v) {
        this.obj[this.minProp] = v;
        this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
        this.obj.updateProjectionMatrix(); // Update projection matrix when near changes
    }
    get max() {
        return this.obj[this.maxProp];
    }
    set max(v) {
        this.obj[this.maxProp] = v;
        this.min = this.min;  // This calls the min setter above, which includes updateProjectionMatrix
    }
}

// This is the color gui for the directional light
class ColorGUIHelper {
    constructor(object, prop) {
        this.object = object;
        this.prop = prop;
    }
    get value() {
        return `#${this.object[this.prop].getHexString()}`;
    }
    set value(hexString) {
        this.object[this.prop].set(hexString);
    }
}

// This is the gui for fog to control legit everything
class FogGUIHelper {
    constructor(fog, camera) {
        this.fog = fog;
        this.camera = camera;
    }
    get near() {
        return this.fog.near;
    }
    set near(v) {
        this.fog.near = v;
        this.fog.far = Math.max(this.fog.far, v);
    }
    get far() {
        return this.fog.far;
    }
    set far(v) {
        this.fog.far = v;
        this.fog.near = Math.min(this.fog.near, v);
    }
    get density() {
        return this.fog.density;
    }
    set density(v) {
        this.fog.density = v;
    }
    get color() {
        return `#${this.fog.color.getHexString()}`;
    }
    set color(hexString) {
        this.fog.color.set(hexString);
    }
}

//The object for the popUp mainly its detection circle
class popUpCircle {
    constructor(posX, posY, posZ, radius) {

        this.cameraInside = false;

        this.position = new THREE.Vector3(posX, posY, posZ);

        this.geometryRadius = radius;

        this.circleObject = null;
    }

    createSphereRadius(scene) {
        if(this.circleObject) scene.remove(this.circleObject);

        const newSphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x00C6FF,
            opacity: 0.5,
            transparent: true,
            wireframe: true,
        });

        const geometry = new THREE.CircleGeometry(this.geometryRadius);

        this.circleObject = new THREE.Mesh(geometry, newSphereMaterial);
        this.circleObject.position.set(this.position.x, this.position.y, this.position.z);
        this.circleObject.rotation.x = (90 * Math.PI) / 180;

        scene.add(this.circleObject);
        return(this.circleObject);
    }

    checkForIntersection(camera) {
        const cameraPosition = new THREE.Vector3();
        camera.getWorldPosition(cameraPosition);

        const sphereCenter = this.circleObject.position.clone();

        const distance = cameraPosition.distanceTo(sphereCenter);

        if (distance < this.geometryRadius) {
            this.cameraInside = true;
        } else if ( distance >= this.geometryRadius) {
            this.cameraInside = false;
        }
    }
}

// Pop Up Object functionality
const PopupManager = {

    overlay: document.getElementById('popup'),
    container: document.querySelector('.popup-container'),
    title: document.getElementById('popup-title'),
    content: document.getElementById('popup-content'),

    popUpActive: false,

    // This just unhides the pop up nothing special
    show: function(title = 'Popup', content = '') {

        this.title.textContent = title;

        this.content.innerHTML = content;

        this.overlay.style.display = 'block';
        this.overlay.classList.add('show');
        this.container.classList.add('show');

        document.body.style.overflow = 'hidden';
        document.body.style.cursor = 'default';
    },

    // self explanatory...
    hide: function() {

        this.overlay.classList.remove('show');
        this.container.classList.remove('show');

        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 300);

        document.body.style.overflow = 'auto';

        document.body.style.cursor = 'none';
    },

    // This basically is where it defines if it is a image or text pop up. Can be edited to do anything tbh
    generatePopup: function(title, config) {
        let content = '';

        if (config.text) {
            content += `<p>${config.text}</p>`;
        }

        if (config.image) {
            content += `<img src="${config.image.src}" alt="${config.image.alt || ''}">`;
            if (config.image.caption) {
                content += `<p><em>${config.image.caption}</em></p>`;
            }
        }

        if (config.html) {
            content += config.html;
        }
        
        this.show(title, content);
    }
};

function closePopup() {
    setTimeout(() => {
        PopupManager.hide();
    }, 300);
    PopupManager.popUpActive = false;
}

//This is the barrier box object
class boundaryBox {
    constructor(minX, maxX, minY, maxY, minZ, maxZ) {
        this.min = new THREE.Vector3(minX, minY, minZ);
        this.max = new THREE.Vector3(maxX, maxY, maxZ);

        this.center = new THREE.Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        this.rotationParams = {
            x: 0,
            y: (-2 * Math.PI) / 180,
            z: 0,
            xDegrees: 0,
            yDegrees: -2,
            zDegrees: 0
        };

        this.visualizationMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });


        this.boundaryBox = null;

        this.worldToLocal = new THREE.Matrix4();
        this.localToWorld = new THREE.Matrix4();
        this.updateTransformationMatrices();
    }

    updateRotation() {
        this.boundaryBox.rotation.x = this.rotationParams.x;
        this.boundaryBox.rotation.y = this.rotationParams.y;
        this.boundaryBox.rotation.z = this.rotationParams.z;

        this.updateTransformationMatrices();
    }

    // I will be so real, the rotation got so complex so quick,
    // I didnt even realize it was going to need linear algebra to properly rotate it
    // I havent even taken that yet, and I had claude try and teach me it and my brain hurt really bad.
    // I asked him why the boundary box visualization was rotating but the boundary itself wasnt.
    // Then I got a lecture on linear algebra and it hurt my brain.
    // This method creates the mathematical relationship between world coordinates
    // and the boundary box's local coordinate system
    updateTransformationMatrices() {
        // Create rotation matrix from our rotation parameters
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(new THREE.Euler(
            this.rotationParams.x,
            this.rotationParams.y,
            this.rotationParams.z,
            'XYZ'
        ));
        
        // Create translation matrix to move to/from the boundary center
        const centerTranslation = new THREE.Matrix4();
        centerTranslation.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        
        const centerTranslationInverse = new THREE.Matrix4();
        centerTranslationInverse.makeTranslation(this.center.x, this.center.y, this.center.z);
        
        // World to Local: translate to origin, then apply inverse rotation
        this.worldToLocal.multiplyMatrices(rotationMatrix.clone().invert(), centerTranslation);
        
        // Local to World: apply rotation, then translate back
        this.localToWorld.multiplyMatrices(centerTranslationInverse, rotationMatrix);
    }

    setRotationDegrees(x, y, z) {
        this.rotationParams.xDegrees = x;
        this.rotationParams.yDegrees = y;
        this.rotationParams.zDegrees = z;

        this.rotationParams.x = (x * Math.PI) / 180;
        this.rotationParams.y = (y * Math.PI) / 180;
        this.rotationParams.z = (z * Math.PI) / 180;

        this.updateRotation();
    }

    // Create a visible box to represent the boundary (for debugging)
    createVisualization(scene) {
        if (this.boundaryBox) scene.remove(this.boundaryBox);
        
        const geometry = new THREE.BoxGeometry(
        this.max.x - this.min.x,
        this.max.y - this.min.y,
        this.max.z - this.min.z
        );
        
        this.boundaryBox = new THREE.Mesh(geometry, this.visualizationMaterial);
        this.boundaryBox.position.set(
        (this.max.x + this.min.x) / 2,
        (this.max.y + this.min.y) / 2,
        (this.max.z + this.min.z) / 2
        );

        this.updateRotation();
        scene.add(this.boundaryBox);
        return this.boundaryBox;
    }

    // Transform a world position into the boundary box's local coordinate system
    worldToLocalPosition(worldPosition) {
        const localPosition = worldPosition.clone();
        localPosition.applyMatrix4(this.worldToLocal);
        return localPosition;
    }
    
    // Transform a local position back to world coordinates
    localToWorldPosition(localPosition) {
        const worldPosition = localPosition.clone();
        worldPosition.applyMatrix4(this.localToWorld);
        return worldPosition;
    }

    // Check if a position is within bounds, accounting for rotation
    isInBounds(worldPosition) {
        // Convert world position to local coordinate system
        const localPosition = this.worldToLocalPosition(worldPosition);
        
        // Now check bounds in the local coordinate system
        // In local space, our bounds are always axis-aligned
        const localMin = this.min.clone().sub(this.center);
        const localMax = this.max.clone().sub(this.center);
        
        return (
            localPosition.x >= localMin.x && localPosition.x <= localMax.x &&
            localPosition.y >= localMin.y && localPosition.y <= localMax.y &&
            localPosition.z >= localMin.z && localPosition.z <= localMax.z
        );
    }

    // Clamp a position to stay within bounds, accounting for rotation
    clampPosition(worldPosition) {
        // Convert to local coordinates
        const localPosition = this.worldToLocalPosition(worldPosition);
        
        // Clamp in local space where bounds are axis-aligned
        const localMin = this.min.clone().sub(this.center);
        const localMax = this.max.clone().sub(this.center);
        
        localPosition.x = Math.max(localMin.x, Math.min(localMax.x, localPosition.x));
        localPosition.y = Math.max(localMin.y, Math.min(localMax.y, localPosition.y));
        localPosition.z = Math.max(localMin.z, Math.min(localMax.z, localPosition.z));
        
        // Convert back to world coordinates
        return this.localToWorldPosition(localPosition);
    }

    // This function for this class was made by claude 
    // I couldnt figure out how to properly check the position in the render
    // due to how the movement worked and I didnt wanna have to change the movement or anything
    // so I asked claude if there was a better way and who just spat this out and it works
    // really well
    // Apply constraints to the camera position
    constrainCamera(camera, previousPosition = null) {
        // Check if the current camera position is within bounds
        if (!this.isInBounds(camera.position)) {
            if (previousPosition && this.isInBounds(previousPosition)) {
                // If we have a previous valid position, revert to it
                camera.position.copy(previousPosition);
            } else {
                // Otherwise, clamp to the nearest valid position
                const clampedPos = this.clampPosition(camera.position);
                camera.position.copy(clampedPos);
            }
            return true; // Bounds were enforced
        }
        return false; // No bounds enforcement was necessary
    }
}

// Same with this function, I originally had one like this but I couldnt quite figure out how to
// setup a way to check the position before actually moving the camera, and then claude spat this out
// and I didnt even think about changing the actual code of the libaray itself to make it do it for me
// SMH i need more coffee cause the answer was so simple yet I couldnt think about it
// Function to integrate with existing PointerLockControls
function setupCameraBoundaries(scene, camera, controls) {
  // Create boundaries - adjust these values to match your scene
  const boundary = new boundaryBox(-62, -35, 32, 32, -34, 84);
  
  // Uncomment to visualize for debugging
  boundary.createVisualization(scene);
  
  // Store the previous valid position
  let lastValidPosition = camera.position.clone();
  
  // Original moveRight and moveForward functions
  const originalMoveRight = controls.moveRight;
  const originalMoveForward = controls.moveForward;
  const originalMouseMove = controls.onMouseMove;
  
  // Override the movement functions to add boundary checks
  controls.moveRight = function(distance) {
    // Store the current position before movement
    lastValidPosition.copy(camera.position);
    
    // Call the original function
    originalMoveRight.call(this, distance);
    
    // Check if new position is valid
    boundary.constrainCamera(camera, lastValidPosition);
  };
  
  controls.moveForward = function(distance) {
    // Store the current position before movement
    lastValidPosition.copy(camera.position);
    
    // Call the original function
    originalMoveForward.call(this, distance);
    
    // Check if new position is valid
    boundary.constrainCamera(camera, lastValidPosition);
  };

  controls.onMouseMove = function(event) {
    if ( middleMouseClicked ) {
        return;
    }

    originalMouseMove.call(this, event);
  }
  
  return boundary;
}

const informationArray = [
    // This is the sample for the popUps, you can use these however you want. 
    // I am hoping maybe in the future I could setup like a gallery type popup
    // that has multiple images that you can scroll through or maybe
    // a fully custom popup that can be designed anyway you want 
    // text: '',
    // image: {
    //     src: '',
    //     alt: '',
    //     caption: ''
    // },
    // html: 
    {
        text: 'Hopefully I can get this to work',
        image: {
            src: 'https://picsum.photos/350/200',
            alt: 'Filler Image',
            caption: 'Cool images'
        },
        html: '<p><strong>This is a test!</strong></p>'
    },
    {
        text: 'Bill\'s Cleaners is cool',
        image: {
            src: 'https://picsum.photos/350/200',
            alt: 'Filler Image',
            caption: 'Cool images'
        },
        html: '<p><strong>Heard he was good at bowling!</strong></p>'
    },
    {
        text: 'Pool, Beer, and Dominos!',
        image: {
            src: 'https://picsum.photos/350/200',
            alt: 'Filler Image',
            caption: 'Cool images'
        },
        html: '<p><strong>The fan was a pain I heard</strong></p>'
    },
    {
        text: 'Records!',
        image: {
            src: 'https://picsum.photos/350/200',
            alt: 'Filler Image',
            caption: 'Cool images'
        },
        html: '<p><strong>Lots of goooood music here</strong></p>'
    }
]

function main() {
    setupCustomFogShaders(); // Use the fixed version from above

    
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    const baseURL = 'https://storage.googleapis.com/fairgrounds-model/';

    let skyBoxTextures;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    let isGUIMode = false;
    let guiFocused = false;

    let cameraEuler = new Euler( 0, 0, 0, 'YXZ' );

    let cameraBoundarySystem;
    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // Loading UI setup
    const loadingDiv = document.createElement('div');
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.background = 'rgba(0,0,0,0.7)';
    loadingDiv.style.color = 'white';
    loadingDiv.style.borderRadius = '5px';
    loadingDiv.style.zIndex = '1000';
    loadingDiv.textContent = 'Loading model (0%)...';
    document.body.appendChild(loadingDiv);

    const blocker = document.getElementById( 'blocker' );
    const instructions = document.getElementById( 'instructions' );
    let instructionsActive = true;

    // Camera setup
    const fov = 55;
    const aspect = 2;
    const near = 0.1;
    const far = 650;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(-53.35, 32, 4.64);

    const scene = new THREE.Scene();
    const gui = new GUI();
    
    // Store shaders that need to be updated with fogTime
    const shaders = [];

    // Modified ModifyShader function with error handling
    const ModifyShader = (shader) => {
        try {
            shaders.push(shader);
            shader.uniforms.fogTime = { value: 0.0 };
        } catch (error) {
            console.warn('Failed to modify shader:', error);
        }
    };

    function setupOptimizedRendering(scene, camera, renderer) {
        // Create the culling/LOD manager
        const cullingLODManager = new AdvancedCullingLODManager(camera, renderer);
        
        // Store reference globally so we can use it after model loads
        window.cullingLODManager = cullingLODManager;
        
        return cullingLODManager;
    }

    // Camera GUI controls
    const cameraResetButton = {
        reset_position: function() {
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
    cameraFolder.open();

    // Pointer lock controls
    const controls = new PointerLockControls(camera, canvas);
    controls.maxPolarAngle = (120 * Math.PI) / 180;
    controls.minPolarAngle = (60 * Math.PI) / 180;

    // Starter instructions/fully locked
    instructions.addEventListener( 'click', function () {
        if (!isGUIMode && !PopupManager.popUpActive) {
            controls.lock();
            instructionsActive = false;
            instructions.style.display = 'none';
            blocker.style.display = 'none';
        }
    });

    // Close popup listener
    document.getElementById('popup').addEventListener('click', function(e) {
        if (e.target === this) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // The X on the popup listener
    document.getElementById('popup-close-btn').addEventListener('click', function(e) {
        if (e.target === this) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // Unlock listener that checks if instructions needs to be activated
    controls.addEventListener( 'unlock', function () {
        controls.unlock();
        console.log('Controls have been unlocked');
        if(!isGUIMode && !PopupManager.popUpActive ) {
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

    scene.add( controls.object );


    // This is to toggle the GUI mode so that you can use your mouse to mess with the GUI
    function toggleGUIMode() {
        isGUIMode = !isGUIMode;

        if ( isGUIMode && !instructionsActive && !PopupManager.popUpActive ) {
            if ( controls.isLocked ) {
                controls.unlock();
            }
            console.log('GUI Mode: Activated - Mouse is now free for GUI interaction');
            updateGUIVisibility();
        } else if(!instructionsActive && !PopupManager.popUpActive ) {  
            blurAllGUIElements();
            controls.lock();
            console.log('GUID Mode: Deactivated - Camera Controls active');
            updateGUIVisibility();
        }
    }

    function blurAllGUIElements() {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        
        const guiInputs = document.querySelectorAll('.lil-gui input, .lil-gui select, .lil-gui button');
        guiInputs.forEach(element => {
            if (element === document.activeElement) {
                element.blur();
            }
        });
        
        canvas.focus();
    }

    function updateGUIVisibility() {
        const guiElements = document.querySelectorAll('.lil-gui');
        guiElements.forEach(element => {
            if (isGUIMode) {
                element.style.pointerEvents = 'auto';
                element.style.opacity = '1';
                document.getElementById('interactionBlocker').style.display = 'none';
                document.getElementById('interactDesc').style.display = 'none';
            } else {
                element.style.pointerEvents = 'none';
                element.style.opacity = '0.3';
            }
        });

        document.body.style.cursor = isGUIMode ? 'default' : 'none';
    }

    function resetMovementState() {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        velocity.set(0, 0, 0);
        direction.set(0, 0, 0);
    }

    // Function to check if an element is a GUI element 
    function isGUIElement(element) {
        while (element && element !== document.body) {
            if (element.matches('input[type="range"]') || 
                element.classList.contains('slider') ||
                element.classList.contains('range')) {
                return false; 
            }
            if (element.matches('.lil-gui, .lil-gui *, .dg, .dg *')) {
                return true;
            }
            if (element.classList && (
                element.classList.contains('lil-gui') ||
                element.classList.contains('controller') ||
                element.classList.contains('title') ||
                element.classList.contains('folder') ||
                element.classList.contains('dg') ||
                element.classList.contains('property-name') ||
                element.classList.contains('c')
            )) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    document.addEventListener('focusout', (event) => {
        console.log('Unfocus target:', event.target);
        
        if (isGUIElement(event.target)) {
            console.log('GUI element unfocused');
            guiFocused = false;

            setTimeout(() => {
                if (!guiFocused) {
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
            guiFocused = true;
            
            // Reset all movement
            resetMovementState();
        }
    });

    //This is the movement event function for the keys when they go up and down
    const onKeyDown = function ( event ) {

        if (guiFocused) return;

        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
        }
    };

    const rotateTheCamera = function ( event ) {
        if (guiFocused) return;

        switch (event.code) {
            case isGUIMode && 'KeyQ':
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= -0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;

            case isGUIMode && 'KeyE':
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= 0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;
        }
    }
    const onKeyUp = function ( event ) {

        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );
    document.addEventListener( 'keydown', rotateTheCamera);

    document.addEventListener('mousedown', (event) => {
        if (event.button === 1) {
            event.preventDefault();
            toggleGUIMode();
            return;
        }

        if (isGUIElement(event.target)) {
            console.log('GUI element clicked:', event.target);
            guiFocused = true;
            resetMovementState();
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (event.target === canvas || !isGUIElement(event.target)) {
            if (guiFocused) {
                console.log('Clicked outside GUI - clearing focus state');
                guiFocused = false;
                resetMovementState();
            }
        }
    });

    const cullingLODManager = setupOptimizedRendering(scene, camera, renderer);
    
    // Add GUI controls for the culling system
    const optimizationFolder = gui.addFolder('Performance Optimization');
    
    // LOD distance controls
    const lodControls = {
        highLODDistance: 25,
        mediumLODDistance: 75,
        lowLODDistance: 100,
        cullDistance: 150,
        enableCulling: true,
        enableLOD: true
    };
    
    optimizationFolder.add(lodControls, 'highLODDistance', 10, 200).onChange(() => {
        // Update all objects with new distances
        if (window.cullingLODManager) {
            for (const [id, lodData] of window.cullingLODManager.objectCache) {
                lodData.lodDistances.high = lodControls.highLODDistance;
                lodData.lodDistances.medium = lodControls.mediumLODDistance;
                lodData.lodDistances.low = lodControls.lowLODDistance;
                lodData.lodDistances.cull = lodControls.cullDistance;
            }
        }
    });
    
    optimizationFolder.add(lodControls, 'mediumLODDistance', 50, 400).onChange(() => {
        // Update logic same as above
    });
    
    optimizationFolder.add(lodControls, 'enableCulling').onChange((value) => {
        if (window.cullingLODManager) {
            for (const [id, lodData] of window.cullingLODManager.objectCache) {
                lodData.allowCulling = value;
            }
        }
    });
    
    // Performance stats display
    const perfStats = { showStats: false };
    optimizationFolder.add(perfStats, 'showStats').onChange((value) => {
        if (value) {
            // Show stats every second
            setInterval(() => {
                if (window.cullingLODManager) {
                    console.table(window.cullingLODManager.getStats());
                }
            }, 1000);
        }
    });
    
    optimizationFolder.open();

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
        boundaryFolder.open();
    }

    // Intersection pop Circles!
    const popCirclesGUI = gui.addFolder('Popup Circles');
    const theaterGUI = popCirclesGUI.addFolder('Theater Circle');
    const cleanersGUI = popCirclesGUI.addFolder('Bills Circle');
    const dominosGUI = popCirclesGUI.addFolder('Dominos Circle');
    const recordsGUI = popCirclesGUI.addFolder('Records Circle')

    // Theater circle Intersection popup
    const theaterSphere = new popUpCircle(-32, 31, 7, 8);
    theaterSphere.createSphereRadius(scene);
    theaterGUI.add(theaterSphere.position, 'x', -50, 50, 1).onChange((value) => {
        if ( theaterSphere.circleObject) {
            theaterSphere.circleObject.position.x = value;
        }
    });
    theaterGUI.add(theaterSphere.position, 'z', -20, 20, 1).onChange((value) => {
        if ( theaterSphere.circleObject) {
            theaterSphere.circleObject.position.z = value;
        }
    });
    // Bills Cleaners
    const cleanersSphere = new popUpCircle(-35, 31, 32, 4);
    cleanersSphere.createSphereRadius(scene);
    cleanersGUI.add(cleanersSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if ( cleanersSphere.circleObject) {
            cleanersSphere.circleObject.position.x = value;
        }
    });
    cleanersGUI.add(cleanersSphere.position, 'z', -20, 60, 0.1).onChange((value) => {
        if ( cleanersSphere.circleObject) {
            cleanersSphere.circleObject.position.z = value;
        }
    });
    // Dominos place with THE FAN
    const dominosSphere = new popUpCircle(-35.2, 31, 57.8, 3);
    dominosSphere.createSphereRadius(scene);
    dominosGUI.add(dominosSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if ( dominosSphere.circleObject) {
            dominosSphere.circleObject.position.x = value;
        }
    });
    dominosGUI.add(dominosSphere.position, 'z', -20, 60, 0.1).onChange((value) => {
        if ( dominosSphere.circleObject) {
            dominosSphere.circleObject.position.z = value;
        }
    });
    // Records Shop, good music bruh
    const recordsSphere = new popUpCircle(-36, 31, 63, 2);
    recordsSphere.createSphereRadius(scene);
    recordsGUI.add(recordsSphere.position, 'x', -80, 50, 0.1).onChange((value) => {
        if ( recordsSphere.circleObject) {
            recordsSphere.circleObject.position.x = value;
        }
    });
    recordsGUI.add(recordsSphere.position, 'z', -20, 100, 0.1).onChange((value) => {
        if ( recordsSphere.circleObject) {
            recordsSphere.circleObject.position.z = value;
        }
    });

    popCirclesGUI.open();

    const interactListener = function ( event ) {
        if (isGUIMode || instructionsActive) return;

        switch (event.code) {
            case 'KeyF':
                console.log('Interacted!');
                if (theaterSphere.cameraInside) {
                    PopupManager.popUpActive  = true;
                    PopupManager.generatePopup('Theater', informationArray[0]);
                    controls.unlock();
                    event.preventDefault();
                    break;
                }else if (cleanersSphere.cameraInside) {
                    PopupManager.popUpActive  = true;
                    PopupManager.generatePopup('Bills Cleaners', informationArray[1]);
                    controls.unlock();
                    event.preventDefault();
                    break;
                }else if (dominosSphere.cameraInside) {
                    PopupManager.popUpActive  = true;
                    PopupManager.generatePopup('Pool Dominos', informationArray[2]);
                    controls.unlock();
                    event.preventDefault();
                    break;
                }else if (recordsSphere.cameraInside) {
                    PopupManager.popUpActive  = true;
                    PopupManager.generatePopup('Record Shop', informationArray[3]);
                    controls.unlock();
                    event.preventDefault();
                    break;
                } else {
                    break; 
                }  
        }
    }
    document.addEventListener( 'keydown', interactListener);

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
        lightFolder.open();

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
            pinkSky: loader.load('../public/skybox/pink_sunset.png'),
            blueSky: loader.load('../public/skybox/blue_sky.png'),
            nightSky: loader.load('../public/skybox/night_sky.png'),
            okcSunset: loader.load('../public/skybox/oklahoma_sunset.png')
        }
        const imagePath = '../public/skybox/pink_sunset.png';
        loader.load(imagePath, (panoramaTexture) => {
            const skySphereGeometry = new THREE.SphereGeometry(500, 60, 60);

            panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;
            panoramaTexture.colorSpace = THREE.SRGBColorSpace;
            let skySphereMaterial = new THREE.MeshBasicMaterial({
                map: panoramaTexture,
            });

            skySphereMaterial.side = THREE.BackSide;
            skySphereMesh = new THREE.Mesh(skySphereGeometry, skySphereMaterial);
            skySphereMesh.material.onBeforeCompile = ModifyShader;
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
        reader.onload = function(e) {
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
            
            skyboxDropdown.onChange(function(value) {
                skyboxController.changeSkyBox(value);
            });
        }
    }

    // Create the skybox control object with a proper property that holds the current selection
    var skyboxController = {
        // This property will hold the current skybox selection
        currentSkybox: 'pinkSky', // Set the initial value to match what we load by default
        
        // This function handles changing the skybox
        changeSkyBox: function(newTextureName) {
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

    // Separate function to set up the GUI control after the skybox is loaded
    function setupSkyboxGUI() {
        const skyBoxFolder = gui.addFolder('SkyBox');
        
        // Create the dropdown control
        skyboxDropdown = skyBoxFolder.add(skyboxController, 'currentSkybox', ['pinkSky', 'blueSky', 'nightSky', 'okcSunset'])
            .name('Select Skybox');
        
        // Set up the onChange listener to actually change the skybox
        skyboxDropdown.onChange(function(value) {
            skyboxController.changeSkyBox(value);
        });

        const fileController = {
            uploadSkybox: function() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,.hdr';
                input.multiple = true;
                
                input.onchange = function(e) {
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
        
        skyBoxFolder.open(); // Optional: opens the folder by default
    }


    // Fog setup
    scene.fog = new THREE.FogExp2(0xbe9fd4, 0.005);
    const fogFolder = gui.addFolder('Fog');
    const fogGUIHelper = new FogGUIHelper(scene.fog, camera);
    fogFolder.add(fogGUIHelper, 'density', 0, 0.05, 0.0001);
    fogFolder.addColor(fogGUIHelper, 'color');
    fogFolder.open();
    updateGUIVisibility();

    // GLTF Model loading with improved error handling
    {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        dracoLoader.setDecoderConfig({ type: 'js'});
        dracoLoader.preload();

        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(
            baseURL + 'fairgrounds.glb',
            (glb) => {
                try {
                    loadingDiv.style.display = 'none';
                    const root = glb.scene;

                    const updateTextureQuality = setupOptimizedTextureSystem(root, scene, camera);
                    window.updateTextureQuality = updateTextureQuality;

                    // Enhanced object registration with better road detection
                    let meshCount = 0;
                    let roadCount = 0;
                    const registeredObjects = [];

                    console.log('=== SCANNING FOR OBJECTS ===');
                    
                    root.traverse((child) => {
                        if (child.isMesh && child.material) {
                            meshCount++;
                            const name = child.name.toLowerCase();
                            const isRoad = (
                                name.includes('roads') ||
                                name.includes('Plane') ||
                                // Check if material name suggests it's a road
                                (child.material && child.material.name && 
                                child.material.name.toLowerCase().includes('road'))
                            );

                            let lodOptions = {};
                            let objectType = 'generic';
                            // Roads
                            if (isRoad) {
                                roadCount++;
                                objectType = 'road';
                                
                                lodOptions = {
                                    allowCulling: false, 
                                    useLOD: true,
                                    lodDistances: {
                                        high: 200,  
                                        medium: 500,  
                                        low: 1000,  
                                        cull: 2000    
                                    }
                                };
                            }
                            // Buildings and large structures
                            else if (name.includes('building') || 
                                    name.includes('structure') ||
                                    name.includes('house') ||
                                    name.includes('tower')) {
                                objectType = 'building';
                                lodOptions = {
                                    lodDistances: {
                                        high: 40,
                                        medium: 100,
                                        low: 200,
                                        cull: 400
                                    }
                                };
                            }
                            // Small details and decorations
                            else if (name.includes('detail') || 
                                    name.includes('decoration') ||
                                    name.includes('prop') ||
                                    name.includes('ornament')) {
                                objectType = 'detail';
                                lodOptions = {
                                    lodDistances: {
                                        high: 30,
                                        medium: 80,
                                        low: 150,
                                        cull: 300
                                    }
                                };
                            }
                            // Terrain and ground objects
                            else if (name.includes('ground') || 
                                    name.includes('terrain') ||
                                    name.includes('landscape')) {
                                objectType = 'terrain';
                                lodOptions = {
                                    allowCulling: false, 
                                    lodDistances: {
                                        high: 100,
                                        medium: 300,
                                        low: 600,
                                        cull: 1200
                                    }
                                };
                            }
                            
                            // Register the object with the LOD manager
                            try {
                                const objectId = window.cullingLODManager.registerObject(child, lodOptions);
                                registeredObjects.push({
                                    id: objectId,
                                    name: child.name,
                                    type: objectType,
                                    options: lodOptions
                                });
                            } catch (error) {
                                console.error(`Failed to register object "${child.name}":`, error);
                            }

                            // Apply fog shaders with better error handling
                            try {
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach((mat, index) => {
                                    if (isFogCompatibleMaterial(mat)) {
                                        mat.onBeforeCompile = ModifyShader;
                                    } else {
                                        console.log(`Skipped fog shader for ${child.name} material ${index} (incompatible type: ${mat.type})`);
                                    }
                                });
                            } catch (error) {
                                console.warn(`Failed to apply shader to "${child.name}":`, error);
                            }
                        }
                    });

                    // Summary logging
                    console.log('=== REGISTRATION SUMMARY ===');
                    console.log(`Total meshes found: ${meshCount}`);
                    console.log(`Roads detected: ${roadCount}`);
                    console.log(`Objects registered: ${registeredObjects.length}`);

                    scene.add(root);
                    console.log(dumpObject(root).join('\n'));
                    
                    setupBoundaries();
                    blocker.style.display = '';
                    instructions.style.display = '';

                    dracoLoader.dispose();
                    
                } catch (error) {
                    console.error('Error processing loaded model:', error);
                    loadingDiv.textContent = 'Error processing model. Check console for details.';
                    loadingDiv.style.background = 'rgba(255,0,0,0.7)';

                    dracoLoader.dispose();
                }
            },
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                    loadingDiv.textContent = `Loading model (${percentComplete}%)...`;
                    if (blocker.style.display === '' && instructions.style.display === '') {
                        instructions.style.display = 'none';
                        blocker.style.display = 'none';
                    }
                }
            },
            (error) => {
                loadingDiv.textContent = 'Error loading model. Check console for details.';
                loadingDiv.style.background = 'rgba(255,0,0,0.7)';
                console.error('Error loading model:', error);

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
            if (!controls.isLocked && !isGUIMode) {
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
            
            // Update fog time in all shaders with error handling
            for (let s of shaders) {
                try {
                    if (s.uniforms && s.uniforms.fogTime) {
                        s.uniforms.fogTime.value = totalTime;
                    }
                } catch (error) {
                    console.warn('Error updating shader uniform:', error);
                }
            }

            const pointLockTime = performance.now();

            if ( controls.isLocked === true && !isGUIMode) {
                theaterSphere.checkForIntersection(camera);
                cleanersSphere.checkForIntersection(camera);
                dominosSphere.checkForIntersection(camera);
                recordsSphere.checkForIntersection(camera);
                let theCameraInside = (theaterSphere.cameraInside || cleanersSphere.cameraInside || dominosSphere.cameraInside || recordsSphere.cameraInside) ? true : false;
                if (theCameraInside) {
                    document.getElementById('interactionBlocker').style.display = 'block';
                    document.getElementById('interactDesc').style.display = 'flex';
                } else if (document.getElementById('interactionBlocker').style.display === 'block' && !theCameraInside) {
                    document.getElementById('interactionBlocker').style.display = 'none';
                    document.getElementById('interactDesc').style.display = 'none';
                }
            }

            if ( controls.isLocked === true || isGUIMode  && !PopupManager.popUpActive && !guiFocused){
                const delta = (time - prevTime) / 1000;

                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;

                direction.z = Number(moveForward) - Number(moveBackward);
                direction.x = Number(moveRight) - Number(moveLeft);
                direction.normalize();

                if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
                if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;

                controls.moveRight(-velocity.x * delta);
                controls.moveForward(-velocity.z * delta);
            } else {
                velocity.set(0, 0, 0);
                direction.set(0, 0, 0);
            }

            // Until further notice the culling is being disabled
            // if (window.cullingLODManager) {
            //     window.cullingLODManager.update();
            // }

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