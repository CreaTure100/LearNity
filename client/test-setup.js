import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

globalThis.React = React;

afterEach(() => {
	cleanup();
});
