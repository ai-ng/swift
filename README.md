# [Swift](https://swift-ai.vercel.app)

Swift is a fast AI voice assistant.

-   [Groq](https://groq.com) is used for fast inference of [OpenAI Whisper](https://github.com/openai/whisper) (for transcription) and [Meta Llama 3](https://llama.meta.com/llama3/) (for generating the text response).
-   [Cartesia](https://cartesia.ai)'s [Sonic](https://cartesia.ai/sonic) voice model is used for fast speech synthesis, which is streamed to the frontend.
-   [VAD](https://www.vad.ricky0123.com/) is used to detect when the user is talking, and run callbacks on speech segments.
-   The app is a [Next.js](https://nextjs.org) project written in TypeScript and deployed to [Vercel](https://vercel.com).

Thank you to the teams at Groq and Cartesia for providing access to their APIs for this demo!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fai-ng%2Fswift&env=GROQ_API_KEY,CARTESIA_API_KEY&envDescription=Groq%20and%20Cartesia's%20APIs%20are%20used%20for%20transcription%2C%20text%20generation%2C%20and%20speech%20synthesis.&project-name=swift&repository-name=swift&demo-title=Swift&demo-description=A%20fast%2C%20open-source%20voice%20assistant%20powered%20by%20Groq%2C%20Cartesia%2C%20and%20Vercel.&demo-url=https%3A%2F%2Fswift-ai.vercel.app&demo-image=https%3A%2F%2Fswift-ai.vercel.app%2Fopengraph-image.png)

## Developing

-   Clone the repository
-   Copy `.env.example` to `.env.local` and fill in the environment variables.
-   Run `pnpm install` to install dependencies.
-   Run `pnpm dev` to start the development server.
