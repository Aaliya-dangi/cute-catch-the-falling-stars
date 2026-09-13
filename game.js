const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const muteBtn = document.getElementById('mute-btn');
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const finalScoreEl = document.getElementById('final-score');
const finalLevelEl = document.getElementById('final-level');
const highScoreEl = document.getElementById('high-score');
const bestStartEl = document.getElementById('best-start');
const newBestEl = document.getElementById('new-best');
const heartSpans = Array.from(document.querySelectorAll('.heart'));

let canvasWidth = 800;
let canvasHeight = 600;

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvasWidth = container.clientWidth;
    canvasHeight = container.clientHeight;

    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

const STAR_COLORS = [
    ['#ffb3d9', 'rgba(255,179,217,'], ['#ff8fc8', 'rgba(255,143,200,'],
    ['#dda0ff', 'rgba(221,160,255,'], ['#c8a6ff', 'rgba(200,166,255,'],
    ['#ffd1e8', 'rgba(255,209,232,'], ['#ffb0e8', 'rgba(255,176,232,']
];
const STAR_HEARTS = ['💗', '💖', '💕', '💫', '✨', '💞'];
const GOLD = ['#ffd700', 'rgba(255,215,0,'];
const BAD = ['#5a2d76', 'rgba(90,45,118,'];

const PASTEL_CONFETTI = ['#ff9ade', '#c86bff', '#ff6fb5', '#ffd700', '#8ae9ff', '#b3f0c8', '#ffffff'];

const backgroundStars = [];
const fallingItems = [];
const particles = [];
const confetti = [];
const floatingTexts = [];

const MAX_LIVES = 3;

let basket = null;
let keyboard = { left: false, right: false };
let gameState = 'start';
let score = 0;
let level = 1;
let lives = MAX_LIVES;
let livesLostThisFrame = false;
let highScore = parseInt(localStorage.getItem('catchTheStarsHighScore')) || 0;
let spawnTimer = 0;
let lastTime = 0;
let elapsed = 0;
let animFramePlay = null;
let animFrameBg = null;
let shakeMag = 0;
let flashBase = 'rgba(255,80,140,';
let flashAlpha = 0;
let banner = null;

let muted = localStorage.getItem('catchTheStarsMuted') === '1';

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new AudioCtx();
        } catch (e) {
            return;
        }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(type, freq, dur, when = 0, vol = 0.2) {
    if (muted || !audioCtx) return;
    try {
        const t0 = audioCtx.currentTime + when;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    } catch (e) {
        // ignore audio errors
    }
}

function playCatch() {
    playTone('triangle', 740, 0.12);
    playTone('triangle', 988, 0.12, 0.07);
}

function playGolden() {
    [523, 659, 784, 1047].forEach((f, i) => playTone('triangle', f, 0.16, i * 0.06));
}

function playBad() {
    playTone('sawtooth', 220, 0.2, 0, 0.16);
    playTone('sawtooth', 130, 0.28, 0.1, 0.13);
}

function playLoseHeart() {
    playTone('triangle', 330, 0.2);
    playTone('triangle', 247, 0.28, 0.12, 0.18);
}

function playLevelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => playTone('triangle', f, 0.2, i * 0.09, 0.18));
}

function playGameOver() {
    [523, 494, 440, 392, 330, 262].forEach((f, i) => playTone('triangle', f, 0.28, i * 0.13, 0.16));
}

function playClick() {
    playTone('sine', 600, 0.07, 0, 0.1);
}

highScoreEl.textContent = highScore;
bestStartEl.textContent = highScore;

updateMuteIcon();

function initBackground() {
    backgroundStars.length = 0;
    const count = Math.floor((canvasWidth * canvasHeight) / 3500);
    const dotColors = ['#ffffff', '#ffd9f2', '#f3d6ff', '#fff0fa'];
    for (let i = 0; i < count; i++) {
        backgroundStars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            size: Math.random() * 2.2 + 0.5,
            speed: Math.random() * 0.25 + 0.05,
            phase: Math.random() * Math.PI * 2,
            alpha: Math.random() * 0.5 + 0.3,
            color: dotColors[Math.floor(Math.random() * dotColors.length)]
        });
    }
}

