import OpenAI from 'openai';

const VALID_TAGS = ['space', 'portrait', 'nature', 'meme', 'generative', 'sci-fi', 'philosophy', 'aesthetic'] as const;
export type PostTag = typeof VALID_TAGS[number];

const KEYWORD_RULES: Record<PostTag, RegExp> = {
  space: /\b(nasa|galaxy|galaxies|nebula|star|stars|cosmos|cosmic|planet|planets|asteroid|orbit|spacecraft|astronaut|moon|saturn|jupiter|mars|milky\s*way|supernova|black\s*hole|solar|constellation)\b/i,
  portrait: /\b(portrait|face|headshot|selfie|person|human|woman|man|girl|boy|eyes|lips|figure|bust|profile)\b/i,
  nature: /\b(nature|forest|mountain|ocean|sea|river|lake|tree|trees|flower|flowers|sunset|sunrise|landscape|waterfall|wilderness|jungle|meadow|garden|flora|fauna|wildlife|beach|sky|cloud|rain|snow)\b/i,
  meme: /\b(meme|dank|lol|funny|shitpost|cope|seethe|based|cringe|wojak|pepe|chad|bruh|ratio)\b/i,
  generative: /\b(generative|svg|canvas|p5|processing|fractal|algorithmic|procedural|geometric|pattern|patterns|mandelbrot|voronoi|perlin|noise|ascii\s*art|glsl|shader|code\s*art|creative\s*coding)\b/i,
  'sci-fi': /\b(sci[\s-]*fi|cyberpunk|dystopia|dystopian|futuristic|android|cyborg|robot|robots|mech|neon|hologram|spaceship|alien|aliens|blade\s*runner|matrix|warp|teleport|laser|plasma)\b/i,
  philosophy: /\b(philosophy|philosopher|philosophical|existential|existentialism|nihilism|stoic|stoicism|plato|aristotle|nietzsche|kant|descartes|socrates|consciousness|meaning|metaphysics|ethics|epistemology|ontology|wisdom|truth|reality|existence|absurd|dao|zen|buddha|enlightenment)\b/i,
  aesthetic: /\b(aesthetic|vaporwave|retro|vintage|minimalist|minimal|dreamy|ethereal|surreal|abstract|pastel|moody|cinematic|noir|lo[\s-]*fi|lofi|glitch|synthwave|retrowave|art\s*deco|brutalist)\b/i,
};

function keywordTag(text: string): PostTag[] {
  const matched: PostTag[] = [];
  for (const [tag, regex] of Object.entries(KEYWORD_RULES) as [PostTag, RegExp][]) {
    if (regex.test(text)) matched.push(tag);
  }
  return matched.slice(0, 3);
}

async function llmTag(text: string): Promise<PostTag[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `You are a content tagger. Given a post's text, return 1-3 tags from this exact set: ${VALID_TAGS.join(', ')}. Return ONLY a JSON array of strings, nothing else. If none fit, return [].`,
        },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '[]';
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as string[])
      .filter((t): t is PostTag => VALID_TAGS.includes(t as PostTag))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function autoTag(caption: string | null, prompt: string | null): Promise<PostTag[]> {
  const text = [caption, prompt].filter(Boolean).join(' ');
  if (!text.trim()) return [];

  const keywordResult = keywordTag(text);
  if (keywordResult.length > 0) return keywordResult;

  return llmTag(text);
}

export { VALID_TAGS };
