# Mark Harmon — Personal Portfolio Site Spec
> Hand this file to Claude Code. Build everything described here as a single deployable static site targeting `markharmon868.github.io`.

---

## 0. Goal & Audience

A personal portfolio site for Mark Harmon — physics graduate, graphics/simulation engineer, looking for work in LA at games, robotics, XR, or web3D companies. 

**Primary audience**: Technical recruiters and engineers at studios like Naughty Dog, robotics companies, XR labs. They are busy and somewhat skeptical. The site needs to earn attention fast and hold it.

**One sentence brief**: A cinematic, scroll-driven personal site where a live 3D atmospheric hero transitions into clean, confident project cards — the 3D shows what Mark can build, the cards explain what he has built.

---

## 1. Tech Stack

- **Vanilla JS + Three.js** (no React — keep it lean and deployable as a static site on GitHub Pages)
- **GSAP + ScrollTrigger + ScrollSmoother** for scroll-driven camera animation and card reveals
- **Lenis** for smooth scroll
- **No build step required** — plain HTML/CSS/JS files, importable via CDN or local scripts
- Host: GitHub Pages at `markharmon868.github.io`

---

## 2. Visual Direction

Pull the aesthetic directly from the existing site at `markharmon868.github.io`:

- **Dark background** — near-black, not pure black. Something like `#0a0a0f` or `#0d0d12`
- **Typography**: Clean, minimal, modern. The existing site uses a sans-serif at varying weights. Keep that. No decorative display fonts.
- **Cards**: The existing site has clean bordered cards with subtle backgrounds. Match that feel — thin borders (`1px solid rgba(255,255,255,0.08)`), very dark card backgrounds (`rgba(255,255,255,0.03)`), white/near-white text
- **Accent color**: Subtle. A cool blue-white or desaturated teal for links and hover states. Nothing loud.
- **Motion**: Smooth, cinematic, not flashy. Fades and translates, not bounces or spins.
- **Overall tone**: Confident and restrained. The 3D does the visual work. The cards are clean and readable.

---

## 3. Page Structure

The page is a single scrollable document. A fixed Three.js canvas sits behind all content. HTML sections scroll on top. The camera in the Three.js scene moves through keyframes as the user scrolls.

```
[Fixed Three.js canvas — full viewport, behind everything]
[HTML content scrolls on top]
  Section 1: Hero
  Section 2: About
  Section 3: Experience
  Section 4: Projects — Graphics Demos
  Section 5: Projects — Built Things
  Section 6: Library (personal clips)
  Section 7: Contact
```

---

## 4. Three.js Hero Scene

### Concept
A slow-moving atmospheric cloudscape or volumetric fog scene. The camera drifts forward very slowly through soft, layered clouds or mist. Abstract, cinematic, not cartoony. Think: flying through clouds at dusk, or a foggy mountain atmosphere. Dark at the edges, slightly lighter where the "light source" is (top center or slightly off-axis).

### Implementation options (Claude Code should pick the most achievable)

**Option A — Layered plane fog (simplest, reliable)**
- Multiple large transparent planes with an animated noise texture (simplex or FBM-based GLSL)
- Planes drift slowly at different depths and speeds creating parallax
- Color: dark blue-grey to near-black, with a subtle warm highlight region
- Camera drifts forward slowly on a spline, triggered by scroll

**Option B — Raymarched volumetric fog**
- Full-screen GLSL fragment shader doing raymarched volume density
- FBM noise field for cloud density
- Camera position fed as a uniform, updated by GSAP scroll
- More impressive but heavier — add a low-res fallback

**Option C — Particle cloud system**
- 50,000–100,000 small semi-transparent particles arranged in a cloud formation
- Subtle drift animation
- Camera path through them via GSAP

> Recommendation: Start with Option A for reliability and performance. The visual effect is what matters, not the technique.

### Scroll-driven camera path
Use GSAP ScrollTrigger with `scrub: 1.5`. Five keyframe positions mapped to the five main scroll sections:

| Scroll position | Camera move |
|---|---|
| Hero (0%) | Starting position, drifting forward slowly |
| About (20%) | Very slight upward tilt, continues forward |
| Experience (35%) | Subtle rightward drift |
| Projects (55%) | Camera slows, slight pull-back — cards have focus |
| Library (80%) | Camera resumes drift, slightly downward |
| Contact (95%) | Camera settles, slows to near-stop |

Camera movement should be **subtle** — this is atmosphere, not a ride. The content is the star.

---

## 5. Section Specs

### Section 1 — Hero

**Layout**: Full viewport height. Center-aligned text over the Three.js scene.

**Content**:
```
Hello, I'm
[large] Mark Harmon
Physics · Graphics · Simulation
Based in California — Open to work
[subtle scroll indicator arrow at bottom]
```

**Animation**: Text fades in staggered on page load (GSAP timeline). Name appears first, then subtitle, then location line, then scroll indicator.

**Style**: Large name — maybe 72–96px, weight 300 or 400 (not bold — let the size do the work). Subtitle smaller, more muted. Thin horizontal rule or spacer between name and subtitle.

