import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3535),
  riotApiKey: z.string().optional(),
  riotPlatform: z.string().default('la1'),
  riotRegion: z.string().default('americas'),
  ddragonLocale: z.string().default('es_MX'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    port: env.PORT,
    riotApiKey: env.RIOT_API_KEY,
    riotPlatform: env.RIOT_PLATFORM,
    riotRegion: env.RIOT_REGION,
    ddragonLocale: env.DDRAGON_LOCALE,
  });
}
