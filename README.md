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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Build local

Deux prérequis que `next build` ne devine pas.

**1. Une clé Stripe, même factice.** `lib/stripe.ts` lève une erreur à l'import si
`STRIPE_SECRET_KEY` est absente. Le build n'appelle jamais Stripe, n'importe quelle
valeur suffit.

**2. Un plafond de workers de prérendu.** Next en lance un par cœur. Sur une machine
à beaucoup de cœurs mais peu de RAM libre, les 214 pages statiques font tomber le
build en `Zone Allocation failed`. `NEXT_BUILD_CPUS` plafonne le nombre de workers.
Non défini, le comportement natif s'applique : les builds Vercel ne sont pas ralentis.

PowerShell :

```powershell
$env:STRIPE_SECRET_KEY="sk_test_fake"; $env:NEXT_BUILD_CPUS="2"; npx next build
```

bash :

```bash
STRIPE_SECRET_KEY=sk_test_fake NEXT_BUILD_CPUS=2 npx next build
```

Piège à connaître : `Zone Allocation failed` n'est **pas** une saturation du tas V8,
c'est le système qui refuse la mémoire. Augmenter `--max-old-space-size` n'y change
rien, il faut réduire le nombre de processus.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
