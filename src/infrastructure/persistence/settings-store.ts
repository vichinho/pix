import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Ajustes persistidos configurables desde la interfaz. */
export interface AppSettings {
  /** Clave de la Riot API (se guarda localmente, nunca se expone en la UI). */
  riotApiKey?: string;
}

/** Almacén de ajustes de la app. */
export interface SettingsStore {
  get(): AppSettings;
  set(settings: AppSettings): void;
}

/** Almacén en memoria (por defecto; ideal para tests). */
export class MemorySettingsStore implements SettingsStore {
  constructor(private current: AppSettings = {}) {}
  get(): AppSettings {
    return this.current;
  }
  set(settings: AppSettings): void {
    this.current = { ...this.current, ...settings };
  }
}

/**
 * Ajustes respaldados por un archivo JSON local. Permite configurar la Riot API
 * key desde la interfaz sin editar el `.env`. Escritura best-effort.
 */
export class FileSettingsStore implements SettingsStore {
  private current: AppSettings = {};

  constructor(private readonly filePath: string) {
    try {
      this.current = JSON.parse(readFileSync(filePath, 'utf8')) as AppSettings;
    } catch {
      // Sin archivo previo: empezamos con ajustes vacíos.
    }
  }

  get(): AppSettings {
    return this.current;
  }

  set(settings: AppSettings): void {
    this.current = { ...this.current, ...settings };
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.current), 'utf8');
    } catch {
      // Persistencia best-effort.
    }
  }
}
