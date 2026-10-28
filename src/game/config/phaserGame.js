import Phaser from 'phaser'
import OverworldScene from '../scenes/OverworldScene'
import ProjectScene   from '../scenes/ProjectScene'
import IdentityScene  from '../scenes/IdentityScene'

const phaserConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  // OverworldScene is first — it starts automatically.
  // ProjectScene and IdentityScene are registered so scene.launch() works from any scene.
  scene: [OverworldScene, ProjectScene, IdentityScene],
}

export default phaserConfig
