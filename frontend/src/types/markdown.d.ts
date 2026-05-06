// Vite's ?raw import suffix returns a string. Declare the shape so
// TypeScript stops complaining when we import "*.md?raw" via the
// @docs / @root aliases.
declare module "*.md?raw" {
  const content: string;
  export default content;
}
