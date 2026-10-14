/** Curated remote imagery (Unsplash) with graceful local fallbacks.
 * Every <img> using these should hide itself onError so cards never break. */

const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`

export const IMG = {
  heroMain: u('photo-1500937386664-56d1dfef3854', 1000), // hands with harvest
  heroField: u('photo-1464226184884-fa280b87c399', 800), // green field
  heroMarket: u('photo-1542838132-92c53300491e', 800), // veg market
  heroAerial: u('photo-1560493676-04071c5f467b', 800), // aerial farmland
  farmerPortrait: u('photo-1625246333195-78d9c38ad449', 700), // farm
  sunset: u('photo-1444858291040-58f756a3bdd6', 900), // farm sunset
}

export const CATEGORY_IMG: Record<string, string> = {
  vegetables: u('photo-1542838132-92c53300491e', 600),
  fruits: u('photo-1601493700631-2b16ec4b4716', 600),
  'grains-cereals': u('photo-1586201375761-83865001e31c', 600),
  'pulses-legumes': u('photo-1596560548464-f010549b84d7', 600),
  spices: u('photo-1596040033229-a9821ebd058d', 600),
  'organic-produce': u('photo-1576045057995-568f588f82fb', 600),
}

export function imgFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).style.display = 'none'
}
