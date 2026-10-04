# Night lights

`night-lights.webp` (2048×1024, equirectangular, grayscale) is derived from
NASA Earth Observatory's *Earth at Night (Black Marble) 2016* global composite,
built from Suomi NPP VIIRS day–night band data.

- Image: `BlackMarble_2016_01deg.jpg` (3600×1800, 0.1°), SHA-256
  `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1`
- Download: https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg
- Page: https://earthobservatory.nasa.gov/features/NightLights
- Credit: NASA Earth Observatory images by Joshua Stevens, using Suomi NPP VIIRS
  data from Miguel Román, NASA's Goddard Space Flight Center.
- Terms: NASA imagery is not copyrighted; credit requested.
  https://earthobservatory.nasa.gov/image-use-policy
- Retrieved: 2026-10-04

Processing (ImageMagick): the warm city lights are separated from the blue
land tint as `max(0, R − 0.62·B)`, converted to grayscale, resized to
2048×1024, levelled (`-level 1%,55% -gamma 0.85`) and saved as WebP, quality 82.
The scene adds them on Earth's night side only.
