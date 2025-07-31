import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Euler } from 'three';

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
// REFACTORED: Advanced LOD system with NO MATERIAL SWAPPING
// Uses separate LOD mesh instances with visibility toggling
class AdvancedCullingLODManager {
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
        if (this.circleObject) scene.remove(this.circleObject);

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
        return (this.circleObject);
    }

    checkForIntersection(camera) {
    // Add null check at the beginning
    if (!this.circleObject) {
        // Still check distance even without visual object
        const cameraPosition = new THREE.Vector3();
        camera.getWorldPosition(cameraPosition);
        
        const distance = cameraPosition.distanceTo(this.position);
        
        if (distance < this.geometryRadius) {
            this.cameraInside = true;
        } else {
            this.cameraInside = false;
        }
        return;
    }
    // If the circleObject exists, check for intersection
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    const sphereCenter = this.circleObject.position.clone();

    const distance = cameraPosition.distanceTo(sphereCenter);

    if (distance < this.geometryRadius) {
        this.cameraInside = true;
    } else if (distance >= this.geometryRadius) {
        this.cameraInside = false;
    }
}
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
    //boundary.createVisualization(scene);

    // Store the previous valid position
    let lastValidPosition = camera.position.clone();

    // Original moveRight and moveForward functions
    const originalMoveRight = controls.moveRight;
    const originalMoveForward = controls.moveForward;
    const originalMouseMove = controls.onMouseMove;

    // Override the movement functions to add boundary checks
    controls.moveRight = function (distance) {
        // Store the current position before movement
        lastValidPosition.copy(camera.position);

        // Call the original function
        originalMoveRight.call(this, distance);

        // Check if new position is valid
        boundary.constrainCamera(camera, lastValidPosition);
    };

    controls.moveForward = function (distance) {
        // Store the current position before movement
        lastValidPosition.copy(camera.position);

        // Call the original function
        originalMoveForward.call(this, distance);

        // Check if new position is valid
        boundary.constrainCamera(camera, lastValidPosition);
    };

    controls.onMouseMove = function (event) {
        if (middleMouseClicked) {
            return;
        }

        originalMouseMove.call(this, event);
    }

    return boundary;
}

