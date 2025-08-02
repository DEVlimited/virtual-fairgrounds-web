// Game configuration constants
export const CAMERA_CONFIG = {
    FOV: 55,
    NEAR: 0.1,
    FAR: 650,
    INITIAL_POSITION: { x: -53.35, y: 32, z: 4.64 }
};

export const MOVEMENT = {
    SPEED: 100.0,
    DECELERATION: 10.0,
    ROTATION_SPEED: 2.0
};

export const FOG_CONFIG = {
    COLOR: 0xbe9fd4,
    DENSITY: 0.005
};

export const BOUNDARIES = {
    MIN: { x: -62, y: 32, z: -34 },
    MAX: { x: -35, y: 32, z: 84 }
};

export const MODEL_URL = 'https://storage.googleapis.com/fairgrounds-model/';