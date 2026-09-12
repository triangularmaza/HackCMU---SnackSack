import Phaser from 'phaser'
import classroomBackground from './assets/cozy-classroom-pixel.png'
import snackBagSprite from './assets/snack-bag-pixel.png'
import studentSprite from './assets/student-sneak-pixel.png'
import './style.css'

const GAME_WIDTH = 800
const GAME_HEIGHT = 500
const MIN_STUDENT_WATCH_TIME = 2000
const MAX_STUDENT_WATCH_TIME = 6000
const MIN_BOARD_TIME = 2000
const MAX_BOARD_TIME = 6000
const HALF_TURN_TIME = 750
const TEACHER_X = 610
const TEACHER_Y = 255
const TEACHER_SIZE = 190
const QTE_INTERVAL = 1050
const MIN_QTE_INTERVAL = 450
const QTE_SPEED_GAIN_PER_MINUTE = 0.08
const MATH_QUESTION_CHANCE = 0.25
const MIN_MATH_QUESTION_SCORE = 300
const MATH_SCORE_DRAIN_INTERVAL = 1000
const MATH_SCORE_DRAIN_AMOUNT = 10
const MATH_SCORE_DRAIN_INCREASE = 2

function createMathQuestion() {
  const a = Phaser.Math.Between(0, 999)
  const b = Phaser.Math.Between(0, 999)
  const addition = Phaser.Math.Between(0, 1) === 1
  return { prompt: `${a} ${addition ? '+' : '−'} ${b} = ?`, answer: addition ? a + b : a - b }
}
const QTE_DIRECTIONS = [
  { name: 'UP', symbol: '↑' },
  { name: 'DOWN', symbol: '↓' },
  { name: 'LEFT', symbol: '←' },
  { name: 'RIGHT', symbol: '→' },
]
const QTE_KEY_BINDINGS = [
  { key: 'UP', direction: 'UP' }, { key: 'W', direction: 'UP' },
  { key: 'DOWN', direction: 'DOWN' }, { key: 'S', direction: 'DOWN' },
  { key: 'LEFT', direction: 'LEFT' }, { key: 'A', direction: 'LEFT' },
  { key: 'RIGHT', direction: 'RIGHT' }, { key: 'D', direction: 'RIGHT' },
]
const QTE_KEY_HINTS = { UP: 'W / ↑', DOWN: 'S / ↓', LEFT: 'A / ←', RIGHT: 'D / →' }
const COMBO_LEVELS = [
  { threshold: 1, title: 'TINY BITE', message: 'Mmm... stealthy!', bonus: 0, color: 0xd9903d },
  { threshold: 4, title: 'CRUNCH CADET', message: 'So crunchy!', bonus: 10, color: 0x7fb85a },
  { threshold: 8, title: 'UNBELIEVABLE!', message: 'Nobody saw that!', bonus: 25, color: 0xb84c3f },
  { threshold: 14, title: 'SNACK LEGEND', message: 'I am unstoppable!', bonus: 60, color: 0x9b67bd },
]
const SNACKS = [
  { name: 'Cookie', detail: 'Balanced', multiplier: 1, riskRate: 12, color: 0xd9903d },
  { name: 'Chips', detail: 'High score · high risk', multiplier: 1.5, riskRate: 19, color: 0xe05a3e },
  { name: 'Gummies', detail: 'Low risk · lower score', multiplier: 0.75, riskRate: 7, color: 0x9b67bd },
]

class ClassroomScene extends Phaser.Scene {
  preload() {
    this.load.image('cozy-classroom', classroomBackground)
    this.load.image('snack-bag', snackBagSprite)
    this.load.image('student-sneak', studentSprite)
    this.load.image('teacher-front', 'assets/teacher/fem_teacher_front.png')
    this.load.image('teacher-angry', 'assets/teacher/fem_teacher_angry.png')
    this.load.image('teacher-back', 'assets/teacher/fem_teacher_back.png')
    this.load.image('teacher-turning', 'assets/teacher/fem_teacher_turning.png')
  }

