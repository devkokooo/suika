import { Scene } from 'phaser';
import { HEIGHT, WIDTH } from '../main';

const PINK_100 = 0xfce7f3;

enum TIER {
  NONE, ONE, TWO, THREE, FOUR, FIVE,
  SIX, SEVEN, EIGHT, NINE, TEN, ELEVEN,
}

export class Game extends Scene {
  // BALL RELATED
  radii = [
    // +4, +8, +12, +14, +10
    12, 16, 24, 36, 60, 70,
    // +10, +10, +10, +10, +10, +10
    80, 90, 100, 110, 120, 130 
  ];
  colors = [
    // cherry, strawberry, grape, tangerine, orange
    // red-600, red-400, violet-600, amber-400, orange-500
    0xe7000b, 0xff6467, 0x7f22fe, 0xffba00, 0xff6900,
    // apple, korean pear, peach, pineapple, melon, watermelon
    // red-600, yellow-200, pink-300, yellow-300, lime-300, green-500
    0xe7000b, 0xfff085, 0xfda5d5, 0xffdf20, 0xbbf451, 0x00c951,
  ];
  tiers = [
    TIER.ONE, TIER.TWO, TIER.THREE, TIER.FOUR, TIER.FIVE,
    TIER.SIX, TIER.SEVEN, TIER.EIGHT, TIER.NINE, TIER.TEN, TIER.ELEVEN,
  ];

  currentBall = { radius: -1, color: -1, tier: TIER.NONE };
  nextBall = { radius: -1, color: -1, tier: TIER.NONE };
  storedBall = { radius: -1, color: -1, tier: TIER.NONE };

  score = 0;
  fibseq = [1,1,2,3,5,8,13,21,34,55,89];

  interface: Phaser.GameObjects.Graphics;
  ballContainer: Phaser.GameObjects.Graphics;
  previewBall: Phaser.GameObjects.Graphics;
  nextBallUI: Phaser.GameObjects.Graphics;
  storedBallUI: Phaser.GameObjects.Graphics;

  activePointer: Phaser.Input.Pointer;

  scoreText: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  preload() {
    this.load.setPath('assets');
    this.interface = this.add.graphics();
    this.ballContainer = this.add.graphics();
    this.previewBall = this.add.graphics();
    this.nextBallUI = this.add.graphics();
    this.storedBallUI = this.add.graphics();

    this.generateCurrentBall();
    this.generateNextBall();
  }

