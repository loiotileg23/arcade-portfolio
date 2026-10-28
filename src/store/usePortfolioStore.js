import { create } from 'zustand'

const usePortfolioStore = create((set) => ({
  // Holds the slug and title of the project the player has entered.
  // Null when no overlay is active.
  // slug  — used to look up the full project record (e.g. tags) from PROJECTS
  // title — stored directly so consumers don't need to import PROJECTS just to read the name
  activeProject: null, // { slug: string, title: string } | null

  // Which Phaser scene is in front — drives the touch D-pad visibility.
  activeScene: 'overworld', // 'overworld' | 'project' | 'identity'

  // Skill Inventory panel — while open, the overworld ignores movement input.
  skillsOpen: false,

  setActiveProject: (slug, title) => set({ activeProject: { slug, title } }),
  clearActiveProject: () => set({ activeProject: null }),
  setActiveScene: (activeScene) => set({ activeScene }),
  setSkillsOpen: (skillsOpen) => set({ skillsOpen }),
}))

export default usePortfolioStore
