# People reference notes (for people.js)

Firecrawl credits ran out, so the photos came from Wikimedia Commons through its API with curl/python. The images in `refs/people/` are reference only and are not shipped. I also looked at `refs/abacha-street/01-alamy-bustling.jpg`, saved earlier by the districts agent.

| File | Source |
|---|---|
| 01-busy-market-freetown.jpg | https://commons.wikimedia.org/wiki/File:This_is_a_unique_picture_of_busy_market_in_Freetown_Sierra_Leone.jpg |
| 02-freetown-street.jpg | https://commons.wikimedia.org/wiki/File:Freetownstreet.jpg |
| 03-boy-selling-limes.jpg | https://commons.wikimedia.org/wiki/File:Boy_selling_limes.jpg |
| 04-freetown-stringer.jpg | https://commons.wikimedia.org/wiki/File:Flickr_-_stringer_bel_-_Freetown,_Sierra_Leone.jpg |
| 05-freetown-1.jpg | https://commons.wikimedia.org/wiki/File:Freetown_1_(49757237023).jpg |
| 07-isatu-bangura.jpg | https://commons.wikimedia.org/wiki/File:Isatu_Bangura,_Freetown,_Sierra_Leone,_2015.jpg |
| 08-selling-millet.jpg | https://commons.wikimedia.org/wiki/File:Selling_Millet.jpg |
| 10-freetown-bossman.jpg | https://commons.wikimedia.org/wiki/File:Freetown_bossman.jpg |
| 11-sl-0009.jpg | https://commons.wikimedia.org/wiki/File:Sierra_Leone_0009_(7595942598).jpg |

## What the photos show
- **Head loads are everywhere.** People carry wide, shallow woven baskets, aluminium or enamel basins, and red or blue plastic bowls, often stacked (04). The load sits on a coiled cloth pad, and both hands stay free (03). Goods include oranges, limes, groundnut packets, pure-water sachets and bottles.
- **Men's clothing:**
  - Plain bright T-shirts: white, red, black, purple, orange.
  - Football jerseys: Barça-style stripes, Tottenham, NBA vests ("JAMES 23" on an okada passenger in 02).
  - White singlets (10).
  - Jeans, khaki or dark trousers, knee shorts.
  - Flip-flops or sandals; baseball caps; the odd visor or bandana.
- **Women's clothing:**
  - Wax-print (ankara) blouses and dresses, and polka-dot tops (08).
  - Ankle-length lappa wrappers in prints or indigo stripes (08, 05). The lappa is a fairly straight tube, not flared.
  - Head-ties in striped, printed or gara cloth (11, 08, 05), or a short bob wig (07).
  - Braids, twists and cornrows.
- **Gara (tie-dye)** is mostly deep indigo with lighter rings and sunburst bleeds. There are also rust and brown colourways.
- **Skin and features:**
  - Very dark to medium-deep brown with warm red undertones, and strong highlights on the forehead, nose and cheekbones (07, 10, 11).
  - The area around the eyes is often a little darker. Eye whites read strongly.
  - Hair is usually close-cropped or faded on men.
- **Build:** mostly slim and upright with straight posture, especially under head loads. Market women are sometimes fuller-figured.

## How this maps to the model
- **Skin:** four rich browns, `0x3b2418` to `0x6b4430`.
- **Face:** a 64 px texture per skin tone and face (3 faces: neutral man, smiling man, woman). It has painted light (forehead, nose, cheekbones), darker eye areas, warm off-white sclera, and lips slightly darker or pinker than the skin.
- **Prints (64 px tiles):**
  - gara indigo
  - gara rust
  - yellow ankara (red/blue roundels)
  - teal ankara (orange leaves)
  - indigo pinstripe (the lappa in 08)
  - black polka dot (the top in 08)
- **Jerseys:** a Leone Stars green "10" and a claret/blue striped "9", with numbers on the back.
- **Head loads:** basins in aluminium, red, blue, white or woven, carrying an orange mound, sachets or bags, or bottles. Women with head loads wear a flattened head-tie as the pad.
- **Hair and headwear:**
  - Men: short or fade hair, a cap (apprentices sometimes wear it backwards), or a kufi with a kaftan.
  - Women: a head-tie or a taller gele, bob wig, braids, cornrows, or a puff.
