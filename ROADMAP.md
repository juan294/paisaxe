# Asturias Tourism Website - Roadmap

A living document tracking implemented features and future development plans.

**Last Updated**: January 2026

---

## Legend

| Status | Meaning |
|--------|---------|
| :white_check_mark: | Complete |
| :construction: | In Progress |
| :calendar: | Planned |
| :bulb: | Idea / Backlog |

---

## Phase 1: MVP (Complete)

### Core Experience

| Feature | Status | Notes |
|---------|--------|-------|
| Immersive Story Viewer | :white_check_mark: | Full-screen visual stories with Ken Burns effect |
| Swipe/Arrow Navigation | :white_check_mark: | Touch and keyboard support |
| Auto-play Mode | :white_check_mark: | 6-second intervals |
| Progress Indicator | :white_check_mark: | Shows position in story sequence |
| Story Categories | :white_check_mark: | 5 categories: Nature, Cities, Food, Culture, Activities |
| 8 Curated Stories | :white_check_mark: | Hardcoded initial content |

### Voice & Text Chat

| Feature | Status | Notes |
|---------|--------|-------|
| Text Chat Interface | :white_check_mark: | Modal dialog with message history |
| Voice Input | :white_check_mark: | Web Speech API (Spanish) |
| Context-Aware Responses | :white_check_mark: | Answers based on current story |
| Multilingual Responses | :white_check_mark: | Responds in user's language |
| Source Attribution | :white_check_mark: | References PDF sources |

### AI & Search Backend

| Feature | Status | Notes |
|---------|--------|-------|
| Vector Search | :white_check_mark: | Supabase pgvector (1024 dims) |
| Voyage AI Embeddings | :white_check_mark: | voyage-3 model |
| Claude Integration | :white_check_mark: | Claude Sonnet for responses |
| Keyword Fallback Search | :white_check_mark: | Place name matching |
| Related Images Retrieval | :white_check_mark: | From search results |

### Data Pipeline

| Feature | Status | Notes |
|---------|--------|-------|
| PDF Text Extraction | :white_check_mark: | 37 PDFs in content/pdfs/ |
| Content Chunking | :white_check_mark: | Smart paragraph splitting |
| Batch Embedding Generation | :white_check_mark: | Rate-limited processing |
| Database Seeding | :white_check_mark: | With clear/reseed option |

### Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Next.js 16 App Router | :white_check_mark: | TypeScript strict mode |
| Supabase PostgreSQL | :white_check_mark: | With pgvector extension |
| shadcn/ui Components | :white_check_mark: | Button, Card, Dialog, Input |
| Tailwind CSS Styling | :white_check_mark: | Custom theme config |
| Vitest Testing | :white_check_mark: | Core test coverage |
| GitHub Actions CI | :white_check_mark: | Lint, typecheck, test, build |
| Git Hooks (Husky) | :white_check_mark: | Pre-commit quality checks |

---

## Phase 2: Content & Polish (Current)

### Content Expansion

| Feature | Status | Notes |
|---------|--------|-------|
| Dynamic Story Loading | :calendar: | Load from database instead of hardcoded |
| Additional Stories | :calendar: | Expand beyond 8 initial stories |
| Image Optimization | :calendar: | Use actual Asturias photos (not Unsplash) |
| PDF Image Extraction | :calendar: | Extract and use images from source PDFs |

### UX Improvements

| Feature | Status | Notes |
|---------|--------|-------|
| Loading Skeleton States | :calendar: | For stories and chat |
| Error Boundaries | :calendar: | Graceful error handling |
| Offline Support | :calendar: | Service worker for cached content |
| Haptic Feedback | :calendar: | For mobile navigation |
| Swipe Gesture Tutorial | :calendar: | First-time user onboarding |

### Chat Enhancements

| Feature | Status | Notes |
|---------|--------|-------|
| Chat History Persistence | :calendar: | Save across sessions |
| Suggested Questions | :calendar: | Context-based prompts |
| Voice Output (TTS) | :calendar: | Read responses aloud |
| Image Display in Chat | :calendar: | Show related images inline |

### Accessibility

| Feature | Status | Notes |
|---------|--------|-------|
| Screen Reader Support | :calendar: | ARIA labels and live regions |
| Reduced Motion Mode | :calendar: | Respect prefers-reduced-motion |
| High Contrast Mode | :calendar: | For visibility |
| Keyboard Navigation | :white_check_mark: | Arrow keys, Space, 'i' key |

---

## Phase 3: Discovery & Engagement

### Navigation Features

| Feature | Status | Notes |
|---------|--------|-------|
| Category Filtering | :bulb: | Browse by category |
| Story Search | :bulb: | Find specific stories |
| Story Map View | :bulb: | Geographic exploration |
| Related Stories | :bulb: | Recommendations based on current story |

### Social Features

| Feature | Status | Notes |
|---------|--------|-------|
| Share Story | :bulb: | Social media sharing |
| Story Deep Links | :bulb: | Direct links to specific stories |
| Save Favorites | :bulb: | Local storage or account-based |
| Trip Planner | :bulb: | Create custom itineraries |

### Analytics

| Feature | Status | Notes |
|---------|--------|-------|
| Story View Tracking | :bulb: | Popular content insights |
| Chat Analytics | :bulb: | Common questions |
| User Journey Mapping | :bulb: | Navigation patterns |

---

## Phase 4: Advanced Features

### AI Enhancements

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-turn Conversations | :bulb: | Remember chat context |
| Personalized Recommendations | :bulb: | Based on browsing history |
| Semantic Story Search | :bulb: | Natural language queries |
| AI-Generated Itineraries | :bulb: | Custom trip planning |

### Rich Media

| Feature | Status | Notes |
|---------|--------|-------|
| Video Stories | :bulb: | Embedded video content |
| 360° Panoramas | :bulb: | Immersive location views |
| Audio Guides | :bulb: | Narrated story content |
| Weather Integration | :bulb: | Real-time conditions |

### Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| Google Maps | :bulb: | Location markers |
| Calendar Export | :bulb: | Save events/festivals |
| Transportation APIs | :bulb: | Getting there info |
| Weather APIs | :bulb: | Current conditions |

---

## Technical Debt & Improvements

| Item | Priority | Notes |
|------|----------|-------|
| Increase test coverage | High | Target 80%+ coverage |
| Add E2E tests | Medium | Playwright for critical flows |
| Performance optimization | Medium | Lighthouse audit |
| Bundle size reduction | Low | Code splitting |
| API rate limiting | Medium | Protect endpoints |
| Error logging | Medium | Sentry or similar |
| Database indexes | Low | Query optimization |

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0 | Jan 2026 | MVP - Immersive stories + voice chat |
| v0.2.0 | - | Content expansion |
| v0.3.0 | - | Discovery features |
| v1.0.0 | - | Production release |

---

## Contributing

1. Pick an item from Phase 2 or Technical Debt
2. Create a feature branch from `develop`
3. Implement with tests (TDD workflow)
4. Submit PR for review
5. Update this roadmap when complete

---

## Notes

- All development on `develop` branch
- Production releases merge to `main`
- Follow TDD workflow (Red-Green-Refactor)
- Run `npm run test && npm run typecheck && npm run lint` before commits
