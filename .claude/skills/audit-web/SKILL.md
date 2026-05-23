---
description: Enforce web project standards
name: audit-web
user-invocable: true
---

- Audit all project files
- Skip paths in `.gitignore`

## Protocol

- Report issues in a table with columns: ID, File, Lines, Issue
- No editorializing
- Fix only with user approval

## Security

- HTTPS enforced
- Secrets excluded from version control and client bundles
- Input validation and sanitization on all user data
- XSS prevention with output encoding and CSP headers
- CSRF protection on state-changing requests
- Security headers: X-Frame-Options, Referrer-Policy, HSTS
- Cookies use `HttpOnly`, `Secure`, and `SameSite`
- CORS configured for allowed origins
- Dependency vulnerabilities scanned
- Rate limiting on API endpoints
- Subresource integrity for external scripts

## Accessibility

- `lang` attribute on `<html>`
- Unique and descriptive page titles
- Skip navigation link
- Semantic HTML with logical heading hierarchy
- Focus order matches visual order
- Keyboard navigation with visible focus indicators
- Color contrast meets WCAG AA: 4.5:1 for text, 3:1 for UI
- Alt text on all images or marked decorative
- Form inputs have associated labels
- Form errors associated via `aria-describedby`
- ARIA labels and roles on elements without visible text
- No information conveyed by color alone
- Decorative elements hidden from assistive technology
- Reduced motion respected via `prefers-reduced-motion`
- Page functional at 200% zoom

## Performance

- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Lighthouse score 90+ on mobile
- No render-blocking resources in critical path
- Code split by route
- JavaScript bundle minimized with tree shaking
- Images optimized: modern formats, `srcset`, lazy loading, dimensions set
- Critical CSS inlined, non-critical deferred
- Fonts preloaded with `font-display: swap`
- Assets compressed and cached via CDN
- Third-party scripts async or deferred
- Preconnect and DNS prefetch for third-party origins

## Responsiveness

- No horizontal scroll at any viewport
- Mobile layout functional from 320px
- Navigation adapts per breakpoint
- Touch targets minimum 44x44px
- Typography scales with readable line lengths
- Large screens capped with max-width container
- Tables scroll or stack on mobile

## Visuals

- Typography hierarchy consistent
- Hover, focus, active, and disabled states on all interactive elements
- Shared transition durations and easing
- Spacing from design tokens
- UI consistent across pages
- Icons match in style and sizing
- `prefers-color-scheme` respected if dark mode supported
- Loading and skeleton states for async content
- Empty and error states designed

## Interactivity

- Interactive elements respond immediately
- Focus trapped in modals and restored on close
- Disabled states prevent interaction and appear muted
- Form inputs validate inline with error messages
- Smooth scroll with anchor offsets
- Double-submit prevented on forms
- Browser history navigation functional

## Errors

- Error boundaries catch component failures
- Errors logged to monitoring service
- 404 and error pages styled and helpful
- API errors show user-friendly messages
- Graceful degradation when features unavailable
- Network failures trigger retry logic
- Fallback UI for failed component loads
- Offline fallback page

## Content

- All links functional
- Unique and descriptive headings
- No placeholder text or dummy data
- Spelling, grammar, and punctuation correct
- Dates and numbers formatted for locale

## Compatibility

- Cross-browser: Chrome, Firefox, Safari, Edge
- Mobile: iOS and Android
- Input methods: mouse, touch, keyboard
