/** Files present under public/ (see storyFiles() in vite.config.ts): paths like 'assets/img/sky_clouds.png'. */
declare module 'virtual:story-files' {
  const files: readonly string[];
  export default files;
}
