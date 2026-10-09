# ChatCompress

**Less scrolling. More understanding.**

ChatCompress helps you catch up on long chat conversations. It finds messages that may need attention, tasks, dates, decisions, questions, and common topics.

## Run it

You need Node.js and npm. In the project folder, run:

```powershell
npm install
npm run dev
```

Open the web address shown in the terminal.

To make a production build:

```powershell
npm run build
npm run preview
```

## Use it

1. Select **Try the demo** or open the dashboard.
2. Paste chat text, or choose a WhatsApp `.txt` or `.zip` export.
3. Check the message preview, then select **Catch Me Up**.
4. Use the dashboard to explore the summary, priority messages, tasks, dates, decisions, and questions.
5. Clear the workspace in Privacy Center when you are done.

ZIP files must contain one chat `.txt` file. Photos and other media are ignored. The ZIP limit is 50 MB; the extracted text limit is 20 MB.

## What the app uses

- React and JavaScript for the app
- Vite for development and building
- CSS for the design
- JSZip to open WhatsApp ZIP exports in your browser
- Oxlint to check the code

There is no Gemini or other AI API. The app uses simple rules to analyze messages. Results are suggestions, so check the original chat before acting on them.

## Privacy

Chat files are read and analyzed in your browser. They are not uploaded by ChatCompress. Chat data stays in memory while the page is open and is cleared when you close or refresh it.

Read [read.md](./read.md) for a quick guide, [ai-workflow.md](./ai-workflow.md) for how the app analyzes chats, and [prompt.md](./prompt.md) for the project instructions.
