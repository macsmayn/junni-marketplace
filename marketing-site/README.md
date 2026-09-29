# marketing-site

This folder is the home for the junni.ca marketing site source files.

## What this folder is for

The files here are the static marketing site served at **junni.ca** — the public-facing homepage, pricing page, and any supporting assets (CSS, JS, images). They are completely separate from the React application served at **app.junni.ca**.

## Two separate Netlify sites

| Site | Domain | What it is |
|------|--------|------------|
| This folder | junni.ca | Static marketing site |
| Vite/React app (`src/`, compiled to `dist/`) | app.junni.ca | The lender/borrower application |

The `netlify.toml` at the repo root configures the app deployment only (`publish = "dist"`). The marketing site is its own Netlify site with its own configuration.

## Historical deployment method

The marketing site was historically deployed by **Netlify Drop** — dragging the folder directly onto [app.netlify.com/drop](https://app.netlify.com/drop). There is no CI/CD and no Git connection. The only copies of the files are on the founder's laptop and in the Netlify dashboard.

## Next step

Connect the junni.ca Netlify site to this `marketing-site/` folder so deployments become automatic on every push to `main`. Once the files are copied in here, do the following in the Netlify dashboard for the junni.ca site:

1. Go to **Site configuration → Build & deploy → Continuous deployment**.
2. Link this GitHub repository.
3. Set **Base directory** to `marketing-site`.
4. Set **Publish directory** to `marketing-site` (no build command — it is a static site).
5. Deploy. Subsequent pushes to `main` will auto-deploy.
