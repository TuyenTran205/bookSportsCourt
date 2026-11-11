// @vitest-environment jsdom
import { test, expect } from 'vitest';
import React from 'react';
import * as ReactDOM from 'react-dom';
import { render } from '@testing-library/react';

test('diagnose react instances', () => {
  // eslint-disable-next-line no-console
  console.log('REACT_MAIN=', require.resolve('react'));
  console.log('REACTDOM_MAIN=', require.resolve('react-dom'));
  const tlReact = Object.keys(require.cache).filter((k) => /node_modules[\\/]react[\\/](index|cjs)/.test(k));
  console.log('REACT_CACHE_KEYS=', JSON.stringify(tlReact, null, 1));
  // eslint-disable-next-line no-console
  console.log('RENDER_OK=', typeof render);
  expect(React.version).toBeTruthy();
  void ReactDOM;
});
