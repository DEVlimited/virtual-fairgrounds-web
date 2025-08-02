import * as THREE from 'three';

/**
 * Creates interactive zones that trigger popups when the camera enters
 * @class PopupCircle
 */
export class PopupCircle {
    /**
     * Creates an interaction zone
     * @param {number} posX - X position
     * @param {number} posY - Y position
     * @param {number} posZ - Z position
     * @param {number} radius - Interaction radius
     */
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