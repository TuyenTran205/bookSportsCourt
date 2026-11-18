// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import {
  SportPinIcon,
  getSportPinIconUrl,
  resolveSportPinDef,
} from './SportPinIcon';

describe('SportPinIcon', () => {
  it('resolves correct definition for sports and aliases', () => {
    expect(resolveSportPinDef('badminton').id).toBe('badminton');
    expect(resolveSportPinDef('cau-long').id).toBe('badminton');
    expect(resolveSportPinDef('soccer').id).toBe('soccer');
    expect(resolveSportPinDef('bong-da').id).toBe('soccer');
    expect(resolveSportPinDef('pickleball').id).toBe('pickleball');
    expect(resolveSportPinDef('tennis').id).toBe('tennis');
    expect(resolveSportPinDef('basketball').id).toBe('basketball');
    expect(resolveSportPinDef('volleyball').id).toBe('volleyball');
    expect(resolveSportPinDef('table-tennis').id).toBe('table-tennis');
    expect(resolveSportPinDef('swimming').id).toBe('swimming');
    expect(resolveSportPinDef('gym').id).toBe('gym');
    expect(resolveSportPinDef('running').id).toBe('running');
    expect(resolveSportPinDef('golf').id).toBe('golf');
    expect(resolveSportPinDef('billiards').id).toBe('billiards');
    expect(resolveSportPinDef('martial-arts').id).toBe('martial-arts');
    expect(resolveSportPinDef('bowling').id).toBe('bowling');
    expect(resolveSportPinDef('archery').id).toBe('archery');
    expect(resolveSportPinDef('ban-cung').id).toBe('archery');
    expect(resolveSportPinDef('cycling').id).toBe('cycling');
    expect(resolveSportPinDef('xe-dap').id).toBe('cycling');
    expect(resolveSportPinDef('climbing').id).toBe('climbing');
    expect(resolveSportPinDef('skating').id).toBe('skating');
    expect(resolveSportPinDef('yoga').id).toBe('yoga');
    expect(resolveSportPinDef('pilates').id).toBe('yoga');
    expect(resolveSportPinDef('unknown-sport').id).toBe('general');
  });

  it('provides valid SVG asset URL via getSportPinIconUrl', () => {
    expect(getSportPinIconUrl('badminton')).toBe('/icons/sports/badminton.svg');
    expect(getSportPinIconUrl('cau-long')).toBe('/icons/sports/badminton.svg');
    expect(getSportPinIconUrl('soccer')).toBe('/icons/sports/soccer.svg');
    expect(getSportPinIconUrl('pickleball')).toBe('/icons/sports/pickleball.svg');
  });

  it('renders SVG with inverted teardrop path and sport symbol', () => {
    const { container } = render(<SportPinIcon sport="badminton" size={40} className="test-pin" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Cầu lông');
    expect(svg?.classList.contains('test-pin')).toBe(true);

    // Verifies teardrop pin path is present
    const path = container.querySelector('path[d*="M 24 52"]');
    expect(path).not.toBeNull();
  });

  it('renders fallback for general / unspecified sport', () => {
    const { container } = render(<SportPinIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Thể thao chung');
  });
});
