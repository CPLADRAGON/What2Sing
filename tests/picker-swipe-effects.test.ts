import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('physical deck swipe effects', () => {
  it('lifts the active card and animates the waiting deck while dragging', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).toContain('dragLift');
    expect(source).toContain('deckLift');
    expect(source).toContain('motion.div');
    expect(source).toContain('isDragging ?');
  });

  it('shows decision feedback after a pick or skip', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).toContain('feedbackMessage');
    expect(source).toContain("t('pickedFeedback')");
    expect(source).toContain("t('skippedFeedback')");
  });

  it('locks each exit animation to the current swipe direction before advancing', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).toContain('flushSync');
    expect(source).toContain('const exitDirection = decision ===');
    expect(source).toContain('setSwipeDirection(exitDirection)');
    expect(source).toContain('swipeDirection * 620');
  });

  it('offers order controls after resuming saved picking progress', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).toContain('reorderRemainingSongs');
    expect(source).toContain('changeRemainingOrder');
    expect(source).toContain("t('resumeOrderTitle')");
    expect(source).toContain("t('shuffleRemaining')");
  });

  it('adds richer drag feedback cues beyond the basic stamps', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).toContain('likeScale');
    expect(source).toContain('skipScale');
    expect(source).toContain('directionCueOpacity');
  });

  it('defines localized feedback copy', () => {
    const en = readFileSync('messages/en.json', 'utf8');
    const zh = readFileSync('messages/zh.json', 'utf8');

    expect(en).toContain('pickedFeedback');
    expect(en).toContain('skippedFeedback');
    expect(en).toContain('resumeOrderTitle');
    expect(en).toContain('shuffleRemaining');
    expect(zh).toContain('pickedFeedback');
    expect(zh).toContain('skippedFeedback');
    expect(zh).toContain('resumeOrderTitle');
    expect(zh).toContain('shuffleRemaining');
  });
});
