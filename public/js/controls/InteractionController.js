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
                if (theaterSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('theater');
                    controls.unlock();
                    event.preventDefault();
                    return;
                } else if (cleanersSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('cleaners');
                    controls.unlock();
                    event.preventDefault();
                    return;
                } else if (dominosSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('dominos');
                    controls.unlock();
                    event.preventDefault();
                    return;
                } else if (recordsSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('records');
                    controls.unlock();
                    event.preventDefault();
                    return;
                } else if (northEndSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('northEnd');
                    controls.unlock();
                    event.preventDefault();
                    return;
                } else if (southEndSphere.cameraInside) {
                    PopupManager.popUpActive = true;
                    PopupManager.generatePopupFromLocation('southEnd');
                    controls.unlock();
                    event.preventDefault();
                    return;
                }            
        }
    }
    
    checkZones(camera) {
        // [Move zone checking logic here]
    }
}