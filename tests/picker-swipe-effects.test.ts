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

  it('defines localized feedback copy', () => {
    const en = readFileSync('messages/en.json', 'utf8');
    const zh = readFileSync('messages/zh.json', 'utf8');

    expect(en).toContain('pickedFeedback');
    expect(en).toContain('skippedFeedback');
    expect(zh).toContain('pickedFeedback');
    expect(zh).toContain('skippedFeedback');
  });
});