  create() {
    this.score = 0
    this.lives = 3
    this.gameOver = false
    this.roundElapsed = 0
    this.mathQuestion = null
    this.qteActive = false
    this.qteDirection = null
    this.qteCombo = 0
    this.comboLevel = 0
    this.qteTimer = null
    this.teacherIsWatching = true
    this.selectedSnack = SNACKS[0]
    this.risk = 0
    this.streakLevel = 0
    this.achievedMilestones = new Set()
    this.eatStartedAt = 0
    this.teacherIsWriting = false
    this.handleTeacherWriting = (isWriting) => {
      this.setTeacherWriting(isWriting)
    }
    this.handleStudentCaught = () => this.catchStudent(true)
    this.handleTeacherTurnedAround = () => this.teacherTurnedAround()

    this.drawClassroom()
    this.createTeacher()
    this.createStudent()
    this.createHud()
    this.createControls()
    this.createInvisibleDirectionZones()
    this.registerTeacherBridge()

    this.faceStudents()

    this.qteKeyHandlers = QTE_KEY_BINDINGS.map(({ key, direction }) => ({ key, handler: () => this.submitQte(direction) }))
    this.qteKeyHandlers.forEach(({ key, handler }) => this.input.keyboard.on(`keydown-${key}`, handler))
    this.mathKeyHandler = (event) => {
      if (!this.mathQuestion || event.repeat) return
      if (/^[0-9-]$/.test(event.key) || ['Backspace', 'Enter'].includes(event.key)) {
        event.preventDefault()
        this.enterMathKey(event.key)
      }
    }
    this.input.keyboard.on('keydown', this.mathKeyHandler)
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.mathKeyHandler)
    })
  }

  drawClassroom() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'cozy-classroom').setDisplaySize(GAME_WIDTH, GAME_HEIGHT)

    // The teacher branch can draw its chalk animation on this clear board.
    this.boardText = this.add.text(550, 144, 'Teacher is writing...', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#f6efd1', stroke: '#1d4937', strokeThickness: 2,
    }).setOrigin(0.5)
  }

  createTeacher() {
    this.teacher = this.add.image(TEACHER_X, TEACHER_Y, 'teacher-front').setDisplaySize(TEACHER_SIZE, TEACHER_SIZE)
  }

  faceBoard() {
    if (this.gameOver) return
    this.teacherIsWatching = false
    this.teacher.setTexture('teacher-back').setAlpha(1).clearTint()
    this.setTeacherWriting(true)

    const boardTime = Phaser.Math.Between(MIN_BOARD_TIME, MAX_BOARD_TIME)
    this.time.delayedCall(boardTime, this.turnHalfway, [], this)
  }

  turnHalfway() {
    if (this.gameOver) return
    // Keep the eating window open until she fully faces the student.
    this.teacherIsWatching = false
    this.teacher.setTexture('teacher-turning').setAlpha(1).clearTint()
    this.boardText.setText('Teacher is turning...')
    this.boardText.setColor('#f3d36c')
    this.time.delayedCall(HALF_TURN_TIME, () => {
      if (this.gameOver) return
      if (Phaser.Math.Between(0, 1) === 1) this.faceStudents()
      else this.faceBoard()
    })
  }

  faceStudents() {
    if (this.gameOver) return
    this.teacherIsWatching = true
    this.teacher.setTexture('teacher-front').setAlpha(1).clearTint()
    this.teacherTurnedAround()
    if (this.score >= MIN_MATH_QUESTION_SCORE && Phaser.Math.FloatBetween(0, 1) < MATH_QUESTION_CHANCE) {
      this.askMathQuestion()
      return
    }
    this.scheduleTeacherReturn()
  }

  scheduleTeacherReturn() {
    const watchTime = Phaser.Math.Between(MIN_STUDENT_WATCH_TIME, MAX_STUDENT_WATCH_TIME)
    this.time.delayedCall(watchTime, this.faceBoard, [], this)
  }

  askMathQuestion() {
    this.mathQuestion = createMathQuestion()
    this.mathAnswer = ''
    this.mathDrainElapsed = 0
    this.mathDrainRate = MATH_SCORE_DRAIN_AMOUNT
    this.mathOverlay = this.add.container(0, 0).setDepth(30)
    const add = (object) => { this.mathOverlay.add(object); return object }
    const label = (x, y, text, size = 22) => add(this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color: '#fff2c7',
    }).setOrigin(0.5))
    add(this.add.rectangle(400, 250, 800, 500, 0x24170f, 0.92).setInteractive())
    label(400, 45, 'A quick question for you!', 28)
    label(400, 90, this.mathQuestion.prompt, 34)
    this.mathAnswerText = label(400, 137, 'Answer: _', 28)
    this.mathFeedback = label(400, 179, 'Type your answer or use the number pad.', 17)
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'Backspace']
    keys.forEach((key, index) => {
      const x = 300 + (index % 3) * 100
      const y = 227 + Math.floor(index / 3) * 51
      add(this.add.rectangle(x, y, 90, 43, 0x7b4741).setInteractive({ useHandCursor: true }))
        .on('pointerdown', () => this.enterMathKey(key))
      label(x, y, key === 'Backspace' ? 'DEL' : key)
    })
    add(this.add.rectangle(400, 441, 290, 48, 0x4c7851).setInteractive({ useHandCursor: true }))
      .on('pointerdown', () => this.enterMathKey('Enter'))
    label(400, 441, 'Answer ↵')
    this.mathStatsText = label(400, 482, `Score: ${this.score} • Lives: ${this.lives} • −${MATH_SCORE_DRAIN_AMOUNT} points/sec • Wrong answer: −1 life`, 16)
  }

  enterMathKey(key) {
    if (!this.mathQuestion || this.gameOver) return
    if (key === 'Enter') {
      if (!/^-?\d+$/.test(this.mathAnswer)) {
        this.mathFeedback.setText('Enter a number first.')
        return
      }
      if (Number(this.mathAnswer) !== this.mathQuestion.answer) {
        this.lives = Math.max(0, this.lives - 1)
        this.updateHearts()
        this.cameras.main.shake(180, 0.008)
        if (this.lives === 0) {
          this.finishGame()
          return
        }
        this.updateMathStats()
        this.mathFeedback.setText('Wrong answer! −1 life. Try again.')
        this.mathAnswer = ''
        this.mathAnswerText.setText('Answer: _')
        return
      }
      this.mathOverlay.destroy()
      this.mathOverlay = null
      this.mathQuestion = null
      this.statusText.setText('Correct! Now keep still while she watches.')
      this.scheduleTeacherReturn()
      return
    }
    if (key === 'Backspace') this.mathAnswer = this.mathAnswer.slice(0, -1)
    else if (key === '-') this.mathAnswer = this.mathAnswer.startsWith('-') ? this.mathAnswer.slice(1) : `-${this.mathAnswer}`
    else if (/^\d$/.test(key) && this.mathAnswer.replace('-', '').length < 4) this.mathAnswer += key
    this.mathAnswerText.setText(`Answer: ${this.mathAnswer || '_'}`)
  }

  updateMathStats() {
    this.mathStatsText.setText(`Score: ${this.score} • Lives: ${this.lives} • −${this.mathDrainRate} points/sec • Wrong answer: −1 life`)
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
    this.add.text(30, 25, 'Eat-In-Klass', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: '#ffdc78', stroke: '#35251e', strokeThickness: 5,
      shadow: { offsetX: 3, offsetY: 4, color: '#201a17', blur: 4, stroke: true, fill: true },
    })
    this.add.rectangle(400, 52, 230, 84, 0x35251e, 0.96).setStrokeStyle(3, 0xffd36b)
    this.add.text(400, 27, 'SCORE', { fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#fff2c7', letterSpacing: 3 }).setOrigin(0.5)
    this.scoreText = this.add.text(400, 62, '0', { fontFamily: 'Arial, sans-serif', fontSize: '44px', fontStyle: 'bold', color: '#ffdc78', stroke: '#201a17', strokeThickness: 3 }).setOrigin(0.5)
    this.add.text(31, 64, 'Lives', { fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#8e332f', stroke: '#fff3d2', strokeThickness: 2 })
    this.heartsGraphic = this.add.graphics()
    this.statusText = this.add.text(400, 444, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#fff8df' }).setOrigin(0.5)
    this.qtePrompt = this.add.text(315, 186, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#fff2c7', stroke: '#583426', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12).setVisible(false)
    this.riskLabel = this.add.text(650, 57, 'RISK', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#fff2c7', stroke: '#583426', strokeThickness: 2 }).setOrigin(0.5)
    this.riskBack = this.add.rectangle(650, 76, 152, 13, 0x4a3029, 0.85)
    this.riskFill = this.add.rectangle(576, 76, 0, 9, 0xe54e45).setOrigin(0, 0.5)
    this.hintText = this.add.text(400, 474, 'Follow QTEs with WASD, arrow keys, or the invisible screen edges.', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fff8df' }).setOrigin(0.5)
    this.updateHearts()
    this.updateRisk()
  }

  updateRisk() {
    const progress = Phaser.Math.Clamp(this.risk / 100, 0, 1)
    this.riskFill.width = 148 * progress
    this.riskFill.fillColor = progress > 0.65 ? 0xe54e45 : 0xe59c41
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
    this.add.circle(685, 385, 38, 0x5d426e, 0.92)
    this.snackBagButton = this.add.image(685, 385, 'snack-bag').setDisplaySize(68, 68).setInteractive({ useHandCursor: true })
    this.add.text(685, 428, 'BAG', { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff8df', stroke: '#583426', strokeThickness: 2 }).setOrigin(0.5)
    this.snackBagButton.on('pointerdown', (pointer) => {
      pointer.event?.stopPropagation?.()
      if (this.gameOver || this.mathQuestion) return
      this.stopQte()
      this.createSnackSelection()
    })
  }

  createInvisibleDirectionZones() {
    const zones = [
      ['UP', 400, 112, 210, 92],
      ['DOWN', 400, 450, 210, 88],
      ['LEFT', 78, 285, 156, 178],
      ['RIGHT', 730, 270, 120, 140],
    ]
    zones.forEach(([direction, x, y, width, height]) => {
      const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true })
      zone.setAlpha(0.001)
      zone.on('pointerdown', () => this.submitQte(direction))
    })
  }

  createSnackSelection() {
    if (this.snackSelection?.length) return
    this.snackSelection = []
    const add = (object) => {
      object.setDepth(20)
      this.snackSelection.push(object)
      return object
    }
    add(this.add.rectangle(400, 250, 800, 500, 0x24170f, 0.75))
    add(this.add.text(400, 145, 'OPEN SNACK BAG', {
      fontFamily: 'Arial, sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#fff2c7', stroke: '#6c3826', strokeThickness: 5,
    }).setOrigin(0.5))
    add(this.add.text(400, 185, 'Each snack changes your score and risk.', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#fff2c7',
    }).setOrigin(0.5))

    SNACKS.forEach((snack, index) => {
      const x = 210 + index * 190
      const card = add(this.add.rectangle(x, 302, 170, 178, snack.color, 0.96).setInteractive({ useHandCursor: true }))
      add(this.drawSnackIllustration(x, 280, snack.name))
      add(this.add.text(x, 337, snack.name.toUpperCase(), { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5))
      add(this.add.text(x, 367, `×${snack.multiplier} SCORE   •   ${snack.riskRate} RISK`, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', align: 'center', color: '#fff8df' }).setOrigin(0.5))
      card.on('pointerdown', () => this.selectSnack(snack))
    })
  }

  drawSnackIllustration(x, y, snackName) {
    const art = this.add.graphics()
    if (snackName === 'Cookie') {
      art.fillStyle(0x6e3f22).fillCircle(x, y, 39)
      art.fillStyle(0xf2b54e).fillCircle(x, y, 34)
      art.fillStyle(0x754225).fillCircle(x - 13, y - 10, 5).fillCircle(x + 13, y - 5, 5).fillCircle(x - 5, y + 15, 5).fillCircle(x + 16, y + 13, 4)
    } else if (snackName === 'Chips') {
      art.fillStyle(0x8b2d31).fillRoundedRect(x - 28, y - 39, 56, 78, 7)
      art.fillStyle(0xf1c24f).fillRoundedRect(x - 24, y - 34, 48, 10, 3)
      art.fillStyle(0xf6d766).fillCircle(x - 10, y - 1, 11).fillCircle(x + 10, y + 9, 11).fillCircle(x + 3, y - 12, 10)
      art.lineStyle(3, 0xb64938).strokeRoundedRect(x - 28, y - 39, 56, 78, 7)
    } else {
      art.fillStyle(0xf1f0d8).fillRoundedRect(x - 39, y - 27, 78, 54, 18)
      art.fillStyle(0xe76380).fillCircle(x - 17, y - 2, 13)
      art.fillStyle(0x7fb85a).fillCircle(x + 1, y + 7, 13)
      art.fillStyle(0x8c68bd).fillCircle(x + 19, y - 5, 13)
      art.lineStyle(3, 0x754c8e).strokeRoundedRect(x - 39, y - 27, 78, 54, 18)
    }
    return art
  }

  selectSnack(snack) {
    this.selectedSnack = snack
    this.snackSelection.forEach((object) => object.destroy())
    this.snackSelection = []
    this.hintText.setText('Follow the arrow: touch an invisible screen edge or use arrow keys.')
    this.statusText.setText(`${snack.name} selected — score ×${snack.multiplier}, risk ${snack.riskRate}.`)
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
    this.teacherIsWatching = !isWriting
    this.boardText.setText(isWriting ? 'Teacher is writing...' : 'Teacher stopped writing!')
    this.boardText.setColor(isWriting ? '#f6efd1' : '#f3a7a0')
    if (isWriting) this.startQte()
    else this.stopQte()
  }

  teacherTurnedAround() {
    if (this.gameOver) return
    this.teacherIsWatching = true
    this.setTeacherWriting(false)
    this.boardText.setText('Teacher is watching!')
    this.boardText.setColor('#f3a7a0')
  }

  startQte() {
    if (this.gameOver || this.qteActive) return
    this.qteActive = true
    this.qteCombo = 0
    this.comboLevel = 0
    this.eatStartedAt = this.time.now
    this.time.delayedCall(500, this.nextQte, [], this)
  }

  stopQte() {
    this.qteActive = false
    this.qteDirection = null
    this.qteTimer?.remove(false)
    this.qteTimer = null
    this.qtePrompt?.setVisible(false)
    if (this.crumbTimer) this.crumbTimer.paused = true
    this.tweens.killTweensOf(this.student)
    this.student?.setAngle(0)
  }

  getQteDelay(baseDelay) {
    const speed = 1 + (this.roundElapsed / 60000) * QTE_SPEED_GAIN_PER_MINUTE
    return baseDelay * Math.max(MIN_QTE_INTERVAL / QTE_INTERVAL, 1 / speed)
  }

  nextQte() {
    if (!this.qteActive || !this.teacherIsWriting || this.gameOver) return
    const choices = QTE_DIRECTIONS.filter(({ name }) => name !== this.qteDirection)
    const direction = Phaser.Utils.Array.GetRandom(choices)
    this.qteDirection = direction.name
    this.qtePrompt.setText(direction.symbol).setColor('#fff2c7').setVisible(true).setScale(0.65)
    this.tweens.add({ targets: this.qtePrompt, scale: 1, duration: 140, ease: 'Back.easeOut' })
    this.statusText.setText(`Sneak QTE  •  Combo ${this.qteCombo}  •  press ${QTE_KEY_HINTS[direction.name]}`)
    this.qteTimer = this.time.delayedCall(this.getQteDelay(QTE_INTERVAL), () => this.failQte('Too slow!'))
  }

  submitQte(direction) {
    if (this.gameOver || this.mathQuestion) return
    // In Watching mode the student should stay still. Any directional input is
    // an obvious movement, so the teacher catches them at that moment.
    if (this.teacherIsWatching) {
      this.catchStudent(true)
      return
    }
    if (!this.qteActive || !this.teacherIsWriting) return
    if (direction !== this.qteDirection) {
      this.failQte('Wrong way!')
      return
    }
    this.qteTimer?.remove(false)
    this.qteTimer = null
    this.qteCombo += 1
    const gained = Math.max(1, Math.floor((3 + this.qteCombo ** 1.35) * this.selectedSnack.multiplier))
    this.score += gained
    this.risk = Math.max(0, this.risk - 3)
    this.scoreText.setText(this.score.toLocaleString())
    this.crumbTimer.paused = false
    this.time.delayedCall(160, () => { if (this.crumbTimer) this.crumbTimer.paused = true })
    this.tweens.killTweensOf(this.student)
    this.tweens.add({
      targets: this.student,
      angle: { from: -16, to: 16 },
      duration: 45,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => this.student.setAngle(0),
    })
    this.qtePrompt.setColor('#9ee176')
    this.statusText.setText(`Nice! +${gained}  •  Combo ${this.qteCombo}`)
    const level = this.getComboLevel(this.qteCombo)
    if (level && level.threshold > this.comboLevel) {
      this.comboLevel = level.threshold
      this.showComboBubble(level)
    }
    this.time.delayedCall(this.getQteDelay(250), this.nextQte, [], this)
  }

  failQte(message) {
    if (!this.qteActive || this.gameOver) return
    this.qteTimer?.remove(false)
    this.qteTimer = null
    this.qteCombo = 0
    this.comboLevel = 0
    this.risk = Math.min(100, this.risk + 16)
    this.qtePrompt.setColor('#f06c5e')
    this.statusText.setText(`${message}  +16 RISK`)
    this.cameras.main.shake(75, 0.003)
    if (this.risk >= 100) {
      this.catchStudent(true)
      return
    }
    this.time.delayedCall(this.getQteDelay(420), this.nextQte, [], this)
  }

  getComboLevel(combo) {
    return [...COMBO_LEVELS].reverse().find((level) => combo >= level.threshold)
  }

  showComboBubble(level) {
    const bubble = this.add.container(168, 176).setDepth(8).setScale(0.2).setAlpha(0)
    const shape = this.add.graphics()
    shape.fillStyle(0xfff2c7, 1).fillRoundedRect(-80, -30, 160, 60, 10)
    shape.fillTriangle(28, 27, 46, 27, 39, 42)
    shape.lineStyle(3, level.color, 1).strokeRoundedRect(-80, -30, 160, 60, 10)
    const title = this.add.text(0, -11, level.title, {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: `#${level.color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5)
    const message = this.add.text(0, 10, level.message, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#583426',
    }).setOrigin(0.5)
    bubble.add([shape, title, message])
    if (level.bonus) {
      this.score += level.bonus
      this.scoreText.setText(this.score.toLocaleString())
    }
    this.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut', yoyo: true, hold: 1250, onComplete: () => bubble.destroy() })
  }

  update(_time, delta) {
    if (this.gameOver) return
    if (this.mathQuestion) {
      this.mathDrainElapsed += delta
      const seconds = Math.floor(this.mathDrainElapsed / MATH_SCORE_DRAIN_INTERVAL)
      if (seconds > 0) {
        const pointsLost = seconds * this.mathDrainRate + MATH_SCORE_DRAIN_INCREASE * seconds * (seconds - 1) / 2
        this.mathDrainRate += seconds * MATH_SCORE_DRAIN_INCREASE
        this.mathDrainElapsed %= MATH_SCORE_DRAIN_INTERVAL
        this.score = Math.max(0, this.score - pointsLost)
        this.scoreText.setText(this.score.toLocaleString())
        this.updateMathStats()
      }
      return
    }
    this.roundElapsed += delta
    if (!this.qteActive) {
      this.risk = Math.max(0, this.risk - 13 * (delta / 1000))
    }
    this.updateRisk()
  }

  catchStudent(force = false) {
    if (this.gameOver || (!this.qteActive && !force)) return

    this.teacher.setTexture('teacher-angry').setAlpha(1).clearTint()
    this.stopQte()
    this.risk = 35
    this.updateRisk()
    this.lives -= 1
    this.updateHearts()
    this.statusText.setText(this.lives > 0 ? `Caught! ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left.` : 'Caught! No lives left.')
    this.cameras.main.shake(180, 0.008)

    if (this.lives === 0) this.finishGame()
  }

  finishGame() {
    this.gameOver = true
    this.mathOverlay?.destroy()
    this.mathOverlay = null
    this.mathQuestion = null
    this.stopQte()
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
    this.qteKeyHandlers?.forEach(({ key, handler }) => this.input.keyboard.off(`keydown-${key}`, handler))
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
