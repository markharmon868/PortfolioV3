// Mark Harmon — K-Lipschitz Sphere Tracing (Stormhack 2025)
// Adapted from github.com/markharmon868/SphericalTrace
// WebGL 1.0 / GLSL ES 1.0 port: inlined support_functions.glsl,
// replaced Shadertoy uniforms & macros, fixed dynamic loop bounds.

precision mediump float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;   // [0,1] normalized — drives light east/west

// ── Compile-time constants ─────────────────────────────────────────────────
#define PI      3.14159
#define PI2     6.28318
#define EPSILON 1e-10
#define MAX_STEPS 80    // step budget per ray
#define eps 0.01        // convergence threshold

// ── Tunable constants (formerly #iUniform sliders) ────────────────────────
const float U_MAX_DISTANCE = 20.0;
const float U_FOG          = 1.0;
const float U_SPECULAR     = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Support functions  (inlined from support_functions.glsl)
// ─────────────────────────────────────────────────────────────────────────────

vec2 quinticInterpolation(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// 2D Perlin noise
float perlinNoise(vec2 P) {
    vec2 Pi = floor(P);
    vec2 Pf = P - Pi;
    vec2 g00 = normalize(hash2(Pi + vec2(0.0, 0.0)));
    vec2 g10 = normalize(hash2(Pi + vec2(1.0, 0.0)));
    vec2 g01 = normalize(hash2(Pi + vec2(0.0, 1.0)));
    vec2 g11 = normalize(hash2(Pi + vec2(1.0, 1.0)));
    float n00 = dot(g00, Pf);
    float n10 = dot(g10, Pf - vec2(1.0, 0.0));
    float n01 = dot(g01, Pf - vec2(0.0, 1.0));
    float n11 = dot(g11, Pf - vec2(1.0, 1.0));
    vec2 u = quinticInterpolation(Pf);
    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 0.5 + 0.5;
}

// Fixed 7-octave FBM — level param removed for GLSL ES 1.0 compatibility
// (loop bounds must be constant expressions in WebGL 1.0)
float fbm(in vec2 uv) {
    float value = 0.0;
    float amplitude = 1.6;
    float freq = 1.0;
    for (int i = 0; i < 7; i++) {
        value += perlinNoise(uv * freq) * amplitude;
        amplitude *= 0.4;
        freq *= 2.0;
    }
    return value;
}

float terrainHeightMap(in vec3 pos) {
    return fbm(pos.xz * 0.5);
}

// K: analytic Lipschitz bound for 7-octave FBM
// K = G * a0*f0 * (1 - (ai*fi)^7) / (1 - ai*fi)
float determineK() {
    const float G  = 1.2;
    const float a0 = 1.6;
    const float f0 = 1.0;
    const float ai = 0.4;
    const float fi = 2.0;
    return G * a0 * f0 * (1.0 - pow(ai * fi, 7.0)) / (1.0 - ai * fi);
}

// Surface normal via finite differences
// (renamed local eps → e3 to avoid conflict with #define eps)
vec3 getNormal(vec3 p, float t) {
    float e3 = 0.001 * t;
    float hl = terrainHeightMap(p - vec3(e3, 0.0, 0.0));
    float hr = terrainHeightMap(p + vec3(e3, 0.0, 0.0));
    float hd = terrainHeightMap(p - vec3(0.0, 0.0, e3));
    float hu = terrainHeightMap(p + vec3(0.0, 0.0, e3));
    return normalize(vec3(hl - hr, 2.0 * e3, hd - hu));
}

mat3 computeLookAtMatrix(vec3 orig, vec3 target, float roll) {
    vec3 rr = vec3(sin(roll), cos(roll), 0.0);
    vec3 ww = normalize(target - orig);
    vec3 uu = normalize(cross(ww, rr));
    vec3 vv = normalize(cross(uu, ww));
    return mat3(uu, vv, ww);
}

vec3 toLinear(vec3 c) {
    return vec3(pow(c.x, 2.2), pow(c.y, 2.2), pow(c.z, 2.2));
}

vec3 tosRGB(vec3 c) {
    float g = 1.0 / 2.2;
    return vec3(pow(c.x, g), pow(c.y, g), pow(c.z, g));
}

// Residual: positive when ray point is ABOVE the terrain surface
float residual(in vec3 ro, in vec3 rd, float t) {
    vec3 p = ro + rd * t;
    return p.y - terrainHeightMap(p);
}

// 3-iteration Illinois bracket refinement
float refineIllinois(in vec3 ro, in vec3 rd,
                     float a, float b, out int ilIters) {
    float fa = residual(ro, rd, a);
    float fb = residual(ro, rd, b);
    int kept = 0;
    ilIters = 0;
    for (int k = 0; k < 3; k++) {
        ilIters++;
        float denom = fb - fa;
        if (abs(denom) < 1e-12) denom = sign(denom) * 1e-12;
        float m = b - fb * (b - a) / denom;
        m = clamp(m, min(a, b), max(a, b));
        float fm = residual(ro, rd, m);
        if (abs(fm) < 1e-5) return m;
        if (fm * fb < 0.0) {
            a = b;  fa = fb;
            b = m;  fb = fm;
            if (kept == -1) fb *= 0.5;
            kept = -1;
        } else {
            b = m;  fb = fm;
            if (kept == 1) fa *= 0.5;
            kept = 1;
        }
    }
    return 0.5 * (a + b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ray marching
// ─────────────────────────────────────────────────────────────────────────────

bool intersectPlane(vec3 ro, vec3 rd, float boxMax, float maxDistance) {
    return ro.y + rd.y * (maxDistance - length(ro)) > boxMax;
}

// K-Lipschitz sphere tracer with Illinois refinement
vec2 sphereTrace(in vec3 ro, in vec3 rd,
                 in float minDist, in float maxDist, inout vec3 intPos) {
    float t = minDist;
    float finalSteps = 1.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos    = ro + rd * t;
        float height = pos.y - terrainHeightMap(pos);
        float K      = determineK();
        float step   = height / sqrt(1.0 + K * K);
        bool  hitPlane  = intersectPlane(ro, rd, 2.7, maxDist);
        float relDist   = 0.5 * t / maxDist;

        // Overshot
        if (height < 0.0) {
            finalSteps = float(i);
            intPos = pos - (step * 0.5) * rd;
            break;
        }

        // Near-surface → try Illinois refinement
        float illTrigger = 0.1 * (relDist + eps);
        if (step < illTrigger || height < illTrigger) {
            float surf_eps = relDist;
            float beta = max(1e-3, 0.02 * t);
            float a = clamp(t - beta, minDist, maxDist);
            float b = clamp(t + beta, minDist, maxDist);
            float ha = residual(ro, rd, a);
            float hb = residual(ro, rd, b);

            if (ha > 0.0 && hb <= 0.0) {
                int illIters = 0;
                float thit = refineIllinois(ro, rd, a, b, illIters);
                finalSteps += float(illIters);
                intPos = ro + rd * thit;
                return vec2(thit, finalSteps);
            }

            // Expand bracket once
            float beta2 = 2.0 * beta;
            a  = clamp(t - beta2, minDist, maxDist);
            b  = clamp(t + beta2, minDist, maxDist);
            ha = residual(ro, rd, a);
            hb = residual(ro, rd, b);

            if (ha > 0.0 && hb <= 0.0) {
                int illIters = 0;
                float thit = refineIllinois(ro, rd, a, b, illIters);
                finalSteps += float(illIters);
                intPos = ro + rd * thit;
                return vec2(thit, finalSteps);
            }

            // Peak skim: guarded secant jump forward
            float denom = max(abs(hb - ha), 1e-6);
            float d_sec = hb * (b - a) / denom;
            d_sec = clamp(d_sec, 2.0 * surf_eps, 10.0 * surf_eps);
            t = min(t + d_sec, maxDist);
            if (t > maxDist) break;
            continue;
        }

        // Far cutoff
        if (t > maxDist) {
            intPos = ro + rd * maxDist;
            break;
        }

        // Standard hit / ceiling test
        if ((abs(height) < relDist + eps || t > maxDist) || hitPlane) {
            finalSteps = float(i);
            if (!hitPlane) {
                intPos = pos;
            } else {
                intPos = ro + rd * maxDist;
                t = maxDist + 1.0;
            }
            break;
        }

        t += step;
    }

    return vec2(t, finalSteps);
}

vec3 computeShading(vec3 terrainColor, vec3 lightColor, vec3 normal,
                    vec3 lightDir, vec3 viewDir, vec3 skyColor, float terrainHeight) {
    terrainColor = mix(terrainColor, vec3(1.0), terrainHeight);
    vec3 halfVec = normalize(lightDir + viewDir);
    float NdH = max(dot(normal, halfVec), 0.0);
    float NdL = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = (terrainColor / PI) * NdL;
    vec3 ambient = vec3(normal.y * 0.1) * skyColor;
    float specInt = mix(U_SPECULAR * 0.2, U_SPECULAR, terrainHeight);
    vec3 specular = lightColor * pow(NdH, 10.0) * specInt * NdL;
    return diffuse + ambient + specular;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

void main() {
    // Mouse [0,1] → light east-west position
    float lightEW  = -(uMouse.x * 2.0 - 1.0) * 0.5;
    vec3 lightDir  = normalize(vec3(lightEW, 0.5, 0.0));
    vec3 lightColor = toLinear(vec3(0.99, 0.84, 0.43));

    // Centered, aspect-correct UV
    vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    // Slow dolly forward over time
    vec3 camPos    = vec3(0.0, 2.0, uTime * 0.25);
    vec3 camTarget = vec3(0.0, 0.0, camPos.z + 25.0);
    mat3 lookAt    = computeLookAtMatrix(camPos, camTarget, 0.0);

    vec3 ro = camPos;
    vec3 rd = normalize(lookAt * vec3(uv, 1.0));

    // Sphere trace
    vec3 intPos;
    vec2 hit  = sphereTrace(ro, rd, 0.1, U_MAX_DISTANCE, intPos);
    float dist = hit.x;

    float normDist = dist / U_MAX_DISTANCE;

    // Sky gradient based on sun direction
    vec3 skyColor = mix(
        vec3(0.3098, 0.5608, 0.9137),
        vec3(0.9961, 0.9725, 0.9059),
        max(dot(rd, lightDir) * 0.5 + 0.5, 0.0)
    );
    skyColor = toLinear(skyColor);

    vec3 finalColor = skyColor;

    if (dist < U_MAX_DISTANCE) {
        float terrainHeight = smoothstep(0.7, 0.78, intPos.y * 0.5);
        vec3 albedo  = toLinear(vec3(0.5, 0.39, 0.18));
        vec3 normal  = getNormal(intPos, dist);
        vec3 viewDir = normalize(ro - intPos);

        vec3 shading = computeShading(albedo, lightColor, normal,
                                      lightDir, viewDir, skyColor, terrainHeight);

        float fogAmt = mix(0.0, pow(normDist, 0.9), U_FOG);
        finalColor = mix(shading, skyColor, fogAmt);
    }

    gl_FragColor = vec4(tosRGB(finalColor), 1.0);
}
