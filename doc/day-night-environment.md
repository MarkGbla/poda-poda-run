# Day and night environment

## Architecture

`src/rendering/EnvironmentManager.js` owns DAY, SUNSET, NIGHT and SUNRISE presets. A run reads the explicit start-screen choice once in `startRun()` and keeps it until the next run. The manager sets the sky, fog, hemisphere and directional light, exposure, road tint, background silhouettes and the activation level sent to subscribers. Presets are data, so a future transition can interpolate their numeric values without changing vehicle or street code.

`src/rendering/VehicleLights.js` attaches visible lamps after vehicle baking. The player gets one shadowless SpotLight with a soft road beam; low quality keeps the road beam and disables the SpotLight. NPCs use emissive geometry and only nearby vehicles on High receive a small beam plane. NPC brake lamps use the braking state reported by traffic and SENDME controllers. The player uses held brake, dwell and measured speed reduction. Pooled vehicles retain their lights and reset from current simulation state every frame.

`src/rendering/StreetLights.js` uses instanced lamp heads and instanced transparent road pools. The existing CBD lamp poles remain in `CbdWorld`; the chunk route gains small poles on its recycled chunks. No streetlamp casts a dynamic shadow. CBD window and shop emission maps illuminate selected parts of the existing atlas. Potholes receive a faint visible edge at night. Physics, collision geometry, scoring and traffic speeds are unchanged by this feature.

## Performance evidence

The deterministic `?benchmark&stats` scene on headless Chromium at 1280×720 measured 173 draw calls and about 126k triangles by day, and 219–226 draw calls and about 125–127k triangles by night with freight lights included. Active lights were 2 by day and 3 by night; shadow casting lights stayed at 1. Low quality night at 412×860 measured 151 draws, 78k triangles, 2 active lights and no shadow casting lights. The mapped Central night scene measured 83 draws and 102k triangles. The [older baseline](../docs/cbd/09-performance-baseline.md) reported 169–173 benchmark draws before this feature. Headless FPS varied between runs and is not a reliable phone GPU measurement. `scripts/environment-smoke.mjs` records frame time, draws, triangles, geometry, textures, object count, active lights, shadows and viewport results. GPU memory and actual phone frame rate remain unmeasured.

## Verification checklist

- [x] Day and night runs boot with fixed environment selection.
- [x] Player light on at night and off by day; low quality disables the real SpotLight.
- [x] Streetlamp heads and pools on at night and off by day.
- [x] NPC and SENDME lights attach outside baked geometry and survive pool reuse.
- [x] NPC brake lamps read traffic braking state; player lamps read actual brake and deceleration.
- [x] Road, markings, curbs, potholes and HUD are readable in desktop and simulated phone captures.
- [x] Desktop landscape, simulated mobile portrait and simulated mobile landscape render without page errors.
- [x] Existing 80 unit and integration tests pass; Vite production build passes.
- [ ] Complete a full manual Central route drive at night, including pickups, dropoffs, pedestrians, barriers, steering and pause/resume.
- [ ] Check real mid-range Android and iPhone GPU frame time and thermal behaviour in both orientations and Low quality.
- [ ] Inspect restart, pooled vehicle disposal and all vehicle variants during repeated long runs on real devices.
