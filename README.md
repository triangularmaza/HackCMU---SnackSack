# SnackSack

**SnackSack** is a fast-paced pixel-art classroom game about taking the perfect secret snack break. The teacher alternates between writing on the board and watching the class. While their back is turned, the player completes quick directional QTEs to sneak bites, build a combo, and earn points. When the teacher is watching, one careless movement can cost a heart.

## The Idea

A snack break sounds simple until the teacher is only a few steps away. SnackSack turns that familiar classroom moment into a tense risk-and-reward loop: play accurately and quickly while it is safe, but stop moving at exactly the right time.

The game uses a cozy, Stardew Valley-inspired pixel-art classroom, a large expressive student character, animated crumbs, and a cartoon snack backpack to make a small arcade interaction feel playful and readable.

## How to Play

1. Wait until the teacher is **Writing** on the board.
2. Follow the on-screen direction QTE with either **WASD**, the **arrow keys**, or an invisible touch zone at the matching screen edge.
3. Correct inputs increase your Combo and award more points over time. Select different snacks from the backpack during class to change score multipliers and risk.
4. Avoid wrong inputs and missed QTEs: each mistake adds Risk. At maximum Risk, the teacher catches you.
5. When the teacher is **Watching**, do not press a directional key. A directional input while the teacher is watching costs one heart.
6. You have three hearts. When all three are gone, the game shows your final Snack Score.

## Game Systems

- **Live teacher state:** the teacher cycles through Watching, Writing, a visual warning, and back to Watching.
- **Directional QTEs:** timed prompts support keyboard and touch without covering the scene with large controls.
- **Combo tiers:** TINY BITE, CRUNCH CADET, UNBELIEVABLE!, and SNACK LEGEND each have a unique dialogue bubble and bonus reward.
- **Risk/reward scoring:** the score rises on a curve as a combo grows; mistakes raise the Risk meter.
- **Snack bag:** Cookie, Chips, and Gummies can be chosen in-game. Each has a different score multiplier and risk profile.
- **Feedback:** crumbs, student motion, camera shake, score updates, heart loss, and teacher warnings make every action clear.

## Tech Stack

- [Phaser 3](https://phaser.io/) for game scenes, input, animation, timers, and UI.
- [Vite](https://vite.dev/) for the local development workflow and production build.
- JavaScript, HTML, and CSS.

## Run Locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Collaboration

The student gameplay and teacher behavior were developed as separate feature branches and then integrated into `codex/feature/eating-and-score`. This keeps the teacher state machine independent from snack scoring, QTE input, and the student-facing visual systems.

## Future Ideas

- Additional snacks with unique QTE patterns and trade-offs.
- Classroom events such as a bell, a classmate distraction, or a substitute teacher.
- A high-score table and challenge modes with faster teacher cycles.
- Sound effects, music, and accessibility options for QTE timing.
