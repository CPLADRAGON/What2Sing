import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

function readDir(dir: string): string {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

describe('physical deck swipe effects', () => {
  it('lifts the active card and animates the waiting deck while dragging', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('dragLift');
    expect(source).toContain('deckLift');
    expect(source).toContain('motion.div');
    expect(source).toContain('isDragging ?');
  });

  it('shows decision feedback after a pick or skip', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('feedbackMessage');
    expect(source).toContain("t('pickedFeedback')");
    expect(source).toContain("t('skippedFeedback')");
  });

  it('locks each exit animation to the current swipe direction before advancing', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('flushSync');
    expect(source).toContain('const exitDirection = decision ===');
    expect(source).toContain('setSwipeDirection(exitDirection)');
    expect(source).toContain('swipeDirection * 620');
  });

  it('flings the outgoing card before advancing to the next song', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('flingRef.current = animate(x, exitDirection * 620');
    expect(source).toContain('const swipeExitDurationMs');
    expect(source).toContain('stopFlingAndReset()');
    expect(source).toContain('flingRef.current.stop()');
    expect(source).toContain('setState((current) => (current ? chooseCurrentSong(current, decision) : current));');
    expect(source).toContain('currentSong && !complete ?');
    expect(source).not.toContain('currentSong && !complete && !isSwipeLocked');
    expect(source).not.toContain('useLayoutEffect');
  });

  it('offers order controls after resuming saved picking progress', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('reorderRemainingSongs');
    expect(source).toContain('changeRemainingOrder');
    expect(source).toContain("t('resumeOrderTitle')");
    expect(source).toContain("t('shuffleCards')");
    expect(source).toContain("t('defaultOrder')");
  });

  it('animates repeated shuffles and resets the visible card motion when order changes', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('shuffleAnimationKey');
    expect(source).toContain('isShufflingDeck');
    expect(source).toContain('currentSongKey');
    expect(source).toContain('setSwipeDirection(0)');
    expect(source).toContain('setIsDragging(false)');
  });

  it('adds richer drag feedback cues beyond the basic stamps', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('likeScale');
    expect(source).toContain('skipScale');
    expect(source).toContain('directionCueOpacity');
  });

  it('washes the background with directional color during drag', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('bgWashSkip');
    expect(source).toContain('bgWashLike');
  });

  it('triggers haptic feedback at drag thresholds', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain('lastHapticThreshold');
    expect(source).toContain('handleDrag');
    expect(source).toContain('onDrag={handleDrag}');
  });

  it('staggers card content reveal and wobbles the incoming card', () => {
    const source = readDir('src\\components\\picker');

    expect(source).toContain("transition={{delay: 0.06");
    expect(source).toContain("transition={{delay: 0.1");
    expect(source).toContain("transition={{delay: 0.16");
    expect(source).toContain("transition={{delay: 0.22");
    expect(source).toContain('isDealing');
    expect(source).toContain('rotate: -2');
  });

  it('defines localized feedback copy', () => {
    const en = readFileSync('messages/en.json', 'utf8');
    const zh = readFileSync('messages/zh.json', 'utf8');

    expect(en).toContain('pickedFeedback');
    expect(en).toContain('skippedFeedback');
    expect(en).toContain('resumeOrderTitle');
    expect(en).toContain('shuffleCards');
    expect(en).toContain('shuffleAgain');
    expect(en).toContain('defaultOrder');
    expect(zh).toContain('pickedFeedback');
    expect(zh).toContain('skippedFeedback');
    expect(zh).toContain('resumeOrderTitle');
    expect(zh).toContain('shuffleCards');
    expect(zh).toContain('shuffleAgain');
    expect(zh).toContain('defaultOrder');
  });
});
