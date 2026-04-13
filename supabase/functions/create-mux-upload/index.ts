import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID')!;
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET')!;
const MUX_BASE_URL = 'https://api.mux.com';

const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if this is a status check request
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (body.action === 'check' && body.uploadId) {
    // Check upload status
    const res = await fetch(
      `${MUX_BASE_URL}/video/v1/uploads/${body.uploadId}`,
      {
        headers: { Authorization: `Basic ${muxAuth}` },
      }
    );
    const data = await res.json();

    if (data.data?.asset_id) {
      // Get the asset
      const assetRes = await fetch(
        `${MUX_BASE_URL}/video/v1/assets/${data.data.asset_id}`,
        {
          headers: { Authorization: `Basic ${muxAuth}` },
        }
      );
      const assetData = await assetRes.json();

      return new Response(
        JSON.stringify({ asset: assetData.data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ asset: null, status: data.data?.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create a new direct upload
  const res = await fetch(`${MUX_BASE_URL}/video/v1/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${muxAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
      },
      cors_origin: '*',
    }),
  });

  const data = await res.json();

  return new Response(
    JSON.stringify({
      uploadUrl: data.data.url,
      uploadId: data.data.id,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
