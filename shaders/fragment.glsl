uniform float uRadius;
uniform float uGradient;
uniform float uTime;
uniform float uPosZ;
uniform vec3 uColor;
uniform float uDebug;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform float uWaveSpeed;
uniform float uMinBrightness;

varying vec2 vUv;
varying float vNoise;

#define PI 3.14

void main() {

    vec2 shapeUv = vec2(
        vUv.x,
        vUv.y + vNoise + sin(vUv.x * uWaveFrequency + mod(uTime * uWaveSpeed, 2. * PI)) * uWaveAmplitude
    );
    float dist = distance(shapeUv, vec2(0.5));
    float strength = smoothstep(uRadius, uRadius + uGradient, dist);
    gl_FragColor = vec4(clamp(uPosZ, uMinBrightness,1.) * uColor, strength);
    gl_FragColor += vec4(vec3(strength),1.) * uDebug;
}