function isMobileLayout() {
    return window.matchMedia('(max-width: 620px), (hover: none) and (pointer: coarse)').matches;
}

function getDangerLineY() {
    return canvasHeight - (isMobileLayout() ? 46 : 52);
}

function createBasket() {
    const width = Math.min(120, canvasWidth * 0.16);
    const height = width * 0.6;
    basket = {
        width: width,
        height: height,
        x: (canvasWidth - width) / 2,
        y: getDangerLineY() - height - 26,
        speed: Math.max(6, canvasWidth * 0.011),
        tilt: 0
    };
}

function getSpawnInterval() {
    return Math.max(0.35, 1.3 - (level - 1) * 0.09);
}

function getSpeedMultiplier() {
    return 1 + (level - 1) * 0.13;
}

function getBadChance() {
    return Math.min(0.22, 0.04 + (level - 1) * 0.02);
}

function getGoldenChance() {
    return Math.min(0.1, 0.05 + (level - 1) * 0.006);
}

function getLevelFromScore() {
    return Math.min(15, Math.floor(score / 10) + 1);
}

function spawnItem() {
    const type = pickItemType();
    const size = type === 'bad'
        ? Math.random() * 10 + 22
        : type === 'golden'
            ? Math.random() * 8 + 26
            : Math.random() * 14 + 16;

    const speedMultiplier = getSpeedMultiplier();
    let color, glow;
    let glyph = '';
    if (type === 'golden') {
        color = GOLD[0];
        glow = GOLD[1];
        glyph = '👑';
    } else if (type === 'bad') {
        color = BAD[0];
        glow = BAD[1];
        glyph = '😾';
    } else {
        const idx = Math.floor(Math.random() * STAR_COLORS.length);
        color = STAR_COLORS[idx][0];
        glow = STAR_COLORS[idx][1];
        glyph = STAR_HEARTS[idx];
    }

    fallingItems.push({
        x: Math.random() * (canvasWidth - size * 2) + size,
        baseX: 0,
        y: -size,
        size: size,
        speed: (Math.random() * 1.6 + 1.6) * speedMultiplier,
        color: color,
        glow: glow,
        glyph: glyph,
        type: type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        sway: Math.random() * 40 - 20,
        swaySpeed: Math.random() * 0.02 + 0.01
    });
    fallingItems[fallingItems.length - 1].baseX = fallingItems[fallingItems.length - 1].x;
}

function pickItemType() {
    const roll = Math.random();
    if (roll < getBadChance()) return 'bad';
    if (roll < getBadChance() + getGoldenChance()) return 'golden';
    return 'star';
}

function scoreFor(type) {
    if (type === 'golden') return 3;
    if (type === 'bad') return 0;
    return 1;
}

function checkCollision(item) {
    const basketLeft = basket.x + basket.width * 0.15;
    const basketRight = basket.x + basket.width * 0.85;
    const basketTop = basket.y + basket.height * 0.2;
    const itemBottom = item.y + item.size / 2;

    return (
        item.x > basketLeft &&
        item.x < basketRight &&
        itemBottom > basketTop &&
        item.y - item.size / 2 < basket.y + basket.height
    );
}

function addParticleBurst(x, y, color, count, speed = 6) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * speed + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v - 2,
            size: Math.random() * 4 + 2,
            color: color,
            life: 1,
            decay: Math.random() * 0.02 + 0.015
        });
    }
}

function addFloatingText(x, y, text, color = '#ff6fb5', size = 24, life = 1) {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        size: size,
        life: life,
        vy: -1.6
    });
}

function confettiBurst(x, y, count = 45) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * 8 + 2;
        confetti.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v - 3,
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 8 + 4,
            color: PASTEL_CONFETTI[Math.floor(Math.random() * PASTEL_CONFETTI.length)],
            life: 1,
            decay: Math.random() * 0.012 + 0.008
        });
    }
}