function main() {
    setupCustomFogShaders();

    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    const baseURL = 'https://storage.googleapis.com/fairgrounds-model/';

    let skyBoxTextures;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    let rotateLeft = false;
    let rotateRight = false;
    let rotationVelocity = 0;

    let isGUIMode = false;
    let guiFocused = false;

    let cameraEuler = new Euler(0, 0, 0, 'YXZ');

    const testAudio = new Audio('../public/audio/eastsideTheatre1.mp3');
    testAudio.addEventListener('canplay', () => console.log('File is playable'));
    testAudio.addEventListener('error', (e) => console.error('File error:', e));

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
        
        toggleBoundaryBox: function() {
            if (this.showBoundaryBox) {
                cameraBoundarySystem.createVisualization(scene);
            } else {
                if (cameraBoundarySystem.boundaryBox) {
                    scene.remove(cameraBoundarySystem.boundaryBox);
                }
            }
        },
        
        togglePopupCircles: function() {
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

    setupCarouselGUI(gui);

    const PopupManager = {
        overlay: document.getElementById('popup'),
        container: document.querySelector('.popup-container'),
        title: document.getElementById('popup-title'),
        content: document.getElementById('popup-content'),
        
        popUpActive: false,
        currentImageIndex: 0,
        currentImages: [],
        currentLocation: null,
        autoplayInterval: null,
        autoplayEnabled: false,
        autoplayDuration: 3000,
        showThumbnails: false,
        transitionType: 'fade',
        
        imageManifest: null,
        tiffCache: new Map(),

        audio: new Audio(),
        
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
        },
        
        getLocationData(locationId) {
            if (this.imageManifest && this.imageManifest.locations) {
                return this.imageManifest.locations.find(loc => loc.id === locationId);
            }
            return null;
        },
        
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
        },
        
        async processImageSource(imageData) {
            if (imageData.type === 'tiff' || imageData.src.toLowerCase().endsWith('.tif') || imageData.src.toLowerCase().endsWith('.tiff')) {
                return await this.convertTiffToCanvas(imageData.src);
            }
            return imageData.src;
        },
        
        show: function (title = 'Popup', content = '') {
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
        },
        
        hide: function () {
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
        },

        initializeAudio: function() {
            
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
        },

        generateAudioHTML: function(locationData) {
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
        },
        
        initializeCarousel: function() {
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
        },
        
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
        },
        
        setupThumbnails: function() {
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
        },
        
        startAutoplay: function() {
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
        },
        
        stopAutoplay: function() {
            if (this.autoplayInterval) {
                clearInterval(this.autoplayInterval);
                this.autoplayInterval = null;
            }
            
            const progressBar = this.content.querySelector('.carousel-progress');
            if (progressBar) {
                progressBar.classList.remove('active');
                progressBar.style.transitionDuration = '0ms';
            }
        },
        
        removeCarouselListeners: function() {
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
        },
        
        showImage: function(index) {
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
        },
        
        nextImage: function() {
            if (this.currentImageIndex < this.currentImages.length - 1) {
                this.showImage(this.currentImageIndex + 1);
            }
        },
        
        previousImage: function() {
            if (this.currentImageIndex > 0) {
                this.showImage(this.currentImageIndex - 1);
            }
        },
        
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
    };

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
        
        //carouselFolder.open();
    }

    // Updated interact listener (place this INSIDE main() after all the sphere creations)
    const interactListener = function (event) {
        if (isGUIMode || instructionsActive) return;
        
        switch (event.code) {
            case 'KeyF':
                console.log('Interacted!');
                if (theaterSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('theater');
                    controls.unlock();
                    event.preventDefault();
                    break;
                } else if (cleanersSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('cleaners');
                    controls.unlock();
                    event.preventDefault();
                    break;
                } else if (dominosSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('dominos');
                    controls.unlock();
                    event.preventDefault();
                    break;
                } else if (recordsSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('records');
                    controls.unlock();
                    event.preventDefault();
                    break;
                } else if (northEndSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('northEnd');
                    controls.unlock();
                    event.preventDefault();
                    break;
                }  else if (southEndSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('southEnd');
                    controls.unlock();
                    event.preventDefault();
                    break;
                }
        }
    };

    // Add the event listener for interactions
    document.addEventListener('keydown', interactListener);

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
        if (!isGUIMode && !PopupManager.popUpActive) {
            controls.lock();
            instructionsActive = false;
            instructions.style.display = 'none';
            blocker.style.display = 'none';
        }
    });

    // Close popup listener
    document.getElementById('popup').addEventListener('click', function (e) {
        if (e.target === this) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // The X on the popup listener
    document.getElementById('popup-close-btn').addEventListener('click', function (e) {
        if (e.target === this) {
            closePopup();
            controls.lock();
            PopupManager.popUpActive = false;
        }
    });

    // Unlock listener that checks if instructions needs to be activated
    controls.addEventListener('unlock', function () {
        controls.unlock();
        console.log('Controls have been unlocked');
        if (!isGUIMode && !PopupManager.popUpActive) {
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
        //scene.add(controls.object);


    // This is to toggle the GUI mode so that you can use your mouse to mess with the GUI
    function toggleGUIMode() {
        isGUIMode = !isGUIMode;

        if (isGUIMode && !instructionsActive && !PopupManager.popUpActive) {
            if (controls.isLocked) {
                controls.unlock();
            }
            console.log('GUI Mode: Activated - Mouse is now free for GUI interaction');
            updateGUIVisibility();
        } else if (!instructionsActive && !PopupManager.popUpActive) {
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
    const onKeyDown = function (event) {

        if (guiFocused) return;

        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'KeyD':
                moveRight = true;
                break;
            case 'KeyQ':
            case 'ArrowLeft':
                if (isGUIMode) rotateLeft = true;
                break;
            case 'KeyE':
            case 'ArrowRight':
                if (isGUIMode) rotateRight = true;
                break;
        }
    };

    /*
    const rotateTheCamera = function (event) {
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
        */
    const onKeyUp = function (event) {

        switch (event.code) {
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
            case 'KeyQ':
            case 'ArrowLeft':
                rotateLeft = false;
                break;
            case 'KeyE':
            case 'ArrowRight':
                rotateRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    //document.addEventListener('keydown', rotateTheCamera);

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
    const theaterSphere = new popUpCircle(-32, 31, 7, 8);
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
    const cleanersSphere = new popUpCircle(-35, 31, 32, 4);
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
    const dominosSphere = new popUpCircle(-35.2, 31, 57.8, 3);
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
    const recordsSphere = new popUpCircle(-36, 31, 63, 2);
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
    const northEndSphere = new popUpCircle(-50, 31, -28, 11);
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
    const southEndSphere = new popUpCircle(-52, 31, 86, 11);
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
                    loadingDiv.style.display = 'none';
                    const root = glb.scene;

                    const updateTextureQuality = setupOptimizedTextureSystem(root, scene, camera);
                    window.updateTextureQuality = updateTextureQuality;

                    window.cullingLODManager.injectIntoGLTFScene(root, lodControls);
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
            cullingLODManager.updateFogTimeUniforms(totalTime);

            const pointLockTime = performance.now();

            if (controls.isLocked === true && !isGUIMode) {
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

            if (controls.isLocked === true || isGUIMode && !PopupManager.popUpActive && !guiFocused) {
                const delta = (time - prevTime) / 1000;

                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;

                rotationVelocity -= rotationVelocity * 10.0 * delta;
            
            // Add smooth rotation handling
            if (rotateLeft && isGUIMode) {
                rotationVelocity -= 2.0 * delta;  // Adjust speed as needed
            }
            if (rotateRight && isGUIMode) {
                rotationVelocity += 2.0 * delta;  // Adjust speed as needed
            }

            // Apply rotation
            if (Math.abs(rotationVelocity) > 0.001) {
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y += rotationVelocity * delta;
                camera.quaternion.setFromEuler(cameraEuler);
            }

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