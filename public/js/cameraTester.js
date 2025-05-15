import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { update } from 'three/examples/jsm/libs/tween.module.js';

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
	const near = 0.1;
	const far = 80;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( -53.35, 31.54, 4.64);

    //currently the best Camera Position: X: -53.35, Y: 31.54, Z: 4.64

    //This is to help create the split view of the main camera
    //Found the code and full documentation on it in the docs for three.js in Cameras section
    const cameraHelper = new THREE.CameraHelper(camera);


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

    class FogGUIHelper {
        constructor(fog) {
            this.fog = fog;
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
    }

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
        500, // far
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
        const near = 0.1;
        const far = 80;
        const fogColor = 0x000040;
        scene.fog = new THREE.Fog(fogColor, near, far);

        const fogGUIHelper = new FogGUIHelper(scene.fog);
        gui.add(fogGUIHelper, 'near', near, far * 4).listen();
        gui.add(fogGUIHelper, 'far', near, far * 4).listen();
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
        
            scene.background.set(0x000040);
        
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

            scene.background.set(0x000040);
        
            renderer.render(scene, camera2);
        }

        updateCameraPosition();
		requestAnimationFrame( render );

	}

	requestAnimationFrame( render );

    window.addEventListener('keydown', function(event) {
        if(event.code == 'KeyW'){
            camera.translateZ(5) ;
        }
    });
    window.addEventListener('keydown', function(event) {
        if(event.code == 'KeyA'){
            camera.translateX(5);
        }
    });
    window.addEventListener('keydown', function(event) {
        if(event.code == 'KeyS'){
            camera.translateZ(-5);
        }
    });
    window.addEventListener('keydown', function(event) {
        if(event.code == 'KeyD'){
            camera.translateX(-5);
        }
    });

}

main();
