import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, imageBase64 } = await req.json();

    const messages: any[] = [];

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract the recipe from this image. Return ONLY a JSON object with these exact fields: name (string), time_minutes (number or null), servings (number or null), ingredients (array of objects with name and amount strings), steps (array of strings). No other text, no markdown, just the raw JSON.',
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: `Extract the recipe from this text. Return ONLY a JSON object with these exact fields: name (string), time_minutes (number or null), servings (number or null), ingredients (array of objects with name and amount strings), steps (array of strings). No other text, no markdown, just the raw JSON.\n\n${text}`,
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages,
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      parsed = {};
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});