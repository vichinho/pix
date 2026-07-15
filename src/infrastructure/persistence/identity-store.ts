import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Identidad mínima persistida entre sesiones. */
export interface StoredIdentity {
  gameName: string;
  tagLine: string;
}

/** Almacén de la última identidad conocida del jugador. */
export interface IdentityStore {
  get(): StoredIdentity | null;
  set(identity: StoredIdentity): void;
}

/** Almacén en memoria (por defecto en el server; ideal para tests). */
export class MemoryIdentityStore implements IdentityStore {
  private current: StoredIdentity | null;

  constructor(initial: StoredIdentity | null = null) {
    this.current = initial;
  }

  get(): StoredIdentity | null {
    return this.current;
  }

  set(identity: StoredIdentity): void {
    this.current = identity;
  }
}

/**
 * Almacén respaldado por un archivo JSON, para recordar la última identidad
 * conectada entre reinicios del backend. La escritura es "best-effort": si falla
 * (permisos, disco), no interrumpe el flujo.
 */
export class FileIdentityStore implements IdentityStore {
  private current: StoredIdentity | null = null;

  constructor(private readonly filePath: string) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
      if (parsed.gameName && parsed.tagLine) {
        this.current = { gameName: parsed.gameName, tagLine: parsed.tagLine };
      }
    } catch {
      // No hay archivo previo o es inválido: se empieza sin identidad recordada.
    }
  }

  get(): StoredIdentity | null {
    return this.current;
  }

  set(identity: StoredIdentity): void {
    // Evita reescrituras innecesarias si no cambió.
    if (
      this.current &&
      this.current.gameName === identity.gameName &&
      this.current.tagLine === identity.tagLine
    ) {
      return;
    }
    this.current = identity;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(identity), 'utf8');
    } catch {
      // Persistencia best-effort: si falla, seguimos con el valor en memoria.
    }
  }
}
