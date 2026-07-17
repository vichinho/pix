import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3535),
  riotApiKey: z.string().optional(),
  riotPlatform: z.string().default('la1'),
  riotRegion: z.string().default('americas'),
  ddragonLocale: z.string().default('es_MX'),
  /** Builds del meta en vivo desde u.gg. Activado por defecto; UGG_BUILDS=off lo apaga. */
  uggBuilds: z.enum(['on', 'off']).default('on'),
  /** Fuerza el parche de u.gg (p. ej. "15_1"); vacío = descubrimiento automático. */
  uggPatch: z.string().optional(),
  /** Fuerza la versión del overview de u.gg (p. ej. "1.5.0"). */
  uggOverviewVersion: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    port: env.PORT,
    riotApiKey: env.RIOT_API_KEY,
    riotPlatform: env.RIOT_PLATFORM,
    riotRegion: env.RIOT_REGION,
    ddragonLocale: env.DDRAGON_LOCALE,
    uggBuilds: env.UGG_BUILDS,
    uggPatch: env.UGG_PATCH,
    uggOverviewVersion: env.UGG_OVERVIEW_VERSION,
  });
}