function handleCatch(item) {
    const cx = item.x;
    const cy = item.y;

    if (item.type === 'bad') {
        loseLife('bad', cx, cy);
        return;
    }

    score += scoreFor(item.type);

    if (item.type === 'golden') {
        addParticleBurst(cx, cy, '#ffd700', 30, 8);
        addParticleBurst(cx, cy, '#fff8dc', 20, 7);
        addFloatingText(cx, cy - 22, '+3 🎉', '#ffd700', 30);
        playGolden();
        drawSparkleRing(cx, cy, '#ffd700');
    } else {
        addParticleBurst(cx, cy, item.color, 18);
        addFloatingText(cx, cy - 20, '+1', item.color, 22);
        playCatch();
    }

    const newLevel = getLevelFromScore();
    if (newLevel !== level) {
        level = newLevel;
        onLevelUp();
    }

    scoreEl.textContent = score;
    levelEl.textContent = level;
}

function drawSparkleRing(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        particles.push({
            x: x + Math.cos(angle) * 10,
            y: y + Math.sin(angle) * 10,
            vx: Math.cos(angle) * 6,
            vy: Math.sin(angle) * 6,
            size: 2.5,
            color: color,
            life: 0.9,
            decay: 0.03
        });
    }
}

function loseLife(kind, x, y) {
    if (lives <= 0 || livesLostThisFrame) return;
    livesLostThisFrame = true;
    lives--;
    updateLivesUI();

    if (kind === 'bad') {
        addParticleBurst(x, y, '#5a2d76', 26, 7);
        addFloatingText(x, y - 24, '💢', '#a45ad8', 28);
        playBad();
        setShake(14);
        flash('rgba(124,45,168,', 0.4);
    } else {
        const lineY = getDangerLineY();
        addParticleBurst(canvasWidth / 2, lineY - 34, '#ff6fb5', 24, 6);
        addFloatingText(canvasWidth / 2, lineY - 58, '💔', '#ff6fb5', 30);
        playLoseHeart();
        setShake(9);
        flash('rgba(255,80,140,', 0.35);
    }

    if (lives <= 0) {
        addFloatingText(canvasWidth / 2, canvasHeight / 2 - 60, '💔', '#ff6fb5', 40);
        endGame();
    }
}

function updateLivesUI() {
    heartSpans.forEach((h, i) => h.classList.toggle('lost', i >= lives));
}

function onLevelUp() {
    playLevelUp();
    confettiBurst(canvasWidth / 2, canvasHeight * 0.38);
    confettiBurst(basket.x + basket.width / 2, basket.y, 30);
    banner = { text: `✨ Level ${level}! ✨`, t: 0, dur: 2300 };
}

function setShake(m) {
    shakeMag = Math.max(shakeMag, m);
}

function flash(base, alpha) {
    flashBase = base;
    flashAlpha = Math.max(flashAlpha, alpha);
}

function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    sky.addColorStop(0, '#ffd9ef');
    sky.addColorStop(0.45, '#eab8ff');
    sky.addColorStop(1, '#c9a6ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawBackground() {
    for (const star of backgroundStars) {
        const twinkle = Math.sin(elapsed * 0.002 + star.phase) * 0.4 + 0.6;
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed;
        if (star.y > canvasHeight) {
            star.y = -2;
            star.x = Math.random() * canvasWidth;
        }
    }
    ctx.globalAlpha = 1;
}

function drawDangerLine() {
    const y = getDangerLineY();
    if (y < 60 || y > canvasHeight - 8) return;

    ctx.save();

    const band = ctx.createLinearGradient(0, y, 0, canvasHeight);
    band.addColorStop(0, 'rgba(255,111,181,0.35)');
    band.addColorStop(1, 'rgba(255,111,181,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y, canvasWidth, canvasHeight - y);

    const spikes = Math.max(6, Math.floor(canvasWidth / 34));
    const step = canvasWidth / spikes;
    ctx.fillStyle = 'rgba(255,111,181,0.85)';
    for (let i = 0; i <= spikes; i++) {
        const sx = step * i;
        ctx.beginPath();
        ctx.moveTo(sx - step * 0.28, y);
        ctx.lineTo(sx, y + 13);
        ctx.lineTo(sx + step * 0.28, y);
        ctx.closePath();
        ctx.fill();
    }

    ctx.setLineDash([20, 14]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff6fb5';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255,111,181,0.95)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(canvasWidth - 14, y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(canvasWidth - 14, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const markers = [
        { x: canvasWidth * 0.16, c: '💗' },
        { x: canvasWidth * 0.36, c: '✨' },
        { x: canvasWidth * 0.64, c: '✨' },
        { x: canvasWidth * 0.84, c: '💗' }
    ];
    ctx.font = '15px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const m of markers) {
        ctx.fillText(m.c, m.x, y - 4);
    }

    ctx.font = "600 13px 'Fredoka', sans-serif";
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#d95b9e';
    ctx.fillText('✨ Catch before this line ✨', canvasWidth / 2, Math.min(canvasHeight - 10, y + 30));

    ctx.restore();
}

