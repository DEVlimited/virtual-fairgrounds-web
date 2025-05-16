import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { update } from 'three/examples/jsm/libs/tween.module.js';

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


//I found this code in the documentation for loading a GLTF File and it helped me a lot with getting 
//it to properly load and find the model
function main() {

	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
    const baseURL = 'https://storage.googleapis.com/fairgrounds-model/';

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
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( -53.35, 34.54, 4.64);

    //currently the best Camera Position: X: -53.35, Y: 31.54, Z: 4.64

    //This is to help create the split view of the main camera
    //Found the code and full documentation on it in the docs for three.js in Cameras section
    const cameraHelper = new THREE.CameraHelper(camera);

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
    
    THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
        vWorldPosition = worldPosition.xyz;
    #endif`;
    
    THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
        varying vec3 vWorldPosition;
    #endif`;


    //I found this in the cameras documentation to help me figure out how
    //to get the GUI for the camera to work so I could mess with it
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
    }
    get max() {
        return this.obj[this.maxProp];
    }
    set max(v) {
        this.obj[this.maxProp] = v;
        this.min = this.min;  
    }
    }

    //Got the colorGUIHelper from the documentation so I can work with the lighting
	class ColorGUIHelper {
		constructor( object, prop ) {
			this.object = object;
			this.prop = prop;
		}
		get value() {
			return `#${this.object[ this.prop ].getHexString()}`;
		}
		set value( hexString ) {
			this.object[ this.prop ].set( hexString );
		}
	}

    // class FogGUIHelper {
    //     constructor(fog) {
    //         this.fog = fog;
    //     }
    //     get near() {
    //         return this.fog.near;
    //     }
    //     set near(v) {
    //         this.fog.near = v;
    //         this.fog.far = Math.max(this.fog.far, v);
    //     }
    //     get far() {
    //         return this.fog.far;
    //     }
    //     set far(v) {
    //         this.fog.far = v;
    //         this.fog.near = Math.min(this.fog.near, v);
    //     }
    // }

    const gui = new GUI();
    gui.add(camera, 'fov', 1, 180);
    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    gui.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near');
    gui.add(minMaxGUIHelper, 'max', 0.1, 200, 0.1).name('far');

    //This function is setup to help identify what the best position is for the camera
    //mainly for the y
    const cameraPositionElement = document.getElementById('camera-position');
    function updateCameraPosition() {
        const x = camera.position.x;
        const y = camera.position.y;
        const z = camera.position.z;
        cameraPositionElement.textContent = `Camera Position: X - ${x.toFixed(2)}, Y - ${y.toFixed(2)}, Z - ${z.toFixed(2)}`;
    }

	const controls = new OrbitControls( camera, view1Elem );
	controls.target.set( -53.35, 31.54, 4.64);
    controls.minDistance = 2;
    controls.maxDistance = 8;
	controls.update();

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
	scene.background = new THREE.Color( 'black' );
    scene.add(cameraHelper);
    

    //This code basically sets up the two perspectives for the canvas by splitting the view in 2
    //The documentation in the cameras section goes into more indepth detail
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

	{

		const planeSize = 40;

		const loader = new THREE.TextureLoader();
		const texture = loader.load( baseURL + 'Image.png' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;
		texture.colorSpace = THREE.SRGBColorSpace;
		const repeats = planeSize / 2;
		texture.repeat.set( repeats, repeats );

		const planeGeo = new THREE.PlaneGeometry( planeSize, planeSize );
		const planeMat = new THREE.MeshPhongMaterial( {
			map: texture,
			side: THREE.DoubleSide,
		} );
		const mesh = new THREE.Mesh( planeGeo, planeMat );
		mesh.rotation.x = Math.PI * - .5;

		scene.add( mesh );

	}

	{

		const skyColor = 0xB1E1FF; // light blue
		const groundColor = 0xB97A20; // brownish orange
		const intensity = 2;
		const light = new THREE.HemisphereLight( skyColor, groundColor, intensity );
		scene.add( light );

	}

    {

        const depth = 0.0000005;
        const fogColor = 0xDFE9F3;
        scene.fog = new THREE.FogExp2(fogColor, depth);

        // const fogGUIHelper = new FogGUIHelper(scene.fog);
        // gui.add(fogGUIHelper, 'depth', depth, 1 ).listen();

    }

	{

		const color = 0xFFFFFF;
		const intensity = 5;
		const light = new THREE.DirectionalLight( color, intensity );
		light.position.set( 5, 10, 2 );
		scene.add( light );
		scene.add( light.target );

        gui.addColor( new ColorGUIHelper( light, 'color' ), 'value' ).name( 'color' );
		gui.add( light, 'intensity', 0, 5, 0.01 );

	}

    {

        //This is the skybox code, it uses the Equirectangular mapping because it is a panorama image. 
        //I found that the sphere is better for the project seeing as we are not wanting them to travel too far.
        let loader = new THREE.TextureLoader();
        const imagePath = '../public/skybox/Panorama_Sky_23-512x512.png'
        loader.load( imagePath, (panorameTexture) => {

                const skySphereGeometry = new THREE.SphereGeometry(500, 60, 60);

                panorameTexture.mapping = THREE.EquirectangularReflectionMapping;
                panorameTexture.colorSpace = THREE.SRGBColorSpace;
                let skySphereMaterial = new THREE.MeshBasicMaterial({
                    map: panorameTexture,
                    fog: false
                });

                skySphereMaterial.side = THREE.BackSide;
                let skySphereMesh = new THREE.Mesh(skySphereGeometry, skySphereMaterial);

                scene.add(skySphereMesh);
            }
        );
    }

	{

		const gltfLoader = new GLTFLoader();
		gltfLoader.load( baseURL + 'fairgrounds.gltf', ( gltf ) => {

            loadingDiv.style.display = 'none';
			const root = gltf.scene;
            //If need to rotate model use this
            // root.rotation.x = Math.PI / 2;
			scene.add( root );

			controls.update();

		},
        (xhr) => {
            // Progress callback
            if (xhr.lengthComputable) {
                const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                loadingDiv.textContent = `Loading model (${percentComplete}%)...`;
            }
        },
        (error) => {
            // Error callback
            loadingDiv.textContent = 'Error loading model. Check console for details.';
            loadingDiv.style.background = 'rgba(255,0,0,0.7)';
            console.error('Error loading model:', error);
        } );

	}

	function resizeRendererToDisplaySize( renderer ) {

		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {

			renderer.setSize( width, height, false );

		}

		return needResize;

	}

	function render() {

        resizeRendererToDisplaySize(renderer);
    
        // turn on the scissor
        renderer.setScissorTest(true);
    
        // render the original view
        {
            const aspect = setScissorForElement(view1Elem);
        
            // adjust the camera for this aspect
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            // camera.lookAt(-41.41, 35, 3.46);
        
            // don't draw the camera helper in the original view
            cameraHelper.visible = false;
        
            // scene.background.set(0x000040);
        
            // render
            renderer.render(scene, camera);
        }
    
        // render from the 2nd camera
        {
            const aspect = setScissorForElement(view2Elem);
        
            // adjust the camera for this aspect
            camera2.aspect = aspect;
            camera2.updateProjectionMatrix();
        
            // draw the camera helper in the 2nd view
            cameraHelper.visible = true;

            // scene.background.set(0x000040);
        
            renderer.render(scene, camera2);
        }

        updateCameraPosition();
		requestAnimationFrame( render );

	}

	requestAnimationFrame( render );

    {

        view1Elem.addEventListener('keydown', function(event) {
        if(event.code == 'KeyW'){
            camera.translateZ(5) ;
        }
        });
        view1Elem.addEventListener('keydown', function(event) {
            if(event.code == 'KeyA'){
                camera.translateX(5);
            }
        });
        view1Elem.addEventListener('keydown', function(event) {
            if(event.code == 'KeyS'){
                camera.translateZ(-5);
            }
        });
        view1Elem.addEventListener('keydown', function(event) {
            if(event.code == 'KeyD'){
                camera.translateX(-5);
            }
        });

    }

}

main();