---

### Section 2 — About

**Layout**: Constrained width (max 680px), centered. Text only — no image needed. The 3D background does the visual work.

**Content**:
```
I'm a physics graduate from UBC with a focus on computer graphics, 
simulation, and interactive systems. I build things at the intersection 
of science and creative technology — from VR medical applications to 
real-time rendering optimizations.

Currently looking for roles in graphics engineering, simulation, 
XR development, or technical art in Los Angeles.
```

**Animation**: Section fades in as it enters the viewport. Slight upward translate on reveal.

---

### Section 3 — Experience

**Layout**: Stacked cards, max-width 760px, centered.

**Each experience card contains**:
- Role title (bold, white)
- Company | Location | Date (muted, smaller)
- 2–3 sentence description
- Optional: tags for tech used

**Cards** (in order):

**Card 1: Undergraduate Research Assistant — USC Institute for Creative Technologies**
- Summer 2025 · Los Angeles, CA
- Built a third-person game in Unreal Engine exploring LLM-driven NPC dialogue using Construal Level Theory. Focused on the persuasive capabilities of language models within interactive game environments.
- Tags: `Unreal Engine` `C++` `LLM integration` `Game Dev`

**Card 2: Student Developer — UBC Emerging Media Lab**
- Spring 2025 · Vancouver, BC
- Developer on EARSIM — a VR application for training sound localization in patients with unilateral hearing loss. Built game logic, implemented adaptive UI, and contributed to a SIGGRAPH 2025 publication.
- Tags: `Unity` `VR` `C#` `SIGGRAPH`
- Special treatment: Add a subtle `SIGGRAPH 2025` badge on this card — small pill, slightly highlighted, with a link to the paper at `https://dl.acm.org/doi/10.1145/3721250.3743041`

**Card 3: Senior Assistant — CENT.co**
- 2022–2024 · Remote
- Managed customer operations, led social media strategy, and produced 3D animations and motion graphics for artist collaborations.
- Tags: `Blender` `3D Animation` `Motion Graphics`

**Animation**: Cards stagger in with a short delay between each as the section enters. Subtle upward fade.

---

### Section 4 — Projects: Graphics & Simulation

**Layout**: 2-column grid on desktop, 1-column on mobile. Cards are taller than experience cards — they include a visual preview area at the top.

**Each project card contains**:
- Visual preview area (top ~40% of card): either a live WebGL canvas, a video loop, or a static image
- Project title
- One-line description
- Tags
- "View project →" link

**Cards**:

**Card 1: Sphere-tracing Raymarcher**
- Preview: Live WebGL — port the existing GLSL raymarcher to run as a Three.js ShaderMaterial inside the card's canvas element. If performance is a concern, use a pre-rendered video loop as fallback.
- Description: A 24-hour hackathon build implementing K-Lipschitz sphere tracing to render procedural FBM terrain. 40% reduction in step count over naive raymarching.
- Tags: `GLSL` `WebGL` `Raymarching` `Optimization`
- Link: `markharmon868.github.io/sphere-tracing.html` (existing writeup page)
- Badge: `Stormhack 1st Place`

**Card 2: Fluid Simulation**
- Preview: Video loop or animated preview if available. If not yet available, use an abstract placeholder with a subtle animated shader (e.g., a Navier-Stokes-looking noise pattern).
- Description: GPU-accelerated fluid simulation exploring Navier-Stokes dynamics in real time.
- Tags: `GLSL` `WebGL` `Physics Simulation` `GPU`
- Link: TBD — placeholder for now

**Card 3: Shot-caller** *(hackathon project)*
- Preview: Screenshot or short video clip
- Description: Built at a San Francisco hackathon — [Mark to fill in description]
- Tags: TBD by Mark
- Link: TBD

**Animation**: Cards fade in with staggered delay. On hover: card lifts slightly (`transform: translateY(-4px)`), border brightens subtly. The live WebGL canvas in card 1 should only render when the card is in the viewport (use IntersectionObserver to pause/resume rendering).

---

### Section 5 — Projects: Built Things

**Layout**: Same 2-column grid. These cards have a slightly different feel — more "shipped product" than "technical demo." Slightly more content, less emphasis on visual preview.

**Cards**:

**Card 1: EARSIM — VR Sound Localization Training**
- Preview: Screenshot from the VR application
- Description: A configurable VR system that trains spatial audio localization for patients with unilateral hearing loss. Procedurally generates multi-sensory cues and delivers adaptive auditory tasks. Published at SIGGRAPH Posters 2025.
- Tags: `Unity` `VR` `C#` `Spatial Audio` `Medical XR`
- Link: `https://dl.acm.org/doi/10.1145/3721250.3743041`
- Badge: `SIGGRAPH 2025`

**Card 2: LLM Dialogue Game — USC ICT**
- Preview: Gameplay screenshot
- Description: A third-person shooter where NPC dialogue is driven by a large language model applying Construal Level Theory to explore persuasive AI interaction in games.
- Tags: `Unreal Engine` `LLM` `NPC AI` `Game Design`
- Link: TBD

