# Link preview

Latest revision: `output/posters/poda-poda-run-wide-smaller-url.png`, with active preview `public/social/poda-poda-run-preview-v3.jpg`. Built-in image edit prompt: Reduce only the bottom URL font size approximately 30%, retain its exact spelling, centered position, white bold font and readability, and preserve the rest of the poster.

Updated wide poster: `output/posters/poda-poda-run-wide-with-url.png`. Active preview asset is now `public/social/poda-poda-run-preview-v2.jpg` (1200 × 630). Built-in image edit prompt: Add exactly `poda-poda-run.markgbla16.workers.dev` as a centered, legible bold white line along the bottom, with subtle dark backing. Preserve the rest of the poster and landscape aspect ratio. The user requested the visible URL.

Game URL: https://poda-poda-run.markgbla16.workers.dev/

Preview asset: `public/social/poda-poda-run-preview-v1.jpg` (1200 × 630 JPEG).

The main HTML includes static Open Graph and X/Twitter card metadata so crawlers do not need to execute JavaScript. In-game share links also use the user-supplied Workers URL.

Artwork made with built-in image generation, then exported to JPEG. Prompt: Adapt the corrected poster into a 1.91:1 landscape link preview. Preserve the cream/green/blue bus, realistic driver, Sierra Leone stripes, Freetown hills/coast/market and sunset. Recompose with large gold PODA-PODA RUN title on the left, FREETOWN • SIERRA LEONE above, bus on the right and PLAY NOW below the title. Omit URL and long slogan because the clickable card supplies context. Keep generous safe margins and legibility at thumbnail size.

Metadata reference: https://ogp.me/

Validation: production build and all 26 existing tests passed. The image dimensions and built HTML tags were checked. Live publishing requires Cloudflare authentication; `npx wrangler whoami` reported not authenticated. After login, run `npm run deploy`, then verify the root HTML metadata and preview image return successfully from the live URL. Social platforms may cache older previews.