  create() {
    const width = WIDTH / 2, height = WIDTH / 2;
    const x = WIDTH - width, y = 100 + HEIGHT / 2;
    const thickness = 16;

    this.renderBallContainer({ width, height, x, y, thickness });

    // Display next ball
    this.add.text(WIDTH - 200, 50, "NEXT BALL", {
      fontStyle: "bold", fontFamily: "monospace", fontSize: 20,
    });
    this.interface.lineStyle(4, PINK_100);
    this.interface.strokeRect(WIDTH - 200, 80, 150, 150);

    // Display stored ball
    this.add.text(WIDTH - 200, 275, "STORAGE (PRESS Z)", {
      fontStyle: "bold", fontFamily: "monospace", fontSize: 20,
    });
    this.interface.lineStyle(4, PINK_100);
    this.interface.strokeRect(WIDTH - 200, 305, 150, 150);

    // Display score
    this.add.text(WIDTH - 975, 50, "SCORE", {
      fontStyle: "bold", fontFamily: "monospace", fontSize: 20,
    });
    this.scoreText = this.add.text(WIDTH - 975, 80, `${this.score}`, {
      fontStyle: "bold", fontFamily: "monospace", fontSize: 50,
    });

    // Keyboard input (Z to store)
    const keyZ = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    keyZ?.on("down", () => {
      const sb = this.storedBall;

      // If there is ball, swap the balls
      if(sb.color !== -1 && sb.radius !== -1) {
        const cb = this.currentBall;

        this.storedBall = cb;
        this.currentBall = sb;

        this.previewStoredBall({ ballRadius: cb.radius, ballColor: cb.color });
        this.previewCurrentBall({ pointer: this.activePointer });
      }
      // If no ball, put ball in
      else {
        const cb = this.currentBall;
        const nb = this.nextBall;

        this.storedBall = {
          radius: cb.radius,
          color: cb.color,
          tier: cb.tier,
        };
        this.currentBall = {
          radius: nb.radius,
          color: nb.color,
          tier: nb.tier,
        };

        this.previewStoredBall({ ballRadius: cb.radius, ballColor: cb.color });
        this.generateNextBall();
        this.previewCurrentBall({ pointer: this.activePointer });
      }
    });

    const boxLeft = x - width / 2, boxRight = x + width / 2;
    const boxTop = y - height / 2;

    this.matter.world.engine.positionIterations = 10;
    this.matter.world.engine.velocityIterations = 6;
    this.matter.world.engine.constraintIterations = 4

    // Spawn ball on click above container
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if(
        pointer.y < boxTop &&
        pointer.x > boxLeft &&
        pointer.x < boxRight
      ) {
        this.activePointer = pointer;

        const ball = this.add.circle(pointer.x, pointer.y, this.currentBall.radius, this.currentBall.color);
        ball.setStrokeStyle(1, PINK_100);

        this.matter.add.gameObject(ball, {
          shape: { type: "circle", radius: this.currentBall.radius },
          restitution: 0.1,
        }).setData({ mergeable: true, tier: this.currentBall.tier });

        this.currentBall = this.nextBall;
        this.generateNextBall();
        this.previewCurrentBall({ pointer });
      }
    });

    // Ball cursor tracking
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Display next ball at cursor
      if(pointer.y < boxTop && pointer.x > boxLeft && pointer.x < boxRight) {
        this.activePointer = pointer;
        this.previewCurrentBall({ pointer });
      }
    });

    // Handle ball collision and merging
    this.matter.world.on("collisionstart", (
      _: Phaser.Physics.Matter.Events.CollisionStartEvent,
      bodyA: MatterJS.BodyType,
      bodyB: MatterJS.BodyType
    ) => {
      this.handleMerging(bodyA, bodyB);
    });

    this.matter.world.on("collisionactive", (
      _: Phaser.Physics.Matter.Events.CollisionActiveEvent,
      bodyA: MatterJS.BodyType,
      bodyB: MatterJS.BodyType
    ) => {
      this.handleMerging(bodyA, bodyB);
    });

    this.matter.world.on("collisionend", (
      _: Phaser.Physics.Matter.Events.CollisionEndEvent,
      bodyA: MatterJS.BodyType,
      bodyB: MatterJS.BodyType
    ) => {
      this.handleMerging(bodyA, bodyB);
    });
  }

  private handleMerging(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType) {
    const objA = bodyA.gameObject, objB = bodyB.gameObject;
    const mergeableA = objA?.getData("mergeable");
    const mergeableB = objB?.getData("mergeable");

    if(!mergeableA || !mergeableB) return;

    const tierA = objA?.getData("tier") as TIER;
    const tierB = objB?.getData("tier") as TIER;

    if(tierA !== tierB) return;

    // Merge same tiers to next tier
    // A is usually the static one
    // B is usually the moving one

    // Merge B into A
    // Replace A, remove B
    const nextTier = this.getNextTierBall(tierA);

    // Get B coordinates and create new ball with upgraded tier to take its place
    const { x, y } = bodyB.position;

    const ball = this.add.circle(x, y, nextTier.radius, nextTier.color);
    ball.setStrokeStyle(1, PINK_100);

    objA?.destroy();

    this.matter.add.gameObject(ball, {
      shape: { type: "circle", radius: nextTier.radius },
      restitution: 0.2,
    }).setData({ mergeable: true, tier: nextTier.tier });

    objB?.destroy();

    this.updateScore(tierA);
  }

  private updateScore(tier: TIER) {
    const index = this.tiers.indexOf(tier);
    const fib = this.fibseq[index];

    this.score += (index * 2 + fib);
    this.scoreText.setText(this.score.toString());
  }

  private renderBallContainer({ width, height, x, y, thickness}: {
    width: number; height: number;
    x: number; y: number;
    thickness: number;
  }) {
    // Container with open top
    const graphics = this.ballContainer;
    graphics.lineStyle(thickness, PINK_100);

    // Bottom wall
    this.matter.add.rectangle(x, y - (thickness / 2) + height / 2, width, thickness, { isStatic: true });
    graphics.moveTo(x - width / 2, y - (thickness / 2) + height / 2);
    graphics.lineTo(x + width / 2, y - (thickness / 2) + height / 2);

    // Left wall
    this.matter.add.rectangle(x - width / 2, y, thickness, height, { isStatic: true });
    graphics.moveTo(x - width / 2, y - height / 2);
    graphics.lineTo(x - width / 2, y + height / 2);

    // Right wall
    this.matter.add.rectangle(x + width / 2, y, thickness, height, { isStatic: true });
    graphics.moveTo(x + width / 2, y - height / 2);
    graphics.lineTo(x + width / 2, y + height / 2);

    graphics.strokePath();

    // Dotted line on top, boundary to spawn balls
    const DOTTED_THICKNESS = 4;
    graphics.lineStyle(DOTTED_THICKNESS, PINK_100);

    const startX = x - width / 2, endX = x + width / 2;
    const dottedY = y + (DOTTED_THICKNESS / 2) - height / 2;

    const stepAmount = 10, stepSize = 25;
    for(let x = startX; x < endX; x += stepAmount + stepSize) {
      graphics.lineBetween(x, dottedY, x + stepSize, dottedY);
    }
    graphics.strokePath();
  }

  private getNextTierBall(tier: TIER) {
    const index = this.tiers.indexOf(tier);
    const maxIndex = this.tiers.length - 1;
    let next = index + 1;

    if(next > maxIndex) next = 0;

    const nextRadius = this.radii[next];
    const nextColor = this.colors[next];
    const nextTier = this.tiers[next];

    return { radius: nextRadius, color: nextColor, tier: nextTier };
  }

  private generateRandomBall() {
    // TODO: update logic to be able to spawn unlocked balls ocassionally
    const index = Phaser.Math.Between(0, 3);
    const radius = this.radii[index];
    const color = this.colors[index];
    const tier = this.tiers[index];

    return { radius, color, tier };
  }

  private generateCurrentBall() {
    const { radius, color, tier } = this.generateRandomBall();

    this.currentBall = { radius, color, tier };
  }

  private previewCurrentBall({ pointer }: {
    pointer: Phaser.Input.Pointer;
  }) {
    const current = this.nextBallUI;
    current.clear();

    current.fillStyle(this.currentBall.color);
    current.fillCircle(pointer.x, pointer.y, this.currentBall.radius);
    current.lineStyle(1, PINK_100);
    current.strokeCircle(pointer.x, pointer.y, this.currentBall.radius);
  }

  private generateNextBall() {
    const { radius, color, tier } = this.generateRandomBall();

    this.previewNextBall({ ballRadius: radius, ballColor: color });
    this.nextBall = { radius, color, tier };
  }

  private previewNextBall({ ballRadius, ballColor }: {
    ballRadius: number; ballColor: number;
  }) {
    const previewBall = this.previewBall;
    previewBall.clear();

    previewBall.fillStyle(ballColor);
    previewBall.fillCircle(WIDTH - 125, 150, ballRadius);
    previewBall.lineStyle(1, PINK_100);
    previewBall.strokeCircle(WIDTH - 125, 150, ballRadius);
  }

  private previewStoredBall({ ballRadius, ballColor }: {
    ballRadius: number; ballColor: number;
  }) {
    const storedBall = this.storedBallUI;
    storedBall.clear();

    storedBall.fillStyle(ballColor);
    storedBall.fillCircle(WIDTH - 125, 375, ballRadius);
    storedBall.lineStyle(1, PINK_100);
    storedBall.strokeCircle(WIDTH - 125, 375, ballRadius);
  }
}
