import * as THREE from 'three';

/**
 * Manages spatial boundaries for camera movement with rotation support
 * @class BoundaryBox
 */
export class BoundaryBox {
    /**
     * Creates a boundary box with the specified dimensions
     * @param {number} minX - Minimum X coordinate
     * @param {number} maxX - Maximum X coordinate
     * @param {number} minY - Minimum Y coordinate
     * @param {number} maxY - Maximum Y coordinate
     * @param {number} minZ - Minimum Z coordinate
     * @param {number} maxZ - Maximum Z coordinate
     */
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

/**
 * Sets up camera boundaries with PointerLockControls integration
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.Camera} camera - The camera to constrain
 * @param {PointerLockControls} controls - The controls to modify
 * @returns {BoundaryBox} The configured boundary system
 */
export function setupCameraBoundaries(scene, camera, controls) {
    // [Move the setupCameraBoundaries function here]
}