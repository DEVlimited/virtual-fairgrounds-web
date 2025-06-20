//core lirbaries
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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
  
  return boundary;
}

function main() {
    // Set up the custom shader chunks for the advanced fog effect
    THREE.ShaderChunk.fog_fragment = `
    #ifdef USE_FOG
      vec3 fogOrigin = cameraPosition;
      vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
      float fogDepth = distance(vWorldPosition, fogOrigin);

      // f(p) = fbm( p + fbm( p ) )
      vec3 noiseSampleCoord = vWorldPosition * 0.00025 + vec3(
          0.0, 0.0, fogTime * 0.025);
      float noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
      fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
      fogDepth *= fogDepth;

      float heightFactor = 0.05;
      float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
          1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
      fogFactor = saturate(fogFactor);

      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    #endif`;
    
    THREE.ShaderChunk.fog_pars_fragment = _NOISE_GLSL + `
    #ifdef USE_FOG
      uniform float fogTime;
      uniform vec3 fogColor;
      varying vec3 vWorldPosition;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
    #endif`;
    
    //CHATGPT SAVING THE DAY!!!!!
    // I couldnt figure out what the problem was it kept saying shader issue
    // so I looked and looked and looked through my code and the shaders were being properly
    // loaded and setup so I was so confused what the problem was. 
    // so I finally decided im going to ask AI. Claude couldnt figure it out,
    // but my good old homie ChatGPT somehow figured out that i needed to initialize the worldPosition variable in
    // the fog vertex using vec4. I was shocked and honestly relieved. 

    //Prompt to AI -
    // I am currently trying to implement a split view camera into my program as a 
    // test to configure the camera properly. Everything was working fine until I started implementing the camera code. 
    // I am getting this error message and I need you to see if you can configure what it is meaning,
    // also see if you can find the solution if possible.
    // -Error message goes here but it is way to big-
    THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
    #endif`;
    
    THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
    #endif`;

    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    const baseURL = 'https://storage.googleapis.com/fairgrounds-model/';

    let skyBoxTextures;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    let cameraEuler = new Euler( 0, 0, 0, 'YXZ' );

    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    let cameraBoundarySystem;

    const view1Elem = document.querySelector('#view1');
    const view2Elem = document.querySelector('#view2');

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

    const fov = 55;
    const aspect = 2; // the canvas default
    const near = 0.9;
    const far = 650;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(-53.35, 32, 4.64);

    // Create a camera helper for the split view
    const cameraHelper = new THREE.CameraHelper(camera);

    const blocker = document.getElementById( 'blocker' );
    const instructions = document.getElementById( 'instructions' );

    const gui = new GUI();
    
    // Camera controls
    var cameraResetButton = {
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

    // Camera position display
    const cameraPositionElement = document.getElementById('camera-position');
    function updateCameraPosition() {
        const x = camera.position.x;
        const y = camera.position.y;
        const z = camera.position.z;
        if (cameraPositionElement) {
            cameraPositionElement.textContent = `Camera Position: X - ${x.toFixed(2)}, Y - ${y.toFixed(2)}, Z - ${z.toFixed(2)}`;
        }
    }

    const controls = new PointerLockControls(camera, view1Elem);

    // Second camera for the overview
    const camera2 = new THREE.PerspectiveCamera(
        60,  // fov
        2,   // aspect
        0.1, // near
        1000, // far
    );
    camera2.position.set(0, 100, 100);
    camera2.lookAt(0, 0, 0);
    
    const controls2 = new OrbitControls(camera2, view2Elem);
    controls2.target.set(0, 5, 0);
    controls2.update();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('black');
    scene.add(cameraHelper);

    instructions.addEventListener( 'click', function () {
        controls.lock();
    });

    controls.addEventListener( 'lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
    });

    controls.addEventListener( 'unlock', function () {
        instructions.style.display = '';
        blocker.style.display = '';
    });

    scene.add( controls.object );

    const onKeyDown = function ( event ) {

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
                        
            case 'KeyQ':
                // camera.rotation.y += ( (  1 ) * Math.PI ) / 180;q
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= -0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;
            
            case 'KeyE':
                cameraEuler.setFromQuaternion(camera.quaternion);
                cameraEuler.y -= 0.01 * 0.5 * 2;
                camera.quaternion.setFromEuler(cameraEuler);
                break;
        }
    };
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

    // Store shaders that need to be updated with fogTime
    const shaders = [];
    const ModifyShader = (s) => {
        shaders.push(s);
        s.uniforms.fogTime = {value: 0.0};
    };

    function setupBoundaries() {
        cameraBoundarySystem = setupCameraBoundaries(scene, camera, controls);
        
        const boundaryFolder = gui.addFolder('Camera Boundaries');
        boundaryFolder.add(cameraBoundarySystem.min, 'x', -150, 0).name('Min X');
        boundaryFolder.add(cameraBoundarySystem.max, 'x', -100, 0).name('Max X');
        boundaryFolder.add(cameraBoundarySystem.min, 'z', -150, 0).name('Min Z');
        boundaryFolder.add(cameraBoundarySystem.max, 'z', 0, 150).name('Max Z');
        //This is what claude created to setup the rotation GUI
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

    // Function to set scissor for split view
    function setScissorForElement(elem) {
        const canvasRect = canvas.getBoundingClientRect();
        const elemRect = elem.getBoundingClientRect();
        
        // compute a canvas relative rectangle
        const right = Math.min(elemRect.right, canvasRect.right) - canvasRect.left;
        const left = Math.max(0, elemRect.left - canvasRect.left);
        const bottom = Math.min(elemRect.bottom, canvasRect.bottom) - canvasRect.top;
        const top = Math.max(0, elemRect.top - canvasRect.top);
        
        const width = Math.min(canvasRect.width, right - left);
        const height = Math.min(canvasRect.height, bottom - top);
        
        // setup the scissor to only render to that part of the canvas
        const positiveYUpBottom = canvasRect.height - bottom;
        renderer.setScissor(left, positiveYUpBottom, width, height);
        renderer.setViewport(left, positiveYUpBottom, width, height);
        
        // return the aspect
        return width / height;
    }

    // Add hemisphere light
    {
        const skyColor = 0xB1E1FF;
        const groundColor = 0xB97A20;
        const intensity = 2;
        const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        scene.add(light);
    }

    // Add directional light with GUI controls
    {
        const color = 0xFFFFFF;
        const intensity = 5;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(5, 10, 2);
        scene.add(light);
        scene.add(light.target);

        const lightFolder = gui.addFolder('Light');
        lightFolder.addColor(new ColorGUIHelper(light, 'color'), 'value').name('color');
        lightFolder.add(light, 'intensity', 0, 5, 0.01);
        lightFolder.open();
    }

    // Add skybox and GUI Controls
    // I had claude help me figure out what was going wrong. 
    // For some reason even though my code is almost the exact same as his
    // Mine couldnt read the currentSkybox variable, and the min I pasted his into the
    // code it worked perfectly fine.
    let skySphereMesh;
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

    // Create the skybox control object with a proper property that holds the current selection
    var skyboxController = {
        // This property will hold the current skybox selection
        currentSkybox: 'pinkSky', // Set the initial value to match what we load by default
        
        // This function handles changing the skybox
        changeSkyBox: function(newTextureName) {
            if (skySphereMesh && skyBoxTextures[newTextureName]) {
                controls.disconnect();
                document.removeEventListener( 'keydown', onKeyDown );
                document.removeEventListener( 'keyup', onKeyUp );
                setTimeout(() => {
                    skySphereMesh.material.map = skyBoxTextures[newTextureName];
                    skySphereMesh.material.needsUpdate = true;
                }, 100);
                document.addEventListener( 'keydown', onKeyDown );
                document.addEventListener( 'keyup', onKeyUp );
                controls.connect(canvas);
                controls.object.position.copy(camera.position);
                console.log('Skybox changed to:', newTextureName);
            }
        }
    };

    // Separate function to set up the GUI control after the skybox is loaded
    function setupSkyboxGUI() {
        const skyBoxFolder = gui.addFolder('SkyBox');
        
        // Create the dropdown control
        const skyboxDropdown = skyBoxFolder.add(skyboxController, 'currentSkybox', ['pinkSky', 'blueSky', 'nightSky', 'okcSunset'])
            .name('Select Skybox');
        
        // Set up the onChange listener to actually change the skybox
        skyboxDropdown.onChange(function(value) {
            skyboxController.changeSkyBox(value);
        });
        
        skyBoxFolder.open(); // Optional: opens the folder by default
    }

    // Set up fog with GUI controls
    scene.fog = new THREE.FogExp2(0xbe9fd4, 0.005);
    const fogFolder = gui.addFolder('Fog');
    const fogGUIHelper = new FogGUIHelper(scene.fog, camera);
    fogFolder.add(fogGUIHelper, 'density', 0, 0.05, 0.0001);
    fogFolder.addColor(fogGUIHelper, 'color');
    fogFolder.open();

    // Load the GLTF model
    {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load(baseURL + 'fairgrounds.gltf', (gltf) => {
            loadingDiv.style.display = 'none';
            const root = gltf.scene;
            
            // Apply shader modification to all meshes in the scene
            root.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.onBeforeCompile = ModifyShader;
                        });
                    } else {
                        child.material.onBeforeCompile = ModifyShader;
                    }
                }
            });
            
            scene.add(root);
            controls.update();
            setupBoundaries();

            blocker.style.display = '';
            instructions.style.display = '';
        },
        (xhr) => {
            // Progress callback
            if (xhr.lengthComputable) {
                const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                loadingDiv.textContent = `Loading model (${percentComplete}%)...`;
                if (blocker.style.display === '' && instructions.style.display === ''){
                    instructions.style.display = 'none';
                    blocker.style.display = 'none';
                }
            }
        },
        (error) => {
            // Error callback
            loadingDiv.textContent = 'Error loading model. Check console for details.';
            loadingDiv.style.background = 'rgba(255,0,0,0.7)';
            console.error('Error loading model:', error);
        });
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
        // Update fog time for shaders
        if (previousTime === null) {
            previousTime = time;
        }
        const timeElapsed = (time - previousTime) * 0.001;
        totalTime += timeElapsed;
        previousTime = time;
        
        // Update fog time in all shaders
        for (let s of shaders) {
            s.uniforms.fogTime.value = totalTime;
        }

        resizeRendererToDisplaySize(renderer);

        const pointLockTime = performance.now();

        if ( controls.isLocked === true ){

            const delta = ( time - prevTime ) / 1000;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            direction.z = Number( moveForward ) - Number( moveBackward );
            direction.x = Number( moveRight ) - Number( moveLeft );
            direction.normalize();

            if ( moveForward || moveBackward ) velocity.z -= direction.z * 100.0 * delta;
            if ( moveLeft || moveRight ) velocity.x -= direction.x * 100.0 * delta;

            controls.moveRight( - velocity.x * delta );
            controls.moveForward( - velocity.z * delta );
        }

        prevTime = pointLockTime;
    
        // Turn on the scissor
        renderer.setScissorTest(true);
    
        // Render the original view
        {
            const aspect = setScissorForElement(view1Elem);
            blocker.style.width = aspect;
        
            // Adjust the camera for this aspect
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        
            // Don't draw the camera helper in the original view
            cameraHelper.visible = false;
        
            // Render
            renderer.render(scene, camera);
        }
    
        // Render from the 2nd camera
        {
            const aspect = setScissorForElement(view2Elem);
        
            // Adjust the camera for this aspect
            camera2.aspect = aspect;
            camera2.updateProjectionMatrix();
        
            // Draw the camera helper in the 2nd view
            cameraHelper.visible = true;
        
            renderer.render(scene, camera2);
        }

        updateCameraPosition();
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main();