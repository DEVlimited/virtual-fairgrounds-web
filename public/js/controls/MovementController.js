import * as THREE from 'three';
import { MOVEMENT } from '../config/constants.js';

/**
 * Handles player movement and rotation
 */
export class MovementController {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.rotateLeft = false;
        this.rotateRight = false;
        
        // Physics
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotationVelocity = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    
    //This is the movement event function for the keys when they go up and down
    onKeyDown(event) {

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
            case 'KeyE':
            case 'ArrowRight':
                if (isGUIMode) rotateLeft = true;
                break;
            case 'KeyQ':
            case 'ArrowLeft':
                if (isGUIMode) rotateRight = true;
                break;
            case 'KeyM':
                if (!guiFocused && !PopupManager.popUpActive) {
                    visualizationSettings.monochromaticMode = !visualizationSettings.monochromaticMode;
                    visualizationSettings.toggleMonochromatic();
                }
                break;
        }
    }

    onKeyUp(event) {

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
            case 'KeyE':
            case 'ArrowRight':
                rotateLeft = false;  // Was: rotateRight = false
                break;
            case 'KeyQ':
            case 'ArrowLeft':
                rotateRight = false;  // Was: rotateLeft = false
                break;
        }
    }

    update(delta, isGUIMode = false) {
        // Apply deceleration to velocity
        this.velocity.x -= this.velocity.x * MOVEMENT.DECELERATION * delta;
        this.velocity.z -= this.velocity.z * MOVEMENT.DECELERATION * delta;
        
        // Handle rotation (only in GUI mode)
        if (isGUIMode) {
            // Direct rotation handling - only rotates while key is held
            const rotationSpeed = MOVEMENT.ROTATION_SPEED;

            if (this.rotateLeft) {
                const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
                cameraEuler.setFromQuaternion(this.camera.quaternion);
                cameraEuler.y -= rotationSpeed * delta;
                this.camera.quaternion.setFromEuler(cameraEuler);
            }
            if (this.rotateRight) {
                const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
                cameraEuler.setFromQuaternion(this.camera.quaternion);
                cameraEuler.y += rotationSpeed * delta;
                this.camera.quaternion.setFromEuler(cameraEuler);
            }
        }

        // Calculate movement direction
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        // Apply movement to velocity
        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * MOVEMENT.SPEED * delta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * MOVEMENT.SPEED * delta;
        }

        // Apply the velocity to the controls
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        }
    
    resetMovementState() {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        velocity.set(0, 0, 0);
        direction.set(0, 0, 0);
    }

}