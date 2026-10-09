# Simple project prompt

Build and improve **ChatCompress**, a React and Vite app that helps people catch up on long chat exports.

## Product

The app should help users find:

- Important messages
- Things they may need to do
- Dates and deadlines
- Decisions
- Mentions
- Questions
- Common topics

## Design

- Keep the welcome page separate from the dashboard.
- Use the dark plum, magenta, and violet style already in the app.
- Make the app work on desktop and mobile.
- Add small animations, but respect the device's reduced-motion setting.
- Keep text easy to read and controls clear.

## Import and privacy

- Let users paste text or import WhatsApp `.txt` and `.zip` exports.
- Read and analyze chats in the browser.
- A ZIP must contain one `.txt` chat. Ignore media files.
- Do not upload chats or ask for WhatsApp login details.
- Keep chat data in memory only. Do not add a server or database unless requested.

## Dashboard

Include:

- A demo chat with fictional messages
- A summary of what happened
- A Priority Inbox with a High priority filter
- Dates, shown newest first
- Tasks, deadlines, decisions, mentions, questions, and a timeline
- Search and filters
- A way to open the original message context
- A local Markdown briefing download
- A way to clear loaded chat data

## Analysis

Use simple, explainable rules. Do not claim it is AI. Show why a message was marked important, and remind users to check the original chat because results may be wrong.

Do not add a Gemini API or WhatsApp account connection unless the user asks and a safe, real integration is available.

## Before finishing

Run:

```powershell
npm run build
npm run lint
```

Report what changed and whether both commands passed. Do not say the app is deployed unless it has actually been deployed.

## Updated UI prompt

You are a senior product designer and front-end engineer. Redesign and optimize ChatCompress, a privacy-first dashboard that imports WhatsApp `.txt` and `.zip` exports and creates a local catch-up summary, priority inbox, action items, deadlines, decisions, questions, and repeated requests.

### Important rules

- Do not change the existing parsing, local rule-based analysis, privacy behavior, file import, search, reset, or demo-data logic.
- Improve the interface, usability, motion, and performance only.
- Keep the current technology stack. Do not add dependencies unless they are needed and approved.
- Keep all existing features and labels.

### Dashboard layout

Keep the header, dashboard title, and three main areas: workspace navigation, conversations and search, and the import and results panel. Make the layout clear and responsive: three columns on wide screens, two columns on tablets, and one column with mobile navigation on small screens.

### Visual style

Use a premium dark aurora theme: deep violet-black background, softly moving pink, violet, indigo, and teal light, subtle texture, and glass-like cards. Use reusable CSS variables for color, spacing, radii, shadows, and motion. Use clear, high-contrast text, consistent spacing, visible keyboard focus, and color-coded priority indicators.

### Component improvements

- Make the header translucent and sticky, with a privacy badge that explains that chats stay in this browser.
- Make the workspace navigation collapsible on desktop and easy to use on mobile.
- Give the conversation list a useful empty state and clear selected, attention, and hover states.
- Replace the large always-open chat box with a terminal-style preview of the first four lines, a fade, and a **Show full text** control. Keep text editing available.
- Make the file drop area and **Catch Me Up** button clear and responsive.
- Improve the four statistic cards with icons, color accents, and hover feedback.
- Improve priority message cards with readable dates, clear priority color, and accessible actions.
- Keep the catch-up summary and existing analysis results easy to scan.
- Add a keyboard command palette to navigate sections or search messages, a light/dark theme control, action feedback toasts, and a confirmation dialog before resetting.

### Motion and performance

- Use subtle entrance and hover animation; animate only transforms and opacity where practical.
- Respect `prefers-reduced-motion` and pause ambient animation when the page is hidden.
- Debounce search and avoid rendering very long message lists all at once.
- Memoize expensive derived data where it helps.
- Keep current chat handling local. Do not introduce a server, database, AI service, or third-party upload.
- Do not show fake analysis progress. If analysis is moved to a worker later, keep its output and rules identical and report progress only when it reflects actual work.

### Accessibility and responsive behavior

- Use semantic landmarks, keyboard-friendly controls, ARIA labels, readable contrast, visible focus styles, and comfortable touch targets.
- Avoid overlapping, clipped, or horizontally overflowing content at phone, tablet, and desktop widths.

### Finish

Run `npm run build` and `npm run lint`. Report the changes, any new dependencies, and the validation results. Do not claim the app is deployed unless it has actually been deployed.
