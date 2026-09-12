import Phaser from 'phaser'

const STUDENT_WATCH_TIME = 5000
const MIN_BOARD_TIME = 2000
const MAX_BOARD_TIME = 6000
const WARNING_TIME = 750
const TEACHER_X = 610
const TEACHER_Y = 255
const TEACHER_SIZE = 190

export class ClassroomScene extends Phaser.Scene {
  preload() {
    this.load.image('classroom', 'assets/classroom/classroom_1.png')
    this.load.image('teacher-front', 'assets/teacher/fem_teacher_front.png')
    this.load.image('teacher-back', 'assets/teacher/fem_teacher_back.png')
  }

  create() {
    this.add.image(400, 250, 'classroom').setDisplaySize(800, 533)

    this.add
      .text(400, 42, 'SnackSack', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#fff7dc',
        stroke: '#3d2b1f',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.teacher = this.add
      .image(TEACHER_X, TEACHER_Y, 'teacher-front')
      .setDisplaySize(TEACHER_SIZE, TEACHER_SIZE)

    // The game begins with the teacher watching the students for five seconds.
    this.time.delayedCall(STUDENT_WATCH_TIME, () => this.faceBoard())
  }

  faceBoard() {
    this.teacher.setTexture('teacher-back').setAlpha(1)

    const boardTime = Phaser.Math.Between(MIN_BOARD_TIME, MAX_BOARD_TIME)
    const safeTime = boardTime - WARNING_TIME

    this.time.delayedCall(safeTime, () => this.warnStudents())
  }

  warnStudents() {
    this.teacher.setTint(0xff3b30)

    this.tweens.add({
      targets: this.teacher,
      alpha: 0.05,
      x: TEACHER_X + 12,
      duration: 75,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.teacher.setPosition(TEACHER_X, TEACHER_Y).setAlpha(1).clearTint()
        this.faceStudents()
      },
    })
  }

  faceStudents() {
    this.teacher.setTexture('teacher-front').setAlpha(1).clearTint()

    this.time.delayedCall(STUDENT_WATCH_TIME, () => this.faceBoard())
  }
}