---

### Section 6 — Library

**Layout**: Full-width section, darker background than the rest. Title "Library" or "/ personal" left-aligned. Below: a horizontal scrolling row (or 3-column grid) of video thumbnails.

**Content**: Mark's personal video clips — skiing, skateboarding, surfing. Each is a muted autoplay loop on hover, with a play button to open full screen or link to the full clip.

**3D integration**: The skateboarder hill-bomb looping scene (Three.js, loaded from existing GLB/animation) plays as an ambient background behind this section — subtly, desaturated, at low opacity. It contextualizes the section visually without competing with the video cards.

**Video cards**: Simple. Rounded corners, matching the site's card style. Thumbnail image, small label (e.g. "Skiing · Whistler" or "Skating · SF"), hover to play muted loop.

**Animation**: Section fades in. Skateboarder scene crossfades in as the camera reaches this scroll position.

> Note: Mark needs to provide the actual video files. Use placeholder cards during build.

---

### Section 7 — Contact

**Layout**: Minimal. Centered. Single viewport height or close to it.

**Content**:
```
Let's work together.
[muted] markharmon868@gmail.com  ·  LinkedIn  ·  GitHub
```

**Links**: LinkedIn (`linkedin.com/in/markharmon`) and GitHub (`github.com/markharmon868`). Mark to confirm exact URLs.

**Animation**: Camera settles. Text fades in. Simple.

---

## 6. Navigation

Minimal fixed nav at the top:
- Left: `Mark Harmon` (links to top)
- Right: `Experience · Projects · Library · Contact` — smooth scroll links

On mobile: hamburger or just the name with no nav links (sections are discoverable by scrolling).

Style: Very low opacity background on the nav bar (`backdrop-filter: blur(10px); background: rgba(10,10,15,0.6)`). Thin bottom border. Nav fades in after the hero section starts scrolling.

---

## 7. Card Component Spec

All cards across the site share a base style. Claude Code should build a reusable card component/class.

```css
.card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.card:hover {
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateY(-3px);
}
```

Tags/badges:
```css
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(100, 160, 255, 0.12);
  color: rgba(140, 190, 255, 0.9);
  border: 1px solid rgba(100, 160, 255, 0.25);
}
```

---

## 8. Performance Requirements

- Three.js canvas must not tank mobile performance. Add a check: if `window.innerWidth < 768` or device is low-power, reduce particle count / simplify the shader or disable the animated cloud scene and replace with a static gradient background.
- Lazy-load all video elements. Use `loading="lazy"` on images.
- The raymarcher WebGL card should only render when in viewport (IntersectionObserver).
- Target 60fps on a modern laptop. Target 30fps acceptable on mobile.

---

## 9. Files Mark Needs to Provide

Claude Code should build the full site with placeholder content where these are missing. Mark will drop in the real files:

| File needed | Used in |
|---|---|
| `headshot.png` | About section (optional — currently on existing site) |
| Raymarcher GLSL source | Graphics demos card live preview |
| Skateboarder GLB + animation | Library section background |
| Skiing / skating / surf video clips | Library section |
| Shot-caller screenshots / description | Projects card |
| USC ICT gameplay screenshots | Built things card |
| EARSIM screenshots | Built things card |
| Exact LinkedIn URL | Contact section |

---

## 10. File Structure

```
/
├── index.html
├── style.css
├── main.js              ← Three.js scene, GSAP setup, scroll logic
├── shaders/
│   ├── cloud.vert.glsl
│   └── cloud.frag.glsl
├── cards/
│   └── raymarcher.frag.glsl   ← shader for live card preview
├── models/
│   └── skateboarder.glb       ← Mark provides
├── media/
│   ├── [video clips]          ← Mark provides
│   └── [screenshots]          ← Mark provides
└── pages/
    └── sphere-tracing.html    ← existing, keep as-is
```

---

## 11. Stretch Goals (build after core is done)

- Subtle cursor trail effect (small glowing dot that follows the cursor with a slight lag)
- On the raymarcher card: live GLSL running in the card canvas, mouse position fed as a uniform to shift the light direction
- Smooth page transition when navigating to the sphere-tracing writeup page (fade out / fade in)
- "Open to work" status badge in the hero that links directly to LinkedIn

---

## 12. Notes for Claude Code

- Keep the Three.js scene and the HTML content clearly separated in the code. `main.js` handles Three.js and GSAP. A separate `ui.js` or inline `<script>` handles card interactions.
- The Three.js canvas is `position: fixed; top: 0; left: 0; z-index: 0; pointer-events: none`. All HTML content is `position: relative; z-index: 1`.
- Use `gsap.registerPlugin(ScrollTrigger, ScrollSmoother)` at the top of main.js.
- Start with the HTML/CSS structure and static cards first. Get the layout right. Then add the Three.js scene. Then wire up the scroll animations. Don't try to do everything at once.
- The existing site at `markharmon868.github.io` is the style reference. Match the dark, minimal, clean aesthetic exactly.
