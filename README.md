This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## GitHub Codespaces

This repository includes a dev-container configuration. Open it with **Code → Create codespace on main**; dependencies install automatically and port 3000 opens in the Codespaces preview.

Add the required Supabase and optional Ollama variables as [Codespaces secrets](https://github.com/settings/codespaces). In the terminal, run:

```bash
npm run dev
```

Before deployment, verify the production build:

```bash
npm run build
npm start
```

To deploy from the Codespaces terminal, import the repository into Vercel and configure the same environment variables there. Vercel detects the Next.js build automatically; do not add `.env.local` or any credentials to the repository.

This project uses local system font stacks and does not load fonts from third-party providers.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
