# Lagos Run: Visual Design Analysis for Freetown Recreation

## Overview
Lagos Run is a Three.js browser-based endless runner featuring a danfo (yellow-and-black minibus) navigating Lagos's real routes. The game succeeds through meticulous environmental storytelling and culturally specific visual markers that make Lagos instantly recognizable.

---

## Visual Design Elements

### 1. **Landmarks & Wayfinding**
- **Ojuelegba Bridge**: Iconic overhead structure referenced in loading screens, establishing location identity
- **Market Stalls**: Red/blue checkered fabric awnings—a Lagos commercial signature
- **Weathered Architecture**: Aged blue and tan walls with visible decay, air-conditioning units protruding haphazardly
- **Power Infrastructure**: Overhead lines creating visual complexity and "clutter realism"
- **Trees**: Sparse vegetation at street level (typical urban Lagos greenery distribution)

**Key insight**: Real place recognition comes from accumulated micro-details, not single landmarks. The checkered market fabric, AC units, and specific building colors matter more than a single visible bridge.

### 2. **Road Design & Infrastructure**
- **Multi-lane highway**: 3-lane street with clear white dashed lane markings
- **Yellow-and-black median barriers**: Bold, high-contrast safety barriers defining lane boundaries
- **Asphalt texture**: Dark grey with visible wear, oil stains, and patchwork repair marks
- **Signage**: Green/white directional signs partially visible in distance ("ILUPEJU • OJUELEGBA" visible on signage)
- **Pedestrian infrastructure**: Curbs, occasional street furniture, poles

**Key insight**: The road itself is a character. High-contrast barriers and clear lane markings make driving feel authentic to Lagos highway driving conditions. The asphalt's worn texture adds realism.

### 3. **Vehicle Detail & Camera**
- **Danfo Bus Design**: 
  - Yellow and black livery (standard commercial livery)
  - Roof rack detail visible
  - Driver cabin distinctive shape
  - Grill/bumper detail
  - "OYES EKOBA" text visible on bus (branding)
  
- **Camera Position & FOV**:
  - Mounted just behind bus, slightly elevated (bumper-height perspective)
  - Wide FOV showing ~90-100 degrees horizontally
  - Low angle emphasizes road and oncoming obstacles
  - Allows clear visibility of adjacent lanes

**Key insight**: The low, behind-the-vehicle camera perspective makes hazards feel personal and road-hugging. Not a bird's-eye view—you're in the bus.

### 4. **Atmosphere & Lighting**
- **Time of Day**: Dusk/early evening (purple/indigo sky with visible stars)
- **Color Palette**:
  - Warm yellows and oranges from vehicle and street furniture
  - Cool purples and deep blues in sky
  - Weathered greys and tans in buildings
  - Red and blue accents from market stalls
  - High saturation overall—vivid, not washed out
  
- **Lighting Model**: 
  - Ambient lighting simulating twilight
  - Subtle shadows from overhead wires and poles
  - No dramatic sun glare (dusk conditions eliminate harsh shadows)

**Key insight**: Dusk setting is ideal for endless runners—readable without harsh glare, atmospheric, and creates a sense of urgency ("rush hour"). Warm/cool color contrast makes the scene feel cinematic.

### 5. **Roadside Clutter & Environmental Detail**
- **Poles**: Wooden/metal utility poles with transformers and wire attachures
- **Market Infrastructure**: Temporary metal stalls with corrugated/fabric coverings
- **Parked Vehicles**: Other cars/trucks visible off-road, establishing busy urban setting
- **Pedestrians**: Human figures visible near stalls (adds scale and life)
- **Overhead Wires**: Power lines creating visual "noise" and complexity typical of Lagos streets

**Key insight**: "Clutter" is essential. A clean road feels sterile. The chaotic overhead wires, haphazard poles, and makeshift market stalls create visual authenticity that players recognize as "Lagos."

### 6. **Vehicle Density & Traffic Context**
- Game shows oncoming traffic obstacles (trucks, other vehicles)
- Parked cars and commercial vehicles in background
- Visual indication of busy urban highway during peak hours

### 7. **Accessibility & Readability**
- Clear UI overlays (score, objectives, guides) don't obscure the game world
- High-contrast yellow text on dark backgrounds
- Instructions visible without cluttering the environment
- Passenger pickup objectives clearly marked

---

## What Makes Lagos Run Feel "Lagos"

