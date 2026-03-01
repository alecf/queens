// Region color index → CSS custom property name
// Colors defined in App.css for light/dark theme support
export function regionFillVar(regionId: number): string {
  return `var(--region-${regionId}-fill)`;
}

export function regionBorderVar(regionId: number): string {
  return `var(--region-${regionId})`;
}
