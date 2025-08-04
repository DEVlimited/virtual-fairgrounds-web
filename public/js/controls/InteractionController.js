/*
 * Handles F-key interactions with world objects
 */
export class InteractionController {
    constructor(zones, popupManager, controls) {
        this.zones = zones;
        this.popupManager = popupManager;
        this.controls = controls;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleInteraction(e));
    }
    
    handleInteraction(event) {
    if (event.code === 'KeyF') {
        console.log('Interacted!');
        
        // Check each zone
        for (const [key, zone] of Object.entries(this.zones)) {
            if (zone.cameraInside) {
                const config = INTERACTION_ZONES[key];
                if (config && config.locationId) {
                    this.popupManager.popUpActive = true;
                    this.popupManager.generatePopupFromLocation(config.locationId);
                    this.controls.unlock();
                    event.preventDefault();
                    return;
                }
            }
        }
    }
}
    
    checkZones(camera) {
        // [Move zone checking logic here]
    }
}