# [Swift](https://swift-ai.vercel.app)

Swift is a fast AI voice assistant.

-   [Groq](https://groq.com) is used for fast inference of [OpenAI Whisper](https://github.com/openai/whisper) (for transcription) and [Meta Llama 3](https://llama.meta.com/llama3/) (for generating the text response).
-   [Cartesia](https://cartesia.ai)'s [Sonic](https://cartesia.ai/sonic) voice model is used for fast speech synthesis, which is streamed to the frontend.
-   The app is a [Next.js](https://nextjs.org) project written in TypeScript.

Thank you to the teams at Groq and Cartesia for providing access to their APIs for this demo!

## Developing

-   Clone the repository
-   Create a `.env.local` file with:
    -   `GROQ_API_KEY` from [console.groq.com](https://console.groq.com).
    -   `CARTESIA_API_KEY` from [play.cartesia.ai](https://play.cartesia.ai/console).
-   Run `pnpm install` to install dependencies.
-   Run `pnpm dev` to start the development server.
