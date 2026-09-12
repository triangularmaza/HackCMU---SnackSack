import Phaser from 'phaser'
import classroomBackground from './assets/cozy-classroom-pixel.png'
import studentSprite from './assets/student-sneak-pixel.png'
import './style.css'

const GAME_WIDTH = 800
const GAME_HEIGHT = 500

class ClassroomScene extends Phaser.Scene {
  preload() {
    this.load.image('cozy-classroom', classroomBackground)
    this.load.image('student-sneak', studentSprite)
  }

  create() {
    this.score = 0
    this.lives = 3
    this.gameOver = false
    this.eating = false
    this.eatStartedAt = 0
    this.teacherIsWriting = false
    this.demoTeacherMode = true
    this.handlePointerDown = (pointer, gameObjects) => {
      if (!gameObjects.length) this.startEating(pointer)
    }
    this.handleTeacherWriting = (isWriting) => {
      this.demoTeacherMode = false
      this.setTeacherWriting(isWriting)
    }
    this.handleStudentCaught = () => this.catchStudent()
    this.handleTeacherTurnedAround = () => this.teacherTurnedAround()

    this.drawClassroom()
    this.createStudent()
    this.createHud()
    this.createControls()
    this.registerTeacherBridge()

    // The student is deliberately independent from the teacher implementation.
    // Until the teacher branch is connected, this makes the interaction playable.
    this.setTeacherWriting(true)
    this.time.addEvent({ delay: 5000, loop: true, callback: this.toggleDemoTeacher, callbackScope: this })

    this.input.on('pointerdown', this.handlePointerDown)
    this.input.on('pointerup', this.stopEating, this)
    this.input.on('pointerupoutside', this.stopEating, this)
    this.input.keyboard.on('keydown-SPACE', this.startEating, this)
    this.input.keyboard.on('keyup-SPACE', this.stopEating, this)
  }

