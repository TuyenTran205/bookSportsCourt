// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

describe('Card Component (TC-DM-04: Dark Mode Semantic Tokens)', () => {
  it('render Card với các token ngữ nghĩa bg-bg-card, border-border, text-text-primary', () => {
    render(
      <Card data-testid="test-card">
        <CardHeader>
          <CardTitle>Tiêu đề Card</CardTitle>
          <CardDescription>Mô tả chi tiết của thẻ</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Nội dung thẻ</p>
        </CardContent>
      </Card>,
    );

    const card = screen.getByTestId('test-card');
    expect(card.className).toContain('border-border');
    expect(card.className).toContain('bg-bg-card');
    expect(card.className).toContain('text-text-primary');
    expect(card.className).not.toContain('bg-white');

    const title = screen.getByText('Tiêu đề Card');
    expect(title.className).toContain('text-text-primary');
    expect(title.className).not.toContain('text-neutral-900');

    const desc = screen.getByText('Mô tả chi tiết của thẻ');
    expect(desc.className).toContain('text-text-secondary');
    expect(desc.className).not.toContain('text-neutral-600');
  });
});
