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

	const fov = 45;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 100;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( 0, 10, 20 );

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


    function updateCamera() {
        camera.updateProjectionMatrix();
    }

    const gui = new GUI();
    gui.add(camera, 'fov', 1, 180).onChange(updateCamera);
    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    gui.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    gui.add(minMaxGUIHelper, 'max', 0.1, 50, 0.1).name('far').onChange(updateCamera);

	const controls = new OrbitControls( camera, canvas );
	controls.target.set( 0, 5, 0 );
	controls.update();

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 'lightblue' );

	{

		const planeSize = 40;

		const loader = new THREE.TextureLoader();
		const texture = loader.load( '../models/gltfOld/Image.png' );
		const texture = loader.load( '../models/gltf/Image.png' );
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

		const color = 0xFFFFFF;
		const intensity = 5;
		const light = new THREE.DirectionalLight( color, intensity );
		light.position.set( 5, 10, 2 );
		scene.add( light );
		scene.add( light.target );

        gui.addColor( new ColorGUIHelper( light, 'color' ), 'value' ).name( 'color' );
		gui.add( light, 'intensity', 0, 5, 0.01 );

	}

	//Got this scenegraph dump code from the threejs documentation, super helperful
	//and it looks great in the console
	function dumpObject( obj, lines = [], isLast = true, prefix = '' ) {
		const localPrefix = isLast ? '└─' : '├─';
		lines.push( `${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]` );
		const newPrefix = prefix + ( isLast ? '  ' : '│ ' );
		const lastNdx = obj.children.length - 1;
		obj.children.forEach( ( child, ndx ) => {
			const isLast = ndx === lastNdx;
			dumpObject( child, lines, isLast, newPrefix );
		} );
		return lines;
	}

	function frameArea( sizeToFitOnScreen, boxSize, boxCenter, camera ) {

		const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
		const halfFovY = THREE.MathUtils.degToRad( camera.fov * .5 );
		const distance = halfSizeToFitOnScreen / Math.tan( halfFovY );
		// compute a unit vector that points in the direction the camera is now
		// in the xz plane from the center of the box
		const direction = ( new THREE.Vector3() )
			.subVectors( camera.position, boxCenter )
			.multiply( new THREE.Vector3( 1, 0, 1 ) )
			.normalize();

		// move the camera to a position distance units way from the center
		// in whatever direction the camera was from the center already
		camera.position.copy( direction.multiplyScalar( distance ).add( boxCenter ) );

		// pick some near and far values for the frustum that
		// will contain the box.
		camera.near = boxSize / 100;
		camera.far = boxSize * 100;

		camera.updateProjectionMatrix();

		// point the camera to look at the center of the box
		camera.lookAt( boxCenter.x, boxCenter.y, boxCenter.z );

	}

	{

		const gltfLoader = new GLTFLoader();

		gltfLoader.load( '../models/gltf/fairgrounds.gltf', ( gltf ) => {

			const root = gltf.scene;
            //If need to rotate model use this
            // root.rotation.x = Math.PI / 2;
			scene.add( root );
			console.log(dumpObject(root).join('\n'));

			// compute the box that contains all the stuff
			// from root and below
			const box = new THREE.Box3().setFromObject( root );

			const boxSize = box.getSize( new THREE.Vector3() ).length();
			const boxCenter = new THREE.Vector3(0, 0, 0);

			// set the camera to frame the box
			frameArea( boxSize * 0.5, boxSize, boxCenter, camera );

			// update the Trackball controls to handle the new size
			controls.target.copy( boxCenter );
			controls.update();

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

		if ( resizeRendererToDisplaySize( renderer ) ) {

			const canvas = renderer.domElement;
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();

		}

		renderer.render( scene, camera );

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