  drawClassroom() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'cozy-classroom').setDisplaySize(GAME_WIDTH, GAME_HEIGHT)

    // The teacher branch can draw its chalk animation on this clear board.
    this.boardText = this.add.text(550, 144, 'Teacher is writing...', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#f6efd1', stroke: '#1d4937', strokeThickness: 2,
    }).setOrigin(0.5)
  }

  createStudent() {
    this.student = this.add.image(225, 292, 'student-sneak').setDisplaySize(205, 205)
    this.student.setOrigin(0.5, 0.56)
    this.crumbTimer = this.time.addEvent({
      delay: 115,
      loop: true,
      paused: true,
      callback: this.dropCrumb,
      callbackScope: this,
    })
  }

  dropCrumb() {
    const colors = [0xffd25c, 0xd88b32, 0xf6b94c]
    const size = Phaser.Math.Between(3, 6)
    const crumb = this.add.rectangle(
      this.student.x + Phaser.Math.Between(-12, 13),
      this.student.y - 13 + Phaser.Math.Between(-4, 5),
      size,
      size,
      Phaser.Utils.Array.GetRandom(colors),
    ).setAngle(Phaser.Math.Between(0, 45))

    this.tweens.add({
      targets: crumb,
      x: crumb.x + Phaser.Math.Between(-18, 18),
      y: crumb.y + Phaser.Math.Between(24, 42),
      angle: crumb.angle + Phaser.Math.Between(80, 180),
      alpha: 0,
      duration: Phaser.Math.Between(380, 620),
      ease: 'Quad.easeIn',
      onComplete: () => crumb.destroy(),
    })
  }

  createHud() {
    this.add.text(30, 25, 'SnackSack', { fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#513521' })
    this.scoreText = this.add.text(770, 26, 'Snack Score 0', { fontFamily: 'Arial, sans-serif', fontSize: '25px', fontStyle: 'bold', color: '#513521' }).setOrigin(1, 0)
    this.add.text(31, 64, 'Lives', { fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#8e332f', stroke: '#fff3d2', strokeThickness: 2 })
    this.heartsGraphic = this.add.graphics()
    this.statusText = this.add.text(400, 444, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#fff8df' }).setOrigin(0.5)
    this.hintText = this.add.text(400, 474, 'Hold the screen to snack while the teacher writes!', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#fff8df' }).setOrigin(0.5)
    this.updateHearts()
  }

  updateHearts() {
    this.heartsGraphic.clear()
    for (let index = 0; index < 3; index += 1) {
      const color = index < this.lives ? 0xd94045 : 0x785b5a
      this.drawHeart(104 + index * 29, 59, color)
    }
  }

  drawHeart(x, y, color) {
    this.heartsGraphic.fillStyle(color, 1)
    this.heartsGraphic.fillCircle(x + 6, y + 6, 6)
    this.heartsGraphic.fillCircle(x + 18, y + 6, 6)
    this.heartsGraphic.fillTriangle(x, y + 7, x + 24, y + 7, x + 12, y + 22)
  }

  createControls() {
    const button = this.add.text(45, 99, 'Demo: Teacher Writing', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#ffffff', backgroundColor: '#496d59', padding: { x: 12, y: 8 },
    }).setInteractive({ useHandCursor: true })
    button.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation()
      this.demoTeacherMode = !this.demoTeacherMode
      button.setText(this.demoTeacherMode ? 'Demo: Teacher Writing' : 'Demo: Teacher Paused')
      this.setTeacherWriting(this.demoTeacherMode)
    })
  }

  registerTeacherBridge() {
    // Teacher scene integration: this.events.emit('teacher-writing', true/false)
    // Also supports a game-wide event if the teacher is a separate Phaser scene.
    this.events.on('teacher-writing', this.handleTeacherWriting)
    this.game.events.on('teacher-writing', this.handleTeacherWriting)
    // Teacher integration: emit 'student-caught' when the teacher spots the snack.
    this.events.on('student-caught', this.handleStudentCaught)
    this.game.events.on('student-caught', this.handleStudentCaught)
    // Teacher integration: emit 'teacher-turned-around' when the teacher faces the class.
    this.events.on('teacher-turned-around', this.handleTeacherTurnedAround)
    this.game.events.on('teacher-turned-around', this.handleTeacherTurnedAround)
  }

  setTeacherWriting(isWriting) {
    this.teacherIsWriting = isWriting
    this.boardText.setText(isWriting ? 'Teacher is writing...' : 'Teacher stopped writing!')
    this.boardText.setColor(isWriting ? '#f6efd1' : '#f3a7a0')
    if (!isWriting) this.stopEating()
  }

  toggleDemoTeacher() {
    if (!this.demoTeacherMode) return
    if (this.teacherIsWriting) this.teacherTurnedAround()
    else this.setTeacherWriting(true)
  }

  teacherTurnedAround() {
    if (this.gameOver) return
    // Catch first so a held press cannot escape when the state changes.
    this.catchStudent()
    this.setTeacherWriting(false)
    this.boardText.setText('Teacher is watching!')
    this.boardText.setColor('#f3a7a0')
  }

  startEating(pointer) {
    if (this.gameOver || this.eating || !this.teacherIsWriting) return
    // Do not turn a click on the UI into eating.
    if (pointer?.gameObject) return
    this.eating = true
    this.eatStartedAt = this.time.now
    this.crumbTimer.paused = false
    this.statusText.setText('Sneaking a snack... keep holding!')
    this.tweens.add({ targets: this.student, angle: -4, duration: 210, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  stopEating() {
    if (!this.eating) return
    const seconds = (this.time.now - this.eatStartedAt) / 1000
    // Convex curve: staying longer is progressively more valuable.
    const gained = Math.max(1, Math.floor(4 * seconds + 3 * seconds ** 2))
    this.score += gained
    this.eating = false
    this.crumbTimer.paused = true
    this.tweens.killTweensOf(this.student)
    this.student.setAngle(0)
    this.scoreText.setText(`Snack Score ${this.score}`)
    this.statusText.setText(`Snacked for ${seconds.toFixed(1)}s  +${gained} points`)
  }

  catchStudent() {
    if (this.gameOver || !this.eating) return

    this.stopEating()
    this.lives -= 1
    this.updateHearts()
    this.statusText.setText(this.lives > 0 ? `Caught! ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left.` : 'Caught! No lives left.')
    this.cameras.main.shake(180, 0.008)

    if (this.lives === 0) this.finishGame()
  }

  finishGame() {
    this.gameOver = true
    this.crumbTimer.paused = true
    this.teacherIsWriting = false
    this.boardText.setText('Class is over!')
    this.hintText.setVisible(false)

    const overlay = this.add.rectangle(400, 250, 800, 500, 0x24170f, 0.78).setDepth(10)
    const summary = this.add.text(400, 210, `GAME OVER\nFinal Snack Score: ${this.score}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '38px', fontStyle: 'bold', align: 'center', color: '#fff2c7', lineSpacing: 12,
    }).setOrigin(0.5).setDepth(11)
    const restart = this.add.text(400, 310, 'Play Again', {
      fontFamily: 'Arial, sans-serif', fontSize: '25px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#b94b42', padding: { x: 22, y: 12 },
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true })
    restart.on('pointerdown', () => this.scene.restart())
    this.tweens.add({ targets: [overlay, summary, restart], alpha: { from: 0, to: 1 }, duration: 220 })
  }

  shutdown() {
    this.input.off('pointerdown', this.handlePointerDown)
    this.input.off('pointerup', this.stopEating, this)
    this.input.off('pointerupoutside', this.stopEating, this)
    this.input.keyboard.off('keydown-SPACE', this.startEating, this)
    this.input.keyboard.off('keyup-SPACE', this.stopEating, this)
    this.events.off('teacher-writing', this.handleTeacherWriting)
    this.game.events.off('teacher-writing', this.handleTeacherWriting)
    this.events.off('student-caught', this.handleStudentCaught)
    this.game.events.off('student-caught', this.handleStudentCaught)
    this.events.off('teacher-turned-around', this.handleTeacherTurnedAround)
    this.game.events.off('teacher-turned-around', this.handleTeacherTurnedAround)
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  scene: ClassroomScene,
})
