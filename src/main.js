import Phaser from 'phaser'
import './style.css'
import { ClassroomScene } from './scenes/ClassroomScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  pixelArt: true,
  parent: 'app',
  scene: ClassroomScene,
})