function drawBasket() {
    const bx = basket.x;
    const by = basket.y;
    const bw = basket.width;
    const bh = basket.height;
    const tilt = basket.tilt;

    ctx.save();
    ctx.translate(bx + bw / 2, by + bh);
    ctx.rotate(tilt);
    ctx.translate(-(bx + bw / 2), -(by + bh));

    ctx.shadowColor = 'rgba(255,111,181,0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;

    const gradient = ctx.createLinearGradient(bx, by, bx, by + bh);
    gradient.addColorStop(0, '#ff9ad5');
    gradient.addColorStop(1, '#e668a8');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.08, by + bh * 0.25);
    ctx.lineTo(bx + bw * 0.18, by + bh * 0.85);
    ctx.quadraticCurveTo(bx + bw * 0.35, by + bh * 1.02, bx + bw * 0.65, by + bh * 1.02);
    ctx.quadraticCurveTo(bx + bw * 0.82, by + bh * 1.02, bx + bw * 0.82, by + bh * 0.85);
    ctx.lineTo(bx + bw * 0.92, by + bh * 0.25);
    ctx.quadraticCurveTo(bx + bw * 0.5, by - bh * 0.05, bx + bw * 0.08, by + bh * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#ffc4e8';
    ctx.fillRect(bx + bw * 0.12, by + bh * 0.1, bw * 0.76, bh * 0.14);

    ctx.strokeStyle = '#ffb1df';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.92, by + bh * 0.3);
    ctx.quadraticCurveTo(bx + bw * 0.5, by - bh * 0.05, bx + bw * 0.08, by + bh * 0.3);
    ctx.stroke();

    ctx.font = `${bh * 0.4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💗', bx + bw * 0.5, by + bh * 0.72);

    ctx.restore();
}

function drawStarShape(x, y, r, fill, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = glow + '0.9)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.42;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawItem(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.type === 'bad') {
        ctx.shadowColor = 'rgba(90,45,118,0.8)';
        ctx.shadowBlur = 14;

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, item.size / 2);
        grad.addColorStop(0, '#7b3d9e');
        grad.addColorStop(1, '#3c1f52');
        ctx.fillStyle = grad;

        ctx.beginPath();
        const spikes = 10;
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? item.size / 2 : item.size * 0.26;
            const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.9;
        ctx.font = `${item.size * 0.55}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('😾', 0, 0);
        ctx.globalAlpha = 1;
    } else {
        drawStarShape(0, 0, item.size / 2, item.color, item.glow);

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, item.size * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.95;

        ctx.font = `${item.size * 0.5}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.glyph, 0, 0);
    }

    ctx.restore();
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawConfetti() {
    for (const c of confetti) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.globalAlpha = c.life;
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
    for (const t of floatingTexts) {
        ctx.globalAlpha = t.life;
        ctx.font = `700 ${t.size}px 'Fredoka', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = t.color;
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawBanner() {
    if (!banner) return;
    const t = banner.t / banner.dur;
    if (t >= 1) {
        banner = null;
        return;
    }
    const inA = Math.min(1, t / 0.12);
    const outA = Math.min(1, (1 - t) / 0.2);
    const scale = 0.7 + 0.3 * Math.min(1, t / 0.2);
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight * 0.32);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(inA, outA);
    ctx.font = "700 46px 'Fredoka', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(-120, 0, 120, 0);
    grad.addColorStop(0, '#ff6fb5');
    grad.addColorStop(1, '#c86bff');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = 18;
    ctx.fillText(banner.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function update(deltaTime) {
    const dt = deltaTime / 1000;
    livesLostThisFrame = false;

    if (keyboard.left && basket.x > 5) {
        basket.x -= basket.speed * dt * 60;
        basket.tilt = Math.max(basket.tilt - 0.08, -0.15);
    }
    if (keyboard.right && basket.x < canvasWidth - basket.width - 5) {
        basket.x += basket.speed * dt * 60;
        basket.tilt = Math.min(basket.tilt + 0.08, 0.15);
    }
    if (!keyboard.left && !keyboard.right) {
        basket.tilt *= 0.85;
    }
    basket.x = Math.max(5, Math.min(canvasWidth - basket.width - 5, basket.x));

    spawnTimer -= dt;
    while (spawnTimer <= 0) {
        spawnItem();
        spawnTimer += getSpawnInterval();
    }

    const dangerY = getDangerLineY();

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        const item = fallingItems[i];
        item.y += item.speed * dt * 60 * 0.6;
        item.x = item.baseX + Math.sin(elapsed * 0.001 * item.swaySpeed * 100) * item.sway;
        item.rotation += item.rotationSpeed;

        if (checkCollision(item)) {
            handleCatch(item);
            fallingItems.splice(i, 1);
            continue;
        }

        if (item.y + item.size / 2 >= dangerY) {
            if (item.type === 'star') {
                loseLife('star', item.x, item.y);
            }
            fallingItems.splice(i, 1);
            continue;
        }

        if (item.y > canvasHeight + item.size) {
            if (item.type === 'star') {
                loseLife('star', item.x, item.y);
            }
            fallingItems.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.25;
        c.rotation += c.vr;
        c.life -= c.decay;
        if (c.life <= 0) confetti.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y += t.vy;
        t.life -= 0.02;
        if (t.life <= 0.2) floatingTexts.splice(i, 1);
    }

    if (banner) banner.t += deltaTime;
    flashAlpha = Math.max(0, flashAlpha - deltaTime * 0.002);
    shakeMag *= 0.88;
    if (shakeMag < 0.5) shakeMag = 0;
}

function gameLoop(timestamp) {
    if (gameState !== 'playing') return;

    if (lastTime === 0) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    elapsed += deltaTime;

    ctx.save();
    if (shakeMag > 0.5) {
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawSky();
    drawBackground();
    drawDangerLine();
    for (const item of fallingItems) drawItem(item);
    drawParticles();
    drawConfetti();
    drawFloatingTexts();
    drawBasket();
    drawBanner();

    ctx.restore();

    if (flashAlpha > 0) {
        ctx.fillStyle = flashBase + Math.min(flashAlpha, 0.5) + ')';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    update(deltaTime);

    animFramePlay = requestAnimationFrame(gameLoop);
}

function drawAmbient() {
    drawSky();
    drawBackground();
    drawDangerLine();
    for (const item of fallingItems) drawItem(item);
    drawParticles();
    drawConfetti();
}

function backgroundLoop(timestamp) {
    if (gameState === 'playing') return;

    if (lastTime === 0) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    elapsed += deltaTime;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawAmbient();

    animFrameBg = requestAnimationFrame(backgroundLoop);
}

function startGame() {
    ensureAudio();

    fallingItems.length = 0;
    particles.length = 0;
    confetti.length = 0;
    floatingTexts.length = 0;
    score = 0;
    level = 1;
    lives = MAX_LIVES;
    spawnTimer = 0.5;
    lastTime = 0;
    shakeMag = 0;
    flashAlpha = 0;
    banner = null;

    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    updateLivesUI();

    createBasket();
    initBackground();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    if (animFrameBg) cancelAnimationFrame(animFrameBg);
    gameState = 'playing';
    animFramePlay = requestAnimationFrame(gameLoop);
}

function endGame() {
    if (gameState !== 'playing') return;
    gameState = 'over';
    if (animFramePlay) cancelAnimationFrame(animFramePlay);
    lastTime = 0;

    const isNewBest = score > highScore;
    if (isNewBest) {
        highScore = score;
        localStorage.setItem('catchTheStarsHighScore', String(highScore));
    }

    finalScoreEl.textContent = score;
    finalLevelEl.textContent = level;
    highScoreEl.textContent = highScore;
    bestStartEl.textContent = highScore;
    newBestEl.classList.toggle('hidden', !isNewBest);

    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    playGameOver();

    animFrameBg = requestAnimationFrame(backgroundLoop);
}

startBtn.addEventListener('click', () => {
    playClick();
    startGame();
});

restartBtn.addEventListener('click', () => {
    playClick();
    startGame();
});

muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    localStorage.setItem('catchTheStarsMuted', muted ? '1' : '0');
    updateMuteIcon();
    if (!muted) {
        ensureAudio();
        playClick();
    }
});

function updateMuteIcon() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
        keyboard.left = true;
        e.preventDefault();
    }
    if (e.key === 'ArrowRight' || e.key === 'Right') {
        keyboard.right = true;
        e.preventDefault();
    }
    if (e.key === 'Enter' && gameState === 'start') startGame();
    if ((e.key === 'Enter' || e.key === ' ') && gameState === 'over') startGame();
    if (e.key === 'm' || e.key === 'M') {
        muted = !muted;
        localStorage.setItem('catchTheStarsMuted', muted ? '1' : '0');
        updateMuteIcon();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'Left') keyboard.left = false;
    if (e.key === 'ArrowRight' || e.key === 'Right') keyboard.right = false;
});