1. **Specific Vehicle**: The danfo is THE iconic Lagos transport. No other vehicle would work.
2. **Overhead Wires**: Chaos of Lagos infrastructure is visually distinctive.
3. **Color Saturation**: Vivid, not muted. Lagos is loud visually.
4. **Building Deterioration**: Authentic weathering (blue paint peeling, AC units awkwardly mounted).
5. **Market Fabric Patterns**: The checkered awnings are instantly recognizable Lagos street commerce.
6. **Signage Detail**: Real Lagos location names (Ojuelegba, Ilupeju) ground the game geographically.
7. **Rush Hour Dusk**: Captures the energy of Lagos evening commute.
8. **Road Barriers**: The yellow-and-black barriers are specific to Lagos highway aesthetics.

---

## Recommendations for Freetown Version (Poda Poda Run)

### 1. **Use the Poda Poda as Core Identity**
Replace the danfo with a Freetown poda poda (minibus)—colorfully painted, typically green/white or red/white livery with brass/ornamental detailing on roof rack. Make it as recognizable as the danfo is to Lagos players.

### 2. **Capture Infrastructure Chaos**
- Replicate overhead power lines and informal wire architecture
- Add street furniture typical of Freetown: wooden market stalls, corrugated metal structures
- Include water gutters and drainage channels (rainy season legacy)
- Detail utility poles with multiple transformers and cable attachments

### 3. **Layer in Real Freetown Geography**
- Reference recognizable routes: Wilkinson Road → Sani Abacha Street → Fourah Bay Road
- Use actual Freetown landmark names in signage and loading screens (like Lagos Run does with Ojuelegba)
- Include the Red Paint Market area aesthetic (if using a real market zone)

### 4. **Build the Right Color Palette**
- Greens and earth tones (tropical vegetation, rainy climate)
- Weathered pastels (pink, blue, yellow buildings—colonial heritage)
- Vivid market colors (printed fabrics, painted signage)
- Avoid desaturated or "realistic" tones—Freetown is visually vibrant

### 5. **Add Freetown-Specific Visual Markers**
- Architectural style: Colonial-era houses with verandas (visible in some Freetown areas)
- Red laterite soil visible in unpaved areas or road shoulders
- Dense roadside vegetation (more lush than Lagos)
- Informal taxi/transport stalls with characteristic Freetown styling
- Visible elevation changes (Freetown's hilly terrain)

### 6. **Time of Day Matters**
- Consider late afternoon (4–6 PM) for a similar "rush hour" feel
- Freetown's rainy season (May–Nov) offers moody, atmospheric grey skies
- Alternatively, early morning showing market setup activity
- Dusk works but test other times for cultural specificity

### 7. **Road & Traffic Design**
- Freetown roads: often narrower, with less formal lane markings
- Mixed traffic: motor bikes, wheelbarrows, hand carts alongside vehicles
- Less formal barrier design—use natural curbs, parked cars, or informal barriers
- Street vendors occupying roadside (not fenced-off markets)

### 8. **Environmental Clutter Strategy**
- Visible drainage issues (Freetown's rainy season infrastructure)
- Roadside litter and commercial signage (more ad saturation than Lagos)
- Makeshift shops and repairs in progress (authentic urban Freetown)
- Pedestrians in motion (morning/evening rush dynamics)

### 9. **HUD & Information Design**
- Maintain Lagos Run's clear, high-contrast UI approach
- Localize instruction text and objective names
- Use Freetown-specific landmarks or neighborhood names in location displays
- Consider Krio language options or Freetown-specific terminology

### 10. **Audio & Ambient Life**
- (Visual focus, but sound reinforces place): Include poda poda horn patterns, street vendor calls, local radio
- Avoid generic "African city" audio—use Freetown-specific music and sound design references

---

## Critical Success Factor

**Authenticity comes from specificity, not generalization.** Lagos Run works because the developers knew Lagos—the checkered market fabric, the exact yellow-and-black barrier colors, the danfo's exact livery. A Freetown version must similarly nail Freetown-specific details: the poda poda design, the exact colors of buildings in target neighborhoods, the specific signage typography and language, the way vegetation clusters on streets, the informal barriers and stalls.

Spend development time documenting real Freetown streets through photography and video before building the 3D environment.

---

## Screenshots & References

- **Screenshot 01**: Start screen loading - "Loading Ojuelegba..." establishes geography
- **Screenshot 05**: In-game dusk view showing danfo, road design, buildings, overhead wires, market stalls, and UI

Full visual documentation in: `/home/night_bird/Documents/Projects/personal-project/poda-poda-run/research/lagos-run/`
