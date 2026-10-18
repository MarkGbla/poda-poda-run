/** Share artwork with player-specific text drawn at export time. */
const BACKGROUND_URL = '/score-assets/sunset-card-background.png';
let backgroundPromise;
function loadBackground() {
  if (!backgroundPromise) backgroundPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Scorecard artwork could not be loaded'));
    image.src = BACKGROUND_URL;
  }).catch(error => { backgroundPromise = null; throw error; });
  return backgroundPromise;
}

function fittedFont(ctx, text, preferredSize, maxWidth, family, minimumSize = 42) {
  let size = preferredSize;
  do {
    ctx.font = `italic 900 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > minimumSize);
  return size;
}

export async function createScorePoster({ name, score, rank = null }) {
  const background = await loadBackground();
  await document.fonts?.load('900 190px Impact').catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2508;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  ctx.scale(2, 2); // Artwork coordinates follow the supplied 1254 px square.

  const scoreText = Math.max(0, Math.round(Number(score) || 0)).toLocaleString('en-US');
  const displayName = String(name || 'Guest Driver').trim() || 'Guest Driver';
  ctx.save();
  ctx.font = 'italic 900 45px Impact, "Arial Black", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#090907';
  ctx.fillStyle = '#fff';
  ctx.strokeText('SCORE', 60, 479);
  ctx.fillText('SCORE', 60, 479);
  ctx.restore();
  ctx.save();
  ctx.transform(1, 0, -0.065, 1, 0, 0);
  fittedFont(ctx, scoreText, 205, 530, 'Impact, "Arial Black", sans-serif', 86);
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 15;
  ctx.strokeStyle = '#090907';
  ctx.shadowColor = '#000a';
  ctx.shadowBlur = 11;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 8;
  ctx.strokeText(scoreText, 66, 690, 535);
  ctx.shadowColor = 'transparent';
  const gold = ctx.createLinearGradient(0, 485, 0, 705);
  gold.addColorStop(0, '#fff946');
  gold.addColorStop(.57, '#ffe828');
  gold.addColorStop(1, '#ffd124');
  ctx.fillStyle = gold;
  ctx.fillText(scoreText, 66, 690, 535);
  ctx.restore();

  const nameSize = fittedFont(ctx, displayName, 61, 535, '"Arial Black", "Outfit", sans-serif', 34);
  ctx.font = `900 ${nameSize}px "Arial Black", "Outfit", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#100c0b';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#000b';
  ctx.shadowBlur = 8;
  ctx.strokeText(displayName, 58, 790, 540);
  ctx.fillText(displayName, 58, 790, 540);
  ctx.shadowColor = 'transparent';

  if (Number.isInteger(rank) && rank > 0) {
    const label = `#${rank} TODAY`;
    ctx.font = 'italic 900 40px Impact, "Arial Black", sans-serif';
    const badgeWidth = Math.min(500, Math.max(200, ctx.measureText(label).width + 45));
    const badgeX = 58;
    ctx.fillStyle = '#080907';
    ctx.beginPath();ctx.roundRect(badgeX - 4, 811, badgeWidth + 8, 67, 20);ctx.fill();
    ctx.fillStyle = '#ffe227';
    ctx.beginPath();ctx.roundRect(badgeX, 815, badgeWidth, 59, 16);ctx.fill();
    ctx.fillStyle = '#070707';
    ctx.fillText(label, badgeX + 20, 857, badgeWidth - 37);
  }

  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Scorecard export failed')), 'image/png'
  ));
}