let touchX = null;

canvas.parentElement.addEventListener('touchstart', (e) => {
    if (e.target.closest && e.target.closest('#mute-btn, .control-btn')) return;
    const touch = e.touches[0];
    touchX = touch.clientX;
    e.preventDefault();
}, { passive: false });

canvas.parentElement.addEventListener('touchmove', (e) => {
    if (e.target.closest && e.target.closest('#mute-btn, .control-btn')) return;
    const touch = e.touches[0];
    if (touchX === null) {
        touchX = touch.clientX;
        return;
    }
    const dx = touch.clientX - touchX;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    if (basket) {
        basket.x += dx * scaleX * 1.2;
        basket.x = Math.max(5, Math.min(canvasWidth - basket.width - 5, basket.x));
    }
    touchX = touch.clientX;
    e.preventDefault();
}, { passive: false });

canvas.parentElement.addEventListener('touchend', (e) => {
    touchX = null;
}, { passive: false });

function handleLayoutChange() {
    resizeCanvas();
    initBackground();
    if (basket) {
        basket.width = Math.min(120, canvasWidth * 0.16);
        basket.height = basket.width * 0.6;
        basket.y = getDangerLineY() - basket.height - 26;
        basket.speed = Math.max(6, canvasWidth * 0.011);
        basket.x = Math.max(5, Math.min(canvasWidth - basket.width - 5, basket.x));
    }
}

