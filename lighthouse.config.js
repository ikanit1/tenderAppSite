/**
 * Lighthouse configuration for grgroup.kz audit.
 * Categories: Performance, Accessibility, Best Practices, SEO.
 * Run: npm run lighthouse:audit (production) or npm run lighthouse:local (dev server).
 */
export default {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: [
        'https://grgroup.kz/',
        'https://grgroup.kz/services',
        'https://grgroup.kz/contacts',
        'https://grgroup.kz/projects',
        'https://grgroup.kz/smart-systems',
        'https://grgroup.kz/digital-ecosystem',
        'https://grgroup.kz/work',
        'https://grgroup.kz/catalog/',
      ],
      settings: {
        preset: 'desktop',
        emulatedFormFactor: 'desktop',
        throttlingMethod: 'simulate',
        screenEmulation: { disabled: false },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputPath: 'lighthouse-reports',
    },
  },
};
