# Deployment Instructions

## Netlify Function Setup

Your project now includes a Netlify serverless function to bypass CORS restrictions when fetching historical gold/silver prices.

### How Netlify Functions Work

Netlify automatically deploys any TypeScript files in the `netlify/functions/` directory as serverless functions. No additional configuration is needed - just commit and push!

### Required Environment Variable

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select your site (aurasafe-tracker)
3. Go to **Site configuration** > **Environment variables**
4. Click **Add a variable**
5. Add:
   - **Key**: `ALLOWED_DOMAINS`
   - **Value**: `aurasafe-tracker.netlify.app`
6. Click **Save**

### Deploy

Just commit and push your changes:

```bash
git add .
git commit -m "Add Netlify function for historical prices with domain security"
git push origin master
```

Netlify will automatically:
- Build your site
- Deploy the function to `/.netlify/functions/historical-prices`
- The function will be live immediately

### Testing Locally

To test the function locally, you'll need the Netlify CLI:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run dev server with functions
netlify dev
```

This starts your site at `http://localhost:8888` with the function accessible at `http://localhost:8888/.netlify/functions/historical-prices`

### Security Features

The function includes:
- Domain verification (only allows requests from your Netlify domain)
- Input validation (only XAU and XAG metals allowed)
- 24-hour cache headers
- Proper error handling

### Function Endpoint

Once deployed, the function is automatically available at:
- Production: `https://aurasafe-tracker.netlify.app/.netlify/functions/historical-prices?metal=XAU&currency=USD&weight_unit=g`
- Local dev: `http://localhost:8888/.netlify/functions/historical-prices?metal=XAU&currency=USD&weight_unit=g`
