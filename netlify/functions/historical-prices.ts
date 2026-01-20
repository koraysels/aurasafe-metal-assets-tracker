import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
  // Get allowed domains from environment variable (comma-separated)
  const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';

  // Check if request is from an allowed domain or localhost
  const isAllowed =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    allowedDomains.some((domain) => origin.includes(domain));

  if (!isAllowed && allowedDomains.length > 0) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const url = new URL(req.url);
  const metal = url.searchParams.get('metal') || 'XAU';
  const currency = url.searchParams.get('currency') || 'USD';
  const weightUnit = url.searchParams.get('weight_unit') || 'g';

  // Validate inputs
  if (!['XAU', 'XAG'].includes(metal)) {
    return new Response(JSON.stringify({ error: 'Invalid metal' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }

  try {
    // Fetch from goldbroker API
    const response = await fetch(
      `https://goldbroker.com/api/historical-spot-prices?metal=${metal}&currency=${currency}&weight_unit=${weightUnit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch prices' }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*',
        },
      });
    }

    const data = await response.json();

    // Return with aggressive caching headers
    // CDN will cache for 24 hours, browsers will cache for 24 hours
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
        // Cache for 24 hours at both CDN and browser level
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=86400',
        'Netlify-CDN-Cache-Control': 'public, max-age=86400, durable',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }
};
