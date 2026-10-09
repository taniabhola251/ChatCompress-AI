# How ChatCompress works

ChatCompress does not use an AI model. It uses simple rules in your browser to review chat messages.

## Steps

1. **You provide a chat.** Paste text or choose a `.txt` or `.zip` export.
2. **The app reads it.** ZIP files are opened in your browser. The ZIP must contain one `.txt` chat. Photos and other media are ignored.
3. **The app splits the text into messages.** It tries to find the date, time, sender, and message. It also tries to keep multi-line messages together.
4. **The app looks for clues.** It checks for words that may show urgency, requests, dates, decisions, questions, or mentions.
5. **The dashboard shows suggestions.** You can filter messages, search, inspect nearby chat context, and mark tasks done.
6. **You can export a briefing.** The browser creates a Markdown file only when you ask it to.
7. **You can clear the workspace.** Clear All removes the app's current chat data from its memory.

## Priority levels

The app gives points to messages when it finds clues such as a direct mention, urgent wording, a request, a date, or a promise to do something.

- **High:** 35 points or more
- **Medium:** 20 to 34 points
- **Low:** fewer than 20 points

The Priority Inbox shows newer dates first. Within each date, it shows higher-priority messages first. Choose **High priority** to see only high-priority messages.

## What the results mean

These are clues, not guaranteed answers. A message can be missed or marked incorrectly. The app cannot reliably tell if a question was answered later. Similar requests are estimated by comparing words. Dates and deadlines may need checking.

Always open the original chat message before acting on a suggestion.

## Privacy

Chat files and messages are read in your browser. ChatCompress does not send them to an AI service or a server. Chat data stays in memory while the page is open. Closing or refreshing the page clears it.
