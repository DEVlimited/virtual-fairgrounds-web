import * as THREE from 'three';
import { MOVEMENT } from '../config/constants.js';

/*
  Handles player movement and rotation
 */
export class MovementController {
    constructor(camera, controls, guiModeHandler) {
        this.camera = camera;
        this.controls = controls;
        this.guiModeHandler = guiModeHandler;  // Add GUI mode handler reference
        
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
    
    onKeyDown(event) {
        // Check if GUI is focused
        if (this.guiModeHandler && this.guiModeHandler.getGuiFocused()) return;

        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'KeyE':
            case 'ArrowRight':
                if (this.guiModeHandler && this.guiModeHandler.getIsGUIMode()) {
                    this.rotateLeft = true;
                }
                break;
            case 'KeyQ':
            case 'ArrowLeft':
                if (this.guiModeHandler && this.guiModeHandler.getIsGUIMode()) {
                    this.rotateRight = true;
                }
                break;
            case 'KeyM':
                // Monochromatic mode toggle will be handled elsewhere
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
            case 'KeyE':
            case 'ArrowRight':
                this.rotateLeft = false;
                break;
            case 'KeyQ':
            case 'ArrowLeft':
                this.rotateRight = false;
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
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.rotateLeft = false;
        this.rotateRight = false;
        this.velocity.set(0, 0, 0);
        this.direction.set(0, 0, 0);
        this.rotationVelocity = 0;
    }
}