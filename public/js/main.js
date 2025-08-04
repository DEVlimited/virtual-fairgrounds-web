import { VirtualFairgrounds } from './core/VirtualFairgrounds.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new VirtualFairgrounds();
    window.app = app; // For debugging and keyboard shortcuts
});