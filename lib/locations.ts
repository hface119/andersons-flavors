export const LOCATIONS = [
  { id: "65486fb4267ff6e091d5fc68", name: "Sheridan Drive", className: "sheridan", color: "#597b2d", order: 1 },
  { id: "654871f43b487c570756c144", name: "Main Street", className: "main", color: "#7a4d26", order: 2 },
  { id: "654871f93b487c570756c5f4", name: "West Amherst", className: "west-amherst", color: "#305b79", order: 3 },
  { id: "65486ff3907419a6874f53b9", name: "Delaware Ave", className: "delaware", color: "#a93436", order: 4 },
  { id: "656bbaac3fe3596cc6aab549", name: "Union Road", className: "union", color: "#b95421", order: 5 },
  { id: "6548720009c1e7779fc6f345", name: "Lancaster", className: "lancaster", color: "#992a85", order: 6 },
  { id: "67ad6efbf158202dd2e17e0e", name: "Grand Island", className: "grand-island", color: "#2a7a7a", order: 7 },
] as const;

export type LocationId = typeof LOCATIONS[number]["id"];

export function getLocationById(id: string) {
  return LOCATIONS.find((l) => l.id === id);
}

export function getLocationColor(id: string) {
  return getLocationById(id)?.color ?? "#666";
}

export function getClassName(locationId: string) {
  return getLocationById(locationId)?.className ?? "";
}
