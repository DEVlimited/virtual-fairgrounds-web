/*
 Manages GUI interaction mode toggling
 */
export class GUIModeHandler {
    constructor(controls, canvas) {
        this.controls = controls;
        this.canvas = canvas;
        this.isGUIMode = false;
        this.guiFocused = false;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Middle mouse button for toggling GUI mode
        document.addEventListener('mousedown', (event) => {
            if (event.button === 1) {
                event.preventDefault();
                this.toggleGUIMode();
                return;
            }

            if (this.isGUIElement(event.target)) {
                console.log('GUI element clicked:', event.target);
                this.guiFocused = true;
                // Note: resetMovementState would be called on the movement controller
            }
        });

        // Handle clicking outside GUI
        document.addEventListener('mousedown', (event) => {
            if (event.target === this.canvas || !this.isGUIElement(event.target)) {
                if (this.guiFocused) {
                    console.log('Clicked outside GUI - clearing focus state');
                    this.guiFocused = false;
                    // Note: resetMovementState would be called on the movement controller
                }
            }
        });

        // Focus/unfocus handlers
        document.addEventListener('focusout', (event) => {
            console.log('Unfocus target:', event.target);

            if (this.isGUIElement(event.target)) {
                console.log('GUI element unfocused');
                this.guiFocused = false;

                setTimeout(() => {
                    if (!this.guiFocused) {
                        // Note: resetMovementState would be called on the movement controller
                        console.log('Movement state reset after GUI unfocus');
                    }
                }, 50);
            }
        });

        document.addEventListener('focusin', (event) => {
            console.log('Focus target:', event.target);

            if (this.isGUIElement(event.target)) {
                console.log('GUI element focused - stopping movement');
                this.guiFocused = true;
                // Note: resetMovementState would be called on the movement controller
            }
        });
    }
    
    toggleGUIMode(instructionsActive = false, popupActive = false) {
        this.isGUIMode = !this.isGUIMode;

        if (this.isGUIMode && !instructionsActive && !popupActive) {
            if (this.controls.isLocked) {
                this.controls.unlock();
            }
            console.log('GUI Mode: Activated - Mouse is now free for GUI interaction');
            this.updateGUIVisibility();
        } else if (!instructionsActive && !popupActive) {
            this.blurAllGUIElements();
            this.controls.lock();
            console.log('GUI Mode: Deactivated - Camera Controls active');
            this.updateGUIVisibility();
        }
    }

    blurAllGUIElements() {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        const guiInputs = document.querySelectorAll('.lil-gui input, .lil-gui select, .lil-gui button');
        guiInputs.forEach(element => {
            if (element === document.activeElement) {
                element.blur();
            }
        });

        this.canvas.focus();
    }

    updateGUIVisibility() {
        const guiElements = document.querySelectorAll('.lil-gui');
        guiElements.forEach(element => {
            if (this.isGUIMode) {
                element.style.pointerEvents = 'auto';
                element.style.opacity = '1';
                document.getElementById('interactionBlocker').style.display = 'none';
                document.getElementById('interactDesc').style.display = 'none';
            } else {
                element.style.pointerEvents = 'none';
                element.style.opacity = '0.3';
            }
        });

        document.body.style.cursor = this.isGUIMode ? 'default' : 'none';
    }

    isGUIElement(element) {
        while (element && element !== document.body) {
            if (element.matches('input[type="range"]') ||
                element.classList.contains('slider') ||
                element.classList.contains('range')) {
                return false;
            }
            if (element.matches('.lil-gui, .lil-gui *, .dg, .dg *')) {
                return true;
            }
            if (element.classList && (
                element.classList.contains('lil-gui') ||
                element.classList.contains('controller') ||
                element.classList.contains('title') ||
                element.classList.contains('folder') ||
                element.classList.contains('dg') ||
                element.classList.contains('property-name') ||
                element.classList.contains('c')
            )) {
                return true;
            }
            element = element.parentElement;
        }
        return false;
    }

    // Getters for state
    getIsGUIMode() {
        return this.isGUIMode;
    }

    getGuiFocused() {
        return this.guiFocused;
    }
}