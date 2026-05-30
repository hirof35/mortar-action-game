enum GameState {
    PlayerTurn,
    ProjectileFly,
    EnemyTurn,
    GameOver
}

class Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number = 6;
    gravity: number = 0.2;
    isEnemy: boolean;

    constructor(x: number, y: number, angle: number, power: number, isEnemy: boolean = false) {
        this.x = x;
        this.y = y;
        const rad = (angle * Math.PI) / 180;
        this.vx = Math.cos(rad) * power * (isEnemy ? -1 : 1);
        this.vy = -Math.sin(rad) * power;
        this.isEnemy = isEnemy;
    }

    update(wind: number): void {
        this.vx += wind;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isEnemy ? '#ff3333' : '#ff9900';
        ctx.fill();
        ctx.closePath();
    }
}

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private terrainCanvas: HTMLCanvasElement;
    private terrainCtx: CanvasRenderingContext2D;
    
    private projectiles: Projectile[] = [];
    private currentState: GameState = GameState.PlayerTurn;
    
    private playerX: number = 100;
    private playerY: number = 0;
    private playerAngle: number = 45;
    private playerPower: number = 10;
    private playerHp: number = 100;
    
    private enemyX: number = 700;
    private enemyY: number = 0;
    private enemyAngle: number = 45;
    private enemyPower: number = 10;
    private enemyHp: number = 100;
    
    private score: number = 0;
    private wind: number = 0;
    private statusMessage: string = "【矢印キー】で調整 / 【スペースキー】で発射！";
    
    private loop: () => void;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = this.canvas.width;
        this.terrainCanvas.height = this.canvas.height;
        
        // ★ブラウザの警告を消し、超高速化する設定
        this.terrainCtx = this.terrainCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        
        this.loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(this.loop);
        };

        this.generateTerrain();
        this.snapToGround();
        this.changeWind();
        this.setupControls();
        this.loop();
    }

    private generateTerrain(): void {
        this.terrainCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.terrainCtx.fillStyle = '#2ecc71';
        this.terrainCtx.beginPath();
        this.terrainCtx.moveTo(0, this.canvas.height);
        for (let x = 0; x <= this.canvas.width; x++) {
            const groundY = 460 + Math.sin(x * 0.008) * 50 + Math.cos(x * 0.02) * 15;
            this.terrainCtx.lineTo(x, groundY);
        }
        this.terrainCtx.lineTo(this.canvas.width, this.canvas.height);
        this.terrainCtx.closePath();
        this.terrainCtx.fill();
    }

    private snapToGround(): void {
        this.playerY = this.getHighestGroundY(this.playerX);
        this.enemyY = this.getHighestGroundY(this.enemyX);
    }

    private getHighestGroundY(x: number): number {
        const intX = Math.floor(x);
        if (intX < 0 || intX >= this.canvas.width) return this.canvas.height;
        const imgData = this.terrainCtx.getImageData(intX, 0, 1, this.canvas.height).data;
        for (let y = 0; y < this.canvas.height; y++) {
            if (imgData[y * 4 + 3] > 0) return y;
        }
        return this.canvas.height;
    }

    private isHitTerrain(x: number, y: number): boolean {
        const intX = ~~x;
        const intY = ~~y;
        if (intX < 0 || intX >= this.canvas.width || intY < 0 || intY >= this.canvas.height) {
            return false;
        }
        const imgData = this.terrainCtx.getImageData(intX, intY, 1, 1);
        return imgData.data[3] > 0;
    }

    private destroyTerrain(centerX: number, centerY: number, radius: number): void {
        this.terrainCtx.save();
        this.terrainCtx.globalCompositeOperation = 'destination-out';
        this.terrainCtx.beginPath();
        this.terrainCtx.arc(~~centerX, ~~centerY, radius, 0, Math.PI * 2);
        this.terrainCtx.fill();
        this.terrainCtx.restore();
        this.snapToGround();
    }

    private changeWind(): void {
        this.wind = (Math.random() * 2 - 1) * 0.06;
    }

    private setupControls(): void {
        window.onkeydown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (this.currentState !== GameState.PlayerTurn) return;

            switch (e.key) {
                case 'ArrowUp': this.playerAngle = Math.min(this.playerAngle + 2, 90); break;
                case 'ArrowDown': this.playerAngle = Math.max(this.playerAngle - 2, 0); break;
                case 'ArrowRight': this.playerPower = Math.min(this.playerPower + 0.5, 20); break;
                case 'ArrowLeft': this.playerPower = Math.max(this.playerPower - 0.5, 1); break;
                case ' ': this.playerFire(); break;
            }
        };
    }

    private playerFire(): void {
        if (this.projectiles.length > 0) return;
        // 高さを上げて自爆を防止
        this.projectiles.push(new Projectile(this.playerX, this.playerY - 25, this.playerAngle, this.playerPower, false));
        this.currentState = GameState.ProjectileFly;
        this.statusMessage = "発射！！";
    }

    private enemyAIAction(): void {
        this.statusMessage = "敵が狙いを定めている...";
        setTimeout(() => {
            if (this.currentState !== GameState.EnemyTurn) return;

            const distance = this.enemyX - this.playerX;
            this.enemyAngle = 35 + Math.random() * 25;
            const rad = (this.enemyAngle * Math.PI) / 180;
            const gravity = 0.2;
            let estimatedPower = Math.sqrt((distance * gravity) / Math.sin(2 * rad));
            estimatedPower += this.wind * 40;
            this.enemyPower = estimatedPower * (0.85 + Math.random() * 0.3);
            this.enemyPower = Math.max(5, Math.min(this.enemyPower, 20));

            // 高さを上げて自爆を防止
            this.projectiles.push(new Projectile(this.enemyX, this.enemyY - 25, this.enemyAngle, this.enemyPower, true));
            this.currentState = GameState.ProjectileFly;
            this.statusMessage = "敵が撃ってきた！";
        }, 1200);
    }

    private checkCharCollision(p: Projectile, cx: number, cy: number): boolean {
        const dx = p.x - cx;
        const dy = p.y - (cy - 10);
        return Math.sqrt(dx * dx + dy * dy) < p.radius + 15;
    }

    private update(): void {
        if (this.currentState === GameState.ProjectileFly) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                p.update(this.wind);
                let hit = false;

                if (p.x < 0 || p.x > this.canvas.width || p.y < -1000) {
                    hit = true;
                    this.statusMessage = "空の彼方へ飛んでいった...";
                }
                else if (this.checkCharCollision(p, this.playerX, this.playerY)) {
                    this.playerHp = Math.max(0, this.playerHp - 35);
                    this.destroyTerrain(p.x, p.y, 40);
                    hit = true;
                    this.statusMessage = "プレイヤーが被弾！ -35 HP";
                }
                else if (this.checkCharCollision(p, this.enemyX, this.enemyY)) {
                    this.enemyHp = Math.max(0, this.enemyHp - 35);
                    this.destroyTerrain(p.x, p.y, 40);
                    hit = true;
                    this.score += 50;
                    this.statusMessage = "直撃！敵に35ダメージ！";
                }
                else if (this.isHitTerrain(p.x, p.y)) {
                    this.destroyTerrain(p.x, p.y, 30);
                    hit = true;
                    this.statusMessage = "地面に着弾！";
                }

                if (p.y > this.canvas.height) {
                    hit = true;
                    this.statusMessage = "奈落へ落ちていった...";
                }

                if (hit) {
                    this.projectiles.splice(i, 1);
                    if (this.playerHp <= 0 || this.enemyHp <= 0) {
                        this.currentState = GameState.GameOver;
                        this.statusMessage = this.playerHp <= 0 ? "ゲームオーバー！あなたの負けです。" : "勝利！敵を撃破しました！";
                        break;
                    }
                    this.changeWind();
                    if (!p.isEnemy) {
                        this.currentState = GameState.EnemyTurn;
                        this.enemyAIAction();
                    }
                    else {
                        this.currentState = GameState.PlayerTurn;
                        this.statusMessage = "あなたのターン：角度と威力を決めてSPACEで発射！";
                    }
                }
            }
        }
    }

    private draw(): void {
        this.ctx.fillStyle = this.currentState === GameState.EnemyTurn ? '#1a252f' : '#2bc0e4';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.terrainCanvas, 0, 0);

        // プレイヤーの描画
        this.ctx.save();
        this.ctx.translate(this.playerX, this.playerY);
        this.ctx.fillStyle = '#2980b9';
        this.ctx.beginPath(); this.ctx.arc(0, -5, 12, Math.PI, 0); this.ctx.fill();
        this.ctx.rotate((-this.playerAngle * Math.PI) / 180);
        this.ctx.fillRect(0, -7, 22, 5);
        this.ctx.restore();

        // 敵の描画
        this.ctx.save();
        this.ctx.translate(this.enemyX, this.enemyY);
        this.ctx.fillStyle = '#c0392b';
        this.ctx.beginPath(); this.ctx.arc(0, -5, 12, Math.PI, 0); this.ctx.fill();
        this.ctx.rotate((this.enemyAngle * Math.PI) / 180);
        this.ctx.fillRect(-22, -7, 22, 5);
        this.ctx.restore();

        // 砲弾の描画
        if (this.projectiles) {
            this.projectiles.forEach(p => p.draw(this.ctx));
        }

        this.drawUI();
    }

    private drawUI(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, 90);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`PLAYER HP: ${this.playerHp}`, 20, 25);
        this.ctx.fillText(`角度(↑↓): ${this.playerAngle}°`, 20, 50);
        this.ctx.fillText(`威力(←→): ${this.playerPower.toFixed(1)}`, 20, 75);
        this.ctx.fillText(`ENEMY HP: ${this.enemyHp}`, 650, 25);
        this.ctx.fillText(`敵の角度: ${this.enemyAngle.toFixed(0)}°`, 650, 50);
        this.ctx.fillText(`敵の威力: ${this.enemyPower.toFixed(1)}`, 650, 75);

        let windText = this.wind > 0.005 ? `追い風 ➔` : this.wind < -0.005 ? `⇦ 向かい風` : '無風 ◯';
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.fillText(`風況: ${windText} (${Math.abs(this.wind * 1000).toFixed(0)})`, 350, 25);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.statusMessage, this.canvas.width / 2, 60);
        this.ctx.textAlign = 'start';
    }
}

window.onload = () => { new Game('gameCanvas'); };