window.addEventListener('resize', handleLayoutChange);
window.addEventListener('orientationchange', handleLayoutChange);

if ('ResizeObserver' in window) {
    new ResizeObserver(handleLayoutChange).observe(document.getElementById('game-container'));
}

resizeCanvas();
initBackground();
animFrameBg = requestAnimationFrame(backgroundLoop);
// ================================
// MOBILE LEFT / RIGHT BUTTONS
// ================================

function startMobileMove(direction) {

    if (direction === 'left') {
        keyboard.left = true;
    }

    if (direction === 'right') {
        keyboard.right = true;
    }

}


function stopMobileMove(direction) {

    if (direction === 'left') {
        keyboard.left = false;
    }

    if (direction === 'right') {
        keyboard.right = false;
    }

}


// LEFT BUTTON

leftBtn.addEventListener(
    'touchstart',
    function (e) {

        e.preventDefault();

        startMobileMove('left');

    },
    { passive: false }
);


leftBtn.addEventListener(
    'touchend',
    function (e) {

        e.preventDefault();

        stopMobileMove('left');

    },
    { passive: false }
);


leftBtn.addEventListener(
    'touchcancel',
    function (e) {

        e.preventDefault();

        stopMobileMove('left');

    },
    { passive: false }
);


// RIGHT BUTTON

rightBtn.addEventListener(
    'touchstart',
    function (e) {

        e.preventDefault();

        startMobileMove('right');

    },
    { passive: false }
);


rightBtn.addEventListener(
    'touchend',
    function (e) {

        e.preventDefault();

        stopMobileMove('right');

    },
    { passive: false }
);


rightBtn.addEventListener(
    'touchcancel',
    function (e) {

        e.preventDefault();

        stopMobileMove('right');

    },
    { passive: false }
);
const startButton = document.getElementById('start-btn');

if (startButton) {
    startButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        startGame();
    }, { passive: false });
}