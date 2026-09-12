import Phaser from 'phaser'
import './style.css'

class ClassroomScene extends Phaser.Scene {
  create() {
    this.cameras.main.setBackgroundColor('#d8c39a')

    this.add
      .text(400, 230, 'SnackSack', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#fff7dc',
        stroke: '#3d2b1f',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.add
      .text(400, 300, 'A classroom snack game', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#3d2b1f',
      })
      .setOrigin(0.5)
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  parent: 'app',
  scene: ClassroomScene,
})
