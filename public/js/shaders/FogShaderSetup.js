import * as THREE from 'three';
import { NOISE_GLSL } from './NoiseShader.js';

// Fixed shader chunks that avoid variable redefinition conflicts
// Also had claude help me redefine the noise calculations and fog shader for overall better performance
export function setupCustomFogShaders() {
  // Use a unique variable name to avoid conflicts
  THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
      varying vec3 vFogWorldPosition;
    #endif`;

  THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
      vec4 fogWorldPosition = modelMatrix * vec4(position, 1.0);
      vFogWorldPosition = fogWorldPosition.xyz;
    #endif`;

  THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
    #ifdef USE_FOG
      uniform float fogTime;
      uniform vec3 fogColor;
      varying vec3 vFogWorldPosition;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
    #endif`;

  // Basically it just checks the distance of objects and if it is too distant 
  // then the noise is much less for better performance.
  THREE.ShaderChunk.fog_fragment = `
    #ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        float fogDepth = distance(vFogWorldPosition, fogOrigin);
        
        // Simplified noise calculation for distant objects
        float noiseSample = 1.0;
        if (fogDepth < 200.0) {
            vec3 noiseSampleCoord = vFogWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
            noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
        }
        
        fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
        fogDepth *= fogDepth;
        
        float heightFactor = 0.05;
        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * 
            (1.0 - exp(-fogDepth * normalize(vFogWorldPosition - fogOrigin).y * fogDensity)) / 
            normalize(vFogWorldPosition - fogOrigin).y;
        fogFactor = saturate(fogFactor);
        
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`;
}

export function createShaderModifier(cullingLODManager) {
  return (shader) => {
    shader.uniforms.fogTime = { value: 0.0 };
    cullingLODManager.trackedShaders.push(shader);
  };
}